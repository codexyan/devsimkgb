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

  const pegawai = await prisma.pegawai.findUnique({
    where: { id },
    select: {
      id: true,
      nip: true,
      nama: true,
      jabatan: true,
      pangkat: true,
      golonganRuang: true,
      unitKerja: true,
      gajiPokok: true,
      mkgTahun: true,
      mkgBulan: true,
      tmtKgbBerikutnya: true,
    },
  });

  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const riwayat = await prisma.riwayatKGB.findMany({
    where: { pegawaiId: id },
    include: {
      surat: { select: { nomorSurat: true, pathFile: true } },
    },
    orderBy: { tmtKgbBaru: "desc" },
  });

  return NextResponse.json({ pegawai, riwayat });
}
