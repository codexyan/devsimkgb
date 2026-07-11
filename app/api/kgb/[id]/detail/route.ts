import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const kgb = await prisma.riwayatKGB.findUnique({
    where: { id },
    include: {
      pegawai: true,
      surat: true,
    },
  });

  if (!kgb)
    return NextResponse.json(
      { error: "Data tidak ditemukan" },
      { status: 404 },
    );

  return NextResponse.json(kgb);
}
