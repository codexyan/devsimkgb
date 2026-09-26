import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SATKER_UPT,
  bolehUnduhSkUpt,
  dipegangKeuanganKanwil,
  isSatkerUpt,
  kgbDitunda,
  nilaiSatkerUntukPeran,
  pegawaiSatker,
  satkerAkunUpt,
} from "@/lib/aksesUpt";
import { SATKER } from "@/lib/satker";

test("satker UPT adalah seluruh satker kecuali Kanwil", () => {
  assert.equal(SATKER_UPT.length, SATKER.length - 1);
  assert.equal(isSatkerUpt("rutan-rantau"), true);
  assert.equal(isSatkerUpt("kanwil"), false);
  assert.equal(isSatkerUpt("satker-karangan"), false);
  assert.equal(isSatkerUpt(null), false);
});

test("satker akun hanya berlaku untuk peran admin_upt dengan kode UPT yang sah", () => {
  assert.equal(satkerAkunUpt({ role: "admin_upt", satker: "rutan-rantau" }), "rutan-rantau");
  assert.equal(satkerAkunUpt({ role: "admin_upt", satker: "kanwil" }), null);
  assert.equal(satkerAkunUpt({ role: "admin_upt", satker: null }), null);
  // Peran Kanwil tidak pernah memakai jalur UPT, walau kolom satkernya terisi.
  assert.equal(satkerAkunUpt({ role: "superAdminCore", satker: "rutan-rantau" }), null);
  assert.equal(satkerAkunUpt({ role: "sdm_kgb", satker: null }), null);
});

test("kolom satker wajib untuk Admin UPT dan selalu kosong untuk peran Kanwil", () => {
  assert.deepEqual(nilaiSatkerUntukPeran("admin_upt", "rutan-rantau"), { ok: true, satker: "rutan-rantau" });
  assert.deepEqual(nilaiSatkerUntukPeran("superAdminCore", "rutan-rantau"), { ok: true, satker: null });
  assert.equal(nilaiSatkerUntukPeran("admin_upt", "").ok, false);
  assert.equal(nilaiSatkerUntukPeran("admin_upt", "kanwil").ok, false);
  assert.equal(nilaiSatkerUntukPeran("admin_upt", undefined).ok, false);
});

test("pegawai satker memakai pencocokan unit kerja yang sama dengan modul Satker", () => {
  const daftar = [
    { id: "a", unitKerja: "Rutan Kelas IIB Rantau" },
    { id: "b", unitKerja: "rutan kelas iib rantau" },
    { id: "c", unitKerja: "Lapas Kelas IIA Banjarmasin" },
    { id: "d", unitKerja: null },
  ];
  assert.deepEqual(pegawaiSatker(daftar, "rutan-rantau").map((p) => p.id), ["a", "b"]);
  assert.deepEqual(pegawaiSatker(daftar, "lapas-banjarmasin").map((p) => p.id), ["c"]);
});

test("KGB ditunda hanya bila hukdis masih aktif dan berdampak pada KGB", () => {
  const riwayat = [
    { pegawaiId: "a", berdampakKGB: true, aktif: true },
    { pegawaiId: "b", berdampakKGB: false, aktif: true },
    { pegawaiId: "c", berdampakKGB: true, aktif: false },
  ];
  assert.equal(kgbDitunda(riwayat, "a"), true);
  assert.equal(kgbDitunda(riwayat, "b"), false);
  assert.equal(kgbDitunda(riwayat, "c"), false);
  assert.equal(kgbDitunda(riwayat, "z"), false);
});

test("SK boleh diunduh UPT sejak diunggah Tim SDM, bila ada berkasnya dan pegawainya satker itu", () => {
  const pegawai = { unitKerja: "Rutan Kelas IIB Rantau" };
  const dasar = { kode: "rutan-rantau", pegawai, pathFile: "sk/199001_1.pdf" };
  assert.equal(bolehUnduhSkUpt({ ...dasar, kgb: { status: "selesai" } }), true);
  // Keuangan UPT menindaklanjuti SK begitu diunggah Tim SDM, jadi SK sudah boleh diunduh saat itu.
  assert.equal(bolehUnduhSkUpt({ ...dasar, kgb: { status: "menunggu_keuangan" } }), true);
  assert.equal(bolehUnduhSkUpt({ ...dasar, kgb: { status: "sedang_diproses" } }), false);
  assert.equal(bolehUnduhSkUpt({ ...dasar, kgb: { status: "selesai", isArsip: true } }), false);
  assert.equal(bolehUnduhSkUpt({ ...dasar, kgb: null }), false);
  assert.equal(bolehUnduhSkUpt({ ...dasar, pathFile: null, kgb: { status: "selesai" } }), false);
  // Pegawai satker lain, walau KGB-nya sudah selesai.
  assert.equal(
    bolehUnduhSkUpt({ ...dasar, pegawai: { unitKerja: "Lapas Kelas IIA Banjarmasin" }, kgb: { status: "selesai" } }),
    false,
  );
});

test("keuangan Kanwil hanya memegang pegawai Kanwil; pegawai UPT dipegang keuangan satkernya", () => {
  assert.equal(dipegangKeuanganKanwil(null), true);
  assert.equal(dipegangKeuanganKanwil(""), true);
  assert.equal(dipegangKeuanganKanwil("kanwil"), true);
  assert.equal(dipegangKeuanganKanwil("Rutan Kelas IIB Rantau"), false);
  // Unit kerja yang tidak dikenali tetap dipegang Kanwil agar KGB-nya tidak terlantar.
  assert.equal(dipegangKeuanganKanwil("Satker Antah Berantah"), true);
});

test("waktu unggah SK dibaca dari key berkasnya", async () => {
  const { waktuUnggahSk } = await import("@/lib/aksesUpt");
  assert.equal(waktuUnggahSk("sk/199001012015031001_1758860000000.pdf")?.getTime(), 1758860000000);
  assert.equal(waktuUnggahSk("sk/lama.pdf"), null);
  assert.equal(waktuUnggahSk(null), null);
});
