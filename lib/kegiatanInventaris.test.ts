// Kegiatan pengumpulan data: id, letak simpan di R2, satker sasaran, dan pemeriksaan pengaturan.
//
// Jalankan: node --import tsx --test lib/kegiatanInventaris.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  awalanKegiatan,
  idDariNama,
  kegiatanDariKonfigurasiLama,
  kunciBerkasInventarisSah,
  kunciDataKegiatan,
  periksaKegiatan,
  satkerPilihan,
  tautanKegiatan,
  templateTersedia,
  type Kegiatan,
} from "./kegiatanInventaris";

test("kegiatan pertama memakai tautan dan letak lama, kegiatan baru punya letaknya sendiri", () => {
  const lama = kegiatanDariKonfigurasiLama({ terbuka: true, kode: "KANWIL2026", tutupPada: "2026-10-10T23:59" });
  assert.deepEqual([lama.id, lama.template, lama.terbuka, lama.kode], ["kanwil", "kgb-kanwil", true, "KANWIL2026"]);
  assert.equal(kegiatanDariKonfigurasiLama(null).terbuka, false);
  assert.equal(tautanKegiatan("kanwil"), "/inventarisasi-kgb");
  assert.equal(tautanKegiatan("kgb-upt-2026"), "/inventarisasi-kgb/kgb-upt-2026");
  assert.equal(awalanKegiatan("kanwil"), "inventaris/");
  assert.equal(awalanKegiatan("kgb-upt-2026"), "inventaris/k/kgb-upt-2026/");
});

test("daftar kiriman kegiatan pertama tidak ikut membaca kiriman kegiatan lain", () => {
  assert.equal(kunciDataKegiatan("kanwil", "inventaris/199001012015031001/data.json"), true);
  assert.equal(kunciDataKegiatan("kanwil", "inventaris/k/kgb-upt/199001012015031001/data.json"), false);
  assert.equal(kunciDataKegiatan("kanwil", "inventaris/_kegiatan.json"), false);
  assert.equal(kunciDataKegiatan("kgb-upt", "inventaris/k/kgb-upt/199001012015031001/data.json"), true);
  assert.equal(kunciDataKegiatan("kgb-upt", "inventaris/k/kgb-upt-2/199001012015031001/data.json"), false);
});

test("kunci berkas sah pada letak lama dan letak kegiatan", () => {
  assert.ok(kunciBerkasInventarisSah("inventaris/199001012015031001/199001012015031001_SK-KGB-Terakhir_2024-09-20.pdf"));
  assert.ok(kunciBerkasInventarisSah("inventaris/k/kgb-upt/199001012015031001/199001012015031001_SK-PMK.pdf"));
  assert.ok(!kunciBerkasInventarisSah("inventaris/k/../199001012015031001/199001012015031001_SK-PMK.pdf"));
  assert.ok(!kunciBerkasInventarisSah("sk/199001012015031001.pdf"));
  assert.ok(!kunciBerkasInventarisSah("inventaris/199001012015031001/199001012015031002_SK-PMK.pdf"));
});

test("id kegiatan dari nama, unik terhadap yang sudah ada", () => {
  assert.equal(idDariNama("Inventarisasi KGB UPT 2026", new Set()), "inventarisasi-kgb-upt-2026");
  assert.equal(idDariNama("Inventarisasi KGB UPT 2026", new Set(["inventarisasi-kgb-upt-2026"])), "inventarisasi-kgb-upt-2026-2");
  assert.equal(idDariNama("  !! ", new Set()), "kegiatan");
});

test("satker sasaran: semua UPT bila kosong, tidak ada untuk template Kanwil", () => {
  const semua = satkerPilihan({ template: "kgb-upt", satker: [] });
  assert.ok(semua.length > 10);
  assert.ok(semua.every((s) => s.kode !== "kanwil"));
  assert.deepEqual(satkerPilihan({ template: "kgb-upt", satker: ["lapas-banjarmasin"] }).map((s) => s.kode), ["lapas-banjarmasin"]);
  assert.deepEqual(satkerPilihan({ template: "kgb-kanwil", satker: [] }), []);
});

test("pemeriksaan pengaturan kegiatan", () => {
  const k: Kegiatan = {
    id: "kgb-upt-2026",
    nama: "Inventarisasi KGB UPT 2026",
    template: "kgb-upt",
    satker: [],
    terbuka: true,
    kode: "UPT2026",
    tutupPada: "2026-10-31T23:59",
  };
  const sekarang = new Date("2026-10-01T08:00:00+08:00");
  assert.deepEqual(periksaKegiatan(k, sekarang), []);
  assert.ok(periksaKegiatan({ ...k, kode: "ab" }, sekarang).some((p) => p.startsWith("Kode akses")));
  assert.ok(periksaKegiatan({ ...k, tutupPada: "2026-09-01T00:00" }, sekarang).some((p) => p.startsWith("Waktu tutup sudah lewat")));
  assert.ok(periksaKegiatan({ ...k, satker: ["kanwil"] }, sekarang).some((p) => p.startsWith("Satker sasaran")));
  // Kegiatan yang ditutup boleh tanpa kode.
  assert.deepEqual(periksaKegiatan({ ...k, terbuka: false, kode: "" }, sekarang), []);
});

test("template UPT tidak lagi ditawarkan untuk kegiatan baru, tetapi kegiatan lamanya tetap sah (ADR-024)", () => {
  assert.deepEqual(templateTersedia(), ["kgb-kanwil"]);
  const upt: Kegiatan = {
    id: "kgb-upt-2026",
    nama: "Inventarisasi KGB UPT 2026",
    template: "kgb-upt",
    satker: [],
    terbuka: true,
    kode: "UPT2026",
    tutupPada: "2026-10-31T23:59",
  };
  const sekarang = new Date("2026-10-01T08:00:00+08:00");
  // Kegiatan yang sudah ada tetap dapat disimpan (mis. untuk ditutup); hanya kegiatan baru yang ditolak.
  assert.deepEqual(periksaKegiatan(upt, sekarang), []);
  assert.ok(periksaKegiatan(upt, sekarang, true).some((p) => p.includes("Usulan UPT")));
  assert.deepEqual(periksaKegiatan({ ...upt, template: "kgb-kanwil" }, sekarang, true), []);
});
