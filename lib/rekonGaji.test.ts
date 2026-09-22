import { test } from "node:test";
import assert from "node:assert/strict";
import { bulanFokusRekon, jendelaRekonGaji, statusRekonGaji } from "@/lib/rekonGaji";

test("jendela rekon TMT November 2026 adalah 1 sampai 15 Oktober 2026", () => {
  const j = jendelaRekonGaji("2026-11");
  assert.equal(j.mulai.getTime(), new Date(2026, 9, 1).getTime());
  assert.equal(j.batas.getTime(), new Date(2026, 9, 15).getTime());
});

test("jendela rekon TMT Januari jatuh pada Desember tahun sebelumnya", () => {
  const j = jendelaRekonGaji("2027-01");
  assert.equal(j.mulai.getTime(), new Date(2026, 11, 1).getTime());
  assert.equal(j.batas.getTime(), new Date(2026, 11, 15).getTime());
});

test("status rekon: akan datang, berjalan (tanggal 1 dan 15 ikut), lalu lewat", () => {
  assert.equal(statusRekonGaji("2026-11", new Date(2026, 8, 30)), "akan_datang");
  assert.equal(statusRekonGaji("2026-11", new Date(2026, 9, 1)), "berjalan");
  assert.equal(statusRekonGaji("2026-11", new Date(2026, 9, 15)), "berjalan");
  assert.equal(statusRekonGaji("2026-11", new Date(2026, 9, 16)), "lewat");
});

test("bulan fokus: sampai tanggal 15 bulan TMT berikutnya, sesudahnya dua bulan ke depan", () => {
  assert.equal(bulanFokusRekon(new Date(2026, 8, 10)), "2026-10");
  assert.equal(bulanFokusRekon(new Date(2026, 8, 15)), "2026-10");
  assert.equal(bulanFokusRekon(new Date(2026, 8, 22)), "2026-11");
  assert.equal(bulanFokusRekon(new Date(2026, 11, 20)), "2027-02");
});
