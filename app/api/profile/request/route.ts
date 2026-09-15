import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

// GET, cek pending request milik user saat ini
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ nip: session.user.nip! });
  if (!user) return NextResponse.json(null);

  const list = (await db.profileChangeRequest.findMany({
    where: { userId: user.id },
    orderBy: { field: "createdAt", dir: "desc" },
  })) as any[];
  return NextResponse.json(list[0] ?? null);
}

// POST, ajukan permintaan perubahan profil
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ nip: session.user.nip! });
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  const { nama, jabatan, email } = (await req.json()) as any;

  if (!nama?.trim()) return NextResponse.json({ error: "Nama tidak boleh kosong" }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
  }

  const existing = await db.profileChangeRequest.findUnique({ userId: user.id, status: "pending" });
  if (existing) {
    return NextResponse.json({ error: "Masih ada permintaan yang menunggu persetujuan admin" }, { status: 400 });
  }

  const request = {
    id: newId(),
    userId: user.id,
    nama: nama.trim(),
    jabatan: jabatan?.trim() ?? null,
    email: email?.trim() ?? null,
    status: "pending",
    alasanTolak: null,
    createdAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
  };
  await db.profileChangeRequest.create(request);

  logAudit({
    userId: user.id,
    aksi: "ajukan_perubahan_profil",
    detail: `${user.nama} mengajukan permintaan perubahan profil`,
  });

  return NextResponse.json(request);
}
