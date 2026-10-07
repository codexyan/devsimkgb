// SK KGB yang sama dengan usulan UPT tidak direview ulang, dan tahap KGB pada kartu papan UPT (ADR-082).
//
// Jalankan: node --import tsx --test lib/sesuaiUsulan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { bedaSkDenganUsulan, type HarapanSk } from "./sesuaiUsulan";
import { skBolehDicetak, LABEL_REVIEW_SK } from "./reviewSkUpt";
import { TAHAP_KGB_UPT, indeksTahap, tahapProsesKgb } from "./papanUpt";

const harapan: HarapanSk = {
  golonganLama: "III/a", mkgTahunLama: 2, mkgBulanLama: 0, gajiPokokLama: 2875100,
  golonganBaru: "III/a", mkgTahunBaru: 4, mkgBulanBaru: 0, gajiPokokBaru: 2965500,
  tmtKgbBaru: new Date(2026, 11, 1), nomorSkDasar: "SEK-2156.SA.04.05 TAHUN 2026",
};
const kgb = {
  golonganLama: "III/a", mkgTahunLama: 2, mkgBulanLama: 0, gajiPokokLama: 2875100,
  golonganBaru: "III/a", mkgTahunBaru: 4, mkgBulanBaru: 0, gajiPokokBaru: 2965500,
  tmtKgbBaru: new Date(2026, 11, 1), nomorSK: "SEK-2156.SA.04.05  TAHUN 2026",
};

test("SK yang sama dengan usulan tidak punya perbedaan; nomor Atas dasar dibandingkan tanpa beda spasi", () => {
  assert.deepEqual(bedaSkDenganUsulan(kgb, harapan), []);
});

test("perbedaan gaji, masa kerja, TMT, atau Atas dasar disebut satu per satu", () => {
  const beda = bedaSkDenganUsulan(
    { ...kgb, gajiPokokBaru: 3057300, mkgTahunBaru: 5, tmtKgbBaru: new Date(2027, 0, 1), nomorSK: "W19-KGB-1" },
    harapan,
  );
  assert.deepEqual(beda.map((b) => b.label), ["Masa kerja baru", "Gaji pokok baru", "TMT KGB", "Atas dasar SK"]);
  assert.equal(beda[1].usulan, `Rp${(2965500).toLocaleString("id-ID")}`);
});

test("Atas dasar yang tidak dapat disusun dari usulan dianggap berbeda, supaya SK tetap direview", () => {
  const beda = bedaSkDenganUsulan(kgb, { ...harapan, nomorSkDasar: null });
  assert.deepEqual(beda.map((b) => b.label), ["Atas dasar SK"]);
});

test("SK sesuai usulan boleh dicetak dan diunggah TTE seperti yang disetujui UPT", () => {
  assert.equal(skBolehDicetak({ status: "sesuai" }), true);
  assert.equal(skBolehDicetak({ status: "menunggu" }), false);
  assert.equal(LABEL_REVIEW_SK.sesuai.nada, "hijau");
});

test("tahap KGB pada kartu: kembali ke Di Kanwil sesudah Periksa SK terbaca maju ke TTE", () => {
  assert.equal(TAHAP_KGB_UPT.length, 6);
  assert.equal(indeksTahap("usulan_disiapkan"), 0);
  assert.equal(indeksTahap("usulan_ditinjau"), 1);
  assert.equal(indeksTahap("menunggu_proses"), 2);
  assert.equal(indeksTahap(tahapProsesKgb(null)), 2, "SK sedang dibuat");
  assert.equal(indeksTahap(tahapProsesKgb("menunggu")), 3, "Periksa SK");
  assert.equal(indeksTahap(tahapProsesKgb("perbaikan")), 2, "SK diperbaiki Kanwil");
  for (const status of ["disetujui", "sesuai", "dilewati"]) assert.equal(indeksTahap(tahapProsesKgb(status)), 4, status);
  assert.equal(indeksTahap("sk_terbit"), 5);
  assert.equal(indeksTahap("selesai"), 6);
});
