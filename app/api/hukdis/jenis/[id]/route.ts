import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;

  const jenis = await prisma.hukdisJenis.findUnique({ where: { id } });
  if (!jenis) return NextResponse.json({ error: "Jenis tidak ditemukan" }, { status: 404 });

  const used = await prisma.riwayatHukdis.count({ where: { jenisHukdis: jenis.kode } });
  if (used > 0) {
    return NextResponse.json(
      { error: `Tidak dapat dihapus: sudah tercatat pada ${used} riwayat hukdis` },
      { status: 400 },
    );
  }

  await prisma.hukdisJenis.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
