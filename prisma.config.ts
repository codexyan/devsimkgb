import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // CLI/migrate memakai koneksi DIRECT (non-pooled) Neon; runtime app memakai
    // DATABASE_URL (pooled) via driver adapter di lib/prisma.ts.
    //
    // Dipakai process.env langsung (bukan env() yang melempar error) agar
    // `prisma generate` saat build tidak gagal ketika DIRECT_URL belum di-set
    // (generate tidak butuh koneksi). `prisma migrate` tetap butuh DIRECT_URL asli.
    url: process.env.DIRECT_URL ?? "",
  },
});
