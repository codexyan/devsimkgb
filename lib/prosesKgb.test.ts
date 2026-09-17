// Aturan proses KGB untuk route API.
//
// Jalankan: node --import tsx --test lib/prosesKgb.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adaPenandaPdf,
  alasanTolakBuatSk,
  alasanTolakUbahSkTerakhir,
  bacaTanggalInput,
  hukdisMenahanKgb,
  izinUnggahSk,
  PESAN_BELUM_DIINPUT,
  pesanKgbMasihAktif,
  placeholderBerlebih,
  recordKgbKembarBerlebih,
  rentangBulanTmt,
  suratSudahDibuat,
  tmtTerakhirSebelumInput,
} from "./prosesKgb";

const tanggal = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

test("bacaTanggalInput: tanggal kalender menjadi tengah malam UTC", () => {
  assert.equal(bacaTanggalInput("2026-06-01")?.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(bacaTanggalInput(" 2026-06-01 ")?.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(bacaTanggalInput("2026-05-31T16:00:00.000Z")?.toISOString(), "2026-05-31T16:00:00.000Z");
});

test("bacaTanggalInput: kosong, bukan string, format lain, dan tanggal yang tidak ada ditolak", () => {
  for (const nilai of [undefined, null, "", "  ", 20260601, "abc", "01/06/2025", "2026-13-01", "2026-02-31", "2026-06-01Tzz"]) {
    assert.equal(bacaTanggalInput(nilai), null, String(nilai));
  }
});

test("rentangBulanTmt: Desember berakhir pada 1 Januari tahun berikutnya", () => {
  assert.deepEqual(rentangBulanTmt("12", "2026"), { lo: tanggal(2026, 12), hi: tanggal(2027, 1) });
  assert.deepEqual(rentangBulanTmt("6", "2026"), { lo: tanggal(2026, 6), hi: tanggal(2026, 7) });
  assert.deepEqual(rentangBulanTmt("06", "2026"), { lo: tanggal(2026, 6), hi: tanggal(2026, 7) });
});

test("rentangBulanTmt: tanpa bulan yang valid memakai satu tahun; tanpa tahun tidak menyaring", () => {
  assert.deepEqual(rentangBulanTmt("", "2026"), { lo: tanggal(2026, 1), hi: tanggal(2027, 1) });
  assert.deepEqual(rentangBulanTmt("13", "2026"), { lo: tanggal(2026, 1), hi: tanggal(2027, 1) });
  assert.equal(rentangBulanTmt("6", ""), null);
  assert.equal(rentangBulanTmt("6", "26"), null);
});

test("alasanTolakBuatSk: hanya Sedang Diproses yang boleh dibuat SK", () => {
  assert.equal(alasanTolakBuatSk("sedang_diproses"), null);
  assert.equal(alasanTolakBuatSk("belum_diproses"), PESAN_BELUM_DIINPUT);
  for (const status of ["menunggu_keuangan", "selesai", "ditolak", "lain"]) {
    assert.ok(alasanTolakBuatSk(status), status);
  }
});

test("alasanTolakUbahSkTerakhir: hanya Sedang Diproses yang boleh diubah", () => {
  assert.equal(alasanTolakUbahSkTerakhir("sedang_diproses"), null);
  for (const status of ["belum_diproses", "menunggu_keuangan", "selesai", "ditolak"]) {
    assert.ok(alasanTolakUbahSkTerakhir(status), status);
  }
});

test("suratSudahDibuat: jabatan penandatangan atau nama penandatangan surat lama", () => {
  assert.equal(suratSudahDibuat(null), false);
  assert.equal(suratSudahDibuat({ jabatanPenandatangan: "Kepala Kantor Wilayah" }), true);
  assert.equal(suratSudahDibuat({ namaKepalaKanwil: "Nama Pejabat" }), true);
  assert.equal(suratSudahDibuat({ namaKepalaKanwil: "-", jabatanPenandatangan: "" }), false);
});

test("izinUnggahSk per status", () => {
  assert.deepEqual(izinUnggahSk({ status: "sedang_diproses", isArsip: false, skSudahDibuat: true }), { ok: true, jenis: "unggah" });
  assert.equal(izinUnggahSk({ status: "sedang_diproses", isArsip: false, skSudahDibuat: false }).ok, false);
  assert.deepEqual(izinUnggahSk({ status: "menunggu_keuangan", isArsip: false, skSudahDibuat: true }), { ok: true, jenis: "ganti" });
  assert.deepEqual(izinUnggahSk({ status: "selesai", isArsip: true, skSudahDibuat: false }), { ok: true, jenis: "arsip" });
  assert.equal(izinUnggahSk({ status: "selesai", isArsip: false, skSudahDibuat: true }).ok, false);
  assert.equal(izinUnggahSk({ status: "belum_diproses", isArsip: false, skSudahDibuat: false }).ok, false);
  assert.equal(izinUnggahSk({ status: "ditolak", isArsip: false, skSudahDibuat: true }).ok, false);
});

test("pesanKgbMasihAktif hanya untuk Sedang Diproses dan Menunggu Keuangan", () => {
  assert.ok(pesanKgbMasihAktif("sedang_diproses"));
  assert.ok(pesanKgbMasihAktif("menunggu_keuangan"));
  for (const status of ["belum_diproses", "selesai", "ditolak"]) assert.equal(pesanKgbMasihAktif(status), null);
});

test("hukdisMenahanKgb: hukdis masih menahan pada tanggal berakhirnya, sehari sesudahnya tidak lagi", () => {
  const pegawai = { statusHukdis: false, tanggalHukdisBerakhir: null, jenisHukdis: null };
  const hariIni = tanggal(2027, 5, 15);
  assert.deepEqual(
    hukdisMenahanKgb({ riwayatHukdis: [{ berdampakKGB: true, tmtBerakhir: "2027-05-15T00:00:00Z" }], pegawai, hariIni }),
    { menahan: true, berakhir: tanggal(2027, 5, 15) },
  );
  assert.deepEqual(
    hukdisMenahanKgb({ riwayatHukdis: [{ berdampakKGB: true, tmtBerakhir: "2027-05-14T00:00:00Z" }], pegawai, hariIni }),
    { menahan: false },
  );
  assert.deepEqual(
    hukdisMenahanKgb({ riwayatHukdis: [{ berdampakKGB: true, tmtBerakhir: "2027-05-15T16:00:00Z" }], pegawai, hariIni }),
    { menahan: true, berakhir: tanggal(2027, 5, 16) },
  );
  assert.deepEqual(
    hukdisMenahanKgb({ riwayatHukdis: [{ berdampakKGB: false, tmtBerakhir: null }], pegawai, hariIni }),
    { menahan: false },
  );
  assert.deepEqual(
    hukdisMenahanKgb({ riwayatHukdis: [{ berdampakKGB: true, tmtBerakhir: null }], pegawai, hariIni }),
    { menahan: true, berakhir: null },
  );
});

test("hukdisMenahanKgb: penanda lama di data pegawai hanya dipakai tanpa riwayat hukdis", () => {
  const hariIni = tanggal(2026, 9, 15);
  const pegawai = { statusHukdis: true, tanggalHukdisBerakhir: "2026-12-01", jenisHukdis: "penundaan_kgb" };
  assert.deepEqual(hukdisMenahanKgb({ riwayatHukdis: [], pegawai, hariIni }), { menahan: true, berakhir: tanggal(2026, 12, 1) });
  assert.deepEqual(
    hukdisMenahanKgb({ riwayatHukdis: [{ berdampakKGB: false, tmtBerakhir: null }], pegawai, hariIni }),
    { menahan: false },
  );
  assert.deepEqual(
    hukdisMenahanKgb({ riwayatHukdis: [], pegawai: { ...pegawai, jenisHukdis: "teguran_lisan" }, hariIni }),
    { menahan: false },
  );
});

test("hukdisMenahanKgb: hukdis yang mulai sesudah TMT KGB tidak menahan KGB itu", () => {
  const pegawai = { statusHukdis: true, tanggalHukdisBerakhir: "2027-09-14", jenisHukdis: "penundaan_kgb" };
  const hariIni = tanggal(2026, 9, 15);
  const hukdis = { berdampakKGB: true, tmtMulai: "2026-09-15", tmtBerakhir: "2027-09-14" };
  assert.deepEqual(hukdisMenahanKgb({ riwayatHukdis: [hukdis], pegawai, hariIni, tmtKgb: tanggal(2026, 8) }), { menahan: false });
  assert.equal(hukdisMenahanKgb({ riwayatHukdis: [hukdis], pegawai, hariIni, tmtKgb: tanggal(2026, 9, 15) }).menahan, true);
  assert.equal(hukdisMenahanKgb({ riwayatHukdis: [hukdis], pegawai, hariIni }).menahan, true);
  // Tanpa tanggal mulai yang valid, hukdis tetap menahan.
  assert.equal(
    hukdisMenahanKgb({ riwayatHukdis: [{ ...hukdis, tmtMulai: null }], pegawai, hariIni, tmtKgb: tanggal(2026, 8) }).menahan,
    true,
  );
});

test("adaPenandaPdf: penanda PDF di awal atau sesudah beberapa byte", () => {
  const teks = (s: string) => new TextEncoder().encode(s);
  assert.equal(adaPenandaPdf(teks("%PDF-1.7\n%")), true);
  assert.equal(adaPenandaPdf(new Uint8Array([0xef, 0xbb, 0xbf, ...teks("%PDF-1.4")])), true);
  assert.equal(adaPenandaPdf(teks("PK")), false);
  assert.equal(adaPenandaPdf(teks("%PDF")), false);
  assert.equal(adaPenandaPdf(new Uint8Array()), false);
});

test("tmtTerakhirSebelumInput: siklus biasa dan penundaan", () => {
  // III/a MKG 4 -> 6 pada TMT 1 Juni 2026: TMT terakhir setara 1 Juni 2024.
  assert.deepEqual(
    tmtTerakhirSebelumInput({ tmtKgbBaru: "2026-06-01T00:00:00Z", mkgTahunLama: 4, mkgBulanLama: 0, mkgTahunBaru: 6, mkgBulanBaru: 0 }),
    tanggal(2024, 6),
  );
  // Penundaan 12 bulan: MKG bertambah 36 bulan, TMT terakhir setara 1 Juni 2023.
  assert.deepEqual(
    tmtTerakhirSebelumInput({ tmtKgbBaru: "2026-05-31T16:00:00Z", mkgTahunLama: 4, mkgBulanLama: 0, mkgTahunBaru: 7, mkgBulanBaru: 0 }),
    tanggal(2023, 6),
  );
  assert.equal(
    tmtTerakhirSebelumInput({ tmtKgbBaru: null, mkgTahunLama: 4, mkgBulanLama: 0, mkgTahunBaru: 6, mkgBulanBaru: 0 }),
    null,
  );
  assert.equal(
    tmtTerakhirSebelumInput({ tmtKgbBaru: "2026-06-01", mkgTahunLama: 6, mkgBulanLama: 0, mkgTahunBaru: 6, mkgBulanBaru: 0 }),
    null,
  );
});

test("placeholderBerlebih: yang paling baru dipertahankan, urutan masukan tidak berpengaruh", () => {
  const rows = [
    { id: "a", createdAt: "2026-09-15T01:00:00.000Z" },
    { id: "c", createdAt: "2026-09-15T01:00:01.000Z" },
    { id: "b", createdAt: "2026-09-15T01:00:01.000Z" },
  ];
  assert.deepEqual(placeholderBerlebih(rows).sort(), ["a", "b"]);
  assert.deepEqual(placeholderBerlebih([...rows].reverse()).sort(), ["a", "b"]);
  assert.deepEqual(placeholderBerlebih([{ id: "x", createdAt: null }]), []);
  assert.deepEqual(placeholderBerlebih([]), []);
});

test("recordKgbKembarBerlebih: record yang tertulis paling dulu dipertahankan, bukan createdAt paling awal", () => {
  // Permintaan B menghitung createdAt lebih dulu, tetapi record A tertulis lebih dulu.
  const recordA = { id: "a", createdAt: "2026-09-15T01:00:00.200Z" };
  const recordB = { id: "b", createdAt: "2026-09-15T01:00:00.100Z" };
  // A membaca sebelum record B tertulis: record-nya tetap dipertahankan.
  assert.deepEqual(recordKgbKembarBerlebih([recordA]), []);
  // B membaca keduanya dalam urutan tulis: record B yang berlebih, jadi B yang menolak.
  assert.deepEqual(recordKgbKembarBerlebih([recordA, recordB]), ["b"]);
  assert.deepEqual(recordKgbKembarBerlebih([{ id: "x" }, { id: "y" }, { id: "z" }]), ["y", "z"]);
  assert.deepEqual(recordKgbKembarBerlebih([]), []);
});
