// Persetujuan usulan UPT terhadap KGB yang sedang berjalan (ADR-011), di atas penyimpanan lokal.
//
// Jalankan: node --import tsx --test lib/setujuiUsulan.test.ts

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

async function denganDataLokal(kerja: () => Promise<void>) {
  const folder = await mkdtemp(path.join(tmpdir(), "simkgb-usulan-"));
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

async function siapkan(statusKgb: "sedang_diproses" | "menunggu_keuangan", denganSurat: boolean) {
  const { db } = await import("./db");
  const { makeRiwayatKGB } = await import("./sheets/tables");
  const { rencanaSiklusBerikutnya } = await import("./jadwalKgb");
  const pegawai = {
    id: "p1", nip: "199001012015031001", nama: "PEGAWAI UJI", tempatLahir: null, tanggalLahir: null,
    jenisKelamin: null, pendidikanTerakhir: null, jabatan: "Penjaga Tahanan", pangkat: "Pengatur Muda",
    golonganRuang: "II/a", unitKerja: "Rutan Kelas IIB Rantau", eselon: null, jenisJabatan: null,
    tmtGolongan: tgl(2025, 6), mkgTahun: 0, mkgBulan: 0, gajiPokok: 2184000,
    tmtKgbTerakhir: tgl(2025, 6), tmtKgbBerikutnya: tgl(2026, 6), statusHukdis: false,
    tanggalHukdisBerakhir: null, jenisHukdis: null, keteranganHukdis: null, aktif: true,
    createdAt: new Date(), updatedAt: new Date(), konfirmasiUptTmt: null, konfirmasiUptAt: null,
    konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null, berhentiAlasan: null,
    nomorSkDasar: null, tanggalSkDasar: null, penetapSkDasar: null,
  };
  await db.pegawai.create(pegawai);
  const rencana = rencanaSiklusBerikutnya({ ...pegawai, hariIni: tgl(2026, 4, 1) });
  await db.riwayatKGB.create(
    makeRiwayatKGB({ id: "k1", pegawaiId: "p1", ...rencana, nomorSK: "SK-CPNS", status: statusKgb, createdAt: tgl(2026, 4, 1) }),
  );
  if (denganSurat)
    await db.suratKGB.create({
      id: "s1", kgbId: "k1", nomorSurat: "WP.19-SA.04.04-777", tanggalSurat: tgl(2026, 4, 10),
      namaKepalaKanwil: "-", nipKepalaKanwil: "-", pathFile: statusKgb === "menunggu_keuangan" ? "sk/199001012015031001_1.pdf" : null,
      generatedAt: new Date(), generatedBy: "u1",
    });
  // Usulan UPT: masa kerja golongan ternyata 2 tahun, bukan 0.
  const usulan = {
    id: "u1", pegawaiId: "p1", satker: "rutan-rantau", status: "menunggu", jenis: "perubahan", nip: null,
    unitKerja: null, nomorSurat: "W.1", tanggalSurat: tgl(2026, 4, 5), pathBerkas: null, pathSkTerakhir: null,
    pathSyaratCpns: null, pathSkPangkat: null, pathSkCpns: null, nama: null, tempatLahir: null, tanggalLahir: null,
    jenisKelamin: null, pendidikanTerakhir: null, jabatan: null, pangkat: null, golonganRuang: "II/a", eselon: null,
    jenisJabatan: null, tmtGolongan: null, mkgTahun: 2, mkgBulan: 0, gajiPokok: null, tmtKgbTerakhir: tgl(2025, 6),
    tmtKgbBerikutnya: tgl(2027, 6), nomorSkTerakhir: null, tanggalSkTerakhir: null, hukdisAda: false,
    hukdisJenis: null, hukdisNomorSk: null, hukdisTmtMulai: null, hukdisTmtBerakhir: null, hukdisKeterangan: null,
    catatanUpt: null, diajukanOleh: "UPT", diajukanAt: new Date(), ditinjauOleh: null, ditinjauAt: null, alasanTolak: null,
  };
  await db.usulanPegawai.create(usulan);
  return { db, usulan };
}

test("KGB yang sedang diproses dihitung ulang, dan SK yang sudah dibuat dilepas dengan nomornya disimpan sebagai draf", async () => {
  await denganDataLokal(async () => {
    const { db, usulan } = await siapkan("sedang_diproses", true);
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const lama = await db.pegawai.findUnique({ id: "p1" });
    const hasil = await setujuiUsulan(usulan as never, lama, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true);
    if (!hasil.ok) return;
    assert.match(hasil.penyesuaianKgb ?? "", /hitungan KGB yang sedang diproses diperbarui/);
    assert.match(hasil.penyesuaianKgb ?? "", /SK WP\.19-SA\.04\.04-777 perlu dibuat ulang/);

    const kgb = await db.riwayatKGB.findUnique({ id: "k1" });
    assert.equal(kgb?.mkgTahunLama, 2, "hitungan memakai masa kerja yang diusulkan");
    assert.equal(kgb?.status, "sedang_diproses");
    assert.equal(kgb?.nomorSK, "SK-CPNS", "SK dasar dari Input KGB tidak tersentuh");
    assert.equal(kgb?.drafNomorSurat, "WP.19-SA.04.04-777");
    assert.equal(await db.suratKGB.findUnique({ kgbId: "k1" }), null, "SK lama harus dibuat ulang");
    assert.equal((await db.usulanPegawai.findUnique({ id: "u1" }))?.status, "disetujui");
  });
});

test("setelah SK bertanda tangan diunggah, usulan yang mengubah dasar gaji ditolak tanpa menulis apa pun", async () => {
  await denganDataLokal(async () => {
    const { db, usulan } = await siapkan("menunggu_keuangan", true);
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const lama = await db.pegawai.findUnique({ id: "p1" });
    const hasil = await setujuiUsulan(usulan as never, lama, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, false);
    assert.match(hasil.ok ? "" : hasil.pesan, /sudah ditandatangani dan diunggah/);
    assert.equal((await db.pegawai.findUnique({ id: "p1" }))?.mkgTahun, 0, "data pegawai tidak berubah");
    assert.equal((await db.usulanPegawai.findUnique({ id: "u1" }))?.status, "menunggu");
  });
});
