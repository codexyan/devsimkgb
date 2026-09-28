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
  tanggalLahirDariNip,
  tanggalUntukBerkas,
  tmtCpnsDariNip,
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
  naikSetelahKgb: "tidak",
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
  assert.equal(baris[10], "");
  assert.equal(baris[11], "0");
  assert.equal(baris[12], "0");
});

test("kenaikan pangkat setelah KGB terakhir: pertanyaannya wajib dan TMT golongan harus cocok dengan jawabannya", () => {
  // Penyesuaian ijazah II/c MKG 9 th ke III/a (dipotong 5 tahun) sesudah KGB terakhir.
  const pi: IsianInventaris = {
    ...pernah,
    golonganRuang: "III/a",
    tmtGolongan: "2026-04-01",
    naikSetelahKgb: "ya",
    mkgTahun: "4",
    mkgBulan: "1",
    tmtDasar: "2025-03-01",
    tanggalSkPendukung: "2026-03-20",
  };
  assert.deepEqual(periksaIsianInventaris(pi), []);
  assert.equal(barisRekap(pi)[10], "Ya");
  assert.ok(periksaIsianInventaris({ ...pi, naikSetelahKgb: "" }).some((k) => k.startsWith("jawab apakah Anda naik pangkat")));
  assert.ok(periksaIsianInventaris({ ...pi, naikSetelahKgb: "tidak" }).some((k) => k.startsWith("TMT golongan sesudah TMT KGB")));
  assert.ok(periksaIsianInventaris({ ...pi, tmtGolongan: "2024-04-01" }).some((k) => k.startsWith("TMT golongan lebih awal")));
});

test("tanggal lahir harus sama dengan NIP dan usianya wajar", () => {
  assert.equal(tanggalLahirDariNip("196911091994032001"), "1969-11-09");
  assert.equal(tanggalLahirDariNip("19691339199403200"), "");
  assert.equal(tmtCpnsDariNip("200001032025061009"), "2025-06-01");
  // Kiriman nyata: tanggal lahir terisi tanggal hari pengisian.
  const hariIni = periksaIsianInventaris({ ...pernah, tanggalLahir: "2026-09-28" }, "2026-09-28");
  assert.ok(hariIni.some((k) => k.startsWith("tanggal lahir tidak sama dengan NIP (NIP Anda menunjukkan 01-01-1990)")));
  // NIP dengan tanggal lahir tak sah tidak dicocokkan, tetapi usianya tetap diperiksa.
  const nipAneh = { ...pernah, nip: "199013012015031001", tanggalLahir: "2020-01-01" };
  assert.ok(periksaIsianInventaris(nipAneh, "2026-09-28").includes("tanggal lahir tidak wajar; periksa tahunnya"));
  assert.deepEqual(periksaIsianInventaris(pernah, "2026-09-28"), []);
});

test("Sudah pernah KGB ditolak bila TMT KGB terakhir tidak sesudah TMT CPNS pada NIP", () => {
  // Kiriman nyata: CPNS TMT Juni 2025 memilih "Sudah pernah KGB" dengan TMT KGB = TMT CPNS.
  const cpns: IsianInventaris = {
    ...pernah,
    nip: "200001032025061009",
    tanggalLahir: "2000-01-03",
    golonganRuang: "III/a",
    tmtGolongan: "2025-06-01",
    tmtDasar: "2025-06-01",
    mkgTahun: "1",
  };
  assert.ok(periksaIsianInventaris(cpns, "2026-09-28").some((k) => k.startsWith("TMT KGB terakhir tidak sesudah TMT CPNS")));
  assert.ok(periksaIsianInventaris({ ...cpns, keadaan: "belum" }, "2026-09-28").every((k) => !k.startsWith("TMT KGB terakhir")));
});

test("kiriman lama tanpa jawaban kenaikan pangkat tetap terbaca di rekap", () => {
  const lama = { ...pernah } as Partial<IsianInventaris>;
  delete lama.naikSetelahKgb;
  assert.equal(barisRekap(lama as IsianInventaris)[10], "");
});

test("baris rekap sejajar dengan kolomnya dan dirapikan", () => {
  const baris = barisRekap(pernah);
  assert.equal(baris.length, KOLOM_REKAP.length - 2);
  assert.equal(baris[2], "Budi Hartono, S.H.");
  assert.equal(baris[8], "Penata Muda Tingkat I");
  assert.equal(baris[10], "Tidak");
  assert.equal(baris[17], "081234567890");
});
