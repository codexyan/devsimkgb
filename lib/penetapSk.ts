// Pejabat penetap SK dasar: baris "Oleh" pada surat KGB.
//
// SK dasar bisa berupa SK KGB sebelumnya atau SK kenaikan pangkat, dan penetapnya
// berbeda-beda (Kepmen M.IP-01.OT.01.01/2025 butir 6 dan 19), jadi dicatat per KGB.

import { kunciNomorSk } from "./nomorSurat";

export const PENETAP_KANWIL = "Kepala Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan";
/** Penetap SK yang terbit sebelum Kanwil Ditjenpas berdiri, bernomor W.19 (Kanwil Kemenkumham Kalimantan Selatan). */
export const PENETAP_KANWIL_KUMHAM = "Kepala Kantor Wilayah Kementerian Hukum dan HAM Kalimantan Selatan";

/**
 * Pilihan yang ditawarkan pada isian "Oleh". Daftarnya tidak mengikat: penetap lain boleh diketik.
 *
 * Menteri ikut di sini karena SK pengangkatan CPNS lazimnya berbentuk Keputusan Menteri, dan bagi pegawai
 * yang belum pernah KGB justru SK CPNS itulah SK dasarnya. Tanpa pilihan ini, isiannya mudah jatuh ke
 * Kepala Kantor Wilayah yang kebetulan berada di urutan pertama, padahal bukan penetapnya.
 */
export const SARAN_PENETAP_SK = [
  PENETAP_KANWIL,
  "Menteri Imigrasi dan Pemasyarakatan",
  "Menteri Hukum dan Hak Asasi Manusia",
  PENETAP_KANWIL_KUMHAM,
  "Sekretaris Jenderal Kementerian Imigrasi dan Pemasyarakatan",
  "Direktur Jenderal Pemasyarakatan",
  "Presiden Republik Indonesia",
];

/** Penetap SK dasar siklus berikutnya = pejabat yang menandatangani surat KGB sebelumnya. */
export function penetapDariSurat(
  surat: { jenisPenandatangan?: string | null; jabatanPenandatangan?: string | null } | null | undefined,
): string | null {
  const jabatan = surat?.jabatanPenandatangan?.trim();
  if (!jabatan) return null;
  return surat?.jenisPenandatangan === "dirjen"
    ? jabatan
    : `${jabatan} Direktorat Jenderal Pemasyarakatan Kalimantan Selatan`;
}

/**
 * Saran pejabat penetap dari awalan nomor SK (ADR-086): WP.19 adalah kode Kanwil Ditjenpas Kalimantan Selatan, W.19
 * kode Kanwil Kemenkumham Kalimantan Selatan sebelum Kemenimipas berdiri. Hanya saran: UPT memeriksanya dengan SK,
 * sebab SK bernomor W.19 tertentu ditetapkan pejabat lain. Nomor lain tidak diberi saran.
 */
export function saranPenetapDariNomor(nomor: string | null | undefined): string | null {
  const kunci = (nomor ?? "").replace(/\s+/g, "").toUpperCase();
  if (/^WP\.?19(?!\d)/.test(kunci)) return PENETAP_KANWIL;
  if (/^W\.?19(?!\d)/.test(kunci)) return PENETAP_KANWIL_KUMHAM;
  return null;
}

/** Pejabat penetap SK acuan usulan (SK KGB terakhir atau SK CPNS): isian UPT, atau saran dari nomornya. */
export function penetapSkAcuanUsulan(usulan: {
  nomorSkTerakhir?: string | null;
  penetapSkTerakhir?: string | null;
}): string | null {
  return usulan.penetapSkTerakhir?.trim() || saranPenetapDariNomor(usulan.nomorSkTerakhir) || null;
}

/**
 * Penetap SK dasar pegawai sesudah usulan disetujui (ADR-086). Isian UPT dipakai bila ada. Usulan lama tanpa isian itu:
 * nomor SK acuan yang berganti memakai saran dari nomornya (atau kosong, diisi Kanwil saat Input KGB), nomor yang sama
 * membiarkan penetap tercatat. `undefined` berarti tidak diubah.
 */
export function penetapSesudahUsulan(
  pegawaiLama: { nomorSkDasar?: string | null; penetapSkDasar?: string | null } | null,
  usulan: { nomorSkTerakhir?: string | null; penetapSkTerakhir?: string | null },
): string | null | undefined {
  const isian = usulan.penetapSkTerakhir?.trim();
  if (isian) return isian;
  const nomor = usulan.nomorSkTerakhir?.trim();
  if (!pegawaiLama) return saranPenetapDariNomor(nomor);
  if (nomor && kunciNomorSk(nomor) !== kunciNomorSk(pegawaiLama.nomorSkDasar)) return saranPenetapDariNomor(nomor);
  return undefined;
}
