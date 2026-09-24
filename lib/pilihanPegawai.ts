// Pilihan baku untuk isian data pegawai yang nilainya terbatas.
//
// Sebelum ini tiap formulir punya daftarnya sendiri, dan panduan impor menyebut daftar yang ketiga.
// Akibatnya terbaca pada data: eselon tersimpan dalam dua bentuk sekaligus ("III.a" dan "Eselon III"),
// sedangkan nilai yang paling banyak dipakai, "Non Eselon", justru tidak ada pada pilihan formulir
// Kanwil sehingga hanya bisa dikosongkan. Daftar di sini menjadi satu-satunya sumbernya.
//
// Nilai lama yang tidak ada di daftar tidak pernah ditimpa diam-diam: `denganNilaiSaatIni` menambahkan
// nilai yang sedang dipakai ke pilihan, sehingga operator melihat apa adanya dan memutuskan sendiri.

export const JENIS_KELAMIN = ["Laki-laki", "Perempuan"] as const;

export const PENDIDIKAN_TERAKHIR = ["SD", "SMP", "SMA/SMK", "D1", "D2", "D3", "D4", "S1", "S2", "S3"] as const;

/**
 * Jenis jabatan menurut penataan jabatan ASN: pelaksana, fungsional tertentu, dan struktural.
 * Urutannya mengikuti banyaknya pemakaian, agar yang paling sering dipilih berada di atas.
 */
export const JENIS_JABATAN = [
  "Jabatan Fungsional Umum/Pelaksana",
  "Jabatan Fungsional Tertentu",
  "Struktural",
] as const;

/**
 * Eselon jabatan struktural, dengan "Non Eselon" lebih dulu karena itulah keadaan sebagian besar
 * pegawai: pelaksana dan pejabat fungsional tidak memangku eselon.
 */
export const ESELON = ["Non Eselon", "I.a", "I.b", "II.a", "II.b", "III.a", "III.b", "IV.a", "IV.b", "V.a"] as const;

/**
 * Daftar pilihan yang sudah memuat nilai yang sedang dipakai, meski nilai itu di luar daftar baku.
 * Dipakai formulir agar data lama, misalnya eselon yang tertulis "Eselon III", tetap terlihat dan tidak
 * berubah hanya karena formulirnya dibuka.
 */
export function denganNilaiSaatIni(daftar: readonly string[], nilai: string | null | undefined): string[] {
  const sekarang = (nilai ?? "").trim();
  if (!sekarang || daftar.includes(sekarang)) return [...daftar];
  return [...daftar, sekarang];
}
