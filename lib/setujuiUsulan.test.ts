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
    pathSyaratCpns: null, pathSkPangkat: null, pathSkCpns: null, pathSkPmk: null, nama: null, tempatLahir: null, tanggalLahir: null,
    jenisKelamin: null, pendidikanTerakhir: null, jabatan: null, pangkat: null, golonganRuang: "II/a", eselon: null,
    jenisJabatan: null, tmtGolongan: null, mkgTahun: 2, mkgBulan: 0, gajiPokok: null, tmtKgbTerakhir: tgl(2025, 6),
    tmtKgbBerikutnya: tgl(2027, 6), nomorSkTerakhir: null, tanggalSkTerakhir: null, hukdisAda: false,
    hukdisJenis: null, hukdisNomorSk: null, hukdisTmtMulai: null, hukdisTmtBerakhir: null, hukdisKeterangan: null,
    catatanUpt: null, diajukanOleh: "UPT", diajukanAt: new Date(), ditinjauOleh: null, ditinjauAt: null, alasanTolak: null,
    dasarBaruJenis: null, dasarBaruJenisKp: null, dasarBaruNomorSk: null, dasarBaruTanggalSk: null,
    dasarBaruTmt: null, dasarBaruPenetap: null,
  };
  await db.usulanPegawai.create(usulan);
  return { db, usulan };
}

