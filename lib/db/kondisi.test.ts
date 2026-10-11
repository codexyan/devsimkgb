// Memastikan terjemahan Where → Kondisi memberi hasil yang sama dengan pencocokan di lapisan
// Google Sheets. Kondisi dievaluasi dengan semantik SQL (perbandingan dengan NULL tidak benar),
// lalu dibandingkan dengan `matches` untuk setiap record contoh. Hasil akhirnya di SQLite diuji
// terpisah oleh lib/db/d1/sql.test.ts.
//
// Jalankan: node --import tsx --test lib/db/kondisi.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { matches } from "../sheets/table";
import { keKondisi, type Kondisi, type NilaiFilter } from "./kondisi";
import { keSnake } from "./nama";
import { keJson } from "./nilai";
import { KOLOM_CONTOH, RECORD_CONTOH as RECORD, WHERE_CONTOH as WHERE } from "./contohFilter";

type Rec = Record<string, unknown>;

const KOLOM: readonly string[] = KOLOM_CONTOH;
const camelDari = new Map(KOLOM.map((k) => [keSnake(k), k]));
const keKolom = (nama: string) => (KOLOM.includes(nama) ? keSnake(nama) : null);

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** ILIKE: % = teks apa pun, _ = satu karakter, \ meloloskan karakter berikutnya. */
function cocokIlike(teks: string, pola: string): boolean {
  let re = "^";
  for (let i = 0; i < pola.length; i++) {
    const c = pola[i];
    if (c === "\\") re += escapeRegex(pola[++i] ?? "");
    else if (c === "%") re += "[\\s\\S]*";
    else if (c === "_") re += "[\\s\\S]";
    else re += escapeRegex(c);
  }
  return new RegExp(`${re}$`, "i").test(teks);
}

/** Nilai kolom dan argumen dalam bentuk yang dibandingkan Postgres; literal teks ikut tipe kolom. */
function pasangan(nilaiKolom: unknown, arg: NilaiFilter): [number | string | boolean, number | string | boolean] {
  const a = nilaiKolom instanceof Date ? nilaiKolom.getTime() : (nilaiKolom as number | string | boolean);
  const b = arg instanceof Date
    ? arg.getTime()
    : nilaiKolom instanceof Date && typeof arg === "string"
      ? new Date(arg).getTime()
      : arg;
  return [a, b];
}

function evalSql(k: Kondisi, rec: Rec): boolean {
  const nilai = (kolom: string) => rec[camelDari.get(kolom) ?? kolom] ?? null;
  switch (k.jenis) {
    case "benar":
      return true;
    case "salah":
      return false;
    case "dan":
      return k.isi.every((x) => evalSql(x, rec));
    case "atau":
      return k.isi.some((x) => evalSql(x, rec));
    case "kosong":
      return (nilai(k.kolom) === null) === k.kosong;
    case "banding": {
      const v = nilai(k.kolom);
      if (v === null) return false;
      const [a, b] = pasangan(v, k.nilai);
      if (k.op === "eq") return a === b;
      if (k.op === "neq") return a !== b;
      if (k.op === "lt") return a < b;
      if (k.op === "lte") return a <= b;
      if (k.op === "gt") return a > b;
      return a >= b;
    }
    case "dalam": {
      const v = nilai(k.kolom);
      if (v === null) return false;
      const ada = k.nilai.some((n) => {
        const [a, b] = pasangan(v, n);
        return a === b;
      });
      return k.negasi ? !ada : ada;
    }
    case "mirip": {
      const v = nilai(k.kolom);
      return v === null ? false : cocokIlike(String(v), k.pola);
    }
  }
}

test("terjemahan filter cocok dengan pencocokan lapisan Sheets", () => {
  for (const where of WHERE) {
    const kondisi = keKondisi(where, keKolom);
    for (const rec of RECORD) {
      assert.equal(
        evalSql(kondisi, rec),
        matches(rec, where),
        `where ${JSON.stringify(where)} pada record ${JSON.stringify(rec)}`,
      );
    }
  }
});

test("konversi nilai meniru lapisan Sheets", () => {
  assert.equal(keJson("", "string"), null);
  assert.equal(keJson("", "int"), null);
  // Sheets menyimpan boolean dari truthy nilainya, jadi string apa pun yang tidak kosong menjadi true.
  assert.equal(keJson("", "boolean"), false);
  assert.equal(keJson("false", "boolean"), true);
  assert.equal(keJson(5.7, "int"), 5);
  assert.equal(keJson("12", "int"), 12);
  assert.equal(keJson(new Date("2026-01-01T00:00:00Z"), "datetime"), "2026-01-01T00:00:00.000Z");
  assert.equal(keJson("bukan tanggal", "datetime"), null);
});
