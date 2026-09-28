import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { ringkasanKirimanPegawai } from "@/lib/inventarisServer";

export const runtime = "nodejs";

/**
 * Kiriman formulir terbaru tiap NIP beserta status tindak lanjutnya, untuk penanda di daftar Data Pegawai
 * (ADR-023). Dimuat terpisah dari daftar pegawai supaya daftar itu tetap cepat.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({}, { status: 200 });
  return NextResponse.json(await ringkasanKirimanPegawai(), { headers: { "Cache-Control": "no-store" } });
}
