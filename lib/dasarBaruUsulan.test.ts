// SK baru yang menetapkan gaji pokok pada usulan UPT (ADR-030).
//
// Jalankan: node --import tsx --test lib/dasarBaruUsulan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { isJenisDasarBaru, kekuranganDasarBaru, perluDasarBaru, ringkasDasarBaru } from "./dasarBaruUsulan";

test("perubahan golongan atau masa kerja golongan menuntut sebab; kolom lain tidak", () => {
  assert.equal(perluDasarBaru([{ kunci: "golonganRuang" }]), true);
  assert.equal(perluDasarBaru([{ kunci: "mkgTahun" }]), true);
  assert.equal(perluDasarBaru([{ kunci: "mkgBulan" }]), true);
  assert.equal(perluDasarBaru([{ kunci: "jabatan" }, { kunci: "tmtKgbTerakhir" }]), false);
  assert.equal(perluDasarBaru([]), false);
});

test("sebab wajib disebut hanya bila dasar gajinya berubah", () => {
  assert.deepEqual(kekuranganDasarBaru({}, false), []);
  assert.equal(kekuranganDasarBaru({}, true).length, 1);
  assert.equal(kekuranganDasarBaru({ dasarBaruJenis: "entah" }, true).length, 1);
});

test("koreksi salah ketik tidak menuntut SK", () => {
  assert.deepEqual(kekuranganDasarBaru({ dasarBaruJenis: "koreksi" }, true), []);
  assert.equal(ringkasDasarBaru({ dasarBaruJenis: "koreksi" }), "Koreksi data, bukan SK baru");
});

test("kenaikan pangkat menuntut jenis, nomor, tanggal, dan TMT", () => {
  const kurang = kekuranganDasarBaru({ dasarBaruJenis: "kp" }, true);
  assert.deepEqual(kurang, ["jenis kenaikan pangkat", "nomor SK kenaikan pangkat", "tanggal SK kenaikan pangkat", "TMT pangkat"]);
  assert.deepEqual(
    kekuranganDasarBaru(
      {
        dasarBaruJenis: "kp",
        dasarBaruJenisKp: "penyesuaian_ijazah",
        dasarBaruNomorSk: "W.19-KP.03.01-9",
        dasarBaruTanggalSk: "2026-05-02",
        dasarBaruTmt: "2026-04-01",
      },
      true,
    ),
    [],
  );
});

test("PMK menuntut nomor, tanggal, dan TMT PMK, tanpa jenis kenaikan pangkat", () => {
  assert.deepEqual(kekuranganDasarBaru({ dasarBaruJenis: "pmk" }, true), ["nomor SK PMK", "tanggal SK PMK", "TMT PMK"]);
  assert.deepEqual(
    kekuranganDasarBaru(
      { dasarBaruJenis: "pmk", dasarBaruNomorSk: "W.19-KP.04.03-7", dasarBaruTanggalSk: "2026-05-02", dasarBaruTmt: "2026-04-01" },
      true,
    ),
    [],
  );
});

test("ringkasan menyebut jenis, nomor, tanggal, dan TMT", () => {
  assert.equal(
    ringkasDasarBaru({
      dasarBaruJenis: "kp",
      dasarBaruJenisKp: "penyesuaian_ijazah",
      dasarBaruNomorSk: "W.19-KP.03.01-9",
      dasarBaruTanggalSk: "2026-05-02",
      dasarBaruTmt: "2026-04-01",
    }),
    "Kenaikan pangkat Pilihan: Penyesuaian Ijazah · SK W.19-KP.03.01-9 · 2 Mei 2026 · TMT 1 April 2026",
  );
  assert.equal(ringkasDasarBaru({}), null);
  assert.equal(isJenisDasarBaru("pmk"), true);
  assert.equal(isJenisDasarBaru("lain"), false);
});
