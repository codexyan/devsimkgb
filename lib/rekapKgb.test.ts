// Definisi hitungan KGB bersama untuk dashboard, Data KGB, laporan, dan rekap keuangan.
//
// Jalankan: node --import tsx --test lib/rekapKgb.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  entriVirtual,
  hitungRekapStatus,
  isoTanggalKalender,
  kunciBulanTmt,
  pilihKgbSiklus,
  rapelanSiklus,
  rekapPerBulanTmt,
  satuPerSiklus,
  statusRapelan,
  tanpaBatalYangDiganti,
  type KgbUntukRekap,
} from "./rekapKgb";

const tanggal = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);
const HARI_INI = tanggal(2026, 9, 15);

function kgb(p: Partial<KgbUntukRekap> & { pegawaiId: string; status: string }): KgbUntukRekap {
  return { id: `${p.pegawaiId}-${p.status}`, tmtKgbBaru: tanggal(2026, 11), createdAt: tanggal(2026, 1), ...p };
}

test("kunci bulan TMT memakai tanggal kalender WITA", () => {
  assert.equal(kunciBulanTmt("2026-05-31T16:00:00Z"), "2026-06");
  assert.equal(kunciBulanTmt("2026-06-01T00:00:00Z"), "2026-06");
  assert.equal(kunciBulanTmt(null), null);
});

test("dibatalkan lalu diinput ulang dihitung satu kali", () => {
  const daftar = [
    kgb({ id: "a1", pegawaiId: "a", status: "ditolak", createdAt: tanggal(2026, 8, 1) }),
    kgb({ id: "a2", pegawaiId: "a", status: "sedang_diproses", createdAt: tanggal(2026, 8, 5) }),
    kgb({ id: "b1", pegawaiId: "b", status: "ditolak" }),
    kgb({ id: "b2", pegawaiId: "b", status: "ditolak", createdAt: tanggal(2026, 2) }),
  ];
  assert.deepEqual(
    satuPerSiklus(daftar).map((k) => k.id),
    ["a2", "b2"],
  );
  const rekap = hitungRekapStatus(daftar, HARI_INI);
  assert.equal(rekap.total, 2);
  assert.equal(rekap.sedangDiproses, 1);
  assert.equal(rekap.ditolak, 1);
});

test("dibatalkan lalu diinput ulang dengan TMT lain tidak lagi dihitung dibatalkan atau terlambat", () => {
  // KGB TMT 1 Mei 2026 dibatalkan karena TMT salah, TMT pegawai diperbaiki ke 1 Juli 2026, lalu KGB
  // diinput ulang dan dikonfirmasi.
  const daftar = [
    kgb({ id: "batal", pegawaiId: "a", status: "ditolak", tmtKgbBaru: tanggal(2026, 5), createdAt: tanggal(2024, 5) }),
    kgb({ id: "ulang", pegawaiId: "a", status: "selesai", tmtKgbBaru: tanggal(2026, 7), createdAt: tanggal(2026, 5, 10) }),
    kgb({ id: "berikut", pegawaiId: "a", status: "belum_diproses", tmtKgbBaru: tanggal(2028, 7), createdAt: tanggal(2026, 5, 20) }),
  ];
  assert.deepEqual(
    satuPerSiklus(daftar).map((k) => k.id),
    ["ulang", "berikut"],
  );
  const rekap = hitungRekapStatus(daftar, HARI_INI);
  assert.equal(rekap.ditolak, 0);
  assert.equal(rekap.terlambat, 0);
  assert.equal(rekapPerBulanTmt(daftar, HARI_INI).find((r) => r.bulanTmt === "2026-05"), undefined);
  // Selama belum ada pengganti, pembatalan tetap dihitung.
  assert.deepEqual(
    tanpaBatalYangDiganti(daftar.slice(0, 1)).map((k) => k.id),
    ["batal"],
  );
  // Filter periode sesudah aturan ini tidak memunculkan kembali pembatalan yang sudah diganti.
  assert.deepEqual(
    satuPerSiklus(tanpaBatalYangDiganti(daftar).filter((k) => kunciBulanTmt(k.tmtKgbBaru) === "2026-05")),
    [],
  );
});

