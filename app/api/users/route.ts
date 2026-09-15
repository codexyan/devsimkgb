import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

// GET, ambil semua user
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const all = await db.user.findMany({ orderBy: { field: "createdAt", dir: "desc" } });
  const users = all.map((u) => ({ id: u.id, nip: u.nip, nama: u.nama, role: u.role, createdAt: u.createdAt }));
  return NextResponse.json(users);
}

// POST, tambah user baru
export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { nip, nama, role, password } = (await req.json()) as any;

  if (!nip || !nama || !role || !password) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ nip });
  if (existing) {
    return NextResponse.json({ error: "NIP sudah terdaftar" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = {
    id: newId(),
    nip,
    password: hashedPassword,
    nama,
    jabatan: null,
    email: null,
    role,
    createdAt: new Date(),
  };
  await db.user.create(user);

  return NextResponse.json(
    { id: user.id, nip: user.nip, nama: user.nama, role: user.role, createdAt: user.createdAt },
    { status: 201 },
  );
}
