"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// three.js hanya dimuat di peramban, setelah halaman selesai dilukis.
const LogoPartikel = dynamic(() => import("./LogoPartikel"), { ssr: false });

export default function KanvasLogo() {
  const ref = useRef<HTMLDivElement>(null);
  const [muat, setMuat] = useState(false);

  useEffect(() => {
    // Hemat kuota: pengguna yang meminta penghematan data cukup melihat gambar lambang.
    const koneksi = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (koneksi?.saveData) return;
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setMuat(true), { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(() => setMuat(true), 300);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="pb-kanvas" aria-hidden="true" ref={ref}>
      {muat && (
        <LogoPartikel jangkar=".pb-logo" onSiap={() => ref.current?.closest(".pb")?.setAttribute("data-logo", "1")} />
      )}
    </div>
  );
}
