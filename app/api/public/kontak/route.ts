import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Endpoint PUBLIK (tanpa auth): hanya nomor WA admin untuk tombol "Lupa Password".
export async function GET() {
  try {
    const cfg = (await db.konfigurasiKanwil.findUnique({ id: "default" })) as any;
    return NextResponse.json({ waAdmin: cfg?.waAdmin ?? "" });
  } catch {
    return NextResponse.json({ waAdmin: "" });
  }
}
