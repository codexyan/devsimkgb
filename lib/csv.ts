/**
 * Bentuk berkas CSV yang diunduh dari SIM-KGB.
 *
 * Excel tidak memisah kolom berdasar koma, melainkan berdasar "List separator" pada Region Windows.
 * Perangkat berlokal Indonesia menyetelnya titik koma, sehingga berkas berpemisah koma yang dibuka
 * dengan klik ganda tampil menumpuk di kolom A; berkasnya sendiri sah, pembacanya yang berbeda.
 *
 * Baris petunjuk `sep=;` di awal berkas menimpa setelan itu, jadi kolomnya terbagi benar di lokal
 * mana pun tanpa operator perlu menyentuh Region Windows. Petunjuk itu hanya dikenal Excel dan
 * LibreOffice; pengurai lain membacanya sebagai baris biasa, karena itu {@link buangPetunjukPemisah}
 * dipakai sebelum berkas unggahan diurai PapaParse.
 *
 * Yang tidak diselesaikan baris ini: NIP 18 angka tetap dibaca Excel sebagai bilangan dan berubah
 * menjadi notasi ilmiah. Penjagaannya tetap lewat Data → From Text/CSV, atau lewat `="..."` seperti
 * pada berkas cadangan.
 */
export const PEMISAH_CSV = ";";

/** BOM agar Excel membaca UTF-8, lalu petunjuk pemisah. Selalu menjadi dua hal pertama pada berkas. */
export const KEPALA_BERKAS_CSV = `﻿sep=${PEMISAH_CSV}\r\n`;

/**
 * Satu nilai menjadi sel CSV. Dikutip bila memuat pemisah, koma, petik, atau pindah baris; koma ikut
 * dikutip meski bukan pemisah, agar berkasnya tetap utuh bila dibuka pengurai yang menebak pemisah.
 */
export function selCsv(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return "";
  const s = nilai instanceof Date ? (Number.isNaN(nilai.getTime()) ? "" : nilai.toISOString()) : String(nilai);
  return /["\n\r,;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Baris nilai menjadi isi berkas CSV lengkap: kepala berkas, baris berpemisah titik koma, akhiran CRLF. */
export function keBerkasCsv(baris: readonly (readonly unknown[])[]): string {
  return KEPALA_BERKAS_CSV + baris.map((b) => b.map(selCsv).join(PEMISAH_CSV)).join("\r\n") + "\r\n";
}

/**
 * Membuang baris `sep=` di awal teks berkas, dengan BOM-nya dibiarkan utuh untuk pengurai di
 * belakangnya. Dipakai pada berkas yang diunggah balik, baik hasil unduhan templat maupun berkas yang
 * disimpan ulang Excel; berkas tanpa baris itu tidak berubah sama sekali.
 */
export function buangPetunjukPemisah(teks: string): string {
  return teks.replace(/^(﻿)?sep=.\r?\n/i, "$1");
}
