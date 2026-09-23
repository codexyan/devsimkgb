// Pemeriksaan ulang keadaan pegawai pada tahap Buat SK dan Konfirmasi keuangan.
//
// Jalankan: node --import tsx --test lib/pemeriksaanUlangKgb.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { periksaUlangKgb } from "./pemeriksaanUlangKgb";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

const pegawai = (p: Partial<Parameters<typeof periksaUlangKgb>[0]["pegawai"]> = {}) => ({
  nama: "Pegawai Contoh",
  aktif: true,
  statusHukdis: false,
  tanggalHukdisBerakhir: null,
  jenisHukdis: null,
  ...p,
});

const periksa = (lain: Partial<Parameters<typeof periksaUlangKgb>[0]> = {}) =>
  periksaUlangKgb({
    tahap: "buat_sk",
    pegawai: pegawai(),
    riwayatHukdis: [],
    tmtKgb: tgl(2026, 9),
    hariIni: tgl(2026, 7, 20),
    ...lain,
  });

test("keadaan normal lolos", () => {
  assert.equal(periksa().tolak, null);
});

test("pegawai yang sudah tidak aktif ditolak, dengan langkah perbaikannya", () => {
  const hasil = periksa({ pegawai: pegawai({ aktif: false }) });
  assert.match(hasil.tolak ?? "", /tidak aktif/);
  assert.match(hasil.tolak ?? "", /Batalkan KGB/);
});

test("hukuman disiplin yang terbit setelah Input KGB menahan SK dan konfirmasi keuangan", () => {
  const hukdis = [{ berdampakKGB: true, tmtBerakhir: tgl(2027, 6), tmtMulai: tgl(2026, 8, 1) }];
  const buatSk = periksa({ riwayatHukdis: hukdis });
  assert.match(buatSk.tolak ?? "", /SK tidak dapat dibuat/);
  assert.match(buatSk.tolak ?? "", /1 Juni 2027/);

  const konfirmasi = periksa({ tahap: "konfirmasi_keuangan", riwayatHukdis: hukdis });
  assert.match(konfirmasi.tolak ?? "", /KGB tidak dapat dikonfirmasi/);
});

test("hukuman disiplin yang mulai setelah TMT KGB ini tidak menahannya", () => {
  // Hukdis mulai 1 Oktober 2026 menunda KGB berikutnya, bukan KGB dengan TMT 1 September 2026.
  const hasil = periksa({ riwayatHukdis: [{ berdampakKGB: true, tmtBerakhir: tgl(2027, 6), tmtMulai: tgl(2026, 10, 1) }] });
  assert.equal(hasil.tolak, null);
});

test("hukuman disiplin yang tidak berdampak KGB tidak menahan", () => {
  const hasil = periksa({ riwayatHukdis: [{ berdampakKGB: false, tmtBerakhir: tgl(2027, 6), tmtMulai: tgl(2026, 8, 1) }] });
  assert.equal(hasil.tolak, null);
});
