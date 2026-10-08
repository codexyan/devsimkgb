// Pulihkan data dari cadangan otomatis SIM-KGB (ADR-084).
//
// Berkas cadangan diunduh dari menu Cadangkan data (Super Admin), atau dari Cloudflare: R2 → sim-kgb-sk →
// cadangan/otomatis/. Skrip ini tidak menyentuh basis data. Ia hanya meringkas isi cadangan atau menulis SQL, yang
// lalu dibaca dan dijalankan sendiri di Supabase SQL Editor.
//
//   node --import tsx scripts/pulihkan-cadangan.ts <berkas.jsonl.gz>
//       Ringkasan: waktu cadangan dan jumlah baris per tabel.
//   node --import tsx scripts/pulihkan-cadangan.ts <berkas.jsonl.gz> --tabel usulan_pegawai --cari "martapura" --keluar pulihkan.sql
//       SQL untuk mengembalikan baris usulan_pegawai yang memuat teks "martapura". Baris yang id-nya masih ada
//       dilewati, jadi aman dijalankan untuk mengembalikan yang terhapus saja.
//
// Pilihan lain: --id <id1,id2> (baris tertentu), --timpa (ganti isi baris yang sudah ada dengan isi cadangan;
// periksa dulu, karena perubahan sesudah waktu cadangan ikut tertimpa).

import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { bacaCadangan, saringBaris, sqlPulihkan } from "../lib/pulihkanCadangan";

function pilihan(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const berkas = process.argv[2];
if (!berkas || berkas.startsWith("--")) {
  console.error("Pakai: node --import tsx scripts/pulihkan-cadangan.ts <berkas.jsonl.gz> [--tabel nama] [--id a,b] [--cari teks] [--timpa] [--keluar berkas.sql]");
  process.exit(1);
}

const mentah = readFileSync(berkas);
const teks = (berkas.endsWith(".gz") ? gunzipSync(mentah) : mentah).toString("utf8");
const isi = bacaCadangan(teks);
const waktuWita = new Date(new Date(isi.kepala.dibuat).getTime() + 8 * 3600_000).toISOString().slice(0, 16).replace("T", " ");

console.log(`Cadangan ${isi.kepala.dibuat} (${waktuWita} WITA), bentuk ${isi.kepala.bentuk}.`);
if (!isi.utuh) console.warn("PERINGATAN: cadangan ini tidak utuh (terputus saat disusun). Pakai cadangan lain bila ada.");

const tabel = pilihan("tabel");
if (!tabel) {
  for (const t of isi.kepala.tabel) console.log(`  ${t.padEnd(24)} ${String(isi.baris.get(t)?.length ?? 0).padStart(7)} baris`);
  process.exit(0);
}

if (isi.kepala.bentuk !== "postgres") {
  console.error("Cadangan ini dari penyimpanan lokal (bukan Supabase); SQL tidak dapat disusun dari bentuk itu.");
  process.exit(1);
}
const semua = isi.baris.get(tabel);
if (!semua) {
  console.error(`Tabel ${tabel} tidak ada di cadangan. Tabel yang ada: ${isi.kepala.tabel.join(", ")}`);
  process.exit(1);
}
const dipilih = saringBaris(semua, { id: pilihan("id")?.split(",").map((s) => s.trim()), cari: pilihan("cari") });
if (tabel === "users") console.warn("Catatan: sandi akun tidak ikut dicadangkan. Akun yang dikembalikan perlu diberi sandi baru.");

const sql =
  `-- Dipulihkan dari cadangan SIM-KGB ${isi.kepala.dibuat} (${waktuWita} WITA).\n` +
  `-- Periksa dulu isinya, lalu jalankan di Supabase SQL Editor.\n` +
  `begin;\n${sqlPulihkan(tabel, dipilih, { timpa: process.argv.includes("--timpa") })}commit;\n`;
const keluar = pilihan("keluar");
if (keluar) {
  writeFileSync(keluar, sql);
  console.log(`${dipilih.length} baris ${tabel} → ${keluar}`);
} else {
  process.stdout.write(sql);
}