test("KGB yang sedang diproses dihitung ulang, dan SK yang sudah dibuat dilepas dengan nomornya disimpan sebagai draf", async () => {
  await denganDataLokal(async () => {
    const { db, usulan } = await siapkan("sedang_diproses", true);
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const { usulanMenahan } = await import("./usulanMenahan");
    // Selama usulannya menunggu, proses KGB pegawai ini tertahan (ADR-014).
    assert.equal((await usulanMenahan("p1"))?.id, "u1");
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
    assert.equal(await usulanMenahan("p1"), null, "setelah disetujui, prosesnya dapat dilanjutkan");
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

test("usulan yang menyertakan SK penyesuaian ijazah membentuk riwayat kenaikan pangkat, dan masa kerjanya dipotong", async () => {
  await denganDataLokal(async () => {
    const { db, usulan } = await siapkan("sedang_diproses", false);
    const { setujuiUsulan } = await import("./setujuiUsulan");
    // UPT mengusulkan golongan III/a karena penyesuaian ijazah, beserta SK-nya (ADR-030).
    const dariUpt = {
      ...usulan,
      golonganRuang: "III/a",
      mkgTahun: 6,
      mkgBulan: 0,
      dasarBaruJenis: "kp",
      dasarBaruJenisKp: "penyesuaian_ijazah",
      dasarBaruNomorSk: "W.19-KP.03.01-9",
      dasarBaruTanggalSk: tgl(2026, 5, 2),
      dasarBaruTmt: tgl(2026, 4, 1),
      dasarBaruPenetap: "Kepala Kantor Wilayah",
    };
    await db.usulanPegawai.update({ id: "u1" }, dariUpt);

    const lama = await db.pegawai.findUnique({ id: "p1" });
    const hasil = await setujuiUsulan(dariUpt as never, lama, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true);
    assert.match((hasil as { dasarBaru: string }).dasarBaru, /Penyesuaian Ijazah/);

    // Riwayat kenaikan pangkat terbentuk, sehingga SK ini dapat menjadi Atas dasar SK KGB berikutnya (ADR-020).
    const riwayat = await db.riwayatPangkat.findMany({ where: { pegawaiId: "p1" } });
    assert.equal(riwayat.length, 1);
    assert.equal(riwayat[0].nomorSK, "W.19-KP.03.01-9");
    assert.equal(riwayat[0].penetapSK, "Kepala Kantor Wilayah");

    // Golongan II ke III memotong masa kerja golongan 5 tahun; angka yang diketik UPT tidak dipakai apa adanya.
    const baru = await db.pegawai.findUnique({ id: "p1" });
    assert.equal(baru?.golonganRuang, "III/a");
    assert.equal(Number(baru?.mkgTahun), 0);
    assert.equal(Number(riwayat[0].mkgTahunBaru), 0);

    // UPT dikabari saat laporan SK-nya diterapkan (ADR-074): laporan SK berangkat tanpa surat, jadi tidak ada kabar lain.
    const kabar = await db.notifikasi.findMany({ where: { tipe: "usulan_disetujui" } });
    assert.equal(kabar.length, 1);
    assert.equal(kabar[0].referenceId, "u1");
    assert.equal(kabar[0].dibaca, false);
    assert.match(kabar[0].pesan, /Penyesuaian Ijazah/);
  });
});

test("usulan yang mengubah golongan tanpa menyebut SK-nya ditolak saat diajukan", async () => {
  const { kekuranganUsulan } = await import("./usulanPegawai");
  const pegawai = { golonganRuang: "II/a", mkgTahun: 0, mkgBulan: 0, tmtKgbTerakhir: tgl(2025, 6) };
  // Masa kerja lebih dari nol berarti pegawai sudah pernah KGB, jadi berkas wajibnya SK KGB dan SK pangkat.
  const dasar = {
    golonganRuang: "III/a", mkgTahun: 2, mkgBulan: 0, tmtKgbTerakhir: tgl(2025, 6), pathSkTerakhir: "a", pathSkPangkat: "b",
    dasarBaruJenis: "tidak",
  };
  const kurang = kekuranganUsulan(dasar as never, "perubahan", pegawai as never);
  assert.ok(kurang.some((k) => k.includes("sebab perubahan golongan")), kurang.join("; "));
  // Dengan sebabnya disebut, usulan yang sama sudah lengkap.
  assert.deepEqual(
    kekuranganUsulan(
      { ...dasar, dasarBaruJenis: "koreksi" } as never,
      "perubahan",
      pegawai as never,
    ),
    [],
  );
});

test("pejabat penetap SK dasar: isian UPT dipakai; nomor baru tanpa isian memakai saran dari awalan nomornya; nomor sama tidak berubah", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const pegawai = {
      id: "p2", nip: "199001012015032001", nama: "PEGAWAI DUA", tempatLahir: null, tanggalLahir: null,
      jenisKelamin: null, pendidikanTerakhir: null, jabatan: "Penelaah", pangkat: "Penata Tingkat I",
      golonganRuang: "III/d", unitKerja: "Kantor Wilayah", eselon: null, jenisJabatan: null,
      tmtGolongan: tgl(2022, 4), mkgTahun: 14, mkgBulan: 0, gajiPokok: 3919100,
      tmtKgbTerakhir: tgl(2024, 12), tmtKgbBerikutnya: tgl(2026, 12), statusHukdis: false,
      tanggalHukdisBerakhir: null, jenisHukdis: null, keteranganHukdis: null, aktif: true,
      createdAt: new Date(), updatedAt: new Date(), konfirmasiUptTmt: null, konfirmasiUptAt: null,
      konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null, berhentiAlasan: null,
      nomorSkDasar: "W.19-KP.04.04-5591", tanggalSkDasar: tgl(2024, 10, 4), penetapSkDasar: "Kepala Kantor Wilayah lama",
    };
    await db.pegawai.create(pegawai);
    const usulan = (id: string, nomorSkTerakhir: string) => ({
      id, pegawaiId: "p2", satker: "kanwil", status: "menunggu", jenis: "perubahan", nip: null,
      unitKerja: null, nomorSurat: "W.2", tanggalSurat: tgl(2026, 10, 5), pathBerkas: null, pathSkTerakhir: null,
      pathSyaratCpns: null, pathSkPangkat: null, pathSkCpns: null, pathSkPmk: null, nama: null, tempatLahir: null, tanggalLahir: null,
      jenisKelamin: null, pendidikanTerakhir: null, jabatan: "Penelaah Teknis Kebijakan", pangkat: null, golonganRuang: null, eselon: null,
      jenisJabatan: null, tmtGolongan: null, mkgTahun: null, mkgBulan: null, gajiPokok: null, tmtKgbTerakhir: null,
      tmtKgbBerikutnya: null, nomorSkTerakhir, tanggalSkTerakhir: tgl(2024, 10, 4), hukdisAda: false,
      hukdisJenis: null, hukdisNomorSk: null, hukdisTmtMulai: null, hukdisTmtBerakhir: null, hukdisKeterangan: null,
      catatanUpt: null, diajukanOleh: "UPT", diajukanAt: new Date(), ditinjauOleh: null, ditinjauAt: null, alasanTolak: null,
      dasarBaruJenis: null, dasarBaruJenisKp: null, dasarBaruNomorSk: null, dasarBaruTanggalSk: null,
      dasarBaruTmt: null, dasarBaruPenetap: null,
    });

    // Nomor yang sama, hanya berbeda spasi: SK-nya sama, penetapnya tetap.
    const sama = usulan("u2", "W.19-KP.04.04- 5591");
    await db.usulanPegawai.create(sama);
    const hasilSama = await setujuiUsulan(sama as never, await db.pegawai.findUnique({ id: "p2" }), "Peninjau", new Date(), "u1");
    assert.equal(hasilSama.ok, true);
    assert.equal((await db.pegawai.findUnique({ id: "p2" }))?.penetapSkDasar, "Kepala Kantor Wilayah lama");

    // Nomor lain tanpa isian penetap (usulan lama): penetap SK lama tidak berlaku lagi; W.19 disarankan Kanwil Kemenkumham.
    const lain = usulan("u3", "W.19-KP.04.04-7001");
    await db.usulanPegawai.create(lain);
    const hasilLain = await setujuiUsulan(lain as never, await db.pegawai.findUnique({ id: "p2" }), "Peninjau", new Date(), "u1");
    assert.equal(hasilLain.ok, true);
    const sesudah = await db.pegawai.findUnique({ id: "p2" });
    assert.equal(sesudah?.nomorSkDasar, "W.19-KP.04.04-7001");
    assert.equal(sesudah?.penetapSkDasar, "Kepala Kantor Wilayah Kementerian Hukum dan HAM Kalimantan Selatan");

    // Nomor lain tanpa saran dan tanpa isian: dikosongkan, diisi Kanwil saat Input KGB.
    const tanpaSaran = usulan("u4", "SK-LAIN-12");
    await db.usulanPegawai.create(tanpaSaran);
    await setujuiUsulan(tanpaSaran as never, await db.pegawai.findUnique({ id: "p2" }), "Peninjau", new Date(), "u1");
    assert.equal((await db.pegawai.findUnique({ id: "p2" }))?.penetapSkDasar ?? null, null);

    // Isian UPT selalu dipakai, termasuk untuk nomor yang sama.
    const isian = { ...usulan("u5", "SK-LAIN-12"), penetapSkTerakhir: "Kepala Lembaga Pemasyarakatan Kelas IIA Banjarmasin" };
    await db.usulanPegawai.create(isian);
    await setujuiUsulan(isian as never, await db.pegawai.findUnique({ id: "p2" }), "Peninjau", new Date(), "u1");
    assert.equal((await db.pegawai.findUnique({ id: "p2" }))?.penetapSkDasar, "Kepala Lembaga Pemasyarakatan Kelas IIA Banjarmasin");
  });
});

test("pegawai baru yang melaporkan SK penyesuaian ijazah: masa kerja dihitung mundur, SK-nya tercatat sebagai riwayat (ADR-065)", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const { getGajiPokok } = await import("./tabelGaji");
    // KGB terakhir 1 Des 2024 di II/d 11 tahun; PI 1 Jan 2026 ke III/a, di SK tertulis 7 tahun 1 bulan.
    const usulan = {
      id: "u9", pegawaiId: null, satker: "rutan-rantau", status: "menunggu", jenis: "baru", nip: "199101012020121001",
      unitKerja: "Rutan Kelas IIB Rantau", nomorSurat: "W.9", tanggalSurat: tgl(2026, 10, 1), pathBerkas: null,
      pathSkTerakhir: "a", pathSyaratCpns: null, pathSkPangkat: "b", pathSkCpns: null, pathSkPmk: null,
      nama: "PEGAWAI BARU UJI", tempatLahir: null, tanggalLahir: null, jenisKelamin: null, pendidikanTerakhir: null,
      jabatan: "Penjaga Tahanan", pangkat: null, golonganRuang: "III/a", eselon: null, jenisJabatan: null,
      tmtGolongan: tgl(2026, 1), mkgTahun: 7, mkgBulan: 1, gajiPokok: null, tmtKgbTerakhir: tgl(2024, 12),
      tmtKgbBerikutnya: null, nomorSkTerakhir: "W.17-KGB-2024", tanggalSkTerakhir: tgl(2024, 11, 20), hukdisAda: false,
      hukdisJenis: null, hukdisNomorSk: null, hukdisTmtMulai: null, hukdisTmtBerakhir: null, hukdisKeterangan: null,
      catatanUpt: null, diajukanOleh: "UPT", diajukanAt: new Date(), ditinjauOleh: null, ditinjauAt: null, alasanTolak: null,
      dasarBaruJenis: "kp", dasarBaruJenisKp: "penyesuaian_ijazah", dasarBaruNomorSk: "W.17-PI-2026",
      dasarBaruTanggalSk: tgl(2025, 12, 15), dasarBaruTmt: tgl(2026, 1), dasarBaruPenetap: "Kepala Kantor Wilayah",
    };
    await db.usulanPegawai.create(usulan);
    const hasil = await setujuiUsulan(usulan as never, null, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true);
    const pegawai = await db.pegawai.findUnique({ nip: "199101012020121001" });
    assert.equal(pegawai?.golonganRuang, "III/a");
    assert.equal(pegawai?.mkgTahun, 6);
    assert.equal(pegawai?.mkgBulan, 0);
    assert.equal(pegawai?.gajiPokok, getGajiPokok("III/a", 6, 0));
    assert.equal(new Date(pegawai!.tmtKgbBerikutnya!).getTime(), new Date(2026, 11, 1).getTime());
    const riwayat = await db.riwayatPangkat.findMany({ where: { pegawaiId: pegawai!.id } });
    assert.equal(riwayat.length, 1);
    assert.equal(riwayat[0].nomorSK, "W.17-PI-2026");
    // Golongan sebelum SK tidak dilaporkan pada pendataan; penyimpanan membacanya kembali sebagai kosong.
    assert.ok(!riwayat[0].golonganLama);
    assert.match(riwayat[0].keterangan ?? "", /7 tahun 1 bulan pada TMT SK/);
    // Pegawai baru bukan laporan SK atas pegawai yang ada, jadi tidak memicu kabar disetujui.
    assert.equal((await db.notifikasi.findMany({ where: { tipe: "usulan_disetujui" } })).length, 0);
  });
});

