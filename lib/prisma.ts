import { createRequire } from "node:module";
import { PrismaClient } from "@prisma-client";
import { PrismaNeon } from "@prisma/adapter-neon";

// Pemilihan driver adapter berdasarkan skema DATABASE_URL:
//   • "file:..."  → SQLite lokal (dev) via libsql — tanpa perlu database cloud.
//   • selain itu  → Neon serverless (produksi/Cloudflare Workers & Node).
//
// PENTING (Cloudflare Workers): @prisma/adapter-libsql memuat dependensi native
// yang TIDAK dapat dibundel ke Worker. Karena itu hanya jalur Neon yang di-import
// statis; libsql di-load dinamis lewat specifier non-literal sehingga bundler
// Workers tidak pernah menyertakannya. Cabang libsql hanya tereksekusi di Node
// saat DATABASE_URL berskema "file:".
//
// Catatan: provider di schema.prisma harus cocok dengan adapter yang aktif
// (sqlite untuk file:, postgresql untuk Neon) — jalankan `prisma generate`
// setelah mengganti mode.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? "";

  if (!url.startsWith("file:")) {
    return new PrismaClient({
      adapter: new PrismaNeon({ connectionString: url }),
    });
  }

  const specifier = "@prisma/adapter-libsql";
  const nodeRequire = createRequire(import.meta.url);
  const { PrismaLibSql } = nodeRequire(specifier) as typeof import("@prisma/adapter-libsql");
  return new PrismaClient({ adapter: new PrismaLibSql({ url }) });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
