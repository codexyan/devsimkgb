// Jalankan: node --import tsx --test lib/pemeriksaanData.test.ts
// Uji juga dengan zona proses UTC: TZ=UTC node --import tsx --test lib/pemeriksaanData.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  masalahTmtKgbBerikutnya,
  periksaDataPegawai,
  tmtKgbTerakhirMenurutRiwayat,
  unitKerjaTidakDikenal,
  type KgbDiperiksa,
  type PegawaiDiperiksa,
} from "./pemeriksaanData";

const tanggal = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

function pegawai(isi: Partial<PegawaiDiperiksa> = {}): PegawaiDiperiksa {
  return {
    id: "p1",
    nama: "Pegawai Contoh",
    nip: "000000000000000001",
    unitKerja: "Lapas Kelas IIA Banjarmasin",
    aktif: true,
    tmtKgbTerakhir: tanggal(2025, 3),
    tmtKgbBerikutnya: tanggal(2027, 3),
    ...isi,
  };
}

function kgb(isi: Partial<KgbDiperiksa> = {}): KgbDiperiksa {
  return { pegawaiId: "p1", status: "selesai", tmtKgbBaru: tanggal(2025, 3), createdAt: new Date("2025-01-10T02:00:00Z"), ...isi };
}

test("unitKerjaTidakDikenal: kosong tidak dilaporkan, nama atau kode satker dikenali", () => {
  assert.equal(unitKerjaTidakDikenal(""), false);
  assert.equal(unitKerjaTidakDikenal("   "), false);
  assert.equal(unitKerjaTidakDikenal(null), false);
  assert.equal(unitKerjaTidakDikenal("Lapas Kelas IIA Banjarmasin"), false);
  assert.equal(unitKerjaTidakDikenal("rutan-barabai"), false);
  assert.equal(unitKerjaTidakDikenal("Kantor Pusat"), true);
  assert.equal(unitKerjaTidakDikenal("Lapas Kelas IIB Banjarmasin"), true, "kelas harus sama persis");
});

test("tmtKgbTerakhirMenurutRiwayat memakai KGB Selesai dengan TMT paling akhir", () => {
  const hasil = tmtKgbTerakhirMenurutRiwayat([
    kgb({ tmtKgbBaru: tanggal(2023, 3) }),
    kgb({ tmtKgbBaru: tanggal(2025, 3) }),
    kgb({ status: "ditolak", tmtKgbBaru: tanggal(2027, 3) }),
    kgb({ status: "belum_diproses", tmtKgbBaru: tanggal(2027, 3) }),
  ]);
  assert.deepEqual(hasil, { tmt: tanggal(2025, 3), sumber: "selesai" });
});

test("tmtKgbTerakhirMenurutRiwayat mendahulukan KGB berjalan yang paling baru dibuat", () => {
  const hasil = tmtKgbTerakhirMenurutRiwayat([
    kgb({ tmtKgbBaru: tanggal(2025, 3) }),
    kgb({ status: "sedang_diproses", tmtKgbBaru: tanggal(2027, 3), createdAt: new Date("2027-01-05T02:00:00Z") }),
    kgb({ status: "menunggu_keuangan", tmtKgbBaru: tanggal(2027, 4), createdAt: new Date("2027-01-02T02:00:00Z") }),
  ]);
  assert.deepEqual(hasil, { tmt: tanggal(2027, 3), sumber: "berjalan" });
});

test("tmtKgbTerakhirMenurutRiwayat null bila riwayat tidak memberi petunjuk", () => {
  assert.equal(tmtKgbTerakhirMenurutRiwayat([]), null);
  assert.equal(tmtKgbTerakhirMenurutRiwayat([kgb({ status: "ditolak" }), kgb({ status: "belum_diproses" })]), null);
  assert.equal(tmtKgbTerakhirMenurutRiwayat([kgb({ tmtKgbBaru: null })]), null);
});

test("masalahTmtKgbBerikutnya: kosong, bukan tanggal 1, dan tidak sesudah TMT terakhir", () => {
  assert.equal(masalahTmtKgbBerikutnya({ tmtKgbTerakhir: tanggal(2025, 3), tmtKgbBerikutnya: tanggal(2027, 3) }), null);
  assert.equal(masalahTmtKgbBerikutnya({ tmtKgbTerakhir: null, tmtKgbBerikutnya: null }), "kosong");
  assert.equal(masalahTmtKgbBerikutnya({ tmtKgbTerakhir: null, tmtKgbBerikutnya: "bukan tanggal" }), "kosong");
  assert.equal(masalahTmtKgbBerikutnya({ tmtKgbTerakhir: null, tmtKgbBerikutnya: tanggal(2027, 3, 15) }), "bukan_tanggal_1");
  assert.equal(
    masalahTmtKgbBerikutnya({ tmtKgbTerakhir: tanggal(2025, 3), tmtKgbBerikutnya: tanggal(2025, 3) }),
    "tidak_sesudah_tmt_terakhir",
  );
  assert.equal(masalahTmtKgbBerikutnya({ tmtKgbTerakhir: null, tmtKgbBerikutnya: tanggal(2027, 3) }), null);
});

