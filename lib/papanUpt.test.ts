// Papan alur KGB satker: satu pegawai satu kartu (ADR-026).
//
// Jalankan: node --import tsx --test lib/papanUpt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { gabungKartuUpt, kartuPerKolom, type SumberKartu } from "./papanUpt";

const s = (k: Partial<SumberKartu> & Pick<SumberKartu, "kunci" | "kolom">): SumberKartu => ({
  pegawaiId: null,
  nip: "",
  ringkas: k.kunci,
  ...k,
});

test("dua usulan disetujui untuk orang yang sama menjadi satu kartu", () => {
  // Kasus nyata 28 Sep 2026: Noorhikmah diusulkan dua kali, keduanya disetujui dalam 60 hari.
  const hasil = gabungKartuUpt([
    s({ kunci: "usulan:lama", kolom: "selesai", pegawaiId: "p1", nip: "199809042025062014", waktu: "2026-09-26", ringkas: "usulan disetujui 26 Sep" }),
    s({ kunci: "usulan:baru", kolom: "selesai", pegawaiId: "p1", nip: "199809042025062014", waktu: "2026-09-27", ringkas: "usulan disetujui 27 Sep" }),
  ]);
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].utama.kunci, "usulan:baru", "yang terbaru menjadi kartu utama");
  assert.deepEqual(hasil[0].lain.map((l) => l.ringkas), ["usulan disetujui 26 Sep"]);
});

test("kartu utama diambil dari kolom yang paling perlu dikerjakan UPT", () => {
  const sumber = [
    s({ kunci: "sk:1", kolom: "selesai", pegawaiId: "p1", nip: "1", waktu: "2026-09-20", ringkas: "SK direkam" }),
    s({ kunci: "proses:p1", kolom: "kanwil", pegawaiId: "p1", nip: "1", ringkas: "SK sedang dibuat Kanwil" }),
    s({ kunci: "usulan:1", kolom: "kerja", pegawaiId: "p1", nip: "1", ringkas: "draf belum lengkap" }),
  ];
  const hasil = gabungKartuUpt(sumber);
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].kolom, "kerja");
  assert.deepEqual(hasil[0].lain.map((l) => l.kunci), ["proses:p1", "sk:1"], "sisanya disebut sebagai dokumen lain");
  // Tanpa kartu "kerja", giliran "sk" yang menang atas "kanwil" dan "selesai".
  const tanpaKerja = gabungKartuUpt([
    s({ kunci: "sk:2", kolom: "sk", pegawaiId: "p2", nip: "2", ringkas: "siap direkam" }),
    s({ kunci: "proses:p2", kolom: "kanwil", pegawaiId: "p2", nip: "2", ringkas: "di Kanwil" }),
  ]);
  assert.equal(tanpaKerja[0].kolom, "sk");
});

test("usulan pegawai baru tanpa pegawaiId tergabung lewat NIP", () => {
  const hasil = gabungKartuUpt([
    s({ kunci: "usulan:baru", kolom: "kerja", pegawaiId: null, nip: "199001012015031001", ringkas: "usulan pegawai baru" }),
    s({ kunci: "pegawai:p9", kolom: "kerja", pegawaiId: "p9", nip: "1990 0101 2015 031001", ringkas: "perlu diperiksa" }),
  ]);
  assert.equal(hasil.length, 1, "NIP yang sama dianggap orang yang sama walau ditulis berspasi");
  assert.equal(hasil[0].lain.length, 1);
});

test("orang yang berbeda tidak digabungkan, dan urutan kolom asli dipertahankan", () => {
  const per = kartuPerKolom([
    s({ kunci: "usulan:a", kolom: "kerja", pegawaiId: "p1", nip: "1", ringkas: "a" }),
    s({ kunci: "usulan:b", kolom: "kerja", pegawaiId: "p2", nip: "2", ringkas: "b" }),
    s({ kunci: "sk:c", kolom: "sk", pegawaiId: "p3", nip: "3", ringkas: "c" }),
  ]);
  assert.deepEqual(per.kerja.map((k) => k.kunci), ["usulan:a", "usulan:b"]);
  assert.deepEqual(per.sk.map((k) => k.kunci), ["sk:c"]);
  assert.deepEqual(per.kanwil, []);
  assert.deepEqual(per.selesai, []);
});

test("sumber tanpa pegawaiId dan tanpa NIP tidak pernah tergabung satu sama lain", () => {
  const hasil = gabungKartuUpt([
    s({ kunci: "laporan:1", kolom: "kanwil", ringkas: "laporan 1" }),
    s({ kunci: "laporan:2", kolom: "kanwil", ringkas: "laporan 2" }),
  ]);
  assert.equal(hasil.length, 2);
});
