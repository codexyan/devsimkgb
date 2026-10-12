// Review tampilan SK KGB pegawai UPT oleh Admin UPT (ADR-077). Aturan murni (tanpa akses data) yang dipakai server dan
// peramban: siapa yang wajib direview, kapan SK boleh dicetak bersih dan diunggah TTE, dan bagaimana keadaannya ditulis.
//
// Alur untuk pegawai UPT: Kanwil membuat SK → Admin UPT memeriksa tampilannya → bila sudah benar, Kanwil mencetaknya untuk
// ditandatangani basah dan dikirim lewat Srikandi, lalu mengunggah TTE. Sebelum disetujui, PDF yang diunduh bertanda air
// DRAF dan Unggah TTE ditolak. Bila UPT meminta perbaikan, Kanwil memperbaiki SK dan review diminta lagi. Super Admin
// dapat melewati review untuk keadaan mendesak, dengan alasan yang tercatat, tetapi hanya sesudah UPT menunggu lebih dari
// 24 jam (ADR-109). Pegawai Kanwil tidak melalui review ini.
//
// Setiap SK pegawai UPT menunggu UPT, termasuk yang sama persis dengan usulannya (ADR-087, mengganti ADR-082) dan SK
// lama yang dibuat sebelum review aktif.

import { dipegangKeuanganKanwil } from "./aksesUpt";
import type { ReviewSkUptRow } from "./sheets/tables";

/**
 * "sesuai": dulu SK yang sama dengan usulan UPT ditandai sendiri tanpa review (ADR-082). Sejak ADR-087 status ini tidak
 * dibuat lagi, dan baris lama yang masih "sesuai" dibaca sebagai "menunggu" (normalReviewSk).
 */
export type StatusReviewSk = "menunggu" | "disetujui" | "perbaikan" | "dilewati" | "sesuai";

export const STATUS_REVIEW_SK: readonly StatusReviewSk[] = ["menunggu", "disetujui", "perbaikan", "dilewati", "sesuai"];

/** Label untuk Kanwil dan UPT; nada mengikuti penanda lain di dasbor. */
export const LABEL_REVIEW_SK: Record<StatusReviewSk, { kanwil: string; upt: string; nada: "ungu" | "hijau" | "merah" | "kuning" }> = {
  menunggu: { kanwil: "Menunggu review UPT", upt: "SK menunggu review Anda", nada: "ungu" },
  disetujui: { kanwil: "Disetujui UPT, siap cetak", upt: "SK disetujui, menunggu tanda tangan", nada: "hijau" },
  perbaikan: { kanwil: "UPT minta perbaikan", upt: "Menunggu perbaikan SK di Kanwil", nada: "merah" },
  dilewati: { kanwil: "Review dilewati", upt: "SK dilanjutkan Kanwil tanpa review", nada: "kuning" },
  sesuai: { kanwil: "Sesuai usulan UPT, siap cetak", upt: "SK sesuai usulan Anda, menunggu tanda tangan", nada: "hijau" },
};

/** Tanda air pada PDF SK yang belum boleh ditandatangani. */
export const TEKS_DRAF_KANWIL = "DRAF · MENUNGGU REVIEW UPT";
export const TEKS_DRAF_UPT = "DRAF UNTUK REVIEW UPT";

export const PESAN_REVIEW_BELUM_AKTIF =
  "Review SK oleh UPT belum aktif: tabel review_sk_upt belum dibuat di basis data. Minta pengelola menjalankan migrasinya.";

export function isStatusReviewSk(nilai: unknown): nilai is StatusReviewSk {
  return typeof nilai === "string" && (STATUS_REVIEW_SK as readonly string[]).includes(nilai);
}

/** SK pegawai ini wajib direview Admin UPT: pegawai satker UPT, bukan pegawai Kanwil. */
export function pegawaiPerluReviewSk(unitKerja: string | null | undefined): boolean {
  return !dipegangKeuanganKanwil(unitKerja);
}

