// Langkah isian data pegawai Admin UPT (ADR-083).
//
// Jalankan: node --import tsx --test app/dashboard/components/upt/langkahIsian.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { cekIsianPegawai, keadaanLangkah, langkahAwal } from "./langkahIsian";

const dasar = {
  jenis: "baru",
  nama: "CPNS UJI",
  nip: "200001012025031001",
  jabatan: "Penjaga Tahanan",
  pernah: false,
  golongan: "II/c",
  mkgTahun: "3",
  tmtAcuan: "2025-03-01",
  nomorSkAcuan: "SK-CPNS-1",
  tanggalSkAcuan: "2025-02-20",
  penetapSkAcuan: "Menteri Imigrasi dan Pemasyarakatan",
  jawaban: "tidak" as const,
  perluSebab: false,
  kurangDasar: [],
  dasarJenis: "tidak",
  golonganSk: "",
  mkgTahunSk: "",
  galatSesudahSk: null,
  berkas: [{ label: "SK CPNS", langkah: 3 as const, ada: true }],
};

test("pegawai baru yang lengkap: semua langkah lengkap, dibuka di Periksa & simpan", () => {
  const cek = cekIsianPegawai(dasar);
  for (const n of [1, 2, 3, 4, 5] as const) assert.equal(keadaanLangkah(cek, n), "lengkap", `langkah ${n}`);
  assert.equal(langkahAwal(cek), 5);
});

test("yang kurang ditandai di langkahnya, dan draf dibuka di langkah pertama yang kurang", () => {
  const cek = cekIsianPegawai({
    ...dasar,
    jabatan: "",
    jawaban: null,
    berkas: [{ label: "SK CPNS", langkah: 3, ada: false }],
  });
  assert.equal(keadaanLangkah(cek, 1), "lengkap");
  assert.equal(keadaanLangkah(cek, 2), "kurang");
  assert.equal(keadaanLangkah(cek, 3), "kurang");
  assert.equal(keadaanLangkah(cek, 4), "kurang");
  assert.equal(keadaanLangkah(cek, 5), "kurang");
  assert.equal(langkahAwal(cek), 2);
  assert.deepEqual(
    cek.filter((c) => !c.ok).map((c) => [c.langkah, c.label]),
    [[2, "jabatan"], [4, "jawaban SK sesudah SK CPNS"], [3, "SK CPNS"]],
  );
});

test("perbaikan data: identitas dan jabatan tidak wajib; SK yang dilaporkan menagih isian dan berkasnya di langkah 4", () => {
  const cek = cekIsianPegawai({
    ...dasar,
    jenis: "perubahan",
    nama: "",
    nip: "",
    jabatan: "",
    pernah: true,
    golongan: "II/b",
    mkgTahun: "7",
    jawaban: "ada",
    dasarJenis: "kp",
    golonganSk: "",
    mkgTahunSk: "3",
    berkas: [
      { label: "SK KGB terakhir", langkah: 3, ada: true },
      { label: "SK kenaikan pangkat", langkah: 4, ada: false },
    ],
  });
  assert.equal(keadaanLangkah(cek, 1), "lengkap");
  assert.equal(keadaanLangkah(cek, 2), "lengkap");
  assert.equal(keadaanLangkah(cek, 3), "lengkap");
  assert.deepEqual(
    cek.filter((c) => !c.ok).map((c) => c.label),
    ["golongan baru menurut SK kenaikan pangkat", "SK kenaikan pangkat"],
  );
  assert.equal(langkahAwal(cek), 4);
});

test("pejabat penetap SK acuan wajib di langkah 3 (ADR-086)", () => {
  const cek = cekIsianPegawai({ ...dasar, penetapSkAcuan: " " });
  assert.equal(keadaanLangkah(cek, 3), "kurang");
  assert.deepEqual(cek.filter((c) => !c.ok).map((c) => [c.langkah, c.label]), [[3, "pejabat penetap SK CPNS"]]);
  const pernah = cekIsianPegawai({ ...dasar, pernah: true, mkgTahun: "7", penetapSkAcuan: "" });
  assert.ok(pernah.some((c) => !c.ok && c.label === "pejabat penetap SK KGB terakhir"));
});
