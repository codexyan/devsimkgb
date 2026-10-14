// Proyeksi sementara jadwal KGB dari laporan hukdis yang menunggu Kanwil (ADR-114).
//
// Jalankan: node --import tsx --test lib/proyeksiHukdis.test.ts

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DURASI_TUNDA_BAWAAN, dampakJenisHukdis, jsonProyeksiHukdis, proyeksiLaporanHukdis, tentukanDampakIsian } from "./proyeksiHukdis";

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

test("dampak dari isian peninjau: yang diketik menang, yang kosong mengikuti katalog, lama tunda 1 sampai 60 bulan (ADR-116)", () => {
  const katalog = { berdampakKGB: true, durasiTunda: 6 };
  assert.deepEqual(tentukanDampakIsian("x", katalog, {}), { ok: true, berdampakKGB: true, durasiTunda: 6 });
  assert.deepEqual(tentukanDampakIsian("x", katalog, { berdampakKGB: true, durasiTunda: 9 }), { ok: true, berdampakKGB: true, durasiTunda: 9 });
  assert.deepEqual(tentukanDampakIsian("x", katalog, { berdampakKGB: false, durasiTunda: 9 }), { ok: true, berdampakKGB: false, durasiTunda: null });
  assert.deepEqual(tentukanDampakIsian("x", null, { berdampakKGB: true, durasiTunda: "kosong" }), { ok: true, berdampakKGB: true, durasiTunda: DURASI_TUNDA_BAWAAN });
  assert.deepEqual(tentukanDampakIsian("x", null, { berdampakKGB: true, durasiTunda: "7" }), { ok: true, berdampakKGB: true, durasiTunda: 7 });
  const terlalu = tentukanDampakIsian("x", katalog, { berdampakKGB: true, durasiTunda: 61 });
  assert.equal(terlalu.ok, false);
  assert.match(terlalu.ok ? "" : terlalu.alasan, /1 sampai 60 bulan/);
  assert.equal(tentukanDampakIsian("x", katalog, { berdampakKGB: false, durasiTunda: 99 }).ok, true, "lama tunda diabaikan bila tidak menunda");
});

test("bentuk JSON proyeksi: tanggal kalender, penanda KGB berjalan, dan alasan penolakan utuh", () => {
  const kgbAktif = { tmtKgbBaru: tgl(2026, 12), tmtKgbBerikutnya: tgl(2028, 12), status: "sedang_diproses" };
  const sesudahKgb = proyeksiLaporanHukdis({
    pegawai: { ...pegawai, tmtKgbBerikutnya: tgl(2026, 12) },
    kgbAktif,
    laporan: { jenisHukdis: "penundaan_kgb", tmtMulai: tgl(2027, 2) },
    jenis: null,
    hariIni,
  });
  assert.deepEqual(jsonProyeksiHukdis(sesudahKgb), {
    aksi: "geser", dari: "2028-12-01T00:00:00.000Z", ke: "2029-12-01T00:00:00.000Z", bulan: 12, sesudahKgbBerjalan: true,
  });
  const biasa = proyeksiLaporanHukdis({ pegawai, laporan: { jenisHukdis: "penundaan_kgb", tmtMulai: tgl(2027, 1) }, jenis: null, hariIni });
  assert.deepEqual(jsonProyeksiHukdis(biasa), {
    aksi: "geser", dari: "2027-06-01T00:00:00.000Z", ke: "2028-06-01T00:00:00.000Z", bulan: 12, sesudahKgbBerjalan: false,
  });
  assert.deepEqual(jsonProyeksiHukdis({ aksi: "tidak_menunda" }), { aksi: "tidak_menunda" });
  const tolak = proyeksiLaporanHukdis({
    pegawai: { ...pegawai, tmtKgbBerikutnya: tgl(2026, 12) },
    kgbAktif,
    laporan: { jenisHukdis: "penundaan_kgb", tmtMulai: tgl(2026, 11) },
    jenis: null,
    hariIni,
  });
  const json = jsonProyeksiHukdis(tolak);
  assert.equal(json.aksi, "tolak");
  assert.match(json.aksi === "tolak" ? json.alasan : "", /Batalkan KGB tersebut terlebih dahulu/, "alasan utuh, tidak dipotong");
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
    // Tunggu penulisan terakhir (catatan audit) selesai sebelum berkas ujinya dilepas; menyetel variabel ke undefined
    // menyimpannya sebagai teks "undefined", sehingga penulisan yang tertinggal membuat berkas bernama itu di repo.
    await (globalThis as { __antrianDataLokal?: Promise<unknown> }).__antrianDataLokal;
    pulihkanEnv("DATA_BACKEND", simpan.backend);
    pulihkanEnv("DATA_LOKAL_BERKAS", simpan.berkas);
    await rm(folder, { recursive: true, force: true });
  }
}

