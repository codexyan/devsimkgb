// Cadangan data bulanan: jatuh tempo, cakupan per peran, dan CSV.
//
// Jalankan: node --import tsx --test lib/cadangan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { CADANGAN_BERLAKU, cakupanPeran, denganPdfSk, keCsv, namaBerkasCadangan, statusCadangan, terbaru } from "./cadangan";

const hari = (n: number, dari = new Date("2026-10-01T09:00:00+08:00")) => new Date(dari.getTime() + n * 86400000);

test("cadangan baru aman, hari ke-25 mengingatkan, hari ke-30 wajib", () => {
  const terakhir = new Date("2026-10-01T09:00:00+08:00");
  assert.equal(statusCadangan(terakhir, null, hari(3)).keadaan, "aman");
  assert.equal(statusCadangan(terakhir, null, hari(25)).keadaan, "ingat");
  assert.equal(statusCadangan(terakhir, null, hari(30)).keadaan, "wajib");
  assert.equal(statusCadangan(terakhir, null, hari(30)).jatuhTempo.getTime(), hari(30).getTime());
});

test("akun yang belum pernah mencadangkan dihitung sejak fitur berlaku", () => {
  const akunLama = new Date("2025-01-01");
  const s = statusCadangan(null, akunLama, new Date(CADANGAN_BERLAKU.getTime() + 2 * 86400000));
  assert.equal(s.keadaan, "aman");
  assert.equal(s.hariSejak, 2);
  // Akun yang dibuat sesudahnya dihitung sejak dibuat.
  const baru = new Date(CADANGAN_BERLAKU.getTime() + 40 * 86400000);
  assert.equal(statusCadangan(null, baru, new Date(baru.getTime() + 86400000)).keadaan, "aman");
});

test("catatan terbaru dari server atau peramban yang dipakai", () => {
  const a = new Date("2026-10-01");
  const b = new Date("2026-10-20");
  assert.equal(terbaru(a, b), b);
  assert.equal(terbaru(null, a), a);
  assert.equal(terbaru(null, null), null);
});

test("cakupan mengikuti hak akses peran", () => {
  assert.ok(cakupanPeran("superAdminCore").includes("pengguna"));
  assert.ok(!cakupanPeran("admin_upt").includes("pengguna"));
  assert.ok(!cakupanPeran("sdm_hukdis").includes("riwayat_kgb"));
  assert.equal(denganPdfSk("sdm_hukdis"), false);
  assert.equal(denganPdfSk("keuangan"), true);
  assert.deepEqual(cakupanPeran("tidak_dikenal"), []);
});

test("CSV: BOM, kutip, NIP sebagai teks, dan kolom gabungan", () => {
  const csv = keCsv([
    { nip: "198804012023011027", nama: 'Putri "Dayang", S.H.' },
    { nip: "199001012015031001", nama: "Budi", catatan: "baris\nkedua" },
  ]);
  assert.ok(csv.startsWith("﻿"));
  const baris = csv.slice(1).split("\r\n");
  assert.equal(baris[0], "nip,nama,catatan");
  assert.equal(baris[1], '="198804012023011027","Putri ""Dayang"", S.H.",');
  assert.ok(baris[2].endsWith('"baris\nkedua"') || csv.includes('"baris\nkedua"'));
});

test("nama berkas memuat peran, NIP, dan tanggal", () => {
  assert.equal(
    namaBerkasCadangan("admin_upt", "199505052019051005", new Date(2026, 9, 5)),
    "cadangan-simkgb_admin_upt_199505052019051005_2026-10-05.zip",
  );
});
