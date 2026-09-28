// Perubahan sebagian data pegawai: kolom yang tidak dikirim memakai nilai tersimpan (ADR-025).
//
// Jalankan: node --import tsx --test lib/gabungIsianPegawai.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { bacaIsianPegawai, gabungIsianPegawai } from "./dataPegawai";
import { getGajiPokok } from "./tabelGaji";

const tersimpan = {
  nip: "199001012015031001",
  nama: "Budi Hartono",
  tempatLahir: "Banjarmasin",
  tanggalLahir: new Date("1990-01-01T00:00:00Z"),
  jenisKelamin: "L",
  pendidikanTerakhir: "S-1",
  jabatan: "Analis Kepegawaian",
  pangkat: "Penata Muda",
  golonganRuang: "III/a",
  unitKerja: "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan",
  eselon: null,
  jenisJabatan: "fungsional",
  tmtGolongan: new Date("2023-04-01T00:00:00Z"),
  mkgTahun: 4,
  mkgBulan: 0,
  gajiPokok: getGajiPokok("III/a", 4, 0),
  tmtKgbTerakhir: new Date("2024-12-01T00:00:00Z"),
  tmtKgbBerikutnya: new Date("2026-12-01T00:00:00Z"),
  nomorSkDasar: "W.19-KP.04.03-1",
  tanggalSkDasar: new Date("2024-11-20T00:00:00Z"),
  penetapSkDasar: "Kepala Kantor Wilayah",
};

test("mengubah satu isian tidak menimpa isian lain", () => {
  const hasil = bacaIsianPegawai(gabungIsianPegawai({ jabatan: "Pengelola Data Kepegawaian" }, tersimpan), { denganNip: false });
  assert.equal(hasil.galat, undefined);
  if (hasil.galat !== undefined) return;
  assert.equal(hasil.data.jabatan, "Pengelola Data Kepegawaian");
  assert.equal(hasil.data.nama, "Budi Hartono");
  assert.equal(hasil.data.golonganRuang, "III/a");
  assert.equal(hasil.data.gajiPokok, tersimpan.gajiPokok);
  assert.equal(hasil.data.tmtKgbTerakhir?.getTime(), tersimpan.tmtKgbTerakhir.getTime());
  assert.equal(hasil.data.tmtKgbBerikutnya?.getTime(), tersimpan.tmtKgbBerikutnya.getTime());
  assert.equal(hasil.data.penetapSkDasar, "Kepala Kantor Wilayah");
});

test("gaji pokok dihitung ulang bila dasar gajinya berubah tanpa mengirim gaji", () => {
  const naik = bacaIsianPegawai(gabungIsianPegawai({ mkgTahun: 6 }, tersimpan), { denganNip: false });
  assert.equal(naik.galat, undefined);
  if (naik.galat !== undefined) return;
  assert.equal(naik.data.mkgTahun, 6);
  assert.equal(naik.data.gajiPokok, getGajiPokok("III/a", 6, 0));
  // Gaji yang dikirim sendiri tetap dihormati.
  const manual = bacaIsianPegawai(gabungIsianPegawai({ mkgTahun: 6, gajiPokok: 9_000_000 }, tersimpan), { denganNip: false });
  assert.equal(manual.galat, undefined);
  if (manual.galat === undefined) assert.equal(manual.data.gajiPokok, 9_000_000);
});

test("isian kosong yang dikirim tetap mengosongkan, bukan dianggap tidak dikirim", () => {
  const hasil = bacaIsianPegawai(gabungIsianPegawai({ eselon: "", penetapSkDasar: "" }, tersimpan), { denganNip: false });
  assert.equal(hasil.galat, undefined);
  if (hasil.galat !== undefined) return;
  assert.equal(hasil.data.penetapSkDasar, null);
  assert.equal(hasil.data.eselon, null);
});
