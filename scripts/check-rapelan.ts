import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const today = new Date();
  const awal = new Date(today.getFullYear(), today.getMonth(), 1);

  const dash = await prisma.pegawai.findMany({
    where: {
      aktif: true,
      tmtKgbBerikutnya: { lt: awal },
      NOT: { riwayatKGB: { some: { status: "selesai" } } },
    },
    select: {
      id: true, nama: true, nip: true,
      riwayatKGB: {
        orderBy: { createdAt: "desc" }, take: 1,
        select: { flagRapelan: true, status: true },
      },
    },
  });

  const kgb = await prisma.riwayatKGB.findMany({
    where: { flagRapelan: true, status: { notIn: ["selesai", "ditolak"] } },
    select: { pegawaiId: true },
  });

  const ids = new Set(kgb.map((k) => k.pegawaiId));
  console.log("Dashboard rapelan:", dash.length);
  console.log("KGB filter rapelan:", kgb.length);
  console.log("Selisih:", dash.length - kgb.length);
  console.log("");

  const diff = dash.filter((p) => !ids.has(p.id));
  if (diff.length === 0) {
    console.log("Tidak ada selisih.");
  } else {
    console.log("Yang ada di dashboard tapi tidak di KGB filter:");
    diff.forEach((p) => {
      const k = p.riwayatKGB[0];
      console.log("  Nama :", p.nama);
      console.log("  NIP  :", p.nip);
      console.log("  KGB  :", k ? `status=${k.status}, flagRapelan=${k.flagRapelan}` : "tidak ada record");
      console.log("");
    });
  }
}

main().finally(() => prisma.$disconnect());
