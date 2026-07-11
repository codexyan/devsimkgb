import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  // Deadline SDM = akhir bulan ke-2 sebelum TMT → rapelan jika bulan-sebelum-TMT sudah mulai
  const rapelanCutoff = new Date(today.getFullYear(), today.getMonth() + 2, 1);

  const [belumDiproses, sedangDiproses, menungguKeuangan, selesai, ditolak, virtualCount, rapelan] =
    await Promise.all([
      prisma.riwayatKGB.count({ where: { status: "belum_diproses" } }),
      prisma.riwayatKGB.count({ where: { status: "sedang_diproses", isArsip: false } }),
      prisma.riwayatKGB.count({ where: { status: "menunggu_keuangan", isArsip: false } }),
      prisma.riwayatKGB.count({ where: { status: "selesai", isArsip: false } }),
      prisma.riwayatKGB.count({ where: { status: "ditolak", isArsip: false } }),
      // Virtual: pegawai aktif tanpa riwayatKGB aktif (belum_diproses/sedang_diproses/menunggu_keuangan)
      prisma.pegawai.count({
        where: {
          aktif: true,
          NOT: {
            riwayatKGB: {
              some: { status: { in: ["belum_diproses", "sedang_diproses", "menunggu_keuangan"] } },
            },
          },
        },
      }),
      prisma.pegawai.count({
        where: {
          aktif: true,
          tmtKgbBerikutnya: { lt: rapelanCutoff },
          NOT: { riwayatKGB: { some: { status: "selesai" } } },
        },
      }),
    ]);

  const totalBelumDiproses = belumDiproses + virtualCount;
  const total = totalBelumDiproses + sedangDiproses + menungguKeuangan + selesai + ditolak;

  return NextResponse.json({
    total,
    belum_diproses: totalBelumDiproses,
    sedang_diproses: sedangDiproses + menungguKeuangan,
    menunggu_keuangan: menungguKeuangan,
    selesai,
    ditolak,
    rapelan,
  });
}
