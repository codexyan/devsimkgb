// Hitungan Koreksi dasar gaji (ADR-040).
//
// Jalankan: node --import tsx --test lib/koreksiDasarGaji.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { getMKGOptions } from "./tabelGaji";
import {
  gajiPokokUntuk,
  mkgSetelahGantiGolongan,
  mkgTerdekat,
  tmtKgbBerikutnyaHitung,
} from "./koreksiDasarGaji";

test("mengganti golongan mempertahankan masa kerja bila langkahnya ada di golongan baru", () => {
  // Inilah kelakuan yang dulu salah: masa kerja dipaksa kembali ke 0 thn 0 bln, sehingga membetulkan
  // salah ketik golongan ikut menjatuhkan gaji pokok ke angka terendah golongan itu.
  const hasil = mkgSetelahGantiGolongan("III/d", 10, 0);
  assert.deepEqual(hasil, { tahun: 10, bulan: 0, disesuaikan: false });
});

test("masa kerja yang tidak ada di golongan baru digeser ke terdekat dan ditandai", () => {
  const pilihanIa = getMKGOptions("I/a");
  const tertinggi = pilihanIa[pilihanIa.length - 1];
  // Masa kerja jauh di atas langkah tertinggi golongan I/a tidak mungkin dipertahankan apa adanya.
  const hasil = mkgSetelahGantiGolongan("I/a", tertinggi.tahun + 10, 0);
  assert.ok(hasil);
  assert.equal(hasil.disesuaikan, true, "penyesuaian harus ditandai, bukan dilakukan diam-diam");
  assert.deepEqual({ tahun: hasil.tahun, bulan: hasil.bulan }, { tahun: tertinggi.tahun, bulan: tertinggi.bulan });
});

test("golongan yang tidak dikenal tabel gaji menghasilkan null, bukan angka karangan", () => {
  assert.equal(mkgSetelahGantiGolongan("V/z", 10, 0), null);
  assert.equal(mkgTerdekat("V/z", 10, 0), null);
  assert.equal(gajiPokokUntuk("V/z", 10, 0), null);
});

test("gaji pokok dibaca dari tabel PP 5/2024, dan langkah yang tidak ada menghasilkan null", () => {
  const contoh = getMKGOptions("III/b")[3];
  assert.equal(gajiPokokUntuk("III/b", contoh.tahun, contoh.bulan), contoh.gaji);
  // Masa kerja dengan sisa bulan ganjil tidak ada di tabel; jangan ditebak.
  assert.equal(gajiPokokUntuk("III/b", contoh.tahun, 7), null);
});

test("TMT KGB berikutnya dihitung dari TMT terakhir memakai langkah tabel gaji", () => {
  // Langkah lazimnya dua tahun.
  const hasil = tmtKgbBerikutnyaHitung("III/c", 10, 0, "2025-02-01");
  assert.ok(hasil);
  assert.equal(hasil.getFullYear(), 2027);
  assert.equal(hasil.getMonth(), 1); // Februari
  assert.equal(hasil.getDate(), 1);
});

test("KGB pertama golongan II/a dari masa kerja 0 tidak dianggap dua tahun", () => {
  // Selangnya tidak selalu 24 bulan; mengetiknya dari ingatan itulah yang membuat KGB pertama meleset.
  const langkah = getMKGOptions("II/a");
  const pertama = langkah[0];
  const kedua = langkah[1];
  const bulanSelang = (kedua.tahun - pertama.tahun) * 12 + (kedua.bulan - pertama.bulan);
  const hasil = tmtKgbBerikutnyaHitung("II/a", pertama.tahun, pertama.bulan, "2025-06-01");
  assert.ok(hasil);
  const selangNyata = (hasil.getFullYear() - 2025) * 12 + (hasil.getMonth() - 5);
  assert.equal(selangNyata, bulanSelang);
});

test("tanpa TMT KGB terakhir tidak ada jadwal yang dapat dihitung", () => {
  assert.equal(tmtKgbBerikutnyaHitung("III/c", 10, 0, null), null);
  assert.equal(tmtKgbBerikutnyaHitung("III/c", 10, 0, ""), null);
});
