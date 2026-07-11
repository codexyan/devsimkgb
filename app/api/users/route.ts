import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

// GET, ambil semua user
export async function GET() {
  const session = await auth();

  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      nip: true,
      nama: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

// POST, tambah user baru
export async function POST(req: Request) {
  const session = await auth();

  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { nip, nama, role, password } = await req.json() as any;

  if (!nip || !nama || !role || !password) {
    return NextResponse.json(
      { error: "Semua field wajib diisi" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { nip } });
  if (existing) {
    return NextResponse.json({ error: "NIP sudah terdaftar" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { nip, nama, role, password: hashedPassword },
    select: { id: true, nip: true, nama: true, role: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
