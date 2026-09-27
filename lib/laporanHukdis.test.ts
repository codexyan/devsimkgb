// Daur hidup laporan hukuman disiplin dari UPT (ADR-016).
//
// Jalankan: node --import tsx --test lib/laporanHukdis.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LAPORAN_HUKDIS_DIPEGANG_UPT,
  STATUS_LAPORAN_HUKDIS,
  adaLaporanHukdisBerjalan,
  galatTanggalLaporanHukdis,
  kekuranganLaporanHukdis,
} from "./laporanHukdis";

test("laporan yang belum dicatat menutup pintu laporan kedua untuk pegawai yang sama", () => {
  // Satu SK yang dilaporkan dua kali membuat KGB pegawainya tergeser dua kali.
  for (const status of ["menunggu", "dikembalikan"]) {
    assert.equal(adaLaporanHukdisBerjalan([{ id: "l1", pegawaiId: "p1", status }], "p1"), true, status);
  }
  // Yang sudah dicatat membuka pintu lagi: pegawai bisa saja dihukum lagi di kemudian hari.
  assert.equal(adaLaporanHukdisBerjalan([{ id: "l1", pegawaiId: "p1", status: "diterima" }], "p1"), false);
  assert.equal(adaLaporanHukdisBerjalan([{ id: "l1", pegawaiId: "p2", status: "menunggu" }], "p1"), false);
  assert.equal(adaLaporanHukdisBerjalan([], "p1"), false);
});

test("kiriman ulang tidak dihalangi oleh laporan yang digantikannya", () => {
  const lama = [{ id: "l1", pegawaiId: "p1", status: "dikembalikan" }];
  assert.equal(adaLaporanHukdisBerjalan(lama, "p1", "l1"), false);
  // Tetapi laporan berjalan lain untuk pegawai itu tetap menghalangi.
  assert.equal(adaLaporanHukdisBerjalan([...lama, { id: "l2", pegawaiId: "p1", status: "menunggu" }], "p1", "l1"), true);
});

test("status yang dipegang UPT sama dengan yang boleh dibatalkan sendiri", () => {
  assert.deepEqual([...LAPORAN_HUKDIS_DIPEGANG_UPT], ["menunggu", "dikembalikan"]);
  const nada = Object.values(STATUS_LAPORAN_HUKDIS).map((s) => s.nada);
  assert.equal(new Set(nada).size, nada.length);
});

test("kelengkapan menagih jenis, SK, TMT mulai, dan pindaian SK; TMT berakhir tidak", () => {
  assert.deepEqual(kekuranganLaporanHukdis({}), [
    "jenis hukuman",
    "nomor SK",
    "tanggal SK",
    "TMT mulai",
    "pindaian SK hukuman disiplin",
  ]);
  assert.deepEqual(
    kekuranganLaporanHukdis({
      jenisHukdis: "teguran_tertulis",
      nomorSK: "W.17-KP.04.01-12",
      tanggalSK: "2026-09-01",
      tmtMulai: "2026-09-01",
      adaBerkas: true,
    }),
    [],
  );
  assert.deepEqual(kekuranganLaporanHukdis({ jenisHukdis: " ", nomorSK: "  ", tanggalSK: "bukan", tmtMulai: "2026-09-01", adaBerkas: true }), [
    "jenis hukuman",
    "nomor SK",
    "tanggal SK",
  ]);
});

test("TMT berakhir sebelum TMT mulai ditolak", () => {
  assert.equal(galatTanggalLaporanHukdis({ tmtMulai: "2026-09-01", tmtBerakhir: "2026-08-31" }), "TMT berakhir tidak boleh sebelum TMT mulai.");
  assert.equal(galatTanggalLaporanHukdis({ tmtMulai: "2026-09-01", tmtBerakhir: "2026-09-01" }), null);
  assert.equal(galatTanggalLaporanHukdis({ tmtMulai: "2026-09-01" }), null);
});
