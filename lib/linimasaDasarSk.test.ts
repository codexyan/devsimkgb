// Linimasa SK penetap gaji pokok dan Atas dasar SK KGB (ADR-020, ADR-062).
//
// Jalankan: node --import tsx --test lib/linimasaDasarSk.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { susunLinimasaDasar, type KgbUntukLinimasa, type SkPenetapGaji } from "./linimasaDasarSk";
import { dasarKgbBerikutnya } from "./dasarKgbBerikutnya";

// Tanggal kalender waktu setempat; modul membakukannya lewat tanggalKalender (WITA).
const tgl = (t: number, b: number, h = 1) => new Date(t, b - 1, h);
const isoTgl = (t: number, b: number, h = 1) => tgl(t, b, h).toISOString();

/** KGB 1 Des 2024 selesai di SIM-KGB, dan jadwal berikutnya yang dibuat dari penandatangannya. */
const kgb2024: KgbUntukLinimasa = {
  id: "kgb-2024",
  status: "selesai",
  tmtKgbBaru: tgl(2024, 12),
  golonganBaru: "III/a",
  mkgTahunBaru: 10,
  mkgBulanBaru: 0,
  gajiPokokBaru: 3_200_000,
  nomorSK: "W.17-KP.04.03-100",
  surat: { nomorSurat: "W.17-KP.04.03-900", tanggalSurat: tgl(2024, 11, 20) },
};
const jadwal2026: KgbUntukLinimasa = {
  id: "jadwal-2026",
  status: "belum_diproses",
  tmtKgbBaru: tgl(2026, 12),
  penetapSkDasar: "Kepala Kantor Wilayah",
};
const kp2026: SkPenetapGaji = {
  id: "kp-2026",
  nomorSK: "KP-2026",
  tanggalSK: tgl(2025, 12, 15),
  tmt: tgl(2026, 1),
  jenisKp: "reguler",
  penetapSK: "Kepala BKN",
  golonganLama: "III/a",
  golonganBaru: "III/b",
  gajiPokokBaru: 3_400_000,
};

test("contoh pemilik: KGB Des 2024 lalu kenaikan pangkat Jan 2026, dasar KGB Des 2026 adalah SK kenaikan pangkat", () => {
  const l = susunLinimasaDasar({
    kgb: [kgb2024, jadwal2026],
    pangkat: [kp2026],
    pegawai: { tmtKgbTerakhir: tgl(2024, 12), mkgTahun: 10, mkgBulan: 0 },
    tmtKgbBaru: tgl(2026, 12),
  });
  assert.equal(l.dasar?.jenis, "kp");
  assert.equal(l.dasar?.nomorSK, "KP-2026");
  assert.equal(l.dasar?.penetap, "Kepala BKN");
  assert.equal(l.dasar?.label, "SK kenaikan pangkat (Reguler)");
  assert.equal(l.dasar?.rincian, "Gol. III/a → III/b, Rp 3.400.000");
  assert.deepEqual(
    l.sk.map((s) => [s.nomorSK, s.peran]),
    [
      ["W.17-KP.04.03-900", "tergantikan"],
      ["KP-2026", "dasar"],
    ],
  );
  assert.equal(l.kgbTanpaSk, null);
});

test("contoh pemilik: tanpa kenaikan pangkat lagi, dasar KGB Des 2028 adalah SK KGB Des 2026", () => {
  const kgb2026: KgbUntukLinimasa = {
    id: "kgb-2026",
    status: "selesai",
    tmtKgbBaru: tgl(2026, 12),
    nomorSK: "KP-2026",
    penetapSkDasar: "Kepala BKN",
    surat: { nomorSurat: "W.17-KP.04.03-1500", tanggalSurat: tgl(2026, 11, 18) },
  };
  const jadwal2028 = { id: "jadwal-2028", status: "belum_diproses", tmtKgbBaru: tgl(2028, 12), penetapSkDasar: "Kepala Kantor Wilayah" };
  const l = susunLinimasaDasar({
    kgb: [kgb2024, kgb2026, jadwal2028],
    pangkat: [kp2026],
    pegawai: { tmtKgbTerakhir: tgl(2026, 12), mkgTahun: 7, mkgBulan: 0 },
    tmtKgbBaru: tgl(2028, 12),
  });
  assert.equal(l.dasar?.nomorSK, "W.17-KP.04.03-1500");
  assert.equal(l.dasar?.tmt, isoTgl(2026, 12));
  // Penandatangan SK KGB terbitan SIM-KGB dibaca dari jadwal sesudahnya.
  assert.equal(l.dasar?.penetap, "Kepala Kantor Wilayah");
  assert.deepEqual(
    l.sk.map((s) => s.peran),
    ["tergantikan", "tergantikan", "dasar"],
  );
  // Tidak ada KGB yang memakai SK KGB 2024 sebagai dasar (KGB 2026 berdasar SK kenaikan pangkat), jadi penetapnya
  // tidak diketahui.
  assert.equal(l.sk[0].penetap, null);
});

