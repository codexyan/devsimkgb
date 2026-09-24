import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { LAPORAN_DIPEGANG_UPT } from "@/lib/laporanMutasi";
import { LABEL_JENIS_MUTASI, type JenisMutasi } from "@/lib/mutasiPegawai";
import { TIPE_NOTIFIKASI } from "@/lib/generateNotifikasi";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import type { LaporanMutasiRow, PegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Laporan mutasi hanya dapat dibatalkan akun Admin UPT yang tertaut ke satker.";

/**
 * Batalkan laporan yang belum ditetapkan Kanwil.
 *
 * Laporan yang salah tidak disunting di tempat melainkan dihapus lalu dikirim ulang, sama dengan usulan
 * data: antrian tinjauan Kanwil tidak boleh berisi dua versi laporan untuk pegawai yang sama. Laporan
 * yang sudah diterima tidak dapat dihapus, sebab mutasinya sudah menempel pada data pegawai; yang
 * keliru di situ dibetulkan Kanwil lewat pencatatan baru.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;

  const { id } = await params;
  const laporan = (await db.laporanMutasi.findUnique({ id })) as LaporanMutasiRow | null;
  // Laporan satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
  if (!laporan || laporan.satker !== akun.kode)
    return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
  if (!LAPORAN_DIPEGANG_UPT.includes(laporan.status))
    return NextResponse.json(
      { error: "Laporan ini sudah ditetapkan Kanwil, jadi tidak dapat dibatalkan." },
      { status: 409 },
    );

  const pegawai = (await db.pegawai.findUnique({ id: laporan.pegawaiId })) as PegawaiRow | null;
  await db.laporanMutasi.delete({ id });
  await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.MUTASI_UPT, referenceId: id });

  logAudit({
    userId: akun.pengguna.id,
    aksi: "batal_lapor_mutasi",
    detail: `Laporan ${LABEL_JENIS_MUTASI[laporan.jenis as JenisMutasi] ?? laporan.jenis} ${pegawai?.nama ?? "-"} dibatalkan UPT sebelum ditetapkan`,
    targetNama: pegawai?.nama ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
