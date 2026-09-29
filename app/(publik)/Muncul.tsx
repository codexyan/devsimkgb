"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/* Gerak masuk saat digulir untuk elemen ber-atribut data-muncul. Tanpa JavaScript semua isi langsung
   tampil, karena gaya sembunyi hanya berlaku setelah <html data-muncul="siap"> dipasang di sini. */
export default function Muncul() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const html = document.documentElement;
    const elemen = Array.from(document.querySelectorAll<HTMLElement>("[data-muncul]:not([data-muncul='1'])"));
    const pengamat = new IntersectionObserver(
      (entri) => {
        for (const e of entri) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.muncul = "1";
          pengamat.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    elemen.forEach((el) => pengamat.observe(el));
    html.dataset.muncul = "siap";
    return () => {
      pengamat.disconnect();
      delete html.dataset.muncul;
    };
  }, [pathname]);

  return null;
}
