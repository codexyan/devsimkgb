/* Kabar dari kalkulator ke tabel gaji: sel gaji lama dan baru yang perlu disorot. Lewat event di window,
   karena keduanya komponen terpisah pada halaman server dan tidak berbagi state. */

export const SOROT_TABEL = "tabel-gaji:sorot";

export interface SelSorot {
  golongan: string;
  /** Masa kerja golongan dalam tahun. */
  mkg: number;
}

export interface SorotTabel {
  lama: SelSorot;
  baru: SelSorot;
}
