// Pemutakhiran data pegawai: perbandingan kiriman dengan Data Pegawai, jalur penerapan, dan peringatan.
//
// Jalankan: node --import tsx --test lib/pemutakhiranPegawai.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import type { IsianInventaris } from "./inventarisKgb";
import { bandingkanKiriman, peringatanKiriman, type PegawaiBanding } from "./pemutakhiranPegawai";

const pegawai: PegawaiBanding = {
  nama: "Akhmad Mudzakir, S.E.",
  tempatLahir: "Banjarmasin",
  tanggalLahir: "1992-12-08",
  jabatan: "Pengelola Data",
  golonganRuang: "III/a",
  tmtGolongan: "2026-02-01",
  mkgTahun: 2,
  mkgBulan: 0,
  tmtKgbTerakhir: "2024-12-01",
  unitKerja: "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan",
  nomorSkDasar: null,
  tanggalSkDasar: null,
};

// Kiriman nyata 28 Sep 2026: PI ke III/a, tetapi MKG masih masa kerja golongan II.
const kiriman: IsianInventaris = {
  keadaan: "pernah",
  nip: "199212082017121005",
  nama: "AKHMAD MUDZAKIR, S.E.",
  tempatLahir: "Banjarmasin",
  tanggalLahir: "1992-12-08",
  jabatan: "Pengelola Data Kepegawaian",
  bidang: "",
  golonganRuang: "III/a",
  tmtGolongan: "2026-02-01",
  naikSetelahKgb: "",
  pmkSetelahKgb: "",
  tmtPmk: "",
  tanggalSkPmk: "",
  mkgTahun: "7",
  mkgBulan: "0",
  tmtDasar: "2024-12-01",
  nomorSkDasar: "W.19-KP.04.03-1",
  tanggalSkDasar: "2024-11-20",
  tanggalSkPendukung: "2026-01-29",
  nomorWa: "",
  catatan: "",
};

test("isian identitas yang sama tidak ditandai; beda huruf besar-kecil nama tidak dihitung", () => {
  const baris = bandingkanKiriman(pegawai, kiriman);
  const cari = (k: string) => baris.find((b) => b.kunci === k)!;
  assert.equal(cari("nama").beda, false);
  assert.equal(cari("tanggalLahir").beda, false);
  assert.equal(cari("jabatan").beda, true);
  assert.deepEqual([cari("jabatan").jalur, cari("jabatan").kolom, cari("jabatan").nilaiBaru], ["langsung", "jabatan", "Pengelola Data Kepegawaian"]);
  // MKG sebanding (SK terbaru = SK KGB terakhir yang TMT-nya sama), dan memang berbeda.
  assert.equal(cari("mkg").beda, true);
  assert.equal(cari("mkg").jalur, "periksa");
});

test("golongan berbeda diarahkan ke Catat kenaikan pangkat, PMK ke Catat PMK, satker ke mutasi", () => {
  const kp = bandingkanKiriman({ ...pegawai, golonganRuang: "II/c" }, { ...kiriman, naikSetelahKgb: "ya" });
  assert.equal(kp.find((b) => b.kunci === "golonganRuang")!.jalur, "kp");
  assert.equal(kp.find((b) => b.kunci === "golonganRuang")!.beda, true);
  assert.equal(kp.find((b) => b.kunci === "mkg")!.jalur, "kp");
  const pmk = bandingkanKiriman(pegawai, { ...kiriman, pmkSetelahKgb: "ya", tmtPmk: "2025-07-01" });
  assert.deepEqual([pmk.find((b) => b.kunci === "mkg")!.jalur, pmk.find((b) => b.kunci === "mkg")!.beda], ["pmk", true]);
  const upt = bandingkanKiriman(pegawai, { ...kiriman, satker: "rutan-barabai" });
  assert.deepEqual([upt.find((b) => b.kunci === "satker")!.jalur, upt.find((b) => b.kunci === "satker")!.beda], ["mutasi", true]);
});

test("belum pernah KGB: SK CPNS diterapkan langsung, TMT CPNS diperiksa", () => {
  const cpns = bandingkanKiriman(
    { ...pegawai, tmtKgbTerakhir: "2025-06-01" },
    { ...kiriman, keadaan: "belum", tmtDasar: "2025-06-01", nomorSkDasar: "SK.CPNS-9", tanggalSkDasar: "2025-02-10" },
  );
  const no = cpns.find((b) => b.kunci === "nomorSkDasar")!;
  assert.deepEqual([no.beda, no.jalur, no.nilaiBaru], [true, "langsung", "SK.CPNS-9"]);
  assert.equal(cpns.find((b) => b.kunci === "tmtCpns")!.beda, false);
  assert.equal(cpns.some((b) => b.kunci === "mkg"), false);
});

test("peringatan: MKG ganjil di golongan III dan golongan lama", () => {
  assert.ok(peringatanKiriman(pegawai, kiriman).some((p) => p.includes("ganjil")));
  assert.ok(peringatanKiriman({ golonganRuang: "II/c", tmtGolongan: "2026-04-01" }, { ...kiriman, golonganRuang: "II/b", mkgTahun: "5" }).some((p) => p.includes("lebih rendah")));
  assert.deepEqual(peringatanKiriman(pegawai, { ...kiriman, mkgTahun: "2" }), []);
  // KP yang sudah dicatat (golongan dan TMT sama) tidak diperingatkan; TMT berbeda diperingatkan.
  assert.deepEqual(peringatanKiriman(pegawai, { ...kiriman, mkgTahun: "2", naikSetelahKgb: "ya" }), []);
  assert.ok(peringatanKiriman(pegawai, { ...kiriman, mkgTahun: "2", naikSetelahKgb: "ya", tmtGolongan: "2026-10-01" }).some((p) => p.includes("TMT golongannya berbeda")));
});
