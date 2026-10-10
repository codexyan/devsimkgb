// Review tampilan SK KGB pegawai UPT oleh Admin UPT (ADR-077). Aturan murni (tanpa akses data) yang dipakai server dan
// peramban: siapa yang wajib direview, kapan SK boleh dicetak bersih dan diunggah TTE, dan bagaimana keadaannya ditulis.
//
// Alur untuk pegawai UPT: Kanwil membuat SK → Admin UPT memeriksa tampilannya → bila sudah benar, Kanwil mencetaknya untuk
// ditandatangani basah dan dikirim lewat Srikandi, lalu mengunggah TTE. Sebelum disetujui, PDF yang diunduh bertanda air
// DRAF dan Unggah TTE ditolak. Bila UPT meminta perbaikan, Kanwil memperbaiki SK dan review diminta lagi. Super Admin
// dapat melewati review untuk keadaan mendesak, dengan alasan yang tercatat. Pegawai Kanwil tidak melalui review ini.
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

/** Alasan Unggah TTE ditolak karena review UPT; null bila boleh. */
export function alasanTolakTanpaReview(info: Pick<InfoReviewSk, "status" | "catatan"> | null | undefined, namaPegawai: string): string | null {
  if (skBolehDicetak(info)) return null;
  if (info?.status === "perbaikan")
    return `UPT meminta perbaikan SK ${namaPegawai}${info.catatan ? `: ${info.catatan}` : ""}. Perbaiki SK lalu tunggu persetujuan UPT sebelum mencetak dan mengunggah TTE.`;
  if (info && info.status === null)
    return `SK ${namaPegawai} dibuat sebelum review UPT aktif dan belum pernah diperiksa Admin UPT. Tekan Minta review UPT, lalu tunggu persetujuannya; Super Admin dapat melewati review dengan alasan.`;
  return `SK ${namaPegawai} masih menunggu review Admin UPT. Cetak dan Unggah SK bertanda tangan baru dapat dilakukan setelah UPT menyatakan SK sudah benar, atau setelah Super Admin melewati review dengan alasan.`;
}
