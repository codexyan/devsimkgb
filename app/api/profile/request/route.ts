import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";

// GET, cek pending request milik user saat ini
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { nip: session.user.nip! }, select: { id: true } });
  if (!user) return NextResponse.json(null);

  try {
    const request = await prisma.profileChangeRequest.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    return NextResponse.json(request);
  } catch {
    // Tabel belum ada (migration belum dijalankan)
    return NextResponse.json(null);
  }
}

// POST, ajukan permintaan perubahan profil
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { nip: session.user.nip! } });
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  const { nama, jabatan, email } = await req.json() as any;

  if (!nama?.trim()) return NextResponse.json({ error: "Nama tidak boleh kosong" }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
  }

  try {
    const existing = await prisma.profileChangeRequest.findFirst({
      where: { userId: user.id, status: "pending" },
    });
    if (existing) {
      return NextResponse.json({ error: "Masih ada permintaan yang menunggu persetujuan admin" }, { status: 400 });
    }

    const request = await prisma.profileChangeRequest.create({
      data: {
        userId: user.id,
        nama: nama.trim(),
        jabatan: jabatan?.trim() ?? null,
        email: email?.trim() ?? null,
        status: "pending",
      },
    });

    logAudit({
      userId: user.id,
      aksi: "ajukan_perubahan_profil",
      detail: `${user.nama} mengajukan permintaan perubahan profil`,
    });

    return NextResponse.json(request);
  } catch {
    return NextResponse.json({ error: "Tabel permintaan belum tersedia. Jalankan migrasi database terlebih dahulu." }, { status: 500 });
  }
}
