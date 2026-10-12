// Hitungan Koreksi dasar gaji (ADR-040).
//
// Jalankan: node --import tsx --test lib/koreksiDasarGaji.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { getMKGOptions } from "./tabelGaji";
import {
  gajiPokokUntuk,
  gajiTercatatMenyimpang,
  kalimatGajiMenyimpang,
  pesanGajiTurun,
  mkgSetelahGantiGolongan,
  mkgTerdekat,
  pilihanTahunMkg,
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

test("gaji pokok dibaca dari tabel PP 5/2024 pada langkahnya", () => {
  const contoh = getMKGOptions("III/b")[3];
  assert.equal(gajiPokokUntuk("III/b", contoh.tahun, contoh.bulan), contoh.gaji);
});

test("sisa bulan dan tahun di antara dua langkah tidak mengubah gaji pokok (ADR-106)", () => {
  const [, kedua, ketiga] = getMKGOptions("III/b");
  // SK dapat menulis 8 tahun 4 bulan: gajinya tetap langkah 8 tahun, bukan ditolak atau ditebak ke atas.
  assert.equal(gajiPokokUntuk("III/b", kedua.tahun, 4), kedua.gaji);
  assert.equal(gajiPokokUntuk("III/b", kedua.tahun, 11), kedua.gaji);
  assert.equal(gajiPokokUntuk("III/b", kedua.tahun + 1, 6), kedua.gaji);
  assert.equal(gajiPokokUntuk("III/b", ketiga.tahun, 0), ketiga.gaji);
});

test("masa kerja di luar rentang tabel golongan tidak bergaji", () => {
  // Tabel II/c dimulai dari 3 tahun; di bawahnya tidak ada gaji pokok.
  assert.equal(gajiPokokUntuk("II/c", 2, 11), null);
  assert.ok(gajiPokokUntuk("II/c", 3, 0));
  // Sampai satu siklus KGB sesudah langkah terakhir masih berlaku, sesudahnya tidak.
  const terakhir = getMKGOptions("IV/e").at(-1)!;
  assert.equal(gajiPokokUntuk("IV/e", terakhir.tahun + 1, 11), terakhir.gaji);
  assert.equal(gajiPokokUntuk("IV/e", terakhir.tahun + 2, 0), null);
  assert.equal(gajiPokokUntuk("IV/e", 10, 12), null);
});

test("pilihan tahun mencakup tahun di antara langkah, dari langkah pertama", () => {
  const tahun = pilihanTahunMkg("II/c");
  assert.equal(tahun[0], 3);
  assert.ok(tahun.includes(4), "tahun di antara dua langkah ikut dapat dipilih");
  assert.deepEqual(pilihanTahunMkg("V/z"), []);
});

test("mengganti golongan mempertahankan sisa bulan masa kerja", () => {
  assert.deepEqual(mkgSetelahGantiGolongan("III/c", 8, 4), { tahun: 8, bulan: 4, disesuaikan: false });
  // Di bawah langkah pertama golongan baru: digeser ke langkah itu dan ditandai.
  assert.deepEqual(mkgSetelahGantiGolongan("II/c", 1, 6), { tahun: 3, bulan: 0, disesuaikan: true });
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

/* ── Gaji pokok tercatat yang tidak sesuai golongan dan masa kerjanya (ADR-054) ── */

/** Kasus nyata 5 Oktober 2026: III/d masa kerja 14 tahun, gaji tercatat Rp 4.186.200 (tidak ada di tabel). */
const tercatatKeliru = { golonganRuang: "III/d", mkgTahun: 14, mkgBulan: 0, gajiPokok: 4186200 };

test("gaji tercatat yang tidak sesuai tabel untuk golongan dan masa kerjanya dikenali, beserta angka tabelnya", () => {
  assert.deepEqual(gajiTercatatMenyimpang(tercatatKeliru), {
    tercatat: 4186200,
    menurutTabel: 3919100,
    golongan: "III/d",
    mkgTahun: 14,
    mkgBulan: 0,
  });
  assert.match(kalimatGajiMenyimpang(gajiTercatatMenyimpang(tercatatKeliru)!), /Rp 4\.186\.200.*III\/d masa kerja 14 tahun 0 bulan.*Rp 3\.919\.100/);
  // Gaji yang sesuai tabel, atau yang belum terisi, tidak ditandai.
  assert.equal(gajiTercatatMenyimpang({ ...tercatatKeliru, gajiPokok: 3919100 }), null);
  assert.equal(gajiTercatatMenyimpang({ ...tercatatKeliru, gajiPokok: 0 }), null);
});

test("KGB yang menurunkan gaji ditolak dengan sebab dan jalan membetulkannya", () => {
  const pesan = pesanGajiTurun({ gajiPokokLama: 4186200, gajiPokokBaru: 4042500 }, tercatatKeliru);
  assert.ok(pesan);
  assert.match(pesan, /Rp 4\.042\.500 lebih kecil dari gaji pokok tercatat Rp 4\.186\.200/);
  assert.match(pesan, /Rp 3\.919\.100/);
  assert.match(pesan, /Koreksi data yang salah ketik/);
  // Gaji naik, atau tetap di atas langkah terakhir tabel, tidak ditolak.
  assert.equal(pesanGajiTurun({ gajiPokokLama: 3919100, gajiPokokBaru: 4042500 }, { ...tercatatKeliru, gajiPokok: 3919100 }), null);
  assert.equal(pesanGajiTurun({ gajiPokokLama: 5180700, gajiPokokBaru: 5180700 }, { ...tercatatKeliru, mkgTahun: 32, gajiPokok: 5180700 }), null);
});
