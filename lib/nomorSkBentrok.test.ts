// Nomor SK dari arsiparis hanya untuk satu SK KGB; KGB yang dibatalkan melepaskan nomornya (ADR-056).
//
// Jalankan: node --import tsx --test lib/nomorSkBentrok.test.ts

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

async function denganDataLokal(kerja: () => Promise<void>) {
  const folder = await mkdtemp(path.join(tmpdir(), "simkgb-nomor-"));
  const simpan = { backend: process.env.DATA_BACKEND, berkas: process.env.DATA_LOKAL_BERKAS };
  process.env.DATA_BACKEND = "lokal";
  process.env.DATA_LOKAL_BERKAS = path.join(folder, "uji.json");
  try {
    const { ALL_DEFS } = await import("./sheets/tables");
    const { sinkronkanHeader } = await import("./sheets/sinkronHeader");
    await sinkronkanHeader(ALL_DEFS, true);
    await kerja();
  } finally {
    process.env.DATA_BACKEND = simpan.backend;
    process.env.DATA_LOKAL_BERKAS = simpan.berkas;
    await rm(folder, { recursive: true, force: true });
  }
}

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(Date.UTC(tahun, bulan - 1, hari));

test("nomor SK yang dipesan atau dipakai KGB batal boleh dipakai Input Ulang; KGB aktif tetap memegangnya", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { makeRiwayatKGB } = await import("./sheets/tables");
    const { nomorSkBentrok } = await import("./nomorSkBentrok");
    await db.pegawai.create({
      id: "p1", nip: "199001012015031001", nama: "PEGAWAI UJI", tempatLahir: null, tanggalLahir: null,
      jenisKelamin: null, pendidikanTerakhir: null, jabatan: "Penjaga Tahanan", pangkat: "Pengatur Muda",
      golonganRuang: "II/a", unitKerja: "Kantor Wilayah", eselon: null, jenisJabatan: null,
      tmtGolongan: tgl(2025, 6), mkgTahun: 0, mkgBulan: 0, gajiPokok: 2184000,
      tmtKgbTerakhir: tgl(2025, 6), tmtKgbBerikutnya: tgl(2026, 6), statusHukdis: false,
      tanggalHukdisBerakhir: null, jenisHukdis: null, keteranganHukdis: null, aktif: true,
      createdAt: new Date(), updatedAt: new Date(), konfirmasiUptTmt: null, konfirmasiUptAt: null,
      konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null, berhentiAlasan: null,
      nomorSkDasar: null, tanggalSkDasar: null, penetapSkDasar: null,
    });
    const kgb = (id: string, status: string, drafNomorSurat: string | null) =>
      makeRiwayatKGB({
        id, pegawaiId: "p1", nomorSK: "SK-CPNS", tanggalSK: tgl(2025, 5), tmtSK: tgl(2025, 6), golonganLama: "II/a",
        gajiPokokLama: 2184000, mkgTahunLama: 0, mkgBulanLama: 0, golonganBaru: "II/a", gajiPokokBaru: 2250000,
        mkgTahunBaru: 1, mkgBulanBaru: 0, tmtKgbBaru: tgl(2026, 6), tmtKgbBerikutnya: tgl(2028, 6), status,
        drafNomorSurat, createdAt: tgl(2026, 4, 1),
      });
    await db.riwayatKGB.create(kgb("batal", "ditolak", "WP.19-SA.04.04-777"));
    await db.suratKGB.create({
      id: "s-batal", kgbId: "batal", nomorSurat: "WP.19-SA.04.04-778", tanggalSurat: tgl(2026, 4, 10),
      namaKepalaKanwil: "-", nipKepalaKanwil: "-", pathFile: null, generatedAt: new Date(), generatedBy: "u1",
    });
    await db.riwayatKGB.create(kgb("ulang", "sedang_diproses", null));
    assert.equal(await nomorSkBentrok("WP.19-SA.04.04-777", "ulang"), null, "draf milik KGB batal");
    assert.equal(await nomorSkBentrok("WP.19-SA.04.04- 778", "ulang"), null, "surat milik KGB batal");

    await db.riwayatKGB.create(kgb("aktif", "sedang_diproses", "WP.19-SA.04.04-900"));
    assert.match((await nomorSkBentrok("WP.19-SA.04.04-900", "ulang")) ?? "", /sudah disimpan sebagai draf/);
  });
});
