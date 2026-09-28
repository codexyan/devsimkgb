import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { responsBerkasSk } from "@/lib/berkasSk";
import { kunciBerkasSah } from "@/lib/inventarisServer";

export const runtime = "nodejs";

/** PDF kiriman inventarisasi, untuk pratinjau dan unduhan ZIP di dashboard (Super Admin dan Tim SDM KGB). */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const kunci = new URL(req.url).searchParams.get("kunci") ?? "";
  if (!kunciBerkasSah(kunci)) return NextResponse.json({ error: "Berkas tidak ditemukan" }, { status: 404 });
  return responsBerkasSk(kunci, kunci.split("/").pop());
}
