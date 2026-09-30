// Pemeriksaan berkas unggahan massal UPT: baris mana yang menjadi pegawai baru, mana yang menjadi usulan
// perbaikan, mana yang dilewati karena sama, dan mana yang ditolak beserta sebabnya.
//
// Jalankan: node --import tsx --test lib/imporUsulanUpt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KOLOM_IMPOR_UPT,
  dapatDisimpan,
  periksaImporUpt,
  ringkasImpor,
  templatCsvUpt,
  type KonteksImpor,
} from "./imporUsulanUpt";
import type { PegawaiRow } from "./sheets/tables";

const kosong: KonteksImpor = {
  pegawaiSatker: new Map(),
  satkerLain: new Map(),
  nipUsulan: new Set(),
  pegawaiIdUsulan: new Set(),
};

const konteks = (p: Partial<KonteksImpor>): KonteksImpor => ({ ...kosong, ...p });

const baris = (p: Record<string, unknown> = {}) => ({
  nip: "200509182025062002",
  nama: "DERA KALISTANINGSIH",
  jabatan: "Penjaga Tahanan",
  golonganRuang: "II/a",
  tmtGolongan: "2025-06-01",
  mkgTahun: "0",
  mkgBulan: "0",
  tmtKgbTerakhir: "2025-06-01",
  ...p,
});

/** Pegawai tercatat yang isinya sama persis dengan baris() di atas. */
const pegawai = (p: Partial<PegawaiRow> = {}): PegawaiRow => ({
  id: "p1",
  nip: "200509182025062002",
  nama: "DERA KALISTANINGSIH",
  tempatLahir: null,
  tanggalLahir: null,
  jenisKelamin: null,
  pendidikanTerakhir: null,
  jabatan: "Penjaga Tahanan",
  pangkat: "Pengatur Muda",
  golonganRuang: "II/a",
  unitKerja: "Rumah Tahanan Negara Kelas IIB Rantau",
  eselon: null,
  jenisJabatan: null,
  tmtGolongan: new Date(Date.UTC(2025, 5, 1)),
  mkgTahun: 0,
  mkgBulan: 0,
  gajiPokok: 0,
  tmtKgbTerakhir: new Date(Date.UTC(2025, 5, 1)),
  tmtKgbBerikutnya: null,
  statusHukdis: false,
  tanggalHukdisBerakhir: null,
  jenisHukdis: null,
  keteranganHukdis: null,
  aktif: true,
  createdAt: null,
  updatedAt: null,
  konfirmasiUptTmt: null,
  konfirmasiUptAt: null,
  konfirmasiUptOleh: null,
  satkerTugas: null,
  berhentiTmt: null,
  berhentiAlasan: null,
  nomorSkDasar: null,
  tanggalSkDasar: null,
  penetapSkDasar: null,
  ...p,
});

const perNip = (...daftar: PegawaiRow[]) => new Map(daftar.map((p) => [p.nip, p]));

test("baris lengkap diterima sebagai pegawai baru, dan kolom hitungan tidak dibaca dari berkas", () => {
  const [h] = periksaImporUpt([baris({ gajiPokok: "9999999", tmtKgbBerikutnya: "2099-01-01" })], kosong);
  assert.equal(h.hasil, "baru");
  assert.equal(h.galat, null);
  // Berkas tidak lewat CSV, jadi draf hasil unggahan selalu masih menunggu lampirannya.
  assert.deepEqual(h.kurang, ["SK CPNS"]);
  assert.equal(h.nama, "DERA KALISTANINGSIH");
  // Gaji pokok dan jatuh tempo dihitung sistem, bukan disalin dari berkas: satu salah ketik di
  // kolom itu langsung menggeser uang.
  assert.equal("gajiPokok" in (h.isian ?? {}), false);
  assert.equal("tmtKgbBerikutnya" in (h.isian ?? {}), false);
});

test("baris yang belum lengkap tetap diterima sebagai draf, hanya ditandai", () => {
  const [h] = periksaImporUpt([baris({ golonganRuang: "", tmtKgbTerakhir: "" })], kosong);
  assert.equal(h.hasil, "baru");
  assert.deepEqual(h.kurang, ["golongan/ruang", "TMT KGB terakhir", "SK CPNS"]);
});

