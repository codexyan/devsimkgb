import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { bolehLihatNotifikasi } from "@/lib/generateNotifikasi";

export const runtime = "nodejs";

// Tandai satu notifikasi sebagai dibaca; hanya notifikasi yang boleh dilihat role ini.
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const notif = await db.notifikasi.findUnique({ id });
  if (!notif || !bolehLihatNotifikasi(session.user.role, notif.tipe))
    return NextResponse.json({ error: "Notifikasi tidak ditemukan" }, { status: 404 });

  await db.notifikasi.update({ id }, { dibaca: true });
  return NextResponse.json({ success: true });
}
