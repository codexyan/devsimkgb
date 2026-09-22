// Jadwal rekonsiliasi gaji oleh bagian keuangan untuk satu bulan TMT KGB. Keuangan merekon data gaji dan
// mengajukan SPM gaji induk di aplikasi Gaji Web pada tanggal 1 sampai 15 bulan sebelum TMT (PMK 62/2023),
// jadi SK KGB bulan TMT itu harus sudah dikonfirmasi sebelum tanggal 15. Lihat lib/batasInputSdm.ts.

import { REKON_GAJI_BATAS, REKON_GAJI_MULAI } from "@/lib/batasInputSdm";

export type StatusRekon = "akan_datang" | "berjalan" | "lewat";

export interface JendelaRekonGaji {
  /** Bulan TMT "yyyy-mm" yang direkon. */
  bulanTmt: string;
  mulai: Date;
  batas: Date;
}

function kunci(tahun: number, bulan0: number): string {
  const d = new Date(tahun, bulan0, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Jendela rekon Gaji Web untuk bulan TMT "yyyy-mm": tanggal 1 sampai 15 bulan sebelumnya. */
export function jendelaRekonGaji(bulanTmt: string): JendelaRekonGaji {
  const [y, m] = bulanTmt.split("-").map(Number);
  return {
    bulanTmt,
    mulai: new Date(y, m - 2, REKON_GAJI_MULAI),
    batas: new Date(y, m - 2, REKON_GAJI_BATAS),
  };
}

/** Kedudukan hari ini (tengah malam, kalender WITA) terhadap jendela rekon bulan TMT itu. */
export function statusRekonGaji(bulanTmt: string, hariIni: Date): StatusRekon {
  const { mulai, batas } = jendelaRekonGaji(bulanTmt);
  if (hariIni.getTime() < mulai.getTime()) return "akan_datang";
  if (hariIni.getTime() > batas.getTime()) return "lewat";
  return "berjalan";
}

/**
 * Bulan TMT yang sedang menjadi fokus keuangan: yang jendela rekonnya berjalan (sampai tanggal 15),
 * atau sesudah tanggal 15, bulan TMT berikutnya yang rekonnya dimulai bulan depan.
 */
export function bulanFokusRekon(hariIni: Date): string {
  const geser = hariIni.getDate() <= REKON_GAJI_BATAS ? 1 : 2;
  return kunci(hariIni.getFullYear(), hariIni.getMonth() + geser);
}
