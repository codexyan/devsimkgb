// Bagian server review SK KGB pegawai UPT (ADR-077): menyimpan permintaan review, tanggapan Admin UPT, dan pelewatan
// oleh Super Admin, beserta notifikasinya. Aturan murninya di lib/reviewSkUpt.ts.
//
// Tabel review_sk_upt dimigrasikan manual. Selama belum ada, setiap fungsi di sini menjawab `aktif: false` dan alur
// lama berlaku (SK langsung dapat dicetak dan diunggah), sehingga kode ini aman terpasang lebih dulu daripada tabelnya.

import { db } from "./db";
import { newId } from "./sheets/id";
import { tabelBelumAda } from "./db/tabelBelumAda";
import { TIPE_NOTIFIKASI, notifikasiHasilReviewSk, notifikasiReviewSk } from "./generateNotifikasi";
import { kodeSatkerPegawai } from "./rekapSatker";
import { SATKER } from "./satker";
import type { PegawaiRow, ReviewSkUptRow, RiwayatKGBRow } from "./sheets/tables";

type Gagal = { ok: false; status: number; pesan: string };
const gagal = (status: number, pesan: string): Gagal => ({ ok: false, status, pesan });

const namaSatker = (kode: string) => SATKER.find((s) => s.kode === kode)?.nama ?? kode;

/** Seluruh review, per id KGB; `aktif` false bila tabelnya belum dibuat. */
export async function muatSemuaReviewSk(saring?: { satker: string }): Promise<{ aktif: boolean; perKgb: Map<string, ReviewSkUptRow> }> {
  try {
    const baris = (await db.reviewSkUpt.findMany(saring ? { where: { satker: saring.satker } } : undefined)) as ReviewSkUptRow[];
    return { aktif: true, perKgb: new Map(baris.map((r) => [r.id, r])) };
  } catch (e) {
    if (tabelBelumAda(e)) return { aktif: false, perKgb: new Map() };
    throw e;
  }
}

/** Review satu KGB; `aktif` false bila tabelnya belum dibuat. */
export async function muatReviewSk(kgbId: string): Promise<{ aktif: boolean; review: ReviewSkUptRow | null }> {
  try {
    return { aktif: true, review: ((await db.reviewSkUpt.findUnique({ id: kgbId })) as ReviewSkUptRow | null) ?? null };
  } catch (e) {
    if (tabelBelumAda(e)) return { aktif: false, review: null };
    throw e;
  }
}

/** Tutup lonceng review untuk satu KGB; kegagalannya tidak menggagalkan tindakan utamanya. */
async function tutupLonceng(kgbId: string, tipe: string[]) {
  for (const t of tipe) {
    try {
      await db.notifikasi.deleteMany({ tipe: t, referenceId: kgbId });
    } catch {
      // Lonceng lama yang tertinggal hanya pengingat; tindakannya sudah tersimpan.
    }
  }
}

/**
 * Minta (atau minta ulang) review SK ke Admin UPT. Dipanggil saat SK pegawai UPT dibuat atau diperbaiki, dan dari tombol
 * Minta review UPT untuk SK yang dibuat sebelum review aktif. Versi naik dan tanggapan sebelumnya dihapus, sebab SK yang
 * dibuat ulang adalah SK yang belum pernah dilihat UPT.
 *
 * Galat selain tabel yang belum ada dilempar, supaya pemanggil tidak menyimpan SK yang tidak pernah diminta review-nya.
 */
export async function mintaReviewSk(input: {
  kgb: Pick<RiwayatKGBRow, "id" | "tmtKgbBaru">;
  pegawai: Pick<PegawaiRow, "id" | "nama" | "nip" | "unitKerja">;
  nomorSurat: string | null;
  tanggalSurat: Date | null;
  /** "Nama (NIP)" peminta. */
  oleh: string;
  sekarang: Date;
  /** SK sama dengan usulan UPT yang disetujui (lib/sesuaiUsulanServer.ts): tercatat "sesuai", tanpa review ulang (ADR-082). */
  sesuaiUsulan?: boolean;
}): Promise<{ aktif: false } | { aktif: true; review: ReviewSkUptRow }> {
  const { kgb, pegawai, nomorSurat, tanggalSurat, oleh, sekarang, sesuaiUsulan = false } = input;
  const ada = await muatReviewSk(kgb.id);
  if (!ada.aktif) return { aktif: false };

  const isi = {
    pegawaiId: pegawai.id,
    satker: kodeSatkerPegawai(pegawai.unitKerja),
    status: sesuaiUsulan ? "sesuai" : "menunggu",
    versi: (ada.review?.versi ?? 0) + 1,
    nomorSurat,
    tanggalSurat,
    dimintaAt: sekarang,
    dimintaOleh: oleh,
    ditanggapiAt: sesuaiUsulan ? sekarang : null,
    ditanggapiOleh: sesuaiUsulan ? "Sistem: sesuai usulan UPT" : null,
    catatan: null,
    alasanLewati: null,
  };
  if (ada.review) await db.reviewSkUpt.update({ id: kgb.id }, isi);
  else await db.reviewSkUpt.create({ id: kgb.id, ...isi });
  const review: ReviewSkUptRow = { id: kgb.id, ...isi };

  // Lonceng lama (permintaan dan hasil versi sebelumnya) tidak berlaku lagi untuk SK yang baru.
  await tutupLonceng(kgb.id, [TIPE_NOTIFIKASI.REVIEW_SK, TIPE_NOTIFIKASI.REVIEW_SK_HASIL]);
  // SK yang sesuai usulan tidak meminta apa pun dari UPT, jadi tanpa lonceng.
  if (sesuaiUsulan) return { aktif: true, review };
  try {
    await db.notifikasi.create({
      ...notifikasiReviewSk(kgb, pegawai, { nomorSurat, versi: review.versi }),
      id: newId(),
      dibaca: false,
      createdAt: sekarang,
    });
  } catch {
    // Permintaannya sudah tersimpan dan tampil di Perlu dikerjakan UPT; loncengnya saja yang tidak jadi.
  }
  return { aktif: true, review };
}

