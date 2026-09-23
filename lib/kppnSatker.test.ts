// KPPN mitra satker yang dapat disesuaikan dari Pengaturan.
//
// Jalankan: node --import tsx --test lib/kppnSatker.test.ts

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { aturKppnSatker, kppnBawaan, kppnBerlaku, normalisasiKppnSatker, pilihanKppn } from "./kppnSatker";
import { SATKER, cariSatker, satkerPerKppn } from "./satker";

/** Kembalikan seluruh satker ke KPPN bawaannya, agar satu uji tidak mempengaruhi uji berikutnya. */
function kembalikan() {
  aturKppnSatker(null);
}

test("tanpa penyesuaian, seluruh satker memakai KPPN bawaannya", () => {
  kembalikan();
  assert.equal(cariSatker("rutan-rantau")?.kppn, "Barabai");
  assert.equal(cariSatker("lapas-kotabaru")?.kppn, "Kotabaru");
  assert.deepEqual(aturKppnSatker(""), {});
  assert.deepEqual(aturKppnSatker("{}"), {});
});

test("penyesuaian dari Pengaturan berlaku pada seluruh pembaca daftar satker", () => {
  kembalikan();
  aturKppnSatker({ "rutan-rantau": "Banjarmasin" });
  assert.equal(cariSatker("rutan-rantau")?.kppn, "Banjarmasin");
  assert.equal(cariSatker("Rumah Tahanan Negara Kelas IIB Rantau")?.kppn, "Banjarmasin");
  // Satker lain tidak ikut berubah.
  assert.equal(cariSatker("rutan-barabai")?.kppn, "Barabai");
  kembalikan();
  assert.equal(cariSatker("rutan-rantau")?.kppn, "Barabai");
});

test("memuat ulang dengan nilai baru tidak menyisakan penyesuaian lama", () => {
  kembalikan();
  aturKppnSatker({ "rutan-rantau": "Banjarmasin", "lapas-tanjung": "Barabai" });
  aturKppnSatker({ "lapas-tanjung": "Barabai" });
  assert.equal(cariSatker("rutan-rantau")?.kppn, "Barabai", "penyesuaian yang dicabut kembali ke bawaan");
  assert.equal(cariSatker("lapas-tanjung")?.kppn, "Barabai");
  kembalikan();
});

test("isian yang tidak masuk akal diabaikan, bukan menggagalkan seluruh pengaturan", () => {
  kembalikan();
  assert.deepEqual(normalisasiKppnSatker({ "satker-entah": "Banjarmasin" }), {}, "kode satker tak dikenal");
  assert.deepEqual(normalisasiKppnSatker({ "rutan-rantau": "   " }), {}, "nama kosong");
  assert.deepEqual(normalisasiKppnSatker({ "rutan-rantau": 7 }), {}, "bukan teks");
  assert.deepEqual(normalisasiKppnSatker({ "rutan-rantau": "Barabai" }), {}, "sama dengan bawaan");
  assert.deepEqual(normalisasiKppnSatker("bukan json"), {});
  assert.deepEqual(normalisasiKppnSatker(["Banjarmasin"]), {});
  assert.deepEqual(normalisasiKppnSatker(null), {});
  // Spasi berlebih dirapikan, dan nama yang kepanjangan dipotong.
  assert.deepEqual(normalisasiKppnSatker({ "rutan-rantau": "  Kotabaru   Baru " }), { "rutan-rantau": "Kotabaru Baru" });
  assert.equal(normalisasiKppnSatker({ "rutan-rantau": "K".repeat(90) })["rutan-rantau"].length, 60);
});

test("nilai tersimpan boleh berupa teks JSON, seperti yang dibaca dari basis data", () => {
  kembalikan();
  aturKppnSatker('{"rutan-rantau":"Pelaihari"}');
  assert.equal(cariSatker("rutan-rantau")?.kppn, "Pelaihari");
  kembalikan();
});

test("KPPN baru dari Pengaturan ikut muncul pada pengelompokan dan pilihan", () => {
  kembalikan();
  aturKppnSatker({ "rutan-rantau": "Amuntai" });
  const kelompok = satkerPerKppn();
  const amuntai = kelompok.find((k) => k.kppn === "Amuntai");
  assert.ok(amuntai, "KPPN baru muncul sebagai kelompok tersendiri");
  assert.deepEqual(amuntai?.satker.map((s) => s.kode), ["rutan-rantau"]);
  // KPPN yang dikenal tetap di depan, KPPN baru menyusul.
  assert.equal(kelompok[0].kppn, "Banjarmasin");
  assert.ok(pilihanKppn().includes("Amuntai"));
  // Seluruh satker tetap terwakili tepat satu kali.
  assert.equal(kelompok.reduce((n, k) => n + k.satker.length, 0), SATKER.length);
  kembalikan();
});

test("kppnBerlaku menyebut nilai yang dipakai beserta bawaannya", () => {
  kembalikan();
  aturKppnSatker({ "rutan-rantau": "Banjarmasin" });
  const rantau = kppnBerlaku().find((s) => s.kode === "rutan-rantau");
  assert.deepEqual(
    { kppn: rantau?.kppn, bawaan: rantau?.bawaan },
    { kppn: "Banjarmasin", bawaan: "Barabai" },
  );
  assert.equal(kppnBawaan("rutan-rantau"), "Barabai");
  assert.equal(kppnBawaan("tidak-ada"), "");
  kembalikan();
});

function semuaBerkas(folder: string): string[] {
  return readdirSync(folder).flatMap((nama) => {
    const p = path.join(folder, nama);
    if (statSync(p).isDirectory()) return semuaBerkas(p);
    return /\.(ts|tsx)$/.test(nama) && !/\.test\.ts$/.test(nama) ? [p] : [];
  });
}

test("berkas server yang memakai KPPN memanggil muatKppnSatker()", () => {
  const terlewat: string[] = [];
  for (const berkas of semuaBerkas(path.join(process.cwd(), "app"))) {
    const isi = readFileSync(berkas, "utf8");
    // Halaman peramban memakai data yang dikirim server, jadi tidak membaca Pengaturan sendiri.
    if (/^\s*["']use client["']/.test(isi)) continue;
    if (path.relative(process.cwd(), berkas).split(path.sep)[1] === "dashboard") continue;
    const memakaiKppn = /\.kppn\b/.test(isi) || /\b(satkerPerKppn|kppnBerlaku|pilihanKppn)\s*\(/.test(isi);
    if (memakaiKppn && !isi.includes("muatKppnSatker(")) terlewat.push(path.relative(process.cwd(), berkas));
  }
  assert.deepEqual(terlewat, [], `Tambahkan await muatKppnSatker() di: ${terlewat.join(", ")}`);
});
