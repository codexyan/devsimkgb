// KPPN mitra tiap satker, yang dapat disesuaikan dari Pengaturan.
//
// SK kenaikan gaji berkala ditujukan ke KPPN mitra satker, sehingga salah KPPN berarti SK dikirim ke
// kantor bayar yang keliru. Kemitraannya sendiri bisa berubah tanpa menunggu rilis aplikasi: KPPN baru
// dibuka, atau satker dipindahkan. Karena itu nilainya dapat diubah Super Admin, dan yang disimpan di
// Pengaturan hanya satker yang berbeda dari bawaannya di lib/satker.ts.
//
// Modul ini murni: penerapannya pada daftar satker dilakukan lewat aturKppnSatker(), yang dipanggil
// pemuat di lib/muatKppnSatker.ts pada setiap titik masuk server yang menampilkan atau memakai KPPN.

import { KPPN_DIKENAL, SATKER } from "./satker";

/** KPPN bawaan tiap satker, direkam sebelum penyesuaian apa pun diterapkan. */
const BAWAAN: ReadonlyMap<string, string> = new Map(SATKER.map((s) => [s.kode, s.kppn]));

export function kppnBawaan(kode: string): string {
  return BAWAAN.get(kode) ?? "";
}

/** Panjang nama KPPN yang masih masuk akal; menjaga isian tidak dipakai menampung teks lain. */
const MAKS_NAMA_KPPN = 60;

/**
 * Penyesuaian yang sah dari nilai tersimpan atau kiriman formulir: hanya kode satker yang dikenal,
 * nama KPPN yang tidak kosong, dan yang benar-benar berbeda dari bawaannya. Bentuk lain diabaikan
 * diam-diam, sebab satu isian yang rusak tidak boleh membuat seluruh pengaturan gagal dimuat.
 */
export function normalisasiKppnSatker(nilai: unknown): Record<string, string> {
  let mentah: unknown = nilai;
  if (typeof nilai === "string") {
    const teks = nilai.trim();
    if (!teks) return {};
    try {
      mentah = JSON.parse(teks);
    } catch {
      return {};
    }
  }
  if (typeof mentah !== "object" || mentah === null || Array.isArray(mentah)) return {};

  const hasil: Record<string, string> = {};
  for (const [kode, isi] of Object.entries(mentah as Record<string, unknown>)) {
    if (!BAWAAN.has(kode)) continue;
    if (typeof isi !== "string") continue;
    const kppn = isi.trim().replace(/\s+/g, " ").slice(0, MAKS_NAMA_KPPN);
    if (!kppn || kppn === kppnBawaan(kode)) continue;
    hasil[kode] = kppn;
  }
  return hasil;
}

/**
 * Terapkan penyesuaian ke daftar satker yang dipakai seluruh aplikasi, lalu kembalikan yang berlaku.
 * Satker yang tidak disesuaikan dikembalikan ke KPPN bawaannya, sehingga memanggil ulang fungsi ini
 * dengan nilai baru tidak meninggalkan sisa penyesuaian sebelumnya.
 */
export function aturKppnSatker(nilai: unknown): Record<string, string> {
  const ubahan = normalisasiKppnSatker(nilai);
  for (const satker of SATKER) satker.kppn = ubahan[satker.kode] ?? kppnBawaan(satker.kode);
  return ubahan;
}

/** KPPN yang berlaku untuk tiap satker saat ini, termasuk yang memakai bawaan. */
export function kppnBerlaku(): { kode: string; nama: string; kppn: string; bawaan: string }[] {
  return SATKER.map((s) => ({ kode: s.kode, nama: s.nama, kppn: s.kppn, bawaan: kppnBawaan(s.kode) }));
}

/** Pilihan KPPN untuk Pengaturan: yang dikenal, ditambah nama lain yang sedang dipakai. */
export function pilihanKppn(): string[] {
  const dipakai = SATKER.map((s) => s.kppn);
  const lainnya = [...new Set(dipakai)].filter((k) => !KPPN_DIKENAL.includes(k as (typeof KPPN_DIKENAL)[number])).sort();
  return [...KPPN_DIKENAL, ...lainnya];
}