/** Tanggapan Admin UPT atas permintaan review: SK sudah benar, atau minta perbaikan dengan catatan. */
export async function tanggapiReviewSk(input: {
  kgbId: string;
  /** Kode satker akun Admin UPT yang menanggapi. */
  satker: string;
  keputusan: "setuju" | "perbaikan";
  catatan: string;
  oleh: string;
  sekarang: Date;
}): Promise<{ ok: true; review: ReviewSkUptRow; pegawai: PegawaiRow | null } | Gagal> {
  const { kgbId, satker, keputusan, oleh, sekarang } = input;
  const catatan = input.catatan.trim();
  const ada = await muatReviewSk(kgbId);
  if (!ada.aktif) return gagal(409, "Review SK oleh UPT belum aktif.");
  // Review satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
  if (!ada.review || ada.review.satker !== satker) return gagal(404, "Permintaan review SK tidak ditemukan.");
  const kgb = (await db.riwayatKGB.findUnique({ id: kgbId })) as RiwayatKGBRow | null;
  if (!kgb || kgb.status !== "sedang_diproses")
    return gagal(409, "SK ini sudah tidak menunggu review: KGB-nya sudah diunggah TTE, selesai, atau dibatalkan.");
  if (ada.review.status !== "menunggu")
    return gagal(
      409,
      ada.review.status === "dilewati"
        ? "Kanwil sudah melanjutkan SK ini tanpa menunggu review."
        : "SK ini sudah Anda tanggapi. Bila Kanwil memperbaikinya, permintaan review baru akan muncul lagi.",
    );
  if (keputusan === "perbaikan" && !catatan) return gagal(400, "Tulis apa yang perlu diperbaiki pada SK.");

  const ubah = {
    status: keputusan === "setuju" ? "disetujui" : "perbaikan",
    ditanggapiAt: sekarang,
    ditanggapiOleh: oleh,
    catatan: keputusan === "perbaikan" ? catatan : null,
  };
  await db.reviewSkUpt.update({ id: kgbId }, ubah);
  const review: ReviewSkUptRow = { ...ada.review, ...ubah };
  const pegawai = (await db.pegawai.findUnique({ id: review.pegawaiId })) as PegawaiRow | null;

  // Permintaan sudah ditanggapi: lonceng UPT ditutup, Kanwil dikabari.
  await tutupLonceng(kgbId, [TIPE_NOTIFIKASI.REVIEW_SK]);
  try {
    await db.notifikasi.create({
      ...notifikasiHasilReviewSk(kgbId, pegawai, {
        keputusan,
        catatan: review.catatan,
        nomorSurat: review.nomorSurat,
        satker: namaSatker(review.satker),
      }),
      id: newId(),
      dibaca: false,
      createdAt: sekarang,
    });
  } catch {
    // Tanggapannya sudah tersimpan dan tampil di antrian Kanwil.
  }
  return { ok: true, review, pegawai };
}

/** Super Admin melanjutkan SK tanpa menunggu review UPT, dengan alasan yang tercatat. */
export async function lewatiReviewSk(input: {
  kgbId: string;
  alasan: string;
  oleh: string;
  sekarang: Date;
}): Promise<{ ok: true; review: ReviewSkUptRow } | Gagal> {
  const { kgbId, oleh, sekarang } = input;
  const alasan = input.alasan.trim();
  if (!alasan) return gagal(400, "Alasan melewati review wajib diisi.");
  const ada = await muatReviewSk(kgbId);
  if (!ada.aktif) return gagal(409, "Review SK oleh UPT belum aktif.");
  if (!ada.review) return gagal(404, "SK ini belum pernah dimintakan review ke UPT, jadi tidak ada yang dilewati.");
  if (ada.review.status !== "menunggu" && ada.review.status !== "perbaikan")
    return gagal(409, ada.review.status === "disetujui" ? "SK ini sudah disetujui UPT." : "Review SK ini sudah dilewati.");

  const ubah = { status: "dilewati", alasanLewati: alasan, ditanggapiAt: sekarang, ditanggapiOleh: oleh };
  await db.reviewSkUpt.update({ id: kgbId }, ubah);
  // Permintaan yang tidak lagi ditunggu tidak boleh terus menagih UPT.
  await tutupLonceng(kgbId, [TIPE_NOTIFIKASI.REVIEW_SK]);
  return { ok: true, review: { ...ada.review, ...ubah } };
}
