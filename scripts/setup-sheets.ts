import "dotenv/config";
import { ALL_DEFS } from "../lib/sheets/tables";
import { sinkronkanHeader } from "../lib/sheets/sinkronHeader";

/* ───────────────────────────────────────────────────────────────────────────
   Buat semua tab yang dibutuhkan di spreadsheet + isi baris header.

   Jalankan: npx tsx scripts/setup-sheets.ts
   Butuh service account punya akses EDITOR ke spreadsheet.

   Idempotent: tab yang sudah ada tidak dibuat ulang; header lama tidak ditimpa,
   hanya kolom baru di ujung kanan yang ditambahkan.
   ─────────────────────────────────────────────────────────────────────────── */

async function main() {
  for (const h of await sinkronkanHeader(ALL_DEFS, true)) {
    if (h.aksi === "buat_tab") console.log(`+ Tab dibuat   : ${h.tab}`);
    else if (h.aksi === "isi_header") console.log(`~ Header diisi : ${h.tab} (tab sudah ada, header kosong)`);
    else if (h.aksi === "tambah_kolom") console.log(`+ Kolom baru   : ${h.tab} → ${h.kolom.join(", ")}`);
    else if (h.aksi === "cocok") console.log(`= Tab ada      : ${h.tab}`);
    else console.log(`= Tab ada      : ${h.tab}  ⚠ header TIDAK cocok urutannya!`);
  }

  console.log("\n✓ Setup selesai.");
}

main().catch((e) => {
  console.error("✗ Gagal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
