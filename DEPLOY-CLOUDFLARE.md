# Deploy SIM-KGB ke Cloudflare Workers

SIM-KGB dideploy ke **Cloudflare Workers** memakai [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare).
**Sumber data: Google Sheets** (via Google Sheets API + Service Account) — tidak ada database.
Berkas SK disimpan di **Cloudflare R2**. Notifikasi harian berjalan lewat **Cloudflare Cron Triggers**.

---

## 1. Prasyarat (sekali saja)

1. Akun Cloudflare (plan Free cukup — bundel worker ~0,7 MB gzip).
2. Login wrangler:
   ```bash
   npx wrangler login
   ```
3. **Google Sheets siap**: Service Account punya akses Editor ke spreadsheet, dan
   spreadsheet sudah berisi 14 tab (jalankan `npx tsx scripts/setup-sheets.ts`
   sekali untuk membuatnya). Akun admin sudah di-seed
   (`npx tsx scripts/seed-sheets-admin.ts`).

---

## 2. Buat R2 bucket (penyimpanan SK)

```bash
npx wrangler r2 bucket create sim-kgb-sk
```

Binding `SK_BUCKET` → `sim-kgb-sk` sudah didefinisikan di `wrangler.jsonc`.

---

## 3. Set secrets Worker (produksi)

```bash
npx wrangler secret put NEXTAUTH_SECRET               # openssl rand -base64 32
npx wrangler secret put NEXTAUTH_URL                  # https://<domain-produksi>
npx wrangler secret put CRON_SECRET                   # rahasia acak; melindungi endpoint cron
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL  # ...@<project>.iam.gserviceaccount.com
npx wrangler secret put GOOGLE_SHEET_ID               # ID dari URL spreadsheet
npx wrangler secret put GOOGLE_PRIVATE_KEY            # lihat catatan di bawah
```

> **GOOGLE_PRIVATE_KEY**: tempel nilai `private_key` dari file JSON dalam **satu baris**
> dengan escape `\n` (persis seperti di `.env`). Kode `lib/sheets/auth.ts` otomatis
> mengubah `\n` menjadi baris baru. Jangan tempel versi multi-baris ke prompt wrangler.

Untuk preview lokal (`wrangler dev`/`preview`), salin `.dev.vars.example` → `.dev.vars`
dan isi nilainya (gitignored).

---

## 4. Deploy

```bash
npm run cf:deploy      # opennextjs-cloudflare build → deploy
```

Cek bundel tanpa deploy: `npx wrangler deploy --dry-run`. Preview lokal (workerd):
`npm run cf:preview` (butuh `.dev.vars` terisi).

---

## 5. Cron (notifikasi harian)

- Jadwal `0 0 * * *` (07:00 WIB) terdaftar di `wrangler.jsonc` → `triggers.crons`.
- `worker-entry.js` menambahkan handler `scheduled` yang memanggil
  `/api/cron/notifikasi` secara internal (via self-reference binding) dengan header
  `Authorization: Bearer $CRON_SECRET`.
- Uji manual dari dashboard Cloudflare (Workers → Triggers → "Trigger scheduled event").

---

## 6. Custom domain (opsional)

Cloudflare Dashboard → Worker `sim-kgb` → **Settings → Domains & Routes** → tambahkan
domain/route. Pastikan `NEXTAUTH_URL` menunjuk domain final.

---

## Catatan / gotcha

- **Backend Google Sheets**: seluruh baca/tulis lewat Sheets API. Tanpa transaksi
  (operasi multi-tab tidak atomik), rawan bentrok bila banyak pengguna menulis
  bersamaan, dan agregasi dihitung di memori — cocok untuk skala kecil/menengah.
- **Auth service-account** memakai WebCrypto (kompatibel workerd) dan otomatis
  mengoreksi selisih jam bila token ditolak Google. Access token di-cache di memori.
- **R2** menyimpan berkas SK privat; hanya diakses server-side lewat binding
  `SK_BUCKET` (upload di `/api/kgb/[id]/upload-sk`, unduh di `/api/blob/download`).
- **Middleware**: proteksi peran ada di layout server (`lib/authGuard.ts`) + tiap
  API route cek `auth()` sendiri.
- **Regenerate tipe binding** setelah mengubah `wrangler.jsonc`: `npm run cf:typegen`.
