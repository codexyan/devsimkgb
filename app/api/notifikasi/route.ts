import { NextRequest, NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { generateNotifikasi } from "@/lib/generateNotifikasi";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await generateNotifikasi();

  const { searchParams } = new URL(req.url);
  const tipeFilter = searchParams.get("tipe") || "";
  const dibacaFilter = searchParams.get("dibaca");
  const prioritasFilter = searchParams.get("prioritas") || "";
  const limit = Math.min(200, parseInt(searchParams.get("limit") || "50"));

  const where: Record<string, unknown> = {};
  if (tipeFilter) where.tipe = tipeFilter;
  if (dibacaFilter !== null && dibacaFilter !== "") where.dibaca = dibacaFilter === "true";
  if (prioritasFilter) where.prioritas = prioritasFilter;

  const all = await sheets.notifikasi.findMany({ where, orderBy: { field: "createdAt", dir: "desc" } });
  return NextResponse.json(all.slice(0, limit));
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, dibacaSemua } = (await req.json()) as any;

  if (dibacaSemua) {
    await sheets.notifikasi.updateMany({ dibaca: false }, { dibaca: true });
  } else if (id) {
    await sheets.notifikasi.update({ id }, { dibaca: true });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const all = searchParams.get("all");

  if (id || all) {
    if (session.user.role !== "superAdminCore")
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

    if (all === "true") {
      const count = await sheets.notifikasi.deleteMany({});
      return NextResponse.json({ success: true, deleted: count });
    }

    await sheets.notifikasi.delete({ id: id! });
    return NextResponse.json({ success: true });
  }

  // Default: hapus notifikasi sudah dibaca & lebih dari 30 hari.
  const tigaPuluhHariLalu = new Date();
  tigaPuluhHariLalu.setDate(tigaPuluhHariLalu.getDate() - 30);

  const count = await sheets.notifikasi.deleteMany({ dibaca: true, createdAt: { lte: tigaPuluhHariLalu } });

  return NextResponse.json({ success: true, deleted: count });
}