test("pegawai baru ber-acuan (ADR-078): dihitung dari SK KGB terakhir, riwayat KP memuat golongan lamanya", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const { getGajiPokok } = await import("./tabelGaji");
    // Skema Admin UPT: KGB terakhir 1 Des 2024 di II/b 7 tahun; PI 1 Feb 2026 ke III/a, di SK 3 tahun 2 bulan.
    const usulan = {
      id: "u10", pegawaiId: null, satker: "rutan-rantau", status: "menunggu", jenis: "baru", nip: "199202022020121002",
      unitKerja: "Rutan Kelas IIB Rantau", nomorSurat: "W.10", tanggalSurat: tgl(2026, 10, 1), pathBerkas: null,
      pathSkTerakhir: "a", pathSyaratCpns: null, pathSkPangkat: "b", pathSkCpns: null, pathSkPmk: null,
      nama: "PEGAWAI BARU ACUAN", tempatLahir: null, tanggalLahir: null, jenisKelamin: null, pendidikanTerakhir: null,
      jabatan: "Penjaga Tahanan", pangkat: null, golonganRuang: "III/a", eselon: null, jenisJabatan: null,
      tmtGolongan: tgl(2022, 4), mkgTahun: 3, mkgBulan: 2, gajiPokok: null, tmtKgbTerakhir: tgl(2024, 12),
      tmtKgbBerikutnya: null, nomorSkTerakhir: "W19.PAS17.KP.04.04-2611", tanggalSkTerakhir: tgl(2024, 10, 3), hukdisAda: false,
      hukdisJenis: null, hukdisNomorSk: null, hukdisTmtMulai: null, hukdisTmtBerakhir: null, hukdisKeterangan: null,
      catatanUpt: null, diajukanOleh: "UPT", diajukanAt: new Date(), ditinjauOleh: null, ditinjauAt: null, alasanTolak: null,
      dasarBaruJenis: "kp", dasarBaruJenisKp: "penyesuaian_ijazah", dasarBaruNomorSk: "SEK-2156.SA.04.05",
      dasarBaruTanggalSk: tgl(2026, 1, 29), dasarBaruTmt: tgl(2026, 2), dasarBaruPenetap: "Sekretaris Jenderal",
      golonganAcuan: "II/b", mkgTahunAcuan: 7, mkgBulanAcuan: 0,
    };
    await db.usulanPegawai.create(usulan);
    const hasil = await setujuiUsulan(usulan as never, null, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true);
    const pegawai = await db.pegawai.findUnique({ nip: "199202022020121002" });
    assert.equal(pegawai?.golonganRuang, "III/a");
    assert.equal(pegawai?.mkgTahun, 2);
    assert.equal(pegawai?.mkgBulan, 0);
    assert.equal(pegawai?.gajiPokok, getGajiPokok("III/a", 2, 0));
    assert.equal(new Date(pegawai!.tmtKgbBerikutnya!).getTime(), new Date(2026, 11, 1).getTime(), "KGB berikutnya 1 Des 2026");
    assert.equal(new Date(pegawai!.tmtGolongan!).getTime(), new Date(2026, 1, 1).getTime(), "TMT golongan = TMT kenaikan pangkat");
    const riwayat = await db.riwayatPangkat.findMany({ where: { pegawaiId: pegawai!.id } });
    assert.equal(riwayat.length, 1);
    assert.equal(riwayat[0].golonganLama, "II/b");
    assert.equal(riwayat[0].mkgTahunLama, 7);
    assert.equal(riwayat[0].mkgTahunBaru, 2);
    assert.equal(riwayat[0].gajiPokokLama, getGajiPokok("II/b", 7, 0));
  });
});