test("contoh pemilik: penyesuaian ijazah atau PMK sebelum TMT KGB menggantikan SK KGB terakhir", () => {
  const kgb2026 = { id: "kgb-2026", status: "selesai", tmtKgbBaru: tgl(2026, 12), surat: { nomorSurat: "SK-KGB-2026", tanggalSurat: tgl(2026, 11, 18) } };
  const pi = { id: "pi", nomorSK: "PI-2028", tanggalSK: tgl(2028, 2, 10), tmt: tgl(2028, 3), jenisKp: "penyesuaian_ijazah" };
  const pmk = { id: "pmk", nomorSK: "PMK-2028", tanggalSK: tgl(2028, 5, 2), tmt: tgl(2028, 6), tambahBulan: 18 };
  const dasar = (masukan: { pangkat?: SkPenetapGaji[]; pmk?: SkPenetapGaji[] }) =>
    susunLinimasaDasar({ kgb: [kgb2026], ...masukan, pegawai: { tmtKgbTerakhir: tgl(2026, 12) }, tmtKgbBaru: tgl(2028, 12) }).dasar;
  assert.equal(dasar({ pangkat: [pi] })?.label, "SK kenaikan pangkat (Pilihan: Penyesuaian Ijazah)");
  assert.equal(dasar({ pangkat: [pi], pmk: [pmk] })?.nomorSK, "PMK-2028");
  assert.equal(dasar({ pangkat: [pi], pmk: [pmk] })?.rincian, "masa kerja +1 th 6 bln");
});

test("SK yang berlaku sesudah TMT KGB yang dibuat tidak dihitung dan ditandai sesudah", () => {
  const kpLebihAwal = { ...kp2026, id: "kp-2027", nomorSK: "KP-2027", tmt: tgl(2027, 2) };
  const l = susunLinimasaDasar({
    kgb: [kgb2024],
    pangkat: [kpLebihAwal],
    pegawai: { tmtKgbTerakhir: tgl(2024, 12) },
    tmtKgbBaru: tgl(2026, 12),
  });
  assert.equal(l.dasar?.nomorSK, "W.17-KP.04.03-900");
  assert.deepEqual(
    l.sk.map((s) => [s.nomorSK, s.peran]),
    [
      ["W.17-KP.04.03-900", "dasar"],
      ["KP-2027", "sesudah"],
    ],
  );
  // Dashboard UPT memakai batas yang sama.
  assert.equal(
    dasarKgbBerikutnya({ kgb: [kgb2024], pangkat: [kpLebihAwal], pegawai: { tmtKgbTerakhir: tgl(2024, 12) }, tmtKgbBaru: tgl(2026, 12) })?.jenis,
    "kgb",
  );
});

test("Buat SK: Input KGB sudah memajukan TMT KGB terakhir pegawai, jadi batas bawahnya TMT sebelum KGB itu", () => {
  const diproses = { id: "kgb-x", status: "sedang_diproses", tmtKgbBaru: tgl(2026, 12), nomorSK: "W.17-KP.04.03-900", penetapSkDasar: "Kakanwil" };
  const pegawai = { tmtKgbTerakhir: tgl(2026, 12), mkgTahun: 10, mkgBulan: 0 };
  // Dengan TMT KGB terakhir pegawai, SK kenaikan pangkat Jan 2026 terbuang karena dianggap lebih lama.
  assert.equal(susunLinimasaDasar({ kgb: [kgb2024, diproses], pangkat: [kp2026], pegawai, tmtKgbBaru: tgl(2026, 12), kgbId: "kgb-x" }).dasar?.jenis, "kgb");
  const l = susunLinimasaDasar({
    kgb: [kgb2024, diproses],
    pangkat: [kp2026],
    pegawai,
    tmtKgbSebelumnya: tgl(2024, 12),
    tmtKgbBaru: tgl(2026, 12),
    kgbId: "kgb-x",
  });
  assert.equal(l.dasar?.nomorSK, "KP-2026");
  // KGB yang sedang dibuat bukan SK dasar bagi dirinya sendiri, tetapi isian SK dasarnya mengenali penetap SK 2024.
  assert.equal(l.sk.length, 2);
  assert.equal(l.sk[0].penetap, "Kakanwil");
});