/** Keadaan review yang dikirim ke peramban Kanwil. Null bila tidak wajib (pegawai Kanwil, atau review belum aktif). */
export interface InfoReviewSk {
  /** Selalu true pada objek ini; ada supaya peramban tidak perlu menebak arti null. */
  wajib: true;
  /** Null: review belum pernah diminta, yaitu SK yang dibuat sebelum review aktif atau SK yang belum dibuat. */
  status: StatusReviewSk | null;
  versi: number;
  nomorSurat: string | null;
  catatan: string | null;
  alasanLewati: string | null;
  dimintaAt: string | null;
  ditanggapiAt: string | null;
  ditanggapiOleh: string | null;
}

/** Info review untuk satu KGB; `aktif` false berarti tabel belum ada sehingga review belum berlaku. */
export function infoReviewSk(
  review: Pick<ReviewSkUptRow, "status" | "versi" | "nomorSurat" | "catatan" | "alasanLewati" | "dimintaAt" | "ditanggapiAt" | "ditanggapiOleh"> | null | undefined,
  syarat: { aktif: boolean; unitKerja: string | null | undefined },
): InfoReviewSk | null {
  if (!syarat.aktif || !pegawaiPerluReviewSk(syarat.unitKerja)) return null;
  return {
    wajib: true,
    status: review && isStatusReviewSk(review.status) ? review.status : null,
    versi: review?.versi ?? 0,
    nomorSurat: review?.nomorSurat ?? null,
    catatan: review?.catatan ?? null,
    alasanLewati: review?.alasanLewati ?? null,
    dimintaAt: review?.dimintaAt ? new Date(review.dimintaAt).toISOString() : null,
    ditanggapiAt: review?.ditanggapiAt ? new Date(review.ditanggapiAt).toISOString() : null,
    ditanggapiOleh: review?.ditanggapiOleh ?? null,
  };
}

/**
 * Review lama berstatus "sesuai" (ADR-082) dibaca sebagai permintaan yang masih menunggu UPT (ADR-087): SK itu belum
 * pernah dilihat UPT.
 */
export function normalReviewSk<T extends Pick<ReviewSkUptRow, "status" | "ditanggapiAt" | "ditanggapiOleh">>(review: T): T;
export function normalReviewSk<T extends Pick<ReviewSkUptRow, "status" | "ditanggapiAt" | "ditanggapiOleh">>(review: T | null): T | null;
export function normalReviewSk<T extends Pick<ReviewSkUptRow, "status" | "ditanggapiAt" | "ditanggapiOleh">>(review: T | null): T | null {
  if (!review || review.status !== "sesuai") return review;
  return { ...review, status: "menunggu", ditanggapiAt: null, ditanggapiOleh: null };
}

/**
 * SK boleh dicetak bersih dan diunggah TTE-nya: tidak wajib review (pegawai Kanwil, atau review belum aktif), sudah
 * disetujui UPT, atau dilewati Super Admin dengan alasan. SK pegawai UPT yang review-nya belum pernah diminta (SK lama)
 * ikut menunggu (ADR-087).
 */
export function skBolehDicetak(info: Pick<InfoReviewSk, "status"> | null | undefined): boolean {
  return !info || info.status === "disetujui" || info.status === "dilewati";
}

/** Lama permintaan review harus menunggu UPT sebelum Super Admin boleh melewatinya (ADR-109). */
export const BATAS_LEWATI_REVIEW_JAM = 24;
const BATAS_LEWATI_REVIEW_MS = BATAS_LEWATI_REVIEW_JAM * 60 * 60 * 1000;