test("pegawai tercatat ber-acuan: masa kerja menurut SK tidak ditulis, yang ditulis hitungan dari data tercatat", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const pegawai = {
      id: "p3", nip: "199303032015031003", nama: "PEGAWAI KP", tempatLahir: null, tanggalLahir: null,
      jenisKelamin: null, pendidikanTerakhir: null, jabatan: "Penjaga Tahanan", pangkat: "Pengatur Muda Tingkat I",
      golonganRuang: "II/b", unitKerja: "Rutan Kelas IIB Rantau", eselon: null, jenisJabatan: null,
      tmtGolongan: tgl(2022, 4), mkgTahun: 7, mkgBulan: 0, gajiPokok: 0,
      tmtKgbTerakhir: tgl(2024, 12), tmtKgbBerikutnya: tgl(2026, 12), statusHukdis: false,
      tanggalHukdisBerakhir: null, jenisHukdis: null, keteranganHukdis: null, aktif: true,
      createdAt: new Date(), updatedAt: new Date(), konfirmasiUptTmt: null, konfirmasiUptAt: null,
      konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null, berhentiAlasan: null,
      nomorSkDasar: null, tanggalSkDasar: null, penetapSkDasar: null,
    };
    await db.pegawai.create(pegawai);
    const usulan = {
      id: "u11", pegawaiId: "p3", satker: "rutan-rantau", status: "menunggu", jenis: "perubahan", nip: null,
      unitKerja: null, nomorSurat: null, tanggalSurat: null, pathBerkas: null, pathSkTerakhir: "a",
      pathSyaratCpns: null, pathSkPangkat: "b", pathSkCpns: null, pathSkPmk: null, nama: null, tempatLahir: null, tanggalLahir: null,
      jenisKelamin: null, pendidikanTerakhir: null, jabatan: null, pangkat: null, golonganRuang: "III/a", eselon: null,
      jenisJabatan: null, tmtGolongan: tgl(2022, 4), mkgTahun: 3, mkgBulan: 2, gajiPokok: null, tmtKgbTerakhir: tgl(2024, 12),
      tmtKgbBerikutnya: null, nomorSkTerakhir: null, tanggalSkTerakhir: null, hukdisAda: false,
      hukdisJenis: null, hukdisNomorSk: null, hukdisTmtMulai: null, hukdisTmtBerakhir: null, hukdisKeterangan: null,
      catatanUpt: null, diajukanOleh: "UPT", diajukanAt: new Date(), ditinjauOleh: null, ditinjauAt: null, alasanTolak: null,
      dasarBaruJenis: "kp", dasarBaruJenisKp: "penyesuaian_ijazah", dasarBaruNomorSk: "SEK-2156.SA.04.05",
      dasarBaruTanggalSk: tgl(2026, 1, 29), dasarBaruTmt: tgl(2026, 2), dasarBaruPenetap: "Sekretaris Jenderal",
      golonganAcuan: "II/b", mkgTahunAcuan: 7, mkgBulanAcuan: 0,
    };
    await db.usulanPegawai.create(usulan);
    const hasil = await setujuiUsulan(usulan as never, await db.pegawai.findUnique({ id: "p3" }), "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true);
    const sesudah = await db.pegawai.findUnique({ id: "p3" });
    assert.equal(sesudah?.golonganRuang, "III/a");
    assert.equal(sesudah?.mkgTahun, 2, "bukan 3 tahun 2 bulan dari SK");
    assert.equal(sesudah?.mkgBulan, 0);
    assert.equal(new Date(sesudah!.tmtKgbBerikutnya!).getTime(), tgl(2026, 12).getTime());
    // Jejak audit memakai hitungan, bukan masa kerja mentah dari SK.
    if (hasil.ok) assert.match(hasil.ringkasPerubahan, /Masa kerja golongan \(tahun\)? ?7 → 2|7 → 2/);
  });
});

