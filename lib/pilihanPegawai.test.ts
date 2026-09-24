// Pilihan baku isian data pegawai.
//
// Jalankan: node --import tsx --test lib/pilihanPegawai.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { ESELON, JENIS_JABATAN, JENIS_KELAMIN, PENDIDIKAN_TERAKHIR, denganNilaiSaatIni } from "./pilihanPegawai";

test("keadaan yang paling banyak dipakai tersedia sebagai pilihan", () => {
  // 63 dari 80 pegawai Kanwil berstatus Non Eselon, dan dulu nilai itu tidak ada di formulir.
  assert.equal(ESELON[0], "Non Eselon");
  assert.ok(ESELON.includes("III.a"));
  assert.ok(JENIS_JABATAN.includes("Jabatan Fungsional Umum/Pelaksana"));
  assert.deepEqual([...JENIS_KELAMIN], ["Laki-laki", "Perempuan"]);
  assert.ok(PENDIDIKAN_TERAKHIR.includes("D4"), "D4 lazim pada PNS, sebelumnya tidak ada");
});

test("nilai lama di luar daftar tetap muncul, bukan hilang diam-diam", () => {
  const eselon = denganNilaiSaatIni(ESELON, "Eselon III");
  assert.ok(eselon.includes("Eselon III"));
  assert.equal(eselon.length, ESELON.length + 1);

  const pendidikan = denganNilaiSaatIni(PENDIDIKAN_TERAKHIR, "SLTA/SMA SEDERAJAT");
  assert.equal(pendidikan[pendidikan.length - 1], "SLTA/SMA SEDERAJAT");
});

test("nilai yang sudah ada di daftar tidak digandakan, dan kosong tidak menambah apa pun", () => {
  assert.deepEqual(denganNilaiSaatIni(ESELON, "III.a"), [...ESELON]);
  assert.deepEqual(denganNilaiSaatIni(ESELON, "  "), [...ESELON]);
  assert.deepEqual(denganNilaiSaatIni(ESELON, null), [...ESELON]);
  assert.deepEqual(denganNilaiSaatIni(ESELON, undefined), [...ESELON]);
});
