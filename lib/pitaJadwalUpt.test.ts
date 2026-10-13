// Pita jadwal kirim surat usulan di Dasbor Admin UPT (ADR-101).
//
// Jalankan: node --import tsx --test lib/pitaJadwalUpt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  geserKunciBulan,
  hitungPerTahap,
  langkahJendela,
  perluPeriksaSk,
  rekonBulanIni,
  susunKalenderTmt,
  susunPitaUpt,
  tahapPita,
  tahunKalenderTmt,
  teksJendela,
  type PegawaiPita,
} from "./pitaJadwalUpt";

const p = (ubah: Partial<PegawaiPita> = {}): PegawaiPita => ({ bulanTmt: "2026-12", statusKGB: null, usulanBerjalan: null, konfirmasi: "belum", ...ubah });

test("tahap pegawai sejalan dengan kolom papan Alur KGB", () => {
  assert.equal(tahapPita(p()), "usulkan");
  assert.equal(tahapPita(p({ usulanBerjalan: "draf" })), "usulkan");
  assert.equal(tahapPita(p({ usulanBerjalan: "revisi", konfirmasi: "berlaku" })), "usulkan");
  assert.equal(tahapPita(p({ usulanBerjalan: "menunggu" })), "kanwil");
  // Data sudah disetujui, KGB belum diinput Kanwil (ADR-082): tetap di Kanwil.
  assert.equal(tahapPita(p({ konfirmasi: "berlaku" })), "kanwil");
  assert.equal(tahapPita(p({ konfirmasi: "berlaku", statusKGB: "belum_diproses" })), "kanwil");
  assert.equal(tahapPita(p({ statusKGB: "sedang_diproses" })), "kanwil");
  assert.equal(tahapPita(p({ statusKGB: "menunggu_keuangan" })), "sk");
  assert.equal(tahapPita(p({ statusKGB: "selesai" })), "selesai");
  // KGB yang ditolak kembali perlu diusulkan.
  assert.equal(tahapPita(p({ statusKGB: "ditolak" })), "usulkan");
});

test("jumlah per tahap, mis. untuk kartu Terlambat yang sebagian sudah diproses Kanwil", () => {
  assert.deepEqual(hitungPerTahap([p(), p({ statusKGB: "sedang_diproses" }), p({ statusKGB: "menunggu_keuangan" })]), {
    usulkan: 1,
    kanwil: 1,
    sk: 1,
    selesai: 0,
  });
});

test("Periksa SK dihitung terpisah: di Kanwil, tetapi menunggu tindakan UPT", () => {
  assert.equal(perluPeriksaSk(p({ statusKGB: "sedang_diproses", reviewSk: { status: "menunggu" } })), true);
  assert.equal(perluPeriksaSk(p({ statusKGB: "sedang_diproses", reviewSk: { status: "disetujui" } })), false);
  assert.equal(perluPeriksaSk(p({ statusKGB: "sedang_diproses" })), false);
});

test("pita mulai bulan kirim berjalan; TMT dua bulan sesudahnya; jumlah per tahap", () => {
  const pegawai = [
    p({ bulanTmt: "2026-12" }),
    p({ bulanTmt: "2026-12", usulanBerjalan: "menunggu" }),
    p({ bulanTmt: "2026-12", statusKGB: "sedang_diproses", reviewSk: { status: "menunggu" } }),
    p({ bulanTmt: "2026-12", statusKGB: "selesai" }),
    p({ bulanTmt: "2027-01" }),
    p({ bulanTmt: "2026-11" }), // sudah lewat jendela kirim: bukan bagian pita (kartu Terlambat)
  ];
  const pita = susunPitaUpt(pegawai, new Date(2026, 9, 10), 20);
  assert.deepEqual(pita.map((b) => [b.bulanKirim, b.bulanTmt]), [
    ["2026-10", "2026-12"],
    ["2026-11", "2027-01"],
    ["2026-12", "2027-02"],
    ["2027-01", "2027-03"],
  ]);
  assert.equal(pita[0].jumlah, 4);
  assert.deepEqual(pita[0].perTahap, { usulkan: 1, kanwil: 2, sk: 0, selesai: 1 });
  assert.equal(pita[0].periksaSk, 1);
  assert.equal(pita[1].jumlah, 1);
  assert.equal(pita[2].jumlah, 0);
});

