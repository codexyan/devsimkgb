import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { LAPORAN_HUKDIS_DIPEGANG_UPT } from "@/lib/laporanHukdis";
import { PESAN_BELUM_AKTIF, hapusSkHukdis, tabelBelumAda } from "@/lib/laporanHukdisServer";
import { TIPE_NOTIFIKASI } from "@/lib/generateNotifikasi";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import type { LaporanHukdisRow, PegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Laporan hukuman disiplin hanya dapat dibatalkan akun Admin UPT yang tertaut ke satker.";

/**
 * Batalkan laporan hukdis yang belum dicatat Kanwil, beserta pindaian SK-nya.
 *
 * Laporan yang salah tidak disunting di tempat melainkan dibatalkan atau dikirim ulang, sama dengan
 * laporan mutasi: antrian SDM Hukdis tidak boleh berisi dua versi laporan untuk pegawai yang sama.
 * Laporan yang sudah dicatat tidak dapat dihapus, sebab hukumannya sudah menempel pada riwayat pegawai.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;

  const { id } = await params;
  let laporan: LaporanHukdisRow | null;
  try {
    laporan = (await db.laporanHukdis.findUnique({ id })) as LaporanHukdisRow | null;
  } catch (e) {
    if (tabelBelumAda(e)) return NextResponse.json({ error: PESAN_BELUM_AKTIF }, { status: 503 });
    throw e;
  }
  // Laporan satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
  if (!laporan || laporan.satker !== akun.kode)
    return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
  if (!LAPORAN_HUKDIS_DIPEGANG_UPT.includes(laporan.status))
    return NextResponse.json({ error: "Laporan ini sudah dicatat Kanwil, jadi tidak dapat dibatalkan." }, { status: 409 });

  const pegawai = (await db.pegawai.findUnique({ id: laporan.pegawaiId })) as PegawaiRow | null;
  await db.laporanHukdis.delete({ id });
  await hapusSkHukdis(laporan.pathBerkas);
  await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.HUKDIS_UPT, referenceId: id });

  logAudit({
    userId: akun.pengguna.id,
    aksi: "batal_lapor_hukdis",
    detail: `Laporan hukuman disiplin ${pegawai?.nama ?? "-"} dibatalkan UPT sebelum dicatat`,
    targetNama: pegawai?.nama ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
