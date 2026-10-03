// Nilai dasar gaji menurut SK pada usulan UPT: yang ditampilkan ke peninjau sama dengan yang diterapkan.
//
// Jalankan: node --import tsx --test lib/dasarSkUsulan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { hitungDasarSkUsulan, usulanMenurutSk } from "./dasarSkUsulan";
import { bandingkanUsulan, perubahanPegawai } from "./usulanPegawai";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

// Arif Setiawan di data video: II/d, 9 tahun, KGB terakhir 1 Agustus 2025, berikutnya 1 Agustus 2027.
const arif = {
  golonganRuang: "II/d", pangkat: "Pengatur Tingkat I", mkgTahun: 9, mkgBulan: 0, gajiPokok: 2843700,
  tmtKgbTerakhir: tgl(2025, 8), tmtKgbBerikutnya: tgl(2027, 8),
} as PegawaiRow;

// Usulan kenaikan pangkat ke III/a dengan angka mentah seperti yang tersimpan dari kartu UPT: gaji pokok
// tanpa potongan masa kerja, dan jadwal KGB yang bergeser.
const usulanKp = {
  golonganRuang: "III/a", pangkat: "Penata Muda", gajiPokok: 3153600, tmtKgbBerikutnya: tgl(2026, 8),
  dasarBaruJenis: "kp", dasarBaruTanggalSk: tgl(2026, 9, 25), dasarBaruTmt: tgl(2026, 10),
} as unknown as UsulanPegawaiRow;

test("kenaikan pangkat: peninjau melihat potongan masa kerja dan jadwal KGB yang tetap", () => {
  const perubahan = bandingkanUsulan(arif, usulanMenurutSk(arif, usulanKp, perubahanPegawai(usulanKp)));
  const peta = Object.fromEntries(perubahan.map((p) => [p.kunci, `${p.sekarang} → ${p.diusulkan}`]));
  assert.equal(peta.golonganRuang, "II/d → III/a");
  assert.equal(peta.mkgTahun, "9 → 4");
  assert.equal(peta.gajiPokok, "Rp2.843.700 → Rp2.964.000");
  assert.equal(peta.tmtKgbBerikutnya, undefined, "kenaikan pangkat tidak menggeser jadwal KGB");
});

test("angka mentah usulan tidak lagi tampil, tetapi tetap tampil tanpa SK", () => {
  const mentah = bandingkanUsulan(arif, usulanKp);
  assert.ok(mentah.some((p) => p.diusulkan === "Rp3.153.600"));
  const tanpaSk = { ...usulanKp, dasarBaruJenis: "koreksi" } as UsulanPegawaiRow;
  assert.equal(usulanMenurutSk(arif, tanpaSk, perubahanPegawai(tanpaSk)), tanpaSk);
});

test("SK yang tidak dapat dihitung dilaporkan, dan usulannya tampil apa adanya", () => {
  const turun = { ...usulanKp, golonganRuang: "II/a" } as UsulanPegawaiRow;
  const h = hitungDasarSkUsulan(arif, turun, perubahanPegawai(turun));
  assert.equal(h.berlaku && !h.ok, true);
  assert.equal(usulanMenurutSk(arif, turun, perubahanPegawai(turun)), turun);
});
