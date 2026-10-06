// Atas dasar dan dokumen SK sebuah KGB di halaman pegawai (ADR-070).
//
// Jalankan: node --import tsx --test lib/atasDasarKgb.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { dokumenAtasDasar, pesanAtasDasarBerbeda, skKgb, type KgbUntukSinkron } from "./atasDasarKgb";
import type { DokumenPegawai } from "./dokumenPegawai";

const kgb = (p: Partial<KgbUntukSinkron> & Pick<KgbUntukSinkron, "id" | "status">): KgbUntukSinkron => ({
  isArsip: false, nomorSK: "", tanggalSK: null, tmtKgbBaru: "2026-12-01", surat: null, ...p,
});
const dok = (p: Partial<DokumenPegawai> & Pick<DokumenPegawai, "id" | "sumber">): DokumenPegawai => ({
  judul: "Dokumen", nomorSK: "", tanggal: "", keterangan: "", ukuran: null, url: `/berkas/${p.id}`, bisaHapus: false, ...p,
});

test("SK KGB sendiri: bertanda tangan, pindaian arsip, draf cetakan, atau belum ada", () => {
  assert.equal(skKgb(kgb({ id: "a", status: "selesai", surat: { nomorSurat: "W.17-1", pathFile: "sk/a.pdf" } }), []).dok?.jenis, "berkas");
  const arsip = [dok({ id: "arsip-1", sumber: "arsip", jenis: "sk_kgb", nomorSK: "ARSIP-2020" })];
  assert.deepEqual(skKgb(kgb({ id: "b", status: "selesai", isArsip: true, nomorSK: "ARSIP-2020" }), arsip), {
    nomor: "ARSIP-2020",
    dok: { jenis: "berkas", url: "/berkas/arsip-1", sumber: "Arsip dokumen pegawai" },
  });
  assert.equal(skKgb(kgb({ id: "c", status: "selesai", surat: { nomorSurat: "W.17-3" } }), []).dok?.jenis, "draf");
  assert.deepEqual(skKgb(kgb({ id: "d", status: "selesai", isArsip: true, nomorSK: "ARSIP-2" }), []), { nomor: "ARSIP-2", dok: null });
});

test("dokumen Atas dasar: SK KGB di SIM-KGB lebih dulu, lalu pindaian SK kenaikan pangkat menurut nomornya", () => {
  const semua = [kgb({ id: "k1", status: "selesai", surat: { nomorSurat: "W.17-KGB-2024", pathFile: "sk/k1.pdf" } })];
  assert.equal(dokumenAtasDasar("w.17-kgb-2024", semua, [])?.jenis, "berkas");
  const kp = [dok({ id: "arsip-kp", sumber: "arsip", jenis: "sk_pangkat", nomorSK: "SEK-1986.SA.04.05 TAHUN 2026" })];
  assert.deepEqual(dokumenAtasDasar("SEK-1986.SA.04.05 TAHUN 2026", semua, kp), {
    jenis: "berkas", url: "/berkas/arsip-kp", sumber: "Arsip dokumen pegawai",
  });
  assert.equal(dokumenAtasDasar("TIDAK-ADA", semua, kp), null);
  assert.equal(dokumenAtasDasar("", semua, kp), null);
});

test("KGB berjalan yang Atas dasarnya bukan SK terbaru menurut linimasa diberi tahu", () => {
  const data = { linimasa: { dasar: { label: "SK kenaikan pangkat (Reguler)", nomorSK: "KP-2026", tmt: "2026-02-01" } as never } };
  assert.match(pesanAtasDasarBerbeda(kgb({ id: "x", status: "sedang_diproses", nomorSK: "W.17-KGB-2024" }), data) ?? "", /masih SK W\.17-KGB-2024.*KP-2026/);
  assert.equal(pesanAtasDasarBerbeda(kgb({ id: "x", status: "sedang_diproses", nomorSK: "kp-2026" }), data), null);
  assert.equal(pesanAtasDasarBerbeda(kgb({ id: "x", status: "selesai", nomorSK: "W.17-KGB-2024" }), data), null);
  assert.equal(pesanAtasDasarBerbeda(kgb({ id: "x", status: "belum_diproses" }), data), null);
});