/** Pegawai tercatat dan usulan KP-nya untuk uji penerapan yang terputus (ADR-079). */
function kasusTerputus(over: Partial<Record<string, unknown>> = {}) {
  const pegawai = {
    id: "p5", nip: "199812242017122009", nama: "PEGAWAI TERPUTUS", tempatLahir: null, tanggalLahir: null,
    jenisKelamin: null, pendidikanTerakhir: null, jabatan: "Penjaga Tahanan", pangkat: "Pengatur Muda Tingkat I",
    golonganRuang: "II/b", unitKerja: "Lembaga Pemasyarakatan Perempuan Kelas IIA Martapura", eselon: null, jenisJabatan: null,
    tmtGolongan: tgl(2022, 4), mkgTahun: 7, mkgBulan: 0, gajiPokok: 2537600,
    tmtKgbTerakhir: tgl(2024, 12), tmtKgbBerikutnya: tgl(2026, 12), statusHukdis: false,
    tanggalHukdisBerakhir: null, jenisHukdis: null, keteranganHukdis: null, aktif: true,
    createdAt: new Date(), updatedAt: new Date(), konfirmasiUptTmt: null, konfirmasiUptAt: null,
    konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null, berhentiAlasan: null,
    nomorSkDasar: "W19.PAS17.KP.04.04-2611", tanggalSkDasar: tgl(2024, 10, 3), penetapSkDasar: "Kepala Kantor Wilayah",
    ...((over.pegawai as object) ?? {}),
  };
  const usulan = {
    id: "u20", pegawaiId: "p5", satker: "lapas-perempuan-martapura", status: "menunggu", jenis: "perubahan", nip: null,
    unitKerja: null, nomorSurat: "WP.19.PAS.17-SA.04.04-2", tanggalSurat: tgl(2026, 10, 6), pathBerkas: null, pathSkTerakhir: "a",
    pathSyaratCpns: null, pathSkPangkat: "b", pathSkCpns: null, pathSkPmk: null, nama: null, tempatLahir: null, tanggalLahir: null,
    jenisKelamin: null, pendidikanTerakhir: null, jabatan: null, pangkat: null, golonganRuang: "III/a", eselon: null,
    jenisJabatan: null, tmtGolongan: tgl(2022, 4), mkgTahun: 3, mkgBulan: 2, gajiPokok: null, tmtKgbTerakhir: tgl(2024, 12),
    tmtKgbBerikutnya: null, nomorSkTerakhir: null, tanggalSkTerakhir: null, hukdisAda: false,
    hukdisJenis: null, hukdisNomorSk: null, hukdisTmtMulai: null, hukdisTmtBerakhir: null, hukdisKeterangan: null,
    catatanUpt: null, diajukanOleh: "UPT", diajukanAt: new Date(), ditinjauOleh: null, ditinjauAt: null, alasanTolak: null,
    dasarBaruJenis: "kp", dasarBaruJenisKp: "penyesuaian_ijazah", dasarBaruNomorSk: "SEK-2156.SA.04.05 TAHUN 2026",
    dasarBaruTanggalSk: tgl(2026, 1, 29), dasarBaruTmt: tgl(2026, 2), dasarBaruPenetap: "Sekretaris Jenderal",
    golonganAcuan: "II/b", mkgTahunAcuan: 7, mkgBulanAcuan: 0,
    ...((over.usulan as object) ?? {}),
  };
  const riwayat = {
    id: "r5", pegawaiId: "p5", jenisKp: "penyesuaian_ijazah", nomorSK: "SEK-2156.SA.04.05 TAHUN 2026", tanggalSK: tgl(2026, 1, 29),
    tmtPangkat: tgl(2026, 2), golonganLama: "II/b", golonganBaru: "III/a", mkgTahunLama: 7, mkgBulanLama: 0,
    mkgTahunBaru: 2, mkgBulanBaru: 0, gajiPokokLama: 2537600, gajiPokokBaru: 2873500, keterangan: "Dari usulan UPT",
    createdAt: new Date(), createdBy: "u1", penetapSK: "Sekretaris Jenderal",
    ...((over.riwayat as object) ?? {}),
  };
  return { pegawai, usulan, riwayat };
}

