// Membaca berkas cadangan otomatis (lib/cadanganOtomatis.ts) dan menyusun SQL untuk mengembalikan sebagian barisnya
// (ADR-084): ke Cloudflare D1 (SQLite, ADR-085) atau ke Postgres (jalur untuk cadangan semasa Supabase). Dipakai
// scripts/pulihkan-cadangan.ts; SQL-nya dijalankan sendiri oleh pemilik di konsol D1 atau SQL Editor Postgres, jadi
// tidak ada yang berubah tanpa dibaca lebih dulu.

import { barisKeD1 } from "./db/d1/barisMentah";
import { SKEMA_D1 } from "./db/d1/skema";

type Baris = Record<string, unknown>;

export interface KepalaCadangan {
  aplikasi: string;
  versi: number;
  bentuk: "postgres" | "d1" | "aplikasi";
  dibuat: string;
  tabel: string[];
}

export interface IsiCadangan {
  kepala: KepalaCadangan;
  baris: Map<string, Baris[]>;
  /** true bila baris penutup ada dan jumlahnya cocok; cadangan yang terputus tidak utuh. */
  utuh: boolean;
}

export function bacaCadangan(teks: string): IsiCadangan {
  const baris = new Map<string, Baris[]>();
  let kepala: KepalaCadangan | null = null;
  let penutup: { jumlah: Record<string, number> } | null = null;
  for (const satu of teks.split("\n")) {
    if (!satu.trim()) continue;
    const isi = JSON.parse(satu) as { jenis?: string; t?: string; r?: Baris } & Partial<KepalaCadangan> & { jumlah?: Record<string, number> };
    if (isi.jenis === "kepala") kepala = isi as KepalaCadangan;
    else if (isi.jenis === "akhir") penutup = { jumlah: isi.jumlah ?? {} };
    else if (isi.t && isi.r) {
      const daftar = baris.get(isi.t) ?? [];
      daftar.push(isi.r);
      baris.set(isi.t, daftar);
    }
  }
  if (!kepala || kepala.aplikasi !== "SIM-KGB") throw new Error("Bukan berkas cadangan otomatis SIM-KGB");
  const utuh =
    penutup !== null && Object.entries(penutup.jumlah).every(([t, n]) => (baris.get(t)?.length ?? 0) === n);
  return { kepala, baris, utuh };
}

/** Baris yang id-nya disebut, dan/atau yang memuat teks tertentu di salah satu nilainya (tanpa beda huruf besar). */
export function saringBaris(daftar: readonly Baris[], saring: { id?: readonly string[]; cari?: string }): Baris[] {
  const id = saring.id?.length ? new Set(saring.id) : null;
  const cari = saring.cari?.trim().toLowerCase() || null;
  return daftar.filter(
    (b) =>
      (!id || id.has(String(b.id))) &&
      (!cari || Object.values(b).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(cari))),
  );
}

/** Kolom yang tidak ditimpa saat baris sudah ada: kuncinya, dan urutan baris dimasukkan. */
const KOLOM_TETAP = new Set(["id", "urutan_sisip"]);

/**
 * SQL pengembalian baris ke satu tabel. Baris dibentuk ulang oleh Postgres dari JSON (jsonb_populate_recordset),
 * sehingga jenis kolom mengikuti tabelnya. Bawaannya baris yang id-nya sudah ada dilewati; dengan `timpa`, isinya
 * diganti isi cadangan. Urutan baris dimasukkan (urutan_sisip) dipertahankan.
 */
