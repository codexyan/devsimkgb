import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";

export const runtime = "nodejs";

// Endpoint PUBLIK (tanpa auth): hanya nomor WA admin untuk tombol "Lupa Password".
export async function GET() {
  try {
    const cfg = (await sheets.konfigurasiKanwil.findUnique({ id: "default" })) as any;
    return NextResponse.json({ waAdmin: cfg?.waAdmin ?? "" });
  } catch {
    return NextResponse.json({ waAdmin: "" });
  }
}
