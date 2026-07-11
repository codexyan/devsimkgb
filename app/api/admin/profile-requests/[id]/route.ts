import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";

// PATCH, approve atau reject permintaan
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const admin = await prisma.user.findUnique({ where: { nip: session.user.nip! }, select: { id: true, nama: true } });
  if (!admin) return NextResponse.json({ error: "Admin tidak ditemukan" }, { status: 404 });

  const { id } = await params;
  const { action, alasanTolak } = await req.json() as any;

  const request = await prisma.profileChangeRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, nama: true, nip: true } } },
  });

  if (!request) return NextResponse.json({ error: "Permintaan tidak ditemukan" }, { status: 404 });
  if (request.status !== "pending") return NextResponse.json({ error: "Permintaan sudah diproses" }, { status: 400 });

  if (action === "approve") {
    // Terapkan perubahan ke profil user
    const updateData: Record<string, string | null> = {};
    if (request.nama) updateData.nama = request.nama;
    if (request.jabatan !== undefined) updateData.jabatan = request.jabatan;
    if (request.email !== undefined) updateData.email = request.email;

    await prisma.$transaction([
      prisma.user.update({ where: { id: request.userId }, data: updateData }),
      prisma.profileChangeRequest.update({
        where: { id },
        data: { status: "approved", reviewedAt: new Date(), reviewedBy: admin.id },
      }),
    ]);

    logAudit({
      userId: admin.id,
      aksi: "approve_perubahan_profil",
      detail: `${admin.nama} menyetujui permintaan perubahan profil ${request.user.nama}`,
    });

  } else if (action === "reject") {
    await prisma.profileChangeRequest.update({
      where: { id },
      data: {
        status: "rejected",
        alasanTolak: alasanTolak?.trim() || null,
        reviewedAt: new Date(),
        reviewedBy: admin.id,
      },
    });

    logAudit({
      userId: admin.id,
      aksi: "reject_perubahan_profil",
      detail: `${admin.nama} menolak permintaan perubahan profil ${request.user.nama}`,
    });

  } else {
    return NextResponse.json({ error: "Action tidak valid" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
