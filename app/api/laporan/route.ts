import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tahun = parseInt(
    searchParams.get("tahun") || new Date().getFullYear().toString(),
  );
  const bulan = searchParams.get("bulan") || "";
  const status = searchParams.get("status") || "";

  // Range tanggal, gunakan awal/akhir hari penuh
  const dateFrom = bulan
    ? new Date(tahun, parseInt(bulan) - 1, 1, 0, 0, 0)
    : new Date(tahun, 0, 1, 0, 0, 0);
  const dateTo = bulan
    ? new Date(tahun, parseInt(bulan), 0, 23, 59, 59)
    : new Date(tahun, 11, 31, 23, 59, 59);

  const kgbList = await prisma.riwayatKGB.findMany({
    where: {
      tmtKgbBaru: { gte: dateFrom, lte: dateTo },
      isArsip: false,
      ...(status ? { status } : {}),
    },
    include: {
      pegawai: {
        select: {
          nama: true,
          nip: true,
          jabatan: true,
          golonganRuang: true,
          unitKerja: true,
        },
      },
      surat: { select: { nomorSurat: true, tanggalSurat: true, pathFile: true } },
    },
    orderBy: { tmtKgbBaru: "asc" },
  });

  // Statistik ringkasan
  const total = kgbList.length;
  const selesai = kgbList.filter((k) => k.status === "selesai").length;
  const sedangDiproses = kgbList.filter(
    (k) => k.status === "sedang_diproses" || k.status === "menunggu_keuangan",
  ).length;
  const belumDiproses = kgbList.filter(
    (k) => k.status === "belum_diproses",
  ).length;
  const ditolak = kgbList.filter((k) => k.status === "ditolak").length;
  const todayDate = new Date();
  const todayNorm = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
  const rapelan = kgbList.filter((k) => {
    if (k.status === "selesai" || k.status === "ditolak" || k.status === "menunggu_keuangan") return false;
    const tmt = new Date(k.tmtKgbBaru);
    const deadline = new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
    return todayNorm > deadline;
  }).length;

  // Rekap per golongan
  const perGolongan: Record<string, number> = {};
  kgbList.forEach((k) => {
    perGolongan[k.golonganBaru] = (perGolongan[k.golonganBaru] || 0) + 1;
  });

  // Rekap per unit kerja
  const perUnitKerja: Record<string, number> = {};
  kgbList.forEach((k) => {
    const unit = k.pegawai.unitKerja;
    perUnitKerja[unit] = (perUnitKerja[unit] || 0) + 1;
  });

  return NextResponse.json({
    stats: { total, selesai, sedangDiproses, belumDiproses, ditolak, rapelan },
    perGolongan,
    perUnitKerja,
    kgbList,
  });
}
