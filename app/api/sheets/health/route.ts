// Tes koneksi Google Sheets: verifikasi kredensial + tab yang dibutuhkan ada.
// Buka /api/sheets/health setelah mengisi env GOOGLE_* untuk memastikan
// lapisan Sheets tersambung sebelum memindah rute-rute dari Prisma.
// Hanya Super Admin, karena respons memuat struktur penyimpanan.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSuperAdmin } from "@/lib/auth";
import { listSheetTitles } from "@/lib/sheets/client";
import { REQUIRED_TABS } from "@/lib/sheets/tables";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isSuperAdmin(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const tabs = await listSheetTitles();
    const missing = REQUIRED_TABS.filter((t) => !tabs.includes(t));
    return NextResponse.json({
      ok: missing.length === 0,
      connected: true,
      tabsDitemukan: tabs,
      tabWajib: REQUIRED_TABS,
      tabKurang: missing,
      pesan:
        missing.length === 0
          ? "Terhubung. Semua tab yang dibutuhkan tersedia."
          : `Terhubung, tapi tab berikut belum ada: ${missing.join(", ")}. Buat tab tsb dengan baris header sesuai TAB_HEADERS.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
