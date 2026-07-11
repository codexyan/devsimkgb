import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  const notif = await prisma.notifikasi.deleteMany();
  const pegawai = await prisma.pegawai.deleteMany();
  console.log("Notifikasi dihapus:", notif.count);
  console.log("Pegawai dihapus:", pegawai.count);
  console.log("Selesai.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
