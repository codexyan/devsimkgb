// Ringkasan KGB per satker (lib/rekapSatker.ts).
//
// Jalankan: node --import tsx --test lib/rekapSatker.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { rekapPerSatker } from "./rekapSatker";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(Date.UTC(tahun, bulan - 1, hari));
const UNIT = "Lembaga Pemasyarakatan Perempuan Kelas IIA Martapura";
const pegawai = (id: string, tmtKgbBerikutnya: Date, aktif = true) => ({
  id,
  aktif,
  tmtKgbBerikutnya,
  unitKerja: UNIT,
  statusHukdis: false,
});
const kgb = (id: string, pegawaiId: string, tmtKgbBaru: Date, status: string) => ({
  id,
  pegawaiId,
  status,
  tmtKgbBaru,
  flagRapelan: null,
  rapelanDitetapkan: null,
  isArsip: false,
  createdAt: tgl(2026, 9, 1),
});

test("jadwal per bulan TMT tetap menghitung KGB yang sudah diinput atau selesai di bulan TMT-nya (ADR-093)", () => {
  // Input KGB menggeser TMT KGB berikutnya di data pegawai ke siklus sesudahnya (app/api/kgb/route.ts).
  const daftarPegawai = [
    pegawai("a", tgl(2026, 12)), // belum diinput
    pegawai("b", tgl(2028, 12)), // KGB Des 2026 sedang diproses
    pegawai("c", tgl(2028, 12)), // KGB Des 2026 sudah selesai
    pegawai("d", tgl(2027, 1)), // belum diinput, bulan berikutnya
  ];
  const daftarKgb = [kgb("k-b", "b", tgl(2026, 12), "sedang_diproses"), kgb("k-c", "c", tgl(2026, 12), "selesai")];
  const r = rekapPerSatker({ pegawai: daftarPegawai, kgb: daftarKgb, hariIni: tgl(2026, 10, 8), bulanKeDepan: 3 }).satker.find(
    (s) => s.satker.kode === "lapas-perempuan-martapura",
  )!;
  assert.deepEqual(r.mendatang, [
    { bulanTmt: "2026-11", jumlah: 0 },
    { bulanTmt: "2026-12", jumlah: 3 },
    { bulanTmt: "2027-01", jumlah: 1 },
  ]);
  // Sama dengan dasar angka Selesai TMT tahun ini.
  assert.equal(r.tahunIni.total, 3);
  assert.equal(r.tahunIni.selesai, 1);
});

test("pegawai tidak aktif tanpa KGB yang berjalan tidak masuk jadwal", () => {
  const r = rekapPerSatker({
    pegawai: [pegawai("a", tgl(2026, 12), false), pegawai("b", tgl(2026, 12))],
    kgb: [],
    hariIni: tgl(2026, 10, 8),
    bulanKeDepan: 2,
  }).satker.find((s) => s.satker.kode === "lapas-perempuan-martapura")!;
  assert.deepEqual(r.mendatang, [
    { bulanTmt: "2026-11", jumlah: 0 },
    { bulanTmt: "2026-12", jumlah: 1 },
  ]);
});