test("dibatalkan lalu dicatat sebagai Arsip KGB dengan TMT yang sama: pembatalan tidak dihitung", () => {
  const daftar = [
    kgb({ id: "batal", pegawaiId: "a", status: "ditolak", tmtKgbBaru: tanggal(2026, 8), createdAt: tanggal(2024, 8) }),
    kgb({ id: "arsip", pegawaiId: "a", status: "selesai", isArsip: true, tmtKgbBaru: tanggal(2026, 8), createdAt: tanggal(2026, 9, 1) }),
    kgb({ id: "berikut", pegawaiId: "a", status: "belum_diproses", tmtKgbBaru: tanggal(2028, 8), createdAt: tanggal(2026, 9, 1) }),
    kgb({ id: "lain", pegawaiId: "b", status: "ditolak", tmtKgbBaru: tanggal(2026, 8) }),
  ];
  const rekap = hitungRekapStatus(daftar, HARI_INI);
  assert.equal(rekap.total, 2);
  assert.equal(rekap.ditolak, 1);
  assert.equal(rekap.terlambat, 1);
});

test("entri virtual kalah dari record dibatalkan dengan TMT yang sama", () => {
  const nyata = [kgb({ id: "x1", pegawaiId: "x", status: "ditolak", tmtKgbBaru: tanggal(2026, 10) })];
  const virtual = entriVirtual([{ id: "x", aktif: true, tmtKgbBerikutnya: tanggal(2026, 10) }], nyata);
  assert.equal(virtual.length, 1);
  const rekap = hitungRekapStatus([...nyata, ...virtual], HARI_INI);
  assert.equal(rekap.total, 1);
  assert.equal(rekap.ditolak, 1);
  assert.equal(rekap.belumDiproses, 0);
});

test("entri virtual hanya untuk pegawai aktif tanpa KGB aktif dan dengan TMT", () => {
  const pegawai = [
    { id: "p1", aktif: true, tmtKgbBerikutnya: tanggal(2027, 1) },
    { id: "p2", aktif: false, tmtKgbBerikutnya: tanggal(2027, 1) },
    { id: "p3", aktif: true, tmtKgbBerikutnya: null },
    { id: "p4", aktif: true, tmtKgbBerikutnya: tanggal(2027, 1) },
  ];
  const daftar = [kgb({ pegawaiId: "p4", status: "menunggu_keuangan" }), kgb({ pegawaiId: "p1", status: "selesai" })];
  assert.deepEqual(
    entriVirtual(pegawai, daftar).map((k) => k.pegawaiId),
    ["p1"],
  );
});

test("menunggu keuangan dihitung terpisah dan masuk diproses", () => {
  const rekap = hitungRekapStatus(
    [
      kgb({ pegawaiId: "a", status: "menunggu_keuangan" }),
      kgb({ pegawaiId: "b", status: "sedang_diproses" }),
      kgb({ pegawaiId: "c", status: "selesai" }),
      kgb({ pegawaiId: "d", status: "belum_diproses", tmtKgbBaru: tanggal(2027, 6) }),
      kgb({ pegawaiId: "e", status: "selesai", isArsip: true }),
    ],
    HARI_INI,
  );
  assert.deepEqual(
    { ...rekap },
    {
      total: 4,
      belumDiproses: 1,
      sedangDiproses: 1,
      menungguKeuangan: 1,
      selesai: 1,
      ditolak: 0,
      diproses: 2,
      rapelanDitetapkan: 0,
      berpotensiRapelan: 0,
      terlambat: 0,
    },
  );
});

test("satu aturan rapelan per status", () => {
  // TMT 1 November 2026: deadline SDM 30 September 2026. TMT 1 Oktober 2026: deadline 31 Agustus.
  const lewat = tanggal(2026, 10);
  const belumLewat = tanggal(2026, 11);
  assert.equal(statusRapelan({ status: "selesai", tmtKgbBaru: lewat, rapelanDitetapkan: true }, HARI_INI), "ditetapkan");
  assert.equal(statusRapelan({ status: "selesai", tmtKgbBaru: lewat, flagRapelan: true, rapelanDitetapkan: false }, HARI_INI), null);
  assert.equal(statusRapelan({ status: "sedang_diproses", tmtKgbBaru: lewat, flagRapelan: false }, HARI_INI), null);
  assert.equal(statusRapelan({ status: "menunggu_keuangan", tmtKgbBaru: belumLewat, flagRapelan: true }, HARI_INI), "berpotensi");
  assert.equal(statusRapelan({ status: "belum_diproses", tmtKgbBaru: lewat, flagRapelan: false }, HARI_INI), "berpotensi");
  assert.equal(statusRapelan({ status: "belum_diproses", tmtKgbBaru: belumLewat, flagRapelan: true }, HARI_INI), null);
  assert.equal(statusRapelan({ status: "ditolak", tmtKgbBaru: lewat }, HARI_INI), null);

  const rekap = hitungRekapStatus(
    [
      kgb({ pegawaiId: "a", status: "belum_diproses", tmtKgbBaru: lewat }),
      kgb({ pegawaiId: "b", status: "menunggu_keuangan", flagRapelan: true }),
      kgb({ pegawaiId: "c", status: "selesai", rapelanDitetapkan: true }),
    ],
    HARI_INI,
  );
  assert.equal(rekap.rapelanDitetapkan, 1);
  assert.equal(rekap.berpotensiRapelan, 2);
  assert.equal(rekap.terlambat, 1);
});

