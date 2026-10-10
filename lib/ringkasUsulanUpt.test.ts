// Ringkasan usulan UPT yang menunggu di dasbor Kanwil (ADR-076).
//
// Jalankan: node --import tsx --test lib/ringkasUsulanUpt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { keteranganRingkasan, nadaUmurUsulan, ringkasUsulanPerUpt } from "./ringkasUsulanUpt";

const sekarang = new Date("2026-10-07T04:00:00Z");
const hariLalu = (n: number) => new Date(sekarang.getTime() - n * 86_400_000 - 1000).toISOString();
const kode = (unitKerja: string) => unitKerja.toLowerCase().replace(/\s+/g, "-");

const lpp = "LPP Martapura";
const rutan = "Rutan Rantau";

test("usulan dikelompokkan per UPT, terbanyak lebih dulu, dengan jumlah surat dan umur terlama", () => {
  const daftar = [
    ...Array.from({ length: 5 }, (_, i) => ({ unitKerja: lpp, nomorSurat: i < 3 ? "W.19-1" : "W.19-2", diajukanAt: hariLalu(i + 1) })),
    { unitKerja: rutan, nomorSurat: "W.20-1", diajukanAt: hariLalu(2) },
  ];
  const r = ringkasUsulanPerUpt(daftar, sekarang, kode);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { kode: "lpp-martapura", unitKerja: lpp, jumlah: 5, surat: 2, tanpaSurat: 0, hariTerlama: 5, bertanda: 0 });
  assert.deepEqual(r[1], { kode: "rutan-rantau", unitKerja: rutan, jumlah: 1, surat: 1, tanpaSurat: 0, hariTerlama: 2, bertanda: 0 });
});

test("usulan tanpa nomor surat dihitung sebagai laporan SK, bukan sebagai surat", () => {
  const r = ringkasUsulanPerUpt(
    [
      { unitKerja: lpp, nomorSurat: null, diajukanAt: hariLalu(0) },
      { unitKerja: lpp, nomorSurat: "  ", diajukanAt: hariLalu(0) },
      { unitKerja: lpp, nomorSurat: "W.19-1", diajukanAt: hariLalu(0) },
      // Nomor yang sama berbeda spasi tetap satu surat.
      { unitKerja: lpp, nomorSurat: " W.19-1 ", diajukanAt: hariLalu(0) },
    ],
    sekarang,
    kode,
  );
  assert.equal(r[0].jumlah, 4);
  assert.equal(r[0].surat, 1);
  assert.equal(r[0].tanpaSurat, 2);
  assert.equal(r[0].hariTerlama, 0);
});

test("tanggal tidak diketahui atau tidak sah tidak merusak umur, dan masa depan dibaca nol hari", () => {
  const r = ringkasUsulanPerUpt(
    [
      { unitKerja: lpp, nomorSurat: "a", diajukanAt: null },
      { unitKerja: lpp, nomorSurat: "a", diajukanAt: "bukan tanggal" },
      { unitKerja: lpp, nomorSurat: "a", diajukanAt: new Date(sekarang.getTime() + 3 * 86_400_000).toISOString() },
    ],
    sekarang,
    kode,
  );
  assert.equal(r[0].hariTerlama, 0);
  assert.deepEqual(ringkasUsulanPerUpt([], sekarang, kode), []);
});

test("urutan: jumlah terbanyak, lalu nama", () => {
  const satu = (unitKerja: string) => ({ unitKerja, nomorSurat: "x", diajukanAt: hariLalu(1) });
  const r = ringkasUsulanPerUpt([satu("Rutan B"), satu("Rutan A"), satu("Lapas Z"), satu("Lapas Z")], sekarang, kode);
  assert.deepEqual(r.map((x) => x.unitKerja), ["Lapas Z", "Rutan A", "Rutan B"]);
});

test("keterangan memuat jumlah, surat, laporan SK, dan umur", () => {
  assert.equal(
    keteranganRingkasan({ kode: "k", unitKerja: lpp, jumlah: 48, surat: 2, tanpaSurat: 3, hariTerlama: 5, bertanda: 2 }),
    "48 usulan · 2 surat · 3 laporan SK · 2 perlu dilihat · terlama 5 hari",
  );
  assert.equal(
    keteranganRingkasan({ kode: "k", unitKerja: rutan, jumlah: 1, surat: 1, tanpaSurat: 0, hariTerlama: 0, bertanda: 0 }),
    "1 usulan · 1 surat · diajukan hari ini",
  );
  assert.equal(
    keteranganRingkasan({ kode: "k", unitKerja: rutan, jumlah: 2, surat: 0, tanpaSurat: 2, hariTerlama: 1, bertanda: 0 }),
    "2 usulan · 2 laporan SK · terlama 1 hari",
  );
});

test("usulan bertanda dihitung per UPT untuk keterangan perlu dilihat (ADR-099)", () => {
  const r = ringkasUsulanPerUpt(
    [
      { unitKerja: lpp, nomorSurat: "S-1", diajukanAt: hariLalu(1), bertanda: true },
      { unitKerja: lpp, nomorSurat: "S-1", diajukanAt: hariLalu(1), bertanda: false },
      { unitKerja: lpp, nomorSurat: "S-1", diajukanAt: hariLalu(1) },
    ],
    sekarang,
    kode,
  );
  assert.equal(r[0].bertanda, 1);
});

test("nada umur memakai ambang 7 dan 14 hari seperti penanda usulan di dasbor", () => {
  assert.equal(nadaUmurUsulan(0), "ungu");
  assert.equal(nadaUmurUsulan(7), "ungu");
  assert.equal(nadaUmurUsulan(8), "kuning");
  assert.equal(nadaUmurUsulan(14), "kuning");
  assert.equal(nadaUmurUsulan(15), "merah");
});
