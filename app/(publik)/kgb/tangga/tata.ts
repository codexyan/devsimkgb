/* Aturan tangga gaji yang dipakai bersama penjelajah beranda dan tabel gaji, tanpa React agar bisa diuji.
   Setiap anak tangga adalah gaji pokok yang mulai berlaku pada masa kerja golongan (MKG) tertentu. */

export interface AnakLanskap {
  mkg: number;
  gaji: number;
}

/** Kelompok golongan I sampai IV (0 sampai 3) dari kode ruang, mis. "III/a" → 2. */
export function kelompokGolongan(golongan: string): number {
  const romawi = golongan.split("/")[0];
  return Math.max(0, ["I", "II", "III", "IV"].indexOf(romawi));
}

/** Anak tangga yang berlaku pada masa kerja tertentu: MKG terbesar yang tidak melebihinya.
 *  Mengembalikan -1 bila masa kerja masih di bawah anak tangga pertama golongan itu (misalnya I/b
 *  sampai I/d dan II/b sampai II/d yang baru mulai pada MKG 3): pada masa kerja itu belum ada gaji
 *  pokok yang berlaku di ruang tersebut. */
export function anakBerlaku(anak: readonly AnakLanskap[], mkg: number): number {
  let indeks = -1;
  anak.forEach((a, i) => {
    if (a.mkg <= mkg) indeks = i;
  });
  return indeks;
}
