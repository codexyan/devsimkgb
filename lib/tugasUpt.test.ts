// Daftar kerja Admin UPT: apa yang muncul, apa yang tidak, dan urutannya.
//
// Jalankan: node --import tsx --test lib/tugasUpt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { daftarTugasUpt, type PegawaiTugas, type UsulanTugas } from "./tugasUpt";

const pegawai = (p: Partial<PegawaiTugas> = {}): PegawaiTugas => ({
  id: "p1",
  nama: "DERA KALISTANINGSIH",
  nip: "200509182025062002",
  tmtKgb: "2026-06-01",
  bulanTmt: "2026-06",
  usulanBerjalan: null,
  perluDiperiksa: true,
  batasInput: "2026-04-15",
  ...p,
});

const usulan = (u: Partial<UsulanTugas> = {}): UsulanTugas => ({
  id: "u1",
  pegawaiId: "p1",
  status: "draf",
  nama: "DERA KALISTANINGSIH",
  nip: "200509182025062002",
  kekurangan: [],
  ...u,
});

test("draf yang kurang diminta dilengkapi, yang lengkap diminta diajukan", () => {
  const kurang = daftarTugasUpt([usulan({ kekurangan: ["golongan/ruang"] })], [], "2026-06");
  assert.equal(kurang[0].jenis, "lengkapi");
  assert.equal(kurang[0].catatan, "golongan/ruang");

  const siap = daftarTugasUpt([usulan()], [], "2026-06");
  assert.equal(siap[0].jenis, "ajukan");
  assert.equal(siap[0].catatan, null);
});

test("usulan yang dikembalikan didahulukan dan membawa catatan Kanwil", () => {
  const daftar = daftarTugasUpt(
    [
      usulan({ id: "u-siap" }),
      usulan({ id: "u-kurang", pegawaiId: "p2", kekurangan: ["jabatan"] }),
      usulan({ id: "u-balik", pegawaiId: "p3", status: "revisi", alasanTolak: "Lampirkan SK pengangkatan PNS" }),
    ],
    [],
    "2026-06",
  );
  assert.deepEqual(daftar.map((t) => t.jenis), ["perbaiki", "lengkapi", "ajukan"]);
  assert.equal(daftar[0].catatan, "Lampirkan SK pengangkatan PNS");
});

test("usulan yang sedang ditinjau Kanwil bukan tugas UPT", () => {
  // UPT tidak dapat berbuat apa pun atasnya; menampilkannya hanya mengisi daftar dengan hal yang
  // tidak bisa dikerjakan.
  assert.deepEqual(daftarTugasUpt([usulan({ status: "menunggu" })], [], "2026-06"), []);
  assert.deepEqual(daftarTugasUpt([usulan({ status: "disetujui" })], [], "2026-06"), []);
});

test("pegawai pada bulan usulan diingatkan untuk diperiksa, selain itu tidak", () => {
  const [t] = daftarTugasUpt([], [pegawai()], "2026-06");
  assert.equal(t.jenis, "periksa");
  assert.match(t.langkah, /sebelum 15 April 2026; tanpa usulan, datanya dianggap benar/);

  // Bulan lain belum tiba gilirannya; tanpa ini seluruh pegawai satker masuk daftar kerja.
  assert.deepEqual(daftarTugasUpt([], [pegawai({ bulanTmt: "2028-06" })], "2026-06"), []);
  assert.deepEqual(daftarTugasUpt([], [pegawai()], null), []);

  // Sudah ada usulan berjalan, atau KGB-nya sudah diinput dan batas input lewat: bukan tugas lagi.
  assert.deepEqual(daftarTugasUpt([], [pegawai({ usulanBerjalan: "menunggu" })], "2026-06"), []);
  assert.deepEqual(daftarTugasUpt([], [pegawai({ perluDiperiksa: false })], "2026-06"), []);
});

test("dalam satu jenis: TMT terdekat dulu, lalu nama, yang tanpa TMT paling belakang", () => {
  const daftar = daftarTugasUpt(
    [],
    [
      pegawai({ id: "p1", nama: "Belakang", tmtKgb: "2026-06-20" }),
      pegawai({ id: "p2", nama: "Depan", tmtKgb: "2026-06-01" }),
      pegawai({ id: "p3", nama: "Anwar", tmtKgb: "2026-06-20" }),
      pegawai({ id: "p4", nama: "Tanpa TMT", tmtKgb: null }),
    ],
    "2026-06",
  );
  assert.deepEqual(daftar.map((t) => t.nama), ["Depan", "Anwar", "Belakang", "Tanpa TMT"]);
});
