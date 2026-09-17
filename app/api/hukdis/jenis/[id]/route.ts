import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
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

  const jenis = (await db.hukdisJenis.findUnique({ id })) as { kode: string; label: string | null } | null;
  if (!jenis) return NextResponse.json({ error: "Jenis tidak ditemukan" }, { status: 404 });

  const used = await db.riwayatHukdis.count({ jenisHukdis: jenis.kode });
  if (used > 0) {
    return NextResponse.json(
      { error: `Tidak dapat dihapus: sudah tercatat pada ${used} riwayat hukdis` },
      { status: 400 },
    );
  }

  await db.hukdisJenis.delete({ id });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (userLogin) {
    logAudit({
      userId: userLogin.id,
      aksi: "hapus_jenis_hukdis",
      detail: `Hapus jenis hukdis ${jenis.label ?? jenis.kode} (${jenis.kode})`,
    });
  }

  return NextResponse.json({ ok: true });
}
