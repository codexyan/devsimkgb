"use client";

import { useCallback, useSyncExternalStore } from "react";
import { KUERI_KURANGI_GERAK as KUERI, KUNCI_GERAK } from "./gerakAwal";

/* ── Pilihan animasi SIM-KGB ─────────────────────────────────────────────
   Peramban meneruskan pengaturan perangkat (Windows: Efek animasi) sebagai prefers-reduced-motion. Banyak
   komputer kantor mematikannya, sehingga seluruh gerak SIM-KGB ikut mati tanpa disadari penggunanya. Pengguna
   karena itu boleh memilih sendiri: ikuti perangkat (bawaan), selalu nyala, atau kurangi.

   Pilihan disimpan di localStorage ("kgb-gerak"). Keadaan yang berlaku dipasang sebagai atribut
   html[data-gerak="gerak" | "kurangi"] oleh skrip awal di app/layout.tsx sebelum halaman dilukis, lalu
   diperbarui di sini bila pilihan atau pengaturan perangkat berubah. CSS memakai atribut itu; bila atributnya
   tidak ada (skrip gagal), CSS kembali ke prefers-reduced-motion. */

export type PilihanGerak = "sistem" | "nyala" | "kurangi";

export const LABEL_GERAK: Record<PilihanGerak, string> = {
  sistem: "Ikuti perangkat",
  nyala: "Nyala",
  kurangi: "Kurangi",
};

export function bacaPilihanGerak(): PilihanGerak {
  try {
    const v = localStorage.getItem(KUNCI_GERAK);
    return v === "nyala" || v === "kurangi" ? v : "sistem";
  } catch {
    return "sistem";
  }
}

/** Keadaan yang berlaku dari satu pilihan. */
export function gerakBerlaku(pilihan: PilihanGerak): "gerak" | "kurangi" {
  if (pilihan === "nyala") return "gerak";
  if (pilihan === "kurangi") return "kurangi";
  return window.matchMedia(KUERI).matches ? "kurangi" : "gerak";
}

/**
 * Apakah gerak harus dikurangi sekarang. Dipakai kode peramban sebagai pengganti
 * matchMedia("(prefers-reduced-motion: reduce)"), agar pilihan pengguna ikut dihormati.
 */
export function kurangiGerak(): boolean {
  const atribut = document.documentElement.getAttribute("data-gerak");
  if (atribut === "gerak") return false;
  if (atribut === "kurangi") return true;
  return window.matchMedia(KUERI).matches;
}

function pasangAtribut() {
  document.documentElement.setAttribute("data-gerak", gerakBerlaku(bacaPilihanGerak()));
}

const pendengar = new Set<() => void>();
const kabari = () => {
  pasangAtribut();
  pendengar.forEach((l) => l());
};

function langganan(cb: () => void) {
  pendengar.add(cb);
  const mq = window.matchMedia(KUERI);
  mq.addEventListener("change", kabari);
  window.addEventListener("storage", kabari);
  return () => {
    pendengar.delete(cb);
    mq.removeEventListener("change", kabari);
    window.removeEventListener("storage", kabari);
  };
}

/** Pilihan animasi dan pengubahnya, untuk tombol di sidebar. */
export function usePilihanGerak(): [PilihanGerak, (p: PilihanGerak) => void] {
  const pilihan = useSyncExternalStore(langganan, bacaPilihanGerak, () => "sistem" as PilihanGerak);
  const ubah = useCallback((p: PilihanGerak) => {
    try {
      localStorage.setItem(KUNCI_GERAK, p);
    } catch {
      // Tanpa penyimpanan, pilihan berlaku sampai halaman dimuat ulang.
    }
    kabari();
  }, []);
  return [pilihan, ubah];
}

/** Apakah gerak dikurangi, ikut berubah bila pilihan atau pengaturan perangkat berubah. */
export function useKurangiGerakBerlaku(): boolean {
  return useSyncExternalStore(langganan, kurangiGerak, () => false);
}
