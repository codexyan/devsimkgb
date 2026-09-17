// Perencanaan notifikasi otomatis dan pembatasan tipe per role.
//
// Jalankan: node --import tsx --test lib/generateNotifikasi.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bolehLihatNotifikasi,
  rencanaNotifikasi,
  tahapPengingatKgb,
  tipeNotifikasiUntukRole,
} from "./generateNotifikasi";

const tanggal = (tahun: number, bulan: number, hari = 1, jam = 0) => new Date(tahun, bulan - 1, hari, jam);

type Masukan = Parameters<typeof rencanaNotifikasi>[0];
type Notif = Masukan["notifikasi"][number];

function pegawai(p: Partial<Masukan["pegawai"][number]> = {}): Masukan["pegawai"][number] {
  return {
    id: "p1",
    nama: "Pegawai Contoh",
    nip: "000000000000000000",
    aktif: true,
    // TMT 1 Juni 2026: deadline SDM 30 April 2026.
    tmtKgbBerikutnya: tanggal(2026, 6),
    statusHukdis: false,
    tanggalHukdisBerakhir: null,
    jenisHukdis: null,
    ...p,
  };
}

function rencana(hariIni: Date, notifikasi: Notif[] = [], lain: Partial<Masukan> = {}) {
  return rencanaNotifikasi({
    hariIni,
    h1: 14,
    h2: 7,
    notifikasi,
    pegawai: [pegawai()],
    kgb: [],
    riwayatHukdis: [],
    ...lain,
  });
}

function notif(id: string, prioritas: string, createdAt: Date, tipe = "kgb_jatuh_tempo", referenceId = "p1"): Notif {
  return { id, tipe, referenceId, prioritas, createdAt, dibaca: false };
}

test("tahap pengingat menurut selisih hari", () => {
  assert.equal(tahapPengingatKgb(15, 14, 7), null);
  assert.equal(tahapPengingatKgb(14, 14, 7), "h1");
  assert.equal(tahapPengingatKgb(8, 14, 7), "h1");
  assert.equal(tahapPengingatKgb(7, 14, 7), "h2");
  assert.equal(tahapPengingatKgb(0, 14, 7), "hari_h");
  assert.equal(tahapPengingatKgb(-1, 14, 7), "rapelan");
});

test("H-14, H-7, dan hari-H masing-masing muncul tepat pada harinya", () => {
  const h14 = rencana(tanggal(2026, 4, 16));
  assert.equal(h14.baru.length, 1);
  assert.equal(h14.baru[0].prioritas, "info");
  assert.match(h14.baru[0].judul, /H-14/);

  const sudahH14 = [notif("n1", "info", tanggal(2026, 4, 16, 8))];
  const h7 = rencana(tanggal(2026, 4, 23), sudahH14);
  assert.equal(h7.baru.length, 1);
  assert.equal(h7.baru[0].prioritas, "warning");
  assert.match(h7.baru[0].judul, /H-7/);

  const sudahH7 = [...sudahH14, notif("n2", "warning", tanggal(2026, 4, 23, 8))];
  assert.equal(rencana(tanggal(2026, 4, 20), sudahH14).baru.length, 0);
  assert.equal(rencana(tanggal(2026, 4, 24), sudahH7).baru.length, 0);

  const hariH = rencana(tanggal(2026, 4, 30), sudahH7);
  assert.equal(hariH.baru.length, 1);
  assert.equal(hariH.baru[0].prioritas, "critical");
  assert.match(hariH.baru[0].judul, /Hari Ini/);

  const terlambat = rencana(tanggal(2026, 5, 1), [...sudahH7, notif("n3", "critical", tanggal(2026, 4, 30, 8))]);
  assert.equal(terlambat.baru.length, 1);
  assert.equal(terlambat.baru[0].tipe, "rapelan");
  assert.equal(rencana(tanggal(2026, 5, 20), [notif("n4", "critical", tanggal(2026, 5, 1, 8), "rapelan")]).baru.length, 0);
});

test("pengingat pertama yang terlewat tidak menahan tahap berikutnya", () => {
  const h5 = rencana(tanggal(2026, 4, 25));
  assert.equal(h5.baru.length, 1);
  assert.equal(h5.baru[0].prioritas, "warning");
});

test("siklus KGB berikutnya mendapat pengingat baru", () => {
  const siklusLama = [notif("n1", "critical", tanggal(2026, 4, 30, 8)), notif("n2", "warning", tanggal(2026, 4, 23, 8))];
  const hasil = rencana(tanggal(2028, 4, 16), siklusLama, { pegawai: [pegawai({ tmtKgbBerikutnya: tanggal(2028, 6) })] });
  assert.equal(hasil.baru.length, 1);
  assert.equal(hasil.baru[0].prioritas, "info");
});

