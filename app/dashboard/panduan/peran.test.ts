// Pembatasan panduan per peran: siapa membaca bagian apa, dan apa yang tidak boleh dilewati lewat URL.
//
// Jalankan: node --import tsx --test app/dashboard/panduan/peran.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  DAFTAR_ISI,
  PERAN,
  PERAN_UNTUK_ROLE,
  SEMUA,
  bagianUntukPeran,
  bolehPilihPeran,
  cariPeran,
  peranBolehUntukRole,
  pilihanSahUntuk,
} from "./peran";
import { ROLES } from "@/lib/auth/roles";

test("hanya Super Admin membaca seluruh peran; peran lain membaca perannya sendiri saja", () => {
  assert.deepEqual([...peranBolehUntukRole(ROLES.SUPER_ADMIN)].sort(), PERAN.map((p) => p.id).sort());
  assert.deepEqual(peranBolehUntukRole(ROLES.ADMIN_UPT), ["upt"]);
  assert.deepEqual(peranBolehUntukRole(ROLES.KEUANGAN), ["keuangan"]);
  assert.deepEqual(peranBolehUntukRole(ROLES.SDM_KGB), ["sdm"]);
  assert.deepEqual(peranBolehUntukRole(ROLES.SDM_HUKDIS), ["hukdis"]);
});

test("setiap role yang dikenal authGuard punya peran panduannya", () => {
  for (const role of Object.values(ROLES)) {
    assert.ok(PERAN_UNTUK_ROLE[role], `role ${role} belum dipetakan ke peran panduan`);
    assert.ok(cariPeran(PERAN_UNTUK_ROLE[role]), `peran ${PERAN_UNTUK_ROLE[role]} tidak ada di PERAN`);
  }
});

test("Admin UPT tidak menerima satu pun bagian kerja Kanwil", () => {
  const tampil = bagianUntukPeran(peranBolehUntukRole(ROLES.ADMIN_UPT)).map((b) => b.id);
  // Bagian ini menerangkan kerja internal Kanwil dan tidak boleh ikut dirender di halaman Admin UPT.
  for (const tertutup of ["kewenangan", "di-kanwil", "di-sim-kgb", "keuangan", "pengiriman-sk", "dasar-hukum"]) {
    assert.ok(!tampil.includes(tertutup as (typeof tampil)[number]), `bagian ${tertutup} bocor ke Admin UPT`);
  }
  assert.ok(tampil.includes("untuk-upt"), "bagian Untuk Admin UPT harus ada");
});

test("Keuangan hanya menerima bagian perannya sendiri", () => {
  const tampil = bagianUntukPeran(peranBolehUntukRole(ROLES.KEUANGAN)).map((b) => b.id);
  assert.deepEqual(tampil, cariPeran("keuangan")!.bagian.slice());
  assert.ok(!tampil.includes("untuk-upt" as (typeof tampil)[number]));
  assert.ok(!tampil.includes("di-sim-kgb" as (typeof tampil)[number]));
});

test("Super Admin menerima seluruh bagian, urut seperti daftar isi", () => {
  const tampil = bagianUntukPeran(peranBolehUntukRole(ROLES.SUPER_ADMIN)).map((b) => b.id);
  assert.deepEqual(tampil, DAFTAR_ISI.map((b) => b.id));
});

test("?peran= di URL dijepit: peran lain dan \"semua\" ditolak bagi akun berperan tunggal", () => {
  const upt = peranBolehUntukRole(ROLES.ADMIN_UPT);
  assert.equal(pilihanSahUntuk("upt", upt), true);
  assert.equal(pilihanSahUntuk("sdm", upt), false);
  assert.equal(pilihanSahUntuk("keuangan", upt), false);
  // "Semua" pun tidak berlaku: bagian peran lain memang tidak dirender, jadi tidak ada yang dibuka.
  assert.equal(pilihanSahUntuk(SEMUA, upt), false);
  assert.equal(pilihanSahUntuk(null, upt), false);
  assert.equal(pilihanSahUntuk("", upt), false);

  const super_ = peranBolehUntukRole(ROLES.SUPER_ADMIN);
  assert.equal(pilihanSahUntuk(SEMUA, super_), true);
  assert.equal(pilihanSahUntuk("upt", super_), true);
  assert.equal(pilihanSahUntuk("tidak-ada", super_), false);
});

test("pemilih peran hanya muncul bagi akun yang membaca lebih dari satu peran", () => {
  assert.equal(bolehPilihPeran(peranBolehUntukRole(ROLES.SUPER_ADMIN)), true);
  for (const role of [ROLES.ADMIN_UPT, ROLES.KEUANGAN, ROLES.SDM_KGB, ROLES.SDM_HUKDIS]) {
    assert.equal(bolehPilihPeran(peranBolehUntukRole(role)), false, role);
  }
});

test("setiap bagian pada daftar isi dibaca setidaknya satu peran", () => {
  const dibaca = new Set(PERAN.flatMap((p) => p.bagian));
  for (const b of DAFTAR_ISI) assert.ok(dibaca.has(b.id), `bagian ${b.id} tidak dibaca peran mana pun`);
});

test("halaman merender bagian lewat <Bagian>, bukan <section> yang disembunyikan CSS", () => {
  // Penjaga regresi: kembali ke <section data-bagian="..."> berarti seluruh bagian terkirim ke setiap
  // pembaca lagi. Yang dicari hanya bentuk literalnya; <section> di dalam Bagian memakai data-bagian={id}.
  const isi = readFileSync(new URL("./IsiPanduan.tsx", import.meta.url), "utf8");
  const bagianLiteral = isi.match(/<section[^>]*\bdata-bagian="/g) ?? [];
  assert.deepEqual(bagianLiteral, [], "bagian masih dirender langsung sebagai <section>");
  assert.equal((isi.match(/<Bagian id="/g) ?? []).length, DAFTAR_ISI.length);
});
