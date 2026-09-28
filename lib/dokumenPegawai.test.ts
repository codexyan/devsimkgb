// Arsip dokumen pegawai: aturan dokumen rujukan tiap tindakan (ADR-028).
//
// Jalankan: node --import tsx --test lib/dokumenPegawai.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { DOKUMEN_TINDAKAN, JENIS_BERKAS_USULAN, isJenisDokumen, periksaDokumen } from "./dokumenPegawai";

test("jenis rujukan dan unggahan tiap tindakan sah, dan SK yang dilampirkan ikut tampil sebagai rujukan", () => {
  for (const [tindakan, aturan] of Object.entries(DOKUMEN_TINDAKAN)) {
    for (const j of [...aturan.rujukan, ...aturan.unggah]) assert.ok(isJenisDokumen(j), `${tindakan}: ${j}`);
    for (const j of aturan.unggah) assert.ok(aturan.rujukan.includes(j), `${tindakan}: ${j} tidak tampil sebagai rujukan`);
  }
  assert.deepEqual(DOKUMEN_TINDAKAN.identitas.unggah, []);
  assert.equal(DOKUMEN_TINDAKAN.pemberhentian.unggah[0], "sk_pemberhentian");
});

test("berkas usulan UPT dipetakan ke jenis yang sah; surat pengantar tidak", () => {
  for (const j of Object.values(JENIS_BERKAS_USULAN)) assert.ok(isJenisDokumen(j));
  assert.equal(JENIS_BERKAS_USULAN.berkas, undefined);
});

test("unggahan dokumen baru diperiksa", () => {
  assert.deepEqual(periksaDokumen({ jenis: "sk_mutasi", tanggalSK: "2026-09-01", ukuran: 1000 }), []);
  assert.ok(periksaDokumen({ jenis: "sk_entah", tanggalSK: "", ukuran: 1000 }).length > 0);
});
