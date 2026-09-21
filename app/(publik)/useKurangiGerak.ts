"use client";

import { useSyncExternalStore } from "react";

/* Preferensi prefers-reduced-motion yang ikut berubah bila pengguna menggantinya saat halaman terbuka.
   Server dan hidrasi pertama menganggap gerak boleh; gaya CSS tetap menjadi pengaman utama. */
const kueri = "(prefers-reduced-motion: reduce)";

function langganan(cb: () => void) {
  const mq = window.matchMedia(kueri);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useKurangiGerak(): boolean {
  return useSyncExternalStore(
    langganan,
    () => window.matchMedia(kueri).matches,
    () => false,
  );
}
