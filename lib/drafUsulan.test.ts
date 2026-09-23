// Draf usulan UPT yang disimpan di peramban.
//
// Jalankan: node --import tsx --test lib/drafUsulan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAKS_UMUR_DRAF_HARI,
  bacaDraf,
  hapusDraf,
  idBerdraf,
  kunciDraf,
  simpanDraf,
  type PenyimpananDraf,
} from "./drafUsulan";

/** Penyimpanan tiruan dengan perilaku yang sama dengan localStorage. */
function penyimpanan(awal: Record<string, string> = {}): PenyimpananDraf & { isi: Map<string, string> } {
  const isi = new Map(Object.entries(awal));
  return {
    isi,
    getItem: (k) => isi.get(k) ?? null,
    setItem: (k, v) => void isi.set(k, v),
    removeItem: (k) => void isi.delete(k),
    key: (i) => [...isi.keys()][i] ?? null,
    get length() { return isi.size; },
  };
}

const isiDraf = {
  jenis: "perubahan" as const,
  nipBaru: "",
  surat: { nomorSurat: "W.19.PAS.7-SA.04.04-1", tanggalSurat: "2026-09-08" },
  hukdis: { ada: false, jenis: "", nomorSk: "", tmtMulai: "", tmtBerakhir: "", keterangan: "" },
  isian: { nama: "NOORHIKMAH", mkgTahun: "1" },
};

test("draf yang disimpan terbaca kembali utuh", () => {
  const p = penyimpanan();
  const kunci = kunciDraf("rutan-rantau", "peg-1");
  assert.equal(simpanDraf(p, kunci, isiDraf, new Date("2026-09-23T04:00:00Z")), true);

  const kembali = bacaDraf(p, kunci, new Date("2026-09-23T05:00:00Z"));
  assert.equal(kembali?.isian.nama, "NOORHIKMAH");
  assert.equal(kembali?.surat.nomorSurat, "W.19.PAS.7-SA.04.04-1");
  assert.equal(kembali?.disimpanAt, "2026-09-23T04:00:00.000Z");
});

test("draf tiap pegawai terpisah, dan pegawai baru punya kuncinya sendiri", () => {
  assert.notEqual(kunciDraf("rutan-rantau", "peg-1"), kunciDraf("rutan-rantau", "peg-2"));
  assert.notEqual(kunciDraf("rutan-rantau", null), kunciDraf("lapas-banjarmasin", null));
  assert.ok(kunciDraf("rutan-rantau", null).endsWith(".baru"));
});

test("draf basi dibuang, bukan dipulihkan", () => {
  const p = penyimpanan();
  const kunci = kunciDraf("rutan-rantau", "peg-1");
  simpanDraf(p, kunci, isiDraf, new Date("2026-01-01T00:00:00Z"));

  const lewat = new Date(Date.UTC(2026, 0, 1) + (MAKS_UMUR_DRAF_HARI + 1) * 86_400_000);
  assert.equal(bacaDraf(p, kunci, lewat), null);
  assert.equal(p.isi.has(kunci), false);
});

test("isi yang rusak atau bentuknya tidak dikenal tidak dipulihkan", () => {
  const kunci = kunciDraf("rutan-rantau", "peg-1");
  const rusak = penyimpanan({ [kunci]: "{bukan json" });
  assert.equal(bacaDraf(rusak, kunci), null);

  const salahBentuk = penyimpanan({ [kunci]: JSON.stringify({ jenis: "entah", isian: {} }) });
  assert.equal(bacaDraf(salahBentuk, kunci), null);
  assert.equal(salahBentuk.isi.has(kunci), false);
});

test("daftar draf hanya berisi satker sendiri dan yang masih segar", () => {
  const p = penyimpanan();
  const sekarang = new Date("2026-09-23T04:00:00Z");
  simpanDraf(p, kunciDraf("rutan-rantau", "peg-1"), isiDraf, sekarang);
  simpanDraf(p, kunciDraf("rutan-rantau", null), { ...isiDraf, jenis: "baru", nipBaru: "200304182025061003" }, sekarang);
  simpanDraf(p, kunciDraf("lapas-banjarmasin", "peg-9"), isiDraf, sekarang);
  simpanDraf(p, kunciDraf("rutan-rantau", "peg-basi"), isiDraf, new Date("2026-01-01T00:00:00Z"));

  const daftar = idBerdraf(p, "rutan-rantau", sekarang);
  assert.deepEqual([...daftar].sort(), ["baru", "peg-1"]);
});

test("draf dihapus setelah usulannya terkirim", () => {
  const p = penyimpanan();
  const kunci = kunciDraf("rutan-rantau", "peg-1");
  simpanDraf(p, kunci, isiDraf);
  hapusDraf(p, kunci);
  assert.equal(bacaDraf(p, kunci), null);
});

test("tanpa penyimpanan peramban semuanya diam, tidak melempar", () => {
  const kunci = kunciDraf("rutan-rantau", "peg-1");
  assert.equal(simpanDraf(null, kunci, isiDraf), false);
  assert.equal(bacaDraf(undefined, kunci), null);
  assert.deepEqual([...idBerdraf(null, "rutan-rantau")], []);
  hapusDraf(null, kunci);
});

test("penyimpanan yang penuh membuat simpanDraf mengaku gagal", () => {
  const penuh: PenyimpananDraf = {
    getItem: () => null,
    setItem: () => { throw new Error("QuotaExceededError"); },
    removeItem: () => {},
    key: () => null,
    length: 0,
  };
  assert.equal(simpanDraf(penuh, kunciDraf("rutan-rantau", "peg-1"), isiDraf), false);
});
