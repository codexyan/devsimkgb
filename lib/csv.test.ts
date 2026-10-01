// Bentuk berkas CSV yang diunduh: kepala berkas, pemisah, dan pembuangannya saat berkas yang sama
// diunggah kembali.
//
// Jalankan: node --import tsx --test lib/csv.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import Papa from "papaparse";
import { KEPALA_BERKAS_CSV, buangPetunjukPemisah, keBerkasCsv, selCsv } from "./csv";

test("berkas diawali BOM lalu sep=;, dan barisnya dipisah titik koma", () => {
  const isi = keBerkasCsv([
    ["nip", "nama"],
    ["198804012023011027", "Putri"],
  ]);
  assert.equal(isi, "﻿sep=;\r\nnip;nama\r\n198804012023011027;Putri\r\n");
  assert.ok(isi.startsWith(KEPALA_BERKAS_CSV));
});

test("sel dikutip bila memuat titik koma, koma, petik, atau pindah baris", () => {
  // Koma ikut dikutip meski bukan pemisah, agar berkasnya tetap utuh di pengurai yang menebak pemisah.
  assert.equal(selCsv("Putri, S.H."), '"Putri, S.H."');
  assert.equal(selCsv("Lapas Kelas IIA; Banjarmasin"), '"Lapas Kelas IIA; Banjarmasin"');
  assert.equal(selCsv('Putri "Dayang"'), '"Putri ""Dayang"""');
  assert.equal(selCsv("baris\nkedua"), '"baris\nkedua"');
  assert.equal(selCsv("Pengatur"), "Pengatur");
  assert.equal(selCsv(null), "");
  assert.equal(selCsv(undefined), "");
  assert.equal(selCsv(new Date("2026-06-01T00:00:00Z")), "2026-06-01T00:00:00.000Z");
});

test("petunjuk pemisah dibuang saat berkas diunggah kembali, BOM-nya dibiarkan", () => {
  assert.equal(buangPetunjukPemisah("﻿sep=;\r\nnip;nama\r\n"), "﻿nip;nama\r\n");
  assert.equal(buangPetunjukPemisah("sep=,\nnip,nama\n"), "nip,nama\n");
  // Berkas tanpa petunjuk — misalnya simpanan ulang Excel — tidak berubah sama sekali.
  assert.equal(buangPetunjukPemisah("﻿nip;nama\r\n"), "﻿nip;nama\r\n");
  assert.equal(buangPetunjukPemisah("nip,nama\n"), "nip,nama\n");
  // "separator" bukan petunjuk; yang dibuang hanya sep= dengan satu huruf pemisah.
  assert.equal(buangPetunjukPemisah("separator;nama\r\n"), "separator;nama\r\n");
});

test("templat yang diunduh terurai kembali oleh PapaParse, baik bertitik koma maupun berkoma", () => {
  const titikKoma = keBerkasCsv([
    ["nip", "nama", "jabatan"],
    ["198804012023011027", "Putri, S.H.", "Pengadministrasi Persuratan"],
  ]);
  const baris = Papa.parse<Record<string, string>>(buangPetunjukPemisah(titikKoma), {
    header: true,
    skipEmptyLines: true,
  });
  assert.deepEqual(baris.data, [
    { nip: "198804012023011027", nama: "Putri, S.H.", jabatan: "Pengadministrasi Persuratan" },
  ]);

  // Berkas yang disimpan ulang Excel berlokal lain memakai koma; pemisahnya ditebak PapaParse sendiri.
  const koma = '﻿nip,nama,jabatan\r\n198804012023011027,"Putri, S.H.",Pengadministrasi Persuratan\r\n';
  const hasilKoma = Papa.parse<Record<string, string>>(buangPetunjukPemisah(koma), {
    header: true,
    skipEmptyLines: true,
  });
  assert.deepEqual(hasilKoma.data, baris.data);
});
