// Pejabat penetap SK acuan usulan UPT (ADR-086): saran dari awalan nomor SK dan penetap yang dipakai saat disetujui.
//
// Jalankan: node --import tsx --test lib/penetapSk.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PENETAP_KANWIL,
  PENETAP_KANWIL_KUMHAM,
  SARAN_PENETAP_SK,
  penetapSesudahUsulan,
  penetapSkAcuanUsulan,
  saranPenetapDariNomor,
} from "./penetapSk";
import { penetapSesudahNomor, petunjukPenetapAcuan } from "../app/dashboard/components/upt/skSesudahAcuan";

test("saran dari awalan nomor: WP.19 Kanwil Ditjenpas, W.19 Kanwil Kemenkumham, lainnya tanpa saran", () => {
  assert.equal(saranPenetapDariNomor("WP.19-379.SA.12 TAHUN 2026"), PENETAP_KANWIL);
  assert.equal(saranPenetapDariNomor("wp19-SA.04.04-1729"), PENETAP_KANWIL);
  assert.equal(saranPenetapDariNomor("W.19.PAS.1.KP.04.04.- 1804"), PENETAP_KANWIL_KUMHAM);
  assert.equal(saranPenetapDariNomor(" W19.PAS17.KP.04.04-2611"), PENETAP_KANWIL_KUMHAM);
  assert.equal(saranPenetapDariNomor("W.190-1"), null, "bukan kode 19");
  assert.equal(saranPenetapDariNomor("SEK-2156.SA.04.05 TAHUN 2026"), null);
  assert.equal(saranPenetapDariNomor(""), null);
  assert.equal(saranPenetapDariNomor(null), null);
  for (const saran of [PENETAP_KANWIL, PENETAP_KANWIL_KUMHAM]) assert.ok(SARAN_PENETAP_SK.includes(saran));
});

test("penetap SK acuan usulan: isian UPT lebih dulu, lalu saran dari nomornya", () => {
  assert.equal(penetapSkAcuanUsulan({ nomorSkTerakhir: "W.19-1", penetapSkTerakhir: " Kepala Lapas " }), "Kepala Lapas");
  assert.equal(penetapSkAcuanUsulan({ nomorSkTerakhir: "W.19-1", penetapSkTerakhir: "" }), PENETAP_KANWIL_KUMHAM);
  assert.equal(penetapSkAcuanUsulan({ nomorSkTerakhir: "SK-1" }), null);
});

test("penetap sesudah usulan disetujui", () => {
  const lama = { nomorSkDasar: "W.19-KP-5591", penetapSkDasar: "Pejabat lama" };
  // Pegawai baru: isian, atau saran, atau kosong.
  assert.equal(penetapSesudahUsulan(null, { nomorSkTerakhir: "WP.19-1", penetapSkTerakhir: "Menteri" }), "Menteri");
  assert.equal(penetapSesudahUsulan(null, { nomorSkTerakhir: "WP.19-1" }), PENETAP_KANWIL);
  assert.equal(penetapSesudahUsulan(null, { nomorSkTerakhir: "SK-1" }), null);
  // Pegawai tercatat: isian selalu dipakai; nomor sama tanpa isian tidak mengubah; nomor baru tanpa isian memakai saran.
  assert.equal(penetapSesudahUsulan(lama, { nomorSkTerakhir: "W.19-KP- 5591", penetapSkTerakhir: "Baru" }), "Baru");
  assert.equal(penetapSesudahUsulan(lama, { nomorSkTerakhir: "W.19-KP- 5591" }), undefined);
  assert.equal(penetapSesudahUsulan(lama, { nomorSkTerakhir: null }), undefined);
  assert.equal(penetapSesudahUsulan(lama, { nomorSkTerakhir: "WP.19-9" }), PENETAP_KANWIL);
  assert.equal(penetapSesudahUsulan(lama, { nomorSkTerakhir: "SK-9" }), null);
});

test("isian formulir: saran mengikuti nomor yang diketik, pilihan sendiri tidak ditimpa", () => {
  assert.equal(penetapSesudahNomor("", "", "W.19.PAS.1"), PENETAP_KANWIL_KUMHAM);
  assert.equal(penetapSesudahNomor(PENETAP_KANWIL_KUMHAM, "W.19.PAS.1", "WP.19-2"), PENETAP_KANWIL);
  assert.equal(penetapSesudahNomor(PENETAP_KANWIL_KUMHAM, "W.19.PAS.1", "SK-3"), "", "saran lama dihapus bila nomor baru tanpa saran");
  assert.equal(penetapSesudahNomor("Kepala Lapas", "W.19.PAS.1", "WP.19-2"), "Kepala Lapas");
  assert.match(petunjukPenetapAcuan(PENETAP_KANWIL, "WP.19-2"), /Disarankan dari awalan nomor SK/);
  assert.match(petunjukPenetapAcuan("Kepala Lapas", "WP.19-2"), /sesuai tulisan pada SK/);
});
