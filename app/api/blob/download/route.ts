import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { bolehUnduhBerkasSk } from "@/lib/auth";
import { kunciSk, responsBerkasSk } from "@/lib/berkasSk";

// Ambil berkas SK PRIVAT dari Cloudflare R2 lewat key-nya. Rute ini tidak memeriksa SK milik siapa,
// jadi hanya untuk peran Kanwil yang memang boleh melihat seluruh SK. Admin UPT memakai
// /api/upt/sk/[id], yang memeriksa satker pegawai dan status KGB lebih dulu.
export async function GET(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!bolehUnduhBerkasSk(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url") || searchParams.get("path") || searchParams.get("key");
  if (!raw)
    return NextResponse.json({ error: "Path file wajib diisi" }, { status: 400 });

  const key = kunciSk(raw);
  if (!key)
    return NextResponse.json({ error: "Path tidak valid" }, { status: 400 });

  return responsBerkasSk(key);
}
