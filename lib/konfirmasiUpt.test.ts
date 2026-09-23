// Konfirmasi data pegawai oleh admin UPT, berlaku per siklus KGB.
//
// Jalankan: node --import tsx --test lib/konfirmasiUpt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { BUTIR_KONFIRMASI_UPT, statusKonfirmasiUpt, sudahDikonfirmasiUpt } from "./konfirmasiUpt";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

test("konfirmasi hanya berlaku untuk TMT yang dikonfirmasi", () => {
  const pegawai = { konfirmasiUptTmt: tgl(2026, 6) };
  assert.equal(statusKonfirmasiUpt(pegawai, tgl(2026, 6)), "berlaku");
  assert.equal(sudahDikonfirmasiUpt(pegawai, tgl(2026, 6)), true);

  // Siklus berikutnya harus dikonfirmasi ulang.
  assert.equal(statusKonfirmasiUpt(pegawai, tgl(2028, 6)), "kedaluwarsa");
  assert.equal(sudahDikonfirmasiUpt(pegawai, tgl(2028, 6)), false);
});

test("tanpa konfirmasi berarti belum, dan TMT kosong tidak dianggap terkonfirmasi", () => {
  assert.equal(statusKonfirmasiUpt({ konfirmasiUptTmt: null }, tgl(2026, 6)), "belum");
  assert.equal(statusKonfirmasiUpt({ konfirmasiUptTmt: undefined }, tgl(2026, 6)), "belum");
  assert.equal(statusKonfirmasiUpt({ konfirmasiUptTmt: tgl(2026, 6) }, null), "kedaluwarsa");
  assert.equal(sudahDikonfirmasiUpt({ konfirmasiUptTmt: null }, null), false);
});

test("TMT yang tersimpan sebagai tengah malam UTC maupun WITA dianggap sama", () => {
  // 1 Juni 2026 dapat tersimpan sebagai 2026-06-01T00:00:00Z atau 2026-05-31T16:00:00Z.
  for (const tersimpan of ["2026-06-01T00:00:00Z", "2026-05-31T16:00:00Z"]) {
    assert.equal(statusKonfirmasiUpt({ konfirmasiUptTmt: tersimpan }, tgl(2026, 6)), "berlaku", tersimpan);
  }
});

test("butir konfirmasi memuat MKG dan hukuman disiplin", () => {
  const gabung = BUTIR_KONFIRMASI_UPT.join(" ").toLowerCase();
  assert.match(gabung, /masa kerja golongan/);
  assert.match(gabung, /hukuman disiplin/);
  assert.equal(BUTIR_KONFIRMASI_UPT.length, 5);
});
