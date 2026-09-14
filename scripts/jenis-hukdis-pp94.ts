// Jenis hukuman disiplin menurut PP 94 Tahun 2021 tentang Disiplin PNS (Pasal 8).
// Tidak ada jenis yang menunda KGB; penundaan KGB hanya dikenal di PP 53 Tahun 2010.
// Dipakai scripts/seed-sheets-master.ts dan scripts/migrasi-tahap1.ts.

export interface JenisHukdisSeed {
  kode: string;
  label: string;
  kategori: "ringan" | "sedang" | "berat";
  dasarHukum: string;
  durasiHukdis: number;
  urutan: number;
}

export const JENIS_HUKDIS_PP94: JenisHukdisSeed[] = [
  { kode: "teguran_lisan", label: "Teguran Lisan", kategori: "ringan", dasarHukum: "PP 94/2021 Pasal 8 ayat (2) huruf a", durasiHukdis: 0, urutan: 1 },
  { kode: "teguran_tertulis", label: "Teguran Tertulis", kategori: "ringan", dasarHukum: "PP 94/2021 Pasal 8 ayat (2) huruf b", durasiHukdis: 0, urutan: 2 },
  { kode: "pernyataan_tidak_puas", label: "Pernyataan Tidak Puas Secara Tertulis", kategori: "ringan", dasarHukum: "PP 94/2021 Pasal 8 ayat (2) huruf c", durasiHukdis: 0, urutan: 3 },
  { kode: "pemotongan_tukin_6_bulan", label: "Pemotongan Tunjangan Kinerja 25% Selama 6 Bulan", kategori: "sedang", dasarHukum: "PP 94/2021 Pasal 8 ayat (3) huruf a", durasiHukdis: 6, urutan: 4 },
  { kode: "pemotongan_tukin_9_bulan", label: "Pemotongan Tunjangan Kinerja 25% Selama 9 Bulan", kategori: "sedang", dasarHukum: "PP 94/2021 Pasal 8 ayat (3) huruf b", durasiHukdis: 9, urutan: 5 },
  { kode: "pemotongan_tukin_12_bulan", label: "Pemotongan Tunjangan Kinerja 25% Selama 12 Bulan", kategori: "sedang", dasarHukum: "PP 94/2021 Pasal 8 ayat (3) huruf c", durasiHukdis: 12, urutan: 6 },
  { kode: "penurunan_jabatan_12_bulan", label: "Penurunan Jabatan Setingkat Lebih Rendah Selama 12 Bulan", kategori: "berat", dasarHukum: "PP 94/2021 Pasal 8 ayat (4) huruf a", durasiHukdis: 12, urutan: 7 },
  { kode: "pembebasan_jabatan_pelaksana_12_bulan", label: "Pembebasan dari Jabatan Menjadi Jabatan Pelaksana Selama 12 Bulan", kategori: "berat", dasarHukum: "PP 94/2021 Pasal 8 ayat (4) huruf b", durasiHukdis: 12, urutan: 8 },
  { kode: "pemberhentian_dengan_hormat", label: "Pemberhentian dengan Hormat Tidak atas Permintaan Sendiri sebagai PNS", kategori: "berat", dasarHukum: "PP 94/2021 Pasal 8 ayat (4) huruf c", durasiHukdis: 0, urutan: 9 },
];

/** Kode PP 53/2010 tanpa padanan di PP 94/2021: dinonaktifkan agar riwayat lama tetap terbaca. */
export const KODE_HUKDIS_PP53_SAJA = [
  "penundaan_kgb",
  "penurunan_gaji_pokok",
  "penundaan_kenaikan_pangkat",
  "penurunan_pangkat",
  "pembebasan_jabatan",
  "pemberhentian_tidak_hormat",
];
