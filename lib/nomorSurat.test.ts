// Penomoran surat keluar Kanwil.
//
// Jalankan: node --import tsx --test lib/nomorSurat.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { AWALAN_NOMOR_SK, bagianNomorSk, kunciIntiNomorSk, kunciNomorSk, nomorSkSama, nomorSkLengkap } from "./nomorSurat";

test("nomor dari arsiparis disusun menjadi nomor surat lengkap", () => {
  assert.equal(nomorSkLengkap("1234"), "WP.19-SA.04.04-1234");
  assert.equal(nomorSkLengkap("  1234  "), "WP.19-SA.04.04-1234");
  assert.equal(nomorSkLengkap(""), "", "nomor kosong tetap kosong, bukan awalan tanpa isi");
});

test("nomor yang sudah lengkap tidak diberi awalan dua kali", () => {
  assert.equal(nomorSkLengkap("WP.19-SA.04.04-1234"), "WP.19-SA.04.04-1234");
  assert.equal(nomorSkLengkap("wp.19-sa.04.04-1234"), "wp.19-sa.04.04-1234");
});

test("nomor tersimpan dipecah kembali untuk diketik", () => {
  assert.deepEqual(bagianNomorSk("WP.19-SA.04.04-1234"), { berawalan: true, nomor: "1234" });
  assert.deepEqual(bagianNomorSk(""), { berawalan: true, nomor: "" });
  assert.deepEqual(bagianNomorSk(null), { berawalan: true, nomor: "" });
});

test("nomor lama di luar pola Kanwil tetap utuh", () => {
  assert.deepEqual(bagianNomorSk("W.17-KP.04.03-528"), { berawalan: false, nomor: "W.17-KP.04.03-528" });
  assert.equal(nomorSkLengkap("W.17-KP.04.03-528"), AWALAN_NOMOR_SK + "W.17-KP.04.03-528",
    "penyusunan hanya dipakai pada isian bernomor; nomor lama ditampilkan sebagai isian penuh");
});

test("nomor yang hanya berbeda spasi atau huruf besar dianggap sama", () => {
  assert.equal(kunciNomorSk("wp.19-SA.04.04- 1234"), kunciNomorSk("WP.19-SA.04.04-1234"));
  assert.notEqual(kunciNomorSk("WP.19-SA.04.04-1234"), kunciNomorSk("WP.19-SA.04.04-12345"));
  assert.equal(kunciNomorSk(null), "");
});

test("inti nomor SK membuang awalan NOMOR dan akhiran TAHUN (ADR-118)", () => {
  const inti = "WP.19-79.SA.12";
  assert.equal(kunciIntiNomorSk("WP.19-79.SA.12 TAHUN 2025"), inti);
  assert.equal(kunciIntiNomorSk("NOMOR WP.19-79.SA.12 TAHUN 2025"), inti);
  assert.equal(kunciIntiNomorSk("Nomor: wp.19-79.sa.12"), inti);
  assert.equal(kunciIntiNomorSk("WP.19-79.SA.12"), inti);
  assert.notEqual(kunciIntiNomorSk("WP.19-79.SA.123 TAHUN 2025"), inti, "nomor yang berbeda angka tetap berbeda");
  assert.equal(kunciIntiNomorSk(null), "");
});

test("nomor SK sama bila inti sama dan tahunnya tidak bertentangan (ADR-118)", () => {
  assert.equal(nomorSkSama("NOMOR WP.19-79.SA.12 TAHUN 2025", "WP.19-79.SA.12"), true);
  assert.equal(nomorSkSama("WP.19-79.SA.12 TAHUN 2025", "wp.19-79.sa.12 tahun 2025"), true);
  assert.equal(nomorSkSama("WP.19-79.SA.12 TAHUN 2025", "WP.19-79.SA.12 TAHUN 2026"), false, "tahun berbeda = SK berbeda");
  assert.equal(nomorSkSama("", ""), false);
  assert.equal(nomorSkSama(null, "WP.1"), false);
});
