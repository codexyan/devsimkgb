// Jalankan: node --import tsx --test "app/(publik)/kgb/tangga/tata.test.ts"

import assert from "node:assert/strict";
import { test } from "node:test";
import { tanggaGaji } from "@/lib/tabelGaji";
import { anakBerlaku, kelompokGolongan, pilihBalok, potongBalok, susunLanskap, tinggiGaji, xMkg } from "./tata";

const tata = susunLanskap(tanggaGaji());

test("setiap anak tangga menjadi satu balok yang menyambung ke anak tangga berikutnya", () => {
  assert.equal(tata.balok.length, 272);
  for (const b of tata.balok) assert.ok(b.x1 > b.x0, `balok ${b.baris}:${b.anak} punya lebar`);
  const iia = tata.balok.filter((b) => b.baris === 4);
  assert.equal(iia[0].x0, xMkg(0));
  assert.equal(iia[0].x1, xMkg(1), "II/a MKG 0 berlaku sampai MKG 1");
  iia.slice(1).forEach((b, i) => assert.equal(b.x0, iia[i].x1));
  const ia = tata.balok.filter((b) => b.baris === 0);
  assert.equal(ia.at(-1)?.x1, xMkg(28), "anak tangga terakhir I/a (MKG 26) membentang dua tahun");
});

test("golongan dikelompokkan dan baris makin ke belakang makin tinggi gajinya", () => {
  assert.deepEqual(["I/d", "II/a", "III/c", "IV/e", "X"].map(kelompokGolongan), [0, 1, 2, 3, 0]);
  assert.ok(tata.zBaris[4] < tata.zBaris[3], "II/a di belakang I/d, menjauhi kamera");
  assert.ok(tata.zBaris[3] - tata.zBaris[4] > tata.zBaris[2] - tata.zBaris[3], "ada celah antarkelompok golongan");
  assert.ok(Math.abs(tata.zBaris[0] + tata.zBaris[16]) < 1e-9, "lanskap berpusat di z = 0");
  assert.equal(tata.tinggiMaks, tinggiGaji(6_373_200));
});

test("sinar dari atas mengenai balok di bawahnya dan memilih yang terdekat", () => {
  const sasaran = tata.balok.find((b) => b.baris === 10 && b.anak === 5)!;
  const tengah = [(sasaran.x0 + sasaran.x1) / 2, 20, sasaran.z] as const;
  assert.equal(potongBalok(tengah, [0, -1, 0], sasaran), 20 - sasaran.tinggi);
  const i = pilihBalok(tengah, [0, -1, 0], tata.balok);
  assert.deepEqual([tata.balok[i].baris, tata.balok[i].anak], [10, 5]);
  assert.equal(pilihBalok([0, 20, -40], [0, -1, 0], tata.balok), -1, "di luar lanskap tidak memilih apa pun");
  assert.equal(potongBalok(tengah, [0, 1, 0], sasaran), null, "sinar menjauh tidak mengenai");
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
