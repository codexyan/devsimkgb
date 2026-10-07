// Mengembalikan usulan UPT yang sudah disetujui dan diterapkan (ADR-076), di atas penyimpanan lokal.
//
// Jalankan: node --import tsx --test lib/kembalikanUsulanDisetujui.test.ts

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

async function denganDataLokal(kerja: () => Promise<void>) {
  const folder = await mkdtemp(path.join(tmpdir(), "simkgb-kembali-"));
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
const SEKARANG = new Date("2026-10-07T04:00:00Z");

function dataPegawai(sebagian: Record<string, unknown> = {}) {
  return {
    id: "p1", nip: "199001012015031001", nama: "PEGAWAI UJI", tempatLahir: "Banjarmasin", tanggalLahir: tgl(1990, 1, 1),
    jenisKelamin: "P", pendidikanTerakhir: "S1", jabatan: "Penjaga Tahanan", pangkat: "Pengatur Muda", golonganRuang: "II/a",
    unitKerja: "Rutan Kelas IIB Rantau", eselon: null, jenisJabatan: null, tmtGolongan: tgl(2025, 6), mkgTahun: 0, mkgBulan: 0,
    gajiPokok: 2184000, tmtKgbTerakhir: tgl(2025, 6), tmtKgbBerikutnya: tgl(2027, 6), statusHukdis: false,
    tanggalHukdisBerakhir: null, jenisHukdis: null, keteranganHukdis: null, aktif: true, createdAt: new Date(), updatedAt: new Date(),
    konfirmasiUptTmt: null, konfirmasiUptAt: null, konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null, berhentiAlasan: null,
    nomorSkDasar: null, tanggalSkDasar: null, penetapSkDasar: null,
    ...sebagian,
  };
}

function dataUsulan(sebagian: Record<string, unknown> = {}) {
  return {
    id: "u1", pegawaiId: "p1", satker: "rutan-rantau", status: "disetujui", jenis: "perubahan", nip: null,
    unitKerja: null, nomorSurat: "W.19-UJI-1", tanggalSurat: tgl(2026, 9, 5), pathBerkas: "usulan/surat.pdf", pathSkTerakhir: "usulan/kgb.pdf",
    pathSyaratCpns: null, pathSkPangkat: "usulan/kp.pdf", pathSkCpns: null, pathSkPmk: null, nama: null, tempatLahir: null,
    tanggalLahir: null, jenisKelamin: null, pendidikanTerakhir: null, jabatan: "JABATAN LAMA SALAH", pangkat: null, golonganRuang: "II/a",
    eselon: null, jenisJabatan: null, tmtGolongan: null, mkgTahun: 0, mkgBulan: 0, gajiPokok: null, tmtKgbTerakhir: tgl(2025, 6),
    tmtKgbBerikutnya: tgl(2027, 6), nomorSkTerakhir: "SK-LAMA", tanggalSkTerakhir: tgl(2025, 5, 20), hukdisAda: true,
    hukdisJenis: "ringan", hukdisNomorSk: "H-1", hukdisTmtMulai: tgl(2026, 1), hukdisTmtBerakhir: tgl(2026, 6), hukdisKeterangan: "x",
    catatanUpt: "catatan UPT", diajukanOleh: "Admin UPT (199505052019051005)", diajukanAt: tgl(2026, 9, 6), ditinjauOleh: "Peninjau",
    ditinjauAt: tgl(2026, 9, 8), alasanTolak: null,
    dasarBaruJenis: null, dasarBaruJenisKp: null, dasarBaruNomorSk: null, dasarBaruTanggalSk: null, dasarBaruTmt: null, dasarBaruPenetap: null,
    ...sebagian,
  };
}

test("usulan yang sudah disetujui dikembalikan sebagai usulan perbaikan baru, terisi sesuai data pegawai saat ini", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { kembalikanUsulanDisetujui } = await import("./kembalikanUsulanDisetujui");
    const { bandingkanUsulan, kekuranganUsulan } = await import("./usulanPegawai");
    // Kanwil sudah membetulkan jabatan langsung di Data Pegawai sesudah usulan itu disetujui.
    await db.pegawai.create(dataPegawai({ jabatan: "Pembimbing Kemasyarakatan" }));
    await db.usulanPegawai.create(dataUsulan());

    const lama = await db.usulanPegawai.findUnique({ id: "u1" });
    const hasil = await kembalikanUsulanDisetujui({ usulan: lama as never, catatan: "SK CPNS tidak terbaca", oleh: "Peninjau (1)", sekarang: SEKARANG });
    assert.equal(hasil.ok, true);
    if (!hasil.ok) return;

    // Usulan lama tidak disentuh: tetap Selesai sebagai riwayat dan sumber dokumennya.
    const tetap = await db.usulanPegawai.findUnique({ id: "u1" });
    assert.equal(tetap?.status, "disetujui");
    assert.equal(tetap?.pathSkPangkat, "usulan/kp.pdf");

    const baru = await db.usulanPegawai.findUnique({ id: hasil.id });
    assert.ok(baru && baru.id !== "u1");
    assert.equal(baru.status, "revisi");
    assert.equal(baru.jenis, "perubahan");
    assert.equal(baru.pegawaiId, "p1");
    assert.equal(baru.satker, "rutan-rantau");
    assert.equal(baru.alasanTolak, "SK CPNS tidak terbaca");
    assert.equal(baru.ditinjauOleh, "Peninjau (1)");
    // Isian mengikuti data pegawai saat ini (jabatan yang sudah dibetulkan Kanwil), bukan isian usulan lama yang keliru.
    assert.equal(baru.jabatan, "Pembimbing Kemasyarakatan");
    assert.equal(baru.nip, "199001012015031001");
    // SK dasar terbawa dari usulan yang disetujui; berkas tidak disalin (terbawa lewat bawaan saat disimpan).
    assert.equal(baru.nomorSkTerakhir, "SK-LAMA");
    assert.equal(baru.pathBerkas, null);
    assert.equal(baru.pathSkPangkat, null);
    // SK yang sudah tercatat tidak dicatat ulang, dan laporan hukdis lama tidak dilaporkan dua kali.
    assert.equal(baru.dasarBaruJenis, "tidak");
    assert.equal(baru.hukdisAda, false);
    assert.equal(baru.hukdisJenis, null);

    // Mulai dari "tidak ada selisih", dan langsung dapat dikirim ulang (surat diisi saat mengajukan).
    const pegawai = await db.pegawai.findUnique({ id: "p1" });
    assert.deepEqual(bandingkanUsulan(pegawai as never, baru as never), []);
    assert.deepEqual(kekuranganUsulan(baru as never, "perubahan", pegawai as never), []);
    // Data pegawai tidak berubah.
    assert.equal(pegawai?.jabatan, "Pembimbing Kemasyarakatan");

    // UPT dikabari lewat lonceng usulan dikembalikan, dengan pesan khusus usulan yang sudah disetujui.
    const kabar = await db.notifikasi.findMany({ where: { tipe: "usulan_revisi" } });
    assert.equal(kabar.length, 1);
    assert.equal(kabar[0].referenceId, hasil.id);
    assert.match(kabar[0].pesan, /yang sudah disetujui/);
    assert.match(kabar[0].pesan, /SK CPNS tidak terbaca/);
    assert.match(kabar[0].pesan, /Data pegawai tidak berubah/);
  });
});

