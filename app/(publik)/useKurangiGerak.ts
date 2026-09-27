"use client";

import { useKurangiGerakBerlaku } from "@/lib/ui/gerak";

/* Apakah gerak dikurangi, menurut pilihan animasi pengguna (lib/ui/gerak.ts) atau pengaturan perangkat.
   Ikut berubah bila salah satunya diganti saat halaman terbuka. Server dan hidrasi pertama menganggap gerak
   boleh; gaya CSS tetap menjadi pengaman utama. */
export function useKurangiGerak(): boolean {
  return useKurangiGerakBerlaku();
}