test("NIP yang sudah tercatat di satker ini menjadi usulan perbaikan, bukan ditolak", () => {
  const [h] = periksaImporUpt(
    [baris({ golonganRuang: "II/b", mkgTahun: "3" })],
    konteks({ pegawaiSatker: perNip(pegawai()) }),
  );
  assert.equal(h.hasil, "perubahan");
  assert.equal(h.galat, null);
  assert.equal(h.pegawaiId, "p1");
  assert.equal(h.namaTercatat, "DERA KALISTANINGSIH");
  // Hanya kolom yang benar-benar berbeda yang dilaporkan, lama berdampingan dengan baru.
  assert.deepEqual(
    h.beda.map((b) => [b.kunci, b.sekarang, b.diusulkan]),
    [
      ["golonganRuang", "II/a", "II/b"],
      ["mkgTahun", "0", "3"],
    ],
  );
});

test("baris yang isinya sama persis dengan data tercatat dilewati, tidak menjadi usulan", () => {
  const hasil = periksaImporUpt([baris()], konteks({ pegawaiSatker: perNip(pegawai()) }));
  assert.equal(hasil[0].hasil, "sama");
  assert.equal(hasil[0].pegawaiId, "p1");
  assert.deepEqual(hasil[0].beda, []);
  // Yang sama tidak ikut disimpan: tidak ada yang perlu diusulkan.
  assert.deepEqual(dapatDisimpan(hasil), []);
});

test("perbaikan yang menyentuh dasar gaji tetap menagih berkas SK dan sebab perubahannya", () => {
  const [h] = periksaImporUpt([baris({ golonganRuang: "II/b" })], konteks({ pegawaiSatker: perNip(pegawai()) }));
  assert.equal(h.hasil, "perubahan");
  // CSV tidak membawa pindaian maupun nomor SK, jadi draf ini belum boleh diajukan sebelum dilengkapi.
  assert.ok(h.kurang.length > 0, "perbaikan dasar gaji harus menyisakan kekurangan");
  assert.ok(h.kurang.some((k) => /SK/i.test(k)), `kekurangan menyebut SK: ${h.kurang.join(", ")}`);
});

test("perbaikan yang tidak menyentuh dasar gaji tidak menagih berkas", () => {
  const [h] = periksaImporUpt([baris({ jabatan: "Kepala Subseksi" })], konteks({ pegawaiSatker: perNip(pegawai()) }));
  assert.equal(h.hasil, "perubahan");
  assert.deepEqual(h.beda.map((b) => b.kunci), ["jabatan"]);
  assert.deepEqual(h.kurang, []);
});

test("pegawai satker lain ditolak dengan menyebut satkernya", () => {
  const [h] = periksaImporUpt(
    [baris()],
    konteks({ satkerLain: new Map([["200509182025062002", "Lembaga Pemasyarakatan Kelas IIA Banjarmasin"]]) }),
  );
  assert.equal(h.hasil, "ditolak");
  assert.equal(
    h.galat,
    "NIP ini tercatat di Lembaga Pemasyarakatan Kelas IIA Banjarmasin. Mintakan pemindahannya lewat Kanwil.",
  );
});

test("pegawai yang sedang punya usulan berjalan ditolak walau usulan itu tidak menyimpan NIP", () => {
  // Usulan perbaikan menyimpan pegawaiId dan mengosongkan NIP, jadi pemeriksaan NIP saja tidak menjaringnya.
  const [h] = periksaImporUpt(
    [baris()],
    konteks({ pegawaiSatker: perNip(pegawai()), pegawaiIdUsulan: new Set(["p1"]) }),
  );
  assert.equal(h.hasil, "ditolak");
  assert.equal(h.galat, "Pegawai ini sedang punya usulan yang belum selesai di Kanwil");
});

test("NIP yang tidak sah, kembar, atau sudah diusulkan sebagai pegawai baru ditolak satu per satu", () => {
  const hasil = periksaImporUpt(
    [
      baris({ nip: "123" }),
      baris({ nip: "200509182025062002" }),
      baris({ nip: "200509182025062002" }),
      baris({ nip: "200409072025061002" }),
      baris({ nama: "" }),
    ],
    konteks({ nipUsulan: new Set(["200409072025061002"]) }),
  );
  assert.match(hasil[0].galat ?? "", /18 digit angka/);
  assert.deepEqual(
    hasil.slice(1).map((h) => h.galat),
    [
      null,
      "NIP ini muncul lebih dari sekali pada berkas",
      "NIP ini sudah ada pada usulan pegawai baru yang belum selesai",
      "Nama lengkap wajib diisi",
    ],
  );
  // Nomor barisnya ikut dilaporkan supaya operator tahu baris mana yang harus dibetulkan.
  assert.deepEqual(hasil.map((h) => h.baris), [1, 2, 3, 4, 5]);
});