test("tanggal dibandingkan sebagai tanggal kalender WITA", () => {
  // 1 Maret 2027 bisa tersimpan sebagai tengah malam UTC atau tengah malam WITA (28 Februari 16.00Z).
  assert.equal(
    masalahTmtKgbBerikutnya({ tmtKgbTerakhir: null, tmtKgbBerikutnya: "2027-02-28T16:00:00Z" }),
    null,
    "tengah malam WITA tetap tanggal 1",
  );
  const hasil = periksaDataPegawai(
    [pegawai({ tmtKgbTerakhir: "2025-02-28T16:00:00Z" })],
    [kgb({ tmtKgbBaru: "2025-03-01T00:00:00Z" })],
  );
  assert.deepEqual(hasil.tmtKgbTerakhirTidakSesuai, [], "bentuk tersimpan berbeda, tanggal WITA sama");

  const bergeser = periksaDataPegawai(
    [pegawai({ tmtKgbTerakhir: "2025-02-28T15:00:00Z" })],
    [kgb({ tmtKgbBaru: "2025-03-01T00:00:00Z" })],
  );
  assert.equal(bergeser.tmtKgbTerakhirTidakSesuai.length, 1, "28 Februari 23.00 WITA bukan 1 Maret");
  assert.equal(bergeser.tmtKgbTerakhirTidakSesuai[0].tmtKgbTerakhir, "2025-02-28");
  assert.equal(bergeser.tmtKgbTerakhirTidakSesuai[0].tmtMenurutRiwayat, "2025-03-01");
});

test("periksaDataPegawai: unit kerja tidak dikenal hanya untuk pegawai aktif", () => {
  const hasil = periksaDataPegawai(
    [
      pegawai({ id: "a", nama: "B Pegawai", unitKerja: "  Kantor Pusat " }),
      pegawai({ id: "b", nama: "A Pegawai", unitKerja: "Satker Lain" }),
      pegawai({ id: "c", nama: "C Pegawai", unitKerja: "Satker Lain", aktif: false }),
      pegawai({ id: "d", nama: "D Pegawai", unitKerja: "" }),
    ],
    [],
  );
  assert.deepEqual(
    hasil.unitKerjaTidakDikenal.map((t) => [t.pegawaiId, t.unitKerja]),
    [["b", "Satker Lain"], ["a", "Kantor Pusat"]],
    "urut nama, teks dirapikan",
  );
});

test("periksaDataPegawai: TMT KGB terakhir tidak sesuai riwayat, termasuk pegawai nonaktif", () => {
  const hasil = periksaDataPegawai(
    [
      pegawai({ id: "sesuai", tmtKgbTerakhir: tanggal(2025, 3) }),
      pegawai({ id: "beda", tmtKgbTerakhir: tanggal(2023, 3) }),
      pegawai({ id: "kosong", tmtKgbTerakhir: null }),
      pegawai({ id: "nonaktif", aktif: false, tmtKgbTerakhir: tanggal(2021, 3) }),
      pegawai({ id: "tanpa-riwayat", tmtKgbTerakhir: tanggal(2020, 1) }),
      pegawai({ id: "berjalan", tmtKgbTerakhir: tanggal(2025, 3) }),
    ],
    [
      kgb({ pegawaiId: "sesuai" }),
      kgb({ pegawaiId: "beda" }),
      kgb({ pegawaiId: "kosong" }),
      kgb({ pegawaiId: "nonaktif" }),
      kgb({ pegawaiId: "berjalan" }),
      kgb({ pegawaiId: "berjalan", status: "menunggu_keuangan", tmtKgbBaru: tanggal(2027, 3) }),
    ],
  );
  const temuan = new Map(hasil.tmtKgbTerakhirTidakSesuai.map((t) => [t.pegawaiId, t]));
  assert.deepEqual([...temuan.keys()].sort(), ["beda", "berjalan", "kosong", "nonaktif"]);
  assert.equal(temuan.get("kosong")?.tmtKgbTerakhir, null);
  assert.equal(temuan.get("nonaktif")?.aktif, false);
  assert.deepEqual(
    { tmt: temuan.get("berjalan")?.tmtMenurutRiwayat, sumber: temuan.get("berjalan")?.sumber },
    { tmt: "2027-03-01", sumber: "berjalan" },
  );
});

test("periksaDataPegawai: TMT KGB berikutnya tidak valid hanya untuk pegawai aktif", () => {
  const hasil = periksaDataPegawai(
    [
      pegawai({ id: "valid" }),
      pegawai({ id: "kosong", tmtKgbBerikutnya: null }),
      pegawai({ id: "tanggal-15", tmtKgbBerikutnya: tanggal(2027, 3, 15) }),
      pegawai({ id: "nonaktif", aktif: false, tmtKgbBerikutnya: null }),
    ],
    [],
  );
  assert.deepEqual(
    hasil.tmtKgbBerikutnyaTidakValid.map((t) => [t.pegawaiId, t.masalah, t.tmtKgbBerikutnya]),
    [
      ["kosong", "kosong", null],
      ["tanggal-15", "bukan_tanggal_1", "2027-03-15"],
    ],
  );
});
