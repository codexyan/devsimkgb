import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
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

  const user = await sheets.user.findUnique({ id });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await sheets.user.update({ id }, { password: hashedPassword });

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
  const me = await sheets.user.findUnique({ nip: session.user.nip! });
  if (me?.id === id) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun yang sedang login" }, { status: 400 });
  }

  const user = await sheets.user.findUnique({ id });
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
    sheets.riwayatKGB.count({ createdBy: id }),
    sheets.suratKGB.count({ generatedBy: id }),
    sheets.serahTerima.count({ createdBy: id }),
    sheets.riwayatHukdis.count({ createdBy: id }),
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
    const targetUser = await sheets.user.findUnique({ id: reassignTo });
    if (!targetUser) {
      return NextResponse.json({ error: "User tujuan tidak ditemukan" }, { status: 404 });
    }

    // Reassign semua record lalu hapus user (sekuensial, pengganti $transaction).
    await sheets.riwayatKGB.updateMany({ createdBy: id }, { createdBy: reassignTo });
    await sheets.suratKGB.updateMany({ generatedBy: id }, { generatedBy: reassignTo } as any);
    await sheets.serahTerima.updateMany({ createdBy: id }, { createdBy: reassignTo } as any);
    await sheets.riwayatHukdis.updateMany({ createdBy: id }, { createdBy: reassignTo } as any);
    await sheets.auditLog.updateMany({ userId: id }, { userId: null });
    await sheets.user.delete({ id });

    return NextResponse.json({ ok: true, reassigned: total });
  }

  // Tidak ada record terkait, langsung hapus.
  await sheets.auditLog.updateMany({ userId: id }, { userId: null });
  await sheets.user.delete({ id });

  return NextResponse.json({ ok: true });
}
