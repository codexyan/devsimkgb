import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { hariIniWita } from "@/lib/waktu";
import { penandaHukdisBerlaku } from "@/lib/hukdisKedaluwarsa";
import { rekapPerSatker } from "@/lib/rekapSatker";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { muatKppnSatker } from "@/lib/muatKppnSatker";

export const runtime = "nodejs";

// Ringkasan KGB per satker (Kanwil dan UPT) untuk modul Satker & UPT: Super Admin dan SDM KGB.
export async function GET() {
  await muatBatasInputSdm();
  await muatKppnSatker();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? ""))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const hariIni = hariIniWita();
  const [pegawai, kgb] = await Promise.all([db.pegawai.findMany(), db.riwayatKGB.findMany()]);
  const hasil = rekapPerSatker({
    pegawai: pegawai.map((p) => penandaHukdisBerlaku(p, hariIni)),
    kgb,
    hariIni,
  });
  return NextResponse.json(hasil);
}
