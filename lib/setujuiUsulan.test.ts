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

test("usulan yang mengganti nomor SK dasar mengosongkan pejabat penetap SK lama; nomor yang sama (beda spasi) tidak", async () => {
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

    // Nomor lain: penetap SK lama tidak berlaku lagi untuk SK baru.
    const lain = usulan("u3", "W.19-KP.04.04-7001");
    await db.usulanPegawai.create(lain);
    const hasilLain = await setujuiUsulan(lain as never, await db.pegawai.findUnique({ id: "p2" }), "Peninjau", new Date(), "u1");
    assert.equal(hasilLain.ok, true);
    const sesudah = await db.pegawai.findUnique({ id: "p2" });
    assert.equal(sesudah?.nomorSkDasar, "W.19-KP.04.04-7001");
    assert.equal(sesudah?.penetapSkDasar ?? null, null);
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
