// Hitungan di balik Koreksi dasar gaji pada modal Ubah dasar KGB (ADR-040).
//
// Koreksi ini membetulkan angka yang salah ketik tanpa mencatat riwayat kenaikan pangkat atau PMK, jadi
// yang berubah langsung adalah gaji pokok dan jadwal KGB berikutnya. Karena itu ketiganya dihitung di
// sini, bukan diketik operator, dan diuji terpisah dari tampilannya.
//
// Yang diperbaiki modul ini, selain dapat diuji: dulu mengganti golongan memanggil `ubah("mkg")("0_0")`,
// sehingga membetulkan salah ketik golongan diam-diam menjatuhkan masa kerja ke nol dan gaji pokok ke
// angka terendah golongan itu — tanpa pesan apa pun.

import { bulanKeKgbBerikutnya, getMKGOptions, tambahBulan } from "./tabelGaji";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

export interface LangkahMkg {
  tahun: number;
  bulan: number;
  gaji: number;
}

/** Hasil penyesuaian masa kerja golongan setelah golongan diganti. */
export interface MkgSetelahGanti {
  tahun: number;
  bulan: number;
  /** true bila langkah lama tidak ada pada golongan baru sehingga terpaksa digeser ke yang terdekat. */
  disesuaikan: boolean;
}

/** Langkah masa kerja golongan terdekat pada golongan itu; null bila golongannya tidak dikenal. */
export function mkgTerdekat(golongan: string, tahun: number, bulan: number): LangkahMkg | null {
  const pilihan = getMKGOptions(golongan);
  if (pilihan.length === 0) return null;
  const target = tahun * 12 + bulan;
  return pilihan.reduce((a, b) =>
    Math.abs(a.tahun * 12 + a.bulan - target) <= Math.abs(b.tahun * 12 + b.bulan - target) ? a : b,
  );
}

/**
 * Masa kerja golongan yang dipakai setelah golongan diganti.
 *
 * Langkah yang sedang dipakai dipertahankan bila golongan baru memilikinya — itu keadaan yang paling
 * lazim, sebab tabel gaji PP 5/2024 memakai langkah masa kerja yang sama untuk hampir semua golongan.
 * Bila tidak ada, diambil yang terdekat dan ditandai `disesuaikan` supaya layar dapat mengatakannya,
 * bukan mengubahnya diam-diam. Null hanya bila golongan barunya tidak dikenal tabel gaji.
 */
export function mkgSetelahGantiGolongan(golonganBaru: string, tahun: number, bulan: number): MkgSetelahGanti | null {
  const pilihan = getMKGOptions(golonganBaru);
  if (pilihan.length === 0) return null;
  if (pilihan.some((m) => m.tahun === tahun && m.bulan === bulan)) return { tahun, bulan, disesuaikan: false };
  const dekat = mkgTerdekat(golonganBaru, tahun, bulan)!;
  return { tahun: dekat.tahun, bulan: dekat.bulan, disesuaikan: true };
}

/** Gaji pokok menurut tabel PP 5/2024; null bila langkah itu tidak ada pada golongan tersebut. */
export function gajiPokokUntuk(golongan: string, tahun: number, bulan: number): number | null {
  return getMKGOptions(golongan).find((m) => m.tahun === tahun && m.bulan === bulan)?.gaji ?? null;
}

/**
 * TMT KGB berikutnya menurut langkah tabel gaji, dihitung dari TMT KGB terakhir. Sama dengan yang
 * dipakai impor Data Pegawai dan formulir UPT, sehingga koreksi tidak meninggalkan jadwal yang
 * bertentangan dengan golongan dan masa kerjanya. Null bila TMT KGB terakhir belum terisi.
 */
export function tmtKgbBerikutnyaHitung(
  golongan: string,
  tahun: number,
  bulan: number,
  tmtKgbTerakhir: NilaiTanggal,
): Date | null {
  const awal = tanggalKalender(tmtKgbTerakhir);
  if (!awal) return null;
  return tambahBulan(awal, bulanKeKgbBerikutnya(golongan, tahun, bulan));
}