test("rekap per bulan TMT dari data KGB, tanpa arsip dan tanpa entri batal ganda", () => {
  const rekap = rekapPerBulanTmt([
    kgb({ pegawaiId: "a", status: "selesai", tmtKgbBaru: tanggal(2026, 10), rapelanDitetapkan: true, konfirmasiKeuanganAt: "2026-09-02T02:00:00Z" }),
    kgb({ pegawaiId: "b", status: "selesai", tmtKgbBaru: tanggal(2026, 10), konfirmasiKeuanganAt: "2026-09-10T02:00:00Z" }),
    kgb({ pegawaiId: "c", status: "menunggu_keuangan", tmtKgbBaru: tanggal(2026, 10) }),
    kgb({ pegawaiId: "d", status: "sedang_diproses", tmtKgbBaru: tanggal(2026, 10) }),
    kgb({ pegawaiId: "e", status: "ditolak", tmtKgbBaru: tanggal(2026, 10) }),
    kgb({ pegawaiId: "f", status: "selesai", tmtKgbBaru: tanggal(2026, 10), isArsip: true }),
    kgb({ pegawaiId: "g", status: "belum_diproses", tmtKgbBaru: tanggal(2026, 12) }),
  ]);
  assert.deepEqual(
    rekap.map((r) => r.bulanTmt),
    ["2026-12", "2026-10"],
  );
  const oktober = rekap[1];
  // KGB yang dibatalkan dan belum diinput ulang masih harus diinput ulang, jadi tetap masuk total.
  assert.equal(oktober.total, 5);
  assert.equal(oktober.dikonfirmasi, 2);
  assert.equal(oktober.menungguKeuangan, 1);
  assert.equal(oktober.belumSampaiKeuangan, 2);
  assert.equal(oktober.dibatalkan, 1);
  assert.equal(oktober.rapelanDitetapkan, 1);
  assert.equal(oktober.konfirmasiTerakhir?.toISOString(), "2026-09-10T02:00:00.000Z");
});

test("rekap per bulan TMT: dibatalkan lalu diinput ulang tidak menambah total", () => {
  const rekap = rekapPerBulanTmt(
    [
      kgb({ id: "a1", pegawaiId: "a", status: "ditolak", tmtKgbBaru: tanggal(2026, 10), createdAt: tanggal(2026, 8, 1) }),
      kgb({ id: "a2", pegawaiId: "a", status: "menunggu_keuangan", tmtKgbBaru: tanggal(2026, 10), flagRapelan: true, createdAt: tanggal(2026, 8, 5) }),
      kgb({ id: "b", pegawaiId: "b", status: "belum_diproses", tmtKgbBaru: tanggal(2026, 10) }),
    ],
    HARI_INI,
  );
  assert.equal(rekap.length, 1);
  assert.equal(rekap[0].total, 2);
  assert.equal(rekap[0].dibatalkan, 0);
  assert.equal(rekap[0].menungguKeuangan, 1);
  // TMT 1 Oktober 2026: deadline SDM 31 Agustus 2026 sudah lewat pada 15 September 2026.
  assert.equal(rekap[0].berpotensiRapelan, 2);
});

test("dibatalkan yang belum diinput ulang setelah deadline dihitung terlambat", () => {
  const lewat = tanggal(2026, 10);
  assert.deepEqual(rapelanSiklus({ status: "ditolak", tmtKgbBaru: lewat }, HARI_INI), { rapelan: "berpotensi", terlambat: true });
  assert.deepEqual(rapelanSiklus({ status: "ditolak", tmtKgbBaru: tanggal(2026, 12) }, HARI_INI), { rapelan: null, terlambat: false });
  assert.deepEqual(rapelanSiklus({ status: "sedang_diproses", tmtKgbBaru: lewat, flagRapelan: false }, HARI_INI), { rapelan: null, terlambat: false });
  const rekap = hitungRekapStatus([kgb({ pegawaiId: "a", status: "ditolak", tmtKgbBaru: lewat })], HARI_INI);
  assert.equal(rekap.terlambat, 1);
  assert.equal(rekap.berpotensiRapelan, 1);
  assert.equal(rekap.ditolak, 1);
});

