import { NextRequest, NextResponse } from "next/server";
import { generateNotifikasi } from "@/lib/generateNotifikasi";
import { bersihkanHukdisKedaluwarsa } from "@/lib/hukdisKedaluwarsa";

/**
 * Endpoint cron harian. Dipanggil handler `scheduled` di worker-entry.js oleh Cloudflare Cron
 * Trigger (wrangler.jsonc "0 0 * * *", pukul 00:00 UTC = 08:00 WITA) lewat service binding
 * WORKER_SELF_REFERENCE.
 * Dilindungi secret CRON_SECRET (wrangler secret put CRON_SECRET) agar tidak dapat dipanggil pihak lain.
 * Urutan: penanda hukdis yang sudah lewat tanggal berakhir dinonaktifkan lebih dulu, lalu notifikasi
 * dibuat dari data yang sudah diselaraskan. Kegagalan penyelarasan hukdis tidak menghentikan notifikasi.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!process.env.CRON_SECRET) {
    console.error("[cron/notifikasi] CRON_SECRET belum diset; notifikasi harian tidak dibuat. Set dengan: wrangler secret put CRON_SECRET");
    return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let hukdis: { diperbarui: number } | { galat: string };
  try {
    hukdis = await bersihkanHukdisKedaluwarsa();
    console.log(`[cron/notifikasi] penanda hukdis kedaluwarsa diselaraskan: ${hukdis.diperbarui} pegawai`);
  } catch (err) {
    console.error("[cron/notifikasi] penyelarasan hukdis kedaluwarsa gagal:", err);
    hukdis = { galat: "Penyelarasan hukdis kedaluwarsa gagal" };
  }

  try {
    const result = await generateNotifikasi();
    console.log(`[cron/notifikasi] ${new Date().toISOString()}, ${result.created} notifikasi dibuat:`, result.details);
    return NextResponse.json({ success: true, ...result, hukdis });
  } catch (err) {
    console.error("[cron/notifikasi] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
