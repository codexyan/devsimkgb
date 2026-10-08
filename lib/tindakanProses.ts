// Tindakan berikutnya untuk KGB yang sedang diproses Kanwil (ADR-089). Urutannya juga urutan kartu di kolom Sedang
// diproses: yang harus dikerjakan Kanwil lebih dulu, yang menunggu UPT paling bawah.

import { skBolehDicetak, type InfoReviewSk } from "./reviewSkUpt";

export type TindakanProses = "perbaikan" | "siap" | "buat_sk" | "minta_review" | "menunggu_upt";

export const URUTAN_TINDAKAN: Record<TindakanProses, number> = {
  perbaikan: 0,
  siap: 1,
  buat_sk: 2,
  minta_review: 2,
  menunggu_upt: 3,
};

export function tindakanProses(p: { skSudahDibuat?: boolean; reviewSk?: Pick<InfoReviewSk, "status"> | null }): TindakanProses {
  if (!p.skSudahDibuat) return "buat_sk";
  const review = p.reviewSk ?? null;
  if (review?.status === "perbaikan") return "perbaikan";
  if (skBolehDicetak(review)) return "siap";
  return review && review.status === null ? "minta_review" : "menunggu_upt";
}

/** Pembanding dua KGB yang sedang diproses: tindakan Kanwil, lalu batas input terdekat. 0 bila setara. */
export function bandingTindakan(
  a: { skSudahDibuat?: boolean; reviewSk?: Pick<InfoReviewSk, "status"> | null; deadlineSDM: string | Date },
  b: { skSudahDibuat?: boolean; reviewSk?: Pick<InfoReviewSk, "status"> | null; deadlineSDM: string | Date },
): number {
  return (
    URUTAN_TINDAKAN[tindakanProses(a)] - URUTAN_TINDAKAN[tindakanProses(b)] ||
    new Date(a.deadlineSDM).getTime() - new Date(b.deadlineSDM).getTime()
  );
}
