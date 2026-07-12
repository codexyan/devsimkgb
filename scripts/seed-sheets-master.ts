import "dotenv/config";
import { sheets } from "../lib/sheets/tables";
import { newId } from "../lib/sheets/id";

/* ───────────────────────────────────────────────────────────────────────────
   Seed master data ke Google Sheets (opsional, idempotent):
     • KonfigurasiKanwil (id "default")  — placeholder, edit via halaman Pengaturan
     • HukdisJenis (PP 53/2010)          — daftar jenis hukuman disiplin
     • HukdisKonfigurasi                 — ambang notifikasi hukdis

   Jalankan: npx tsx scripts/seed-sheets-master.ts
   ─────────────────────────────────────────────────────────────────────────── */

const jenisHukdisList = [
  { kode: "teguran_lisan", label: "Teguran Lisan", kategori: "ringan", dasarHukum: "PP 53/2010 Pasal 7 ayat (1) huruf a", durasiHukdis: 0, berdampakKGB: false, durasiTunda: null, urutan: 1 },
  { kode: "teguran_tertulis", label: "Teguran Tertulis", kategori: "ringan", dasarHukum: "PP 53/2010 Pasal 7 ayat (1) huruf b", durasiHukdis: 0, berdampakKGB: false, durasiTunda: null, urutan: 2 },
  { kode: "pernyataan_tidak_puas", label: "Pernyataan Tidak Puas Secara Tertulis", kategori: "ringan", dasarHukum: "PP 53/2010 Pasal 7 ayat (1) huruf c", durasiHukdis: 0, berdampakKGB: false, durasiTunda: null, urutan: 3 },
  { kode: "penundaan_kgb", label: "Penundaan KGB Selama 1 Tahun", kategori: "sedang", dasarHukum: "PP 53/2010 Pasal 7 ayat (2) huruf a", durasiHukdis: 12, berdampakKGB: true, durasiTunda: 12, urutan: 4 },
  { kode: "penurunan_gaji_pokok", label: "Penurunan Gaji Pokok Selama 1 Tahun", kategori: "sedang", dasarHukum: "PP 53/2010 Pasal 7 ayat (2) huruf b", durasiHukdis: 12, berdampakKGB: false, durasiTunda: null, urutan: 5 },
  { kode: "penundaan_kenaikan_pangkat", label: "Penundaan Kenaikan Pangkat Selama 1 Tahun", kategori: "sedang", dasarHukum: "PP 53/2010 Pasal 7 ayat (2) huruf c", durasiHukdis: 12, berdampakKGB: false, durasiTunda: null, urutan: 6 },
  { kode: "penurunan_pangkat", label: "Penurunan Pangkat Setingkat Lebih Rendah Selama 1 Tahun", kategori: "berat", dasarHukum: "PP 53/2010 Pasal 7 ayat (3) huruf a", durasiHukdis: 12, berdampakKGB: false, durasiTunda: null, urutan: 7 },
  { kode: "pembebasan_jabatan", label: "Pembebasan dari Jabatan", kategori: "berat", dasarHukum: "PP 53/2010 Pasal 7 ayat (3) huruf b", durasiHukdis: 0, berdampakKGB: false, durasiTunda: null, urutan: 8 },
  { kode: "pemberhentian_dengan_hormat", label: "Pemberhentian dengan Hormat Tidak atas Permintaan Sendiri", kategori: "berat", dasarHukum: "PP 53/2010 Pasal 7 ayat (3) huruf c", durasiHukdis: 0, berdampakKGB: false, durasiTunda: null, urutan: 9 },
  { kode: "pemberhentian_tidak_hormat", label: "Pemberhentian Tidak dengan Hormat", kategori: "berat", dasarHukum: "PP 53/2010 Pasal 7 ayat (3) huruf d", durasiHukdis: 0, berdampakKGB: false, durasiTunda: null, urutan: 10 },
];

async function main() {
  // KonfigurasiKanwil default (placeholder).
  const kanwil = await sheets.konfigurasiKanwil.findUnique({ id: "default" });
  if (!kanwil) {
    await sheets.konfigurasiKanwil.create({
      id: "default", namaKepala: "MULYADI", nipKepala: "196801101990031002",
      nomorPP: "Nomor 5 Tahun 2024", tahunPP: "2024", waAdmin: "",
      notifKgbH1: 14, notifKgbH2: 7, sesiTimeoutMenit: 60, updatedAt: new Date(), updatedBy: null,
    } as any);
    console.log("+ KonfigurasiKanwil default dibuat");
  } else {
    console.log("= KonfigurasiKanwil default sudah ada");
  }

  // HukdisJenis.
  let created = 0;
  for (const j of jenisHukdisList) {
    const exist = await sheets.hukdisJenis.findUnique({ kode: j.kode });
    if (exist) continue;
    await sheets.hukdisJenis.create({
      id: newId(), kode: j.kode, label: j.label, kategori: j.kategori, dasarHukum: j.dasarHukum,
      regulasiId: null, durasiHukdis: j.durasiHukdis, berdampakKGB: j.berdampakKGB,
      durasiTunda: j.durasiTunda, aktif: true, urutan: j.urutan, updatedAt: new Date(), updatedBy: null,
    } as any);
    created++;
  }
  console.log(`+ HukdisJenis: ${created} dibuat, ${jenisHukdisList.length - created} sudah ada`);

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
