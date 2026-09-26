import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canAccessKeuangan } from "@/lib/auth";
import { hariIniWita } from "@/lib/waktu";
import { entriRekapKgb, kunciBulanTmt, rekapPerBulanTmt } from "@/lib/rekapKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { dipegangKeuanganKanwil } from "@/lib/aksesUpt";

export const runtime = "nodejs";

/*
 * GET, rekap per bulan TMT sebagai dasar input Sistem Gaji Web. Dihitung dari data KGB saat dibaca
 * (total, dikonfirmasi, menunggu keuangan, rapelan); tab RekonBulanan tidak dibaca atau ditulis.
 * Bulan TMT yang masa inputnya belum dibuka hanya disertakan bila sudah ada KGB yang sampai keuangan.
 */
export async function GET() {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccessKeuangan(session.user.role ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [semuaKgb, semuaPegawai] = await Promise.all([db.riwayatKGB.findMany(), db.pegawai.findMany()]);
  // Rekap Gaji Web Kanwil hanya memuat pegawai Kanwil; pegawai UPT direkam keuangan satkernya (ADR-009).
  const pegawaiList = semuaPegawai.filter((p) => dipegangKeuanganKanwil(p.unitKerja));
  const idKanwil = new Set(pegawaiList.map((p) => p.id));
  const allKgb = semuaKgb.filter((k) => idKanwil.has(k.pegawaiId));
  const hariIni = hariIniWita();
  const bulanTerbuka = kunciBulanTmt(new Date(hariIni.getFullYear(), hariIni.getMonth() + 2, 1)) ?? "";

  const rekap = rekapPerBulanTmt(entriRekapKgb(allKgb, pegawaiList), hariIni).filter(
    (r) => r.bulanTmt <= bulanTerbuka || r.dikonfirmasi + r.menungguKeuangan > 0,
  );

  return NextResponse.json(rekap);
}
