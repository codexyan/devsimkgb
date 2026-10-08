// Urutan kartu Sedang diproses menurut tindakan Kanwil (ADR-089).
//
// Jalankan: node --import tsx --test lib/tindakanProses.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { bandingTindakan, tindakanProses } from "./tindakanProses";

const kartu = (nama: string, isi: { sk?: boolean; review?: string | null; wajib?: boolean; batas: string }) => ({
  nama,
  skSudahDibuat: isi.sk ?? true,
  reviewSk: isi.wajib === false ? null : ({ status: isi.review ?? null } as never),
  deadlineSDM: isi.batas,
});

test("tindakan menurut keadaan SK dan review UPT", () => {
  assert.equal(tindakanProses(kartu("a", { sk: false, batas: "2026-10-20" })), "buat_sk");
  assert.equal(tindakanProses(kartu("a", { review: "perbaikan", batas: "2026-10-20" })), "perbaikan");
  assert.equal(tindakanProses(kartu("a", { review: "disetujui", batas: "2026-10-20" })), "siap");
  assert.equal(tindakanProses(kartu("a", { review: "dilewati", batas: "2026-10-20" })), "siap");
  assert.equal(tindakanProses(kartu("a", { wajib: false, batas: "2026-10-20" })), "siap", "pegawai Kanwil tanpa review");
  assert.equal(tindakanProses(kartu("a", { review: null, batas: "2026-10-20" })), "minta_review", "SK lama belum direview");
  assert.equal(tindakanProses(kartu("a", { review: "menunggu", batas: "2026-10-20" })), "menunggu_upt");
});

test("urutan: perbaikan, siap cetak, buat SK, menunggu UPT; batas terdekat lebih dulu", () => {
  const daftar = [
    kartu("menunggu", { review: "menunggu", batas: "2026-10-01" }),
    kartu("buat-sk", { sk: false, batas: "2026-10-15" }),
    kartu("siap-akhir", { review: "disetujui", batas: "2026-10-25" }),
    kartu("siap-awal", { review: "disetujui", batas: "2026-10-10" }),
    kartu("perbaikan", { review: "perbaikan", batas: "2026-10-30" }),
  ];
  assert.deepEqual(
    [...daftar].sort(bandingTindakan).map((k) => k.nama),
    ["perbaikan", "siap-awal", "siap-akhir", "buat-sk", "menunggu"],
  );
});
