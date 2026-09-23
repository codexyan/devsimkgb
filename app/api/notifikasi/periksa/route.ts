import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { generateNotifikasi } from "@/lib/generateNotifikasi";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { ROLES } from "@/lib/auth/roles";

export const runtime = "nodejs";

/**
 * Pemeriksaan notifikasi atas permintaan pengguna, tanpa menunggu jeda 15 menit di GET /api/notifikasi
 * maupun cron harian. Dipakai tombol "Periksa sekarang" agar pengguna dapat memastikan modul berjalan
 * dan langsung melihat pengingat yang baru jatuh tempo. Peran lihat-saja tidak boleh memicu penulisan.
 */
const PERAN_BOLEH_PERIKSA: readonly string[] = [ROLES.SUPER_ADMIN, ROLES.SDM_KGB, ROLES.SDM_HUKDIS, ROLES.KEUANGAN];

export async function POST() {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!PERAN_BOLEH_PERIKSA.includes(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  if (!(await penggunaLogin(session)))
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  try {
    const hasil = await generateNotifikasi();
    return NextResponse.json({ ...hasil, diperiksaPada: new Date().toISOString() });
  } catch (err) {
    console.error("[notifikasi/periksa] gagal:", err);
    return NextResponse.json({ error: "Pemeriksaan notifikasi gagal" }, { status: 500 });
  }
}
