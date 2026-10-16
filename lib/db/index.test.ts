// Pintu lapisan data (lib/db/index.ts): kesamaan repository antar penyimpanan dan pemilihan backend dari environment.
// Jalankan: node --import tsx --test lib/db/index.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { sheets } from "../sheets/tables";
import { d1 } from "./d1/tables";
import { backendData, db } from "./index";

const env = process.env as Record<string, string | undefined>;

test("db, sheets, dan d1 punya repository yang sama", () => {
  const kunci = Object.keys(sheets).sort();
  assert.deepEqual(Object.keys(db).sort(), kunci);
  assert.deepEqual(Object.keys(d1).sort(), kunci);
});

/** Jalankan `uji` dengan DATA_BACKEND dan NODE_ENV tertentu (undefined = tidak di-set), lalu kembalikan environment. */
function denganEnv(nilai: { DATA_BACKEND?: string; NODE_ENV?: string }, uji: () => void) {
  const simpan = { DATA_BACKEND: env.DATA_BACKEND, NODE_ENV: env.NODE_ENV };
  const pasang = (nama: keyof typeof simpan, v: string | undefined) => {
    if (v === undefined) delete env[nama];
    else env[nama] = v;
  };
  try {
    pasang("DATA_BACKEND", nilai.DATA_BACKEND);
    pasang("NODE_ENV", nilai.NODE_ENV);
    uji();
  } finally {
    pasang("DATA_BACKEND", simpan.DATA_BACKEND);
    pasang("NODE_ENV", simpan.NODE_ENV);
  }
}

test("pilihan backend yang dikenal dibaca apa adanya", () => {
  for (const pilihan of ["d1", "sheets", "lokal"] as const) {
    denganEnv({ DATA_BACKEND: pilihan, NODE_ENV: "production" }, () => assert.equal(backendData(), pilihan));
  }
  denganEnv({ DATA_BACKEND: "  D1 ", NODE_ENV: "production" }, () => assert.equal(backendData(), "d1"));
});

test("tanpa DATA_BACKEND: pengembangan memakai Sheets, produksi menolak berjalan", () => {
  denganEnv({ NODE_ENV: "development" }, () => assert.equal(backendData(), "sheets"));
  denganEnv({}, () => assert.equal(backendData(), "sheets"));
  denganEnv({ NODE_ENV: "production" }, () => assert.throws(() => backendData(), /DATA_BACKEND belum di-set/));
});

test("DATA_BACKEND=supabase ditolak dengan petunjuk ke d1, nilai lain tidak dikenal", () => {
  denganEnv({ DATA_BACKEND: "supabase" }, () => assert.throws(() => backendData(), /ADR-102.*"d1"/));
  denganEnv({ DATA_BACKEND: "lain" }, () => assert.throws(() => backendData(), /tidak dikenal/));
});
