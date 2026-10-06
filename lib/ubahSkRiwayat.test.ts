// Pembetulan data SK riwayat kenaikan pangkat dan PMK, beserta penyelarasannya (ADR-068).
//
// Jalankan: node --import tsx --test lib/ubahSkRiwayat.test.ts

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { rencanaSelarasKgb, type KgbUntukSelaras } from "./ubahSkRiwayat";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(Date.UTC(tahun, bulan - 1, hari));
const lama = { nomorSK: "SEK-2017.SA.04.05 TAHUN 2026", tanggalSK: tgl(2026, 1, 29), penetapSK: "Kepala Badan Kepegawaian Negara" };
const baru = { nomorSK: "SEK-2017.SA.04.05 TAHUN 2026", tanggalSK: tgl(2026, 1, 29), penetapSK: "Sekretaris Jenderal Kementerian Imigrasi dan Pemasyarakatan" };

test("KGB yang Atas dasarnya SK ini dan belum ditandatangani ikut dibetulkan; yang sudah ditandatangani dibiarkan", () => {
  const kgb: KgbUntukSelaras[] = [
    { id: "proses", status: "sedang_diproses", nomorSK: "sek-2017.sa.04.05 tahun 2026", penetapSkDasar: lama.penetapSK, tmtKgbBaru: tgl(2028, 12) },
    { id: "ttd", status: "menunggu_keuangan", nomorSK: lama.nomorSK, tmtKgbBaru: tgl(2026, 12) },
    { id: "lain", status: "sedang_diproses", nomorSK: "W.17-KGB-2024", penetapSkDasar: "Kepala Kantor Wilayah", tmtKgbBaru: tgl(2026, 12) },
    { id: "arsip", status: "sedang_diproses", isArsip: true, nomorSK: lama.nomorSK, tmtKgbBaru: tgl(2020, 1) },
  ];
  const r = rencanaSelarasKgb(kgb, lama, baru, true);
  assert.deepEqual(r.ubah, [{ id: "proses", patch: { nomorSK: baru.nomorSK, penetapSkDasar: baru.penetapSK } }]);
  assert.deepEqual(r.terkunci.map((t) => t.id), ["ttd"]);
});

test("jadwal yang belum diproses tanpa nomor dasar hanya mengikuti penetap, dan hanya bila SK ini yang terbaru", () => {
  const jadwal: KgbUntukSelaras[] = [
    { id: "j1", status: "belum_diproses", nomorSK: null, penetapSkDasar: lama.penetapSK, tmtKgbBaru: tgl(2028, 12) },
    { id: "j2", status: "belum_diproses", nomorSK: null, penetapSkDasar: "Pejabat lain yang diketik Tim SDM", tmtKgbBaru: tgl(2030, 12) },
  ];
  assert.deepEqual(rencanaSelarasKgb(jadwal, lama, baru, true).ubah, [{ id: "j1", patch: { penetapSkDasar: baru.penetapSK } }]);
  assert.deepEqual(rencanaSelarasKgb(jadwal, lama, baru, false).ubah, []);
  // Penetap tidak berubah: jadwal tidak disentuh.
  assert.deepEqual(rencanaSelarasKgb(jadwal, lama, { ...baru, penetapSK: lama.penetapSK }, true).ubah, []);
});

test("nomor dan tanggal yang dibetulkan ikut ke KGB yang Atas dasarnya SK ini", () => {
  const kgb: KgbUntukSelaras[] = [{ id: "k", status: "sedang_diproses", nomorSK: lama.nomorSK, tanggalSK: lama.tanggalSK, penetapSkDasar: lama.penetapSK, tmtKgbBaru: tgl(2028, 12) }];
  const r = rencanaSelarasKgb(kgb, lama, { ...lama, nomorSK: "SEK-2017.SA.04.06 TAHUN 2026", tanggalSK: tgl(2026, 1, 30) }, true);
  assert.deepEqual(r.ubah, [{ id: "k", patch: { nomorSK: "SEK-2017.SA.04.06 TAHUN 2026", tanggalSK: tgl(2026, 1, 30) } }]);
});

