// Jalankan: node --import tsx --test lib/satker.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { SATKER, SATKER_KANWIL, cariSatker, satkerPerKppn } from "./satker";

test("SATKER_KANWIL adalah Kantor Wilayah dengan KPPN Banjarmasin", () => {
  assert.equal(SATKER_KANWIL.kode, "kanwil");
  assert.equal(SATKER_KANWIL.kppn, "Banjarmasin");
});

test("cariSatker menemukan setiap satker dari nama dan kodenya", () => {
  for (const s of SATKER) {
    assert.equal(cariSatker(s.nama), s, s.nama);
    assert.equal(cariSatker(s.kode), s, s.kode);
  }
});

test("cariSatker menyeragamkan huruf, spasi, tanda baca, dan singkatan", () => {
  const kasus: [string, string][] = [
    ["  LAPAS KELAS IIA BANJARMASIN ", "lapas-banjarmasin"],
    ["Lembaga Pemasyarakatan Kelas IIA Banjarmasin", "lapas-banjarmasin"],
    ["Lapas Kls. II A Banjarmasin", "lapas-banjarmasin"],
    ["LP Kelas 2A Banjarmasin", "lapas-banjarmasin"],
    ["Rumah Tahanan Negara Kelas IIB Rantau", "rutan-rantau"],
    ["Rutan  Kelas II-B  Rantau", "rutan-rantau"],
    ["Balai Pemasyarakatan Kelas I Banjarmasin", "bapas-banjarmasin"],
    ["Lembaga Pembinaan Khusus Anak Kelas I Martapura", "lpka-martapura"],
    ["Lapas Perempuan Kelas IIA Martapura", "lapas-perempuan-martapura"],
    ["Lembaga Pemasyarakatan Kelas IIA Khusus Narkotika Karang Intan", "lapas-narkotika-karang-intan"],
    ["Kanwil Ditjenpas Kalsel", "kanwil"],
    ["Kantor Wilayah Ditjenpas Kalimantan Selatan", "kanwil"],
    ["kanwil direktorat jenderal pemasyarakatan kalsel", "kanwil"],
  ];
  for (const [teks, kode] of kasus) {
    assert.equal(cariSatker(teks)?.kode, kode, teks);
  }
});

test("cariSatker tidak mencocokkan kelas atau nama yang berbeda", () => {
  for (const teks of [
    "Lapas Kelas IIB Banjarmasin",
    "Lapas Kelas II Banjarmasin",
    "Bapas Kelas II Banjarmasin",
    "Bapas Kelas I Amuntai",
    "Rutan Kelas IIB",
    "Kanwil Kalsel",
    "",
    "   ",
    null,
    undefined,
  ]) {
    assert.equal(cariSatker(teks), undefined, String(teks));
  }
});

test("daftar satker lengkap dan kodenya unik", () => {
  assert.equal(SATKER.length, 19, "Kanwil ditambah 18 UPT");
  assert.equal(new Set(SATKER.map((s) => s.kode)).size, SATKER.length);
  assert.equal(SATKER.filter((s) => s.jenis === "kanwil").length, 1);
});

test("setiap satker masuk tepat satu kelompok KPPN", () => {
  const kelompok = satkerPerKppn();
  assert.equal(kelompok.reduce((jumlah, k) => jumlah + k.satker.length, 0), SATKER.length);
  assert.deepEqual(
    kelompok.map((k) => [k.kppn, k.satker.length]),
    [["Banjarmasin", 8], ["Barabai", 3], ["Tanjung", 4], ["Kotabaru", 3], ["Pelaihari", 1]],
  );
});

test("nama satker ditulis lengkap, tanpa singkatan", () => {
  // Permintaan pemilik: nama unit kerja tidak boleh disingkat (Lapas, Rutan, Bapas, LPKA).
  for (const s of SATKER) {
    assert.doesNotMatch(s.nama, /\b(Lapas|Rutan|Bapas|LPKA|Kanwil|Ditjenpas|Kalsel)\b/, s.kode);
  }
  const awalan = { lapas: "Lembaga Pemasyarakatan", rutan: "Rumah Tahanan Negara", bapas: "Balai Pemasyarakatan", lpka: "Lembaga Pembinaan Khusus Anak", kanwil: "Kantor Wilayah" };
  for (const s of SATKER) {
    assert.ok(s.nama.startsWith(awalan[s.jenis]), `${s.kode}: ${s.nama}`);
  }
});

test("nama satker yang masih tersingkat tetap dikenali", () => {
  // Data lama menyimpan unit kerja dalam bentuk singkat; pencocokan tidak boleh putus.
  assert.equal(cariSatker("Rutan Kelas IIB Rantau")?.kode, "rutan-rantau");
  assert.equal(cariSatker("Lapas Kelas IIA Banjarmasin")?.kode, "lapas-banjarmasin");
  assert.equal(cariSatker("Bapas Kelas I Banjarmasin")?.kode, "bapas-banjarmasin");
  assert.equal(cariSatker("LPKA Kelas I Martapura")?.kode, "lpka-martapura");
  assert.equal(cariSatker("Lapas Perempuan Kelas IIA Martapura")?.kode, "lapas-perempuan-martapura");
});
