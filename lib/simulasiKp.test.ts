// Simulasi kenaikan pangkat dan proyeksi KGB untuk kalkulator publik /tabel-gaji.
//
// Jalankan: node --import tsx --test lib/simulasiKp.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { golonganBerikutnya, simulasiKenaikanPangkat } from "./simulasiKp";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

function hasil(...args: Parameters<typeof simulasiKenaikanPangkat>) {
  const r = simulasiKenaikanPangkat(...args);
  if (!r.ok) throw new Error(r.pesan);
  return r.hasil;
}

test("dalam jenjang: III/b MKG 2 ke III/c membawa MKG apa adanya", () => {
  const h = hasil({ golonganLama: "III/b", mkgTahun: 2, mkgBulan: 0, golonganBaru: "III/c" });
  assert.equal(h.potonganMkgTahun, 0);
  assert.equal(h.lintasJenjang, false);
  assert.equal(h.mkgTahunBaru, 2);
  assert.equal(h.gajiLama, 2995000);
  assert.equal(h.gajiBaru, 3121700);
  assert.equal(h.selisih, 126700);
  assert.equal(h.pangkatBaru, "Penata");
  // KGB berikutnya di III/c pada MKG 4.
  assert.equal(h.kgb[0].mkgTahun, 4);
  assert.equal(h.kgb[0].gajiPokok, 3220000);
  assert.equal(h.kgb[0].tmt, null);
  assert.equal(h.kgb.length, 3);
});

test("lintas jenjang: II/d MKG 7 ke III/a dipotong 5 tahun", () => {
  const h = hasil({ golonganLama: "II/d", mkgTahun: 7, mkgBulan: 0, golonganBaru: "III/a" });
  assert.equal(h.lintasJenjang, true);
  assert.equal(h.potonganMkgTahun, 5);
  assert.equal(h.mkgTahunBaru, 2);
  assert.equal(h.gajiLama, 2756800);
  assert.equal(h.gajiBaru, 2873500);
});

test("jadwal KGB tetap dari TMT KGB terakhir, tidak diulang dari TMT KP", () => {
  const h = hasil({
    golonganLama: "III/b", mkgTahun: 2, mkgBulan: 0, golonganBaru: "III/c",
    tmtKgbTerakhir: tgl(2025, 4), tmtKp: tgl(2026, 10),
  });
  assert.equal(h.kgb[0].sebelumKp, false);
  assert.deepEqual(h.kgb[0].tmt, tgl(2027, 4));
  assert.deepEqual(h.kgb[1].tmt, tgl(2029, 4));
  assert.equal(h.kgb[1].mkgTahun, 6);
});

test("KGB yang jatuh sebelum TMT KP masih di golongan lama", () => {
  const h = hasil({
    golonganLama: "III/b", mkgTahun: 2, mkgBulan: 0, golonganBaru: "III/c",
    tmtKgbTerakhir: tgl(2024, 4), tmtKp: tgl(2026, 10),
  });
  assert.equal(h.kgb[0].sebelumKp, true);
  assert.equal(h.kgb[0].golongan, "III/b");
  assert.deepEqual(h.kgb[0].tmt, tgl(2026, 4));
  // KP diterapkan pada MKG sesudah KGB April 2026.
  assert.equal(h.mkgTahunLama, 4);
  assert.equal(h.mkgTahunBaru, 4);
  assert.equal(h.gajiLama, h.kgb[0].gajiPokok);
  assert.equal(h.kgb[1].golongan, "III/c");
  assert.deepEqual(h.kgb[1].tmt, tgl(2028, 4));
});

test("KGB pada tanggal yang sama dengan TMT KP dihitung di golongan baru", () => {
  const h = hasil({
    golonganLama: "III/b", mkgTahun: 2, mkgBulan: 0, golonganBaru: "III/c",
    tmtKgbTerakhir: tgl(2024, 4), tmtKp: tgl(2026, 4),
  });
  assert.equal(h.kgb[0].sebelumKp, false);
  assert.equal(h.kgb[0].golongan, "III/c");
});

test("masukan yang tidak sah ditolak", () => {
  assert.equal(simulasiKenaikanPangkat({ golonganLama: "III/c", mkgTahun: 2, mkgBulan: 0, golonganBaru: "III/b" }).ok, false);
  assert.equal(simulasiKenaikanPangkat({ golonganLama: "X", mkgTahun: 2, mkgBulan: 0, golonganBaru: "III/b" }).ok, false);
  assert.equal(simulasiKenaikanPangkat({ golonganLama: "III/b", mkgTahun: 2, mkgBulan: 12, golonganBaru: "III/c" }).ok, false);
});

test("golongan berikutnya dan peringatan tabel yang belum dimulai", () => {
  assert.equal(golonganBerikutnya("III/b"), "III/c");
  assert.equal(golonganBerikutnya("II/d"), "III/a");
  assert.equal(golonganBerikutnya("IV/e"), null);
  const h = hasil({ golonganLama: "II/a", mkgTahun: 0, mkgBulan: 0, golonganBaru: "II/b" });
  assert.equal(h.gajiBaru, 0);
  assert.ok(h.peringatan.some((p) => p.includes("MKG 3")));
});
