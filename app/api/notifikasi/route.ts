import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateNotifikasi } from "@/lib/generateNotifikasi";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Auto-generate notifikasi (H-14, H-7, rapelan, hukdis berakhir)
  await generateNotifikasi();

  // --- Query params ---------------------------------------------------------
  const { searchParams } = new URL(req.url);
  const tipeFilter = searchParams.get("tipe") || "";
  const dibacaFilter = searchParams.get("dibaca");
  const prioritasFilter = searchParams.get("prioritas") || "";
  const limit = Math.min(200, parseInt(searchParams.get("limit") || "50"));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (tipeFilter) where.tipe = tipeFilter;
  if (dibacaFilter !== null && dibacaFilter !== "")
    where.dibaca = dibacaFilter === "true";
  if (prioritasFilter) where.prioritas = prioritasFilter;

  const notifikasi = await prisma.notifikasi.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(notifikasi);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, dibacaSemua } = await req.json() as any;

  if (dibacaSemua) {
    await prisma.notifikasi.updateMany({
      where: { dibaca: false },
      data: { dibaca: true },
    });
  } else if (id) {
    await prisma.notifikasi.update({
      where: { id },
      data: { dibaca: true },
    });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id  = searchParams.get("id");
  const all = searchParams.get("all");

  if (id || all) {
    if (session.user.role !== "superAdminCore")
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

    if (all === "true") {
      const { count } = await prisma.notifikasi.deleteMany({});
      return NextResponse.json({ success: true, deleted: count });
    }

    await prisma.notifikasi.delete({ where: { id: id! } });
    return NextResponse.json({ success: true });
  }

  // Default: hapus notifikasi sudah dibaca & lebih dari 30 hari
  const tigaPuluhHariLalu = new Date();
  tigaPuluhHariLalu.setDate(tigaPuluhHariLalu.getDate() - 30);

  const { count } = await prisma.notifikasi.deleteMany({
    where: {
      dibaca: true,
      createdAt: { lte: tigaPuluhHariLalu },
    },
  });

  return NextResponse.json({ success: true, deleted: count });
}
