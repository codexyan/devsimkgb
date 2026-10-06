// Kapan pengumuman Admin UPT boleh tampil (ADR-073).
//
// Jalankan: node --import tsx --test lib/pengumumanUpt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { bolehTampilPengumuman, kunciPengumumanUpt, sedangMengetik, type KeadaanPengumuman } from "./pengumumanUpt";

const siap: KeadaanPengumuman = { peran: "admin_upt", jalur: "/dashboard", adaDialog: false, sedangMengetik: false, sudahDilihat: false };

test("tampil untuk Admin UPT di halaman aman bila tidak ada yang sedang dikerjakan", () => {
  assert.equal(bolehTampilPengumuman(siap), true);
  for (const jalur of ["/dashboard", "/dashboard/", "/dashboard/upt/pegawai", "/dashboard/upt/riwayat"])
    assert.equal(bolehTampilPengumuman({ ...siap, jalur }), true, jalur);
});

test("tidak pernah tampil di halaman yang memuat isian yang belum disimpan", () => {
  for (const jalur of [
    "/dashboard/upt/kolektif",
    "/dashboard/upt/unggah",
    "/dashboard/upt/hukdis",
    "/dashboard/profile",
    "/dashboard/pegawai",
    "/dashboard/usulan",
  ])
    assert.equal(bolehTampilPengumuman({ ...siap, jalur }), false, jalur);
});

test("tidak tampil di atas dialog lain, selagi mengetik, atau bila sudah dilihat", () => {
  assert.equal(bolehTampilPengumuman({ ...siap, adaDialog: true }), false);
  assert.equal(bolehTampilPengumuman({ ...siap, sedangMengetik: true }), false);
  assert.equal(bolehTampilPengumuman({ ...siap, sudahDilihat: true }), false);
});

test("hanya untuk Admin UPT", () => {
  for (const peran of ["super_admin", "sdm_kgb", "sdm_hukdis", "keuangan", ""]) assert.equal(bolehTampilPengumuman({ ...siap, peran }), false, peran);
});

test("kolom yang sedang diketik dikenali, termasuk isian bebas", () => {
  assert.equal(sedangMengetik({ tagName: "input" }), true);
  assert.equal(sedangMengetik({ tagName: "TEXTAREA" }), true);
  assert.equal(sedangMengetik({ tagName: "SELECT" }), true);
  assert.equal(sedangMengetik({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(sedangMengetik({ tagName: "BUTTON" }), false);
  assert.equal(sedangMengetik(null), false);
});

test("penanda dilihat dicatat per pengguna dan per pengumuman", () => {
  assert.notEqual(kunciPengumumanUpt("199505052019051005"), kunciPengumumanUpt("199001012015031001"));
  assert.match(kunciPengumumanUpt("199505052019051005"), /^kgb-pengumuman-upt:nama-menu-2026-10:/);
});
