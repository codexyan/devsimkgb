"use client";

import { useEffect, useState } from "react";

/* Tombol kembali ke atas. Baru muncul setelah bagian atas halaman lewat, ditentukan lewat
   IntersectionObserver pada penanda #puncak di layout, bukan pendengar gulir. */
export default function DokPublik() {
  const [tampak, setTampak] = useState(false);

  useEffect(() => {
    const puncak = document.getElementById("puncak");
    if (!puncak) return;
    const pengamat = new IntersectionObserver(([e]) => setTampak(!e.isIntersecting), { threshold: 0 });
    pengamat.observe(puncak);
    return () => pengamat.disconnect();
  }, []);

  return (
    <button
      type="button"
      className="dk-atas"
      data-tampak={tampak ? "1" : "0"}
      aria-hidden={!tampak}
      tabIndex={tampak ? 0 : -1}
      aria-label="Kembali ke atas"
      onClick={() => {
        const kurangiGerak = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: kurangiGerak ? "auto" : "smooth" });
        document.getElementById("konten")?.focus({ preventScroll: true });
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M12 19V5" />
        <path d="M6 11l6-6 6 6" />
      </svg>
    </button>
  );
}
