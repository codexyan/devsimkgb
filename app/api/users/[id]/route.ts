import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, lupakanSesiPengguna } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { ROLE_LABEL } from "@/lib/auth";
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

  const admin = await penggunaLogin(session);
  if (!admin) {
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });
  }

  const { id } = await params;
  // Password akun sendiri diganti lewat Profil Saya, yang meminta password lama dan mengarahkan
  // pengguna masuk kembali; atur ulang di sini akan mengakhiri sesi Super Admin tanpa penjelasan.
  if (id === admin.id) {
    return NextResponse.json({ error: "Password akun sendiri diganti lewat Profil Saya" }, { status: 400 });
  }

  let password = "";
  try {
    const body: unknown = await req.json();
    const nilai = body && typeof body === "object" ? (body as { password?: unknown }).password : undefined;
    if (typeof nilai === "string") password = nilai;
  } catch {
    // body tidak valid diperlakukan sebagai password kosong
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  const user = await db.user.findUnique({ id });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await db.user.update({ id }, { password: hashedPassword });
  // Sesi yang dibuat dengan password lama berakhir (lihat auth.ts); isolate ini memeriksa ulang segera.
  lupakanSesiPengguna();

  logAudit({
    userId: admin.id,
    aksi: "reset_password",
    detail: `Atur ulang password pengguna ${user.nama} (${user.nip})`,
  });

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

  const me = await penggunaLogin(session);
  if (!me) {
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });
  }

  // Cegah hapus diri sendiri
  if (me.id === id) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun yang sedang login" }, { status: 400 });
  }

  const user = await db.user.findUnique({ id });
  if (!user) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  let reassignTo: string | null = null;
  try {
    const body: unknown = await req.json();
    const nilai = body && typeof body === "object" ? (body as { reassignTo?: unknown }).reassignTo : null;
    reassignTo = typeof nilai === "string" && nilai ? nilai : null;
  } catch {
    // body kosong = tidak ada reassign
  }

  // Entri riwayat aktivitas pengguna ini tetap menyimpan id-nya; nama, NIP, dan id pengguna yang
  // dihapus dicatat pada entri hapus_pengguna agar entri lama dapat ditelusuri.
  const catatHapus = (tambahan: string) => {
    logAudit({
      userId: me.id,
      aksi: "hapus_pengguna",
      detail: `Hapus pengguna ${user.nama} (${user.nip}), peran ${ROLE_LABEL[user.role] ?? user.role}, id ${user.id}${tambahan}`,
    });
  };

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
    await db.suratKGB.updateMany({ generatedBy: id }, { generatedBy: reassignTo });
    await db.serahTerima.updateMany({ createdBy: id }, { createdBy: reassignTo });
    await db.riwayatHukdis.updateMany({ createdBy: id }, { createdBy: reassignTo });
    catatHapus(`, ${total} data dialihkan ke ${targetUser.nama} (${targetUser.nip})`);
    await db.user.delete({ id });
    lupakanSesiPengguna();

    return NextResponse.json({ ok: true, reassigned: total });
  }

  // Tidak ada record terkait, langsung hapus.
  catatHapus("");
  await db.user.delete({ id });
  lupakanSesiPengguna();

  return NextResponse.json({ ok: true });
}
