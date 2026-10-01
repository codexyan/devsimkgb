import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { TIPE_NOTIFIKASI, notifikasiUsulanUpt } from "@/lib/generateNotifikasi";
import { DIPEGANG_UPT, bandingkanUsulan, kekuranganUsulan, pernahKgb } from "@/lib/usulanPegawai";
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

  const idTerpilih = form.getAll("id").map((v) => String(v)).filter(Boolean);
  if (idTerpilih.length === 0) return NextResponse.json({ error: "Pilih dulu data pegawai yang akan diajukan" }, { status: 400 });

  // Yang boleh diajukan adalah yang masih dipegang UPT: draf baru maupun usulan yang dikembalikan
  // Kanwil untuk diperbaiki. Keduanya berangkat lewat jalur yang sama, dengan satu surat.
  const semua = (await db.usulanPegawai.findMany({
    where: { satker: kode, status: { in: DIPEGANG_UPT } },
  })) as UsulanPegawaiRow[];
  const perId = new Map(semua.map((u) => [u.id, u]));
  const draf = idTerpilih.map((id) => perId.get(id)).filter((u): u is UsulanPegawaiRow => !!u);
  if (draf.length !== idTerpilih.length)
    return NextResponse.json(
      { error: "Ada data yang sudah tidak dipegang UPT, mungkin sudah terkirim. Muat ulang halaman, lalu coba lagi." },
      { status: 409 },
    );

  // Kelengkapan diperiksa sebelum apa pun disimpan, agar satu draf yang kurang tidak membuat sebagian
  // terkirim dan sebagian tidak.
  const pegawaiPerId = new Map(
    ((await db.pegawai.findMany()) as PegawaiRow[]).map((p) => [p.id, p]),
  );
  // Berkas yang sudah disetujui untuk pegawainya ikut dihitung, lalu disalin saat dikirim (ADR-017).
  const disetujui = (await db.usulanPegawai.findMany({ where: { status: "disetujui" } })) as UsulanPegawaiRow[];
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

  const belumLengkap: { nama: string; kurang: string[] }[] = [];
  for (const u of draf) {
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

  // Satu salinan surat untuk seluruh pegawai pada pengajuan ini; jalurnya sama di tiap baris.
  const berkas = await simpanBerkasUsulan(form, kode);
  if ("galat" in berkas) return berkas.galat;

  const diajukanOleh = `${pengguna.nama} (${pengguna.nip})`;
  const sekarang = new Date();
  const terkirim: string[] = [];

  for (const u of draf) {
    const pegawai = u.pegawaiId ? pegawaiPerId.get(u.pegawaiId) : null;
    const nama = pegawai?.nama ?? u.nama ?? "-";
    const bawaan = bawaanPerUsulan.get(u.id);
    const salinan = bawaan
      ? await salinBerkasBawaan(
          berkasPerluDisalin(u, bawaan, pernahKgb(u.mkgTahun ?? pegawai?.mkgTahun, u.mkgBulan ?? pegawai?.mkgBulan)),
          kode,
        )
      : {};
    await db.usulanPegawai.update(
      { id: u.id },
      {
        ...salinan,
        status: "menunggu",
        nomorSurat,
        tanggalSurat,
        pathBerkas: berkas.jalur.pathBerkas ?? u.pathBerkas,
        diajukanOleh,
        diajukanAt: sekarang,
      },
    );
    terkirim.push(nama);

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

  logAudit({
    userId: pengguna.id,
    aksi: "usul_data_pegawai",
    detail:
      `Usulan ${terkirim.length} pegawai dari ${satker.nama} ` +
      `${nomorSurat ? `dengan surat ${nomorSurat}` : "sebagai laporan SK, tanpa surat usulan"}: ${terkirim.join(", ")}`,
    targetNama: satker.nama,
  });

  return NextResponse.json({ ok: true, jumlah: terkirim.length });
}
