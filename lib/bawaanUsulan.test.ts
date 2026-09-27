// Bawaan usulan perbaikan: SK dasar dan berkas yang sudah disetujui Kanwil ikut ke usulan berikutnya.
//
// Jalankan: node --import tsx --test lib/bawaanUsulan.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { bawaanPegawai, berkasPerluDisalin, denganBerkasBawaan } from "./bawaanUsulan";
import { kekuranganUsulan } from "./usulanPegawai";
import type { UsulanPegawaiRow } from "./sheets/tables";

const usulan = (isi: Partial<UsulanPegawaiRow>): UsulanPegawaiRow => ({ ...isi }) as UsulanPegawaiRow;

const baru = usulan({
  id: "u1", pegawaiId: "p1", status: "disetujui", jenis: "baru",
  pathSkCpns: "usulan/7_skCpns_1.pdf", pathSyaratCpns: null, pathBerkas: "usulan/7_berkas_1.pdf",
  nomorSkTerakhir: "W.19-KP.02.01-123", tanggalSkTerakhir: new Date(2025, 5, 1),
  ditinjauAt: new Date(2025, 6, 1),
});

test("berkas dan SK CPNS dari usulan pegawai baru yang disetujui ikut terbawa", () => {
  const b = bawaanPegawai({ id: "p1" }, [baru]);
  assert.equal(b.nomorSkTerakhir, "W.19-KP.02.01-123");
  assert.deepEqual(b.berkas.pathSkCpns, { jalur: "usulan/7_skCpns_1.pdf", usulanId: "u1" });
  // Surat usulan Srikandi milik pengajuannya, bukan milik pegawai.
  assert.equal("pathBerkas" in b.berkas, false);
});

test("SK dasar pada data pegawai didahulukan daripada usulan lama", () => {
  const b = bawaanPegawai({ id: "p1", nomorSkDasar: "SK-KGB-2027", tanggalSkDasar: new Date(2027, 0, 5) }, [baru]);
  assert.equal(b.nomorSkTerakhir, "SK-KGB-2027");
});

test("usulan yang belum disetujui atau milik pegawai lain tidak menjadi bawaan", () => {
  const draf = usulan({ ...baru, id: "u2", status: "draf", pathSkCpns: "usulan/draf.pdf" });
  const lain = usulan({ ...baru, id: "u3", pegawaiId: "p2", pathSkCpns: "usulan/lain.pdf" });
  const b = bawaanPegawai({ id: "p1" }, [draf, lain]);
  assert.deepEqual(b.berkas, {});
  assert.equal(b.nomorSkTerakhir, null);
});

test("berkas terbaru per jenis yang dipakai", () => {
  const perbaikan = usulan({
    id: "u4", pegawaiId: "p1", status: "disetujui", jenis: "perubahan",
    pathSkCpns: "usulan/7_skCpns_2.pdf", ditinjauAt: new Date(2026, 0, 1),
  });
  const b = bawaanPegawai({ id: "p1" }, [baru, perbaikan]);
  assert.equal(b.berkas.pathSkCpns?.jalur, "usulan/7_skCpns_2.pdf");
  // Nomor SK tetap dari usulan yang memuatnya.
  assert.equal(b.nomorSkTerakhir, "W.19-KP.02.01-123");
});

test("hanya berkas keadaan pegawai yang kosong dan tidak dihapus yang disalin", () => {
  const b = bawaanPegawai({ id: "p1" }, [baru]);
  assert.deepEqual(berkasPerluDisalin({}, b, false).map((x) => x.kunci), ["pathSkCpns"]);
  assert.deepEqual(berkasPerluDisalin({ pathSkCpns: "usulan/baru.pdf" }, b, false), []);
  assert.deepEqual(berkasPerluDisalin({}, b, false, new Set(["skCpns"])), []);
  // Sudah pernah KGB: SK CPNS tidak diminta, jadi tidak disalin.
  assert.deepEqual(berkasPerluDisalin({}, b, true), []);
});

test("berkas bawaan melengkapi kekurangan usulan perbaikan dasar gaji", () => {
  const pegawai = { golonganRuang: "II/a", mkgTahun: 0, mkgBulan: 0, tmtKgbTerakhir: new Date(2025, 5, 1) };
  const perbaikan = { golonganRuang: "II/a", tmtKgbTerakhir: new Date(2025, 2, 1) };
  assert.ok(kekuranganUsulan(perbaikan, "perubahan", pegawai).includes("SK CPNS"));
  const b = bawaanPegawai({ id: "p1" }, [baru]);
  assert.deepEqual(kekuranganUsulan(denganBerkasBawaan(perbaikan, b), "perubahan", pegawai), []);
});
