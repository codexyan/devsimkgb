// Kalender KGB per bulan TMT di dasbor Kanwil (ADR-107).
//
// Jalankan: node --import tsx --test lib/kalenderKanwil.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { ringkasBulan } from "./kartuSatkerDasbor";
import { susunKalenderKanwil, URUTAN_BATANG, type EntriKalender } from "./kalenderKanwil";

const e = (bulanTmt: string | null, posisi: EntriKalender["posisi"]): EntriKalender => ({ bulanTmt, posisi });
// 12 Oktober 2026: jendela input TMT Desember 2026.
const HARI_INI = new Date(2026, 9, 12);

test("selalu dua belas bulan, Januari sampai Desember tahun berjalan", () => {
  const k = susunKalenderKanwil([], HARI_INI);
  assert.equal(k.tahun, 2026);
  assert.equal(k.bulan.length, 12);
  assert.equal(k.bulan[0].bulanTmt, "2026-01");
  assert.equal(k.bulan[11].bulanTmt, "2026-12");
  assert.equal(k.jumlah, 0);
  assert.equal(k.luarTahun, 0);
  assert.ok(k.bulan.every((b) => b.jumlah === 0 && !b.terlambat));
});

test("pegawai dihitung per bulan TMT dan per posisi", () => {
  const k = susunKalenderKanwil(
    [e("2026-10", "lewat"), e("2026-10", "lewat"), e("2026-10", "keuangan"), e("2026-12", "siap"), e("2026-07", "selesai")],
    HARI_INI,
  );
  const okt = k.bulan[9];
  assert.equal(okt.jumlah, 3);
  assert.deepEqual(okt.perPosisi, { lewat: 2, keuangan: 1 });
  assert.equal(okt.utama, "lewat");
  assert.equal(ringkasBulan(okt), "2 lewat batas · 1 di keuangan");
  assert.equal(k.bulan[11].jumlah, 1);
  assert.equal(k.bulan[6].utama, "selesai");
  assert.equal(k.jumlah, 5);
});

test("posisi yang mewakili bulan mengikuti urutan mendesak yang sama dengan kartu satker", () => {
  const k = susunKalenderKanwil(
    [e("2026-11", "selesai"), e("2026-11", "keuangan"), e("2026-11", "diproses"), e("2026-11", "terkunci")],
    HARI_INI,
  );
  assert.equal(k.bulan[10].utama, "diproses");
  assert.deepEqual(URUTAN_BATANG, ["lewat", "siap", "diproses", "keuangan", "rekam_upt", "terkunci", "selesai"]);
});

test("bulan dengan yang lewat batas input bertanda terlambat; yang tidak, tidak", () => {
  const k = susunKalenderKanwil([e("2026-09", "lewat"), e("2026-11", "siap")], HARI_INI);
  assert.equal(k.bulan[8].terlambat, true);
  assert.equal(k.bulan[10].terlambat, false);
});

test("jendela input adalah TMT dua bulan sesudah bulan berjalan", () => {
  const k = susunKalenderKanwil([], HARI_INI);
  assert.deepEqual(k.bulan.filter((b) => b.jendela).map((b) => b.bulanTmt), ["2026-12"]);
});

test("jendela input yang jatuh di tahun depan tidak menandai bulan mana pun di tahun ini", () => {
  // 3 November 2026: jendela input TMT Januari 2027.
  const k = susunKalenderKanwil([], new Date(2026, 10, 3));
  assert.equal(k.tahun, 2026);
  assert.ok(k.bulan.every((b) => !b.jendela));
  // 1 Januari 2027 membuka kalender 2027 dengan jendela Maret.
  const baru = susunKalenderKanwil([], new Date(2027, 0, 1));
  assert.equal(baru.tahun, 2027);
  assert.deepEqual(baru.bulan.filter((b) => b.jendela).map((b) => b.bulanTmt), ["2027-03"]);
});

test("TMT di luar tahun ini dan TMT yang belum tercatat dihitung terpisah, tidak dikarang bulannya", () => {
  const k = susunKalenderKanwil([e("2027-01", "terkunci"), e("2025-12", "selesai"), e(null, "siap"), e("2026-05", "selesai")], HARI_INI);
  assert.equal(k.luarTahun, 3);
  assert.equal(k.jumlah, 1);
  assert.equal(k.bulan[4].jumlah, 1);
});
