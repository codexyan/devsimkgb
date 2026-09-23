import "dotenv/config";
import { sheets } from "../lib/sheets/tables";
import { newId } from "../lib/sheets/id";
import { JENIS_HUKDIS_PP94 } from "./jenis-hukdis-pp94";

/* ───────────────────────────────────────────────────────────────────────────
   Seed master data ke Google Sheets (opsional, idempotent):
     • KonfigurasiKanwil (id "default"):  dasar hukum, notifikasi, sesi; edit via Pengaturan
     • HukdisJenis (PP 94/2021):          daftar jenis hukuman disiplin
     • HukdisKonfigurasi:                 ambang notifikasi hukdis
   Penandatangan surat KGB diisi lewat halaman Pengaturan.

   Jalankan: npx tsx scripts/seed-sheets-master.ts
   ─────────────────────────────────────────────────────────────────────────── */

async function main() {
  // KonfigurasiKanwil default.
  const kanwil = await sheets.konfigurasiKanwil.findUnique({ id: "default" });
  if (!kanwil) {
    await sheets.konfigurasiKanwil.create({
      id: "default", namaKepala: "", nipKepala: "",
      nomorPP: "Nomor 5 Tahun 2024", tahunPP: "2024", waAdmin: "",
      notifKgbH1: 14, notifKgbH2: 7, sesiTimeoutMenit: 60, updatedAt: new Date(), updatedBy: null,
    } as any);
    console.log("+ KonfigurasiKanwil default dibuat");
  } else {
    console.log("= KonfigurasiKanwil default sudah ada");
  }

  // HukdisJenis.
  let created = 0;
  for (const j of JENIS_HUKDIS_PP94) {
    const exist = await sheets.hukdisJenis.findUnique({ kode: j.kode });
    if (exist) continue;
    await sheets.hukdisJenis.create({
      id: newId(), ...j, regulasiId: null, berdampakKGB: false, durasiTunda: null,
      aktif: true, updatedAt: new Date(), updatedBy: null,
    } as any);
    created++;
  }
  console.log(`+ HukdisJenis: ${created} dibuat, ${JENIS_HUKDIS_PP94.length - created} sudah ada`);

  // HukdisKonfigurasi.
  const konf = (await sheets.hukdisKonfigurasi.findMany()) as any[];
  if (konf.length === 0) {
    await sheets.hukdisKonfigurasi.create({
      id: newId(), notifHariH1: 30, notifHariH2: 14, updatedAt: new Date(), updatedBy: null,
    } as any);
    console.log("+ HukdisKonfigurasi default dibuat");
  } else {
    console.log("= HukdisKonfigurasi sudah ada");
  }

  console.log("\n✓ Seed master selesai.");
}

main().catch((e) => { console.error("✗ Gagal:", e instanceof Error ? e.message : e); process.exit(1); });
