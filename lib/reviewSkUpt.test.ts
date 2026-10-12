// Review SK KGB pegawai UPT oleh Admin UPT (ADR-077): aturan murni dan alur penyimpanannya di atas penyimpanan lokal.
//
// Jalankan: node --import tsx --test lib/reviewSkUpt.test.ts

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  alasanTolakTanpaReview,
  formatSisaWaktu,
  infoReviewSk,
  kesempatanLewatiReview,
  pegawaiPerluReviewSk,
  pesanBelumBolehLewati,
  skBolehDicetak,
} from "./reviewSkUpt";

const UPT = "Rumah Tahanan Negara Kelas IIB Rantau";
const KANWIL = "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan";

test("hanya pegawai UPT yang SK-nya direview, dan hanya selama review aktif", () => {
  assert.equal(pegawaiPerluReviewSk(UPT), true);
  assert.equal(pegawaiPerluReviewSk(KANWIL), false);
  assert.equal(pegawaiPerluReviewSk(""), false, "unit kerja kosong berarti Kanwil");
  assert.equal(infoReviewSk(null, { aktif: false, unitKerja: UPT }), null, "tabel belum ada: review belum berlaku");
  assert.equal(infoReviewSk(null, { aktif: true, unitKerja: KANWIL }), null);
  const lama = infoReviewSk(null, { aktif: true, unitKerja: UPT });
  assert.equal(lama?.status, null, "SK yang dibuat sebelum review aktif belum pernah diminta review-nya");
});

test("SK boleh dicetak bersih dan diunggah TTE hanya bila tidak wajib, disetujui UPT, atau dilewati (ADR-087)", () => {
  assert.equal(skBolehDicetak(null), true);
  assert.equal(skBolehDicetak({ status: null }), false, "SK lama yang belum pernah direview ikut menunggu");
  assert.equal(skBolehDicetak({ status: "sesuai" }), false, "sesuai usulan tetap menunggu UPT");
  assert.equal(skBolehDicetak({ status: "disetujui" }), true);
  assert.equal(skBolehDicetak({ status: "dilewati" }), true);
  assert.equal(skBolehDicetak({ status: "menunggu" }), false);
  assert.equal(skBolehDicetak({ status: "perbaikan" }), false);
  assert.match(alasanTolakTanpaReview({ status: "menunggu", catatan: null }, "A") ?? "", /menunggu review Admin UPT/);
  assert.match(alasanTolakTanpaReview({ status: "perbaikan", catatan: "golongan salah" }, "A") ?? "", /golongan salah/);
  assert.equal(alasanTolakTanpaReview({ status: "disetujui", catatan: null }, "A"), null);
  assert.match(alasanTolakTanpaReview({ status: null, catatan: null }, "A") ?? "", /Minta review UPT/);
});

