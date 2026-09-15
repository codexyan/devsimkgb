import "dotenv/config";
import type { SupabaseTable } from "../lib/db/supabase/table";
import { supabase } from "../lib/db/supabase/tables";
import type { Table, TableDef } from "../lib/sheets/table";
import { defs, sheets } from "../lib/sheets/tables";
import { JENIS_HUKDIS_PP94, KODE_HUKDIS_PP53_SAJA } from "./jenis-hukdis-pp94";

/* ───────────────────────────────────────────────────────────────────────────
   Salin seluruh data Google Sheets ke Supabase, sekaligus menerapkan perubahan Tahap 1:
   penandatangan definitif dari KonfigurasiKanwil dan jenis hukdis PP 94/2021.

   Periksa saja (tidak menulis)   : npx tsx scripts/salin-sheets-ke-supabase.ts
   Salin ke Supabase yang kosong  : npx tsx scripts/salin-sheets-ke-supabase.ts --terapkan
   Salin ulang, hapus isi dulu    : npx tsx scripts/salin-sheets-ke-supabase.ts --terapkan --kosongkan-dulu

   Spreadsheet hanya dibaca. Mode terapkan berhenti bila pemeriksaan menemukan masalah atau
   tabel tujuan sudah berisi data (kecuali --kosongkan-dulu), lalu mencocokkan setiap baris
   hasil salinan dengan data sumber.
   ─────────────────────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;
type Kunci = keyof typeof sheets;

const terapkan = process.argv.includes("--terapkan");
const kosongkanDulu = process.argv.includes("--kosongkan-dulu");
const WAKTU = new Date();
const OLEH = "salin-sheets-ke-supabase";
// Kepmen delegasi ditetapkan 6 Januari 2025; sama dengan scripts/migrasi-tahap1.ts.
const BERLAKU_AWAL = new Date("2025-01-06");

const DEF: Record<Kunci, TableDef> = {
  user: defs.User,
  profileChangeRequest: defs.ProfileChangeRequest,
  pegawai: defs.Pegawai,
  riwayatKGB: defs.RiwayatKGB,
  suratKGB: defs.SuratKGB,
  serahTerima: defs.SerahTerima,
  konfigurasiKanwil: defs.KonfigurasiKanwil,
  penandatangan: defs.Penandatangan,
  notifikasi: defs.Notifikasi,
  riwayatHukdis: defs.RiwayatHukdis,
  hukdisJenis: defs.HukdisJenis,
  hukdisKonfigurasi: defs.HukdisKonfigurasi,
  regulasi: defs.Regulasi,
  auditLog: defs.AuditLog,
  rekonBulanan: defs.RekonBulanan,
};

/** Urutan tulis: tabel induk lebih dulu. Urutan hapus kebalikannya. */
const URUTAN_TULIS: Kunci[] = [
  "user", "regulasi", "hukdisJenis", "hukdisKonfigurasi", "konfigurasiKanwil", "penandatangan",
  "pegawai", "riwayatKGB", "suratKGB", "serahTerima", "riwayatHukdis", "profileChangeRequest",
  "notifikasi", "auditLog", "rekonBulanan",
];

/** Kolom NOT NULL di migrasi SQL (selain id). */
const WAJIB: Partial<Record<Kunci, string[]>> = {
  user: ["nip", "password", "role"],
  profileChangeRequest: ["userId", "status"],
  pegawai: ["nip", "nama"],
  riwayatKGB: ["pegawaiId", "status"],
  penandatangan: ["jenis", "nama", "nip", "jabatan", "berlakuMulai"],
  suratKGB: ["kgbId"],
  serahTerima: ["kgbId"],
  rekonBulanan: ["bulanTmt"],
  hukdisJenis: ["kode"],
  riwayatHukdis: ["pegawaiId"],
};

/** Kolom unique di migrasi SQL (selain id). */
const UNIK: Partial<Record<Kunci, string[]>> = {
  user: ["nip"],
  pegawai: ["nip"],
  suratKGB: ["kgbId"],
  hukdisJenis: ["kode"],
  rekonBulanan: ["bulanTmt"],
};