async function denganDataLokal(kerja: () => Promise<void>) {
  const folder = await mkdtemp(path.join(tmpdir(), "simkgb-ubahsk-"));
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

test("ubahSkRiwayat: riwayat, KGB yang sedang diproses, dan SK dasar pegawai ikut dibetulkan; SK bertanda tangan tidak", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { makeRiwayatKGB } = await import("./sheets/tables");
    const { ubahSkRiwayat } = await import("./ubahSkRiwayat");
    const pegawai = {
      id: "p1", nip: "199309012017121099", nama: "PEGAWAI UJI", tempatLahir: null, tanggalLahir: null,
      jenisKelamin: null, pendidikanTerakhir: null, jabatan: "Pengadministrasi Perkantoran", pangkat: "Penata Muda",
      golonganRuang: "III/a", unitKerja: "Kantor Wilayah", eselon: null, jenisJabatan: null,
      tmtGolongan: tgl(2026, 2), mkgTahun: 2, mkgBulan: 0, gajiPokok: 2873500,
      tmtKgbTerakhir: tgl(2026, 12), tmtKgbBerikutnya: tgl(2028, 12), statusHukdis: false,
      tanggalHukdisBerakhir: null, jenisHukdis: null, keteranganHukdis: null, aktif: true,
      createdAt: new Date(), updatedAt: new Date(), konfirmasiUptTmt: null, konfirmasiUptAt: null,
      konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null, berhentiAlasan: null,
      // Data pegawai lama yang menyimpan nomor SK KP sebagai SK dasar.
      nomorSkDasar: lama.nomorSK, tanggalSkDasar: lama.tanggalSK, penetapSkDasar: lama.penetapSK,
    };
    await db.pegawai.create(pegawai);
    await db.riwayatPangkat.create({
      id: "kp1", pegawaiId: "p1", jenisKp: "penyesuaian_ijazah", nomorSK: lama.nomorSK, tanggalSK: lama.tanggalSK,
      tmtPangkat: tgl(2026, 2), golonganLama: "II/b", golonganBaru: "III/a", mkgTahunLama: 7, mkgBulanLama: 0,
      mkgTahunBaru: 2, mkgBulanBaru: 0, gajiPokokLama: 2537600, gajiPokokBaru: 2873500, keterangan: null,
      createdAt: new Date(), createdBy: "u1", penetapSK: lama.penetapSK,
    });
    await db.riwayatPangkat.create({
      id: "kp0", pegawaiId: "p1", jenisKp: "reguler", nomorSK: "KP-LAMA-2022", tanggalSK: tgl(2022, 3, 1),
      tmtPangkat: tgl(2022, 4), golonganLama: "II/a", golonganBaru: "II/b", mkgTahunLama: 5, mkgBulanLama: 0,
      mkgTahunBaru: 5, mkgBulanBaru: 0, gajiPokokLama: 2300000, gajiPokokBaru: 2400000, keterangan: null,
      createdAt: new Date(), createdBy: "u1", penetapSK: null,
    });
    await db.riwayatKGB.create(
      makeRiwayatKGB({ id: "k-proses", pegawaiId: "p1", tmtKgbBaru: tgl(2028, 12), status: "sedang_diproses", nomorSK: lama.nomorSK, tanggalSK: lama.tanggalSK, penetapSkDasar: lama.penetapSK, createdAt: new Date() }),
    );
    await db.riwayatKGB.create(
      makeRiwayatKGB({ id: "k-selesai", pegawaiId: "p1", tmtKgbBaru: tgl(2026, 12), status: "selesai", nomorSK: lama.nomorSK, tanggalSK: lama.tanggalSK, penetapSkDasar: lama.penetapSK, createdAt: new Date() }),
    );

    // Nomor yang sudah dipakai riwayat lain ditolak.
    const kembar = await ubahSkRiwayat({
      jenis: "kp", pegawai: pegawai as never, riwayatId: "kp1", userId: "u1", oleh: "Penguji",
      isian: { nomorSK: "kp-lama-2022", tanggalSK: lama.tanggalSK, penetapSK: baru.penetapSK, jenisKp: "penyesuaian_ijazah" },
    });
    assert.equal(kembar.ok, false);

    const hasil = await ubahSkRiwayat({
      jenis: "kp", pegawai: pegawai as never, riwayatId: "kp1", userId: "u1", oleh: "Penguji",
      isian: { nomorSK: lama.nomorSK, tanggalSK: lama.tanggalSK, penetapSK: baru.penetapSK, jenisKp: "penyesuaian_ijazah" },
    });
    assert.ok(hasil.ok && hasil.berubah, JSON.stringify(hasil));
    const riwayat = (await db.riwayatPangkat.findMany({ where: { pegawaiId: "p1" } })).find((r) => r.id === "kp1");
    assert.equal(riwayat?.penetapSK, baru.penetapSK);
    assert.equal((await db.riwayatKGB.findUnique({ id: "k-proses" }))?.penetapSkDasar, baru.penetapSK);
    assert.equal((await db.riwayatKGB.findUnique({ id: "k-selesai" }))?.penetapSkDasar, lama.penetapSK);
    assert.equal((await db.pegawai.findUnique({ id: "p1" }))?.penetapSkDasar, baru.penetapSK);
    assert.ok(hasil.ok && hasil.selaras.some((s) => /sudah ditandatangani/.test(s)), hasil.ok ? hasil.selaras.join(" | ") : "");

    // Tanpa perubahan: tidak ada yang ditulis.
    const sama = await ubahSkRiwayat({
      jenis: "kp", pegawai: (await db.pegawai.findUnique({ id: "p1" })) as never, riwayatId: "kp1", userId: "u1", oleh: "Penguji",
      isian: { nomorSK: lama.nomorSK, tanggalSK: lama.tanggalSK, penetapSK: baru.penetapSK, jenisKp: "penyesuaian_ijazah" },
    });
    assert.ok(sama.ok && !sama.berubah);
  });
});