async function denganDataLokal(kerja: () => Promise<void>) {
  const folder = await mkdtemp(path.join(tmpdir(), "simkgb-review-"));
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

const SEKARANG = new Date("2026-10-07T04:00:00Z");
const pegawai = { id: "p1", nama: "PEGAWAI UJI", nip: "199001012015031001", unitKerja: UPT };

async function siapkanKgb() {
  const { db } = await import("./db");
  const { makeRiwayatKGB } = await import("./sheets/tables");
  await db.riwayatKGB.create(makeRiwayatKGB({ id: "k1", pegawaiId: "p1", status: "sedang_diproses", tmtKgbBaru: new Date(2026, 11, 1) }));
  return db;
}

test("permintaan, tanggapan setuju, dan permintaan ulang setelah SK diperbaiki", async () => {
  await denganDataLokal(async () => {
    const db = await siapkanKgb();
    const { mintaReviewSk, tanggapiReviewSk } = await import("./reviewSkUptServer");

    const minta = await mintaReviewSk({ kgb: { id: "k1", tmtKgbBaru: new Date(2026, 11, 1) }, pegawai, nomorSurat: "W.19-1", tanggalSurat: SEKARANG, oleh: "SDM (1)", sekarang: SEKARANG });
    assert.equal(minta.aktif, true);
    const r1 = await db.reviewSkUpt.findUnique({ id: "k1" });
    assert.equal(r1?.status, "menunggu");
    assert.equal(r1?.versi, 1);
    assert.equal(r1?.satker, "rutan-rantau");
    let kabar = await db.notifikasi.findMany({ where: { tipe: "review_sk" } });
    assert.equal(kabar.length, 1, "Admin UPT dikabari");
    assert.equal(kabar[0].referenceId, "k1");

    // Satker lain tidak dapat menanggapi.
    const asing = await tanggapiReviewSk({ kgbId: "k1", satker: "rutan-barabai", keputusan: "setuju", catatan: "", oleh: "UPT lain", sekarang: SEKARANG });
    assert.equal(asing.ok, false);
    // Minta perbaikan wajib bercatatan.
    const tanpaCatatan = await tanggapiReviewSk({ kgbId: "k1", satker: "rutan-rantau", keputusan: "perbaikan", catatan: "  ", oleh: "UPT", sekarang: SEKARANG });
    assert.equal(tanpaCatatan.ok, false);

    const perbaikan = await tanggapiReviewSk({ kgbId: "k1", satker: "rutan-rantau", keputusan: "perbaikan", catatan: "Golongan keliru", oleh: "UPT (2)", sekarang: SEKARANG });
    assert.equal(perbaikan.ok, true);
    assert.equal((await db.reviewSkUpt.findUnique({ id: "k1" }))?.status, "perbaikan");
    assert.equal((await db.notifikasi.findMany({ where: { tipe: "review_sk" } })).length, 0, "permintaan yang sudah ditanggapi tidak lagi menagih UPT");
    const hasil = await db.notifikasi.findMany({ where: { tipe: "review_sk_hasil" } });
    assert.equal(hasil.length, 1);
    assert.match(hasil[0].pesan, /Golongan keliru/);
    // Sudah ditanggapi: tidak dapat ditanggapi dua kali.
    assert.equal((await tanggapiReviewSk({ kgbId: "k1", satker: "rutan-rantau", keputusan: "setuju", catatan: "", oleh: "UPT", sekarang: SEKARANG })).ok, false);

    // SK diperbaiki: review diminta ulang, versi naik, tanggapan lama dan loncengnya hilang.
    await mintaReviewSk({ kgb: { id: "k1", tmtKgbBaru: new Date(2026, 11, 1) }, pegawai, nomorSurat: "W.19-1", tanggalSurat: SEKARANG, oleh: "SDM (1)", sekarang: SEKARANG });
    const r2 = await db.reviewSkUpt.findUnique({ id: "k1" });
    assert.equal(r2?.status, "menunggu");
    assert.equal(r2?.versi, 2);
    assert.equal(r2?.catatan, null);
    assert.equal((await db.notifikasi.findMany({ where: { tipe: "review_sk_hasil" } })).length, 0);
    kabar = await db.notifikasi.findMany({ where: { tipe: "review_sk" } });
    assert.equal(kabar.length, 1);
    assert.match(kabar[0].judul, /Review Ulang/);

    const setuju = await tanggapiReviewSk({ kgbId: "k1", satker: "rutan-rantau", keputusan: "setuju", catatan: "", oleh: "UPT (2)", sekarang: SEKARANG });
    assert.equal(setuju.ok, true);
    const akhir = await db.reviewSkUpt.findUnique({ id: "k1" });
    assert.equal(akhir?.status, "disetujui");
    assert.equal(skBolehDicetak(infoReviewSk(akhir, { aktif: true, unitKerja: UPT })), true);
  });
});

const JAM = 60 * 60 * 1000;
const sesudah = (jam: number, menit = 0) => new Date(SEKARANG.getTime() + jam * JAM + menit * 60_000);

test("Lewati review hanya terbuka sesudah UPT menunggu 24 jam (ADR-109)", () => {
  const menunggu = (dimintaAt: string | Date | null) => ({ status: "menunggu" as const, dimintaAt });
  const diminta = SEKARANG.toISOString();

  assert.deepEqual(kesempatanLewatiReview(null, SEKARANG), { boleh: false, sebab: "bukan_menunggu" });
  assert.equal(kesempatanLewatiReview({ status: null, dimintaAt: null }, SEKARANG).boleh, false, "SK lama: minta review dulu");
  for (const status of ["perbaikan", "disetujui", "dilewati"] as const)
    assert.deepEqual(kesempatanLewatiReview({ status, dimintaAt: diminta }, sesudah(100)), { boleh: false, sebab: "bukan_menunggu" }, status);

  // Seketika dan 23 jam 59 menit: UPT masih dalam jendelanya, dengan sisa waktu yang tepat.
  assert.deepEqual(kesempatanLewatiReview(menunggu(diminta), SEKARANG), { boleh: false, sebab: "belum_24_jam", sisaMs: 24 * JAM });
  assert.deepEqual(kesempatanLewatiReview(menunggu(diminta), sesudah(23, 59)), { boleh: false, sebab: "belum_24_jam", sisaMs: 60_000 });
  // Genap 24 jam dan sesudahnya: terbuka.
  assert.deepEqual(kesempatanLewatiReview(menunggu(diminta), sesudah(24)), { boleh: true });
  assert.deepEqual(kesempatanLewatiReview(menunggu(SEKARANG), sesudah(80)), { boleh: true }, "dimintaAt boleh berupa Date (sisi server)");
  // Baris lama berstatus sesuai dibaca sebagai menunggu (normalReviewSk).
  assert.equal(kesempatanLewatiReview({ status: "sesuai", dimintaAt: diminta }, sesudah(25)).boleh, true);
  // Tanpa waktu permintaan, 24 jam tidak dapat dibuktikan.
  assert.deepEqual(kesempatanLewatiReview(menunggu(null), sesudah(100)), { boleh: false, sebab: "tanpa_waktu" });
  assert.deepEqual(kesempatanLewatiReview(menunggu("bukan tanggal"), sesudah(100)), { boleh: false, sebab: "tanpa_waktu" });

  assert.equal(pesanBelumBolehLewati({ boleh: true }), null);
  assert.match(pesanBelumBolehLewati({ boleh: false, sebab: "belum_24_jam", sisaMs: 7 * JAM + 20 * 60_000 }) ?? "", /24 jam.*7 jam 20 menit/);
  assert.match(pesanBelumBolehLewati({ boleh: false, sebab: "bukan_menunggu" }) ?? "", /masih menunggu tanggapan UPT/);

  assert.equal(formatSisaWaktu(7 * JAM + 20 * 60_000), "7 jam 20 menit");
  assert.equal(formatSisaWaktu(2 * JAM), "2 jam");
  assert.equal(formatSisaWaktu(35 * 60_000), "35 menit");
  assert.equal(formatSisaWaktu(1_000), "1 menit", "dibulatkan ke atas, tidak pernah 0 menit");
});

test("Super Admin melewati review dengan alasan, hanya sesudah 24 jam; tidak ada yang dilewati tanpa permintaan", async () => {
  await denganDataLokal(async () => {
    const db = await siapkanKgb();
    const { mintaReviewSk, lewatiReviewSk, tanggapiReviewSk } = await import("./reviewSkUptServer");
    assert.equal((await lewatiReviewSk({ kgbId: "k1", alasan: "mendesak", oleh: "SA", sekarang: sesudah(100) })).ok, false, "belum pernah diminta");
    await mintaReviewSk({ kgb: { id: "k1", tmtKgbBaru: null }, pegawai, nomorSurat: "W.19-2", tanggalSurat: SEKARANG, oleh: "SDM", sekarang: SEKARANG });
    assert.equal((await lewatiReviewSk({ kgbId: "k1", alasan: " ", oleh: "SA", sekarang: sesudah(25) })).ok, false, "alasan wajib");

    // Server menolak sebelum 24 jam, dengan sisa waktunya, dan tidak mengubah apa pun.
    const terlalu = await lewatiReviewSk({ kgbId: "k1", alasan: "Batas proses hari ini", oleh: "SA (9)", sekarang: sesudah(23, 59) });
    assert.equal(terlalu.ok, false);
    if (!terlalu.ok) {
      assert.equal(terlalu.status, 409);
      assert.match(terlalu.pesan, /24 jam.*1 menit/);
    }
    assert.equal((await db.reviewSkUpt.findUnique({ id: "k1" }))?.status, "menunggu");
    assert.equal((await db.notifikasi.findMany({ where: { tipe: "review_sk" } })).length, 1, "UPT tetap ditagih");

    const lewat = await lewatiReviewSk({ kgbId: "k1", alasan: "Batas proses hari ini", oleh: "SA (9)", sekarang: sesudah(24) });
    assert.equal(lewat.ok, true);
    const r = await db.reviewSkUpt.findUnique({ id: "k1" });
    assert.equal(r?.status, "dilewati");
    assert.equal(r?.alasanLewati, "Batas proses hari ini");
    assert.equal((await db.notifikasi.findMany({ where: { tipe: "review_sk" } })).length, 0, "permintaan ke UPT ditutup");
    // UPT tidak lagi dapat menanggapi.
    const telat = await tanggapiReviewSk({ kgbId: "k1", satker: "rutan-rantau", keputusan: "setuju", catatan: "", oleh: "UPT", sekarang: sesudah(24) });
    assert.equal(telat.ok, false);
    if (!telat.ok) assert.match(telat.pesan, /tanpa menunggu review/);
  });
});

test("saat UPT meminta perbaikan tidak ada Lewati review; Perbaiki SK memulai jam 24 lagi (ADR-109)", async () => {
  await denganDataLokal(async () => {
    const db = await siapkanKgb();
    const { mintaReviewSk, lewatiReviewSk, tanggapiReviewSk } = await import("./reviewSkUptServer");
    await mintaReviewSk({ kgb: { id: "k1", tmtKgbBaru: null }, pegawai, nomorSurat: "W.19-4", tanggalSurat: SEKARANG, oleh: "SDM", sekarang: SEKARANG });
    await tanggapiReviewSk({ kgbId: "k1", satker: "rutan-rantau", keputusan: "perbaikan", catatan: "Golongan keliru", oleh: "UPT", sekarang: sesudah(1) });

    // Bolanya di Kanwil: berapa lama pun, Lewati review ditolak dan jalurnya Perbaiki SK.
    const ditolak = await lewatiReviewSk({ kgbId: "k1", alasan: "mendesak", oleh: "SA", sekarang: sesudah(100) });
    assert.equal(ditolak.ok, false);
    if (!ditolak.ok) assert.match(ditolak.pesan, /meminta perbaikan.*Perbaiki SK/);
    assert.equal((await db.reviewSkUpt.findUnique({ id: "k1" }))?.status, "perbaikan");

    // Perbaiki SK meminta review ulang: jam 24 dihitung dari permintaan baru, bukan yang pertama.
    await mintaReviewSk({ kgb: { id: "k1", tmtKgbBaru: null }, pegawai, nomorSurat: "W.19-4", tanggalSurat: SEKARANG, oleh: "SDM", sekarang: sesudah(48) });
    assert.equal((await lewatiReviewSk({ kgbId: "k1", alasan: "mendesak", oleh: "SA", sekarang: sesudah(48 + 23) })).ok, false);
    assert.equal((await lewatiReviewSk({ kgbId: "k1", alasan: "mendesak", oleh: "SA", sekarang: sesudah(48 + 24) })).ok, true);
  });
});

test("tanggapan ditolak bila KGB sudah tidak Sedang Diproses", async () => {
  await denganDataLokal(async () => {
    const db = await siapkanKgb();
    const { mintaReviewSk, tanggapiReviewSk } = await import("./reviewSkUptServer");
    await mintaReviewSk({ kgb: { id: "k1", tmtKgbBaru: null }, pegawai, nomorSurat: "W.19-3", tanggalSurat: SEKARANG, oleh: "SDM", sekarang: SEKARANG });
    await db.riwayatKGB.update({ id: "k1" }, { status: "ditolak" });
    const hasil = await tanggapiReviewSk({ kgbId: "k1", satker: "rutan-rantau", keputusan: "setuju", catatan: "", oleh: "UPT", sekarang: SEKARANG });
    assert.equal(hasil.ok, false);
  });
});

test("review lama berstatus sesuai (ADR-082) kini menunggu UPT: tertahan, lalu dapat ditanggapi (ADR-087)", async () => {
  await denganDataLokal(async () => {
    const db = await siapkanKgb();
    const { muatReviewSk, muatSemuaReviewSk, tanggapiReviewSk } = await import("./reviewSkUptServer");
    await db.reviewSkUpt.create({
      id: "k1", pegawaiId: "p1", satker: "rutan-rantau", status: "sesuai", versi: 1, nomorSurat: "W.19-1", tanggalSurat: SEKARANG,
      dimintaAt: SEKARANG, dimintaOleh: "SDM (1)", ditanggapiAt: SEKARANG, ditanggapiOleh: "Sistem: sesuai usulan UPT", catatan: null, alasanLewati: null,
    });
    const { review } = await muatReviewSk("k1");
    assert.equal(review?.status, "menunggu");
    assert.equal(review?.ditanggapiOleh, null);
    assert.equal((await muatSemuaReviewSk()).perKgb.get("k1")?.status, "menunggu");
    assert.equal(skBolehDicetak(infoReviewSk(review, { aktif: true, unitKerja: UPT })), false, "Cetak dan Unggah TTE tertahan");

    const setuju = await tanggapiReviewSk({ kgbId: "k1", satker: "rutan-rantau", keputusan: "setuju", catatan: "", oleh: "UPT (2)", sekarang: SEKARANG });
    assert.equal(setuju.ok, true);
    const sesudah = (await muatReviewSk("k1")).review;
    assert.equal(sesudah?.status, "disetujui");
    assert.equal(skBolehDicetak(infoReviewSk(sesudah, { aktif: true, unitKerja: UPT })), true);
  });
});
