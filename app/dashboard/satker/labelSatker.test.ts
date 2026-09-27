// Nama ringkas satker untuk tampilan padat dashboard (ADR-013).
//
// Jalankan: node --import tsx --test app/dashboard/satker/labelSatker.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { SATKER } from "@/lib/satker";
import { namaRingkasSatker } from "./labelSatker";

test("nama ringkas memakai singkatan jenis dan tempat, tanpa kelas", () => {
  const cari = (kode: string) => namaRingkasSatker(SATKER.find((s) => s.kode === kode)!);
  assert.equal(cari("kanwil"), "Kanwil");
  assert.equal(cari("rutan-rantau"), "Rutan Rantau");
  assert.equal(cari("lapas-perempuan-martapura"), "Lapas Perempuan Martapura");
  assert.equal(cari("lapas-narkotika-karang-intan"), "Lapas Narkotika Karang Intan");
  assert.equal(cari("lpka-martapura"), "LPKA Martapura");
});

test("nama ringkas tetap membedakan setiap satker", () => {
  const ringkas = SATKER.map(namaRingkasSatker);
  assert.equal(new Set(ringkas).size, SATKER.length);
});