test("jendela kirim: sisa hari, hari terakhir, ditutup, dan hitung mundur ke bulan berikutnya", () => {
  const pada = (tgl: Date) => susunPitaUpt([], tgl, 20);
  const okt10 = pada(new Date(2026, 9, 10));
  assert.deepEqual(okt10[0].jendela, { keadaan: "buka", sisaHari: 10 });
  assert.equal(okt10[0].hariIni, 10);
  assert.equal(okt10[0].hariDalamBulan, 31);
  assert.deepEqual(okt10[1].jendela, { keadaan: "belum", mulaiDalam: 22 });
  assert.equal(okt10[1].hariIni, null);
  assert.deepEqual(pada(new Date(2026, 9, 20))[0].jendela, { keadaan: "buka", sisaHari: 0 });
  assert.deepEqual(pada(new Date(2026, 9, 21))[0].jendela, { keadaan: "tutup" });
  // Pergantian tahun dan Februari.
  const des = pada(new Date(2026, 11, 31));
  assert.deepEqual(des.map((b) => b.bulanKirim), ["2026-12", "2027-01", "2027-02", "2027-03"]);
  assert.deepEqual(des[1].jendela, { keadaan: "belum", mulaiDalam: 1 });
  assert.equal(des[2].hariDalamBulan, 28);
});

test("kalimat hitung mundur", () => {
  assert.equal(teksJendela({ keadaan: "buka", sisaHari: 10 }, 20, "Okt"), "sisa 10 hari");
  assert.equal(teksJendela({ keadaan: "buka", sisaHari: 0 }, 20, "Okt"), "hari terakhir kirim, 20 Okt");
  assert.equal(teksJendela({ keadaan: "tutup" }, 20, "Okt"), "ditutup 20 Okt");
  assert.equal(teksJendela({ keadaan: "belum", mulaiDalam: 1 }, 20, "Nov"), "dibuka besok");
  assert.equal(teksJendela({ keadaan: "belum", mulaiDalam: 22 }, 20, "Nov"), "dibuka 22 hari lagi");
  assert.equal(geserKunciBulan("2026-11", 2), "2027-01");
});

test("kalender TMT setahun: jumlah per tahap dan keadaan tiap bulan", () => {
  const pegawai = [
    p({ bulanTmt: "2026-04", statusKGB: "selesai" }),
    p({ bulanTmt: "2026-10", statusKGB: "menunggu_keuangan" }),
    p({ bulanTmt: "2026-11" }), // lewat jendela, belum diusulkan
    p({ bulanTmt: "2026-11", statusKGB: "sedang_diproses" }),
    p({ bulanTmt: "2026-12", usulanBerjalan: "menunggu" }),
    p({ bulanTmt: "2027-01" }),
  ];
  const k = susunKalenderTmt(pegawai, 2026, "2026-12");
  assert.equal(k.length, 12);
  assert.equal(k[0].bulanTmt, "2026-01");
  assert.equal(k[0].keadaan, "kosong");
  assert.equal(k[3].keadaan, "selesai");
  assert.equal(k[9].keadaan, "berjalan");
  assert.equal(k[10].keadaan, "terlambat");
  assert.deepEqual(k[10].perTahap, { usulkan: 1, kanwil: 1, sk: 0, selesai: 0 });
  assert.equal(k[11].keadaan, "jendela");
  assert.equal(k[11].jumlah, 1);
  const depan = susunKalenderTmt(pegawai, 2027, "2026-12");
  assert.equal(depan[0].keadaan, "belum");
  assert.equal(depan[1].keadaan, "kosong");
});

test("tahun kalender: tahun ini dan depan, tahun lalu hanya bila masih ada yang tertinggal", () => {
  assert.deepEqual(tahunKalenderTmt([p({ bulanTmt: "2026-12" })], 2026), [2026, 2027]);
  assert.deepEqual(tahunKalenderTmt([p({ bulanTmt: "2025-12" }), p({ bulanTmt: "2023-01" })], 2026), [2025, 2026, 2027]);
});

test("langkah jendela kirim mengikuti tahap pegawai", () => {
  const keadaan = (perTahap: Record<string, number>) =>
    langkahJendela({ jumlah: Object.values(perTahap).reduce((a, b) => a + b, 0), perTahap: { usulkan: 0, kanwil: 0, sk: 0, selesai: 0, ...perTahap } }).map((l) => l.keadaan);
  assert.deepEqual(keadaan({}), ["belum", "belum", "belum", "belum"]);
  assert.deepEqual(keadaan({ usulkan: 12, kanwil: 6 }), ["aktif", "aktif", "belum", "belum"]);
  assert.deepEqual(keadaan({ kanwil: 57 }), ["selesai", "selesai", "aktif", "belum"]);
  assert.deepEqual(keadaan({ sk: 3, selesai: 2 }), ["selesai", "selesai", "selesai", "belum"]);
  assert.deepEqual(keadaan({ selesai: 4 }), ["selesai", "selesai", "selesai", "selesai"]);
});

test("rekon bulan ini: TMT bulan depan dan yang sudah direkam", () => {
  const r = rekonBulanIni([p({ bulanTmt: "2026-11", statusKGB: "selesai" }), p({ bulanTmt: "2026-11", statusKGB: "menunggu_keuangan" }), p()], "2026-12");
  assert.deepEqual(r, { bulanTmt: "2026-11", jumlah: 2, selesai: 1 });
});
