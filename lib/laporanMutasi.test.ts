// Daur hidup laporan mutasi dari UPT.
//
// Jalankan: node --import tsx --test lib/laporanMutasi.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { LAPORAN_DIPEGANG_UPT, STATUS_LAPORAN_MUTASI, adaLaporanBerjalan } from "./laporanMutasi";

test("laporan yang belum ditetapkan menutup pintu laporan kedua", () => {
  // Satu kepindahan yang dilaporkan dua kali membuat Kanwil mencatat mutasi yang sama dua kali,
  // dan riwayatnya tidak lagi dapat dipercaya.
  for (const status of ["menunggu", "dikembalikan"]) {
    assert.equal(adaLaporanBerjalan([{ pegawaiId: "p1", status }], "p1"), true, status);
  }
  // Yang sudah diterima justru harus membuka pintu lagi: pegawai bisa saja BKO lalu selesai BKO.
  assert.equal(adaLaporanBerjalan([{ pegawaiId: "p1", status: "diterima" }], "p1"), false);
  // Laporan pegawai lain tidak menghalangi.
  assert.equal(adaLaporanBerjalan([{ pegawaiId: "p2", status: "menunggu" }], "p1"), false);
  assert.equal(adaLaporanBerjalan([], "p1"), false);
});

test("status yang masih dipegang UPT sama dengan yang boleh dibatalkan sendiri", () => {
  assert.deepEqual([...LAPORAN_DIPEGANG_UPT], ["menunggu", "dikembalikan"]);
  assert.equal(LAPORAN_DIPEGANG_UPT.includes("diterima"), false);
});

test("tiap status punya label dan warna yang berbeda", () => {
  const nada = Object.values(STATUS_LAPORAN_MUTASI).map((s) => s.nada);
  assert.equal(new Set(nada).size, nada.length);
  assert.equal(STATUS_LAPORAN_MUTASI.diterima.label, "Sudah dicatat Kanwil");
});
