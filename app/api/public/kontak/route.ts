import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Endpoint PUBLIK (tanpa auth): hanya nomor WA admin untuk tombol "Lupa
// Password" di halaman login. Tidak membocorkan data sensitif lain.
export async function GET() {
  try {
    const cfg = await prisma.konfigurasiKanwil.findUnique({
      where: { id: "default" },
      select: { waAdmin: true },
    });
    return NextResponse.json({ waAdmin: cfg?.waAdmin ?? "" });
  } catch {
    return NextResponse.json({ waAdmin: "" });
  }
}
