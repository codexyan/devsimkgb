import "dotenv/config";
import { listSheetTitles, addSheetTab, getValues, updateValues } from "../lib/sheets/client";
import { ALL_DEFS } from "../lib/sheets/tables";

/* ───────────────────────────────────────────────────────────────────────────
   Buat semua tab yang dibutuhkan di spreadsheet + isi baris header.

   Jalankan: npx tsx scripts/setup-sheets.ts
   Butuh service account punya akses EDITOR ke spreadsheet.

   Idempotent: tab yang sudah ada tidak dibuat ulang; header hanya ditulis bila
   baris pertama masih kosong (tidak menimpa header yang sudah ada).
   ─────────────────────────────────────────────────────────────────────────── */

async function main() {
  const existing = new Set(await listSheetTitles());

  for (const def of ALL_DEFS) {
    const header = def.columns.map((c) => c.name);

    if (!existing.has(def.tab)) {
      await addSheetTab(def.tab);
      await updateValues(`${def.tab}!A1`, [header]);
      console.log(`+ Tab dibuat  : ${def.tab} (${header.length} kolom)`);
      continue;
    }

    const firstRow = (await getValues(`${def.tab}!1:1`))[0] ?? [];
    if (firstRow.length === 0) {
      await updateValues(`${def.tab}!A1`, [header]);
      console.log(`~ Header diisi : ${def.tab} (tab sudah ada, header kosong)`);
    } else {
      const ok = header.every((name, idx) => firstRow[idx] === name);
      console.log(`= Tab ada     : ${def.tab}${ok ? "" : "  ⚠ header TIDAK cocok urutannya!"}`);
    }
  }

  console.log("\n✓ Setup selesai.");
}

main().catch((e) => {
  console.error("✗ Gagal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
