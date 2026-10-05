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

/** Golongan dan masa kerja golongan yang disalin KGB dari data pegawai saat Input KGB (data lama di SK). */
export interface DataLamaKgb {
  golonganLama?: string | null;
  mkgTahunLama?: number | null;
  mkgBulanLama?: number | null;
}

/**
 * Pesan bila golongan atau masa kerja golongan pegawai berubah sesudah KGB ini diinput; null bila masih sama
 * (ADR-062).
 *
 * Selama KGB berjalan, golongan, masa kerja golongan, dan gaji pokok pegawai dikunci (ADR-056). Yang masih dapat
 * mengubahnya hanya SK kenaikan pangkat (termasuk penyesuaian ijazah) atau PMK yang dicatat belakangan. KGB yang
 * dihitung sebelum itu masih memakai golongan dan gaji lama, sehingga mengganti baris Atas dasarnya saja akan mencetak
 * SK yang bertentangan dengan dasarnya sendiri. Jalan keluarnya membatalkan KGB lalu Input Ulang, yang menghitung
 * gaji dan Atas dasarnya dari SK terbaru.
 */
export function pesanKgbBasi(
  kgb: DataLamaKgb,
  pegawai: { nama: string; golonganRuang?: string | null; mkgTahun?: number | null; mkgBulan?: number | null },
): string | null {
  const golonganKgb = kgb.golonganLama?.trim() ?? "";
  // Record lama tanpa golongan tidak dapat dibandingkan.
  if (!golonganKgb) return null;
  const golonganPegawai = pegawai.golonganRuang?.trim() ?? "";
  const bulanKgb = (kgb.mkgTahunLama ?? 0) * 12 + (kgb.mkgBulanLama ?? 0);
  const bulanPegawai = (pegawai.mkgTahun ?? 0) * 12 + (pegawai.mkgBulan ?? 0);
  if (golonganKgb === golonganPegawai && bulanKgb === bulanPegawai) return null;
  const keadaan = (golongan: string, tahun: number | null | undefined, bulan: number | null | undefined) =>
    `${golongan || "-"}, ${tahun ?? 0} tahun ${bulan ?? 0} bulan`;
  return (
    `Golongan atau masa kerja golongan ${pegawai.nama} berubah sesudah KGB ini diinput: kini ` +
    `${keadaan(golonganPegawai, pegawai.mkgTahun, pegawai.mkgBulan)}, sedangkan KGB ini dihitung dari ` +
    `${keadaan(golonganKgb, kgb.mkgTahunLama, kgb.mkgBulanLama)}. Biasanya karena SK kenaikan pangkat atau PMK dicatat ` +
    "sesudah Input KGB. Gaji pokok pada KGB ini masih memakai data lama, sehingga SK-nya tidak dapat dibuat. " +
    "Batalkan KGB ini, lalu Input Ulang agar gaji dan Atas dasarnya dihitung dari SK terbaru."
  );
}
