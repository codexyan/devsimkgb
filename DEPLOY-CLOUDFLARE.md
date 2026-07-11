# Deploy SIM-KGB ke Cloudflare Workers

SIM-KGB dideploy ke **Cloudflare Workers** memakai [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).
Database tetap **Neon Postgres**. Berkas SK pindah dari Vercel Blob ke **Cloudflare R2**.
Notifikasi harian berjalan lewat **Cloudflare Cron Triggers**.

> Semua perintah dijalankan dari folder `apps/kgb`.

---

## 1. Prasyarat (sekali saja)

1. Akun Cloudflare (Workers Paid tidak wajib — bundel worker ~0,7 MB gzip, muat di plan Free 3 MB).
2. Login wrangler:
   ```bash
   npx wrangler login
   ```
3. Database **Neon** siap (URL pooled untuk runtime + URL direct untuk migrasi).

---

## 2. Siapkan Prisma untuk Neon (Postgres)

Dev lokal memakai SQLite; **produksi memakai Neon Postgres**. Prisma mewajibkan
`provider` berupa string statis di `prisma/schema.prisma`, jadi harus di-switch.
Sudah disediakan skrip untuk itu (URL koneksi diambil `prisma.config.ts` dari
`DIRECT_URL`, sehingga blok datasource cukup berisi `provider`):

1. Switch ke Postgres + generate client:
   ```bash
   npm run db:postgres      # set provider=postgresql lalu prisma generate
   ```
2. Terapkan skema ke Neon (butuh `DIRECT_URL` Neon di `.env`):
   ```bash
   npx prisma db push
   ```
3. Seed super admin bila perlu (lihat `scripts/reset-superadmin.ts`).
4. Kembali ke dev lokal SQLite kapan saja:
   ```bash
   npm run db:sqlite
   ```

> Catatan: `npm run cf:build` / `cf:deploy` **sudah otomatis** menyetel provider ke
> postgresql sebelum build, jadi client yang dideploy pasti Postgres. Setelah
> deploy, jalankan `npm run db:sqlite` untuk melanjutkan dev lokal.
>
> `lib/prisma.ts` memakai adapter Neon untuk URL non-`file:`; adapter libsql
> (SQLite) di-load dinamis dan **tidak** ikut dibundel ke Worker.

---

## 3. Buat R2 bucket (penyimpanan SK)

```bash
npx wrangler r2 bucket create sim-kgb-sk
```

Binding `SK_BUCKET` → `sim-kgb-sk` sudah didefinisikan di `wrangler.jsonc`.

---

## 4. Set secrets Worker (produksi)

```bash
npx wrangler secret put NEXTAUTH_SECRET     # openssl rand -base64 32
npx wrangler secret put DATABASE_URL        # Neon pooled URL (…-pooler…)
npx wrangler secret put DIRECT_URL          # Neon direct URL
npx wrangler secret put CRON_SECRET         # rahasia acak; melindungi endpoint cron
npx wrangler secret put NEXTAUTH_URL        # https://<domain-produksi>
```

`BLOB_READ_WRITE_TOKEN` **tidak diperlukan lagi** (sudah pindah ke R2).

Untuk preview lokal (`wrangler dev`/`preview`), salin `.dev.vars.example` → `.dev.vars`
dan isi nilainya (gitignored).

---

## 5. Deploy

```bash
npm run cf:deploy      # prisma generate → opennextjs-cloudflare build → deploy
```

Cek ukuran/bundel tanpa deploy: `npx wrangler deploy --dry-run`
(saat ini: **±673 KiB gzip**). Preview lokal: `npm run cf:preview`.

---

## 6. Cron (notifikasi harian)

- Jadwal `0 0 * * *` (07:00 WIB) terdaftar di `wrangler.jsonc` → `triggers.crons`.
- `worker-entry.js` menambahkan handler `scheduled` yang memanggil
  `/api/cron/notifikasi` secara internal (via self-reference binding) dengan header
  `Authorization: Bearer $CRON_SECRET`.
- Uji manual dari dashboard Cloudflare (Workers → Triggers → "Trigger scheduled event")
  atau tunggu jadwal.

---

## 7. Custom domain (opsional)

Cloudflare Dashboard → Worker `sim-kgb` → **Settings → Domains & Routes** → tambahkan
domain/route. Pastikan `NEXTAUTH_URL` menunjuk domain final.

---

## Catatan / gotcha

- **Middleware**: `proxy.ts` dihapus. OpenNext belum mendukung Node middleware
  (Next 16 memaksa proxy ke runtime Node, tak bisa Edge). Proteksi peran kini di
  layout server (`lib/authGuard.ts`) + tiap API route sudah cek `auth()` sendiri.
- **Type errors**: sudah bersih (tsc 0 error) — `next build` kini type-check penuh
  tanpa `ignoreBuildErrors`. Mayoritas perbaikan: hasil `.json()` di-cast `as any`
  karena `Request/Response.json()` global (undici) bertipe `unknown`. Bila ingin
  keamanan tipe lebih kuat, ganti `as any` dengan interface respons per-endpoint.
- **Dev lokal** tetap pakai SQLite: provider `sqlite` + `DATABASE_URL="file:dev.db"`
  di `.env`, jalankan `npm run dev`. `cf:build`/`cf:deploy` otomatis switch ke
  postgres; setelah deploy jalankan `npm run db:sqlite` untuk kembali ke dev.
- **Regenerate tipe binding** setelah mengubah `wrangler.jsonc`: `npm run cf:typegen`.
