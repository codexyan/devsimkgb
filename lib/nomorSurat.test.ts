// Penomoran surat keluar Kanwil.
//
// Jalankan: node --import tsx --test lib/nomorSurat.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { AWALAN_NOMOR_SK, bagianNomorSk, kunciNomorSk, nomorSkLengkap } from "./nomorSurat";

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
