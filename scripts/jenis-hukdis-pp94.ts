// Jenis hukuman disiplin menurut PP 94 Tahun 2021 tentang Disiplin PNS (Pasal 8).
// Hukuman disiplin sedang (ketiga jenis pemotongan tunjangan kinerja) menunda KGB 12 bulan: menurut Pasal 42,
// sebelum PP mengenai gaji dan tunjangan berlaku, hukuman sedang masih mengikuti Pasal 7 ayat (3) PP 53/2010,
// termasuk penundaan KGB 1 tahun (panduan bagian hukdis; ADR-052). Sama dengan yang tercatat di produksi.
// Dipakai scripts/seed-sheets-master.ts, scripts/seed-lokal.ts, scripts/migrasi-tahap1.ts,
// dan scripts/salin-sheets-ke-supabase.ts.

export interface JenisHukdisSeed {
  kode: string;
  label: string;
  kategori: "ringan" | "sedang" | "berat";
  dasarHukum: string;
  durasiHukdis: number;
  urutan: number;
  berdampakKGB: boolean;
  /** Lama penundaan KGB dalam bulan; null bila tidak berdampak. */
  durasiTunda: number | null;
}

const TIDAK_MENUNDA = { berdampakKGB: false, durasiTunda: null } as const;
const MENUNDA_12_BULAN = { berdampakKGB: true, durasiTunda: 12 } as const;

export const JENIS_HUKDIS_PP94: JenisHukdisSeed[] = [
  { kode: "teguran_lisan", label: "Teguran Lisan", kategori: "ringan", dasarHukum: "PP 94/2021 Pasal 8 ayat (2) huruf a", durasiHukdis: 0, urutan: 1, ...TIDAK_MENUNDA },
  { kode: "teguran_tertulis", label: "Teguran Tertulis", kategori: "ringan", dasarHukum: "PP 94/2021 Pasal 8 ayat (2) huruf b", durasiHukdis: 0, urutan: 2, ...TIDAK_MENUNDA },
  { kode: "pernyataan_tidak_puas", label: "Pernyataan Tidak Puas Secara Tertulis", kategori: "ringan", dasarHukum: "PP 94/2021 Pasal 8 ayat (2) huruf c", durasiHukdis: 0, urutan: 3, ...TIDAK_MENUNDA },
  { kode: "pemotongan_tukin_6_bulan", label: "Pemotongan Tunjangan Kinerja 25% Selama 6 Bulan", kategori: "sedang", dasarHukum: "PP 94/2021 Pasal 8 ayat (3) huruf a", durasiHukdis: 6, urutan: 4, ...MENUNDA_12_BULAN },
  { kode: "pemotongan_tukin_9_bulan", label: "Pemotongan Tunjangan Kinerja 25% Selama 9 Bulan", kategori: "sedang", dasarHukum: "PP 94/2021 Pasal 8 ayat (3) huruf b", durasiHukdis: 9, urutan: 5, ...MENUNDA_12_BULAN },
  { kode: "pemotongan_tukin_12_bulan", label: "Pemotongan Tunjangan Kinerja 25% Selama 12 Bulan", kategori: "sedang", dasarHukum: "PP 94/2021 Pasal 8 ayat (3) huruf c", durasiHukdis: 12, urutan: 6, ...MENUNDA_12_BULAN },
  { kode: "penurunan_jabatan_12_bulan", label: "Penurunan Jabatan Setingkat Lebih Rendah Selama 12 Bulan", kategori: "berat", dasarHukum: "PP 94/2021 Pasal 8 ayat (4) huruf a", durasiHukdis: 12, urutan: 7, ...TIDAK_MENUNDA },
  { kode: "pembebasan_jabatan_pelaksana_12_bulan", label: "Pembebasan dari Jabatan Menjadi Jabatan Pelaksana Selama 12 Bulan", kategori: "berat", dasarHukum: "PP 94/2021 Pasal 8 ayat (4) huruf b", durasiHukdis: 12, urutan: 8, ...TIDAK_MENUNDA },
  { kode: "pemberhentian_dengan_hormat", label: "Pemberhentian dengan Hormat Tidak atas Permintaan Sendiri sebagai PNS", kategori: "berat", dasarHukum: "PP 94/2021 Pasal 8 ayat (4) huruf c", durasiHukdis: 0, urutan: 9, ...TIDAK_MENUNDA },
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
