// Daur hidup laporan hukuman disiplin dari UPT (ADR-016).
//
// Jalankan: node --import tsx --test lib/laporanHukdis.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  LAPORAN_HUKDIS_DIPEGANG_UPT,
  STATUS_LAPORAN_HUKDIS,
  adaLaporanHukdisBerjalan,
  galatTanggalLaporanHukdis,
  kekuranganLaporanHukdis,
} from "./laporanHukdis";

test("laporan yang belum dicatat menutup pintu laporan kedua untuk pegawai yang sama", () => {
  // Satu SK yang dilaporkan dua kali membuat KGB pegawainya tergeser dua kali.
  for (const status of ["menunggu", "dikembalikan"]) {
    assert.equal(adaLaporanHukdisBerjalan([{ id: "l1", pegawaiId: "p1", status }], "p1"), true, status);
  }
  // Yang sudah dicatat membuka pintu lagi: pegawai bisa saja dihukum lagi di kemudian hari.
  assert.equal(adaLaporanHukdisBerjalan([{ id: "l1", pegawaiId: "p1", status: "diterima" }], "p1"), false);
  assert.equal(adaLaporanHukdisBerjalan([{ id: "l1", pegawaiId: "p2", status: "menunggu" }], "p1"), false);
  assert.equal(adaLaporanHukdisBerjalan([], "p1"), false);
});

test("kiriman ulang tidak dihalangi oleh laporan yang digantikannya", () => {
  const lama = [{ id: "l1", pegawaiId: "p1", status: "dikembalikan" }];
  assert.equal(adaLaporanHukdisBerjalan(lama, "p1", "l1"), false);
  // Tetapi laporan berjalan lain untuk pegawai itu tetap menghalangi.
  assert.equal(adaLaporanHukdisBerjalan([...lama, { id: "l2", pegawaiId: "p1", status: "menunggu" }], "p1", "l1"), true);
});

test("status yang dipegang UPT sama dengan yang boleh dibatalkan sendiri", () => {
  assert.deepEqual([...LAPORAN_HUKDIS_DIPEGANG_UPT], ["menunggu", "dikembalikan"]);
  const nada = Object.values(STATUS_LAPORAN_HUKDIS).map((s) => s.nada);
  assert.equal(new Set(nada).size, nada.length);
});

test("kelengkapan menagih jenis, SK, TMT mulai, dan pindaian SK; TMT berakhir tidak", () => {
  assert.deepEqual(kekuranganLaporanHukdis({}), [
    "jenis hukuman",
    "nomor SK",
    "tanggal SK",
    "TMT mulai",
    "pindaian SK hukuman disiplin",
  ]);
  assert.deepEqual(
    kekuranganLaporanHukdis({
      jenisHukdis: "teguran_tertulis",
      nomorSK: "W.17-KP.04.01-12",
      tanggalSK: "2026-09-01",
      tmtMulai: "2026-09-01",
      adaBerkas: true,
    }),
    [],
  );
  assert.deepEqual(kekuranganLaporanHukdis({ jenisHukdis: " ", nomorSK: "  ", tanggalSK: "bukan", tmtMulai: "2026-09-01", adaBerkas: true }), [
    "jenis hukuman",
    "nomor SK",
    "tanggal SK",
  ]);
});

test("TMT berakhir sebelum TMT mulai ditolak", () => {
  assert.equal(galatTanggalLaporanHukdis({ tmtMulai: "2026-09-01", tmtBerakhir: "2026-08-31" }), "TMT berakhir tidak boleh sebelum TMT mulai.");
  assert.equal(galatTanggalLaporanHukdis({ tmtMulai: "2026-09-01", tmtBerakhir: "2026-09-01" }), null);
  assert.equal(galatTanggalLaporanHukdis({ tmtMulai: "2026-09-01" }), null);
});

/*
 * Penjaga batas wewenang (ADR-016, ditegaskan ADR-039).
 *
 * Hukuman disiplin dijatuhkan dengan SK pejabat berwenang, dan di dalam SIM-KGB hanya SDM Hukdis Kanwil
 * yang boleh mencatatnya serta menggeser jadwal KGB karenanya. Jalur UPT hanya menulis baris laporan.
 * Aturan itu tidak terbaca dari satu berkas mana pun, jadi diuji langsung pada sumber rutenya: sekali
 * ada yang menambahkan tulisan ke riwayat hukdis, ke pegawai, atau ke riwayat KGB dari jalur UPT,
 * uji ini gagal sebelum perubahannya sempat naik.
 */
test("rute hukdis Admin UPT hanya menulis laporan, tidak pernah mencatat hukuman atau menggeser KGB", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { join } = await import("node:path");

  const akar = join(__dirname, "..", "app", "api", "upt", "hukdis");
  const berkas: string[] = [];
  const telusuri = (dir: string) => {
    for (const entri of readdirSync(dir, { withFileTypes: true })) {
      const jalur = join(dir, entri.name);
      if (entri.isDirectory()) telusuri(jalur);
      else if (entri.name.endsWith(".ts")) berkas.push(jalur);
    }
  };
  telusuri(akar);
  assert.ok(berkas.length >= 2, "rute hukdis UPT tidak ditemukan; jalurnya mungkin berpindah");

  // Tabel yang tidak boleh ditulis dari jalur hukdis UPT. Data pegawai ikut dilarang: penanda hukdis
  // pada pegawai ditulis lib/catatHukdis.ts, milik Kanwil. Notifikasi dan audit sengaja tidak di sini,
  // sebab keduanya jejak, bukan penetapan.
  const terlarang = ["riwayatHukdis", "riwayatKGB", "suratKGB", "pegawai"];
  // Pencocokan teks biasa, bukan RegExp yang dirakit: pola berisi \. dan \b mudah rusak diam-diam saat
  // dirangkai di template literal, dan penjaga yang rusak justru lulus tanpa memeriksa apa pun.
  const menulis = ["create", "update", "delete", "createMany", "updateMany", "deleteMany"];
  for (const jalur of berkas) {
    const sumber = readFileSync(jalur, "utf8");
    for (const tabel of terlarang) {
      for (const aksi of menulis) {
        assert.ok(
          !sumber.includes(`db.${tabel}.${aksi}`),
          `${jalur} memanggil db.${tabel}.${aksi}; mencatat hukdis, mengubah pegawai, dan menggeser KGB adalah wewenang Kanwil`,
        );
      }
    }
    // Yang boleh ditulis dari sini hanya baris laporannya sendiri.
    assert.ok(sumber.includes("db.laporanHukdis."), `${jalur} tidak menyentuh laporanHukdis; jalurnya mungkin berubah`);
  }
});
