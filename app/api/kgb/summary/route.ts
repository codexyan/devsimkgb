import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { hariIniWita } from "@/lib/waktu";
import { entriRekapKgb, hitungRekapStatus } from "@/lib/rekapKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";

export const runtime = "nodejs";

// Hitungan chip status Data KGB, memakai definisi bersama lib/rekapKgb.ts: satu KGB per pegawai per
// TMT (dibatalkan lalu diinput ulang dihitung sekali), arsip tidak dihitung, dan entri virtual untuk
// pegawai aktif tanpa KGB aktif masuk Belum Diproses.
export async function GET() {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [allKgb, pegawaiList] = await Promise.all([
    db.riwayatKGB.findMany(),
    db.pegawai.findMany(),
  ]);
  const rekap = hitungRekapStatus(entriRekapKgb(allKgb, pegawaiList), hariIniWita());

  return NextResponse.json({
    total: rekap.total,
    belum_diproses: rekap.belumDiproses,
    sedang_diproses: rekap.sedangDiproses,
    menunggu_keuangan: rekap.menungguKeuangan,
    selesai: rekap.selesai,
    ditolak: rekap.ditolak,
    // Chip "Terlambat": belum diinput dan deadline SDM sudah lewat.
    rapelan: rekap.terlambat,
    berpotensi_rapelan: rekap.berpotensiRapelan,
  });
}