test("usulan pegawai baru yang sudah disetujui dikembalikan sebagai perbaikan atas pegawai yang kini tercatat", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { kembalikanUsulanDisetujui } = await import("./kembalikanUsulanDisetujui");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const baru = dataUsulan({
      id: "ub", pegawaiId: null, jenis: "baru", nip: "199101012020121001", unitKerja: "Rutan Kelas IIB Rantau", nama: "PEGAWAI BARU UJI",
      jabatan: "Penjaga Tahanan", golonganRuang: "II/a", mkgTahun: 0, mkgBulan: 0, tmtKgbTerakhir: tgl(2025, 12), tmtKgbBerikutnya: null,
      hukdisAda: false, status: "menunggu", ditinjauOleh: null, ditinjauAt: null,
    });
    await db.usulanPegawai.create(baru);
    const disetujui = await setujuiUsulan(baru as never, null, "Peninjau", SEKARANG, "u-peninjau");
    assert.equal(disetujui.ok, true);
    const pegawaiBaru = await db.pegawai.findUnique({ nip: "199101012020121001" });
    assert.ok(pegawaiBaru);
    const jumlahPegawai = (await db.pegawai.findMany()).length;

    const sesudah = await db.usulanPegawai.findUnique({ id: "ub" });
    assert.equal(sesudah?.pegawaiId, pegawaiBaru.id, "persetujuan mencatat pegawainya pada usulan");
    const hasil = await kembalikanUsulanDisetujui({ usulan: sesudah as never, catatan: "Tempat lahir keliru", oleh: "Peninjau (1)", sekarang: SEKARANG });
    assert.equal(hasil.ok, true);
    if (!hasil.ok) return;

    const perbaikan = await db.usulanPegawai.findUnique({ id: hasil.id });
    assert.equal(perbaikan?.jenis, "perubahan", "pegawainya sudah ada, jadi bukan lagi usulan pegawai baru");
    assert.equal(perbaikan?.pegawaiId, pegawaiBaru.id);
    assert.equal((await db.pegawai.findMany()).length, jumlahPegawai, "tidak membuat pegawai kedua");

    // Perbaikan UPT disetujui seperti usulan perubahan biasa: hanya selisihnya yang diterapkan, tanpa bentrok NIP.
    await db.usulanPegawai.update({ id: hasil.id }, { status: "menunggu", tempatLahir: "Martapura", ditinjauOleh: null, ditinjauAt: null, alasanTolak: null });
    const menunggu = await db.usulanPegawai.findUnique({ id: hasil.id });
    const ulang = await setujuiUsulan(menunggu as never, pegawaiBaru as never, "Peninjau", SEKARANG, "u-peninjau");
    assert.equal(ulang.ok, true, JSON.stringify(ulang));
    assert.equal((await db.pegawai.findUnique({ id: pegawaiBaru.id }))?.tempatLahir, "Martapura");
    assert.equal((await db.pegawai.findMany()).length, jumlahPegawai);
  });
});

