// Pulihkan data SIM-KGB (ADR-084, ADR-085). Skrip ini tidak menyentuh basis data: ia meringkas isi cadangan atau menulis
// SQL, yang lalu dibaca dan dijalankan sendiri di Supabase SQL Editor atau konsol D1 (Cloudflare → D1 → sim-kgb →
// Console), atau dengan `npx wrangler d1 execute sim-kgb --remote --file <berkas.sql>`.
//
// Dari berkas cadangan otomatis (menu Cadangkan data Super Admin, atau R2 sim-kgb-sk/cadangan/otomatis/):
//   node --import tsx scripts/pulihkan-cadangan.ts <berkas.jsonl.gz>
//       Ringkasan: waktu cadangan dan jumlah baris per tabel.
//   node --import tsx scripts/pulihkan-cadangan.ts <berkas.jsonl.gz> --tabel usulan_pegawai --cari "martapura" --keluar pulihkan.sql
//       SQL untuk mengembalikan baris usulan_pegawai yang memuat teks "martapura". Baris yang id-nya masih ada dilewati.
//   Pilihan lain: --id <id1,id2>, --timpa (ganti isi baris yang sudah ada dengan isi cadangan), --dialek d1|postgres
//   (bawaannya mengikuti asal cadangan; cadangan Supabase dapat dikembalikan ke D1 dengan --dialek d1).
//
// Dari jejak perubahan D1 (90 hari terakhir), tanpa berkas cadangan:
//   node --import tsx scripts/pulihkan-cadangan.ts --jejak usulan_pegawai --dari "2026-10-08 13:00" --sampai "2026-10-08 14:00"
//       SQL untuk mengembalikan baris yang terhapus pada rentang itu (waktu WITA, atau ISO).
//   node --import tsx scripts/pulihkan-cadangan.ts --jejak-id 1234 --tabel pegawai
//       SQL untuk mengembalikan satu baris ke isi sebelum perubahan pada jejak 1234.

import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  bacaCadangan,
  saringBaris,
  sqlKembalikanBarisD1,
  sqlPulihkan,
  sqlPulihkanD1,
  sqlPulihkanJejakD1,
} from "../lib/pulihkanCadangan";

function pilihan(nama: string): string | undefined {
  const i = process.argv.indexOf(`--${nama}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function keluarkan(sql: string, keterangan: string) {
  const keluar = pilihan("keluar");
  if (keluar) {
    writeFileSync(keluar, sql);
    console.log(`${keterangan} → ${keluar}`);
  } else {
    process.stdout.write(sql);
  }
}

const jejak = pilihan("jejak");
const jejakId = pilihan("jejak-id");
if (jejak || jejakId) {
  if (jejakId) {
    const tabel = pilihan("tabel");
    if (!tabel) throw new Error("--jejak-id memerlukan --tabel");
    keluarkan(sqlKembalikanBarisD1(tabel, Number(jejakId)), `Kembalikan ${tabel} dari jejak ${jejakId}`);
  } else {
    const dari = pilihan("dari");
    const sampai = pilihan("sampai");
    if (!dari || !sampai) throw new Error("--jejak memerlukan --dari dan --sampai");
    keluarkan(sqlPulihkanJejakD1(jejak!, { dari, sampai }), `Baris ${jejak} yang terhapus`);
  }
  process.exit(0);
}

const berkas = process.argv[2];
if (!berkas || berkas.startsWith("--")) {
  console.error("Pakai: node --import tsx scripts/pulihkan-cadangan.ts <berkas.jsonl.gz> [--tabel nama] [--id a,b] [--cari teks] [--timpa] [--dialek d1|postgres] [--keluar berkas.sql]");
  console.error("   atau: --jejak <tabel> --dari <waktu> --sampai <waktu>   |   --jejak-id <n> --tabel <tabel>");
  process.exit(1);
}

const mentah = readFileSync(berkas);
const teks = (berkas.endsWith(".gz") ? gunzipSync(mentah) : mentah).toString("utf8");
const isi = bacaCadangan(teks);
const waktuWita = new Date(new Date(isi.kepala.dibuat).getTime() + 8 * 3600_000).toISOString().slice(0, 16).replace("T", " ");

console.error(`Cadangan ${isi.kepala.dibuat} (${waktuWita} WITA), bentuk ${isi.kepala.bentuk}.`);
if (!isi.utuh) console.error("PERINGATAN: cadangan ini tidak utuh (terputus saat disusun). Pakai cadangan lain bila ada.");

const tabel = pilihan("tabel");
if (!tabel) {
  for (const t of isi.kepala.tabel) console.log(`  ${t.padEnd(24)} ${String(isi.baris.get(t)?.length ?? 0).padStart(7)} baris`);
  process.exit(0);
}

if (isi.kepala.bentuk === "aplikasi") {
  console.error("Cadangan ini dari penyimpanan lokal; SQL tidak dapat disusun dari bentuk itu.");
  process.exit(1);
}
const dialek = pilihan("dialek") ?? (isi.kepala.bentuk === "d1" ? "d1" : "postgres");
if (dialek === "postgres" && isi.kepala.bentuk === "d1") {
  console.error("Cadangan D1 hanya dapat dikembalikan ke D1 (--dialek d1).");
  process.exit(1);
}
const semua = isi.baris.get(tabel);
if (!semua) {
  console.error(`Tabel ${tabel} tidak ada di cadangan. Tabel yang ada: ${isi.kepala.tabel.join(", ")}`);
  process.exit(1);
}
const dipilih = saringBaris(semua, { id: pilihan("id")?.split(",").map((s) => s.trim()), cari: pilihan("cari") });
if (tabel === "users") console.error("Catatan: sandi akun tidak ikut dicadangkan. Akun yang dikembalikan perlu diberi sandi baru.");

const timpa = process.argv.includes("--timpa");
const sql =
  dialek === "d1"
    ? `-- Dipulihkan dari cadangan SIM-KGB ${isi.kepala.dibuat} (${waktuWita} WITA) ke Cloudflare D1.\n${sqlPulihkanD1(tabel, dipilih, { timpa })}`
    : `-- Dipulihkan dari cadangan SIM-KGB ${isi.kepala.dibuat} (${waktuWita} WITA).\n` +
      `-- Periksa dulu isinya, lalu jalankan di Supabase SQL Editor.\nbegin;\n${sqlPulihkan(tabel, dipilih, { timpa })}commit;\n`;
keluarkan(sql, `${dipilih.length} baris ${tabel} (${dialek})`);
