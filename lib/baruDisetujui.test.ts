// Pegawai yang baru disetujui tetap tampil di papan walau jadwal KGB-nya belum dibuka (ADR-117).
//
// Jalankan: node --import tsx --test lib/baruDisetujui.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { HARI_BARU_DISETUJUI, barusajaDisetujui, kartuSetelahAcc, type KeadaanSetelahAcc } from "./baruDisetujui";

/** 20 Oktober 2026, awal hari kalender (seperti hariIniWita). */
const HARI_INI = new Date(2026, 9, 20);
const hariLalu = (n: number, jam = 9) => new Date(2026, 9, 20 - n, jam).toISOString();

const p = (o: Partial<KeadaanSetelahAcc> = {}): KeadaanSetelahAcc => ({
  statusKGB: null,
  terkunci: false,
  usulanBerjalan: null,
  konfirmasi: "berlaku",
  konfirmasiAt: hariLalu(0),
  ...o,
});

test("disetujui hari ini, kemarin, dan dua minggu lalu masih baru; lebih lama tidak", () => {
  assert.equal(barusajaDisetujui(hariLalu(0, 15), HARI_INI), true, "sore ini, sesudah awal hari");
  assert.equal(barusajaDisetujui(hariLalu(1), HARI_INI), true);
  assert.equal(barusajaDisetujui(hariLalu(HARI_BARU_DISETUJUI), HARI_INI), true);
  assert.equal(barusajaDisetujui(hariLalu(HARI_BARU_DISETUJUI + 1), HARI_INI), false);
  assert.equal(barusajaDisetujui(hariLalu(60), HARI_INI), false);
});

test("waktu kosong atau tidak valid tidak dihitung baru", () => {
  assert.equal(barusajaDisetujui(null, HARI_INI), false);
  assert.equal(barusajaDisetujui(undefined, HARI_INI), false);
  assert.equal(barusajaDisetujui("bukan tanggal", HARI_INI), false);
  assert.equal(barusajaDisetujui(new Date(2026, 9, 25), HARI_INI), false, "jauh di masa depan");
});

test("jendela sudah dibuka dan konfirmasi berlaku: kartu siap, berapa pun lama disetujuinya (ADR-082)", () => {
  assert.equal(kartuSetelahAcc(p(), HARI_INI), "siap");
  assert.equal(kartuSetelahAcc(p({ konfirmasiAt: hariLalu(90) }), HARI_INI), "siap");
  assert.equal(kartuSetelahAcc(p({ statusKGB: "belum_diproses" }), HARI_INI), "siap");
});

test("jendela sudah dibuka tetapi konfirmasi tidak berlaku: tidak ada kartu ini (ditangani tugas Perlu diperiksa)", () => {
  assert.equal(kartuSetelahAcc(p({ konfirmasi: "kedaluwarsa" }), HARI_INI), null);
  assert.equal(kartuSetelahAcc(p({ konfirmasi: "belum" }), HARI_INI), null);
});

test("kasus pengguna: baru disetujui tetapi TMT masih jauh (terkunci) tetap punya kartu sementara", () => {
  assert.equal(kartuSetelahAcc(p({ terkunci: true }), HARI_INI), "baru");
  // Jadwal digeser hukuman disiplin: konfirmasi TMT-nya tertinggal (ADR-113), tetapi persetujuannya tetap terlihat.
  assert.equal(kartuSetelahAcc(p({ terkunci: true, konfirmasi: "kedaluwarsa" }), HARI_INI), "baru");
});

test("terkunci dan sudah lama disetujui: tidak lagi ada kartu, ia menunggu di jadwal", () => {
  assert.equal(kartuSetelahAcc(p({ terkunci: true, konfirmasiAt: hariLalu(HARI_BARU_DISETUJUI + 1) }), HARI_INI), null);
  assert.equal(kartuSetelahAcc(p({ terkunci: true, konfirmasiAt: null }), HARI_INI), null);
});

test("KGB yang sudah berjalan atau usulan data yang masih berjalan dipegang kartu lain", () => {
  for (const statusKGB of ["sedang_diproses", "menunggu_keuangan", "selesai"]) {
    assert.equal(kartuSetelahAcc(p({ statusKGB }), HARI_INI), null, statusKGB);
    assert.equal(kartuSetelahAcc(p({ statusKGB, terkunci: true }), HARI_INI), null, `${statusKGB} terkunci`);
  }
  for (const usulanBerjalan of ["draf", "menunggu", "revisi"]) {
    assert.equal(kartuSetelahAcc(p({ usulanBerjalan }), HARI_INI), null, usulanBerjalan);
    assert.equal(kartuSetelahAcc(p({ usulanBerjalan, terkunci: true }), HARI_INI), null, `${usulanBerjalan} terkunci`);
  }
});

test("kedua papan memakai aturan yang sama (penjaga sumber)", () => {
  const upt = readFileSync("app/dashboard/components/DashboardUpt.tsx", "utf8");
  assert.match(upt, /kartuSetelahAcc\(p, hariIni\)/, "papan UPT memakai kartuSetelahAcc");
  const kanwil = readFileSync("app/api/dashboard/route.ts", "utf8");
  assert.match(kanwil, /barusajaDisetujui\(p\.konfirmasiUptAt, hariIni\)/, "pipeline Kanwil memuat yang baru disetujui");
  assert.match(kanwil, /!belumDitinjau\.has\(p\.id\) && barusajaDisetujui/, "pegawai yang usulan barunya belum ditinjau tidak ikut");
});
