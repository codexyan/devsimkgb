import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis } from "@/lib/auth";

const VALID_STATUS = ["berlaku", "dicabut_sebagian", "dicabut"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as any;
  const nomor = String(body.nomor ?? "").trim();
  const tahun = String(body.tahun ?? "").trim();
  const tentang = String(body.tentang ?? "").trim();
  if (!nomor || !tahun || !tentang)
    return NextResponse.json({ error: "Nomor, tahun, dan tentang wajib diisi" }, { status: 400 });

  const status = VALID_STATUS.includes(body.status) ? body.status : "berlaku";
  // Cegah referensi ke diri sendiri
  const digantikanOlehId = status !== "berlaku" && body.digantikanOlehId && body.digantikanOlehId !== id
    ? body.digantikanOlehId : null;

  const reg = await prisma.regulasi.update({
    where: { id },
    data: {
      nomor, tahun, tentang, status,
      pasalBerlaku: status === "dicabut_sebagian" ? (body.pasalBerlaku?.trim() || null) : null,
      digantikanOlehId,
      catatan: body.catatan?.trim() || null,
      updatedBy: session.user.nip,
    },
  });

  const userLogin = await prisma.user.findUnique({ where: { nip: session.user.nip! } });
  if (userLogin) logAudit({ userId: userLogin.id, aksi: "edit_konfigurasi", detail: `Ubah regulasi: ${nomor} Tahun ${tahun} (status: ${status})` });

  return NextResponse.json(reg);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  // Lepas referensi 'digantikanOleh' dari regulasi lain agar tidak menggantung
  await prisma.regulasi.updateMany({ where: { digantikanOlehId: id }, data: { digantikanOlehId: null } });
  await prisma.regulasi.delete({ where: { id } });

  const userLogin = await prisma.user.findUnique({ where: { nip: session.user.nip! } });
  if (userLogin) logAudit({ userId: userLogin.id, aksi: "edit_konfigurasi", detail: "Hapus regulasi" });

  return NextResponse.json({ ok: true });
}
