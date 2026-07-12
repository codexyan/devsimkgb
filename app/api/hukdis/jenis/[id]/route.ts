import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;

  const jenis = (await sheets.hukdisJenis.findUnique({ id })) as any;
  if (!jenis) return NextResponse.json({ error: "Jenis tidak ditemukan" }, { status: 404 });

  const used = await sheets.riwayatHukdis.count({ jenisHukdis: jenis.kode });
  if (used > 0) {
    return NextResponse.json(
      { error: `Tidak dapat dihapus: sudah tercatat pada ${used} riwayat hukdis` },
      { status: 400 },
    );
  }

  await sheets.hukdisJenis.delete({ id });
  return NextResponse.json({ ok: true });
}
