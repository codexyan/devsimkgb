import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { BERKAS_USULAN } from "@/lib/usulanPegawai";
import { TIPE_NOTIFIKASI } from "@/lib/generateNotifikasi";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Usulan hanya dapat dibatalkan akun Admin UPT yang tertaut ke satker.";

type BucketSk = { delete(keys: string | string[]): Promise<void> };

/**
 * Hapus berkas usulan di R2. Best effort: kegagalannya tidak membatalkan penghapusan barisnya, karena
 * yang penting bagi UPT adalah usulan salah itu hilang dari antrian tinjauan Kanwil.
 */
async function hapusBerkasUsulan(jalur: string[]): Promise<void> {
  if (jalur.length === 0) return;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as unknown as { SK_BUCKET?: BucketSk }).SK_BUCKET;
    if (bucket) await bucket.delete(jalur);
  } catch {
    // Berkas yatim di R2 tidak terlihat pengguna dan tidak menghalangi apa pun.
  }
}

/**
 * Batalkan usulan yang belum ditinjau Kanwil.
 *
 * Usulan yang salah isi tidak bisa diperbaiki di tempat: barisnya dihapus seluruhnya, lalu UPT
 * mengirim ulang. Itu disengaja, supaya antrian tinjauan Kanwil tidak pernah berisi dua versi usulan
 * untuk pegawai yang sama. Usulan yang sudah ditinjau tidak dapat dibatalkan, karena hasilnya sudah
 * menjadi riwayat dan, bila disetujui, sudah menempel pada data pegawai.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;

  const { id } = await params;
  const usulan = (await db.usulanPegawai.findUnique({ id })) as UsulanPegawaiRow | null;
  // Usulan satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
  if (!usulan || usulan.satker !== akun.kode)
    return NextResponse.json({ error: "Usulan tidak ditemukan" }, { status: 404 });
  if (usulan.status !== "menunggu")
    return NextResponse.json(
      { error: "Usulan ini sudah ditinjau Kanwil, jadi tidak dapat dibatalkan. Kirim usulan perbaikan baru bila datanya keliru." },
      { status: 409 },
    );

  // Pada usulan perubahan, nama hanya terisi bila namanya sendiri yang diusulkan berubah.
  const pegawai = usulan.pegawaiId ? await db.pegawai.findUnique({ id: usulan.pegawaiId }) : null;
  const nama = pegawai?.nama ?? usulan.nama ?? "-";
  await hapusBerkasUsulan(BERKAS_USULAN.map((b) => usulan[b.kunci]).filter((j): j is string => !!j));
  await db.usulanPegawai.delete({ id });
  // Notifikasi "usulan menunggu tinjauan" ikut hilang, supaya Kanwil tidak membuka usulan yang sudah tiada.
  await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.USULAN_UPT, referenceId: id });

  logAudit({
    userId: akun.pengguna.id,
    aksi: "batal_usulan",
    detail: `Usulan ${usulan.jenis === "baru" ? "pegawai baru " : "data "}${nama} dibatalkan UPT sebelum ditinjau, surat ${usulan.nomorSurat}`,
    targetNama: nama,
  });

  return NextResponse.json({ ok: true });
}