export function sqlPulihkan(tabel: string, daftar: readonly Baris[], opsi: { timpa?: boolean } = {}): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(tabel)) throw new Error(`Nama tabel tidak sah: ${tabel}`);
  if (daftar.length === 0) return `-- public.${tabel}: tidak ada baris yang cocok.\n`;
  const json = JSON.stringify(daftar);
  let tanda = "cadangan";
  while (json.includes(`$${tanda}$`)) tanda += "_";
  const kolom = [...new Set(daftar.flatMap((b) => Object.keys(b)))].filter((k) => !KOLOM_TETAP.has(k));
  for (const k of kolom) if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error(`Nama kolom tidak sah: ${k}`);
  const konflik = opsi.timpa
    ? `on conflict (id) do update set\n  ${kolom.map((k) => `${k} = excluded.${k}`).join(",\n  ")}`
    : "on conflict (id) do nothing";
  // Penghitung urutan baris dimasukkan dimajukan melewati baris yang dikembalikan, supaya baris baru sesudahnya tetap
  // berada di urutan paling akhir walau tabelnya dipulihkan dari kosong. Tidak pernah dimundurkan.
  const urutan = daftar.some((b) => "urutan_sisip" in b)
    ? `select setval(pg_get_serial_sequence('public.${tabel}', 'urutan_sisip'), greatest(\n` +
      `  (select coalesce(max(urutan_sisip), 1) from public.${tabel}),\n` +
      `  (select coalesce(s.last_value, 1) from pg_sequences s\n` +
      `   where format('%I.%I', s.schemaname, s.sequencename) = pg_get_serial_sequence('public.${tabel}', 'urutan_sisip'))));\n`
    : "";
  return (
    `-- ${daftar.length} baris public.${tabel}${opsi.timpa ? " (menimpa baris yang sudah ada)" : " (baris yang sudah ada dilewati)"}\n` +
    `insert into public.${tabel} overriding system value\n` +
    `select * from jsonb_populate_recordset(null::public.${tabel}, $${tanda}$${json}$${tanda}$::jsonb)\n` +
    `${konflik};\n` +
    urutan
  );
}

// ── Cloudflare D1 (SQLite) ─────────────────────────────────────────────────────────────────────────────────────

/** Panjang JSON per pernyataan; konsol dan API D1 membatasi satu pernyataan 100 KB. */
const UKURAN_JSON_D1 = 80_000;
const namaSah = (x: string) => /^[a-z_][a-z0-9_]*$/.test(x);

function kolomD1(tabel: string): string[] {
  if (!namaSah(tabel) || !SKEMA_D1[tabel]) throw new Error(`Tabel ${tabel} tidak ada di skema D1`);
  return Object.keys(SKEMA_D1[tabel]);
}

/**
 * Ekspresi nilai tiap kolom dari sebuah objek JSON. Urutan baris dimasukkan (urutan_sisip, kunci utama D1) dipakai
 * bila belum terpakai baris lain; bila sudah, baris yang dikembalikan diberi nomor baru di ujung.
 */
function ekspresiKolom(tabel: string, kolom: string[], sumber: string): string[] {
  return kolom.map((k) =>
    k === "urutan_sisip"
      ? `CASE WHEN EXISTS (SELECT 1 FROM ${tabel} WHERE urutan_sisip = json_extract(${sumber}, '$.urutan_sisip')) ` +
        `THEN NULL ELSE json_extract(${sumber}, '$.urutan_sisip') END`
      : `json_extract(${sumber}, '$.${k}')`,
  );
}

function konflikD1(kolom: string[], timpa: boolean): string {
  if (!timpa) return "";
  const diubah = kolom.filter((k) => k !== "id" && k !== "urutan_sisip");
  return ` WHERE true ON CONFLICT(id) DO UPDATE SET ${diubah.map((k) => `${k} = excluded.${k}`).join(", ")}`;
}

/**
 * SQL D1 untuk mengembalikan baris cadangan (bentuk Postgres maupun D1) ke satu tabel. Barisnya diubah ke bentuk kolom
 * D1, lalu dikirim sebagai JSON yang dibongkar json_each, dipotong per 80 KB. Bawaannya baris yang id-nya sudah ada
 * dilewati; dengan `timpa`, isinya diganti isi cadangan.
 */
