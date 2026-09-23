// Tanggal kalender WITA tidak boleh bergantung pada zona waktu proses (Workers berjalan dalam UTC).
//
// Jalankan: node --import tsx --test lib/waktu.test.ts
// Uji juga dengan zona proses UTC: TZ=UTC node --import tsx --test lib/waktu.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { ZONA_WITA, formatTanggalId, hariIniWita, isoTanggalLokal, samaTanggalKalender, tanggalKalender, tanggalWita } from "./waktu";

const tanggal = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

test("tanggalWita berganti hari pada pukul 16.00 UTC", () => {
  assert.deepEqual(tanggalWita(new Date("2026-05-31T15:59:59Z")), { tahun: 2026, bulan: 4, hari: 31 });
  assert.deepEqual(tanggalWita(new Date("2026-05-31T16:00:00Z")), { tahun: 2026, bulan: 5, hari: 1 });
  assert.deepEqual(tanggalWita(new Date("2026-12-31T16:30:00Z")), { tahun: 2027, bulan: 0, hari: 1 });
});

test("hariIniWita pada jam proses UTC sesaat setelah 16.00Z sudah hari berikutnya", () => {
  assert.deepEqual(hariIniWita(new Date("2026-05-31T16:05:00Z")), tanggal(2026, 6, 1));
  assert.deepEqual(hariIniWita(new Date("2026-05-31T08:00:00Z")), tanggal(2026, 5, 31));
});

test("kedua bentuk TMT tersimpan dibaca sebagai 1 Juni 2026", () => {
  const harapan = tanggal(2026, 6, 1);
  assert.deepEqual(tanggalKalender("2026-06-01T00:00:00Z"), harapan, "ditulis dari proses UTC");
  assert.deepEqual(tanggalKalender("2026-05-31T16:00:00Z"), harapan, "tengah malam WITA");
  assert.deepEqual(tanggalKalender("2026-05-31T17:00:00Z"), harapan, "tengah malam WIB");
  assert.deepEqual(tanggalKalender("2026-06-01"), harapan, "nilai input date");
  assert.deepEqual(tanggalKalender(new Date("2026-05-31T16:00:00Z")), harapan);
  assert.deepEqual(tanggalKalender(harapan), harapan, "tanggal yang dibangun di proses tidak bergeser");
});

test("tanggalKalender mengembalikan null untuk nilai kosong atau tidak valid", () => {
  for (const nilai of [null, undefined, "", "   ", "bukan tanggal", new Date(Number.NaN)]) {
    assert.equal(tanggalKalender(nilai), null, String(nilai));
  }
});

test("samaTanggalKalender membandingkan tanggal kalender WITA", () => {
  assert.equal(samaTanggalKalender("2026-06-01T00:00:00Z", "2026-05-31T16:00:00Z"), true);
  assert.equal(samaTanggalKalender(tanggal(2026, 6, 1), "2026-06-01"), true);
  assert.equal(samaTanggalKalender("2026-06-01T00:00:00Z", "2026-06-02T00:00:00Z"), false);
});

test("samaTanggalKalender: nilai kosong hanya sama dengan nilai kosong bila diminta", () => {
  assert.equal(samaTanggalKalender(null, "2026-06-01"), false);
  assert.equal(samaTanggalKalender(null, "2026-06-01", { keduanyaKosongSama: true }), false);
  assert.equal(samaTanggalKalender(null, undefined), false);
  assert.equal(samaTanggalKalender(null, "", { keduanyaKosongSama: true }), true);
  assert.equal(samaTanggalKalender("bukan tanggal", null, { keduanyaKosongSama: true }), true);
});

test("formatTanggalId menampilkan tanggal WITA dalam bahasa Indonesia", () => {
  assert.equal(formatTanggalId("2026-05-31T16:00:00Z"), "1 Juni 2026");
  assert.equal(formatTanggalId("2026-06-01T00:00:00Z"), "1 Juni 2026");
  assert.equal(formatTanggalId(new Date("2026-04-30T16:00:00Z")), "1 Mei 2026");
  assert.equal(formatTanggalId("2026-05-31T16:00:00Z", { month: "long", year: "numeric" }), "Juni 2026");
  assert.equal(formatTanggalId(null), "-");
  assert.equal(formatTanggalId(""), "-");
  assert.equal(formatTanggalId("bukan tanggal"), "-");
});

test("isoTanggalLokal memakai tanggal kalender lokal, bukan toISOString", () => {
  assert.equal(isoTanggalLokal(tanggal(2026, 1, 5)), "2026-01-05");
  assert.equal(isoTanggalLokal(tanggal(2026, 12, 31)), "2026-12-31");
  assert.equal(isoTanggalLokal(hariIniWita(new Date("2026-05-31T16:30:00Z"))), "2026-06-01");
  assert.equal(isoTanggalLokal(new Date(Number.NaN)), "");
});

test("tanggalWita memberi hasil yang sama dengan Intl pada rentang lebar", () => {
  // tanggalWita dihitung dengan offset tetap karena dipanggil ribuan kali per permintaan. Uji ini
  // menjaga kesetaraannya dengan Intl, yang menjadi acuan benar untuk zona Asia/Makassar.
  const acuan = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_WITA,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const lewatIntl = (d: Date) => {
    const bagian = acuan.formatToParts(d);
    const ambil = (jenis: Intl.DateTimeFormatPartTypes) => Number(bagian.find((b) => b.type === jenis)?.value);
    return { tahun: ambil("year"), bulan: ambil("month") - 1, hari: ambil("day") };
  };

  // Menyisir sepuluh tahun dengan langkah yang memotong setiap jam dan menit, termasuk batas hari,
  // pergantian bulan, pergantian tahun, dan tahun kabisat.
  const awal = Date.UTC(2020, 0, 1);
  for (let i = 0; i < 20000; i++) {
    const d = new Date(awal + i * 3_600_000 * 7 + (i % 97) * 60_000);
    assert.deepEqual(tanggalWita(d), lewatIntl(d), d.toISOString());
  }

  // Titik yang paling rawan: tepat pukul 16.00 UTC adalah tengah malam WITA.
  assert.deepEqual(tanggalWita(new Date("2026-09-22T15:59:59Z")), { tahun: 2026, bulan: 8, hari: 22 });
  assert.deepEqual(tanggalWita(new Date("2026-09-22T16:00:00Z")), { tahun: 2026, bulan: 8, hari: 23 });
  assert.deepEqual(tanggalWita(new Date("2026-12-31T16:00:00Z")), { tahun: 2027, bulan: 0, hari: 1 });
});
