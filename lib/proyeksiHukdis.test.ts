// Proyeksi sementara jadwal KGB dari laporan hukdis yang menunggu Kanwil (ADR-114).
//
// Jalankan: node --import tsx --test lib/proyeksiHukdis.test.ts

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DURASI_TUNDA_BAWAAN, dampakJenisHukdis, proyeksiLaporanHukdis } from "./proyeksiHukdis";

const tgl = (tahun: number, bulan: number, hari = 1) => new Date(Date.UTC(tahun, bulan - 1, hari));
const bulanIso = (d: Date) => d.toISOString().slice(0, 7);

const pegawai = { golonganRuang: "II/c", mkgTahun: 3, mkgBulan: 0, tmtKgbBerikutnya: tgl(2027, 6), tmtKgbTerakhir: tgl(2025, 6) };
const hariIni = tgl(2026, 10, 13);

test("dampak jenis: katalog menentukan, tanpa katalog hanya penundaan_kgb yang menunda, masa bawaan 12 bulan", () => {
  assert.deepEqual(dampakJenisHukdis("penundaan_kgb", null), { berdampakKGB: true, durasiTunda: DURASI_TUNDA_BAWAAN });
  assert.deepEqual(dampakJenisHukdis("teguran", null), { berdampakKGB: false, durasiTunda: null });
  assert.deepEqual(dampakJenisHukdis("apa_saja", { berdampakKGB: true, durasiTunda: 6 }), { berdampakKGB: true, durasiTunda: 6 });
  assert.deepEqual(dampakJenisHukdis("apa_saja", { berdampakKGB: true }), { berdampakKGB: true, durasiTunda: 12 });
  assert.deepEqual(dampakJenisHukdis("penundaan_kgb", { berdampakKGB: false }), { berdampakKGB: false, durasiTunda: null });
});

test("pegawai yang jauh dari masa usul: TMT bergeser sesuai masa penundaan, tanpa syarat masa 2 bulan", () => {
  const hasil = proyeksiLaporanHukdis({
    pegawai,
    laporan: { jenisHukdis: "penundaan_kgb", tmtMulai: tgl(2027, 1) },
    jenis: null,
    hariIni,
  });
  assert.equal(hasil.aksi, "geser");
  if (hasil.aksi !== "geser") return;
  assert.equal(bulanIso(hasil.tmtSebelum), "2027-06");
  assert.equal(bulanIso(hasil.tmtBaru), "2028-06");
  assert.equal(hasil.bulan, 12);

  // Masa penundaan dari katalog dipakai.
  const enam = proyeksiLaporanHukdis({
    pegawai,
    laporan: { jenisHukdis: "x", tmtMulai: tgl(2027, 1) },
    jenis: { berdampakKGB: true, durasiTunda: 6 },
    hariIni,
  });
  assert.equal(enam.aksi === "geser" ? bulanIso(enam.tmtBaru) : "", "2027-12");
});

test("hukuman yang tidak menunda KGB, dan yang mulai sesudah TMT yang belum diinput", () => {
  assert.deepEqual(
    proyeksiLaporanHukdis({ pegawai, laporan: { jenisHukdis: "teguran", tmtMulai: tgl(2027, 1) }, jenis: { berdampakKGB: false }, hariIni }),
    { aksi: "tidak_menunda" },
  );
  const terlambat = proyeksiLaporanHukdis({
    pegawai,
    laporan: { jenisHukdis: "penundaan_kgb", tmtMulai: tgl(2027, 8) },
    jenis: null,
    hariIni,
  });
  assert.equal(terlambat.aksi, "tolak");
  assert.match(terlambat.aksi === "tolak" ? terlambat.alasan : "", /sesudah TMT KGB/);
});

test("KGB yang sedang diproses: hukdis yang mulai sebelum TMT-nya ditolak, sesudahnya menggeser siklus berikutnya", () => {
  const kgbAktif = { tmtKgbBaru: tgl(2026, 12), tmtKgbBerikutnya: tgl(2028, 12), status: "sedang_diproses" };
  const tolak = proyeksiLaporanHukdis({
    pegawai: { ...pegawai, tmtKgbBerikutnya: tgl(2026, 12) },
    kgbAktif,
    laporan: { jenisHukdis: "penundaan_kgb", tmtMulai: tgl(2026, 11) },
    jenis: null,
    hariIni,
  });
  assert.equal(tolak.aksi, "tolak");
  const geser = proyeksiLaporanHukdis({
    pegawai: { ...pegawai, tmtKgbBerikutnya: tgl(2026, 12) },
    kgbAktif,
    laporan: { jenisHukdis: "penundaan_kgb", tmtMulai: tgl(2027, 2) },
    jenis: null,
    hariIni,
  });
  assert.equal(geser.aksi, "geser");
});