test("usulan yang melaporkan SK kenaikan pangkat dapat dikembalikan, dan perbaikannya tidak mencatat SK itu dua kali", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { kembalikanUsulanDisetujui } = await import("./kembalikanUsulanDisetujui");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    await db.pegawai.create(dataPegawai());
    const kp = dataUsulan({
      status: "menunggu", ditinjauOleh: null, ditinjauAt: null, golonganRuang: "III/a", mkgTahun: 6, mkgBulan: 0, hukdisAda: false,
      dasarBaruJenis: "kp", dasarBaruJenisKp: "penyesuaian_ijazah", dasarBaruNomorSk: "W.19-KP.03.01-9",
      dasarBaruTanggalSk: tgl(2026, 5, 2), dasarBaruTmt: tgl(2026, 4, 1), dasarBaruPenetap: "Kepala Kantor Wilayah",
    });
    await db.usulanPegawai.create(kp);
    const lama = await db.pegawai.findUnique({ id: "p1" });
    const disetujui = await setujuiUsulan(kp as never, lama as never, "Peninjau", SEKARANG, "u-peninjau");
    assert.equal(disetujui.ok, true);
    const sesudahKp = await db.pegawai.findUnique({ id: "p1" });
    assert.equal(sesudahKp?.golonganRuang, "III/a");
    assert.equal(Number(sesudahKp?.mkgTahun), 0, "masa kerja dipotong 5 tahun saat pindah jenjang");
    assert.equal((await db.riwayatPangkat.findMany({ where: { pegawaiId: "p1" } })).length, 1);

    const usulan = await db.usulanPegawai.findUnique({ id: "u1" });
    const hasil = await kembalikanUsulanDisetujui({ usulan: usulan as never, catatan: "Penetap SK keliru", oleh: "Peninjau (1)", sekarang: SEKARANG });
    assert.equal(hasil.ok, true);
    if (!hasil.ok) return;
    const perbaikan = await db.usulanPegawai.findUnique({ id: hasil.id });
    // Golongan dan masa kerja pada usulan perbaikan adalah yang berlaku sekarang (setelah SK dihitung), bukan angka mentah usulan lama.
    assert.equal(perbaikan?.golonganRuang, "III/a");
    assert.equal(Number(perbaikan?.mkgTahun), 0);
    assert.equal(perbaikan?.dasarBaruJenis, "tidak");

    // UPT memperbaiki satu kolom lain lalu mengirim ulang; Kanwil menyetujui tanpa bentrok SK dan tanpa riwayat ganda.
    await db.usulanPegawai.update({ id: hasil.id }, { status: "menunggu", jabatan: "Pembimbing Kemasyarakatan", ditinjauOleh: null, ditinjauAt: null, alasanTolak: null });
    const menunggu = await db.usulanPegawai.findUnique({ id: hasil.id });
    const sekarangPegawai = await db.pegawai.findUnique({ id: "p1" });
    const ulang = await setujuiUsulan(menunggu as never, sekarangPegawai as never, "Peninjau", SEKARANG, "u-peninjau");
    assert.equal(ulang.ok, true, JSON.stringify(ulang));
    const akhir = await db.pegawai.findUnique({ id: "p1" });
    assert.equal(akhir?.jabatan, "Pembimbing Kemasyarakatan");
    assert.equal(akhir?.golonganRuang, "III/a");
    assert.equal(Number(akhir?.mkgTahun), 0, "masa kerja tidak berubah lagi");
    assert.equal(akhir?.gajiPokok, sesudahKp?.gajiPokok);
    assert.equal((await db.riwayatPangkat.findMany({ where: { pegawaiId: "p1" } })).length, 1, "SK tidak tercatat dua kali");
  });
});

