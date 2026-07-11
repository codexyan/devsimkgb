// Menukar provider datasource Prisma antara "sqlite" (dev lokal) dan
// "postgresql" (produksi/Neon di Cloudflare). Prisma mensyaratkan provider
// berupa string statis di schema, jadi perlu di-flip sebelum build sesuai target.
//
//   node scripts/set-db-provider.mjs sqlite
//   node scripts/set-db-provider.mjs postgresql
//
// Pakai lewat npm: `npm run db:sqlite` / `npm run db:postgres` (sekaligus generate).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const target = process.argv[2];
if (target !== "sqlite" && target !== "postgresql") {
  console.error('Penggunaan: node scripts/set-db-provider.mjs <sqlite|postgresql>');
  process.exit(1);
}

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "schema.prisma");
const src = readFileSync(schemaPath, "utf8");

// Ganti baris provider HANYA di dalam blok `datasource db { ... }`.
const next = src.replace(
  /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")(sqlite|postgresql)(")/,
  `$1${target}$3`,
);

if (next === src) {
  if (src.includes(`provider = "${target}"`)) {
    console.log(`Provider Prisma sudah "${target}", tidak ada perubahan.`);
    process.exit(0);
  }
  console.error("Gagal: baris provider tidak ditemukan di datasource db.");
  process.exit(1);
}

writeFileSync(schemaPath, next);
console.log(`Provider Prisma diubah menjadi "${target}".`);
