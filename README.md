# SIM-KGB

Sistem Informasi Manajemen **Kenaikan Gaji Berkala (KGB)** — Kementerian Imigrasi dan Pemasyarakatan RI.

Aplikasi web tunggal (single-app) untuk mengelola data pegawai, riwayat KGB, hukuman disiplin (hukdis), pembuatan surat KGB (PDF), rekonsiliasi keuangan, notifikasi, dan pelaporan.

> Repo ini dipisah dari monorepo `sdmpas` menjadi repo mandiri. Paket bersama (`@sdmpas/ui`, `@sdmpas/auth`) telah di-inline ke `lib/ui` dan `lib/auth`; tidak ada lagi dependency workspace.

## Teknologi

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript 5**
- **Tailwind CSS v4**
- **Prisma 7** dengan driver adapter
- **NextAuth v5** (autentikasi + peran/role)
- **@react-pdf/renderer** (generate surat KGB)
- Deploy: **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)

## Database

Aplikasi memilih adapter Prisma berdasarkan skema `DATABASE_URL` (lihat `lib/prisma.ts`):

- `DATABASE_URL="file:..."` → **SQLite** lokal (libsql) untuk dev — tanpa perlu database cloud.
- selain itu → **Neon Postgres** (produksi / Cloudflare Workers).

Prisma mewajibkan `provider` berupa string statis, jadi disediakan skrip untuk menukarnya:

```bash
npm run db:sqlite     # provider=sqlite  + prisma generate  (dev lokal)
npm run db:postgres   # provider=postgresql + prisma generate (produksi/Neon)
```

## Menjalankan lokal

```bash
npm install
cp .env.example .env          # isi nilai; untuk dev cukup DATABASE_URL="file:./dev.db"
npm run db:sqlite             # set provider SQLite + generate client
npx prisma db push            # buat skema di dev.db
npm run dev                   # http://localhost:3000
```

### Variabel environment

Lihat `.env.example`. Ringkas:

| Variabel | Kegunaan |
|----------|----------|
| `DATABASE_URL` | Koneksi runtime (`file:...` untuk SQLite dev, URL pooled Neon untuk prod) |
| `DIRECT_URL` | Koneksi direct Neon untuk `prisma migrate`/`db push` (prod) |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | NextAuth v5 |
| `CRON_SECRET` | Bearer token endpoint notifikasi terjadwal |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (penyimpanan SK PDF) — di Cloudflare memakai R2 (`SK_BUCKET`) |
| `SEED_PASSWORD_*` | Dipakai `prisma db seed` |

## Skrip

| Skrip | Aksi |
|-------|------|
| `npm run dev` | Dev server (port 3000) |
| `npm run build` | `prisma generate` + `next build` |
| `npm run cf:build` | Build bundel Cloudflare (OpenNext, provider Postgres) |
| `npm run cf:preview` | Preview worker lokal |
| `npm run cf:deploy` | Deploy ke Cloudflare Workers |
| `npm run cf:typegen` | Regenerasi `cloudflare-env.d.ts` dari `wrangler.jsonc` |
| `npm run lint` | ESLint |

## Deploy

Deploy ke Cloudflare Workers (OpenNext), database Neon Postgres, SK PDF di Cloudflare R2, notifikasi harian via Cron Triggers. Panduan lengkap: **[`DEPLOY-CLOUDFLARE.md`](DEPLOY-CLOUDFLARE.md)**.

## Struktur

```
app/                 Route (halaman + API) App Router
lib/                 Util domain (prisma, authGuard, gaji, dsb.)
lib/ui/              Komponen UI bersama (hasil inline dari @sdmpas/ui)
lib/auth/            Helper peran/role (hasil inline dari @sdmpas/auth)
prisma/              schema.prisma, migrations, seed
scripts/             Utilitas (set-db-provider, dsb.)
wrangler.jsonc       Konfigurasi Cloudflare Workers
open-next.config.ts  Konfigurasi OpenNext
```
