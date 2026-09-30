import { test } from "node:test";
import assert from "node:assert/strict";
import { badanArsipKgb, namaFileSk, tautanBerkasSk } from "./kgbAksi";

test("namaFileSk: SK biasa memakai tahun, versi Srikandi tanpa tahun", () => {
  assert.equal(namaFileSk({ nama: "Pegawai Contoh", tahun: 2026, versi: "biasa" }), "KGB Kanwil Pegawai Contoh 2026.pdf");
  assert.equal(namaFileSk({ nama: "Pegawai Contoh", tahun: 2026, versi: "srikandi" }), "KGB Pegawai Contoh.pdf");
  assert.equal(namaFileSk({ nama: "Pegawai Contoh", tahun: null, versi: "biasa" }), "KGB Kanwil Pegawai Contoh.pdf");
});

test("namaFileSk: karakter terlarang diganti dan nama kosong diberi cadangan", () => {
  assert.equal(namaFileSk({ nama: 'A/B: "C"?', tahun: 2026, versi: "biasa" }), "KGB Kanwil A B C 2026.pdf");
  assert.equal(namaFileSk({ nama: "  ", versi: "srikandi" }), "KGB Pegawai.pdf");
});

/** Angka SK pembanding; isinya tidak disimpan, hanya dicocokkan server (ADR-035). */
const angkaSk = { mkgTahunSK: "14", mkgBulanSK: "0", gajiPokokSK: "3.607.500" };

test("badanArsipKgb: penetap dikirim sebagai penetap SK dasar dan penetap arsip bila diisi", () => {
  const badan = badanArsipKgb("p1", {
    nomorSK: " W.19-1/2026 ",
    tanggalSK: "2026-04-10",
    tmtSK: "2026-06-01",
    penetapSkArsip: " Kepala Kantor Wilayah ",
    ...angkaSk,
  });
  assert.deepEqual(badan, {
    pegawaiId: "p1",
    nomorSK: "W.19-1/2026",
    tanggalSK: "2026-04-10",
    tmtSK: "2026-06-01",
    isArsip: true,
    mkgTahunSK: "14",
    mkgBulanSK: "0",
    gajiPokokSK: "3.607.500",
    penetapSkDasar: "Kepala Kantor Wilayah",
    penetapSkArsip: "Kepala Kantor Wilayah",
  });
});

test("badanArsipKgb: penetap kosong tidak dikirim, angka SK tetap ikut", () => {
  const badan = badanArsipKgb("p1", {
    nomorSK: "X",
    tanggalSK: "2026-04-10",
    tmtSK: "2026-06-01",
    penetapSkArsip: " ",
    ...angkaSk,
  });
  assert.equal("penetapSkDasar" in badan, false);
  assert.equal("penetapSkArsip" in badan, false);
  assert.equal(badan.isArsip, true);
  // Angka pembanding wajib ikut: tanpanya server menolak pengarsipan.
  assert.equal(badan.mkgTahunSK, "14");
  assert.equal(badan.gajiPokokSK, "3.607.500");
});

test("tautanBerkasSk: path berkas di-encode", () => {
  assert.equal(tautanBerkasSk("sk/1_2.pdf"), "/api/blob/download?url=sk%2F1_2.pdf");
});
