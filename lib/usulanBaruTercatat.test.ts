// Usulan pegawai baru yang NIP-nya sudah tercatat (ADR-091).
//
// Jalankan: node --import tsx --test lib/usulanBaruTercatat.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { jadikanPerbaikan, kolomJadiPerbaikan, nipBaruTercatat } from "./usulanBaruTercatat";
import type { UsulanPegawaiRow } from "./sheets/tables";

const NIP = "199001012015031001";
const pegawai = { id: "p1", nip: NIP, unitKerja: "Rutan Kelas IIB Rantau" };
const usulan = { jenis: "baru", satker: "rutan-rantau", nip: NIP };

test("NIP pegawai baru yang tercatat di satker yang sama atau di satker lain", () => {
  assert.equal(nipBaruTercatat(usulan, pegawai), "satker_sama");
  assert.equal(nipBaruTercatat({ ...usulan, satker: "lapas-perempuan-martapura" }, pegawai), "satker_lain");
  assert.equal(nipBaruTercatat({ ...usulan, nip: ` ${NIP} ` }, pegawai), "satker_sama", "spasi di tepi diabaikan");
});

test("bukan usulan pegawai baru, NIP belum tercatat, atau NIP berbeda: tidak ada yang perlu diubah", () => {
  assert.equal(nipBaruTercatat({ ...usulan, jenis: "perubahan" }, pegawai), null);
  assert.equal(nipBaruTercatat(usulan, null), null);
  assert.equal(nipBaruTercatat({ ...usulan, nip: null }, pegawai), null);
  assert.equal(nipBaruTercatat(usulan, { ...pegawai, nip: "199001012015031002" }), null);
});

test("dijadikan perbaikan: jenis, pegawai, dan unit kerja berganti; isian lain tetap", () => {
  assert.deepEqual(kolomJadiPerbaikan(pegawai), { jenis: "perubahan", pegawaiId: "p1", unitKerja: null });
  const asal = { id: "u1", jenis: "baru", pegawaiId: null, unitKerja: "Rutan Kelas IIB Rantau", nip: NIP, nama: "PEGAWAI UJI" };
  const hasil = jadikanPerbaikan(asal as unknown as UsulanPegawaiRow, pegawai);
  assert.equal(hasil.jenis, "perubahan");
  assert.equal(hasil.pegawaiId, "p1");
  assert.equal(hasil.unitKerja, null);
  assert.equal(hasil.nip, NIP);
  assert.equal(hasil.nama, "PEGAWAI UJI");
  assert.equal(asal.jenis, "baru", "usulan asalnya tidak diubah");
});
