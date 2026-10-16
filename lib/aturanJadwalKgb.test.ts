// Aturan jadwal KGB dan keadaan "pernah KGB" (ADR-080).
//
// Jalankan: node --import tsx --test lib/aturanJadwalKgb.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { hitungMKGKenaikanPangkat, mkgAwalGolongan } from "./tabelGaji";
import { hitungSkDilaporkan } from "./dasarSkUsulan";
import { kekuranganUsulan, pernahKgb, pernahKgbUsulan } from "./usulanPegawai";

const tgl = (y: number, m: number) => new Date(y, m - 1, 1);

test("potongan masa kerja yang melebihi masa kerjanya menjadi 0 tahun 0 bulan", () => {
  assert.deepEqual(hitungMKGKenaikanPangkat("II/a", "III/a", 3, 10), { mkgTahun: 0, mkgBulan: 0 });
  assert.deepEqual(hitungMKGKenaikanPangkat("II/b", "III/a", 7, 0), { mkgTahun: 2, mkgBulan: 0 });
  assert.deepEqual(hitungMKGKenaikanPangkat("II/b", "III/a", 5, 4), { mkgTahun: 0, mkgBulan: 4 });
  assert.equal(hitungMKGKenaikanPangkat("III/a", "III/b", 4, 0), null, "kenaikan pangkat dalam golongan tidak memotong");
});

test("PI dengan masa kerja kurang dari 5 tahun: jadwal KGB lama dipertahankan", () => {
  // CPNS II/a 1 Mar 2021, KGB 1 Mar 2022 dan 1 Mar 2024 (MKG 3), PI ke III/a TMT 1 Jan 2025.
  const h = hitungSkDilaporkan(
    { golonganRuang: "II/a", mkgTahun: 3, mkgBulan: 0, tmtKgbTerakhir: tgl(2024, 3), tmtKgbBerikutnya: tgl(2026, 3) },
    { jenis: "kp", golonganBaru: "III/a", mkgTahunSk: 0, mkgBulanSk: 0, tmt: tgl(2025, 1) },
  );
  assert.ok(h.ok);
  if (!h.ok) return;
  assert.deepEqual([h.mkgTahun, h.mkgBulan], [0, 0]);
  assert.deepEqual(h.mkgPadaTmtSk, { tahun: 0, bulan: 0 }, "bukan 0 tahun 10 bulan");
  assert.deepEqual(h.tmtKgbBerikutnya, tgl(2026, 3));
});

test("langkah awal tabel: CPNS II/c bermasa kerja 3 tahun belum pernah KGB", () => {
  assert.deepEqual(mkgAwalGolongan("II/c"), { tahun: 3, bulan: 0 });
  assert.deepEqual(mkgAwalGolongan("II/a"), { tahun: 0, bulan: 0 });
  assert.deepEqual(mkgAwalGolongan("III/a"), { tahun: 0, bulan: 0 });
  assert.equal(pernahKgb(3, 0, "II/c"), false);
  assert.equal(pernahKgb(5, 0, "II/c"), true);
  assert.equal(pernahKgb(0, 0, "II/a"), false);
  assert.equal(pernahKgb(1, 0, "II/a"), true);
  assert.equal(pernahKgb(3, 0), true, "tanpa golongan, tebakan lama: masa kerja lebih dari 0");
});

test("pilihan UPT sudah atau belum pernah KGB mengalahkan tebakan dari masa kerja", () => {
  // Pegawai yang masa kerjanya terpotong habis oleh PI: masa kerja 0, tetapi sudah dua kali KGB.
  assert.equal(pernahKgbUsulan({ golonganRuang: "III/a", mkgTahun: 0, mkgBulan: 0 }), false);
  assert.equal(pernahKgbUsulan({ golonganRuang: "III/a", mkgTahun: 0, mkgBulan: 0, keadaanKgb: "pernah" }), true);
  // CPNS yang masa kerja sebelumnya diperhitungkan.
  assert.equal(pernahKgbUsulan({ golonganRuang: "III/a", mkgTahun: 2, mkgBulan: 4, keadaanKgb: "belum" }), false);
  // Usulan ber-acuan: tebakan dari keadaan pada SK KGB terakhir.
  assert.equal(pernahKgbUsulan({ golonganRuang: "III/a", mkgTahun: 3, mkgBulan: 2, golonganAcuan: "II/c", mkgTahunAcuan: 3, mkgBulanAcuan: 0 }), false);
});

test("berkas yang ditagih mengikuti pilihan UPT: CPNS II/c menagih SK CPNS, bukan SK KGB terakhir", () => {
  const usulan = {
    golonganRuang: "II/c", mkgTahun: 3, mkgBulan: 0, tmtKgbTerakhir: tgl(2025, 3), dasarBaruJenis: "tidak",
    nama: "CPNS UJI", nip: "200001012025031001", jabatan: "Penjaga Tahanan",
  };
  const belum = kekuranganUsulan({ ...usulan, keadaanKgb: "belum" }, "baru", null);
  assert.ok(belum.some((k) => /SK CPNS/.test(k)), belum.join("; "));
  assert.ok(!belum.some((k) => /SK KGB terakhir/.test(k)), belum.join("; "));
  const pernah = kekuranganUsulan({ ...usulan, keadaanKgb: "pernah" }, "baru", null);
  assert.ok(pernah.some((k) => /SK KGB terakhir/.test(k)), pernah.join("; "));
});
