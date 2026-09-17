// Pemeriksaan isian jenis hukuman disiplin dari halaman Konfigurasi Hukdis.
//
// Jalankan: node --import tsx --test lib/hukdisJenis.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { galatIsianJenisHukdis, perubahanJenisHukdis, ringkasanPerubahanJenisHukdis, tmtBerakhirOtomatis } from "./hukdisJenis";

test("galatIsianJenisHukdis: isian lengkap yang valid dan perubahan sebagian", () => {
  assert.equal(
    galatIsianJenisHukdis({
      label: "Penundaan KGB",
      kategori: "sedang",
      durasiHukdis: 12,
      berdampakKGB: true,
      durasiTunda: 12,
      aktif: true,
    }),
    null,
  );
  assert.equal(galatIsianJenisHukdis({ kategori: "berat", berdampakKGB: false, durasiTunda: null }), null);
  assert.equal(galatIsianJenisHukdis({ aktif: false }), null);
  assert.equal(galatIsianJenisHukdis({}), null);
});

test("galatIsianJenisHukdis: nilai di luar batas halaman konfigurasi ditolak", () => {
  for (const isian of [
    { label: "  " },
    { kategori: "beratan" },
    { durasiHukdis: -1 },
    { durasiHukdis: 121 },
    { durasiHukdis: "12" },
    { berdampakKGB: "true" },
    { aktif: 1 },
    { durasiTunda: 0 },
    { durasiTunda: 61 },
    { durasiTunda: 100000 },
    { durasiTunda: 1.5 },
    { durasiTunda: "120" },
    { berdampakKGB: true, durasiTunda: null },
  ]) {
    assert.ok(galatIsianJenisHukdis(isian), JSON.stringify(isian));
  }
});

test("ringkasanPerubahanJenisHukdis: hanya field yang dikirim dan berubah", () => {
  const lama = { label: "Penundaan KGB", kategori: "sedang", berdampakKGB: true, durasiTunda: 12, aktif: true, dasarHukum: null };
  assert.deepEqual(
    ringkasanPerubahanJenisHukdis(lama, { label: "Penundaan KGB", berdampakKGB: false, durasiTunda: null, aktif: true }),
    ["berdampak KGB Ya menjadi Tidak", "lama penundaan KGB 12 bulan menjadi -"],
  );
  assert.deepEqual(ringkasanPerubahanJenisHukdis(lama, { dasarHukum: null, kategori: "sedang" }), []);
});

test("perubahanJenisHukdis: hanya field yang berubah diperiksa dan lama penundaan mengikuti keadaan akhir", () => {
  const lama = { label: "Penundaan KGB", kategori: "sedang", durasiHukdis: null, berdampakKGB: true, durasiTunda: 12, aktif: true };
  // Sel kosong yang tidak berubah tidak menghalangi perubahan lain.
  assert.deepEqual(
    perubahanJenisHukdis(lama, { label: " Penundaan KGB ", kategori: "sedang", durasiHukdis: null, berdampakKGB: true, durasiTunda: 12, aktif: false }),
    { perubahan: { aktif: false } },
  );
  assert.deepEqual(perubahanJenisHukdis(lama, { berdampakKGB: false, durasiTunda: 12 }), {
    perubahan: { berdampakKGB: false, durasiTunda: null },
  });
  assert.deepEqual(perubahanJenisHukdis(lama, { durasiTunda: 24 }), { perubahan: { durasiTunda: 24 } });

  assert.ok(perubahanJenisHukdis(lama, { durasiTunda: null }).galat);
  assert.ok(perubahanJenisHukdis(lama, { durasiTunda: 100000 }).galat);
  assert.ok(perubahanJenisHukdis({ ...lama, berdampakKGB: false, durasiTunda: null }, { berdampakKGB: true }).galat);
  assert.ok(perubahanJenisHukdis(lama, { kategori: "beratan" }).galat);
});

test("tmtBerakhirOtomatis: berakhir sehari sebelum genap masa hukdis", () => {
  assert.equal(tmtBerakhirOtomatis("2026-01-01", 12), "2026-12-31");
  assert.equal(tmtBerakhirOtomatis("2026-03-15", 6), "2026-09-14");
  assert.equal(tmtBerakhirOtomatis("2026-01-31", 1), "2026-02-27");
  assert.equal(tmtBerakhirOtomatis("2027-11-01", 3), "2028-01-31");
  assert.equal(tmtBerakhirOtomatis("", 12), "");
  assert.equal(tmtBerakhirOtomatis("2026-01-01", 0), "");
});
