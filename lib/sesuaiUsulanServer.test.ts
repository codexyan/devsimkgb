// SK yang dibuat dari data usulan UPT yang disetujui dikenali "sesuai usulan" (ADR-082), di atas penyimpanan lokal.
//
// Jalankan: node --import tsx --test lib/sesuaiUsulanServer.test.ts

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

async function denganDataLokal(kerja: () => Promise<void>) {
  const folder = await mkdtemp(path.join(tmpdir(), "simkgb-sesuai-"));
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

test("usulan disetujui, KGB diinput dari data itu: SK sesuai usulan; gaji yang diubah Kanwil membuatnya berbeda", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { makeRiwayatKGB } = await import("./sheets/tables");
    const { rencanaSiklusBerikutnya } = await import("./jadwalKgb");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const { cekSesuaiUsulan } = await import("./sesuaiUsulanServer");

    await db.pegawai.create({
      id: "p1", nip: "200001012025061001", nama: "CPNS UJI", tempatLahir: null, tanggalLahir: null,
      jenisKelamin: null, pendidikanTerakhir: null, jabatan: "Penjaga Tahanan", pangkat: "Pengatur Muda",
      golonganRuang: "II/a", unitKerja: "Rutan Kelas IIB Rantau", eselon: null, jenisJabatan: null,
      tmtGolongan: tgl(2025, 6), mkgTahun: 0, mkgBulan: 0, gajiPokok: 2184000,
      tmtKgbTerakhir: tgl(2025, 6), tmtKgbBerikutnya: tgl(2026, 6), statusHukdis: false,
      tanggalHukdisBerakhir: null, jenisHukdis: null, keteranganHukdis: null, aktif: true,
      createdAt: new Date(), updatedAt: new Date(), konfirmasiUptTmt: null, konfirmasiUptAt: null,
      konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null, berhentiAlasan: null,
      nomorSkDasar: "SK-CPNS-1", tanggalSkDasar: tgl(2025, 5, 20), penetapSkDasar: null,
    });
    const usulan = {
      id: "u1", pegawaiId: "p1", satker: "rutan-rantau", status: "menunggu", jenis: "perubahan", nip: null,
      unitKerja: null, nomorSurat: "W.1", tanggalSurat: tgl(2026, 4, 5), pathBerkas: null, pathSkTerakhir: null,
      pathSyaratCpns: null, pathSkPangkat: null, pathSkCpns: "a", pathSkPmk: null, nama: null, tempatLahir: null, tanggalLahir: null,
      jenisKelamin: null, pendidikanTerakhir: null, jabatan: "Penjaga Tahanan Ahli", pangkat: null, golonganRuang: "II/a", eselon: null,
      jenisJabatan: null, tmtGolongan: tgl(2025, 6), mkgTahun: 0, mkgBulan: 0, gajiPokok: null, tmtKgbTerakhir: tgl(2025, 6),
      tmtKgbBerikutnya: tgl(2026, 6), nomorSkTerakhir: "SK-CPNS-1", tanggalSkTerakhir: tgl(2025, 5, 20), hukdisAda: false,
      hukdisJenis: null, hukdisNomorSk: null, hukdisTmtMulai: null, hukdisTmtBerakhir: null, hukdisKeterangan: null,
      catatanUpt: null, diajukanOleh: "UPT", diajukanAt: new Date(), ditinjauOleh: null, ditinjauAt: null, alasanTolak: null,
      dasarBaruJenis: "tidak", dasarBaruJenisKp: null, dasarBaruNomorSk: null, dasarBaruTanggalSk: null,
      dasarBaruTmt: null, dasarBaruPenetap: null, keadaanKgb: "belum",
    };
    await db.usulanPegawai.create(usulan);
    const hasil = await setujuiUsulan(usulan as never, await db.pegawai.findUnique({ id: "p1" }), "Peninjau", new Date(), "u9");
    assert.equal(hasil.ok, true, JSON.stringify(hasil));

    // Tim SDM menginput KGB dari data pegawai yang baru disetujui.
    const pegawai = (await db.pegawai.findUnique({ id: "p1" }))!;
    const rencana = rencanaSiklusBerikutnya({ ...pegawai, hariIni: tgl(2026, 4, 10) });
    const kgb = makeRiwayatKGB({ id: "k1", pegawaiId: "p1", ...rencana, nomorSK: "SK-CPNS-1", status: "sedang_diproses", createdAt: new Date() });
    await db.riwayatKGB.create(kgb);

    const cek = await cekSesuaiUsulan(kgb, pegawai);
    assert.ok(cek.sesuai, JSON.stringify(cek));

    const diubah = await cekSesuaiUsulan({ ...kgb, gajiPokokBaru: kgb.gajiPokokBaru + 100000 }, pegawai);
    assert.equal(diubah.sesuai, false);
    if (!diubah.sesuai) assert.deepEqual(diubah.beda.map((b) => b.label), ["Gaji pokok baru"]);

    // Tanpa usulan yang disetujui untuk siklus ini, SK tetap direview.
    const tanpa = await cekSesuaiUsulan(kgb, { ...pegawai, konfirmasiUptTmt: null });
    assert.equal(tanpa.sesuai, false);
  });
});
