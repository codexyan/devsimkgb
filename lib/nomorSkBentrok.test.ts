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

/** Pegawai rekaan; id dan NIP dibedakan per pemanggilan. */
const pegawaiUji = (id: string, nip: string) => ({
  id, nip, nama: `PEGAWAI ${id.toUpperCase()}`, tempatLahir: null, tanggalLahir: null,
  jenisKelamin: null, pendidikanTerakhir: null, jabatan: "Penjaga Tahanan", pangkat: "Pengatur Muda",
  golonganRuang: "II/a", unitKerja: "Kantor Wilayah", eselon: null, jenisJabatan: null,
  tmtGolongan: tgl(2025, 6), mkgTahun: 0, mkgBulan: 0, gajiPokok: 2184000,
  tmtKgbTerakhir: tgl(2025, 6), tmtKgbBerikutnya: tgl(2026, 6), statusHukdis: false,
  tanggalHukdisBerakhir: null, jenisHukdis: null, keteranganHukdis: null, aktif: true,
  createdAt: new Date(), updatedAt: new Date(), konfirmasiUptTmt: null, konfirmasiUptAt: null,
  konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null, berhentiAlasan: null,
  nomorSkDasar: null, tanggalSkDasar: null, penetapSkDasar: null,
});

test("nomor SK hanya dipegang SK lain yang berlaku: KGB batal dan KGB lain milik pegawai yang sama melepaskannya", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { makeRiwayatKGB } = await import("./sheets/tables");
    const { nomorSkBentrok } = await import("./nomorSkBentrok");
    await db.pegawai.create(pegawaiUji("p1", "199001012015031001"));
    await db.pegawai.create(pegawaiUji("p2", "199002022015032002"));
    const kgb = (id: string, pegawaiId: string, status: string, drafNomorSurat: string | null) =>
      makeRiwayatKGB({
        id, pegawaiId, nomorSK: "SK-CPNS", tanggalSK: tgl(2025, 5), tmtSK: tgl(2025, 6), golonganLama: "II/a",
        gajiPokokLama: 2184000, mkgTahunLama: 0, mkgBulanLama: 0, golonganBaru: "II/a", gajiPokokBaru: 2250000,
        mkgTahunBaru: 1, mkgBulanBaru: 0, tmtKgbBaru: tgl(2026, 6), tmtKgbBerikutnya: tgl(2028, 6), status,
        drafNomorSurat, createdAt: tgl(2026, 4, 1),
      });
    const surat = (id: string, kgbId: string, nomorSurat: string, pathFile: string | null) =>
      db.suratKGB.create({
        id, kgbId, nomorSurat, tanggalSurat: tgl(2026, 4, 10), namaKepalaKanwil: "-", nipKepalaKanwil: "-",
        pathFile, generatedAt: new Date(), generatedBy: "u1",
      });

    // KGB yang sedang dibuat SK-nya (Input Ulang milik p1).
    await db.riwayatKGB.create(kgb("ulang", "p1", "sedang_diproses", null));

    // KGB batal: draf dan surat yang belum diunggah melepaskan nomornya.
    await db.riwayatKGB.create(kgb("batal", "p1", "ditolak", "WP.19-SA.04.04-1729"));
    await surat("s-batal", "batal", "WP.19-SA.04.04-778", null);
    assert.equal(await nomorSkBentrok("WP.19-SA.04.04-1729", "ulang"), null, "draf milik KGB batal");
    assert.equal(await nomorSkBentrok("WP.19-SA.04.04- 778", "ulang"), null, "surat milik KGB batal yang belum diunggah");

    // KGB lain milik pegawai yang sama, belum diunggah: SK yang sama yang dibuat ulang.
    await db.riwayatKGB.create(kgb("jadwal", "p1", "belum_diproses", "WP.19-SA.04.04-1730"));
    assert.equal(await nomorSkBentrok("WP.19-SA.04.04-1730", "ulang"), null, "draf KGB lain pegawai yang sama");

    // SK yang sudah diunggah bertanda tangan tetap memegang nomornya, walau milik pegawai yang sama.
    await db.riwayatKGB.create(kgb("lalu", "p1", "selesai", null));
    await surat("s-lalu", "lalu", "WP.19-SA.04.04-500", "sk/199001012015031001_1.pdf");
    assert.match((await nomorSkBentrok("WP.19-SA.04.04-500", "ulang")) ?? "", /sudah dipakai SK KGB PEGAWAI P1/);

    // Pegawai lain: draf KGB aktif dan surat yang sudah dibuat tetap memegang nomornya.
    await db.riwayatKGB.create(kgb("lain", "p2", "sedang_diproses", "WP.19-SA.04.04-900"));
    await surat("s-lain", "lain", "WP.19-SA.04.04-901", null);
    assert.match((await nomorSkBentrok("WP.19-SA.04.04-900", "ulang")) ?? "", /sudah disimpan sebagai draf SK KGB PEGAWAI P2/);
    assert.match((await nomorSkBentrok("WP.19-SA.04.04-901", "ulang")) ?? "", /sudah dipakai SK KGB PEGAWAI P2/);
  });
});
