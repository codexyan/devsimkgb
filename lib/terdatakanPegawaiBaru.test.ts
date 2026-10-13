// Pegawai baru dari UPT langsung terdata begitu drafnya lengkap (ADR-112), di atas penyimpanan lokal.
//
// Jalankan: node --import tsx --test lib/terdatakanPegawaiBaru.test.ts

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

async function denganDataLokal(kerja: () => Promise<void>) {
  const folder = await mkdtemp(path.join(tmpdir(), "simkgb-terdata-"));
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
const NIP = "199101012020121001";

/** Draf pegawai baru yang lengkap: CPNS yang belum pernah KGB, tanpa SK sesudahnya (II/c, 3 tahun, TMT KGB terakhir TMT CPNS). */
function drafLengkap(over: Record<string, unknown> = {}) {
  return {
    id: "u1", pegawaiId: null, satker: "rutan-rantau", status: "draf", jenis: "baru", nip: NIP,
    unitKerja: "Rutan Kelas IIB Rantau", nomorSurat: null, tanggalSurat: null, pathBerkas: null,
    pathSkTerakhir: "usulan/sk.pdf", pathSyaratCpns: "usulan/syarat.pdf", pathSkPangkat: null, pathSkCpns: "usulan/cpns.pdf", pathSkPmk: null,
    nama: "PEGAWAI BARU UJI", tempatLahir: "Rantau", tanggalLahir: tgl(1991, 1, 1), jenisKelamin: "Laki-laki", pendidikanTerakhir: "S1",
    jabatan: "Penjaga Tahanan", pangkat: null, golonganRuang: "II/c", eselon: null, jenisJabatan: null,
    tmtGolongan: tgl(2024, 1), mkgTahun: 3, mkgBulan: 0, gajiPokok: null, tmtKgbTerakhir: tgl(2024, 1),
    tmtKgbBerikutnya: tgl(2026, 1), nomorSkTerakhir: "W.17-CPNS-2020", tanggalSkTerakhir: tgl(2020, 12, 1), penetapSkTerakhir: "Kepala Kantor Wilayah",
    keadaanKgb: "belum", hukdisAda: false, hukdisJenis: null, hukdisNomorSk: null, hukdisTmtMulai: null, hukdisTmtBerakhir: null,
    hukdisKeterangan: null, catatanUpt: null, diajukanOleh: "UPT", diajukanAt: null, ditinjauOleh: null, ditinjauAt: null,
    alasanTolak: null, dasarBaruJenis: "tidak", dasarBaruJenisKp: null, dasarBaruNomorSk: null, dasarBaruTanggalSk: null,
    dasarBaruTmt: null, dasarBaruPenetap: null,
    ...over,
  };
}

async function simpanDraf(over: Record<string, unknown> = {}) {
  const { db } = await import("./db");
  const draf = drafLengkap(over);
  await db.usulanPegawai.create(draf as never);
  return { db, draf };
}

test("fixture draf lengkap memang lengkap, dan yang tanpa berkas atau nama tidak", async () => {
  const { kekuranganUsulan } = await import("./usulanPegawai");
  assert.deepEqual(kekuranganUsulan(drafLengkap() as never, "baru", null), []);
  assert.ok(kekuranganUsulan(drafLengkap({ nama: "" }) as never, "baru", null).includes("nama lengkap"));
  assert.ok(kekuranganUsulan(drafLengkap({ pathSkCpns: null }) as never, "baru", null).length > 0);
});

test("draf lengkap langsung membuat pegawai aktif yang tertaut, tanpa surat dan tanpa tinjauan", async () => {
  await denganDataLokal(async () => {
    const { db, draf } = await simpanDraf();
    const { terdatakanPegawaiBaru } = await import("./terdatakanPegawaiBaru");
    const hasil = await terdatakanPegawaiBaru(draf as never);
    assert.equal(hasil.hasil, "dibuat");
    if (hasil.hasil !== "dibuat") return;

    const pegawai = await db.pegawai.findUnique({ nip: NIP });
    assert.equal(pegawai?.id, hasil.pegawaiId);
    assert.equal(pegawai?.aktif, true);
    assert.equal(pegawai?.nama, "PEGAWAI BARU UJI");
    assert.equal(pegawai?.unitKerja, "Rutan Kelas IIB Rantau");
    assert.equal(pegawai?.golonganRuang, "II/c");
    assert.ok((pegawai?.gajiPokok ?? 0) > 0, "gaji pokok dihitung dari tabel PP 5/2024");
    assert.ok(pegawai?.tmtKgbBerikutnya, "jadwal KGB berikutnya terhitung");
    assert.equal(pegawai?.nomorSkDasar, "W.17-CPNS-2020");

    // Usulannya tidak berubah kecuali tautannya: tetap draf pegawai baru, belum diajukan.
    const usulan = await db.usulanPegawai.findUnique({ id: "u1" });
    assert.equal(usulan?.pegawaiId, hasil.pegawaiId);
    assert.equal(usulan?.jenis, "baru");
    assert.equal(usulan?.status, "draf");
    assert.equal(usulan?.nomorSurat, null);
  });
});

test("disimpan ulang memperbarui pegawai di tempat; yang dicatat Kanwil sesudahnya tidak ditimpa", async () => {
  await denganDataLokal(async () => {
    const { db, draf } = await simpanDraf();
    const { terdatakanPegawaiBaru } = await import("./terdatakanPegawaiBaru");
    const pertama = await terdatakanPegawaiBaru(draf as never);
    assert.equal(pertama.hasil, "dibuat");
    if (pertama.hasil !== "dibuat") return;

    // Kanwil mencatat hukdis dan mutasi pada pegawai itu; UPT lalu membetulkan jabatannya.
    await db.pegawai.update({ id: pertama.pegawaiId }, { statusHukdis: true, jenisHukdis: "sedang", satkerTugas: "Lapas Banjarmasin" });
    await db.usulanPegawai.update({ id: "u1" }, { jabatan: "Pengamanan Tahanan" });
    const tersimpan = await db.usulanPegawai.findUnique({ id: "u1" });
    const kedua = await terdatakanPegawaiBaru(tersimpan as never);
    assert.deepEqual(kedua, { hasil: "diperbarui", pegawaiId: pertama.pegawaiId });

    assert.equal((await db.pegawai.findMany({ where: { nip: NIP } })).length, 1, "tidak ada pegawai ganda");
    const pegawai = await db.pegawai.findUnique({ id: pertama.pegawaiId });
    assert.equal(pegawai?.jabatan, "Pengamanan Tahanan");
    assert.equal(pegawai?.statusHukdis, true);
    assert.equal(pegawai?.jenisHukdis, "sedang");
    assert.equal(pegawai?.satkerTugas, "Lapas Banjarmasin");
  });
});

test("draf yang belum lengkap, bukan pegawai baru, sudah selesai, atau ber-NIP yang sudah tercatat tidak membuat pegawai", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { terdatakanPegawaiBaru } = await import("./terdatakanPegawaiBaru");

    const belumLengkap = await terdatakanPegawaiBaru(drafLengkap({ pathSkCpns: null, jabatan: "" }) as never);
    assert.equal(belumLengkap.hasil, "belum");
    assert.equal(belumLengkap.hasil === "belum" ? belumLengkap.alasan : "", "belum_lengkap");
    assert.ok(belumLengkap.hasil === "belum" && belumLengkap.kurang?.includes("jabatan"));

    const perbaikan = await terdatakanPegawaiBaru(drafLengkap({ jenis: "perubahan", pegawaiId: "p9" }) as never);
    assert.equal(perbaikan.hasil === "belum" ? perbaikan.alasan : "", "bukan_pegawai_baru");

    for (const status of ["disetujui", "ditolak"]) {
      const selesai = await terdatakanPegawaiBaru(drafLengkap({ status }) as never);
      assert.equal(selesai.hasil === "belum" ? selesai.alasan : "", "bukan_di_tangan_upt", status);
    }

    assert.equal((await db.pegawai.findMany()).length, 0, "tidak ada pegawai yang terbentuk dari semuanya");

    // NIP yang sudah dipakai pegawai lain dibiarkan: ADR-091 menanganinya saat diajukan.
    const { draf } = await simpanDraf();
    await db.pegawai.create({
      id: "lain", nip: NIP, nama: "PEGAWAI LAMA", tempatLahir: null, tanggalLahir: null, jenisKelamin: null, pendidikanTerakhir: null,
      jabatan: "Penjaga", pangkat: "Pengatur", golonganRuang: "II/c", unitKerja: "Rutan Kelas IIB Rantau", eselon: null, jenisJabatan: null,
      tmtGolongan: tgl(2020, 1), mkgTahun: 3, mkgBulan: 0, gajiPokok: 2000000, tmtKgbTerakhir: tgl(2024, 1), tmtKgbBerikutnya: tgl(2026, 1),
      statusHukdis: false, tanggalHukdisBerakhir: null, jenisHukdis: null, keteranganHukdis: null, aktif: true,
      createdAt: new Date(), updatedAt: new Date(), konfirmasiUptTmt: null, konfirmasiUptAt: null, konfirmasiUptOleh: null,
      satkerTugas: null, berhentiTmt: null, berhentiAlasan: null, nomorSkDasar: null, tanggalSkDasar: null, penetapSkDasar: null,
    } as never);
    const bentrok = await terdatakanPegawaiBaru(draf as never);
    assert.equal(bentrok.hasil === "belum" ? bentrok.alasan : "", "nip_sudah_tercatat");
    assert.equal((await db.pegawai.findUnique({ nip: NIP }))?.nama, "PEGAWAI LAMA", "pegawai yang ada tidak tersentuh");
    assert.equal((await db.usulanPegawai.findUnique({ id: "u1" }))?.pegawaiId, null, "drafnya tidak ditautkan ke pegawai orang lain");
  });
});

