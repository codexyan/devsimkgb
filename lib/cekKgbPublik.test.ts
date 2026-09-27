// Cek status KGB publik: pencocokan tempat lahir dan penyamaran nama.
//
// Jalankan: node --import tsx --test lib/cekKgbPublik.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { cocokTempatLahir, normalisasiTempat, samarkanNama } from "./cekKgbPublik";

test("tempat lahir dibandingkan tanpa peka huruf, tanda baca, dan awalan wilayah", () => {
  assert.equal(normalisasiTempat("  Kab. Hulu Sungai  Selatan "), "hulu sungai selatan");
  assert.ok(cocokTempatLahir("banjarmasin", "BANJARMASIN"));
  assert.ok(cocokTempatLahir("Kota Banjarbaru", "Banjarbaru"));
  assert.ok(cocokTempatLahir("Kabupaten Tanah Laut", "Kab. Tanah-Laut"));
  assert.ok(!cocokTempatLahir("Banjar", "Banjarmasin"));
});

test("tempat lahir kosong atau terlalu pendek tidak pernah cocok", () => {
  assert.ok(!cocokTempatLahir("", ""));
  assert.ok(!cocokTempatLahir("Banjarmasin", null));
  assert.ok(!cocokTempatLahir("ab", "ab"));
});

test("nama disamarkan per kata dan gelar dibuang", () => {
  assert.equal(samarkanNama("Siti Nugroho"), "Si** Nu*****");
  assert.equal(samarkanNama("NOORHIKMAH, S.H."), "NO********");
  assert.equal(samarkanNama("Ali Bin Abu"), "A** B** A**");
  assert.equal(samarkanNama(""), "-");
});
