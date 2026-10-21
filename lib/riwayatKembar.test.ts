// Jalankan: node --import tsx --test lib/riwayatKembar.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { cariKembar, riwayatKembar, type RiwayatUntukKembar } from "./riwayatKembar";

const r = (id: string, nomorSK: string, tmt: string, golonganBaru = "III/c"): RiwayatUntukKembar => ({
  id,
  nomorSK,
  tmt: new Date(`${tmt}T00:00:00.000Z`),
  golonganBaru,
});

test("SK yang sama tertulis berbeda (NOMOR..., ...TAHUN 2025) dikenali sebagai kembar (ADR-118)", () => {
  const a = r("A", "WP.19-79.SA.12 TAHUN 2025", "2026-06-01");
  const c = r("C", "WP.19-79.SA.12", "2026-06-01");
  assert.equal(riwayatKembar(a, c), true);
});

test("TMT atau golongan berbeda bukan kembar, juga bila nomornya sama", () => {
  const a = r("A", "WP.19-79.SA.12 TAHUN 2025", "2026-06-01");
  assert.equal(riwayatKembar(a, r("B", "NOMOR WP.19-79.SA.12 TAHUN 2025", "2025-06-01")), false);
  assert.equal(riwayatKembar(a, r("D", "WP.19-79.SA.12", "2026-06-01", "III/d")), false);
});

test("nomor yang berbeda angka bukan kembar; cariKembar mengabaikan dirinya sendiri", () => {
  const a = r("A", "WP.19-79.SA.12", "2026-06-01");
  assert.equal(riwayatKembar(a, r("E", "WP.19-79.SA.123", "2026-06-01")), false);
  assert.equal(cariKembar(a, [a]), null);
  assert.equal(cariKembar(a, [a, r("C", "NOMOR WP.19-79.SA.12", "2026-06-01")])?.id, "C");
});