/**
 * Apakah review ini boleh dilewati Super Admin sekarang (ADR-109). Setiap SK pegawai UPT harus melalui review UPT lebih
 * dulu, jadi Lewati review baru terbuka bila UPT sudah **menunggu** lebih dari 24 jam sejak review diminta. Jamnya
 * dihitung dari `dimintaAt`, yang diisi ulang tiap Buat SK, Perbaiki SK, atau Minta review UPT.
 *
 * - `bukan_menunggu`: tidak ada yang ditunggu dari UPT. UPT sudah menanggapi (perbaikan: bolanya di Kanwil, jalurnya
 *   Perbaiki SK), atau review belum pernah diminta (jalurnya Minta review UPT).
 * - `belum_24_jam`: masih dalam jendela UPT; `sisaMs` sampai tombolnya terbuka.
 * - `tanpa_waktu`: menunggu, tetapi waktu permintaannya tidak tercatat sehingga 24 jam tidak dapat dibuktikan.
 */
export type KesempatanLewatiReview =
  | { boleh: true }
  | { boleh: false; sebab: "bukan_menunggu" }
  | { boleh: false; sebab: "belum_24_jam"; sisaMs: number }
  | { boleh: false; sebab: "tanpa_waktu" };

export function kesempatanLewatiReview(
  info: { status: StatusReviewSk | null; dimintaAt: string | Date | null | undefined } | null | undefined,
  sekarang: Date,
): KesempatanLewatiReview {
  // "sesuai" dibaca sebagai "menunggu" (normalReviewSk), seperti di sisi server.
  if (!info || (info.status !== "menunggu" && info.status !== "sesuai")) return { boleh: false, sebab: "bukan_menunggu" };
  const diminta = info.dimintaAt ? new Date(info.dimintaAt).getTime() : NaN;
  if (Number.isNaN(diminta)) return { boleh: false, sebab: "tanpa_waktu" };
  const sisaMs = diminta + BATAS_LEWATI_REVIEW_MS - sekarang.getTime();
  return sisaMs > 0 ? { boleh: false, sebab: "belum_24_jam", sisaMs } : { boleh: true };
}

/** "7 jam 20 menit", "35 menit": dibulatkan ke atas ke menit penuh. */
export function formatSisaWaktu(ms: number): string {
  const menit = Math.max(1, Math.ceil(ms / 60_000));
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam === 0) return `${sisa} menit`;
  return sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`;
}

/** Pesan penolakan Lewati review; null bila boleh. */
export function pesanBelumBolehLewati(kesempatan: KesempatanLewatiReview): string | null {
  if (kesempatan.boleh) return null;
  if (kesempatan.sebab === "belum_24_jam")
    return `Review UPT baru dapat dilewati setelah menunggu ${BATAS_LEWATI_REVIEW_JAM} jam sejak diminta. Sisa waktunya ${formatSisaWaktu(kesempatan.sisaMs)}.`;
  if (kesempatan.sebab === "tanpa_waktu")
    return `Waktu permintaan review tidak tercatat, jadi ${BATAS_LEWATI_REVIEW_JAM} jam menunggu UPT tidak dapat dipastikan. Pilih Perbaiki SK agar review diminta ulang, lalu tunggu.`;
  return "Review UPT hanya dapat dilewati selama permintaannya masih menunggu tanggapan UPT.";
}

/** Alasan Unggah TTE ditolak karena review UPT; null bila boleh. */
export function alasanTolakTanpaReview(info: Pick<InfoReviewSk, "status" | "catatan"> | null | undefined, namaPegawai: string): string | null {
  if (skBolehDicetak(info)) return null;
  if (info?.status === "perbaikan")
    return `UPT meminta perbaikan SK ${namaPegawai}${info.catatan ? `: ${info.catatan}` : ""}. Perbaiki SK lalu tunggu persetujuan UPT sebelum mencetak dan mengunggah TTE.`;
  if (info && info.status === null)
    return `SK ${namaPegawai} dibuat sebelum review UPT aktif dan belum pernah diperiksa Admin UPT. Tekan Minta review UPT, lalu tunggu persetujuannya.`;
  return `SK ${namaPegawai} masih menunggu review Admin UPT. Cetak dan Unggah SK TTE Srikandi baru dapat dilakukan setelah UPT menyatakan SK sudah benar, atau setelah Super Admin melewati review dengan alasan sesudah menunggu ${BATAS_LEWATI_REVIEW_JAM} jam.`;
}