/** Foreign key di migrasi SQL. */
const RUJUKAN: { dari: Kunci; kolom: string; ke: Kunci }[] = [
  { dari: "profileChangeRequest", kolom: "userId", ke: "user" },
  { dari: "riwayatKGB", kolom: "pegawaiId", ke: "pegawai" },
  { dari: "suratKGB", kolom: "kgbId", ke: "riwayatKGB" },
  { dari: "suratKGB", kolom: "penandatanganId", ke: "penandatangan" },
  { dari: "serahTerima", kolom: "kgbId", ke: "riwayatKGB" },
  { dari: "riwayatHukdis", kolom: "pegawaiId", ke: "pegawai" },
  { dari: "hukdisJenis", kolom: "regulasiId", ke: "regulasi" },
  { dari: "regulasi", kolom: "digantikanOlehId", ke: "regulasi" },
];

const sumber = (kunci: Kunci) => sheets[kunci] as unknown as Table<Row>;
const tujuan = (kunci: Kunci) => supabase[kunci] as unknown as SupabaseTable<Row>;

const data = {} as Record<Kunci, Row[]>;
const catatan: string[] = [];
const perubahan: string[] = [];
const masalah: { tabel: string; jenis: string; id: unknown }[] = [];

function catatMasalah(kunci: Kunci, jenis: string, id: unknown) {
  masalah.push({ tabel: DEF[kunci].tab, jenis, id });
}

async function bacaSpreadsheet() {
  for (const kunci of URUTAN_TULIS) {
    try {
      data[kunci] = await sumber(kunci).findMany();
    } catch (e) {
      if (!(e instanceof Error && e.message.includes("Unable to parse range"))) throw e;
      data[kunci] = [];
      catatan.push(`Tab ${DEF[kunci].tab} belum ada di spreadsheet, dianggap kosong.`);
    }
  }
}

/** Perubahan yang semestinya dilakukan scripts/migrasi-tahap1.ts, diterapkan pada salinan di memori. */
function terapkanTahap1() {
  if (data.penandatangan.length === 0) {
    const konfig = data.konfigurasiKanwil.find((k) => k.id === "default");
    const nama = typeof konfig?.namaKepala === "string" ? konfig.namaKepala.trim() : "";
    const nip = String(konfig?.nipKepala ?? "").replace(/\s/g, "");
    if (nama && nip) {
      data.penandatangan.push({
        // id tetap agar salinan ulang tidak menambah penandatangan ganda.
        id: `migrasi-definitif-${nip}`,
        jenis: "definitif",
        nama,
        nip,
        jabatan: "Kepala Kantor Wilayah",
        dasarPenunjukan: null,
        berlakuMulai: BERLAKU_AWAL,
        berlakuSampai: null,
        updatedAt: WAKTU,
        updatedBy: OLEH,
      });
      perubahan.push(`Penandatangan definitif ${nama} (${nip}) ditambahkan, berlaku mulai 6 Januari 2025.`);
    } else {
      perubahan.push("KonfigurasiKanwil tidak berisi Kepala Kanwil; penandatangan diisi lewat Pengaturan setelah migrasi.");
    }
  }

  const byKode = new Map(data.hukdisJenis.map((j) => [String(j.kode), j] as const));
  let urutan = Math.max(0, ...data.hukdisJenis.map((j) => Number(j.urutan) || 0));
  for (const kode of KODE_HUKDIS_PP53_SAJA) {
    const jenis = byKode.get(kode);
    if (!jenis?.aktif) continue;
    Object.assign(jenis, { aktif: false, updatedAt: WAKTU, updatedBy: OLEH });
    perubahan.push(`Jenis hukdis ${kode} dinonaktifkan.`);
  }
  for (const seed of JENIS_HUKDIS_PP94) {
    const jenis = byKode.get(seed.kode);
    if (!jenis) {
      urutan += 1;
      data.hukdisJenis.push({
        ...seed,
        id: `pp94-${seed.kode}`,
        urutan,
        regulasiId: null,
        berdampakKGB: false,
        durasiTunda: null,
        aktif: true,
        updatedAt: WAKTU,
        updatedBy: OLEH,
      });
      perubahan.push(`Jenis hukdis ${seed.kode} ditambahkan.`);
    } else if (jenis.dasarHukum !== seed.dasarHukum) {
      Object.assign(jenis, { dasarHukum: seed.dasarHukum, regulasiId: null, updatedAt: WAKTU, updatedBy: OLEH });
      perubahan.push(`Dasar hukum ${seed.kode} diganti menjadi ${seed.dasarHukum}.`);
    }
  }
}

