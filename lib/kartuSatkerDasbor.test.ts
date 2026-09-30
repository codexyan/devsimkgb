// Kartu satker di dasbor Kanwil (ADR-036).
//
// Jalankan: node --import tsx --test lib/kartuSatkerDasbor.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { ringkasBulan, susunKartuSatker, type EntriKartu } from "./kartuSatkerDasbor";

const e = (kode: string, bulanTmt: string | null, posisi: EntriKartu["posisi"]): EntriKartu => ({ kode, bulanTmt, posisi });

test("pekerjaan satu satker dipecah per bulan TMT, urut menaik", () => {
  const [kartu] = susunKartuSatker([
    e("rutan-rantau", "2026-12", "keuangan"),
    e("rutan-rantau", "2026-10", "lewat"),
    e("rutan-rantau", "2026-10", "lewat"),
    e("rutan-rantau", "2026-11", "siap"),
  ]);
  assert.equal(kartu.kode, "rutan-rantau");
  assert.equal(kartu.jumlah, 4);
  assert.deepEqual(kartu.bulan.map((b) => b.bulanTmt), ["2026-10", "2026-11", "2026-12"]);
  assert.equal(kartu.bulan[0].jumlah, 2);
  assert.equal(kartu.bulan[0].utama, "lewat");
  assert.equal(ringkasBulan(kartu.bulan[0]), "2 lewat batas");
});

test("satu bulan yang bercampur diwakili posisi paling mendesak", () => {
  const [kartu] = susunKartuSatker([
    e("kanwil", "2026-11", "keuangan"),
    e("kanwil", "2026-11", "lewat"),
    e("kanwil", "2026-11", "diproses"),
  ]);
  // "lewat" paling mendesak, jadi itu yang mewarnai barisnya; rinciannya tetap lengkap.
  assert.equal(kartu.bulan[0].utama, "lewat");
  assert.equal(ringkasBulan(kartu.bulan[0]), "1 lewat batas · 1 sedang diproses · 1 di keuangan");
});

test("yang sudah selesai dihitung terpisah, bukan sebagai pekerjaan", () => {
  const [kartu] = susunKartuSatker([
    e("kanwil", "2026-10", "selesai"),
    e("kanwil", "2026-10", "selesai"),
    e("kanwil", "2026-11", "siap"),
  ]);
  assert.equal(kartu.jumlah, 1, "hanya yang belum selesai terhitung pekerjaan");
  assert.equal(kartu.selesai, 2);
  assert.deepEqual(kartu.bulan.map((b) => b.bulanTmt), ["2026-11"]);
});

test("satker diurutkan dari yang paling mendesak, lalu terbanyak", () => {
  const kartu = susunKartuSatker([
    e("a", "2026-11", "keuangan"),
    e("b", "2026-11", "lewat"),
    e("c", "2026-11", "keuangan"),
    e("c", "2026-12", "keuangan"),
  ]);
  // b punya yang lewat batas -> paling depan. a dan c sama-sama "keuangan", c lebih banyak.
  assert.deepEqual(kartu.map((k) => k.kode), ["b", "c", "a"]);
});

test("satker tanpa pekerjaan tidak menghasilkan kartu, kecuali punya usulan menunggu", () => {
  const kartu = susunKartuSatker(
    [e("a", "2026-11", "selesai")],
    new Map([["a", 0], ["b", 2]]),
  );
  // a hanya punya yang selesai dan tidak punya usulan -> tidak berkartu.
  // b tidak punya pekerjaan KGB tetapi usulannya menunggu tinjauan -> tetap berkartu.
  assert.deepEqual(kartu.map((k) => k.kode), ["b"]);
  assert.equal(kartu[0].usulan, 2);
  assert.equal(kartu[0].jumlah, 0);
});

test("TMT yang belum tercatat dipisah, bukan dikarang tanggalnya", () => {
  const [kartu] = susunKartuSatker([e("a", null, "siap"), e("a", "2026-11", "siap")]);
  assert.equal(kartu.tanpaBulan, 1);
  assert.equal(kartu.jumlah, 2);
  assert.deepEqual(kartu.bulan.map((b) => b.bulanTmt), ["2026-11"]);
});
