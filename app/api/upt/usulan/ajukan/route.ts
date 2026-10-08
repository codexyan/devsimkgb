import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { TIPE_NOTIFIKASI, notifikasiUsulanUpt } from "@/lib/generateNotifikasi";
import { BELUM_SELESAI, DIPEGANG_UPT, bandingkanUsulan, kekuranganUsulan, pernahKgbUsulan } from "@/lib/usulanPegawai";
import { jadikanPerbaikan, kolomJadiPerbaikan, nipBaruTercatat, pesanSatkerLainUpt } from "@/lib/usulanBaruTercatat";
import { cariDalam } from "@/lib/dataSatker";
import { laporanSkDasar } from "@/lib/dasarBaruUsulan";
import { bawaanPegawai, berkasPerluDisalin, denganBerkasBawaan, type BawaanUsulan } from "@/lib/bawaanUsulan";
import { BATAS_BERKAS_BYTE, PESAN_TERLALU_BESAR, salinBerkasBawaan, simpanBerkasUsulan } from "@/lib/berkasUsulan";
import { bacaTanggalInput } from "@/lib/prosesKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { SATKER } from "@/lib/satker";
import type { PegawaiRow, UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Usulan hanya dapat diajukan akun Admin UPT yang tertaut ke satker.";

/**
 * Ajukan beberapa draf sekaligus dengan satu surat usulan.
 *
 * Satu surat usulan UPT lazimnya memuat beberapa pegawai; surat Rutan Rantau 8 September 2026,
 * misalnya, memuat lima. Karena itu nomor surat, tanggalnya, dan salinan suratnya diisi sekali di sini
 * lalu disalin ke setiap baris, bukan diketik ulang per pegawai. Kelengkapan tiap draf diperiksa lebih
 * dulu dan yang kurang disebutkan satu per satu, supaya operator tahu persis apa yang harus dilengkapi.
 *
 * Puluhan pegawai dalam satu permintaan melampaui batas CPU Worker dan terputus di tengah, sebagian terkirim dan
 * sebagian tidak (ADR-079). Karena itu peramban memeriksa seluruh daftar lebih dulu (`periksaSaja`), lalu mengirimnya
 * beberapa pegawai per permintaan: salinan surat diunggah pada kiriman pertama dan kiriman berikutnya memakai
 * jalurnya (`pathBerkas`). Kiriman yang diulang aman: usulan yang sudah menunggu dengan surat yang sama dihitung
 * terkirim, bukan ditolak.
 */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;
  const { pengguna, kode } = akun;
  const satker = SATKER.find((s) => s.kode === kode)!;

  const panjangIsi = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjangIsi) && panjangIsi > BATAS_BERKAS_BYTE + 64 * 1024)
    return NextResponse.json({ error: PESAN_TERLALU_BESAR }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data pengajuan tidak valid" }, { status: 400 });
  }
  const teks = (kunci: string) => (form.get(kunci) as string | null)?.trim() || "";

  // Suratnya diperiksa belakangan, sesudah ketahuan apa isi yang diajukan: laporan SK kenaikan pangkat
  // atau PMK berangkat tanpa surat usulan Srikandi (ADR-046).
  const nomorSurat = teks("nomorSurat") || null;
  const tanggalSurat = teks("tanggalSurat") ? bacaTanggalInput(teks("tanggalSurat")) : null;
  if (teks("tanggalSurat") && !tanggalSurat)
    return NextResponse.json({ error: "Tanggal surat usulan tidak valid" }, { status: 400 });

  const idTerpilih = [...new Set(form.getAll("id").map((v) => String(v)).filter(Boolean))];
  if (idTerpilih.length === 0) return NextResponse.json({ error: "Pilih dulu data pegawai yang akan diajukan" }, { status: 400 });
  const periksaSaja = teks("periksaSaja") === "1";

  // Salinan surat yang sudah diunggah pada kiriman pertama pengajuan yang sama (ADR-079). Hanya jalur surat usulan
  // satker ini yang diterima.
  const pathBerkasLama = teks("pathBerkas") || null;
  if (pathBerkasLama && (!pathBerkasLama.startsWith(`usulan/${kode}_berkas_`) || pathBerkasLama.includes("..")))
    return NextResponse.json({ error: "Salinan surat usulan tidak dikenali. Unggah ulang suratnya." }, { status: 400 });

  // Yang boleh diajukan adalah yang masih dipegang UPT: draf baru maupun usulan yang dikembalikan
  // Kanwil untuk diperbaiki. Keduanya berangkat lewat jalur yang sama, dengan satu surat.
  const semua = (await db.usulanPegawai.findMany({
    where: { satker: kode, id: { in: idTerpilih } },
  })) as UsulanPegawaiRow[];
  const perId = new Map(semua.map((u) => [u.id, u]));
  const drafDipilih = idTerpilih
    .map((id) => perId.get(id))
    .filter((u): u is UsulanPegawaiRow => !!u && DIPEGANG_UPT.includes(u.status));

  // NIP draf pegawai baru diperiksa ulang: pegawainya bisa tercatat sesudah draf dibuat. Yang tercatat di satker ini
  // diajukan sebagai perbaikan data pegawai itu; yang tercatat di satker lain ditolak (ADR-091).
  const tercatatPerNip = new Map(
    (
      await cariDalam(
        (where) => db.pegawai.findMany({ where }) as Promise<PegawaiRow[]>,
        "nip",
        drafDipilih.filter((u) => u.jenis === "baru").map((u) => u.nip),
      )
    ).map((p) => [p.nip, p]),
  );
  const nipTertolak: { id: string; nama: string; kurang: string[] }[] = [];
  const jadiPerbaikan = new Map<string, PegawaiRow>();
  const draf = drafDipilih.map((u) => {
    const pegawai = u.nip ? tercatatPerNip.get(u.nip) : undefined;
    const keadaan = nipBaruTercatat(u, pegawai);
    if (!keadaan || !pegawai) return u;
    if (keadaan === "satker_lain") {
      nipTertolak.push({ id: u.id, nama: u.nama ?? u.nip ?? "-", kurang: [pesanSatkerLainUpt(u.nip ?? "")] });
      return u;
    }
    jadiPerbaikan.set(u.id, pegawai);
    return jadikanPerbaikan(u, pegawai);
  });
  // Satu pegawai hanya boleh punya satu usulan yang belum selesai, sama dengan usulan perbaikan yang dibuat dari kartunya.
  if (jadiPerbaikan.size > 0) {
    const berjalan = (await cariDalam(
      (where) => db.usulanPegawai.findMany({ where }) as Promise<UsulanPegawaiRow[]>,
      "pegawaiId",
      [...jadiPerbaikan.values()].map((p) => p.id),
      { status: { in: [...BELUM_SELESAI] } },
    )) as UsulanPegawaiRow[];
    for (const [id, pegawai] of jadiPerbaikan) {
      const lain = berjalan.find((b) => b.pegawaiId === pegawai.id && b.id !== id);
      if (lain)
        nipTertolak.push({
          id,
          nama: pegawai.nama,
          kurang: [
            `NIP sudah tercatat dan pegawai ini sudah punya usulan perbaikan yang ${
              lain.status === "menunggu" ? "menunggu tinjauan Kanwil" : "belum diajukan"
            }. Hapus draf pegawai baru ini`,
          ],
        });
    }
  }
  // Kiriman yang diulang sesudah terputus: yang sudah berangkat dengan surat ini tidak dikirim lagi.
  const sudahTerkirim = idTerpilih.filter((id) => {
    const u = perId.get(id);
    return !!u && u.status === "menunggu" && (u.nomorSurat ?? null) === nomorSurat;
  });
  if (draf.length + sudahTerkirim.length !== idTerpilih.length)
    return NextResponse.json(
      { error: "Ada data yang sudah tidak dipegang UPT, mungkin sudah terkirim. Muat ulang halaman, lalu coba lagi." },
      { status: 409 },
    );
  if (draf.length === 0 && !periksaSaja)
    return NextResponse.json({ ok: true, jumlah: 0, sudah: sudahTerkirim.length, pathBerkas: pathBerkasLama });

  // Kelengkapan diperiksa sebelum apa pun disimpan, agar satu draf yang kurang tidak membuat sebagian
  // terkirim dan sebagian tidak. Hanya pegawai yang diajukan yang dibaca.
  const idPegawai = [...new Set(draf.map((u) => u.pegawaiId).filter((id): id is string => !!id))];
  const pegawaiPerId = new Map(
    (idPegawai.length > 0 ? ((await db.pegawai.findMany({ where: { id: { in: idPegawai } } })) as PegawaiRow[]) : []).map(
      (p) => [p.id, p],
    ),
  );
  // Berkas yang sudah disetujui untuk pegawainya ikut dihitung, lalu disalin saat dikirim (ADR-017).
  const disetujui =
    idPegawai.length > 0
      ? ((await db.usulanPegawai.findMany({ where: { status: "disetujui", pegawaiId: { in: idPegawai } } })) as UsulanPegawaiRow[])
      : [];
  const bawaanPerUsulan = new Map<string, BawaanUsulan>();
  for (const u of draf) {
    const pegawai = u.pegawaiId ? pegawaiPerId.get(u.pegawaiId) : null;
    if (pegawai && u.jenis === "perubahan") bawaanPerUsulan.set(u.id, bawaanPegawai(pegawai, disetujui));
  }
  // Satu pengajuan hanya membawa satu surat untuk seluruh barisnya, jadi suratnya baru boleh ditiadakan
  // bila tidak ada satu pun baris yang meminta sesuatu di luar SK yang dilaporkan.
  const semuaLaporanSk = draf.every((u) => {
    const pegawai = u.pegawaiId ? pegawaiPerId.get(u.pegawaiId) : null;
    return u.jenis === "perubahan" && !!pegawai && laporanSkDasar(u, bandingkanUsulan(pegawai, u));
  });
  if (!semuaLaporanSk) {
    if (!nomorSurat)
      return NextResponse.json(
        {
          error:
            "Nomor surat usulan wajib diisi, kecuali seluruh yang diajukan hanya melaporkan SK kenaikan pangkat atau SK PMK.",
        },
        { status: 400 },
      );
    if (!tanggalSurat)
      return NextResponse.json({ error: "Tanggal surat usulan wajib diisi dan harus valid" }, { status: 400 });
  }

  const belumLengkap: { nama: string; kurang: string[] }[] = nipTertolak.map(({ nama, kurang }) => ({ nama, kurang }));
  // Draf yang tertolak karena NIP-nya harus dihapus, jadi kekurangan lainnya tidak disebut lagi.
  const idTertolak = new Set(nipTertolak.map((t) => t.id));
  for (const u of draf) {
    if (idTertolak.has(u.id)) continue;
    const pegawai = u.pegawaiId ? pegawaiPerId.get(u.pegawaiId) : null;
    const bawaan = bawaanPerUsulan.get(u.id);
    const kurang = kekuranganUsulan(bawaan ? denganBerkasBawaan(u, bawaan) : u, u.jenis, pegawai);
    if (kurang.length > 0) belumLengkap.push({ nama: pegawai?.nama ?? u.nama ?? u.nip ?? "-", kurang });
  }
  if (belumLengkap.length > 0)
    return NextResponse.json(
      {
        error: `Belum dapat diajukan: ${belumLengkap.map((b) => `${b.nama} (${b.kurang.join(", ")})`).join("; ")}.`,
        belumLengkap,
      },
      { status: 400 },
    );
  if (periksaSaja) return NextResponse.json({ ok: true, jumlah: draf.length, sudah: sudahTerkirim.length });

  // Satu salinan surat untuk seluruh pegawai pada pengajuan ini; jalurnya sama di tiap baris.
  const berkas = await simpanBerkasUsulan(form, kode);
  if ("galat" in berkas) return berkas.galat;
  const pathBerkas = berkas.jalur.pathBerkas ?? pathBerkasLama;

  const diajukanOleh = `${pengguna.nama} (${pengguna.nip})`;
  const sekarang = new Date();
  const terkirim: string[] = [];

  for (const u of draf) {
    const pegawai = u.pegawaiId ? pegawaiPerId.get(u.pegawaiId) : null;
    const nama = pegawai?.nama ?? u.nama ?? "-";
    const bawaan = bawaanPerUsulan.get(u.id);
    const salinan = bawaan
      ? await salinBerkasBawaan(
          // Pernah KGB atau belum menurut keadaan pada SK KGB terakhir, bukan masa kerja menurut SK sesudahnya (ADR-078).
          berkasPerluDisalin(
            u,
            bawaan,
            pernahKgbUsulan(u, pegawai),
          ),
          kode,
        )
      : {};
    const tercatat = jadiPerbaikan.get(u.id);
    await db.usulanPegawai.update(
      { id: u.id },
      {
        ...(tercatat ? kolomJadiPerbaikan(tercatat) : {}),
        ...salinan,
        status: "menunggu",
        nomorSurat,
        tanggalSurat,
        pathBerkas: pathBerkas ?? u.pathBerkas,
        diajukanOleh,
        diajukanAt: sekarang,
      },
    );
    terkirim.push(tercatat ? `${nama} (NIP sudah tercatat, diajukan sebagai perbaikan data)` : nama);

    // Usulan yang dikembalikan sudah diperbaiki dan berangkat lagi; tagihan perbaikannya ditutup.
    if (u.status === "revisi")
      await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.USULAN_REVISI, referenceId: u.id });

    try {
      await db.notifikasi.create({
        ...notifikasiUsulanUpt({ ...u, nomorSurat }, { nama, nip: pegawai?.nip ?? u.nip ?? null }),
        id: newId(),
        dibaca: false,
        createdAt: new Date(),
      });
    } catch {
      // Usulannya sudah berstatus menunggu; notifikasinya menyusul lewat pemeriksaan berkala.
    }
  }

  if (terkirim.length > 0)
    logAudit({
      userId: pengguna.id,
      aksi: "usul_data_pegawai",
      detail:
        `Usulan ${terkirim.length} pegawai dari ${satker.nama} ` +
        `${nomorSurat ? `dengan surat ${nomorSurat}` : "sebagai laporan SK, tanpa surat usulan"}: ${terkirim.join(", ")}`,
      targetNama: satker.nama,
    });

  return NextResponse.json({
    ok: true,
    jumlah: terkirim.length,
    sudah: sudahTerkirim.length,
    pathBerkas: pathBerkas ?? null,
    // Draf pegawai baru yang diajukan sebagai perbaikan data karena NIP-nya sudah tercatat (ADR-091).
    jadiPerbaikan: [...jadiPerbaikan.values()].map((p) => p.nama),
  });
}