export function sqlPulihkanD1(tabel: string, daftar: readonly Baris[], opsi: { timpa?: boolean } = {}): string {
  const semuaKolom = kolomD1(tabel);
  if (daftar.length === 0) return `-- ${tabel}: tidak ada baris yang cocok.\n`;
  const baris = daftar.map((b) => barisKeD1(tabel, b));
  const kolom = semuaKolom.filter((k) => baris.some((b) => k in b));
  const potongan: Baris[][] = [];
  let kini: Baris[] = [];
  let ukuran = 0;
  for (const b of baris) {
    const u = JSON.stringify(b).length;
    if (kini.length > 0 && ukuran + u > UKURAN_JSON_D1) {
      potongan.push(kini);
      kini = [];
      ukuran = 0;
    }
    kini.push(b);
    ukuran += u;
  }
  potongan.push(kini);
  const isi = potongan.map(
    (p) =>
      `INSERT ${opsi.timpa ? "" : "OR IGNORE "}INTO ${tabel} (${kolom.join(", ")})\n` +
      `SELECT ${ekspresiKolom(tabel, kolom, "value").join(", ")}\n` +
      `FROM json_each('${JSON.stringify(p).replace(/'/g, "''")}')${konflikD1(kolom, !!opsi.timpa)};\n`,
  );
  return `-- ${baris.length} baris ${tabel}${opsi.timpa ? " (menimpa baris yang sudah ada)" : " (baris yang sudah ada dilewati)"}\n${isi.join("")}`;
}

/** Waktu untuk filter jejak: ISO apa adanya, atau "YYYY-MM-DD HH:MM" waktu WITA. */
export function waktuJejak(teks: string): string {
  const wita = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/.exec(teks.trim());
  const t = wita ? new Date(`${wita[1]}T${wita[2]}:${wita[3]}:00+08:00`) : new Date(teks);
  if (Number.isNaN(t.getTime())) throw new Error(`Waktu tidak dikenal: ${teks}`);
  return t.toISOString();
}

/** SQL D1: kembalikan baris yang terhapus dari jejak perubahan dalam rentang waktu. Yang id-nya masih ada dilewati. */
export function sqlPulihkanJejakD1(tabel: string, rentang: { dari: string; sampai: string }): string {
  const kolom = kolomD1(tabel);
  const dari = waktuJejak(rentang.dari);
  const sampai = waktuJejak(rentang.sampai);
  return (
    `-- Baris ${tabel} yang terhapus antara ${dari} dan ${sampai} (UTC), dari jejak perubahan.\n` +
    `INSERT OR IGNORE INTO ${tabel} (${kolom.join(", ")})\n` +
    `SELECT ${ekspresiKolom(tabel, kolom, "j.lama").join(", ")}\n` +
    `FROM jejak_data j WHERE j.tabel = '${tabel}' AND j.aksi = 'hapus' ` +
    `AND j.waktu >= '${dari}' AND j.waktu <= '${sampai}' ORDER BY j.id;\n`
  );
}

/** SQL D1: kembalikan isi satu baris ke keadaan yang tersimpan pada satu jejak (sebelum perubahan itu). */
export function sqlKembalikanBarisD1(tabel: string, idJejak: number): string {
  if (!Number.isInteger(idJejak) || idJejak <= 0) throw new Error("id jejak harus bilangan bulat positif");
  const kolom = kolomD1(tabel).filter((k) => k !== "id" && k !== "urutan_sisip");
  return (
    `-- Kembalikan baris ${tabel} ke isi pada jejak ${idJejak}. Perubahan sesudah jejak itu ikut terganti.\n` +
    `UPDATE ${tabel} SET (${kolom.join(", ")}) =\n` +
    `  (SELECT ${kolom.map((k) => `json_extract(lama, '$.${k}')`).join(", ")} FROM jejak_data WHERE id = ${idJejak} AND tabel = '${tabel}')\n` +
    `WHERE id = (SELECT id_baris FROM jejak_data WHERE id = ${idJejak} AND tabel = '${tabel}');\n`
  );
}
