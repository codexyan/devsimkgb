import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/auditLog";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Try with jabatan+email (after migration). Fallback to core fields if columns don't exist yet.
  try {
    const user = await prisma.user.findUnique({
      where: { nip: session.user.nip! },
      select: { id: true, nip: true, nama: true, jabatan: true, email: true, role: true, createdAt: true },
    });
    if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    return NextResponse.json(user);
  } catch {
    const user = await prisma.user.findUnique({
      where: { nip: session.user.nip! },
      select: { id: true, nip: true, nama: true, role: true, createdAt: true },
    });
    if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ ...user, jabatan: null, email: null });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as any;
  const { nama, jabatan, email, passwordLama, passwordBaru, konfirmasiPassword } = body;

  const user = await prisma.user.findUnique({ where: { nip: session.user.nip! } });
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });

  const updateData: Record<string, string> = {};

  if (nama !== undefined) {
    if (!nama.trim()) return NextResponse.json({ error: "Nama tidak boleh kosong" }, { status: 400 });
    updateData.nama = nama.trim();
  }
  if (jabatan !== undefined) updateData.jabatan = jabatan.trim();
  if (email !== undefined) {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid" }, { status: 400 });
    }
    updateData.email = email.trim();
  }

  if (passwordBaru) {
    if (!passwordLama) return NextResponse.json({ error: "Password lama wajib diisi" }, { status: 400 });
    if (passwordBaru.length < 6) return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });
    if (passwordBaru !== konfirmasiPassword) return NextResponse.json({ error: "Konfirmasi password tidak cocok" }, { status: 400 });

    const match = await bcrypt.compare(passwordLama, user.password);
    if (!match) return NextResponse.json({ error: "Password lama salah" }, { status: 400 });

    updateData.password = await bcrypt.hash(passwordBaru, 12);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
  }

  // Try update with all fields; if jabatan/email columns missing, update only core fields
  try {
    await prisma.user.update({ where: { id: user.id }, data: updateData });
  } catch {
    const { jabatan: _j, email: _e, ...coreData } = updateData;
    if (Object.keys(coreData).length === 0) {
      return NextResponse.json({ error: "Kolom jabatan/email belum tersedia. Jalankan migrasi database terlebih dahulu." }, { status: 500 });
    }
    await prisma.user.update({ where: { id: user.id }, data: coreData });
  }

  logAudit({
    userId: user.id,
    aksi: "edit_profil",
    detail: `${user.nama} memperbarui profil${passwordBaru ? " dan mengganti password" : ""}`,
  });

  return NextResponse.json({ success: true });
}
