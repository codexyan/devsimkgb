// Pita jadwal kirim surat usulan di Dasbor Admin UPT (ADR-101).
//
// Jalankan: node --import tsx --test lib/pitaJadwalUpt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { geserKunciBulan, hitungPerTahap, perluPeriksaSk, susunPitaUpt, tahapPita, teksJendela, type PegawaiPita } from "./pitaJadwalUpt";

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
