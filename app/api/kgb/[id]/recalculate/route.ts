import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getGajiPokok } from "@/lib/tabelGaji";

/**
 * PATCH /api/kgb/[id]/recalculate
 * Rekalkukasi kolom Baru pada placeholder belum_diproses.
 * Lama tetap (sudah benar dari KGB sebelumnya), Baru = Lama + 2 tahun.
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const kgb = await prisma.riwayatKGB.findUnique({
    where: { id },
  });

  if (!kgb)
    return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "belum_diproses")
    return NextResponse.json(
      { error: "Hanya placeholder belum_diproses yang bisa direkalkukasi" },
      { status: 400 },
    );

  // Sumber kebenaran: Lama = nilai yang sudah tersimpan di placeholder (dari KGB selesai sebelumnya)
  // Baru = Lama + 2 tahun (PP No. 5/2024)
  const mkgTahunBaru = kgb.mkgTahunLama + 2;
  const mkgBulanBaru = kgb.mkgBulanLama;
  const gajiPokokBaru = getGajiPokok(kgb.golonganLama, mkgTahunBaru, mkgBulanBaru);

  const today = new Date();
  const tmt = new Date(kgb.tmtKgbBaru);
  const deadlineSDM = new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const flagRapelan = todayDate > deadlineSDM;

  const updated = await prisma.riwayatKGB.update({
    where: { id },
    data: {
      golonganBaru: kgb.golonganLama,
      gajiPokokBaru,
      mkgTahunBaru,
      mkgBulanBaru,
      flagRapelan,
    },
  });

  return NextResponse.json(updated);
}
