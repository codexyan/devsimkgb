// Kapan pengumuman Admin UPT boleh tampil (ADR-073).
//
// Jalankan: node --import tsx --test lib/pengumumanUpt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PENGUMUMAN_UPT,
  bolehTampilPengumuman,
  gabungDilihat,
  idPengumumanSah,
  kunciBarisDilihat,
  kunciPengumumanUpt,
  pengumumanBelumDilihat,
  sedangMengetik,
  type KeadaanPengumuman,
} from "./pengumumanUpt";

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
  assert.notEqual(kunciPengumumanUpt("199505052019051005", "lapor-sk-2026-10"), kunciPengumumanUpt("199505052019051005"));
  assert.equal(
    kunciPengumumanUpt("199505052019051005", "nama-menu-2026-10"),
    "kgb-pengumuman-upt:nama-menu-2026-10:199505052019051005",
    "kunci pengumuman pertama tidak boleh berubah: yang sudah melihatnya tidak boleh melihatnya lagi",
  );
});

test("penanda server per akun digabung dengan penanda peramban", () => {
  const tidak = () => false;
  // Akun yang sudah melihat di server tidak melihatnya lagi di peramban yang baru dipakai.
  const g = gabungDilihat(["nama-menu-2026-10", "lapor-sk-2026-10"], tidak);
  assert.deepEqual(g.dilihat, ["nama-menu-2026-10", "lapor-sk-2026-10"]);
  assert.deepEqual(pengumumanBelumDilihat((id) => g.dilihat.includes(id)), []);
  assert.deepEqual(g.perluDicatat, []);
  // Yang sudah dilihat di peramban ini tetapi belum tercatat di server disusulkan ke server, bukan ditampilkan lagi.
  const susul = gabungDilihat(["nama-menu-2026-10"], (id) => id === "lapor-sk-2026-10");
  assert.deepEqual(susul.dilihat, ["nama-menu-2026-10", "lapor-sk-2026-10"]);
  assert.deepEqual(susul.perluDicatat, ["lapor-sk-2026-10"]);
  // Akun baru di peramban baru: semuanya belum dilihat.
  assert.deepEqual(gabungDilihat([], tidak).dilihat, []);
  // Server tidak terjangkau (tabel belum dimigrasikan): hanya peramban yang menentukan, dan tidak ada yang disusulkan.
  const tanpaServer = gabungDilihat(null, (id) => id === "nama-menu-2026-10");
  assert.deepEqual(tanpaServer.dilihat, ["nama-menu-2026-10"]);
  assert.deepEqual(tanpaServer.perluDicatat, []);
});

test("hanya id pengumuman yang dikenal yang dicatat, dan kunci barisnya per akun", () => {
  assert.equal(idPengumumanSah("lapor-sk-2026-10"), true);
  for (const x of ["", "tidak-ada", null, undefined, 3, {}, "nama-menu-2026-10 "]) assert.equal(idPengumumanSah(x), false, String(x));
  assert.equal(kunciBarisDilihat("u1", "lapor-sk-2026-10"), "u1:lapor-sk-2026-10");
  assert.notEqual(kunciBarisDilihat("u1", "lapor-sk-2026-10"), kunciBarisDilihat("u2", "lapor-sk-2026-10"));
});

test("pengumuman yang belum dilihat dihitung per pengumuman, menurut urutan terbit", () => {
  assert.deepEqual(pengumumanBelumDilihat(() => false), [...PENGUMUMAN_UPT]);
  // Yang sudah melihat pengumuman nama menu hanya mendapat pengumuman lapor SK.
  assert.deepEqual(pengumumanBelumDilihat((id) => id === "nama-menu-2026-10"), ["lapor-sk-2026-10"]);
  assert.deepEqual(pengumumanBelumDilihat(() => true), []);
});
