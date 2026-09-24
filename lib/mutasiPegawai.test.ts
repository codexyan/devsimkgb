// Mutasi dan pemberhentian pegawai.
//
// Jalankan: node --import tsx --test lib/mutasiPegawai.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  berhakKgb,
  kekuranganMutasi,
  perubahanPegawaiMutasi,
  ringkasKeadaanPegawai,
  sudahBerhenti,
} from "./mutasiPegawai";

const tgl = (y: number, m: number, d = 1) => new Date(Date.UTC(y, m - 1, d));

test("mutasi definitif memindahkan unit kerja, BKO tidak", () => {
  const dasar = { tmt: tgl(2026, 10), nomorSk: "W.19-1", alasan: null };

  const definitif = perubahanPegawaiMutasi({ ...dasar, jenis: "definitif", satkerTujuan: "rutan-rantau" }, "Rumah Tahanan Negara Kelas IIB Rantau");
  assert.equal(definitif.unitKerja, "Rumah Tahanan Negara Kelas IIB Rantau");
  assert.equal(definitif.satkerTugas, null, "penugasan BKO sebelumnya ikut selesai");

  const bko = perubahanPegawaiMutasi({ ...dasar, jenis: "bko", satkerTujuan: "rutan-rantau" }, "Rumah Tahanan Negara Kelas IIB Rantau");
  assert.equal(bko.unitKerja, undefined, "gaji dan KGB tetap di satker asal");
  assert.equal(bko.satkerTugas, "Rumah Tahanan Negara Kelas IIB Rantau");

  const selesai = perubahanPegawaiMutasi({ ...dasar, jenis: "selesai_bko" }, null);
  assert.equal(selesai.satkerTugas, null);
});

test("pemberhentian mencatat tanggal dan alasannya, tanpa menghapus apa pun", () => {
  const hasil = perubahanPegawaiMutasi(
    { jenis: "pemberhentian", tmt: tgl(2026, 11), nomorSk: "W.19-9", alasan: "Pensiun (batas usia pensiun)" },
    null,
  );
  assert.deepEqual(hasil, { berhentiTmt: new Date(2026, 10, 1), berhentiAlasan: "Pensiun (batas usia pensiun)" });
  assert.equal("unitKerja" in hasil, false, "pemberhentian tidak memindahkan unit kerja");
});

test("KGB yang TMT-nya sebelum tanggal berhenti tetap menjadi hak pegawai", () => {
  const pensiun = { berhentiTmt: tgl(2026, 11) };
  assert.equal(berhakKgb(pensiun, tgl(2026, 10)), true, "KGB Oktober, berhenti November");
  assert.equal(berhakKgb(pensiun, tgl(2026, 11)), false, "KGB tepat pada tanggal berhenti");
  assert.equal(berhakKgb(pensiun, tgl(2027, 6)), false);
  assert.equal(berhakKgb({}, tgl(2027, 6)), true, "pegawai yang tidak berhenti selalu berhak");
});

test("keadaan pegawai diringkas untuk daftar, dengan nada yang sesuai", () => {
  const hariIni = tgl(2026, 9, 24);
  assert.deepEqual(
    ringkasKeadaanPegawai({ berhentiTmt: tgl(2026, 8), berhentiAlasan: "Meninggal dunia" }, hariIni),
    { teks: "Berhenti (Meninggal dunia)", nada: "merah" },
  );
  assert.deepEqual(
    ringkasKeadaanPegawai({ berhentiTmt: tgl(2026, 12), berhentiAlasan: "Pensiun (batas usia pensiun)" }, hariIni),
    { teks: "Akan berhenti (Pensiun (batas usia pensiun))", nada: "kuning" },
  );
  assert.deepEqual(
    ringkasKeadaanPegawai({ satkerTugas: "Rumah Tahanan Negara Kelas IIB Rantau" }, hariIni),
    { teks: "BKO di Rumah Tahanan Negara Kelas IIB Rantau", nada: "kuning" },
  );
  assert.equal(ringkasKeadaanPegawai({}, hariIni), null);
  assert.equal(sudahBerhenti({ berhentiTmt: tgl(2026, 12) }, hariIni), false);
  assert.equal(sudahBerhenti({ berhentiTmt: tgl(2026, 9, 24) }, hariIni), true);
});

test("pencatatan yang belum lengkap menyebut apa yang kurang", () => {
  assert.deepEqual(kekuranganMutasi({ jenis: "definitif" }), ["TMT berlaku", "satker tujuan", "nomor SK"]);
  assert.deepEqual(kekuranganMutasi({ jenis: "pemberhentian", tmt: tgl(2026, 11), nomorSk: "W.19-9" }), ["alasan pemberhentian"]);
  assert.deepEqual(kekuranganMutasi({ jenis: "selesai_bko", tmt: tgl(2026, 11), nomorSk: "W.19-9" }), []);
  assert.deepEqual(
    kekuranganMutasi({ jenis: "bko", tmt: tgl(2026, 11), nomorSk: "W.19-9", satkerTujuan: "rutan-rantau" }),
    [],
  );
});
