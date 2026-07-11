import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Tandai satu notifikasi sebagai dibaca. Dipanggil oleh Topbar dan Sidebar
// sebagai PATCH /api/notifikasi/<id>/baca (id di path, tanpa body).
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await prisma.notifikasi.update({
      where: { id },
      data: { dibaca: true },
    });
  } catch {
    return NextResponse.json(
      { error: "Notifikasi tidak ditemukan" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
