// Memuat KPPN mitra satker dari Pengaturan (KonfigurasiKanwil) lalu menerapkannya pada daftar satker
// (lib/kppnSatker.ts). Hanya untuk server. Setiap titik masuk server yang menampilkan atau memakai KPPN
// memanggilnya lebih dulu; lib/kppnSatker.test.ts memeriksa bahwa tidak ada yang terlewat.
//
// Nilainya di-cache 60 detik per isolate agar tidak membaca basis data pada setiap permintaan; menyimpan
// Pengaturan membuang cache di isolate itu (lupakanKppnSatker), isolate lain menyusul paling lama 60
// detik kemudian. Kegagalan membaca memakai KPPN bawaan.

import { aturKppnSatker } from "./kppnSatker";
import { db } from "./db";

const UMUR_CACHE_MS = 60_000;
let cache: { nilai: Record<string, string>; sampai: number } | null = null;

export async function muatKppnSatker(): Promise<Record<string, string>> {
  if (cache && Date.now() < cache.sampai) return aturKppnSatker(cache.nilai);
  const cfg = (await db.konfigurasiKanwil.findUnique({ id: "default" }).catch(() => null)) as {
    kppnSatker?: unknown;
  } | null;
  const nilai = aturKppnSatker(cfg?.kppnSatker);
  cache = { nilai, sampai: Date.now() + UMUR_CACHE_MS };
  return nilai;
}

export function lupakanKppnSatker(): void {
  cache = null;
}
