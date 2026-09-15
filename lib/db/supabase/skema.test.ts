// Memastikan migrasi SQL, definisi kolom di lib/sheets/tables.ts, dan pemetaan nama di lapisan
// Supabase tetap sejalan. Jalankan dari folder proyek: node --import tsx --test lib/db/supabase/*.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { ALL_DEFS, sheets } from "../../sheets/tables";
import { backendData, db } from "../index";
import { KOLOM_URUTAN, keSnake, namaTabel } from "./nama";
import { supabase } from "./tables";

const FILE_SQL = path.join(process.cwd(), "supabase", "migrations", "20260915090000_skema_awal.sql");

function bacaSql(): string {
  return readFileSync(FILE_SQL, "utf8").replace(/\r\n/g, "\n");
}

/** Nama tabel → kolom, dibaca dari pernyataan create table di migrasi. */
function tabelDiSql(sql: string): Map<string, string[]> {
  const hasil = new Map<string, string[]>();
  for (const cocok of sql.matchAll(/create table public\.(\w+) \(\n([\s\S]*?)\n\);/g)) {
    const kolom = cocok[2]
      .split("\n")
      .map((baris) => baris.trim())
      .filter((baris) => baris && !baris.startsWith("--") && !baris.startsWith("check"))
      .map((baris) => baris.split(/\s+/)[0]);
    hasil.set(cocok[1], kolom);
  }
  return hasil;
}

test("nama snake_case untuk kolom dan tabel", () => {
  assert.equal(keSnake("tmtKgbBerikutnya"), "tmt_kgb_berikutnya");
  assert.equal(keSnake("berdampakKGB"), "berdampak_kgb");
  assert.equal(keSnake("nomorSK"), "nomor_sk");
  assert.equal(keSnake("penetapSkDasar"), "penetap_sk_dasar");
  assert.equal(keSnake("notifKgbH1"), "notif_kgb_h1");
  assert.equal(namaTabel("User"), "users");
  assert.equal(namaTabel("RiwayatKGB"), "riwayat_kgb");
  assert.equal(namaTabel("ProfileChangeRequest"), "profile_change_request");
});

test("setiap tab punya tabel dengan kolom yang sama di migrasi SQL", () => {
  const sql = bacaSql();
  const tabel = tabelDiSql(sql);
  assert.equal(tabel.size, ALL_DEFS.length, "jumlah tabel di migrasi");
  for (const def of ALL_DEFS) {
    const nama = namaTabel(def.tab);
    const kolom = tabel.get(nama);
    assert.ok(kolom, `tabel ${nama} untuk tab ${def.tab}`);
    const diharapkan = [...def.columns.map((c) => keSnake(c.name)), KOLOM_URUTAN];
    assert.deepEqual([...kolom].sort(), diharapkan.sort(), `kolom tabel ${nama}`);
    assert.match(sql, new RegExp(`alter table public\\.${nama}\\s+enable row level security;`), `RLS tabel ${nama}`);
  }
});

test("db, sheets, dan supabase punya repository yang sama", () => {
  const kunci = Object.keys(sheets).sort();
  assert.deepEqual(Object.keys(db).sort(), kunci);
  assert.deepEqual(Object.keys(supabase).sort(), kunci);
});

test("pemilihan backend dari environment", () => {
  const simpan = { DATA_BACKEND: process.env.DATA_BACKEND, SUPABASE_URL: process.env.SUPABASE_URL };
  const pulihkan = (nama: keyof typeof simpan) => {
    if (simpan[nama] === undefined) delete process.env[nama];
    else process.env[nama] = simpan[nama];
  };
  try {
    delete process.env.DATA_BACKEND;
    delete process.env.SUPABASE_URL;
    assert.equal(backendData(), "sheets");
    process.env.SUPABASE_URL = "https://contoh.supabase.co";
    assert.equal(backendData(), "supabase");
    process.env.DATA_BACKEND = "sheets";
    assert.equal(backendData(), "sheets");
    process.env.DATA_BACKEND = "lain";
    assert.throws(() => backendData());
  } finally {
    pulihkan("DATA_BACKEND");
    pulihkan("SUPABASE_URL");
  }
});
