// Inventarisasi KGB pegawai Kanwil: nama folder, nama berkas, pemeriksaan isian, dan baris rekap.
//
// Jalankan: node --import tsx --test lib/inventarisKgb.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KOLOM_REKAP,
  barisRekap,
  namaBerkasInventaris,
  namaFolderPegawai,
  periksaIsianInventaris,
  tanggalUntukBerkas,
  type IsianInventaris,
} from "./inventarisKgb";

const pernah: IsianInventaris = {
  keadaan: "pernah",
  nip: "199001012015031001",
  nama: "  Budi   Hartono, S.H. ",
  tempatLahir: "Banjarmasin",
  tanggalLahir: "1990-01-01",
  jabatan: "Analis SDM Aparatur",
  bidang: "Bagian Umum",
  golonganRuang: "III/b",
  tmtGolongan: "2023-04-01",
  mkgTahun: "8",
  mkgBulan: "0",
  tmtDasar: "2024-10-01",
  nomorSkDasar: "W.17-KP.04.03-123",
  tanggalSkDasar: "2024-09-20",
  tanggalSkPendukung: "2023-03-15",
  nomorWa: "0812-3456-7890",
  catatan: "",
};

test("nama folder NIP - Nama tanpa karakter terlarang", () => {
  assert.equal(namaFolderPegawai("199001012015031001", "Budi / Hartono: S.H."), "199001012015031001 - Budi Hartono S.H.");
});

test("nama berkas NIP_Jenis_TanggalSK, tanpa tanggal bila kosong", () => {
  assert.equal(
    namaBerkasInventaris("199001012015031001", "SK-KGB-Terakhir", "2024-09-20"),
    "199001012015031001_SK-KGB-Terakhir_2024-09-20.pdf",
  );
  assert.equal(namaBerkasInventaris("200101012025061001", "SK-PNS", ""), "200101012025061001_SK-PNS.pdf");
  assert.equal(tanggalUntukBerkas(pernah, "SK-KGB-Terakhir"), "2024-09-20");
  assert.equal(tanggalUntukBerkas(pernah, "SK-KP-Terakhir"), "2023-03-15");
});

test("isian lengkap lolos; yang kurang disebutkan", () => {
  assert.deepEqual(periksaIsianInventaris(pernah), []);
  const kurang = periksaIsianInventaris({ ...pernah, nip: "123", mkgBulan: "12", tanggalSkPendukung: "" });
  assert.ok(kurang.includes("NIP harus 18 angka"));
  assert.ok(kurang.some((k) => k.startsWith("masa kerja golongan (bulan)")));
  assert.ok(kurang.includes("tanggal SK kenaikan pangkat terakhir"));
});

test("belum pernah KGB tidak menuntut masa kerja dan SK kenaikan pangkat", () => {
  const belum: IsianInventaris = { ...pernah, keadaan: "belum", mkgTahun: "", mkgBulan: "", tanggalSkPendukung: "" };
  assert.deepEqual(periksaIsianInventaris(belum), []);
  const baris = barisRekap(belum);
  assert.equal(baris[0], "Belum pernah KGB");
  assert.equal(baris[10], "0");
  assert.equal(baris[11], "0");
});

test("baris rekap sejajar dengan kolomnya dan dirapikan", () => {
  const baris = barisRekap(pernah);
  assert.equal(baris.length, KOLOM_REKAP.length - 2);
  assert.equal(baris[2], "Budi Hartono, S.H.");
  assert.equal(baris[8], "Penata Muda Tingkat I");
  assert.equal(baris[16], "081234567890");
});
