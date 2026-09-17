// Status hukuman disiplin pegawai menurut tanggal berakhirnya.
//
// Jalankan: node --import tsx --test lib/hukdisKedaluwarsa.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hukdisMasihBerlaku,
  penandaHukdisBerlaku,
  penyelarasanHukdisPegawai,
  ringkasanHukdisPegawai,
} from "./hukdisKedaluwarsa";

const tanggal = (tahun: number, bulan: number, hari: number) => new Date(tahun, bulan - 1, hari);
// Tanggal isian formulir tersimpan sebagai tengah malam UTC.
const utc = (tahun: number, bulan: number, hari: number) => new Date(Date.UTC(tahun, bulan - 1, hari));

test("hukdis berlaku sampai dengan tanggal berakhir menurut WITA", () => {
  const berakhir = utc(2027, 5, 15);
  assert.equal(hukdisMasihBerlaku(berakhir, tanggal(2027, 5, 14)), true);
  assert.equal(hukdisMasihBerlaku(berakhir, tanggal(2027, 5, 15)), true);
  assert.equal(hukdisMasihBerlaku(berakhir, tanggal(2027, 5, 16)), false);
  // 15 Mei 2027 tengah malam WITA juga berakhir pada 15 Mei.
  assert.equal(hukdisMasihBerlaku("2027-05-14T16:00:00Z", tanggal(2027, 5, 15)), true);
  assert.equal(hukdisMasihBerlaku("2027-05-14T16:00:00Z", tanggal(2027, 5, 16)), false);
  // Jam pada hari ini diabaikan.
  assert.equal(hukdisMasihBerlaku(berakhir, new Date(2027, 4, 15, 23, 59)), true);
  assert.equal(hukdisMasihBerlaku(null, tanggal(2030, 1, 1)), true);
});

const PEGAWAI = {
  id: "p1",
  nama: "PEGAWAI CONTOH",
  statusHukdis: true,
  tanggalHukdisBerakhir: utc(2026, 9, 14),
  jenisHukdis: "penundaan_kgb",
  keteranganHukdis: "Penundaan KGB 12 bulan",
};

test("penanda hukdis yang sudah lewat dibaca tidak aktif tanpa mengubah field lain", () => {
  const hasil = penandaHukdisBerlaku(PEGAWAI, tanggal(2026, 9, 15));
  assert.deepEqual(hasil, {
    id: "p1",
    nama: "PEGAWAI CONTOH",
    statusHukdis: false,
    tanggalHukdisBerakhir: null,
    jenisHukdis: null,
    keteranganHukdis: null,
  });
  assert.equal(penandaHukdisBerlaku(PEGAWAI, tanggal(2026, 9, 14)), PEGAWAI);
  const tanpaTanggal = { ...PEGAWAI, tanggalHukdisBerakhir: null };
  assert.equal(penandaHukdisBerlaku(tanpaTanggal, tanggal(2030, 1, 1)), tanpaTanggal);
});

test("ringkasan memakai hukdis berlaku yang berakhir paling akhir", () => {
  const daftar = [
    { jenisHukdis: "teguran_tertulis", tmtBerakhir: utc(2026, 12, 31), keterangan: "Teguran" },
    { jenisHukdis: "penundaan_kgb", tmtBerakhir: utc(2027, 6, 30), keterangan: "Tunda" },
    { jenisHukdis: "lama", tmtBerakhir: utc(2025, 1, 1), keterangan: "Sudah berakhir" },
  ];
  assert.deepEqual(ringkasanHukdisPegawai(daftar, tanggal(2026, 9, 15)), {
    statusHukdis: true,
    tanggalHukdisBerakhir: utc(2027, 6, 30),
    jenisHukdis: "penundaan_kgb",
    keteranganHukdis: "Tunda",
  });
  assert.equal(ringkasanHukdisPegawai(daftar, tanggal(2027, 1, 1)).jenisHukdis, "penundaan_kgb");
  assert.deepEqual(ringkasanHukdisPegawai(daftar, tanggal(2027, 7, 1)), {
    statusHukdis: false,
    tanggalHukdisBerakhir: null,
    jenisHukdis: null,
    keteranganHukdis: null,
  });
});

test("ringkasan: tanpa tanggal berakhir dianggap paling akhir, dan bila sama yang terakhir dicatat dipakai", () => {
  const hariIni = tanggal(2026, 9, 15);
  const tanpaBatas = { jenisHukdis: "a", tmtBerakhir: null, keterangan: null };
  const berbatas = { jenisHukdis: "b", tmtBerakhir: utc(2030, 1, 1), keterangan: "x" };
  assert.equal(ringkasanHukdisPegawai([tanpaBatas, berbatas], hariIni).jenisHukdis, "a");
  assert.equal(ringkasanHukdisPegawai([berbatas, tanpaBatas], hariIni).jenisHukdis, "a");
  const samaTanggal = { ...berbatas, jenisHukdis: "c" };
  assert.equal(ringkasanHukdisPegawai([berbatas, samaTanggal], hariIni).jenisHukdis, "c");
  assert.equal(ringkasanHukdisPegawai([], hariIni).statusHukdis, false);
});

test("penyelarasan cron: hanya pegawai yang penandanya lewat, dengan riwayat lain yang masih berlaku", () => {
  const hariIni = tanggal(2026, 9, 15);
  assert.equal(penyelarasanHukdisPegawai({ ...PEGAWAI, tanggalHukdisBerakhir: utc(2026, 10, 1) }, [], hariIni), null);
  assert.equal(penyelarasanHukdisPegawai({ ...PEGAWAI, statusHukdis: false }, [], hariIni), null);
  assert.deepEqual(penyelarasanHukdisPegawai(PEGAWAI, [], hariIni), {
    statusHukdis: false,
    tanggalHukdisBerakhir: null,
    jenisHukdis: null,
    keteranganHukdis: null,
  });
  const lain = { jenisHukdis: "teguran_tertulis", tmtBerakhir: utc(2026, 12, 31), keterangan: "Teguran" };
  assert.deepEqual(penyelarasanHukdisPegawai(PEGAWAI, [lain], hariIni), {
    statusHukdis: true,
    tanggalHukdisBerakhir: utc(2026, 12, 31),
    jenisHukdis: "teguran_tertulis",
    keteranganHukdis: "Teguran",
  });
});
