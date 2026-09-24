import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { BELUM_SELESAI } from "@/lib/usulanPegawai";
import { isiHitungan } from "@/lib/usulanFormulir";
import { BATAS_BARIS_IMPOR, periksaImporUpt, ringkasImpor } from "@/lib/imporUsulanUpt";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
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
 * `periksaSaja` menjalankan pemeriksaan yang sama tanpa menyimpan apa pun, sehingga operator melihat
 * lebih dulu baris mana yang bermasalah. Aturannya satu, di sini, bukan disalin ke peramban.
 */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;
  const { pengguna, kode } = akun;
  const satker = SATKER.find((s) => s.kode === kode)!;

  const body = (await req.json().catch(() => ({}))) as { baris?: unknown; periksaSaja?: unknown };
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
  const hasil = periksaImporUpt(baris, {
    // NIP diperiksa terhadap seluruh satker, bukan satker ini saja: satu pegawai hanya boleh ada satu
    // kali di data induk, dan usulan kembar dari dua satker justru yang paling sulit diurai belakangan.
    nipPegawai: new Set(semuaPegawai.map((p) => p.nip)),
    nipUsulan: new Set(berjalan.map((u) => u.nip).filter((nip): nip is string => !!nip)),
  });
  const ringkas = ringkasImpor(hasil);
  const galat = hasil.filter((h) => h.galat).map((h) => `Baris ${h.baris} (NIP ${h.nip || "-"}): ${h.galat}`);

  if (body.periksaSaja === true)
    return NextResponse.json({ ...ringkas, galat, periksaSaja: true });

  const sekarang = new Date();
  const diajukanOleh = `${pengguna.nama} (${pengguna.nip})`;
  const rows: UsulanPegawaiRow[] = hasil
    .filter((h) => !h.galat && h.isian)
    .map((h) => ({
      id: newId(),
      pegawaiId: null,
      satker: kode,
      status: "draf",
      jenis: "baru",
      nip: h.nip,
      unitKerja: satker.nama,
      nomorSurat: null,
      tanggalSurat: null,
      pathBerkas: null,
      pathSkTerakhir: null,
      pathSyaratCpns: null,
      pathSkPangkat: null,
      nama: null, tempatLahir: null, tanggalLahir: null, jenisKelamin: null,
      pendidikanTerakhir: null, jabatan: null, pangkat: null, golonganRuang: null,
      eselon: null, jenisJabatan: null, tmtGolongan: null,
      mkgTahun: null, mkgBulan: null, gajiPokok: null,
      tmtKgbTerakhir: null, tmtKgbBerikutnya: null,
      nomorSkTerakhir: null,
      tanggalSkTerakhir: null,
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
      ...isiHitungan(h.isian!, null),
    }));

  if (rows.length > 0) await db.usulanPegawai.createMany(rows);

  logAudit({
    userId: pengguna.id,
    aksi: "impor_draf_pegawai",
    detail:
      `Unggah massal ${satker.nama}: ${rows.length} data pegawai disiapkan dari ${baris.length} baris berkas` +
      (galat.length > 0 ? `, ${galat.length} baris ditolak` : "") +
      (ringkas.belumLengkap > 0 ? `, ${ringkas.belumLengkap} belum lengkap` : ""),
    targetNama: satker.nama,
  });

  return NextResponse.json({ ...ringkas, galat }, { status: 201 });
}