test("penerapan yang terputus (SK sudah tercatat, data pegawai belum ikut) dilanjutkan tanpa mencatat dua kali (ADR-079)", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const { pegawai, usulan, riwayat } = kasusTerputus();
    await db.pegawai.create(pegawai);
    await db.usulanPegawai.create(usulan);
    await db.riwayatPangkat.create(riwayat);
    const hasil = await setujuiUsulan(usulan as never, await db.pegawai.findUnique({ id: "p5" }), "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true, JSON.stringify(hasil));
    const sesudah = await db.pegawai.findUnique({ id: "p5" });
    assert.equal(sesudah?.golonganRuang, "III/a");
    assert.equal(sesudah?.mkgTahun, 2);
    assert.equal(new Date(sesudah!.tmtKgbBerikutnya!).getTime(), tgl(2026, 12).getTime());
    const daftar = await db.riwayatPangkat.findMany({ where: { pegawaiId: "p5" } });
    assert.equal(daftar.length, 1, "tidak dicatat dua kali");
    assert.equal((await db.usulanPegawai.findUnique({ id: "u20" }))?.status, "disetujui");
    if (hasil.ok) assert.match(hasil.dasarBaru ?? "", /sudah tercatat dilengkapi/);
  });
});

test("SK yang sudah tercatat dan sudah diterapkan: disetujui tanpa mencatat ulang dan tanpa menimpa masa kerja dengan angka SK", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const { pegawai, usulan, riwayat } = kasusTerputus({
      pegawai: { golonganRuang: "III/a", pangkat: "Penata Muda", mkgTahun: 2, mkgBulan: 0, gajiPokok: 2873500, tmtGolongan: tgl(2026, 2) },
      usulan: { golonganAcuan: "III/a", mkgTahunAcuan: 2, mkgBulanAcuan: 0, tmtGolongan: tgl(2026, 2), jabatan: "Penjaga Tahanan Utama" },
    });
    await db.pegawai.create(pegawai);
    await db.usulanPegawai.create(usulan);
    await db.riwayatPangkat.create(riwayat);
    const hasil = await setujuiUsulan(usulan as never, await db.pegawai.findUnique({ id: "p5" }), "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true, JSON.stringify(hasil));
    const sesudah = await db.pegawai.findUnique({ id: "p5" });
    assert.equal(sesudah?.golonganRuang, "III/a");
    assert.equal(sesudah?.mkgTahun, 2, "bukan 3 tahun 2 bulan dari SK");
    assert.equal(sesudah?.jabatan, "Penjaga Tahanan Utama", "isian lain tetap diterapkan");
    assert.equal((await db.riwayatPangkat.findMany({ where: { pegawaiId: "p5" } })).length, 1);
  });
});

