// Jalankan: node --import tsx --test lib/riwayatPenopang.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { bolehHapusRiwayatKp, riwayatPenopang, type RiwayatKpUntukPenopang } from "./riwayatPenopang";

const kp = (id: string, tmt: string, dibuat: string, mkg = 18, gaji = 4000600): RiwayatKpUntukPenopang => ({
  id,
  tmtPangkat: new Date(`${tmt}T00:00:00.000Z`),
  golonganBaru: "III/c",
  mkgTahunBaru: mkg,
  mkgBulanBaru: 0,
  gajiPokokBaru: gaji,
  createdAt: new Date(dibuat),
});

// Kasus Naily Wardani: tiga catatan untuk satu SK.
const A = kp("A", "2026-06-01", "2026-10-20T07:32:16Z", 16, 3878500);
const B = kp("B", "2025-06-01", "2026-10-21T01:33:50Z");
const C = kp("C", "2026-06-01", "2026-10-21T05:35:09Z");

test("penopang: TMT terakhir, lalu yang dicatat paling akhir", () => {
  assert.equal(riwayatPenopang([A, B, C])?.id, "C");
  assert.equal(riwayatPenopang([C, B, A])?.id, "C");
  assert.equal(riwayatPenopang([]), null);
});

test("riwayat yang bukan penopang boleh dihapus", () => {
  assert.deepEqual(bolehHapusRiwayatKp("A", [A, B, C]), { boleh: true });
  assert.deepEqual(bolehHapusRiwayatKp("B", [A, B, C]), { boleh: true });
});

test("penopang tidak boleh dihapus selama tidak ada riwayat berangka sama", () => {
  const h = bolehHapusRiwayatKp("C", [A, B, C]);
  assert.equal(h.boleh, false);
  assert.match(h.boleh ? "" : h.alasan, /menopang/);
});

test("penopang boleh dihapus bila ada salinan berangka sama persis", () => {
  const salinan = kp("D", "2026-06-01", "2026-10-21T06:00:00Z");
  assert.deepEqual(bolehHapusRiwayatKp("D", [C, salinan]), { boleh: true });
});

test("satu-satunya riwayat tidak boleh dihapus, riwayat tak dikenal ditolak", () => {
  assert.equal(bolehHapusRiwayatKp("C", [C]).boleh, false);
  assert.equal(bolehHapusRiwayatKp("X", [C]).boleh, false);
});

test("urutan dicatat memakai jam, juga bila datang sebagai teks dari API", () => {
  const pagi = { ...kp("P", "2026-06-01", "2026-10-21T01:00:00Z"), createdAt: "2026-10-21T01:00:00.000Z" };
  const sore = { ...kp("S", "2026-06-01", "2026-10-21T05:00:00Z"), createdAt: "2026-10-21T05:00:00.000Z" };
  assert.equal(riwayatPenopang([pagi, sore])?.id, "S");
  assert.equal(riwayatPenopang([sore, pagi])?.id, "S");
});