test("tautan yang menggantung (pegawainya sudah dihapus permanen) dibuatkan lagi", async () => {
  await denganDataLokal(async () => {
    const { db, draf } = await simpanDraf({ pegawaiId: "hilang" });
    const { terdatakanPegawaiBaru } = await import("./terdatakanPegawaiBaru");
    const hasil = await terdatakanPegawaiBaru(draf as never);
    assert.equal(hasil.hasil, "dibuat");
    if (hasil.hasil !== "dibuat") return;
    assert.notEqual(hasil.pegawaiId, "hilang");
    assert.equal((await db.usulanPegawai.findUnique({ id: "u1" }))?.pegawaiId, hasil.pegawaiId);
  });
});

test("Input KGB ditahan sejak draf terdata sampai usulan pertamanya disetujui, tanpa menggandakan pegawai", async () => {
  await denganDataLokal(async () => {
    const { db, draf } = await simpanDraf();
    const { terdatakanPegawaiBaru, idPegawaiBelumDitinjau } = await import("./terdatakanPegawaiBaru");
    const { usulanMenahan, pesanUsulanMenahan } = await import("./usulanMenahan");
    const { setujuiUsulan } = await import("./setujuiUsulan");

    const dibuat = await terdatakanPegawaiBaru(draf as never);
    assert.equal(dibuat.hasil, "dibuat");
    if (dibuat.hasil !== "dibuat") return;
    const id = dibuat.pegawaiId;

    // Draf, dikembalikan, dan menunggu: ketiganya menahan, dan pesannya menyebut keadaannya.
    for (const status of ["draf", "revisi", "menunggu"] as const) {
      await db.usulanPegawai.update({ id: "u1" }, { status });
      const menahan = await usulanMenahan(id);
      assert.equal(menahan?.id, "u1", status);
      assert.ok((await idPegawaiBelumDitinjau()).has(id), status);
      const pesan = pesanUsulanMenahan("PEGAWAI BARU UJI", menahan);
      assert.match(pesan, /belum ditinjau Kanwil/, status);
    }
    assert.match(pesanUsulanMenahan("X", { jenis: "baru", status: "draf" }), /belum mengajukan usulannya/);
    assert.match(pesanUsulanMenahan("X", { jenis: "baru", status: "revisi" }), /dikembalikan ke UPT/);
    assert.match(pesanUsulanMenahan("X", { jenis: "baru", status: "menunggu" }), /tinjau usulannya di Usulan UPT/);
    assert.match(pesanUsulanMenahan("X", { jenis: "perubahan", status: "menunggu" }), /usulan perbaikan data/);

    // Kanwil menyetujui: pegawai yang sama dilanjutkan, bukan ditolak sebagai NIP ganda dan bukan dibuat ulang.
    await db.usulanPegawai.update({ id: "u1" }, { nomorSurat: "W.1", tanggalSurat: tgl(2026, 10, 1), diajukanAt: new Date() });
    const menunggu = await db.usulanPegawai.findUnique({ id: "u1" });
    const hasil = await setujuiUsulan(menunggu as never, null, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true, JSON.stringify(hasil));
    if (hasil.ok) assert.match(hasil.ringkasPerubahan ?? "", /ditinjau dan disetujui/);

    assert.equal((await db.pegawai.findMany({ where: { nip: NIP } })).length, 1);
    const sesudah = await db.usulanPegawai.findUnique({ id: "u1" });
    assert.equal(sesudah?.status, "disetujui");
    assert.equal(sesudah?.jenis, "baru", "tetap tercatat sebagai usulan pegawai baru");
    assert.equal(sesudah?.pegawaiId, id);
    assert.equal(await usulanMenahan(id), null, "Input KGB dibuka");
    assert.equal((await idPegawaiBelumDitinjau()).has(id), false);
  });
});

