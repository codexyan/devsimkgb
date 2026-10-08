// Terjemahan filter ke SQL D1 (ADR-085) dijalankan di SQLite sungguhan, lalu hasilnya dibandingkan dengan pencocokan
// lapisan Sheets (`matches`) untuk setiap contoh. Contohnya sama dengan uji filter Supabase.
//
// Jalankan: node --import tsx --test lib/db/d1/sql.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { matches, type ColumnType } from "../../sheets/table";
import { KOLOM_CONTOH, RECORD_CONTOH, T1, WHERE_CONTOH } from "../contohFilter";
import type { Where } from "../repo";
import { keKondisi } from "../supabase/filter";
import { keSnake } from "../supabase/nama";
import { keSql } from "./sql";
import { keD1 } from "./table";
import { buatD1Uji } from "./ujiD1";

const JENIS: Record<string, ColumnType> = { nama: "string", status: "string", aktif: "boolean", jumlah: "int", tmtKgbBaru: "datetime" };
const jenisSnake = new Map(KOLOM_CONTOH.map((k) => [keSnake(k), JENIS[k]]));
const keKolom = (nama: string) => ((KOLOM_CONTOH as readonly string[]).includes(nama) ? keSnake(nama) : null);

function siapkan() {
  const d1 = buatD1Uji();
  d1.db.exec(
    "CREATE TABLE contoh (urutan_sisip INTEGER PRIMARY KEY AUTOINCREMENT, nama TEXT, status TEXT, aktif INTEGER, jumlah INTEGER, tmt_kgb_baru TEXT)",
  );
  const sisip = d1.db.prepare("INSERT INTO contoh (nama, status, aktif, jumlah, tmt_kgb_baru) VALUES (?, ?, ?, ?, ?)");
  for (const r of RECORD_CONTOH) {
    sisip.run(
      ...(KOLOM_CONTOH.map((k) => keD1(r[k], JENIS[k])) as (string | number | null)[]),
    );
  }
  return d1;
}

function cocokSql(d1: ReturnType<typeof siapkan>, where: Where): number[] {
  const kondisi = keKondisi(where, keKolom);
  const { sql, nilai } = keSql(kondisi, (k) => jenisSnake.get(k));
  return (d1.db.prepare(`SELECT urutan_sisip FROM contoh WHERE ${sql} ORDER BY urutan_sisip`).all(...(nilai as string[])) as {
    urutan_sisip: number;
  }[]).map((b) => b.urutan_sisip - 1);
}

const TAMBAHAN: Where[] = [
  { tmtKgbBaru: "2026-01-01" },
  { tmtKgbBaru: { gte: "2026-01-01T00:00:00.000Z", lt: new Date("2026-06-01T00:00:00.000Z") } },
  { tmtKgbBaru: { in: [T1, "2026-06-01T00:00:00.000Z"] } },
  { jumlah: { in: [1, 3, 10] } },
  { jumlah: { notIn: [5] } },
  { aktif: { not: true } },
  { aktif: { in: [false, null] } },
  { nama: { contains: "SANTOSO" } },
  { nama: { contains: "\\" } },
  { status: { in: Array.from({ length: 500 }, (_, i) => (i === 250 ? "c" : `x${i}`)) } },
];

test("SQL D1 memberi hasil yang sama dengan pencocokan lapisan Sheets", () => {
  const d1 = siapkan();
  for (const where of [...WHERE_CONTOH, ...TAMBAHAN]) {
    const harapan = RECORD_CONTOH.flatMap((r, i) => (matches(r, where) ? [i] : []));
    assert.deepEqual(cocokSql(d1, where), harapan, `where ${JSON.stringify(where).slice(0, 200)}`);
  }
});

test("daftar `in` yang panjang tetap satu parameter", () => {
  const ids = Array.from({ length: 1000 }, (_, i) => `id-${i}`);
  const { nilai, sql } = keSql(keKondisi({ status: { in: ids } }, keKolom), (k) => jenisSnake.get(k));
  assert.equal(nilai.length, 1);
  assert.match(sql, /IN \(SELECT value FROM json_each\(\?\)\)/);
});

test("tanggal tanpa jam dibaca seperti Postgres (tengah malam UTC), bukan sebagai teks", () => {
  // Lapisan Sheets menganggap "2026-01-01" teks biasa sehingga gte selalu salah; Supabase (dan D1) membacanya sebagai
  // waktu. D1 menggantikan Supabase, jadi yang diikuti adalah perilaku Postgres.
  const d1 = siapkan();
  assert.deepEqual(cocokSql(d1, { tmtKgbBaru: { gte: "2026-01-01" } }), [0, 1, 3, 4]);
});
