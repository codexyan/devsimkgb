import { NextRequest, NextResponse } from "next/server";
import { jalankanCadanganOtomatis } from "@/lib/pengamanData";

/**
 * Endpoint cron cadangan otomatis (ADR-084). Dipanggil handler `scheduled` di worker-entry.js pada kedua Cron
 * Trigger di wrangler.jsonc (00:00 dan 12:00 UTC = 08:00 dan 20:00 WITA) lewat service binding
 * WORKER_SELF_REFERENCE, dan dilindungi CRON_SECRET seperti /api/cron/notifikasi.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[cron/cadangan] CRON_SECRET belum diset; cadangan otomatis tidak dibuat.");
    return NextResponse.json({ error: "CRON_SECRET belum dikonfigurasi" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const hasil = await jalankanCadanganOtomatis();
    console.log(
      `[cron/cadangan] ${hasil.cadangan.kunci}: ${hasil.cadangan.total} baris, ${hasil.cadangan.ukuran} byte; ` +
        `dibuang ${hasil.cadanganDibuang ?? "-"} cadangan, ${hasil.berkasTerhapusDibuang ?? "-"} berkas terhapus, ` +
        `${hasil.jejakDibuang ?? "-"} jejak`,
    );
    return NextResponse.json({ success: true, ...hasil });
  } catch (err) {
    console.error("[cron/cadangan] gagal:", err);
    return NextResponse.json({ error: "Cadangan otomatis gagal" }, { status: 500 });
  }
}
