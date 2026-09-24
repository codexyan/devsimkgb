// Pejabat penetap SK dasar: baris "Oleh" pada surat KGB.
//
// SK dasar bisa berupa SK KGB sebelumnya atau SK kenaikan pangkat, dan penetapnya
// berbeda-beda (Kepmen M.IP-01.OT.01.01/2025 butir 6 dan 19), jadi dicatat per KGB.

export const PENETAP_KANWIL = "Kepala Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan";

/**
 * Pilihan yang ditawarkan pada isian "Oleh". Daftarnya tidak mengikat: penetap lain boleh diketik.
 *
 * Menteri ikut di sini karena SK pengangkatan PNS berbentuk Keputusan Menteri, dan bagi pegawai yang
 * baru diangkat justru SK itulah dasar gaji pokoknya. Tanpa pilihan ini, isiannya mudah jatuh ke
 * Kepala Kantor Wilayah yang kebetulan berada di urutan pertama, padahal bukan penetapnya.
 */
export const SARAN_PENETAP_SK = [
  PENETAP_KANWIL,
  "Menteri Imigrasi dan Pemasyarakatan",
  "Menteri Hukum dan Hak Asasi Manusia",
  "Kepala Kantor Wilayah Kementerian Hukum dan HAM Kalimantan Selatan",
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
