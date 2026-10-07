// Draf laporan SK KP/PI/PMK dibaca kembali (ADR-074, ADR-078).
//
// Jalankan: node --import tsx --test app/dashboard/components/upt/laporSkKirim.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { isianDariDraf, keadaanInduk, keadaanTercatat } from "./laporSkKirim";
import type { DrafUsulanUpt, PegawaiUntukUsulan } from "./FormulirUsulan";

const pegawai: PegawaiUntukUsulan = {
  id: "p1",
  nama: "PEGAWAI UJI",
  nip: "199001012015031001",
  dataSekarang: { golonganRuang: "II/b", mkgTahun: "7", mkgBulan: "0", tmtKgbTerakhir: "2024-12-01" },
};

const draf = (isi: Partial<DrafUsulanUpt>): DrafUsulanUpt => ({
  id: "u1", jenis: "perubahan", nama: "PEGAWAI UJI", nip: "199001012015031001", nilai: null, surat: null, hukdis: null, berkas: [],
  dasarBaru: { jenis: "kp", jenisKp: "penyesuaian_ijazah", nomorSk: "SK-PI", tanggalSk: "2026-01-29", tmt: "2026-02-01", penetap: "" },
  ...isi,
});

test("draf ber-acuan: masa kerja menurut SK kenaikan pangkat dibaca kembali, keadaan berkas dari SK KGB terakhir", () => {
  const d = draf({
    nilai: { golonganRuang: "III/a", mkgTahun: "3", mkgBulan: "2", tmtKgbTerakhir: "2024-12-01" },
    acuan: { golongan: "II/b", mkgTahun: "7", mkgBulan: "0" },
  });
  const isi = isianDariDraf(d);
  assert.equal(isi.golonganBaru, "III/a");
  assert.equal(isi.mkgTahunSk, "3");
  assert.equal(isi.mkgBulanSk, "2");
  assert.deepEqual(keadaanTercatat(pegawai, d), { golongan: "II/b", mkgTahun: 7, mkgBulan: 0, tmtKgbTerakhir: "2024-12-01" });
  assert.equal(keadaanInduk(pegawai, d).golongan, "II/b");
});

test("draf lama kenaikan pangkat: masa kerja di isian utama adalah masa kerja tercatat, jadi tidak dianggap angka SK", () => {
  const d = draf({ nilai: { golonganRuang: "III/a", mkgTahun: "7", mkgBulan: "0", tmtKgbTerakhir: "2024-12-01" } });
  const isi = isianDariDraf(d);
  assert.equal(isi.golonganBaru, "III/a");
  assert.equal(isi.mkgTahunSk, "");
  // PMK lama tetap membaca masa kerja menurut SK dari isian utama.
  const pmk = isianDariDraf(draf({ nilai: { mkgTahun: "9", mkgBulan: "4" }, dasarBaru: { jenis: "pmk", jenisKp: "", nomorSk: "P", tanggalSk: "", tmt: "", penetap: "" } }));
  assert.equal(pmk.mkgTahunSk, "9");
});
