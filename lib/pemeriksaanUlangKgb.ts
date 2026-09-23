// Pemeriksaan ulang keadaan pegawai pada tahap-tahap setelah Input KGB.
//
// Masukan tim keuangan: hukuman disiplin diperiksa sekali saja saat Input KGB, padahal jarak input
// (bulan kedua sebelum TMT) ke TMT masih sekitar dua bulan. Bila dalam jendela itu terbit hukuman
// disiplin yang menunda KGB, atau pegawai berhenti aktif, SK yang terlanjur terbit membuat gaji naik
// padahal tidak seharusnya, dan kelebihannya harus disetor kembali ke kas negara. Karena itu keadaan
// diperiksa ulang pada dua pintu terakhir: Buat SK dan Konfirmasi keuangan.
//
// Modul ini murni; lapisan data memanggilnya dengan baris yang sudah dibaca.

import { hukdisMenahanKgb, type HukdisUntukKgb } from "./prosesKgb";
import { formatTanggalId, type NilaiTanggal } from "./waktu";

export type TahapPemeriksaan = "buat_sk" | "konfirmasi_keuangan";

const NAMA_TAHAP: Record<TahapPemeriksaan, string> = {
  buat_sk: "SK tidak dapat dibuat",
  konfirmasi_keuangan: "KGB tidak dapat dikonfirmasi",
};

export interface HasilPemeriksaanUlang {
  /** Alasan penolakan; null berarti aman dilanjutkan. */
  tolak: string | null;
}

/**
 * Keadaan pegawai pada tahap lanjutan. Menolak bila pegawai sudah tidak aktif atau sedang menjalani
 * hukuman disiplin yang menunda KGB dengan TMT ini. Pesannya menyebutkan langkah perbaikannya, karena
 * penolakan pada tahap ini berarti KGB yang sudah diinput perlu dibatalkan atau ditunda.
 */
export function periksaUlangKgb(input: {
  tahap: TahapPemeriksaan;
  pegawai: {
    nama: string;
    aktif: boolean | null;
    statusHukdis: boolean | null;
    tanggalHukdisBerakhir: NilaiTanggal;
    jenisHukdis: string | null;
  };
  riwayatHukdis: HukdisUntukKgb[];
  tmtKgb: NilaiTanggal;
  hariIni: Date;
}): HasilPemeriksaanUlang {
  const { pegawai, tahap } = input;
  if (pegawai.aktif === false) {
    return {
      tolak: `${NAMA_TAHAP[tahap]}: ${pegawai.nama} sudah tidak aktif. Batalkan KGB ini bila pegawai pensiun, pindah, atau berhenti sebelum TMT.`,
    };
  }

  const penahanan = hukdisMenahanKgb({
    riwayatHukdis: input.riwayatHukdis,
    pegawai,
    hariIni: input.hariIni,
    tmtKgb: input.tmtKgb,
  });
  if (penahanan.menahan) {
    const sampai = penahanan.berakhir ? ` sampai ${formatTanggalId(penahanan.berakhir)}` : "";
    return {
      tolak: `${NAMA_TAHAP[tahap]}: ${pegawai.nama} sedang menjalani hukuman disiplin yang menunda kenaikan gaji berkala${sampai}. Batalkan KGB ini, lalu proses ulang setelah masa hukuman berakhir.`,
    };
  }

  return { tolak: null };
}
