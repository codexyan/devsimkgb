// Pemeriksaan Data di Pengaturan: daftar data pegawai yang tidak konsisten. Hanya membaca; perbaikan
// dilakukan manual lewat Data Pegawai atau Proses KGB. Hanya Super Admin.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isSuperAdmin } from "@/lib/auth";
import { periksaDataPegawai } from "@/lib/pemeriksaanData";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSuperAdmin(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const [pegawai, riwayatKgb] = await Promise.all([db.pegawai.findMany(), db.riwayatKGB.findMany()]);
    const hasil = periksaDataPegawai(pegawai, riwayatKgb);
    return NextResponse.json(
      { ...hasil, jumlahPegawai: pegawai.length, diperiksaPada: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[pemeriksaan-data] gagal membaca data:", err);
    return NextResponse.json({ error: "Data pegawai dan KGB gagal dibaca. Coba lagi." }, { status: 500 });
  }
}
