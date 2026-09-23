// Batas input Tim SDM: tanggal pada bulan kedua sebelum TMT. Input KGB setelah tanggal ini tetap
// diterima, tetapi ditandai berpotensi rapelan.
//
// Batasnya sengaja sebelum akhir bulan. Setelah Input KGB masih ada Buat SK, tanda tangan elektronik,
// unggah SK, dan konfirmasi keuangan, dan semuanya harus selesai sebelum bagian keuangan merekonsiliasi
// data gaji di aplikasi Gaji Web. Rekon itu berlangsung tanggal 1 sampai 15 bulan sebelum TMT (batas
// pengajuan SPM gaji induk, PMK 62/2023), dan keuangan bisa mengirimnya lebih awal. SK yang masuk setelah
// keuangan mengirim tidak ikut gaji bulan TMT dan dibayar sebagai kekurangan gaji.
//
// Tanggalnya diatur Super Admin di Pengaturan (KonfigurasiKanwil.batasInputSdm). Modul ini murni dan
// dipakai di server maupun peramban: nilai yang berlaku disimpan di sini lewat aturBatasInputSdm(),
// yang dipanggil muatBatasInputSdm() (lib/muatBatasInputSdm.ts) di server dan DashboardShell di peramban.

export const BATAS_INPUT_SDM_BAWAAN = 20;
export const BATAS_INPUT_SDM_MIN = 1;
/** 31 berarti hari terakhir bulan; tanggal di atas jumlah hari bulan itu dijepit ke akhir bulan. */
export const BATAS_INPUT_SDM_MAKS = 31;

/**
 * Batas tanggal pengiriman surat usulan UPT, pada bulan kedua sebelum TMT. Surat dikirim di awal bulan
 * yang sama dengan dibukanya input di SIM-KGB, sehingga Tim SDM masih punya sisa bulan itu untuk input,
 * membuat SK, menandatangani lewat Srikandi, dan mengirimkannya sebelum rekon gaji bulan berikutnya.
 */
export const KIRIM_SURAT_BATAS = 10;

/** Tanggal mulai dan batas rekonsiliasi gaji oleh keuangan, pada bulan sebelum TMT. */
export const REKON_GAJI_MULAI = 1;
export const REKON_GAJI_BATAS = 15;

let berlaku = BATAS_INPUT_SDM_BAWAAN;

/** Nilai tersimpan yang sah (bilangan bulat 1 sampai 31); selain itu, termasuk kosong, memakai bawaan. */
export function normalisasiBatasInputSdm(nilai: unknown): number {
  if (nilai === null || nilai === undefined || nilai === "") return BATAS_INPUT_SDM_BAWAAN;
  const n = Math.round(Number(nilai));
  return Number.isFinite(n) && n >= BATAS_INPUT_SDM_MIN && n <= BATAS_INPUT_SDM_MAKS ? n : BATAS_INPUT_SDM_BAWAAN;
}

/** Tanggal batas input Tim SDM yang sedang berlaku. */
export function batasInputSdm(): number {
  return berlaku;
}

/** Menetapkan tanggal batas yang berlaku dari nilai Pengaturan; mengembalikan nilai setelah dinormalkan. */
export function aturBatasInputSdm(nilai: unknown): number {
  berlaku = normalisasiBatasInputSdm(nilai);
  return berlaku;
}
