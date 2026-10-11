// Penafsiran jenis aksi jejak audit (ADR-105).
//
// Jalankan: node --import tsx --test lib/aksiAudit.test.ts

import assert from "node:assert/strict";
import test from "node:test";
import { aksiAudit } from "./aksiAudit";

test("aksiAudit: unggahan SK arsip lama dibaca sebagai upload_sk_arsip", () => {
  const detail = "Upload SK TTD untuk Budi (199001), file SK arsip; tanda tangan basah (tanpa TTE), 210 KB, SHA-256 ab";
  assert.equal(aksiAudit({ aksi: "upload_sk", detail }), "upload_sk_arsip");
  // Bentuk sebelum ADR-096: detail berakhir pada keterangannya.
  assert.equal(aksiAudit({ aksi: "upload_sk", detail: "Upload SK TTD untuk Budi (199001), file SK arsip" }), "upload_sk_arsip");
});

test("aksiAudit: unggahan SK biasa dan entri baru tidak berubah", () => {
  const biasa = "Upload SK TTD untuk Budi (199001), menunggu konfirmasi keuangan; TTE utuh, 300 KB, SHA-256 cd";
  assert.equal(aksiAudit({ aksi: "upload_sk", detail: biasa }), "upload_sk");
  const ganti = "Upload SK TTD untuk Budi (199001), mengganti file SK yang menunggu konfirmasi keuangan; TTE utuh, 300 KB, SHA-256 ef";
  assert.equal(aksiAudit({ aksi: "upload_sk", detail: ganti }), "upload_sk");
  assert.equal(aksiAudit({ aksi: "upload_sk", detail: "Upload SK TTD untuk Budi (199001), menunggu konfirmasi keuangan" }), "upload_sk");
  assert.equal(aksiAudit({ aksi: "upload_sk_arsip", detail: "apa saja" }), "upload_sk_arsip");
  assert.equal(aksiAudit({ aksi: "input_kgb_arsip", detail: "file SK arsip;" }), "input_kgb_arsip");
  assert.equal(aksiAudit({ aksi: "upload_sk", detail: null }), "upload_sk");
});