test("data tercatat dibetulkan bersama SK yang sudah tercatat: SK dihitung ulang dari keadaan yang dibetulkan (ADR-079)", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    // Tercatat III/a 5 thn 10 bln (hitungan mundur lama); UPT membetulkan dasar ke II/b 7 thn sesuai SK KGB terakhir.
    const { pegawai, usulan, riwayat } = kasusTerputus({
      pegawai: { golonganRuang: "III/a", pangkat: "Penata Muda", mkgTahun: 5, mkgBulan: 10, gajiPokok: 2964000, tmtGolongan: tgl(2026, 2), tmtKgbBerikutnya: tgl(2025, 2) },
      riwayat: { golonganLama: "", mkgTahunLama: 5, mkgBulanLama: 10, mkgTahunBaru: 5, mkgBulanBaru: 10 },
    });
    await db.pegawai.create(pegawai);
    await db.usulanPegawai.create(usulan);
    await db.riwayatPangkat.create(riwayat);
    const hasil = await setujuiUsulan(usulan as never, await db.pegawai.findUnique({ id: "p5" }), "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true, JSON.stringify(hasil));
    const sesudah = await db.pegawai.findUnique({ id: "p5" });
    assert.equal(sesudah?.golonganRuang, "III/a");
    assert.deepEqual([sesudah?.mkgTahun, sesudah?.mkgBulan], [2, 0]);
    assert.equal(new Date(sesudah!.tmtKgbBerikutnya!).getTime(), new Date(2026, 11, 1).getTime(), "jadwal dari keadaan yang dibetulkan");
    const daftar = await db.riwayatPangkat.findMany({ where: { pegawaiId: "p5" } });
    assert.equal(daftar.length, 1);
    assert.equal(daftar[0].golonganLama, "II/b");
    assert.equal(daftar[0].mkgTahunLama, 7);
    assert.equal(daftar[0].mkgTahunBaru, 2);
  });
});

test("pegawai baru yang sudah terbentuk oleh persetujuan yang terputus: usulannya ditautkan, bukan ditolak NIP ganda", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const dibuat = new Date(Date.UTC(2026, 9, 7, 2, 7));
    const { pegawai } = kasusTerputus({
      pegawai: { id: "p6", nip: "199101012020121777", nama: "PEGAWAI BARU TERPUTUS", createdAt: dibuat, konfirmasiUptAt: dibuat, konfirmasiUptOleh: "UPT" },
    });
    await db.pegawai.create(pegawai);
    const usulan = {
      ...kasusTerputus().usulan, id: "u21", pegawaiId: null, jenis: "baru", nip: "199101012020121777", nama: "PEGAWAI BARU TERPUTUS",
      jabatan: "Penjaga Tahanan", unitKerja: "Lembaga Pemasyarakatan Perempuan Kelas IIA Martapura",
    };
    await db.usulanPegawai.create(usulan);
    const hasil = await setujuiUsulan(usulan as never, null, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true, JSON.stringify(hasil));
    assert.equal((await db.pegawai.findMany({ where: { nip: "199101012020121777" } })).length, 1);
    const u = await db.usulanPegawai.findUnique({ id: "u21" });
    assert.equal(u?.status, "disetujui");
    assert.equal(u?.pegawaiId, "p6");
    const p = await db.pegawai.findUnique({ id: "p6" });
    assert.equal(p?.golonganRuang, "III/a");
    assert.equal(p?.mkgTahun, 2);
    assert.equal((await db.riwayatPangkat.findMany({ where: { pegawaiId: "p6" } })).length, 1);

    // Pegawai yang dicatat Kanwil sendiri (bukan dari persetujuan usulan) tidak dibuat ulang: usulannya diterapkan sebagai
    // perbaikan data pegawai itu (ADR-091).
    const lain = { ...pegawai, id: "p7", nip: "199101012020121778", createdAt: dibuat, konfirmasiUptAt: null };
    await db.pegawai.create(lain);
    const u2 = { ...usulan, id: "u22", nip: "199101012020121778" };
    await db.usulanPegawai.create(u2);
    const perbaikan = await setujuiUsulan(u2 as never, null, "Peninjau", new Date(), "u1");
    assert.equal(perbaikan.ok, true, JSON.stringify(perbaikan));
    assert.equal((await db.pegawai.findMany({ where: { nip: "199101012020121778" } })).length, 1);
    assert.equal((await db.usulanPegawai.findUnique({ id: "u22" }))?.jenis, "perubahan");
  });
});

