import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

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
  const { password } = (await req.json()) as any;

  if (!password || password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  const user = await db.user.findUnique({ id });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await db.user.update({ id }, { password: hashedPassword });

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
  const me = await db.user.findUnique({ nip: session.user.nip! });
  if (me?.id === id) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun yang sedang login" }, { status: 400 });
  }

  const user = await db.user.findUnique({ id });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  let reassignTo: string | null = null;
  try {
    const body = (await req.json()) as any;
    reassignTo = body?.reassignTo ?? null;
  } catch {
    // body kosong = tidak ada reassign
  }

  const [kgbCount, suratCount, serahTerimaCount, hukdisCount] = await Promise.all([
    db.riwayatKGB.count({ createdBy: id }),
    db.suratKGB.count({ generatedBy: id }),
    db.serahTerima.count({ createdBy: id }),
    db.riwayatHukdis.count({ createdBy: id }),
  ]);

  const total = kgbCount + suratCount + serahTerimaCount + hukdisCount;

  if (total > 0 && !reassignTo) {
    return NextResponse.json(
      { needsReassign: true, counts: { kgbCount, suratCount, serahTerimaCount, hukdisCount, total } },
      { status: 409 },
    );
  }

  if (total > 0 && reassignTo) {
    if (reassignTo === id) {
      return NextResponse.json({ error: "User tujuan tidak boleh sama dengan user yang dihapus" }, { status: 400 });
    }
    const targetUser = await db.user.findUnique({ id: reassignTo });
    if (!targetUser) {
      return NextResponse.json({ error: "User tujuan tidak ditemukan" }, { status: 404 });
    }

    // Reassign semua record lalu hapus user (sekuensial, pengganti $transaction).
    await db.riwayatKGB.updateMany({ createdBy: id }, { createdBy: reassignTo });
    await db.suratKGB.updateMany({ generatedBy: id }, { generatedBy: reassignTo } as any);
    await db.serahTerima.updateMany({ createdBy: id }, { createdBy: reassignTo } as any);
    await db.riwayatHukdis.updateMany({ createdBy: id }, { createdBy: reassignTo } as any);
    await db.auditLog.updateMany({ userId: id }, { userId: null });
    await db.user.delete({ id });

    return NextResponse.json({ ok: true, reassigned: total });
  }

  // Tidak ada record terkait, langsung hapus.
  await db.auditLog.updateMany({ userId: id }, { userId: null });
  await db.user.delete({ id });

  return NextResponse.json({ ok: true });
}
