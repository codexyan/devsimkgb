// Nilai dasar gaji menurut SK pada usulan UPT: yang ditampilkan ke peninjau sama dengan yang diterapkan.
//
// Jalankan: node --import tsx --test lib/dasarSkUsulan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { hitungDasarSkUsulan, hitungSkPegawaiBaru, usulanBaruMenurutSk, usulanMenurutSk } from "./dasarSkUsulan";
import { getGajiPokok } from "./tabelGaji";
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

// Pegawai baru yang menyalin golongan dan masa kerja dari SK sesudah SK KGB terakhir (ADR-065). Contoh yang sama
// dengan pilihan di tinjauan logika: KGB terakhir 1 Des 2024 di II/d 11 tahun, PI 1 Jan 2026 ke III/a, di SK 7 tahun 1 bulan.
const baruPi = {
  golonganRuang: "III/a", mkgTahun: 7, mkgBulan: 1, tmtKgbTerakhir: tgl(2024, 12),
  dasarBaruJenis: "kp", dasarBaruTmt: tgl(2026, 1),
} as unknown as UsulanPegawaiRow;

test("pegawai baru, penyesuaian ijazah: masa kerja pada SK dihitung mundur ke TMT KGB terakhir, jadwal KGB tetap", () => {
  const sk = hitungSkPegawaiBaru(baruPi);
  assert.ok(sk.berlaku && sk.ok);
  assert.deepEqual(sk.mkgPadaSk, { tahun: 7, bulan: 1 });
  assert.equal(sk.nilai.mkgTahun, 6);
  assert.equal(sk.nilai.mkgBulan, 0);
  assert.equal(sk.nilai.gajiPokok, getGajiPokok("III/a", 6, 0));
  assert.deepEqual(sk.nilai.tmtKgbBerikutnya, tgl(2026, 12));
  // Usulan sebagaimana diterapkan: masa kerja yang tersimpan di data pegawai adalah yang pada TMT KGB terakhir.
  assert.equal(usulanBaruMenurutSk(baruPi).mkgTahun, 6);
});

test("pegawai baru, PMK: gaji pokok menurut masa kerja pada SK, jadwal KGB dihitung dari TMT PMK", () => {
  // KGB terakhir 1 Jun 2025 di III/a 2 tahun; PMK 1 Mar 2026 menjadi 5 tahun 9 bulan.
  const sk = hitungSkPegawaiBaru({
    golonganRuang: "III/a", mkgTahun: 5, mkgBulan: 9, tmtKgbTerakhir: tgl(2025, 6), dasarBaruJenis: "pmk", dasarBaruTmt: tgl(2026, 3),
  });
  assert.ok(sk.berlaku && sk.ok);
  assert.equal(sk.nilai.mkgTahun, 5);
  assert.equal(sk.nilai.mkgBulan, 0);
  assert.equal(sk.nilai.gajiPokok, getGajiPokok("III/a", 5, 9));
  // Langkah tabel berikutnya pada 6 tahun: 3 bulan sesudah TMT PMK.
  assert.deepEqual(sk.nilai.tmtKgbBerikutnya, tgl(2026, 6));
});

test("pegawai baru: tanpa SK, atau SK yang mendahului KGB terakhir, atau masa kerja yang terlalu kecil", () => {
  assert.equal(hitungSkPegawaiBaru({ ...baruPi, dasarBaruJenis: "tidak" }).berlaku, false);
  assert.equal(hitungSkPegawaiBaru({ ...baruPi, dasarBaruJenis: "koreksi" }).berlaku, false);
  const dulu = hitungSkPegawaiBaru({ ...baruPi, dasarBaruTmt: tgl(2024, 6) });
  assert.ok(dulu.berlaku && !dulu.ok);
  assert.match(dulu.pesan, /sesudah TMT KGB terakhir/);
  const kecil = hitungSkPegawaiBaru({ ...baruPi, mkgTahun: 0, mkgBulan: 6 });
  assert.ok(kecil.berlaku && !kecil.ok);
  assert.match(kecil.pesan, /paling sedikit 1 tahun 1 bulan/);
});
