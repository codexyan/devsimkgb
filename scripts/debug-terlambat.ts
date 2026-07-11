import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const today = new Date();
  const awalBulanDepan = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  console.log("today          :", today.toISOString().split("T")[0]);
  console.log("awalBulanDepan :", awalBulanDepan.toISOString().split("T")[0]);
  console.log("");

  const rapelanStats = await prisma.pegawai.count({
    where: {
      aktif: true,
      tmtKgbBerikutnya: { lt: awalBulanDepan },
      NOT: { riwayatKGB: { some: { status: "selesai" } } },
    },
  });

  const rapelanKGB = await prisma.riwayatKGB.count({
    where: {
      pegawai: { tmtKgbBerikutnya: { lt: awalBulanDepan } },
      status: { notIn: ["selesai", "ditolak"] },
    },
  });

  const pegawaiJT = await prisma.pegawai.findMany({
    where: {
      aktif: true,
      OR: [
        { tmtKgbBerikutnya: { lt: today }, NOT: { riwayatKGB: { some: { status: "selesai" } } } },
        { tmtKgbBerikutnya: { gte: today, lte: awalBulanDepan } },
      ],
    },
    select: { tmtKgbBerikutnya: true, riwayatKGB: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } },
  });

  let terlambatCount = 0;
  for (const p of pegawaiJT) {
    const deadline = new Date(p.tmtKgbBerikutnya);
    deadline.setDate(0);
    const selesai = p.riwayatKGB[0]?.status === "selesai";
    if (today > deadline && !selesai) terlambatCount++;
  }

  console.log("stats.rapelan (baru)  :", rapelanStats);
  console.log("KGB filter (baru)     :", rapelanKGB);
  console.log("terlambat di banner   :", terlambatCount);
  console.log("Semua sama?", rapelanStats === rapelanKGB && rapelanKGB === terlambatCount ? "YA âœ“" : "TIDAK");
}

main().finally(() => prisma.$disconnect());
