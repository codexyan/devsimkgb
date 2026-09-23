// Jadwal pengusulan KGB dan jam layanan untuk halaman publik.
//
// Jalankan: node --import tsx --test lib/jadwalPengusulan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { jadwalPengusulan } from "./jadwalPengusulan";
import { hitungDeadlineSDM, hitungKirimSurat, hitungRekonGaji } from "./tabelGaji";
import { statusJamLayanan } from "./jamLayanan";

const tgl = (tahun: number, bulan: number, hari: number) => new Date(tahun, bulan - 1, hari);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("jadwal dimulai dari TMT yang jendela inputnya sedang terbuka", () => {
  const baris = jadwalPengusulan(3, tgl(2026, 9, 18));
  assert.deepEqual(
    baris.map((b) => [iso(b.tmt), iso(b.kirimSurat), iso(b.inputDibuka), iso(b.batasInput), b.keadaan]),
    [
      ["2026-11-01", "2026-09-01", "2026-09-01", "2026-09-20", "terbuka"],
      ["2026-12-01", "2026-10-01", "2026-10-01", "2026-10-20", "berikutnya"],
      ["2027-01-01", "2026-11-01", "2026-11-01", "2026-11-20", "berikutnya"],
    ],
  );
  // Rekon gaji keuangan tanggal 1 sampai 15 bulan sebelum TMT, sesudah batas input Tim SDM.
  assert.deepEqual([iso(baris[0].rekonMulai), iso(baris[0].rekonBatas)], ["2026-10-01", "2026-10-15"]);
  assert.ok(baris[0].batasInput < baris[0].rekonMulai);
});

test("tanggal batas input masih terbuka, sesudahnya jadwal pindah ke TMT berikutnya, dan pergantian tahun benar", () => {
  const padaBatas = jadwalPengusulan(1, tgl(2026, 12, 20));
  assert.equal(iso(padaBatas[0].tmt), "2027-02-01");
  assert.equal(padaBatas[0].keadaan, "terbuka");
  assert.equal(iso(padaBatas[0].kirimSurat), "2026-12-01");
  assert.equal(iso(padaBatas[0].kirimSuratBatas), "2026-12-10");

  // Sesudah tanggal 20 input TMT 1 Februari berpotensi rapelan; jadwal menampilkan TMT 1 Maret yang belum dibuka.
  const sesudahBatas = jadwalPengusulan(1, tgl(2026, 12, 21));
  assert.equal(iso(sesudahBatas[0].tmt), "2027-03-01");
  assert.equal(sesudahBatas[0].keadaan, "berikutnya");

  const awalBulan = jadwalPengusulan(1, tgl(2027, 1, 1));
  assert.equal(iso(awalBulan[0].tmt), "2027-03-01");
  assert.equal(iso(awalBulan[0].inputDibuka), "2027-01-01");
});

test("jumlah baris mengikuti permintaan dan tidak negatif", () => {
  assert.equal(jadwalPengusulan(6, tgl(2026, 9, 18)).length, 6);
  assert.equal(jadwalPengusulan(-1, tgl(2026, 9, 18)).length, 0);
});

test("jam layanan dibaca menurut WITA", () => {
  // Kamis 17 September 2026 pukul 08.00 WITA = 00.00 UTC.
  assert.deepEqual(statusJamLayanan(new Date(Date.UTC(2026, 8, 17, 0, 0))), {
    buka: true,
    jadwalHariIni: "07.30–16.00 WITA",
  });
  // Kamis pukul 16.00 WITA sudah tutup.
  assert.equal(statusJamLayanan(new Date(Date.UTC(2026, 8, 17, 8, 0))).buka, false);
  // Jumat pukul 16.15 WITA masih buka.
  assert.deepEqual(statusJamLayanan(new Date(Date.UTC(2026, 8, 18, 8, 15))), {
    buka: true,
    jadwalHariIni: "07.30–16.30 WITA",
  });
  // Sabtu 19 September 2026 pukul 07.00 WITA masih Jumat 23.00 UTC, tetapi di WITA sudah Sabtu.
  assert.deepEqual(statusJamLayanan(new Date(Date.UTC(2026, 8, 18, 23, 0))), { buka: false, jadwalHariIni: null });
});

test("surat usulan dikirim 1 sampai 10 bulan kedua sebelum TMT, sebelum batas input", () => {
  // TMT 1 September 2026: surat 1–10 Juli, input 1–20 Juli, rekon gaji 1–15 Agustus.
  const surat = hitungKirimSurat(tgl(2026, 9, 1));
  assert.deepEqual([iso(surat.mulai), iso(surat.batas)], ["2026-07-01", "2026-07-10"]);
  assert.ok(surat.batas < hitungDeadlineSDM(tgl(2026, 9, 1), 20), "surat sampai sebelum batas input Tim SDM");
  assert.ok(hitungDeadlineSDM(tgl(2026, 9, 1), 20) < hitungRekonGaji(tgl(2026, 9, 1)).mulai, "SK selesai sebelum rekon gaji");

  // Pergantian tahun: TMT 1 Januari 2027 → surat November 2026.
  assert.equal(iso(hitungKirimSurat(tgl(2027, 1, 1)).mulai), "2026-11-01");
});
