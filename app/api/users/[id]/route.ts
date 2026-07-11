import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

// PATCH, reset password user
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;
  const { password } = await req.json() as any;

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password minimal 6 karakter" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id }, data: { password: hashedPassword } });

  return NextResponse.json({ ok: true });
}

// DELETE, hapus user, opsional reassign data ke user lain
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { id } = await params;

  // Cegah hapus diri sendiri
  const me = await prisma.user.findUnique({ where: { nip: session.user.nip! } });
  if (me?.id === id) {
    return NextResponse.json(
      { error: "Tidak bisa menghapus akun yang sedang login" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  // Ambil reassignTo dari body (opsional)
  let reassignTo: string | null = null;
  try {
    const body = await req.json() as any;
    reassignTo = body?.reassignTo ?? null;
  } catch {
    // body kosong = tidak ada reassign, lanjut
  }

  // Cek jumlah record yang mengacu ke user ini
  const [kgbCount, suratCount, serahTerimaCount, hukdisCount] = await Promise.all([
    prisma.riwayatKGB.count({ where: { createdBy: id } }),
    prisma.suratKGB.count({ where: { generatedBy: id } }),
    prisma.serahTerima.count({ where: { createdBy: id } }),
    prisma.riwayatHukdis.count({ where: { createdBy: id } }),
  ]);

  const total = kgbCount + suratCount + serahTerimaCount + hukdisCount;

  if (total > 0 && !reassignTo) {
    // Kembalikan jumlah record supaya UI bisa tampilkan dialog reassign
    return NextResponse.json(
      {
        needsReassign: true,
        counts: { kgbCount, suratCount, serahTerimaCount, hukdisCount, total },
      },
      { status: 409 },
    );
  }

  if (total > 0 && reassignTo) {
    // Validasi user tujuan ada dan bukan user yang sama
    if (reassignTo === id) {
      return NextResponse.json(
        { error: "User tujuan tidak boleh sama dengan user yang dihapus" },
        { status: 400 },
      );
    }
    const targetUser = await prisma.user.findUnique({ where: { id: reassignTo } });
    if (!targetUser) {
      return NextResponse.json(
        { error: "User tujuan tidak ditemukan" },
        { status: 404 },
      );
    }

    // Reassign semua record lalu hapus user dalam satu transaction
    await prisma.$transaction([
      prisma.riwayatKGB.updateMany({ where: { createdBy: id }, data: { createdBy: reassignTo } }),
      prisma.suratKGB.updateMany({ where: { generatedBy: id }, data: { generatedBy: reassignTo } }),
      prisma.serahTerima.updateMany({ where: { createdBy: id }, data: { createdBy: reassignTo } }),
      prisma.riwayatHukdis.updateMany({ where: { createdBy: id }, data: { createdBy: reassignTo } }),
      prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } }),
      prisma.user.delete({ where: { id } }),
    ]);

    return NextResponse.json({ ok: true, reassigned: total });
  }

  // Tidak ada record terkait, langsung hapus
  await prisma.$transaction([
    prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