/** Cari baris yang akan ditolak Postgres (NOT NULL, unique, foreign key, check) atau kehilangan nilai. */
function periksa() {
  for (const kunci of URUTAN_TULIS) {
    const idTerlihat = new Set<string>();
    for (const baris of data[kunci]) {
      const id = baris.id;
      if (typeof id !== "string" || id === "") catatMasalah(kunci, "id kosong", id);
      else if (idTerlihat.has(id)) catatMasalah(kunci, "id ganda", id);
      else idTerlihat.add(id);

      for (const kolom of WAJIB[kunci] ?? []) {
        const nilai = baris[kolom];
        if (nilai === null || nilai === undefined || nilai === "") catatMasalah(kunci, `${kolom} kosong`, id);
      }
      for (const col of DEF[kunci].columns) {
        const nilai = baris[col.name];
        if (col.type === "datetime" && nilai instanceof Date && Number.isNaN(nilai.getTime())) {
          catatMasalah(kunci, `${col.name} bukan tanggal yang valid`, id);
        }
        if ((col.type === "int" || col.type === "float") && typeof nilai === "number" && Number.isNaN(nilai)) {
          catatMasalah(kunci, `${col.name} bukan angka`, id);
        }
      }
    }
    for (const kolom of UNIK[kunci] ?? []) {
      const terlihat = new Set<unknown>();
      for (const baris of data[kunci]) {
        const nilai = baris[kolom];
        if (nilai === null || nilai === undefined) continue;
        if (terlihat.has(nilai)) catatMasalah(kunci, `${kolom} ganda (${String(nilai)})`, baris.id);
        else terlihat.add(nilai);
      }
    }
  }

  for (const { dari, kolom, ke } of RUJUKAN) {
    const ada = new Set(data[ke].map((baris) => baris.id));
    for (const baris of data[dari]) {
      const nilai = baris[kolom];
      if (nilai !== null && nilai !== undefined && !ada.has(nilai)) {
        catatMasalah(dari, `${kolom} merujuk ke ${DEF[ke].tab} yang tidak ada`, baris.id);
      }
    }
  }

  for (const baris of data.penandatangan) {
    if (!["definitif", "plh", "plt", "dirjen"].includes(String(baris.jenis))) {
      catatMasalah("penandatangan", "jenis tidak dikenal", baris.id);
    }
    const { berlakuMulai: mulai, berlakuSampai: sampai } = baris;
    if (mulai instanceof Date && sampai instanceof Date && sampai < mulai) {
      catatMasalah("penandatangan", "berlakuSampai sebelum berlakuMulai", baris.id);
    }
  }
}

function laporkan() {
  console.log("Jumlah baris per tab:");
  for (const kunci of URUTAN_TULIS) {
    console.log(`  ${DEF[kunci].tab.padEnd(22)} ${String(data[kunci].length).padStart(5)}  → ${tujuan(kunci).tabel}`);
  }
  if (catatan.length) {
    console.log("\nCatatan:");
    for (const c of catatan) console.log(`  • ${c}`);
  }
  if (perubahan.length) {
    console.log("\nPerubahan Tahap 1 yang ikut disalin:");
    for (const p of perubahan) console.log(`  • ${p}`);
  }
  if (masalah.length === 0) {
    console.log("\n✓ Tidak ada masalah data.");
    return;
  }
  console.log(`\n✗ Ditemukan ${masalah.length} masalah data:`);
  const kelompok = new Map<string, unknown[]>();
  for (const m of masalah) {
    const kunci = `${m.tabel}: ${m.jenis}`;
    kelompok.set(kunci, [...(kelompok.get(kunci) ?? []), m.id]);
  }
  for (const [kunci, ids] of kelompok) {
    console.log(`  • ${kunci} — ${ids.length} baris (contoh id: ${ids.slice(0, 5).map(String).join(", ")})`);
  }
}

/** Pastikan skema sudah ada dan tabel tujuan kosong, atau kosongkan bila diminta. */
async function siapkanTujuan() {
  const berisi: string[] = [];
  for (const kunci of URUTAN_TULIS) {
    let jumlah: number;
    try {
      jumlah = await tujuan(kunci).count();
    } catch (e) {
      const pesan = e instanceof Error ? e.message : String(e);
      throw new Error(`Tabel ${tujuan(kunci).tabel} tidak bisa dibaca. Sudahkah migrasi skema diterapkan? (${pesan})`);
    }
    if (jumlah > 0) berisi.push(`${tujuan(kunci).tabel} (${jumlah})`);
  }
  if (berisi.length === 0) return;
  if (!kosongkanDulu) {
    throw new Error(`Tabel tujuan sudah berisi data: ${berisi.join(", ")}. Tambahkan --kosongkan-dulu untuk menghapusnya sebelum menyalin.`);
  }
  for (const kunci of [...URUTAN_TULIS].reverse()) {
    const jumlah = await tujuan(kunci).deleteMany({});
    if (jumlah > 0) console.log(`- ${tujuan(kunci).tabel}: ${jumlah} baris dihapus`);
  }
}

