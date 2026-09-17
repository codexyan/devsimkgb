import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";

export const runtime = "nodejs";

// PATCH, approve atau reject permintaan
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const admin = await penggunaLogin(session);
  if (!admin) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { id } = await params;
  const { action, alasanTolak } = (await req.json()) as any;

  const request = (await db.profileChangeRequest.findUnique({ id })) as any;
  if (!request) return NextResponse.json({ error: "Permintaan tidak ditemukan" }, { status: 404 });
  if (request.status !== "pending")
    return NextResponse.json({ error: "Permintaan sudah diproses" }, { status: 400 });

  const reqUser = await db.user.findUnique({ id: request.userId });
  const reqUserNama = reqUser?.nama ?? "-";

  if (action === "approve") {
    // Terapkan perubahan ke profil user (field jabatan/email selalu diterapkan,
    // sesuai perilaku semula; nama hanya bila terisi).
    const updateData: Record<string, string | null> = {
      jabatan: request.jabatan ?? null,
      email: request.email ?? null,
    };
    if (request.nama) updateData.nama = request.nama;

    // Pengganti $transaction: dua update sekuensial (best-effort, tanpa rollback).
    await db.user.update({ id: request.userId }, updateData);
    await db.profileChangeRequest.update(
      { id },
      { status: "approved", reviewedAt: new Date(), reviewedBy: admin.id },
    );

    logAudit({
      userId: admin.id,
      aksi: "approve_perubahan_profil",
      detail: `${admin.nama} menyetujui permintaan perubahan profil ${reqUserNama}`,
    });
  } else if (action === "reject") {
    await db.profileChangeRequest.update(
      { id },
      {
        status: "rejected",
        alasanTolak: alasanTolak?.trim() || null,
        reviewedAt: new Date(),
        reviewedBy: admin.id,
      },
    );

    logAudit({
      userId: admin.id,
      aksi: "reject_perubahan_profil",
      detail: `${admin.nama} menolak permintaan perubahan profil ${reqUserNama}`,
    });
  } else {
    return NextResponse.json({ error: "Action tidak valid" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
