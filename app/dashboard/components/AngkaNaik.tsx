"use client";

import { useEffect, useRef, useState } from "react";
import { kurangiGerak } from "@/lib/ui/gerak";

/**
 * Angka yang menghitung naik (atau turun) ke nilainya, dengan perlambatan di ujung. Bila gerak dikurangi (pilihan
 * Animasi atau pengaturan perangkat, lib/ui/gerak.ts), nilainya langsung tampil.
 */
export default function AngkaNaik({ nilai, durasi = 700 }: { nilai: number; durasi?: number }) {
  const [tampil, setTampil] = useState(0);
  // Angka yang sedang tampil, sebagai titik awal hitungan berikutnya; juga bila hitungan sebelumnya terputus.
  const sekarang = useRef(0);

  useEffect(() => {
    const dari = sekarang.current;
    let id = 0;
    if (dari === nilai) return;
    if (kurangiGerak()) {
      id = requestAnimationFrame(() => {
        sekarang.current = nilai;
        setTampil(nilai);
      });
      return () => cancelAnimationFrame(id);
    }
    const mulai = performance.now();
    const langkah = (t: number) => {
      const k = Math.min(1, (t - mulai) / durasi);
      const v = Math.round(dari + (nilai - dari) * (1 - Math.pow(1 - k, 3)));
      sekarang.current = v;
      setTampil(v);
      if (k < 1) id = requestAnimationFrame(langkah);
    };
    id = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(id);
  }, [nilai, durasi]);

  return <>{tampil}</>;
}
