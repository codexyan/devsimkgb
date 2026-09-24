import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { BELUM_SELESAI, BERKAS_USULAN, DIPEGANG_UPT } from "@/lib/usulanPegawai";
import { bacaIsianUsulan, isiHitungan } from "@/lib/usulanFormulir";
import { BATAS_BERKAS_BYTE, PESAN_TERLALU_BESAR, hapusBerkasUsulan, simpanBerkasUsulan } from "@/lib/berkasUsulan";
import { bacaTanggalInput } from "@/lib/prosesKgb";
import { TIPE_NOTIFIKASI } from "@/lib/generateNotifikasi";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import type { PegawaiRow, UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Usulan hanya dapat diubah akun Admin UPT yang tertaut ke satker.";

/** Baris usulan milik satker akun; hasilnya `galat` bila tidak ada atau bukan miliknya. */
async function usulanSatker(id: string, kode: string) {
  const usulan = (await db.usulanPegawai.findUnique({ id })) as UsulanPegawaiRow | null;
  // Usulan satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
  if (!usulan || usulan.satker !== kode)
    return { galat: NextResponse.json({ error: "Usulan tidak ditemukan" }, { status: 404 }) };
  return { usulan };
}

/** Nama pegawai untuk catatan audit; pada usulan perubahan namanya ada di data induk. */
async function namaUsulan(usulan: UsulanPegawaiRow): Promise<{ nama: string; pegawai: PegawaiRow | null }> {
  const pegawai = usulan.pegawaiId ? ((await db.pegawai.findUnique({ id: usulan.pegawaiId })) as PegawaiRow | null) : null;
  return { nama: pegawai?.nama ?? usulan.nama ?? "-", pegawai };
}

/**
 * Sunting usulan yang sedang dipegang UPT: draf yang belum diajukan, atau usulan yang dikembalikan
 * Kanwil untuk diperbaiki.
 *
 * Usulan yang sedang menunggu tinjauan tidak boleh disunting, karena peninjau di Kanwil harus melihat
 * persis apa yang dikirim UPT; yang telanjur salah dibatalkan lalu dikirim ulang, atau dikembalikan
 * peninjaunya. Berkas yang tidak disertakan pada permintaan ini dibiarkan apa adanya, sehingga
 * menyunting satu isian tidak menuntut mengunggah ulang seluruh PDF-nya.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;

  const panjangIsi = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjangIsi) && panjangIsi > BERKAS_USULAN.length * BATAS_BERKAS_BYTE + 64 * 1024)
    return NextResponse.json({ error: PESAN_TERLALU_BESAR }, { status: 413 });

  const { id } = await params;
  const ditemukan = await usulanSatker(id, akun.kode);
  if ("galat" in ditemukan) return ditemukan.galat;
  const { usulan } = ditemukan;
  if (!DIPEGANG_UPT.includes(usulan.status))
    return NextResponse.json(
      { error: "Usulan ini sudah dikirim ke Kanwil, jadi tidak dapat disunting. Batalkan dulu bila datanya keliru." },
      { status: 409 },
    );

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data usulan tidak valid" }, { status: 400 });
  }
  const teks = (kunci: string) => (form.get(kunci) as string | null)?.trim() || "";

  const dibaca = bacaIsianUsulan(form);
  if ("galat" in dibaca) return NextResponse.json({ error: dibaca.galat }, { status: 400 });

  const { nama, pegawai } = await namaUsulan(usulan);
  const isian = isiHitungan(dibaca.isian, pegawai);

  const tanggalSurat = teks("tanggalSurat") ? bacaTanggalInput(teks("tanggalSurat")) : null;
  if (teks("tanggalSurat") && !tanggalSurat)
    return NextResponse.json({ error: "Tanggal surat tidak valid" }, { status: 400 });
  const tanggalSkTerakhir = teks("tanggalSkTerakhir") ? bacaTanggalInput(teks("tanggalSkTerakhir")) : null;
  if (teks("tanggalSkTerakhir") && !tanggalSkTerakhir)
    return NextResponse.json({ error: "Tanggal SK terakhir tidak valid" }, { status: 400 });
  const hukdisTmtMulai = teks("hukdisTmtMulai") ? bacaTanggalInput(teks("hukdisTmtMulai")) : null;
  if (teks("hukdisTmtMulai") && !hukdisTmtMulai)
    return NextResponse.json({ error: "TMT mulai hukuman disiplin tidak valid" }, { status: 400 });
  const hukdisTmtBerakhir = teks("hukdisTmtBerakhir") ? bacaTanggalInput(teks("hukdisTmtBerakhir")) : null;
  if (teks("hukdisTmtBerakhir") && !hukdisTmtBerakhir)
    return NextResponse.json({ error: "TMT berakhir hukuman disiplin tidak valid" }, { status: 400 });

  const berkas = await simpanBerkasUsulan(form, akun.kode);
  if ("galat" in berkas) return berkas.galat;

  // Berkas lama yang digantikan dibuang, supaya R2 tidak menumpuk unggahan yang tidak lagi dirujuk.
  const digantikan = BERKAS_USULAN.map((b) => (berkas.jalur[b.kunci] ? usulan[b.kunci] : null)).filter(
    (jalur): jalur is string => !!jalur,
  );
  await hapusBerkasUsulan(digantikan);

  const perubahan: Partial<UsulanPegawaiRow> = {
    ...isian,
    nomorSkTerakhir: teks("nomorSkTerakhir") || null,
    tanggalSkTerakhir,
    hukdisAda: teks("hukdisAda") === "true",
    hukdisJenis: teks("hukdisJenis") || null,
    hukdisNomorSk: teks("hukdisNomorSk") || null,
    hukdisTmtMulai,
    hukdisTmtBerakhir,
    hukdisKeterangan: teks("hukdisKeterangan") || null,
    catatanUpt: teks("catatanUpt") || null,
    diajukanOleh: `${akun.pengguna.nama} (${akun.pengguna.nip})`,
    diajukanAt: new Date(),
  };
  for (const b of BERKAS_USULAN) {
    if (berkas.jalur[b.kunci]) perubahan[b.kunci] = berkas.jalur[b.kunci] ?? null;
  }
  // Surat hanya disentuh bila formulirnya memang mengirimkannya. Formulir data pegawai tidak memuat
  // isian surat, dan usulan yang dikembalikan Kanwil harus tetap membawa nomor surat aslinya.
  if (form.has("nomorSurat")) perubahan.nomorSurat = teks("nomorSurat") || null;
  if (form.has("tanggalSurat")) perubahan.tanggalSurat = tanggalSurat;

  await db.usulanPegawai.update({ id }, perubahan);

  logAudit({
    userId: akun.pengguna.id,
    aksi: usulan.status === "revisi" ? "perbaiki_usulan_pegawai" : "simpan_draf_pegawai",
    detail: usulan.status === "revisi"
      ? `Usulan ${isian.nama ?? nama} yang dikembalikan Kanwil diperbaiki, belum dikirim ulang`
      : `Draf data ${isian.nama ?? nama} diperbarui sebelum diajukan`,
    targetNama: String(isian.nama ?? nama),
  });

  return NextResponse.json({ ok: true });
}

/**
 * Hapus draf, atau batalkan usulan yang belum ditinjau Kanwil.
 *
 * Usulan yang salah isi tidak diperbaiki di tempat: barisnya dihapus seluruhnya, lalu UPT mengirim
 * ulang. Itu disengaja, supaya antrian tinjauan Kanwil tidak pernah berisi dua versi usulan untuk
 * pegawai yang sama. Usulan yang sudah ditinjau tidak dapat dihapus, karena hasilnya sudah menjadi
 * riwayat dan, bila disetujui, sudah menempel pada data pegawai.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;

  const { id } = await params;
  const ditemukan = await usulanSatker(id, akun.kode);
  if ("galat" in ditemukan) return ditemukan.galat;
  const { usulan } = ditemukan;
  if (!BELUM_SELESAI.includes(usulan.status))
    return NextResponse.json(
      { error: "Usulan ini sudah ditinjau Kanwil, jadi tidak dapat dibatalkan. Kirim usulan perbaikan baru bila datanya keliru." },
      { status: 409 },
    );

  const { nama } = await namaUsulan(usulan);
  await hapusBerkasUsulan(BERKAS_USULAN.map((b) => usulan[b.kunci]).filter((jalur): jalur is string => !!jalur));
  await db.usulanPegawai.delete({ id });
  // Notifikasi yang menunjuk usulan ini ikut hilang, supaya Kanwil tidak membuka usulan yang sudah
  // tiada dan UPT tidak ditagih memperbaiki yang sudah dihapusnya sendiri.
  await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.USULAN_UPT, referenceId: id });
  await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.USULAN_REVISI, referenceId: id });

  const aksiHapus =
    usulan.status === "draf" ? "hapus_draf_pegawai" : usulan.status === "revisi" ? "hapus_usulan_dikembalikan" : "batal_usulan";
  logAudit({
    userId: akun.pengguna.id,
    aksi: aksiHapus,
    detail:
      usulan.status === "draf"
        ? `Draf data ${nama} dihapus sebelum diajukan`
        : usulan.status === "revisi"
          ? `Usulan ${usulan.jenis === "baru" ? "pegawai baru " : "data "}${nama} yang dikembalikan Kanwil dihapus UPT, surat ${usulan.nomorSurat ?? "-"}`
          : `Usulan ${usulan.jenis === "baru" ? "pegawai baru " : "data "}${nama} dibatalkan UPT sebelum ditinjau, surat ${usulan.nomorSurat ?? "-"}`,
    targetNama: nama,
  });

  return NextResponse.json({ ok: true });
}
