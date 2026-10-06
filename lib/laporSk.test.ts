// Logika laporan SK KP/PI/PMK oleh Admin UPT (ADR-074).
//
// Jalankan: node --import tsx --test lib/laporSk.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { angkaLapor, kekuranganLaporSk, peringatanDampakKgb, pratayangLaporSk, type IsianLaporSk, type KeadaanTercatat } from "./laporSk";

const kosong: IsianLaporSk = {
  jenis: "kp", jenisKp: "reguler", golonganBaru: "", mkgTahunSk: "", mkgBulanSk: "", nomorSk: "", tanggalSk: "", tmt: "", penetap: "",
};
const sekarang: KeadaanTercatat = { golongan: "II/b", mkgTahun: 7, mkgBulan: 0, tmtKgbTerakhir: "2026-12-01" };

test("angka dari isian teks: kosong dan huruf dibaca nol atau dibuang", () => {
  assert.equal(angkaLapor(""), 0);
  assert.equal(angkaLapor(undefined), 0);
  assert.equal(angkaLapor("12 th"), 12);
});

test("kenaikan pangkat: pratinjau memotong masa kerja saat pindah jenjang, dan menolak golongan yang tidak lebih tinggi", () => {
  assert.equal(pratayangLaporSk(sekarang, kosong), null);
  const p = pratayangLaporSk(sekarang, { ...kosong, golonganBaru: "III/a" });
  assert.ok(p && p.ok);
  assert.match(p.baris.map((b) => b.join(" ")).join(" | "), /7 thn 0 bln → 2 thn 0 bln/);
  assert.match(p.catatan, /dipotong 5 tahun/);
  const tolak = pratayangLaporSk(sekarang, { ...kosong, golonganBaru: "II/a" });
  assert.ok(tolak && !tolak.ok);
  assert.match(tolak.galat, /lebih tinggi/);
});

test("gaji pokok yang tidak ada di tabel ditandai, bukan ditampilkan sebagai Rp0", () => {
  // Golongan II/b baru punya langkah gaji mulai masa kerja 3 tahun; 2 tahun tidak cocok dengan baris mana pun.
  const p = pratayangLaporSk({ golongan: "II/a", mkgTahun: 2, mkgBulan: 0, tmtKgbTerakhir: "2025-10-01" }, { ...kosong, golonganBaru: "II/b" });
  assert.ok(p && p.ok);
  assert.ok(p.baris.some(([k, v]) => k === "Gaji pokok" && v === "Tidak ada di tabel"), JSON.stringify(p.baris));
  assert.match(p.catatan, /^Perhatian: masa kerja hasil hitungan belum ada di tabel gaji/);
  // Yang cocok dengan tabel tidak diberi peringatan.
  const wajar = pratayangLaporSk(sekarang, { ...kosong, golonganBaru: "III/a" });
  assert.ok(wajar && wajar.ok);
  assert.doesNotMatch(wajar.catatan, /Perhatian/);
  assert.ok(wajar.baris.some(([k, v]) => k === "Gaji pokok" && v.startsWith("Rp")));
});

test("PMK: pratinjau menghitung masa kerja dan jadwal, dan menolak TMT yang mendahului KGB terakhir", () => {
  const pmk = { ...kosong, jenis: "pmk" as const, mkgTahunSk: "9", mkgBulanSk: "0", tmt: "2027-03-01" };
  const sekarangIII: KeadaanTercatat = { golongan: "III/a", mkgTahun: 6, mkgBulan: 0, tmtKgbTerakhir: "2026-12-01" };
  const p = pratayangLaporSk(sekarangIII, pmk);
  assert.ok(p && p.ok, JSON.stringify(p));
  assert.ok(p.baris.some(([k]) => k === "KGB berikutnya"));
  const lebihAwal = pratayangLaporSk(sekarangIII, { ...pmk, tmt: "2026-06-01" });
  assert.ok(lebihAwal && !lebihAwal.ok);
  assert.equal(pratayangLaporSk(sekarangIII, { ...pmk, mkgTahunSk: "", mkgBulanSk: "" }), null);
});

test("kekurangan laporan disebut satu per satu menurut jenisnya", () => {
  assert.deepEqual(kekuranganLaporSk(kosong), ["golongan baru menurut SK", "nomor SK kenaikan pangkat", "tanggal SK", "TMT pangkat"]);
  assert.deepEqual(kekuranganLaporSk({ ...kosong, jenis: "pmk" }), [
    "masa kerja golongan menurut SK PMK", "nomor SK peninjauan masa kerja", "tanggal SK", "TMT PMK",
  ]);
  assert.deepEqual(
    kekuranganLaporSk({ ...kosong, golonganBaru: "III/a", nomorSk: " SK-1 ", tanggalSk: "2026-01-29", tmt: "2026-02-01" }),
    [],
  );
});

test("peringatan dampak: KGB diproses dihitung ulang; SK yang sudah ditandatangani menahan laporan; lainnya tanpa peringatan", () => {
  const proses = peringatanDampakKgb("sedang_diproses", "2026-12-01");
  assert.equal(proses?.nada, "kuning");
  assert.match(proses?.teks ?? "", /sedang diproses Kanwil.*dibuat ulang/);
  const ttd = peringatanDampakKgb("menunggu_keuangan", "2026-12-01");
  assert.equal(ttd?.nada, "merah");
  assert.match(ttd?.teks ?? "", /sudah ditandatangani.*membatalkan KGB/);
  for (const s of ["selesai", "belum_diproses", null, undefined, ""]) assert.equal(peringatanDampakKgb(s, "2026-12-01"), null, String(s));
});
