import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await sheets.user.findUnique({ nip: session.user.nip! });
  if (!user) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  return NextResponse.json({
    id: user.id, nip: user.nip, nama: user.nama, jabatan: user.jabatan,
    email: user.email, role: user.role, createdAt: user.createdAt,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as any;
  const { nama, jabatan, email, passwordLama, passwordBaru, konfirmasiPassword } = body;

  const user = await sheets.user.findUnique({ nip: session.user.nip! });
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

  await sheets.user.update({ id: user.id }, updateData);

  logAudit({
    userId: user.id,
    aksi: "edit_profil",
    detail: `${user.nama} memperbarui profil${passwordBaru ? " dan mengganti password" : ""}`,
  });

  return NextResponse.json({ success: true });
}