test("pengembalian ditolak bila pegawai punya usulan lain yang belum selesai, sudah pindah satker, atau tidak ditemukan", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { kembalikanUsulanDisetujui } = await import("./kembalikanUsulanDisetujui");
    await db.pegawai.create(dataPegawai());
    await db.usulanPegawai.create(dataUsulan());
    const usulan = (await db.usulanPegawai.findUnique({ id: "u1" })) as never;
    const jalankan = () => kembalikanUsulanDisetujui({ usulan, catatan: "perbaiki", oleh: "Peninjau (1)", sekarang: SEKARANG });

    // 1) Sudah ada usulan lain yang menunggu: satu pegawai hanya boleh punya satu usulan yang belum selesai.
    await db.usulanPegawai.create(dataUsulan({ id: "u2", status: "menunggu" }));
    let hasil = await jalankan();
    assert.equal(hasil.ok, false);
    if (!hasil.ok) {
      assert.equal(hasil.status, 409);
      assert.match(hasil.pesan, /menunggu tinjauan Kanwil/);
    }
    await db.usulanPegawai.update({ id: "u2" }, { status: "disetujui" });

    // 2) Pegawai sudah pindah ke satker lain: UPT asal tidak lagi melihatnya.
    await db.pegawai.update({ id: "p1" }, { unitKerja: "Rumah Tahanan Negara Kelas IIB Barabai" });
    hasil = await jalankan();
    assert.equal(hasil.ok, false);
    if (!hasil.ok) {
      assert.equal(hasil.status, 409);
      assert.match(hasil.pesan, /sudah tidak tercatat di/);
    }
    await db.pegawai.update({ id: "p1" }, { unitKerja: "Rutan Kelas IIB Rantau" });

    // Tidak ada usulan baru yang lahir dari penolakan, dan tidak ada notifikasi.
    assert.equal((await db.usulanPegawai.findMany()).filter((u) => u.status === "revisi").length, 0);
    assert.equal((await db.notifikasi.findMany()).length, 0);

    // 3) Pegawainya sudah tidak ada (tanpa NIP untuk dicari).
    await db.pegawai.delete({ id: "p1" });
    hasil = await jalankan();
    assert.equal(hasil.ok, false);
    if (!hasil.ok) assert.equal(hasil.status, 404);
  });
});

test("usulan pegawai baru lama yang belum mencatat pegawaiId dikenali dari NIP-nya", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { kembalikanUsulanDisetujui } = await import("./kembalikanUsulanDisetujui");
    await db.pegawai.create(dataPegawai());
    await db.usulanPegawai.create(dataUsulan({ pegawaiId: null, jenis: "baru", nip: "199001012015031001" }));
    const usulan = (await db.usulanPegawai.findUnique({ id: "u1" })) as never;
    const hasil = await kembalikanUsulanDisetujui({ usulan, catatan: "perbaiki", oleh: "Peninjau (1)", sekarang: SEKARANG });
    assert.equal(hasil.ok, true);
    if (!hasil.ok) return;
    assert.equal((await db.usulanPegawai.findUnique({ id: hasil.id }))?.pegawaiId, "p1");
  });
});
