// SK baru yang menetapkan gaji pokok pada usulan UPT (ADR-030).
//
// Golongan dan masa kerja golongan hanya berubah karena tiga sebab: kenaikan pangkat (termasuk penyesuaian
// ijazah), peninjauan masa kerja, atau pembetulan salah ketik. Usulan UPT yang menyentuh keduanya karena itu
// wajib menyebut sebabnya beserta SK-nya, supaya persetujuan Kanwil dapat membentuk riwayat kenaikan pangkat
// atau PMK lewat jalur yang sama dengan Catat KP/PMK (lib/catatDasarGaji.ts). Tanpa riwayat itu, SK KGB
// berikutnya tetap menyebut SK KGB lama pada bagian "Atas dasar" walau gaji pokoknya sudah berubah (ADR-020).
//
// Modul ini murni agar dipakai bersama oleh formulir UPT, rute penyimpanan, dan tinjauan Kanwil.

import { isJenisKp, JENIS_KP } from "./kenaikanPangkat";
import { formatTanggalId, tanggalKalender, type NilaiTanggal } from "./waktu";

export type JenisDasarBaru = "kp" | "pmk" | "koreksi";

export const LABEL_DASAR_BARU: Record<JenisDasarBaru, string> = {
  kp: "SK kenaikan pangkat atau penyesuaian ijazah",
  pmk: "SK peninjauan masa kerja (PMK)",
  koreksi: "Koreksi data, bukan SK baru",
};

/** Penjelasan singkat tiap pilihan, untuk formulir UPT dan tinjauan Kanwil. */
export const KETERANGAN_DASAR_BARU: Record<JenisDasarBaru, string> = {
  kp: "Golongan naik karena kenaikan pangkat reguler, pilihan, atau penyesuaian ijazah. Gaji pokok dan masa kerja golongan dihitung ulang dari SK ini, dan SK inilah dasar SK KGB berikutnya.",
  pmk: "Masa kerja golongan bertambah karena masa kerja sebelumnya diperhitungkan. Jadwal KGB berikutnya dapat maju, dan SK inilah dasar SK KGB berikutnya.",
  koreksi: "Tidak ada SK baru; data yang tercatat salah ketik. Dasar SK KGB berikutnya tidak berubah, dan perubahannya tercatat di log aktivitas.",
};

export function isJenisDasarBaru(nilai: unknown): nilai is JenisDasarBaru {
  return nilai === "kp" || nilai === "pmk" || nilai === "koreksi";
}

/** Kolom yang hanya berubah karena kenaikan pangkat, PMK, atau pembetulan salah ketik. */
export const KOLOM_PERLU_DASAR = ["golonganRuang", "mkgTahun", "mkgBulan"] as const;

/** true bila perubahan yang diusulkan menyentuh golongan atau masa kerja golongan. */
export function perluDasarBaru(perubahan: readonly { kunci: string }[]): boolean {
  return perubahan.some((p) => (KOLOM_PERLU_DASAR as readonly string[]).includes(p.kunci));
}

export interface IsianDasarBaru {
  dasarBaruJenis?: string | null;
  dasarBaruJenisKp?: string | null;
  dasarBaruNomorSk?: string | null;
  dasarBaruTanggalSk?: NilaiTanggal;
  dasarBaruTmt?: NilaiTanggal;
  dasarBaruPenetap?: string | null;
}

/**
 * Kekurangan isian SK baru; kosong berarti siap. `perlu` berasal dari perluDasarBaru: bila golongan atau masa
 * kerja golongan tidak berubah, bagian ini boleh dikosongkan sama sekali.
 */
export function kekuranganDasarBaru(isian: IsianDasarBaru, perlu: boolean): string[] {
  const jenis = isian.dasarBaruJenis?.trim() ?? "";
  if (!jenis) return perlu ? ["sebab perubahan golongan atau masa kerja golongan"] : [];
  if (!isJenisDasarBaru(jenis)) return ["sebab perubahan golongan atau masa kerja golongan yang dikenal"];
  if (jenis === "koreksi") return [];

  const kurang: string[] = [];
  const label = jenis === "kp" ? "SK kenaikan pangkat" : "SK PMK";
  if (jenis === "kp" && !isJenisKp(isian.dasarBaruJenisKp?.trim() ?? "")) kurang.push("jenis kenaikan pangkat");
  if (!isian.dasarBaruNomorSk?.trim()) kurang.push(`nomor ${label}`);
  if (!tanggalKalender(isian.dasarBaruTanggalSk)) kurang.push(`tanggal ${label}`);
  if (!tanggalKalender(isian.dasarBaruTmt)) kurang.push(jenis === "kp" ? "TMT pangkat" : "TMT PMK");
  return kurang;
}

/** Satu kalimat isi SK baru untuk daftar dan jejak audit; null bila tidak ada. */
export function ringkasDasarBaru(isian: IsianDasarBaru): string | null {
  const jenis = isian.dasarBaruJenis?.trim() ?? "";
  if (!isJenisDasarBaru(jenis)) return null;
  if (jenis === "koreksi") return LABEL_DASAR_BARU.koreksi;
  const jenisKp = isian.dasarBaruJenisKp?.trim() ?? "";
  const bagian = [
    jenis === "kp" ? `Kenaikan pangkat${isJenisKp(jenisKp) ? ` ${JENIS_KP[jenisKp]}` : ""}` : "PMK",
    isian.dasarBaruNomorSk?.trim() ? `SK ${isian.dasarBaruNomorSk.trim()}` : null,
    tanggalKalender(isian.dasarBaruTanggalSk) ? formatTanggalId(isian.dasarBaruTanggalSk) : null,
    tanggalKalender(isian.dasarBaruTmt) ? `TMT ${formatTanggalId(isian.dasarBaruTmt)}` : null,
  ].filter(Boolean);
  return bagian.join(" · ");
}
