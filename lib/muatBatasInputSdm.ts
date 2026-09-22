// Memuat batas input Tim SDM dari Pengaturan (KonfigurasiKanwil) dan menetapkannya sebagai nilai yang
// berlaku di lib/batasInputSdm.ts. Hanya untuk server. Setiap titik masuk server yang menghitung jendela
// proses KGB (route API, cron, halaman server) memanggilnya lebih dulu; lib/batasInputSdm.test.ts
// memeriksa bahwa tidak ada yang terlewat.
//
// Nilai di-cache 60 detik per isolate agar tidak membaca database pada setiap permintaan; menyimpan
// Pengaturan membuang cache di isolate itu (lupakanBatasInputSdm), isolate lain menyusul paling lama
// 60 detik kemudian. Kegagalan membaca memakai nilai bawaan.

import { aturBatasInputSdm } from "./batasInputSdm";
import { db } from "./db";

const UMUR_CACHE_MS = 60_000;
let cache: { nilai: number; sampai: number } | null = null;

export async function muatBatasInputSdm(): Promise<number> {
  if (cache && Date.now() < cache.sampai) return aturBatasInputSdm(cache.nilai);
  const cfg = (await db.konfigurasiKanwil.findUnique({ id: "default" }).catch(() => null)) as {
    batasInputSdm?: unknown;
  } | null;
  const nilai = aturBatasInputSdm(cfg?.batasInputSdm);
  cache = { nilai, sampai: Date.now() + UMUR_CACHE_MS };
  return nilai;
}

export function lupakanBatasInputSdm(): void {
  cache = null;
}
