import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { auth } from "@/auth";

export const runtime = "nodejs";

// Tandai satu notifikasi sebagai dibaca.
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const updated = await sheets.notifikasi.update({ id }, { dibaca: true });
  if (!updated)
    return NextResponse.json({ error: "Notifikasi tidak ditemukan" }, { status: 404 });

  return NextResponse.json({ success: true });
}
