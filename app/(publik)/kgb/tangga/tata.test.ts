// Jalankan: node --import tsx --test "app/(publik)/kgb/tangga/tata.test.ts"

import assert from "node:assert/strict";
import { test } from "node:test";
import { tanggaGaji } from "@/lib/tabelGaji";
import { anakBerlaku, kelompokGolongan } from "./tata";

test("golongan dikelompokkan menurut angka romawinya", () => {
  assert.deepEqual(["I/d", "II/a", "III/c", "IV/e", "X"].map(kelompokGolongan), [0, 1, 2, 3, 0]);
});

test("anak tangga yang berlaku mengikuti MKG terbesar yang tidak melebihi masa kerja", () => {
  const tangga = tanggaGaji();
  const iia = tangga.find((b) => b.golongan === "II/a")!.anak;
  assert.equal(iia[anakBerlaku(iia, 0)].mkg, 0);
  assert.equal(iia[anakBerlaku(iia, 2)].mkg, 1);
  assert.equal(iia[anakBerlaku(iia, 3)].mkg, 3);
  assert.equal(iia[anakBerlaku(iia, 40)].mkg, 33);

  // Ruang yang baru mulai pada MKG 3 belum punya gaji pokok yang berlaku sebelum itu.
  const iib = tangga.find((b) => b.golongan === "II/b")!.anak;
  assert.equal(anakBerlaku(iib, 0), -1);
  assert.equal(anakBerlaku(iib, 2), -1);
  assert.equal(iib[anakBerlaku(iib, 3)].mkg, 3);
  const ib = tangga.find((b) => b.golongan === "I/b")!.anak;
  assert.equal(anakBerlaku(ib, 2), -1);
  assert.equal(ib[anakBerlaku(ib, 4)].mkg, 3);
});