test("usulan perbaikan yang menunggu tetap menahan seperti sebelumnya, dan yang ditolak atau disetujui tidak", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { usulanMenahan } = await import("./usulanMenahan");
    const perbaikan = (id: string, status: string) =>
      db.usulanPegawai.create(drafLengkap({ id, jenis: "perubahan", pegawaiId: "p1", status, nip: null }) as never);
    await perbaikan("a", "draf");
    await perbaikan("b", "revisi");
    assert.equal(await usulanMenahan("p1"), null, "perbaikan yang masih di tangan UPT tidak menahan Kanwil");
    await perbaikan("c", "menunggu");
    assert.equal((await usulanMenahan("p1"))?.id, "c");
    await db.usulanPegawai.update({ id: "c" }, { status: "disetujui" });
    await db.usulanPegawai.create(drafLengkap({ id: "d", pegawaiId: "p1", status: "ditolak" }) as never);
    assert.equal(await usulanMenahan("p1"), null, "baris ditolak lama tidak menahan selamanya");
  });
});

test("data utama yang terisi sudah cukup untuk terdata, tanpa berkas, pejabat penetap, atau jawaban SK baru (ADR-113)", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { terdatakanPegawaiBaru } = await import("./terdatakanPegawaiBaru");
    const { kekuranganUsulan, kekuranganPendataanBaru } = await import("./usulanPegawai");

    const tanpaBerkas = drafLengkap({
      pathSkTerakhir: null, pathSyaratCpns: null, pathSkCpns: null, penetapSkTerakhir: null, nomorSkTerakhir: null,
      tanggalSkTerakhir: null, dasarBaruJenis: null, keadaanKgb: null,
    });
    assert.ok(kekuranganUsulan(tanpaBerkas as never, "baru", null).length > 0, "untuk diajukan, masih banyak yang kurang");
    assert.deepEqual(kekuranganPendataanBaru(tanpaBerkas as never), [], "untuk terdata, data utamanya sudah cukup");

    const { draf } = await simpanDraf(tanpaBerkas);
    const hasil = await terdatakanPegawaiBaru(draf as never);
    assert.equal(hasil.hasil, "dibuat");
    assert.equal((await db.pegawai.findUnique({ nip: NIP }))?.nama, "PEGAWAI BARU UJI");

    // Golongan, masa kerja yang cocok dengan tabel gaji, dan TMT KGB terakhir tetap wajib.
    for (const [kurangnya, ubah] of [
      ["golongan/ruang", { golonganRuang: null }],
      ["TMT KGB terakhir", { tmtKgbTerakhir: null }],
      ["nama lengkap", { nama: "" }],
      ["jabatan", { jabatan: "" }],
    ] as const) {
      const kurang = kekuranganPendataanBaru(drafLengkap(ubah as never) as never);
      assert.ok(kurang.includes(kurangnya), `${kurangnya}: ${kurang.join(", ")}`);
    }
    assert.ok(kekuranganPendataanBaru(drafLengkap({ mkgTahun: 1 }) as never).some((k) => /masa kerja golongan yang cocok/.test(k)));
  });
});

