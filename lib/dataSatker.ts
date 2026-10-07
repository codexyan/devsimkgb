// Data satu satker tanpa membaca seluruh tabel (ADR-079).
//
// Rute UPT dulu menarik seluruh pegawai, riwayat KGB, surat, hukdis, dan riwayat SK seluruh Kanwil, lalu menyaringnya
// di Worker. Dengan 19 UPT dan ±1.300 pegawai, setiap buka dasbor UPT mengurai ribuan baris milik satker lain, dan
// itulah yang paling banyak memakan waktu CPU Worker (Error 1102 pada paket Free; tagihan CPU pada paket Paid).
//
// Satker pegawai ditentukan dari teks unit kerjanya (kodeSatkerPegawai), bukan kolom kode, jadi tidak dapat disaring
// langsung di basis data. Caranya dua langkah: baca id dan unit kerja seluruh pegawai saja (ringan), cocokkan
// satkernya di sini, lalu ambil baris lengkap dan riwayatnya menurut id.

import { db, type Where } from "./db";
import { pegawaiSatker } from "./aksesUpt";
import type { PegawaiRow } from "./sheets/tables";

/** Banyaknya id per permintaan `in`: UUID 36 karakter, jadi URL PostgREST tetap jauh di bawah batasnya. */
const POTONGAN = 150;

/**
 * Baris yang `kolom`-nya ada di `ids`, dipotong per POTONGAN id. Daftar kosong tidak memanggil basis data.
 * `whereLain` digabung ke setiap potongan, mis. `{ status: "disetujui" }`.
 */
export async function cariDalam<T>(
  ambil: (where: Where) => Promise<T[]>,
  kolom: string,
  ids: readonly (string | null | undefined)[],
  whereLain: Where = {},
): Promise<T[]> {
  const unik = [...new Set(ids.filter((id): id is string => !!id))];
  if (unik.length === 0) return [];
  const bagian: string[][] = [];
  for (let i = 0; i < unik.length; i += POTONGAN) bagian.push(unik.slice(i, i + POTONGAN));
  const hasil = await Promise.all(bagian.map((b) => ambil({ ...whereLain, [kolom]: { in: b } })));
  return hasil.flat();
}

/** Id pegawai satker `kode`, urut seperti findMany, dari kolom unit kerja saja. */
export async function idPegawaiSatker(kode: string): Promise<string[]> {
  const ringkas = await db.pegawai.findKolom(["id", "unitKerja"]);
  return pegawaiSatker(ringkas, kode).map((p) => p.id);
}

/** Baris lengkap pegawai menurut id, dengan urutan `ids`. */
export async function pegawaiMenurutId(ids: readonly string[]): Promise<PegawaiRow[]> {
  const baris = await cariDalam((where) => db.pegawai.findMany({ where }), "id", ids);
  const urut = new Map(ids.map((id, i) => [id, i]));
  return baris.sort((a, b) => (urut.get(a.id) ?? 0) - (urut.get(b.id) ?? 0));
}

/** Baris lengkap pegawai satker `kode`, urut seperti findMany. */
export async function pegawaiSatkerDb(kode: string): Promise<PegawaiRow[]> {
  return pegawaiMenurutId(await idPegawaiSatker(kode));
}
