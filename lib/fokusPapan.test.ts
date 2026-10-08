// Fokus papan antrian Kanwil per satker dan periode TMT (ADR-088).
//
// Jalankan: node --import tsx --test lib/fokusPapan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FOKUS_KOSONG,
  alihPeriode,
  alihSatker,
  bacaFokus,
  cocokFokus,
  fokusBerlaku,
  fokusKosong,
  periodeTerkunci,
  satkerDalamFokus,
  satkerTerkunci,
} from "./fokusPapan";

test("tanpa kunci semua kartu tampil", () => {
  assert.equal(fokusKosong(FOKUS_KOSONG), true);
  assert.equal(cocokFokus(FOKUS_KOSONG, "kanwil", "2026-10"), true);
});

test("kunci satker menampilkan seluruh periodenya; kunci periode hanya periode itu", () => {
  let f = alihSatker(FOKUS_KOSONG, "lapas-perempuan-martapura");
  assert.equal(cocokFokus(f, "lapas-perempuan-martapura", "2026-12"), true);
  assert.equal(cocokFokus(f, "lapas-perempuan-martapura", "2027-01"), true);
  assert.equal(cocokFokus(f, "kanwil", "2026-10"), false);
  f = alihPeriode(f, "kanwil", "2026-10");
  assert.equal(cocokFokus(f, "kanwil", "2026-10"), true);
  assert.equal(cocokFokus(f, "kanwil", "2026-12"), false, "periode lain Kanwil tidak tampil");
  assert.deepEqual([...satkerDalamFokus(f)].sort(), ["kanwil", "lapas-perempuan-martapura"]);
  // Buka lagi: kembali ke semua.
  f = alihPeriode(alihSatker(f, "lapas-perempuan-martapura"), "kanwil", "2026-10");
  assert.equal(fokusKosong(f), true);
});

test("mengunci periode di satker yang dikunci utuh mempersempit satker itu; mengunci satker melepas kunci periodenya", () => {
  let f = alihSatker(FOKUS_KOSONG, "kanwil");
  assert.equal(periodeTerkunci(f, "kanwil", "2026-12"), true, "periode ikut tampak terkunci");
  f = alihPeriode(f, "kanwil", "2026-10");
  assert.equal(satkerTerkunci(f, "kanwil"), false);
  assert.deepEqual(f, { satker: [], periode: ["kanwil|2026-10"] });
  f = alihPeriode(f, "kanwil", "2026-12");
  f = alihSatker(f, "kanwil");
  assert.deepEqual(f, { satker: ["kanwil"], periode: [] });
});

test("kunci yang sudah tidak punya pekerjaan dibuang, supaya papan tidak kosong diam-diam", () => {
  const f = { satker: ["kanwil", "rutan-lama"], periode: ["bapas-banjarmasin|2026-12", "bapas-banjarmasin|2026-09"] };
  const berlaku = fokusBerlaku(f, [
    { kode: "kanwil", bulan: ["2026-10"] },
    { kode: "bapas-banjarmasin", bulan: ["2026-12"] },
  ]);
  assert.deepEqual(berlaku, { satker: ["kanwil"], periode: ["bapas-banjarmasin|2026-12"] });
  assert.equal(fokusKosong(fokusBerlaku(f, [])), true);
});

test("fokus tersimpan yang rusak diabaikan", () => {
  assert.deepEqual(bacaFokus('{"satker":["kanwil","kanwil",3],"periode":["x","kanwil|2026-10"]}'), { satker: ["kanwil"], periode: ["kanwil|2026-10"] });
  assert.deepEqual(bacaFokus("bukan json"), FOKUS_KOSONG);
  assert.deepEqual(bacaFokus(null), FOKUS_KOSONG);
});