test("NIP yang dirusak Excel ditolak, meskipun panjangnya tetap 18 digit", () => {
  // 197112051998031004 yang disimpan Excel menjadi angka pembulatan. Sebelum lib/nipPns.ts, baris ini
  // lolos sebagai pegawai baru ber-NIP palsu karena /^\d{18}$/ meloloskannya.
  const [h] = periksaImporUpt([baris({ nip: "197112000000000000" })], kosong);
  assert.equal(h.hasil, "ditolak");
  assert.match(h.galat ?? "", /Excel/);
  assert.match(h.galat ?? "", /From Text\/CSV/);
});

test("NIP yang masih berbentuk notasi ilmiah disebut sebabnya", () => {
  const [h] = periksaImporUpt([baris({ nip: "1,97E+17" })], kosong);
  assert.equal(h.hasil, "ditolak");
  assert.match(h.galat ?? "", /notasi ilmiah/);
});

test("NIP yang disimpan Excel sebagai rumus teks tetap terbaca", () => {
  // Excel mengubah 18 angka menjadi notasi ilmiah, jadi operator kerap menyimpannya sebagai rumus teks.
  const [h] = periksaImporUpt([baris({ nip: '="200509182025062002"' })], kosong);
  assert.equal(h.hasil, "baru");
  assert.equal(h.nip, "200509182025062002");
});

test("tanggal yang tidak sah menolak barisnya, bukan seluruh berkas", () => {
  const hasil = periksaImporUpt([baris({ tmtGolongan: "01/06/2025x" }), baris({ nip: "200409072025061002" })], kosong);
  assert.match(hasil[0].galat ?? "", /TMT golongan tidak valid/);
  assert.equal(hasil[1].galat, null);
});

test("ringkasan memisahkan pegawai baru, perbaikan, yang sama, dan yang ditolak", () => {
  const hasil = periksaImporUpt(
    [
      baris(),
      baris({ nip: "200409072025061002", golonganRuang: "" }),
      baris({ nip: "198809042025062014", jabatan: "Kepala Subseksi" }),
      baris({ nip: "199001012025061001" }),
      baris({ nip: "123" }),
    ],
    konteks({
      pegawaiSatker: perNip(
        pegawai({ id: "p2", nip: "198809042025062014" }),
        pegawai({ id: "p3", nip: "199001012025061001" }),
      ),
    }),
  );
  assert.deepEqual(hasil.map((h) => h.hasil), ["baru", "baru", "perubahan", "sama", "ditolak"]);
  assert.deepEqual(ringkasImpor(hasil), { baru: 2, perubahan: 1, sama: 1, ditolak: 1, belumLengkap: 2 });
  assert.deepEqual(dapatDisimpan(hasil).map((h) => h.baris), [1, 2, 3]);
});

test("templat yang diunduh terbaca kembali: kepalanya lengkap dan yang kurang dari baris contohnya hanya berkas", () => {
  const [kepala, contoh] = templatCsvUpt().replace(/^﻿/, "").trim().split("\r\n").map((b) => b.split(","));
  for (const k of KOLOM_IMPOR_UPT) assert.ok(kepala.includes(k), `kolom ${k} ada di templat`);
  const row = Object.fromEntries(kepala.map((k, i) => [k, contoh[i]]));
  const [h] = periksaImporUpt([row], kosong);
  assert.equal(h.hasil, "baru");
  assert.deepEqual(h.kurang, ["SK CPNS"]);
});

test("tanggal dd/mm/yyyy dari Excel berlokal Indonesia dibaca sama dengan yyyy-mm-dd", () => {
  const [h] = periksaImporUpt([baris({ tmtGolongan: "01/06/2025", tmtKgbTerakhir: "1/6/2025" })], kosong);
  assert.equal(h.hasil, "baru");
  assert.deepEqual(h.isian?.tmtKgbTerakhir, new Date(Date.UTC(2025, 5, 1)));
  assert.deepEqual(h.isian?.tmtGolongan, new Date(Date.UTC(2025, 5, 1)));
});

test("NIP pada isian dibaca dan diperiksa bersama isian lain", async () => {
  const { bacaIsianBaris } = await import("./usulanFormulir");
  const sah = bacaIsianBaris({ nip: '="200509182025062002"' });
  assert.ok("isian" in sah && sah.isian.nip === "200509182025062002");
  assert.deepEqual(bacaIsianBaris({ nip: "12345" }), { galat: "NIP harus tepat 18 digit angka" });
});
