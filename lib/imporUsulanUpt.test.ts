// Pemeriksaan berkas unggahan massal UPT: baris mana yang diterima, mana yang ditolak, dan mengapa.
//
// Jalankan: node --import tsx --test lib/imporUsulanUpt.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { KOLOM_IMPOR_UPT, periksaImporUpt, ringkasImpor, templatCsvUpt } from "./imporUsulanUpt";

const kosong = { nipPegawai: new Set<string>(), nipUsulan: new Set<string>() };

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

test("baris lengkap diterima, dan kolom hitungan tidak dibaca dari berkas", () => {
  const [h] = periksaImporUpt([baris({ gajiPokok: "9999999", tmtKgbBerikutnya: "2099-01-01" })], kosong);
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
  assert.equal(h.galat, null);
  assert.deepEqual(h.kurang, ["golongan/ruang", "TMT KGB terakhir", "SK CPNS"]);
});

test("NIP yang tidak sah, kembar, atau sudah dipakai ditolak satu per satu", () => {
  const hasil = periksaImporUpt(
    [
      baris({ nip: "123" }),
      baris({ nip: "200509182025062002" }),
      baris({ nip: "200509182025062002" }),
      baris({ nip: "198809042025062014" }),
      baris({ nip: "200409072025061002" }),
      baris({ nama: "" }),
    ],
    { nipPegawai: new Set(["198809042025062014"]), nipUsulan: new Set(["200409072025061002"]) },
  );
  assert.deepEqual(
    hasil.map((h) => h.galat),
    [
      "NIP harus tepat 18 digit angka",
      null,
      "NIP ini muncul lebih dari sekali pada berkas",
      "NIP sudah tercatat sebagai pegawai",
      "NIP sudah ada pada usulan yang belum selesai",
      "Nama lengkap wajib diisi",
    ],
  );
  // Nomor barisnya ikut dilaporkan supaya operator tahu baris mana yang harus dibetulkan.
  assert.deepEqual(hasil.map((h) => h.baris), [1, 2, 3, 4, 5, 6]);
});

test("NIP yang disimpan Excel sebagai rumus teks tetap terbaca", () => {
  // Excel mengubah 18 angka menjadi notasi ilmiah, jadi operator kerap menyimpannya sebagai ="...".
  const [h] = periksaImporUpt([baris({ nip: '="200509182025062002"' })], kosong);
  assert.equal(h.galat, null);
  assert.equal(h.nip, "200509182025062002");
});

test("tanggal yang tidak sah menolak barisnya, bukan seluruh berkas", () => {
  const hasil = periksaImporUpt([baris({ tmtGolongan: "01/06/2025x" }), baris({ nip: "200409072025061002" })], kosong);
  assert.match(hasil[0].galat ?? "", /TMT golongan tidak valid/);
  assert.equal(hasil[1].galat, null);
});

test("ringkasan memisahkan yang gagal dari yang sekadar belum lengkap", () => {
  const hasil = periksaImporUpt(
    [baris(), baris({ nip: "200409072025061002", golonganRuang: "" }), baris({ nip: "123" })],
    kosong,
  );
  assert.deepEqual(ringkasImpor(hasil), { sah: 2, gagal: 1, belumLengkap: 2 });
});

test("templat yang diunduh terbaca kembali: kepalanya lengkap dan yang kurang dari baris contohnya hanya berkas", () => {
  const [kepala, contoh] = templatCsvUpt().replace(/^\uFEFF/, "").trim().split("\r\n").map((b) => b.split(","));
  for (const k of KOLOM_IMPOR_UPT) assert.ok(kepala.includes(k), `kolom ${k} ada di templat`);
  const row = Object.fromEntries(kepala.map((k, i) => [k, contoh[i]]));
  const [h] = periksaImporUpt([row], kosong);
  assert.equal(h.galat, null);
  assert.deepEqual(h.kurang, ["SK CPNS"]);
});

test("tanggal dd/mm/yyyy dari Excel berlokal Indonesia dibaca sama dengan yyyy-mm-dd", () => {
  const [h] = periksaImporUpt([baris({ tmtGolongan: "01/06/2025", tmtKgbTerakhir: "1/6/2025" })], kosong);
  assert.equal(h.galat, null);
  assert.deepEqual(h.isian?.tmtKgbTerakhir, new Date(Date.UTC(2025, 5, 1)));
  assert.deepEqual(h.isian?.tmtGolongan, new Date(Date.UTC(2025, 5, 1)));
});

test("NIP pada isian dibaca dan diperiksa bersama isian lain", async () => {
  const { bacaIsianBaris } = await import("./usulanFormulir");
  const sah = bacaIsianBaris({ nip: '="200509182025062002"' });
  assert.ok("isian" in sah && sah.isian.nip === "200509182025062002");
  assert.deepEqual(bacaIsianBaris({ nip: "12345" }), { galat: "NIP harus tepat 18 digit angka" });
});
