// Tanda usulan UPT untuk Setujui yang dicentang (ADR-099).
//
// Jalankan: node --import tsx --test lib/tandaUsulan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { bolehDicentang, dicentangAwal, tandaUsulan, type UsulanBertanda } from "./tandaUsulan";

const usulan = (ubah: Partial<UsulanBertanda> = {}): UsulanBertanda => ({
  status: "menunggu",
  nipTercatat: null,
  hukdis: null,
  keadaanSk: null,
  kgb: null,
  perubahan: [],
  ...ubah,
});
const kode = (u: UsulanBertanda) => tandaUsulan(u).map((t) => t.kode);

test("usulan tanpa tanda tercentang sejak awal, termasuk SK yang masa kerjanya cocok", () => {
  assert.deepEqual(kode(usulan()), []);
  assert.equal(dicentangAwal(usulan()), true);
  assert.equal(dicentangAwal(usulan({ keadaanSk: "cocok" })), true);
  // KGB belum diproses hanya diselaraskan jadwalnya; tidak perlu dilihat.
  assert.equal(dicentangAwal(usulan({ kgb: { status: "belum_diproses", skDibuat: false }, perubahan: [{ kunci: "golonganRuang" }] })), true);
});

test("yang janggal menurut data tidak ikut tercentang, tetapi tetap dapat dicentang peninjau", () => {
  for (const u of [
    usulan({ hukdis: "Hukuman disiplin sedang" }),
    usulan({ keadaanSk: "beda" }),
    usulan({ keadaanSk: "belum_dicocokkan" }),
    usulan({ keadaanSk: "belum_dihitung" }),
    usulan({ nipTercatat: { satkerSama: true } }),
    usulan({ kgb: { status: "sedang_diproses", skDibuat: true } }),
    usulan({ kgb: { status: "sedang_diproses", skDibuat: false }, perubahan: [{ kunci: "mkgTahun" }] }),
  ]) {
    assert.equal(tandaUsulan(u).length, 1, JSON.stringify(u));
    assert.equal(dicentangAwal(u), false);
    assert.equal(bolehDicentang(u), true);
  }
  // KGB yang sedang diproses tanpa perubahan dasar gaji dan tanpa SK hanya memperbarui data pegawai.
  assert.equal(dicentangAwal(usulan({ kgb: { status: "sedang_diproses", skDibuat: false }, perubahan: [{ kunci: "jabatan" }] })), true);
});

test("yang pasti ditolak server tidak dapat dicentang", () => {
  const satkerLain = usulan({ nipTercatat: { satkerSama: false } });
  assert.deepEqual(kode(satkerLain), ["nip_satker_lain"]);
  assert.equal(bolehDicentang(satkerLain), false);
  const skDiunggah = usulan({ kgb: { status: "menunggu_keuangan", skDibuat: true }, perubahan: [{ kunci: "gajiPokok" }] });
  assert.deepEqual(kode(skDiunggah), ["sk_sudah_diunggah"]);
  assert.equal(bolehDicentang(skDiunggah), false);
  // SK yang sudah diunggah tetap boleh, bila dasar gajinya tidak berubah.
  assert.equal(bolehDicentang(usulan({ kgb: { status: "menunggu_keuangan", skDibuat: true }, perubahan: [{ kunci: "jabatan" }] })), true);
});

test("usulan yang sudah ditinjau tidak pernah tercentang", () => {
  assert.equal(dicentangAwal(usulan({ status: "disetujui" })), false);
  assert.equal(bolehDicentang(usulan({ status: "revisi" })), false);
});

test("beberapa tanda sekaligus tetap terbaca semuanya", () => {
  assert.deepEqual(kode(usulan({ hukdis: "Ringan", keadaanSk: "beda", nipTercatat: { satkerSama: true } })), ["nip_tercatat", "hukdis", "mkg_beda"]);
});