test("SK dasar Data Pegawai yang sama dengan SK riwayat dipadukan; nomor, tanggal, dan penetapnya dari Data Pegawai", () => {
  const l = susunLinimasaDasar({
    kgb: [kgb2024],
    pegawai: {
      nomorSkDasar: "W.17-KP.04.03 - 900",
      tanggalSkDasar: tgl(2024, 11, 21),
      penetapSkDasar: "Kepala Kantor Wilayah Kementerian Imigrasi dan Pemasyarakatan",
      tmtKgbTerakhir: tgl(2024, 12),
      mkgTahun: 10,
    },
    tmtKgbBaru: tgl(2026, 12),
  });
  assert.equal(l.sk.length, 1);
  assert.equal(l.dasar?.dataPegawai, true);
  assert.equal(l.dasar?.nomorSK, "W.17-KP.04.03 - 900");
  assert.equal(l.dasar?.tanggalSK, isoTgl(2024, 11, 21));
  assert.equal(l.dasar?.penetap, "Kepala Kantor Wilayah Kementerian Imigrasi dan Pemasyarakatan");
  assert.equal(l.dasar?.tmt, isoTgl(2024, 12));
});

test("SK dasar Data Pegawai yang lebih lama dari riwayat tampil di awal tanpa TMT, sebagai tergantikan", () => {
  const l = susunLinimasaDasar({
    kgb: [kgb2024],
    pegawai: { nomorSkDasar: "SK-CPNS-2014", tanggalSkDasar: tgl(2014, 2, 1), tmtKgbTerakhir: tgl(2024, 12), mkgTahun: 10 },
    tmtKgbBaru: tgl(2026, 12),
  });
  assert.deepEqual(
    l.sk.map((s) => [s.nomorSK, s.tmt, s.peran]),
    [
      ["SK-CPNS-2014", null, "tergantikan"],
      ["W.17-KP.04.03-900", isoTgl(2024, 12), "dasar"],
    ],
  );
});

test("KGB terakhir pegawai yang SK-nya belum tercatat ditandai, sebab dasar yang ditemukan mungkin usang", () => {
  const l = susunLinimasaDasar({ kgb: [kgb2024], pegawai: { tmtKgbTerakhir: tgl(2026, 12), mkgTahun: 12 }, tmtKgbBaru: tgl(2028, 12) });
  assert.equal(l.dasar?.nomorSK, "W.17-KP.04.03-900");
  assert.equal(l.kgbTanpaSk, isoTgl(2026, 12));
  // Tanpa SK apa pun, dasarnya kosong dan KGB terakhirnya tetap ditandai.
  const kosong = susunLinimasaDasar({ kgb: [], pegawai: { tmtKgbTerakhir: tgl(2026, 12), mkgTahun: 12 }, tmtKgbBaru: tgl(2028, 12) });
  assert.equal(kosong.dasar, null);
  assert.equal(kosong.kgbTanpaSk, isoTgl(2026, 12));
});

test("pada TMT yang sama, SK kenaikan pangkat menang atas SK KGB dan tampil sesudahnya", () => {
  const kpSamaTmt = { ...kp2026, id: "kp-sama", nomorSK: "KP-SAMA", tmt: tgl(2024, 12) };
  const l = susunLinimasaDasar({ kgb: [kgb2024], pangkat: [kpSamaTmt], pegawai: { tmtKgbTerakhir: tgl(2024, 12) }, tmtKgbBaru: tgl(2026, 12) });
  assert.equal(l.dasar?.nomorSK, "KP-SAMA");
  assert.deepEqual(
    l.sk.map((s) => s.jenis),
    ["kgb", "kp"],
  );
});

test("record KGB tanpa TMT yang sah tidak menghalangi SK KGB lain menjadi dasar", () => {
  const rusak = { id: "rusak", status: "selesai", tmtKgbBaru: null, surat: { nomorSurat: "RUSAK" } };
  const l = susunLinimasaDasar({ kgb: [rusak, kgb2024], pegawai: { tmtKgbTerakhir: tgl(2024, 12) }, tmtKgbBaru: tgl(2026, 12) });
  assert.equal(l.dasar?.nomorSK, "W.17-KP.04.03-900");
});