function pulihkanEnv(nama: string, nilai: string | undefined) {
  if (nilai === undefined) delete process.env[nama];
  else process.env[nama] = nilai;
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

test("sisi Kanwil: semua laporan menunggu dari seluruh UPT diproyeksikan, dan perkiraan formulir mengikuti isian persis seperti pencatatan (ADR-116)", async () => {
  await denganDataLokal(async () => {
    const { db } = await import("./db");
    const { catatHukdis } = await import("./catatHukdis");
    const { proyeksiIsianHukdis, proyeksiSemuaLaporanMenunggu } = await import("./proyeksiHukdisServer");

    const buatPegawai = (id: string, nip: string, tmtKgbBerikutnya: Date) =>
      db.pegawai.create({
        id, nip, nama: `PEGAWAI ${id}`, tempatLahir: null, tanggalLahir: null, jenisKelamin: null,
        pendidikanTerakhir: null, jabatan: "Penjaga", pangkat: "Pengatur", golonganRuang: "II/c", unitKerja: "Rumah Tahanan Negara Kelas IIB Rantau",
        eselon: null, jenisJabatan: null, tmtGolongan: tgl(2025, 6), mkgTahun: 3, mkgBulan: 0, gajiPokok: 2485900,
        tmtKgbTerakhir: tgl(2025, 6), tmtKgbBerikutnya, statusHukdis: false, tanggalHukdisBerakhir: null,
        jenisHukdis: null, keteranganHukdis: null, aktif: true, createdAt: new Date(), updatedAt: new Date(),
        konfirmasiUptTmt: null, konfirmasiUptAt: null, konfirmasiUptOleh: null, satkerTugas: null, berhentiTmt: null,
        berhentiAlasan: null, nomorSkDasar: null, tanggalSkDasar: null, penetapSkDasar: null,
      } as never);
    await buatPegawai("pa", "199101012020121001", tgl(2027, 6));
    await buatPegawai("pb", "199202022021122002", tgl(2027, 9));
    await buatPegawai("pc", "199303032022123003", tgl(2027, 3));
    const laporan = (id: string, pegawaiId: string, satker: string, status: string, tmtMulai: Date) => ({
      id, pegawaiId, satker, jenisHukdis: "penundaan_kgb", nomorSK: "HD-1", tanggalSK: tgl(2026, 12, 15),
      tmtMulai, tmtBerakhir: tgl(2027, 12, 31), keterangan: null, pathBerkas: null, status, catatanKanwil: null,
      dilaporkanOleh: "UPT", dilaporkanAt: new Date(), ditinjauOleh: null, ditinjauAt: null, riwayatId: null,
    });
    await db.laporanHukdis.create(laporan("la", "pa", "rutan-rantau", "menunggu", tgl(2027, 1)) as never);
    await db.laporanHukdis.create(laporan("lb", "pb", "lapas-banjarmasin", "menunggu", tgl(2027, 1)) as never);
    await db.laporanHukdis.create(laporan("lc", "pc", "rutan-rantau", "menunggu", tgl(2027, 8)) as never); // sesudah TMT KGB yang belum diinput
    await db.laporanHukdis.create(laporan("ld", "pa", "rutan-rantau", "diterima", tgl(2027, 1)) as never);
    const semua = (await db.laporanHukdis.findMany()) as never[];

    const perkiraan = await proyeksiSemuaLaporanMenunggu(semua, hariIni);
    assert.deepEqual([...perkiraan.keys()].sort(), ["la", "lb", "lc"], "lintas satker, yang sudah dicatat tidak ikut");
    assert.equal(perkiraan.get("la")?.aksi, "geser");
    assert.equal(perkiraan.get("lb")?.aksi, "geser");
    assert.equal(perkiraan.get("lc")?.aksi, "tolak");

    // Perkiraan formulir: bawaan katalog (tanpa baris katalog, penundaan_kgb menunda 12 bulan).
    const bawaan = await proyeksiIsianHukdis({ pegawaiId: "pa", jenisHukdis: "penundaan_kgb", tmtMulai: "2027-01-01", hariIni });
    assert.equal(bawaan?.aksi === "geser" ? bulanIso(bawaan.tmtBaru) : "", "2028-06");
    // Peninjau menimpa lama penundaan menjadi 6 bulan, lalu menonaktifkan dampak.
    const enam = await proyeksiIsianHukdis({ pegawaiId: "pa", jenisHukdis: "penundaan_kgb", tmtMulai: "2027-01-01", berdampakKGB: true, durasiTunda: "6", hariIni });
    assert.equal(enam?.aksi === "geser" ? bulanIso(enam.tmtBaru) : "", "2027-12");
    assert.deepEqual(await proyeksiIsianHukdis({ pegawaiId: "pa", jenisHukdis: "penundaan_kgb", tmtMulai: "2027-01-01", berdampakKGB: false, hariIni }), { aksi: "tidak_menunda" });
    // Isian yang ditolak pencatatan juga ditolak perkiraan, dengan alasan yang sama.
    const terlalu = await proyeksiIsianHukdis({ pegawaiId: "pa", jenisHukdis: "penundaan_kgb", tmtMulai: "2027-01-01", berdampakKGB: true, durasiTunda: "99", hariIni });
    assert.equal(terlalu?.aksi, "tolak");
    const terlambat = await proyeksiIsianHukdis({ pegawaiId: "pc", jenisHukdis: "penundaan_kgb", tmtMulai: "2027-08-01", hariIni });
    assert.equal(terlambat?.aksi, "tolak");
    // Belum cukup bahan: tanggal belum diisi atau pegawai tidak ada.
    assert.equal(await proyeksiIsianHukdis({ pegawaiId: "pa", jenisHukdis: "penundaan_kgb", tmtMulai: "", hariIni }), null);
    assert.equal(await proyeksiIsianHukdis({ pegawaiId: "tidak-ada", jenisHukdis: "penundaan_kgb", tmtMulai: "2027-01-01", hariIni }), null);

    // Perkiraan 6 bulan sama dengan hasil pencatatan dengan isian yang sama.
    const catat = await catatHukdis(
      "pa",
      { jenisHukdis: "penundaan_kgb", nomorSK: "HD-1", tanggalSK: "2026-12-15", tmtMulai: "2027-01-01", tmtBerakhir: "2027-12-31", berdampakKGB: true, durasiTunda: 6 },
      "u-hukdis",
    );
    assert.equal(catat.ok, true, JSON.stringify(catat));
    assert.equal(bulanIso((await db.pegawai.findUnique({ id: "pa" }))!.tmtKgbBerikutnya!), "2027-12");
    // Ditolak dengan alasan yang sama dengan perkiraannya.
    const tolakCatat = await catatHukdis(
      "pc",
      { jenisHukdis: "penundaan_kgb", nomorSK: "HD-1", tanggalSK: "2026-12-15", tmtMulai: "2027-08-01", tmtBerakhir: "2027-12-31" },
      "u-hukdis",
    );
    assert.equal(tolakCatat.ok, false);
    assert.equal(tolakCatat.ok ? "" : tolakCatat.error, terlambat?.aksi === "tolak" ? terlambat.alasan : "x");
    const tolakLama = await catatHukdis(
      "pb",
      { jenisHukdis: "penundaan_kgb", nomorSK: "HD-1", tanggalSK: "2026-12-15", tmtMulai: "2027-01-01", tmtBerakhir: "2027-12-31", berdampakKGB: true, durasiTunda: 99 },
      "u-hukdis",
    );
    assert.equal(tolakLama.ok, false);
    assert.equal(tolakLama.ok ? "" : tolakLama.error, terlalu?.aksi === "tolak" ? terlalu.alasan : "x");
  });
});