async function tulis() {
  for (const kunci of URUTAN_TULIS) {
    // Rujukan antarregulasi diisi setelah semua baris regulasi ada.
    const baris = kunci === "regulasi" ? data.regulasi.map((r) => ({ ...r, digantikanOlehId: null })) : data[kunci];
    await tujuan(kunci).upsertMany(baris);
    console.log(`+ ${tujuan(kunci).tabel}: ${baris.length} baris`);
  }
  for (const r of data.regulasi.filter((r) => r.digantikanOlehId)) {
    await tujuan("regulasi").update({ id: r.id }, { digantikanOlehId: r.digantikanOlehId });
  }
}

const tampil = (v: unknown) => (v instanceof Date ? v.toISOString() : JSON.stringify(v));

function samaNilai(a: unknown, b: unknown): boolean {
  const normal = (v: unknown) =>
    v instanceof Date ? (Number.isNaN(v.getTime()) ? null : v.toISOString()) : v === undefined || v === "" ? null : v;
  return normal(a) === normal(b);
}

/** Baca ulang semua tabel dari Supabase dan bandingkan setiap kolom dengan data sumber. */
async function cocokkan(): Promise<boolean> {
  let semuaCocok = true;
  for (const kunci of URUTAN_TULIS) {
    const asal = data[kunci];
    const hasil = await tujuan(kunci).findMany();
    const byId = new Map(hasil.map((r) => [r.id, r] as const));
    const beda: string[] = [];
    if (hasil.length !== asal.length) beda.push(`jumlah ${hasil.length}, seharusnya ${asal.length}`);
    for (const s of asal) {
      const t = byId.get(s.id);
      if (!t) {
        beda.push(`id ${String(s.id)} tidak ada`);
        continue;
      }
      for (const col of DEF[kunci].columns) {
        // Kolom yang tidak diisi sumber memakai default Postgres.
        if (!Object.prototype.hasOwnProperty.call(s, col.name)) continue;
        if (!samaNilai(s[col.name], t[col.name])) {
          beda.push(`${String(s.id)}.${col.name}: ${tampil(s[col.name])} ≠ ${tampil(t[col.name])}`);
        }
      }
    }
    const urutanSama = hasil.length === asal.length && hasil.every((r, i) => r.id === asal[i].id);
    if (beda.length === 0 && urutanSama) {
      console.log(`= ${tujuan(kunci).tabel}: ${hasil.length} baris cocok`);
      continue;
    }
    semuaCocok = false;
    console.log(`✗ ${tujuan(kunci).tabel}: ${beda.length} perbedaan${urutanSama ? "" : ", urutan baris berbeda"}`);
    for (const b of beda.slice(0, 5)) console.log(`    ${b}`);
  }
  return semuaCocok;
}

async function main() {
  if ([...URUTAN_TULIS].sort().join() !== Object.keys(sheets).sort().join()) {
    throw new Error("URUTAN_TULIS tidak mencakup semua tabel.");
  }
  console.log(
    terapkan
      ? "Mode TERAPKAN: data ditulis ke Supabase.\n"
      : "Mode PERIKSA: spreadsheet hanya dibaca, Supabase tidak disentuh. Tambahkan --terapkan untuk menyalin.\n",
  );
  if (kosongkanDulu && !terapkan) console.log("--kosongkan-dulu diabaikan tanpa --terapkan.\n");

  await bacaSpreadsheet();
  terapkanTahap1();
  periksa();
  laporkan();

  if (!terapkan) {
    console.log(masalah.length ? "\nPerbaiki masalah di atas sebelum menyalin." : "\n✓ Siap disalin dengan --terapkan.");
    return;
  }
  if (masalah.length) throw new Error("Salinan dibatalkan karena masih ada masalah data.");

  console.log("");
  await siapkanTujuan();
  await tulis();
  console.log("\nMencocokkan hasil salinan dengan data sumber:");
  if (!(await cocokkan())) throw new Error("Hasil salinan tidak sama dengan data sumber; periksa perbedaan di atas.");
  console.log("\n✓ Semua data tersalin dan cocok.");
}

main().catch((e) => {
  console.error("\n✗ Gagal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