test("tanggal kalender untuk respons API tidak bergeser menurut zona proses", () => {
  assert.equal(isoTanggalKalender("2026-09-30T16:00:00Z"), "2026-10-01T00:00:00.000Z");
  assert.equal(isoTanggalKalender("2026-10-01T00:00:00Z"), "2026-10-01T00:00:00.000Z");
  assert.equal(isoTanggalKalender(new Date(2026, 9, 1)), "2026-10-01T00:00:00.000Z");
  assert.equal(isoTanggalKalender(""), null);
});

test("pipeline: KGB selesai siklus lama tidak menutupi KGB yang sudah jatuh tempo", () => {
  const daftar = [
    kgb({ id: "lama", pegawaiId: "p", status: "selesai", tmtKgbBaru: tanggal(2024, 8), createdAt: tanggal(2024, 7) }),
    kgb({ id: "placeholder", pegawaiId: "p", status: "belum_diproses", tmtKgbBaru: tanggal(2026, 8), createdAt: tanggal(2024, 8) }),
  ];
  const hasil = pilihKgbSiklus({ tmtKgbBerikutnya: tanggal(2026, 8), kgb: daftar, hariIni: HARI_INI, tahun: 2026 });
  assert.equal(hasil.kgbBerjalan, null);
  assert.equal(hasil.selesaiSebelumnya?.id, "lama");
});

test("pipeline: KGB yang sedang diproses selalu menjadi siklus berjalan", () => {
  const daftar = [
    kgb({ id: "lama", pegawaiId: "p", status: "selesai", tmtKgbBaru: tanggal(2024, 10), createdAt: tanggal(2024, 9) }),
    kgb({ id: "proses", pegawaiId: "p", status: "sedang_diproses", tmtKgbBaru: tanggal(2026, 10), createdAt: tanggal(2026, 8) }),
  ];
  // Input KGB sudah menggeser TMT pegawai ke siklus berikutnya.
  const hasil = pilihKgbSiklus({ tmtKgbBerikutnya: tanggal(2028, 10), kgb: daftar, hariIni: HARI_INI, tahun: 2026 });
  assert.equal(hasil.kgbBerjalan?.id, "proses");
  assert.equal(hasil.selesaiSebelumnya?.id, "lama");
});

test("pipeline: KGB selesai tahun ini tetap tampil sampai masa input berikutnya dibuka", () => {
  const daftar = [
    kgb({ id: "selesai", pegawaiId: "p", status: "selesai", tmtKgbBaru: tanggal(2026, 8), createdAt: tanggal(2026, 6) }),
    kgb({ id: "berikut", pegawaiId: "p", status: "belum_diproses", tmtKgbBaru: tanggal(2028, 8), createdAt: tanggal(2026, 7) }),
  ];
  const tahunIni = pilihKgbSiklus({ tmtKgbBerikutnya: tanggal(2028, 8), kgb: daftar, hariIni: HARI_INI, tahun: 2026 });
  assert.equal(tahunIni.kgbBerjalan?.id, "selesai");
  const tahunDepan = pilihKgbSiklus({ tmtKgbBerikutnya: tanggal(2028, 8), kgb: daftar, hariIni: tanggal(2027, 3), tahun: 2027 });
  assert.equal(tahunDepan.kgbBerjalan, null);
});

test("pipeline: KGB dibatalkan dengan TMT yang dibuka menjadi siklus berjalan", () => {
  const daftar = [
    kgb({ id: "batal", pegawaiId: "p", status: "ditolak", tmtKgbBaru: tanggal(2026, 10), createdAt: tanggal(2026, 8) }),
    kgb({ id: "arsip", pegawaiId: "p", status: "selesai", isArsip: true, tmtKgbBaru: tanggal(2024, 10), createdAt: tanggal(2026, 7) }),
  ];
  const hasil = pilihKgbSiklus({ tmtKgbBerikutnya: tanggal(2026, 10), kgb: daftar, hariIni: HARI_INI, tahun: 2026 });
  assert.equal(hasil.kgbBerjalan?.id, "batal");
  assert.equal(hasil.selesaiSebelumnya?.id, "arsip");
});
