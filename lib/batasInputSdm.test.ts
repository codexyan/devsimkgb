// Jalankan: node --import tsx --test lib/batasInputSdm.test.ts

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  aturBatasInputSdm,
  aturBatasKirimSurat,
  BATAS_INPUT_SDM_BAWAAN,
  BATAS_KIRIM_SURAT_BAWAAN,
  batasInputSdm,
  batasKirimSurat,
  normalisasiBatasInputSdm,
  normalisasiBatasKirimSurat,
  tanggalBatasKirim,
} from "./batasInputSdm";
import { hitungDeadlineSDM, hitungRekonGaji, jendelaProsesKgb } from "./tabelGaji";

const tanggal = (y: number, m: number, d = 1) => new Date(y, m - 1, d);

test("nilai Pengaturan yang kosong atau di luar 1 sampai 31 memakai bawaan 20", () => {
  assert.equal(BATAS_INPUT_SDM_BAWAAN, 20);
  for (const kosong of [null, undefined, "", 0, 32, -1, "abc", Number.NaN]) {
    assert.equal(normalisasiBatasInputSdm(kosong), 20, String(kosong));
  }
  assert.equal(normalisasiBatasInputSdm(25), 25);
  assert.equal(normalisasiBatasInputSdm("18"), 18);
  assert.equal(normalisasiBatasInputSdm(31), 31);
});

test("batas input pada tanggal batas bulan kedua sebelum TMT, dijepit ke akhir bulan", () => {
  // TMT 1 November 2026: batas 20 September 2026 (bawaan).
  assert.deepEqual(hitungDeadlineSDM(tanggal(2026, 11), 20), tanggal(2026, 9, 20));
  // TMT 1 April 2027: bulan kedua sebelumnya Februari (28 hari), jadi 30 dan 31 dijepit ke 28.
  assert.deepEqual(hitungDeadlineSDM(tanggal(2027, 4), 30), tanggal(2027, 2, 28));
  assert.deepEqual(hitungDeadlineSDM(tanggal(2028, 4), 31), tanggal(2028, 2, 29));
  // Pergantian tahun: TMT 1 Februari 2027 → batas 20 Desember 2026.
  assert.deepEqual(hitungDeadlineSDM(tanggal(2027, 2), 20), tanggal(2026, 12, 20));
});

test("batas kirim surat UPT: bawaan 20, dari Pengaturan, tidak melewati batas input, dijepit ke akhir bulan (ADR-094)", () => {
  assert.equal(BATAS_KIRIM_SURAT_BAWAAN, 20);
  for (const kosong of [null, undefined, "", 0, 32, "abc"]) assert.equal(normalisasiBatasKirimSurat(kosong), 20, String(kosong));
  assert.equal(normalisasiBatasKirimSurat("15"), 15);
  const semula = { input: batasInputSdm(), kirim: batasKirimSurat() };
  try {
    aturBatasInputSdm(31);
    aturBatasKirimSurat(20);
    assert.equal(batasKirimSurat(), 20);
    assert.deepEqual(tanggalBatasKirim(2026, 9), tanggal(2026, 10, 20));
    aturBatasInputSdm(18);
    assert.equal(batasKirimSurat(), 18, "tidak melewati batas input");
    aturBatasInputSdm(31);
    aturBatasKirimSurat(30);
    assert.deepEqual(tanggalBatasKirim(2027, 1), tanggal(2027, 2, 28), "Februari dijepit ke tanggal 28");
  } finally {
    aturBatasInputSdm(semula.input);
    aturBatasKirimSurat(semula.kirim);
  }
});

test("batas input akhir bulan (31): input sampai hari terakhir bulan, rapelan baru sesudahnya (ADR-094)", () => {
  const semula = batasInputSdm();
  try {
    aturBatasInputSdm(31);
    // TMT 1 Desember 2026: input sampai 31 Oktober; 1 November sudah berpotensi rapelan.
    assert.equal(jendelaProsesKgb(tanggal(2026, 12), tanggal(2026, 10, 31))?.flagRapelan, false);
    assert.equal(jendelaProsesKgb(tanggal(2026, 12), tanggal(2026, 11, 1))?.flagRapelan, true);
    // TMT 1 Januari 2027: November 30 hari, jadi batasnya 30 November.
    assert.deepEqual(jendelaProsesKgb(tanggal(2027, 1), tanggal(2026, 11, 30))?.deadlineSDM, tanggal(2026, 11, 30));
  } finally {
    aturBatasInputSdm(semula);
  }
});

