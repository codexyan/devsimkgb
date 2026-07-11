import "dotenv/config";
import { prisma } from "../lib/prisma";
const today = new Date();
const awal = new Date(today.getFullYear(), today.getMonth(), 1);

Promise.all([
  prisma.pegawai.count({ where: { aktif: true, tmtKgbBerikutnya: { lt: awal }, NOT: { riwayatKGB: { some: { status: "selesai" } } } } }),
  prisma.riwayatKGB.count({ where: { pegawai: { tmtKgbBerikutnya: { lt: awal } }, status: { notIn: ["selesai", "ditolak"] } } }),
]).then(([dash, kgb]) => {
  console.log("Dashboard stats.rapelan :", dash);
  console.log("KGB filter rapelan (baru):", kgb);
  console.log("Sama?", dash === kgb ? "YA âœ“" : "TIDAK â€” selisih " + Math.abs(dash - kgb));
  prisma.$disconnect();
});
