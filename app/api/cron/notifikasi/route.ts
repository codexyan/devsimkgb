import { NextRequest, NextResponse } from "next/server";
import { generateNotifikasi } from "@/lib/generateNotifikasi";

/**
 * Cron endpoint, dipanggil Vercel Cron setiap hari pukul 07:00 WIB (00:00 UTC).
 * Dilindungi CRON_SECRET agar tidak bisa dipanggil sembarangan.
 *
 * Setup di Vercel Dashboard → Settings → Cron Jobs, atau via vercel.json.
 * Set environment variable: CRON_SECRET=<random-string-panjang>
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await generateNotifikasi();
    console.log(`[cron/notifikasi] ${new Date().toISOString()}, ${result.created} notifikasi dibuat:`, result.details);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[cron/notifikasi] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
