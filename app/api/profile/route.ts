import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, lupakanSesiPengguna } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import bcrypt from "bcryptjs";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ nip: session.user.nip! });
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

  // Nama, jabatan, dan email hanya berubah lewat permintaan yang disetujui Super Admin
  // (POST /api/profile/request), jadi rute ini khusus ganti password.
  if (nama !== undefined || jabatan !== undefined || email !== undefined) {
    return NextResponse.json(
      { error: "Perubahan nama, jabatan, atau email diajukan lewat permintaan perubahan profil" },
      { status: 403 },
    );
  }

  const user = await penggunaLogin(session);
  if (!user) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const updateData: Record<string, string> = {};

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

  await db.user.update({ id: user.id }, updateData);
  // Sesi dengan password lama berakhir (lihat auth.ts), termasuk sesi ini: pengguna perlu masuk kembali.
  if (updateData.password) lupakanSesiPengguna();

  logAudit({
    userId: user.id,
    aksi: "edit_profil",
    detail: `${user.nama} memperbarui profil${passwordBaru ? " dan mengganti password" : ""}`,
  });

  return NextResponse.json({ success: true });
}
