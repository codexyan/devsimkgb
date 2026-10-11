import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { BELUM_SELESAI, nilaiUsulan } from "@/lib/usulanPegawai";
import { ringkasDasarBaru } from "@/lib/dasarBaruUsulan";
import { KOSONG_ACUAN, isiHitungan } from "@/lib/usulanFormulir";
import {
  BATAS_BARIS_IMPOR,
  dapatDisimpan,
  periksaImporUpt,
  ringkasImpor,
  type HasilBarisImpor,
} from "@/lib/imporUsulanUpt";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { kodeSatkerPegawai } from "@/lib/rekapSatker";
import { SATKER } from "@/lib/satker";
import type { PegawaiRow, UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Unggahan hanya dapat dilakukan akun Admin UPT yang tertaut ke satker.";

/**
 * Unggahan massal data pegawai oleh UPT.
 *
 * Satu berkas menjadi banyak draf sekaligus. Tanpa jalur ini, mengisi satker berisi ratusan pegawai
 * berarti mengetik formulir ratusan kali, dan itulah yang menahan tujuh belas UPT tetap kosong.
 *
 * Satkernya diambil dari akun, tidak pernah dari berkas: kolom unit kerja pada berkas sengaja
 * diabaikan, supaya satu UPT tidak dapat menuliskan pegawai ke satker lain hanya dengan mengetik nama
 * satker itu di berkasnya sendiri.
 *
 * Dua tahap, dua permintaan:
 *   - `periksaSaja: true` menilai berkas tanpa menyimpan apa pun, dan mengembalikan penilaian tiap
 *     baris beserta nilai hasil pembacaannya. Operator memeriksanya di layar pratinjau, sehingga
 *     tanggal yang salah tafsir atau kolom yang bergeser ketahuan sebelum tersimpan, bukan sesudah.
 *   - tanpa `periksaSaja`, baris yang nomornya disebut di `pilih` disimpan. Berkasnya dinilai ulang di
 *     sini, bukan dipercaya dari hasil pratinjau, sebab keadaan basis data dapat berubah di sela
 *     kedua permintaan itu; baris yang penilaiannya sudah berbeda dilewati dan dilaporkan.
 *
 * Aturan penilaiannya satu tempat, di lib/imporUsulanUpt.ts, bukan disalin ke peramban.
 */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;
  const { pengguna, kode } = akun;
  const satker = SATKER.find((s) => s.kode === kode)!;

  const body = (await req.json().catch(() => ({}))) as { baris?: unknown; periksaSaja?: unknown; pilih?: unknown };
  const baris = Array.isArray(body.baris) ? (body.baris as Record<string, unknown>[]) : null;
  if (!baris || baris.length === 0)
    return NextResponse.json({ error: "Berkas tidak berisi satu baris data pun" }, { status: 400 });
  if (baris.length > BATAS_BARIS_IMPOR)
    return NextResponse.json(
      { error: `Sekali unggah paling banyak ${BATAS_BARIS_IMPOR} baris. Bagi berkasnya menjadi beberapa bagian.` },
      { status: 413 },
    );

  const [semuaPegawai, berjalan] = await Promise.all([
    db.pegawai.findMany() as Promise<PegawaiRow[]>,
    db.usulanPegawai.findMany({ where: { status: { in: BELUM_SELESAI } } }) as Promise<UsulanPegawaiRow[]>,
  ]);

  // NIP diperiksa terhadap seluruh satker, bukan satker ini saja: satu pegawai hanya boleh ada satu kali
  // di data induk. Yang tercatat di satker ini menjadi bahan usulan perbaikan; yang di satker lain
  // ditolak dengan menyebut satkernya, supaya operator menghubungi Kanwil alih-alih mengira NIP-nya salah.
  const pegawaiSatkerIni = new Map<string, PegawaiRow>();
  const satkerLain = new Map<string, string>();
  for (const p of semuaPegawai) {
    if (kodeSatkerPegawai(p.unitKerja) === kode) pegawaiSatkerIni.set(p.nip, p);
    else satkerLain.set(p.nip, p.unitKerja || "satker lain");
  }

  const hasil = periksaImporUpt(baris, {
    pegawaiSatker: pegawaiSatkerIni,
    satkerLain,
    nipUsulan: new Set(berjalan.filter((u) => u.jenis === "baru").map((u) => u.nip).filter((nip): nip is string => !!nip)),
    pegawaiIdUsulan: new Set(berjalan.map((u) => u.pegawaiId).filter((id): id is string => !!id)),
  });
  const ringkas = ringkasImpor(hasil);

  if (body.periksaSaja === true) {
    return NextResponse.json({
      periksaSaja: true,
      ...ringkas,
      baris: hasil.map((h) => ({
        baris: h.baris,
        nip: h.nip,
        nama: h.nama,
        hasil: h.hasil,
        galat: h.galat,
        kurang: h.kurang,
        namaTercatat: h.namaTercatat,
        beda: h.beda.map((b) => ({ label: b.label, sekarang: b.sekarang, diusulkan: b.diusulkan })),
        // SK sebab perubahan yang disebut baris ini, satu kalimat siap tampil; null bila tidak disebut. Keadaan pada SK
        // KGB terakhir ikut disebut bila barisnya mengisinya (ADR-078).
        dasarBaru: [
          ringkasDasarBaru(h.dasarBaru ?? {}),
          h.acuan ? `pada SK KGB terakhir ${h.acuan.golonganAcuan}, ${h.acuan.mkgTahunAcuan ?? "?"} tahun ${h.acuan.mkgBulanAcuan ?? 0} bulan` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
        // Nilai yang benar-benar akan tersimpan, sudah lewat pembacaan tanggal dan hitungan sistem.
        // Inilah yang diperiksa operator: tanggal yang salah tafsir terlihat di sini, bukan setelah tersimpan.
        nilai: h.isian
          ? nilaiUsulan(isiHitungan(h.isian, pegawaiSatkerIni.get(h.nip) ?? null, { ...h.dasarBaru, ...h.acuan })).map((n) => ({
              label: n.label,
              nilai: n.nilai,
            }))
          : [],
      })),
    });
  }

  // Tanpa daftar pilihan, seluruh baris yang dapat disimpan ikut; dengan daftar, hanya nomor yang disebut.
  const pilih = Array.isArray(body.pilih) ? new Set(body.pilih.map(Number)) : null;
  const diminta = pilih ? hasil.filter((h) => pilih.has(h.baris)) : dapatDisimpan(hasil);
  const disimpan = diminta.filter((h) => h.hasil === "baru" || h.hasil === "perubahan");
  // Baris yang dipilih operator tetapi penilaiannya sudah berbeda saat disimpan, misalnya karena operator
  // lain mengirim usulan atas pegawai yang sama di sela pratinjau dan penyimpanan.
  const berubahSejakPratinjau = diminta.length - disimpan.length;

  const sekarang = new Date();
  const diajukanOleh = `${pengguna.nama} (${pengguna.nip})`;
  const kosong = {
    nama: null, tempatLahir: null, tanggalLahir: null, jenisKelamin: null,
    pendidikanTerakhir: null, jabatan: null, pangkat: null, golonganRuang: null,
    eselon: null, jenisJabatan: null, tmtGolongan: null,
    mkgTahun: null, mkgBulan: null, gajiPokok: null,
    tmtKgbTerakhir: null, tmtKgbBerikutnya: null,
  } as const;

  const barisUsulan = (h: HasilBarisImpor): UsulanPegawaiRow => {
    const baru = h.hasil === "baru";
    const tercatat = h.pegawaiId ? pegawaiSatkerIni.get(h.nip) ?? null : null;
    return {
      id: newId(),
      pegawaiId: h.pegawaiId,
      satker: kode,
      status: "draf",
      jenis: baru ? "baru" : "perubahan",
      // NIP kolom atas hanya penanda draf pegawai baru; pada usulan perbaikan, pegawainya ditunjuk
      // pegawaiId dan NIP-nya ikut lewat isian bila memang sedang dibetulkan.
      nip: baru ? h.nip : null,
      unitKerja: baru ? satker.nama : null,
      nomorSurat: null,
      tanggalSurat: null,
      pathBerkas: null,
      pathSkTerakhir: null,
      pathSyaratCpns: null,
      pathSkPangkat: null,
      pathSkCpns: null,
      // Pindaian SK tidak lewat CSV; slotnya diisi saat draf dilengkapi (ADR-045).
      pathSkPmk: null,
      ...kosong,
      nomorSkTerakhir: null,
      tanggalSkTerakhir: null,
      // Sebab golongan atau masa kerja berubah beserta SK-nya (ADR-030), bila berkasnya menyebutkan.
      // Baris yang mengosongkannya tetap tersimpan sebagai draf, dan kekurangannya ditagih saat draf itu
      // dilengkapi di Usul KGB Kolektif.
      dasarBaruJenis: h.dasarBaru?.dasarBaruJenis ?? null,
      dasarBaruJenisKp: h.dasarBaru?.dasarBaruJenisKp ?? null,
      dasarBaruNomorSk: h.dasarBaru?.dasarBaruNomorSk ?? null,
      dasarBaruTanggalSk: h.dasarBaru?.dasarBaruTanggalSk ?? null,
      dasarBaruTmt: h.dasarBaru?.dasarBaruTmt ?? null,
      dasarBaruPenetap: h.dasarBaru?.dasarBaruPenetap ?? null,
      // Keadaan pada SK KGB terakhir bagi pegawai baru yang melaporkan SK sesudahnya (ADR-078).
      ...(h.acuan ?? KOSONG_ACUAN),
      hukdisAda: false,
      hukdisJenis: null,
      hukdisNomorSk: null,
      hukdisTmtMulai: null,
      hukdisTmtBerakhir: null,
      hukdisKeterangan: null,
      catatanUpt: null,
      diajukanOleh,
      diajukanAt: sekarang,
      ditinjauOleh: null,
      ditinjauAt: null,
      alasanTolak: null,
      ...isiHitungan(h.isian!, tercatat, { ...h.dasarBaru, ...h.acuan }),
    };
  };

  const rows = disimpan.map(barisUsulan);
  if (rows.length > 0) await db.usulanPegawai.createMany(rows);

  const jumlahBaru = disimpan.filter((h) => h.hasil === "baru").length;
  const jumlahPerubahan = disimpan.length - jumlahBaru;
  const belumLengkap = disimpan.filter((h) => h.kurang.length > 0).length;

  logAudit({
    userId: pengguna.id,
    aksi: "impor_draf_pegawai",
    detail:
      `Unggah massal ${satker.nama}: ${jumlahBaru} pegawai baru dan ${jumlahPerubahan} usulan perbaikan ` +
      `disiapkan dari ${baris.length} baris berkas` +
      (ringkas.sama > 0 ? `, ${ringkas.sama} baris sama dengan data tercatat` : "") +
      (ringkas.ditolak > 0 ? `, ${ringkas.ditolak} baris ditolak` : "") +
      (belumLengkap > 0 ? `, ${belumLengkap} belum lengkap` : ""),
    targetNama: satker.nama,
  });

  // Angkanya sengaja tentang yang tersimpan, bukan tentang seluruh berkas, kecuali "sama" dan "ditolak"
  // yang memang menerangkan baris yang tidak pernah ikut tersimpan.
  return NextResponse.json(
    {
      disimpan: disimpan.length,
      baru: jumlahBaru,
      perubahan: jumlahPerubahan,
      sama: ringkas.sama,
      ditolak: ringkas.ditolak,
      belumLengkap,
      berubahSejakPratinjau,
    },
    { status: 201 },
  );
}
