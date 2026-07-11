import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  // Kolom isArsip sudah dikelola oleh schema Prisma dan migrasi; script ini tidak diperlukan lagi.
  console.log("OK: kolom isArsip dikelola oleh schema Prisma (via migrasi).");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