test("jadwal yang digeser hukuman disiplin penunda KGB tidak ditimpa saat draf disimpan ulang atau disetujui (ADR-113)", async () => {
  await denganDataLokal(async () => {
    const { db, draf } = await simpanDraf();
    const { terdatakanPegawaiBaru, jadwalDigeserHukdis } = await import("./terdatakanPegawaiBaru");
    const { catatHukdis } = await import("./catatHukdis");
    const { setujuiUsulan } = await import("./setujuiUsulan");

    const dibuat = await terdatakanPegawaiBaru(draf as never);
    assert.equal(dibuat.hasil, "dibuat");
    if (dibuat.hasil !== "dibuat") return;
    const id = dibuat.pegawaiId;
    const awal = await db.pegawai.findUnique({ id });
    assert.equal(await jadwalDigeserHukdis(id), false);

    // SDM Hukdis Kanwil mencatat penundaan KGB 12 bulan pada pegawai yang datanya belum ditinjau.
    const catat = await catatHukdis(
      id,
      { jenisHukdis: "penundaan_kgb", nomorSK: "HD-1", tanggalSK: "2025-12-15", tmtMulai: "2025-12-01", tmtBerakhir: "2026-11-30", berdampakKGB: true, durasiTunda: 12 },
      "u-hukdis",
    );
    assert.equal(catat.ok, true, JSON.stringify(catat));
    const digeser = await db.pegawai.findUnique({ id });
    assert.notEqual(new Date(digeser!.tmtKgbBerikutnya!).getTime(), new Date(awal!.tmtKgbBerikutnya!).getTime(), "jadwalnya bergeser");
    assert.equal(await jadwalDigeserHukdis(id), true);

    // UPT membetulkan jabatan pada drafnya: kolom itu ikut berubah, jadwalnya tidak kembali ke hitungan draf.
    await db.usulanPegawai.update({ id: "u1" }, { jabatan: "Pengamanan Tahanan" });
    const kedua = await terdatakanPegawaiBaru((await db.usulanPegawai.findUnique({ id: "u1" })) as never);
    assert.equal(kedua.hasil, "diperbarui");
    const sesudahSimpan = await db.pegawai.findUnique({ id });
    assert.equal(sesudahSimpan?.jabatan, "Pengamanan Tahanan");
    assert.equal(new Date(sesudahSimpan!.tmtKgbBerikutnya!).getTime(), new Date(digeser!.tmtKgbBerikutnya!).getTime());
    assert.equal(new Date(sesudahSimpan!.tmtKgbTerakhir!).getTime(), new Date(digeser!.tmtKgbTerakhir!).getTime());
    assert.equal(sesudahSimpan?.statusHukdis, digeser?.statusHukdis, "penanda hukdis tidak tersentuh");

    // Persetujuan Kanwil melanjutkan pegawai yang sama dengan jaminan yang sama.
    await db.usulanPegawai.update({ id: "u1" }, { status: "menunggu", nomorSurat: "W.1", tanggalSurat: tgl(2026, 10, 1), diajukanAt: new Date() });
    const menunggu = await db.usulanPegawai.findUnique({ id: "u1" });
    const hasil = await setujuiUsulan(menunggu as never, null, "Peninjau", new Date(), "u1");
    assert.equal(hasil.ok, true, JSON.stringify(hasil));
    const disetujui = await db.pegawai.findUnique({ id });
    assert.equal(new Date(disetujui!.tmtKgbBerikutnya!).getTime(), new Date(digeser!.tmtKgbBerikutnya!).getTime(), "jadwal tetap bergeser");
    assert.equal((await db.pegawai.findMany({ where: { nip: NIP } })).length, 1);
  });
});