test("hukdis yang tidak berdampak KGB tidak menahan pengingat", () => {
  const hukdisBiasa = pegawai({ statusHukdis: true, tanggalHukdisBerakhir: tanggal(2026, 12, 31), jenisHukdis: "teguran_tertulis" });
  const tidakBerdampak = rencana(tanggal(2026, 4, 16), [], {
    pegawai: [hukdisBiasa],
    riwayatHukdis: [{ pegawaiId: "p1", berdampakKGB: false, tmtBerakhir: tanggal(2026, 12, 31) }],
  });
  assert.equal(tidakBerdampak.baru.filter((n) => n.tipe === "kgb_jatuh_tempo").length, 1);

  const berdampak = rencana(tanggal(2026, 4, 16), [], {
    pegawai: [hukdisBiasa],
    riwayatHukdis: [{ pegawaiId: "p1", berdampakKGB: true, tmtBerakhir: tanggal(2026, 12, 31) }],
  });
  assert.equal(berdampak.baru.filter((n) => n.tipe === "kgb_jatuh_tempo").length, 0);
});

test("KGB yang sudah diinput tidak diingatkan", () => {
  const hasil = rencana(tanggal(2026, 4, 23), [], {
    kgb: [{ id: "k1", pegawaiId: "p1", status: "sedang_diproses", tmtKgbBaru: new Date("2026-05-31T16:00:00Z"), isArsip: false, flagRapelan: false }],
  });
  assert.equal(hasil.baru.length, 0);

  const dibatalkan = rencana(tanggal(2026, 4, 23), [], {
    kgb: [{ id: "k1", pegawaiId: "p1", status: "ditolak", tmtKgbBaru: tanggal(2026, 6), isArsip: false, flagRapelan: false }],
  });
  assert.equal(dibatalkan.baru.length, 1);
});

test("pegawai tidak aktif tidak mendapat notifikasi", () => {
  assert.equal(rencana(tanggal(2026, 4, 16), [], { pegawai: [pegawai({ aktif: false })] }).baru.length, 0);
});

test("SK menunggu keuangan dibuat sekali per KGB dan ditandai dibaca setelah dikonfirmasi", () => {
  const kgb = [
    { id: "k1", pegawaiId: "p1", status: "menunggu_keuangan", tmtKgbBaru: tanggal(2026, 10), isArsip: false, flagRapelan: true },
    { id: "k2", pegawaiId: "p1", status: "selesai", tmtKgbBaru: tanggal(2024, 10), isArsip: false, flagRapelan: false },
  ];
  const hariIni = tanggal(2026, 9, 15);
  const pertama = rencana(hariIni, [], { pegawai: [pegawai({ tmtKgbBerikutnya: tanggal(2028, 10) })], kgb });
  assert.deepEqual(
    pertama.baru.map((n) => [n.tipe, n.referenceId, n.prioritas]),
    [["sk_menunggu_keuangan", "k1", "warning"]],
  );

  const kedua = rencana(
    hariIni,
    [notif("n1", "warning", tanggal(2026, 9, 10), "sk_menunggu_keuangan", "k1"), notif("n2", "info", tanggal(2024, 9, 10), "sk_menunggu_keuangan", "k2")],
    { pegawai: [pegawai({ tmtKgbBerikutnya: tanggal(2028, 10) })], kgb },
  );
  assert.equal(kedua.baru.length, 0);
  assert.deepEqual(kedua.tandaiDibaca, ["n2"]);
});

test("tipe notifikasi per role", () => {
  assert.equal(tipeNotifikasiUntukRole("superAdminCore"), null);
  assert.deepEqual(tipeNotifikasiUntukRole("keuangan"), ["sk_menunggu_keuangan"]);
  assert.deepEqual(tipeNotifikasiUntukRole("sdm_hukdis"), ["hukdis_berakhir"]);
  assert.equal(bolehLihatNotifikasi("keuangan", "rapelan"), false);
  assert.equal(bolehLihatNotifikasi("keuangan", "followup_keuangan"), false);
  assert.equal(bolehLihatNotifikasi("sdm_kgb", "followup_keuangan"), true);
  assert.equal(bolehLihatNotifikasi("sdm_hukdis", "kgb_jatuh_tempo"), false);
  assert.equal(bolehLihatNotifikasi("peran_lain", "rapelan"), false);
  assert.equal(bolehLihatNotifikasi("superAdminCore", "tipe_lama"), true);
});