test("rekon gaji keuangan tanggal 1 sampai 15 bulan sebelum TMT", () => {
  assert.deepEqual(hitungRekonGaji(tanggal(2026, 11)), { mulai: tanggal(2026, 10, 1), batas: tanggal(2026, 10, 15) });
  assert.deepEqual(hitungRekonGaji(tanggal(2027, 1)), { mulai: tanggal(2026, 12, 1), batas: tanggal(2026, 12, 15) });
});

test("nilai yang ditetapkan dipakai jendela proses tanpa perlu dikirim ke setiap fungsi", () => {
  const semula = batasInputSdm();
  try {
    aturBatasInputSdm(25);
    const jendela = jendelaProsesKgb(tanggal(2026, 11), tanggal(2026, 9, 24));
    assert.deepEqual(jendela?.deadlineSDM, tanggal(2026, 9, 25));
    assert.equal(jendela?.flagRapelan, false);
    aturBatasInputSdm(20);
    assert.equal(jendelaProsesKgb(tanggal(2026, 11), tanggal(2026, 9, 24))?.flagRapelan, true, "lewat tanggal 20");
    assert.equal(jendelaProsesKgb(tanggal(2026, 11), tanggal(2026, 9, 20))?.flagRapelan, false, "tanggal 20 masih dalam batas");
  } finally {
    aturBatasInputSdm(semula);
  }
});

/* Pengaman: setiap berkas server di app/ yang memakai perhitungan jendela proses KGB harus memuat batas
   dari Pengaturan lebih dulu. Tanpanya berkas itu diam-diam memakai bawaan walau Super Admin mengubahnya.
   Kode peramban ("use client", serta seluruh app/dashboard yang dirender di dalam DashboardShell) memakai
   nilai yang ditetapkan DashboardShell. */
const BERGANTUNG: Record<string, string[]> = {
  "@/lib/tabelGaji": ["jendelaProsesKgb", "kalkulasiKGB", "hitungDeadlineSDM"],
  "@/lib/jadwalKgb": ["rencanaSiklusBerikutnya", "rencanaSetelahKgbSelesai", "rencanaPenundaanHukdis"],
  "@/lib/rekapKgb": ["statusRapelan", "rapelanSiklus", "hitungRekapStatus", "rekapPerBulanTmt", "pilihKgbSiklus"],
  "@/lib/generateNotifikasi": ["rencanaNotifikasi", "generateNotifikasi"],
  "@/lib/jadwalPengusulan": ["jadwalPengusulan"],
  "@/lib/rekapSatker": ["rekapPerSatker"],
};

function semuaBerkas(folder: string): string[] {
  return readdirSync(folder).flatMap((nama) => {
    const p = path.join(folder, nama);
    if (statSync(p).isDirectory()) return semuaBerkas(p);
    return /\.(ts|tsx)$/.test(nama) && !/\.test\.ts$/.test(nama) ? [p] : [];
  });
}

test("berkas server yang menghitung jendela proses KGB memanggil muatBatasInputSdm()", () => {
  const terlewat: string[] = [];
  for (const berkas of semuaBerkas(path.join(process.cwd(), "app"))) {
    const isi = readFileSync(berkas, "utf8");
    if (/^\s*["']use client["']/.test(isi)) continue;
    if (path.relative(process.cwd(), berkas).split(path.sep)[1] === "dashboard") continue;
    const pakai = Object.entries(BERGANTUNG).some(([modul, nama]) =>
      [...isi.matchAll(new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${modul.replace(/\//g, "\\/")}["']`, "g"))].some(
        (m) => nama.some((n) => new RegExp(`\\b${n}\\b`).test(m[1])),
      ),
    );
    if (pakai && !isi.includes("muatBatasInputSdm(")) terlewat.push(path.relative(process.cwd(), berkas));
  }
  assert.deepEqual(terlewat, [], `Tambahkan await muatBatasInputSdm() di: ${terlewat.join(", ")}`);
});