/** Pegawai p1 yang sudah tercatat beserta usulan pegawai baru ber-NIP sama yang tertinggal (ADR-091). */
async function siapkanBaruTercatat(over: Record<string, unknown> = {}) {
  const { db, usulan } = await siapkan("sedang_diproses", true);
  // Pegawainya pernah diperbaiki lewat usulan yang disetujui, jadi bukan persetujuan yang terputus (ADR-079).
  await db.usulanPegawai.update({ id: usulan.id }, { status: "disetujui" });
  const baru = {
    ...usulan, id: "u30", pegawaiId: null, jenis: "baru", nip: "199001012015031001", unitKerja: "Rutan Kelas IIB Rantau",
    nama: "PEGAWAI UJI", jabatan: "Penjaga Tahanan", pangkat: "Pengatur Muda", golonganRuang: "II/a", tmtGolongan: tgl(2025, 6),
    mkgTahun: 0, mkgBulan: 0, gajiPokok: 2184000, tmtKgbTerakhir: tgl(2025, 6), tmtKgbBerikutnya: tgl(2026, 6),
    nomorSurat: "WP.19.PAS17-SA.04.04-2",
    ...over,
  };
  await db.usulanPegawai.create(baru);
  return { db, baru };
}

test("usulan pegawai baru yang NIP-nya sudah tercatat di satker yang sama diterapkan sebagai perbaikan data (ADR-091)", async () => {
  await denganDataLokal(async () => {
    const { db, baru } = await siapkanBaruTercatat();
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const hasil = await setujuiUsulan(baru as never, null, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true, JSON.stringify(hasil));
    if (!hasil.ok) return;
    assert.equal(hasil.pegawaiId, "p1");
    assert.equal(hasil.jumlahPerubahan, 0);
    assert.match(hasil.ringkasPerubahan, /NIP sudah tercatat, diterapkan sebagai perbaikan data: tanpa perubahan kolom/);
    assert.equal((await db.pegawai.findMany({ where: { nip: "199001012015031001" } })).length, 1, "tidak ada pegawai ganda");
    const u = await db.usulanPegawai.findUnique({ id: "u30" });
    assert.equal(u?.status, "disetujui");
    assert.equal(u?.jenis, "perubahan");
    assert.equal(u?.pegawaiId, "p1");
    assert.equal(u?.unitKerja, null);
    // Isiannya sama dengan data tercatat, jadi KGB yang berjalan dan SK-nya tidak tersentuh.
    assert.equal(hasil.penyesuaianKgb, null);
    assert.notEqual(await db.suratKGB.findUnique({ kgbId: "k1" }), null);
  });
});

test("isian usulan pegawai baru yang berbeda dari data tercatat diterapkan seperti usulan perbaikan (ADR-091)", async () => {
  await denganDataLokal(async () => {
    const { db, baru } = await siapkanBaruTercatat({ jabatan: "Pengelola Keamanan" });
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const hasil = await setujuiUsulan(baru as never, null, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true, JSON.stringify(hasil));
    if (!hasil.ok) return;
    assert.equal(hasil.jumlahPerubahan, 1);
    assert.match(hasil.ringkasPerubahan, /Jabatan Penjaga Tahanan → Pengelola Keamanan/);
    assert.equal((await db.pegawai.findUnique({ id: "p1" }))?.jabatan, "Pengelola Keamanan");
  });
});

test("usulan pegawai baru yang NIP-nya tercatat di satker lain tetap ditolak tanpa mengubah apa pun (ADR-091)", async () => {
  await denganDataLokal(async () => {
    const { db, baru } = await siapkanBaruTercatat({ satker: "lapas-perempuan-martapura", unitKerja: null });
    const { setujuiUsulan } = await import("./setujuiUsulan");
    const hasil = await setujuiUsulan(baru as never, null, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, false);
    assert.match(hasil.ok ? "" : hasil.pesan, /sudah tercatat atas nama PEGAWAI UJI di Rutan Kelas IIB Rantau/);
    assert.match(hasil.ok ? "" : hasil.pesan, /Pemindahan antarsatker dicatat Kanwil/);
    const u = await db.usulanPegawai.findUnique({ id: "u30" });
    assert.equal(u?.jenis, "baru");
    assert.equal(u?.status, "menunggu");
  });
});
