// Tes koneksi Google Sheets: verifikasi kredensial + tab yang dibutuhkan ada.
// Buka /api/sheets/health setelah mengisi env GOOGLE_* untuk memastikan
// lapisan Sheets tersambung sebelum memindah rute-rute dari Prisma.

import { NextResponse } from "next/server";
import { listSheetTitles } from "@/lib/sheets/client";
import { REQUIRED_TABS } from "@/lib/sheets/tables";

export const runtime = "nodejs";

export async function GET() {
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