async function denganDataLokal(kerja: () => Promise<void>) {
  const folder = await mkdtemp(path.join(tmpdir(), "simkgb-proyeksi-"));
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

test("perkiraan dari laporan menunggu sama dengan hasil pencatatan Kanwil, dan laporan lain tidak ikut", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { catatHukdis } = await import("./catatHukdis");
    const { proyeksiLaporanMenunggu } = await import("./proyeksiHukdisServer");

    await db.pegawai.create({
      id: "p1", nip: "199101012020121001", nama: "PEGAWAI UJI", tempatLahir: null, tanggalLahir: null, jenisKelamin: null,
      pendidikanTerakhir: null, jabatan: "Penjaga", pangkat: "Pengatur", golonganRuang: "II/c", unitKerja: "Rumah Tahanan Negara Kelas IIB Rantau",
      eselon: null, jenisJabatan: null, tmtGolongan: tgl(2025, 6), mkgTahun: 3, mkgBulan: 0, gajiPokok: 2485900,
      tmtKgbTerakhir: tgl(2025, 6), tmtKgbBerikutnya: tgl(2027, 6), statusHukdis: false, tanggalHukdisBerakhir: null,
      jenisHukdis: null, keteranganHukdis: null, aktif: true, createdAt: new Date(), updatedAt: new Date(),
      konfirmasiUptTmt: null, konfirmasiUptAt: null, konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null,
      berhentiAlasan: null, nomorSkDasar: null, tanggalSkDasar: null, penetapSkDasar: null,
    } as never);
    const laporan = (id: string, status: string, satker = "rutan-rantau") => ({
      id, pegawaiId: "p1", satker, jenisHukdis: "penundaan_kgb", nomorSK: "HD-1", tanggalSK: tgl(2026, 12, 15),
      tmtMulai: tgl(2027, 1), tmtBerakhir: tgl(2027, 12, 31), keterangan: null, pathBerkas: null, status, catatanKanwil: null,
      dilaporkanOleh: "UPT", dilaporkanAt: new Date(), ditinjauOleh: null, ditinjauAt: null, riwayatId: null,
    });
    await db.laporanHukdis.create(laporan("l-lain", "diterima") as never);
    await db.laporanHukdis.create(laporan("l-satker-lain", "menunggu", "lapas-banjarmasin") as never);
    assert.equal((await proyeksiLaporanMenunggu("rutan-rantau", hariIni)).size, 0, "yang sudah dicatat dan milik satker lain tidak ikut");

    await db.laporanHukdis.create(laporan("l1", "menunggu") as never);
    const perkiraan = (await proyeksiLaporanMenunggu("rutan-rantau", hariIni)).get("p1");
    assert.equal(perkiraan?.laporanId, "l1");
    assert.equal(perkiraan?.proyeksi.aksi, "geser");
    if (perkiraan?.proyeksi.aksi !== "geser") return;

    // Pegawai dan jadwalnya belum berubah selama menunggu.
    assert.equal(bulanIso((await db.pegawai.findUnique({ id: "p1" }))!.tmtKgbBerikutnya!), "2027-06");

    // Kanwil mencatatnya: hasilnya persis perkiraan.
    const catat = await catatHukdis(
      "p1",
      { jenisHukdis: "penundaan_kgb", nomorSK: "HD-1", tanggalSK: "2026-12-15", tmtMulai: "2027-01-01", tmtBerakhir: "2027-12-31" },
      "u-hukdis",
    );
    assert.equal(catat.ok, true, JSON.stringify(catat));
    const sesudah = await db.pegawai.findUnique({ id: "p1" });
    assert.equal(bulanIso(sesudah!.tmtKgbBerikutnya!), bulanIso(perkiraan.proyeksi.tmtBaru));
  });
});
