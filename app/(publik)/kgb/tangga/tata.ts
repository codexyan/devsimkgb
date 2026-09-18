/* Tata letak lanskap tangga gaji, tanpa three.js agar bisa diuji.

   Sumbu x = masa kerja golongan (MKG, tahun), sumbu z = golongan (I/a paling dekat kamera di +z, IV/e
   paling jauh, dengan celah di antara golongan I, II, III, IV), sumbu y = gaji pokok. Baris yang tinggi
   ada di belakang sehingga tidak menutupi baris yang rendah. Setiap anak tangga adalah
   satu balok yang membentang dari MKG saat gaji itu mulai berlaku sampai MKG anak tangga berikutnya,
   sehingga tiap baris terbaca sebagai tangga yang naik sepanjang masa kerja. */

export interface AnakLanskap {
  mkg: number;
  gaji: number;
}

export interface BarisLanskap {
  golongan: string;
  anak: AnakLanskap[];
}

export interface Balok {
  baris: number;
  anak: number;
  /** 0 = golongan I, 1 = II, 2 = III, 3 = IV */
  kelompok: number;
  x0: number;
  x1: number;
  z: number;
  tinggi: number;
}

export interface Tata {
  balok: Balok[];
  /** Posisi z tiap baris, dipakai label dan kamera. */
  zBaris: number[];
  setengahLebar: number;
  setengahDalam: number;
  tinggiMaks: number;
}

export const SATUAN_MKG = 0.34;
export const MKG_TENGAH = 17;
export const MKG_UJUNG = 34;
export const DALAM_BALOK = 0.34;
const JARAK_BARIS = 0.46;
const CELAH_KELOMPOK = 0.44;
const GAJI_DASAR = 1_500_000;
const GAJI_PER_SATUAN = 1_450_000;
const TINGGI_DASAR = 0.12;

export function kelompokGolongan(golongan: string): number {
  const romawi = golongan.split("/")[0];
  return Math.max(0, ["I", "II", "III", "IV"].indexOf(romawi));
}

export const xMkg = (mkg: number) => (mkg - MKG_TENGAH) * SATUAN_MKG;
export const tinggiGaji = (gaji: number) => TINGGI_DASAR + (gaji - GAJI_DASAR) / GAJI_PER_SATUAN;

export function susunLanskap(baris: BarisLanskap[]): Tata {
  const zMentah = baris.map((b, r) => -(r * JARAK_BARIS + kelompokGolongan(b.golongan) * CELAH_KELOMPOK));
  const zTengah = zMentah.length ? (zMentah[0] + zMentah[zMentah.length - 1]) / 2 : 0;
  const zBaris = zMentah.map((z) => z - zTengah);

  const balok: Balok[] = [];
  let tinggiMaks = 0;
  baris.forEach((b, r) => {
    const kelompok = kelompokGolongan(b.golongan);
    b.anak.forEach((a, i) => {
      const berikut = b.anak[i + 1];
      const mkgAkhir = berikut ? berikut.mkg : Math.min(a.mkg + 2, MKG_UJUNG);
      const tinggi = tinggiGaji(a.gaji);
      tinggiMaks = Math.max(tinggiMaks, tinggi);
      balok.push({ baris: r, anak: i, kelompok, x0: xMkg(a.mkg), x1: xMkg(mkgAkhir), z: zBaris[r], tinggi });
    });
  });

  return {
    balok,
    zBaris,
    setengahLebar: xMkg(MKG_UJUNG),
    setengahDalam: zBaris.length ? Math.abs(zBaris[0]) + DALAM_BALOK / 2 : 0,
    tinggiMaks,
  };
}

type Vek = readonly [number, number, number];

/** Jarak sepanjang sinar ke balok (uji slab), atau null bila meleset. Arah tidak harus satuan. */
export function potongBalok(asal: Vek, arah: Vek, b: Balok): number | null {
  const min = [b.x0, 0, b.z - DALAM_BALOK / 2];
  const maks = [b.x1, b.tinggi, b.z + DALAM_BALOK / 2];
  let dekat = -Infinity;
  let jauh = Infinity;
  for (let s = 0; s < 3; s++) {
    if (Math.abs(arah[s]) < 1e-9) {
      if (asal[s] < min[s] || asal[s] > maks[s]) return null;
      continue;
    }
    let t1 = (min[s] - asal[s]) / arah[s];
    let t2 = (maks[s] - asal[s]) / arah[s];
    if (t1 > t2) [t1, t2] = [t2, t1];
    dekat = Math.max(dekat, t1);
    jauh = Math.min(jauh, t2);
    if (dekat > jauh) return null;
  }
  if (jauh < 0) return null;
  return Math.max(dekat, 0);
}

/** Indeks balok terdekat yang dikenai sinar, atau -1. */
export function pilihBalok(asal: Vek, arah: Vek, balok: readonly Balok[]): number {
  let terpilih = -1;
  let jarak = Infinity;
  balok.forEach((b, i) => {
    const t = potongBalok(asal, arah, b);
    if (t !== null && t < jarak) {
      jarak = t;
      terpilih = i;
    }
  });
  return terpilih;
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
