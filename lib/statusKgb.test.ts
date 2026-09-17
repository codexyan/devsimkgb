// Jalankan: node --import tsx --test lib/statusKgb.test.ts

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { STATUS_KGB, WARNA_STATUS_KGB, infoStatusKgb, isStatusKgb, warnaStatusKgb } from "./statusKgb";

test("warna badge dashboard per status", () => {
  assert.deepEqual(WARNA_STATUS_KGB, {
    belum_diproses: { bg: "var(--tint-amber-bg)", color: "var(--st-amber)" },
    sedang_diproses: { bg: "var(--tint-navy)", color: "var(--dtn)" },
    menunggu_keuangan: { bg: "var(--tint-violet-bg)", color: "var(--st-violet)" },
    selesai: { bg: "var(--tint-green-bg)", color: "var(--st-green)" },
    ditolak: { bg: "var(--tint-red-bg)", color: "var(--st-red)" },
  });
  assert.equal(warnaStatusKgb("selesai"), WARNA_STATUS_KGB.selesai);
  const netral = warnaStatusKgb("dikembalikan");
  assert.equal(warnaStatusKgb("__proto__"), netral);
  assert.notDeepEqual(netral, WARNA_STATUS_KGB.belum_diproses);
});

test("token warna badge terdefinisi di globals.css", () => {
  const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
  const warna = [...Object.values(WARNA_STATUS_KGB), warnaStatusKgb("tidak dikenal")];
  for (const { bg, color } of warna) {
    for (const nilai of [bg, color]) {
      const token = /^var\((--[a-z0-9-]+)\)$/.exec(nilai)?.[1];
      assert.ok(token, `${nilai} bukan var(--token)`);
      assert.ok(css.includes(`${token}:`), `${token} tidak ada di globals.css`);
    }
  }
});

test("label status sesuai istilah di aplikasi", () => {
  assert.deepEqual(
    Object.entries(STATUS_KGB).map(([status, info]) => [status, info.label]),
    [
      ["belum_diproses", "Belum Diproses"],
      ["sedang_diproses", "Sedang Diproses"],
      ["menunggu_keuangan", "Menunggu Keuangan"],
      ["selesai", "Selesai"],
      ["ditolak", "Dibatalkan"],
    ],
  );
});

test("setiap status punya keterangan dan kelas badge yang unik", () => {
  const semua = Object.values(STATUS_KGB);
  for (const info of semua) {
    assert.ok(info.keterangan.length > 0, `keterangan ${info.label} kosong`);
    assert.match(info.kelas, /^pub-status-[a-z]+$/);
  }
  assert.equal(new Set(semua.map((i) => i.kelas)).size, semua.length);
});

test("kelas badge terdefinisi di publik.css", () => {
  const css = readFileSync(join(__dirname, "..", "app", "(publik)", "publik.css"), "utf8");
  for (const info of Object.values(STATUS_KGB)) {
    assert.ok(css.includes(`.${info.kelas}`), `kelas .${info.kelas} tidak ada di publik.css`);
  }
});

test("status dikenal dikembalikan dari tabel", () => {
  assert.equal(infoStatusKgb("menunggu_keuangan"), STATUS_KGB.menunggu_keuangan);
  assert.equal(infoStatusKgb("ditolak").label, "Dibatalkan");
  assert.equal(isStatusKgb("selesai"), true);
});

test("status tidak dikenal tidak dianggap Belum Diproses", () => {
  for (const nilai of ["dikembalikan", "", "Selesai", "toString", "__proto__"]) {
    assert.equal(isStatusKgb(nilai), false, nilai);
    assert.deepEqual(infoStatusKgb(nilai), { label: nilai, keterangan: "", kelas: "" });
  }
});
