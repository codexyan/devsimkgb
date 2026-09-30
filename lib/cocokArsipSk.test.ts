// Pencocokan SK yang diarsipkan dengan hitungan sistem (ADR-035).
//
// Jalankan: node --import tsx --test lib/cocokArsipSk.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { bacaAngkaSk, bedaArsipSk, pesanBedaArsip } from "./cocokArsipSk";
import { kalkulasiKGB } from "./tabelGaji";

test("angka yang sama dianggap cocok", () => {
  const sama = { mkgTahun: 14, mkgBulan: 0, gajiPokok: 3607500 };
  assert.deepEqual(bedaArsipSk(sama, sama), []);
  assert.equal(pesanBedaArsip([]), "");
});

test("masa kerja dan gaji pokok yang berbeda disebut satu per satu", () => {
  const beda = bedaArsipSk(
    { mkgTahun: 13, mkgBulan: 5, gajiPokok: 3497300 },
    { mkgTahun: 14, mkgBulan: 0, gajiPokok: 3607500 },
  );
  assert.deepEqual(beda, [
    { label: "Masa kerja golongan", sistem: "13 tahun 5 bulan", sk: "14 tahun 0 bulan" },
    { label: "Gaji pokok", sistem: "Rp3.497.300", sk: "Rp3.607.500" },
  ]);
  const pesan = pesanBedaArsip(beda);
  // Pesannya harus menunjuk data dasar pegawai, bukan menyalahkan SK yang sudah ditandatangani.
  assert.match(pesan, /Data Pegawai/);
  assert.match(pesan, /14 tahun 0 bulan/);
});

test("kasus nyata: SK KGB terlambat cocok bila masa kerja dasarnya benar", () => {
  // SK WP.19-SA.04.04-172: dasar 1 Okt 2022 MKG 10 th 7 bl, TMT KGB 1 Mar 2026, hasil 14 th 0 bl.
  const hitung = (mkgTahun: number, mkgBulan: number) =>
    kalkulasiKGB({
      golonganRuang: "III/b",
      mkgTahun,
      mkgBulan,
      tmtKgbTerakhir: new Date(Date.UTC(2022, 9, 1)),
      tmtKgbBerikutnya: new Date(Date.UTC(2026, 2, 1)),
      hariIni: new Date(Date.UTC(2026, 8, 30)),
    });
  const sk = { mkgTahun: 14, mkgBulan: 0, gajiPokok: 3607500 };

  // Masa kerja dasar sesuai SK: sistem menghasilkan angka SK persis, jadi arsip boleh jalan.
  const benar = hitung(10, 7);
  assert.deepEqual(
    bedaArsipSk({ mkgTahun: benar.mkgTahunBaru, mkgBulan: benar.mkgBulanBaru, gajiPokok: benar.gajiPokokBaru }, sk),
    [],
  );

  // Masa kerja dasar meleset tujuh bulan: pengarsipan harus tertahan, bukan menyimpan angka yang keliru.
  const keliru = hitung(10, 0);
  const beda = bedaArsipSk(
    { mkgTahun: keliru.mkgTahunBaru, mkgBulan: keliru.mkgBulanBaru, gajiPokok: keliru.gajiPokokBaru },
    sk,
  );
  assert.equal(beda.length, 2);
  assert.equal(beda[0].sistem, "13 tahun 5 bulan");
});

test("isian mentah dibaca, termasuk gaji pokok bertitik seperti tertulis di SK", () => {
  assert.deepEqual(bacaAngkaSk({ mkgTahun: "14", mkgBulan: "0", gajiPokok: "3.607.500" }), {
    mkgTahun: 14,
    mkgBulan: 0,
    gajiPokok: 3607500,
  });
  assert.deepEqual(bacaAngkaSk({ mkgTahun: 14, mkgBulan: 0, gajiPokok: 3607500 }), {
    mkgTahun: 14,
    mkgBulan: 0,
    gajiPokok: 3607500,
  });
});

test("isian yang belum lengkap atau di luar nalar ditolak", () => {
  assert.equal(bacaAngkaSk({ mkgTahun: "14", mkgBulan: "", gajiPokok: "3.607.500" }), null);
  assert.equal(bacaAngkaSk({ mkgTahun: "14", mkgBulan: "12", gajiPokok: "3607500" }), null, "bulan 12 tidak sah");
  assert.equal(bacaAngkaSk({ mkgTahun: "41", mkgBulan: "0", gajiPokok: "3607500" }), null, "41 tahun tidak masuk akal");
  assert.equal(bacaAngkaSk({ mkgTahun: "14", mkgBulan: "0", gajiPokok: "0" }), null, "gaji pokok nol tidak sah");
});
