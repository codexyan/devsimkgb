"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const KUNCI_TEMA = "kgb-theme";

const TAUTAN = [
  { href: "/kgb", label: "Cek status" },
  { href: "/panduan", label: "Panduan" },
  { href: "/login", label: "Masuk" },
] as const;

type Tema = "light" | "dark";

/* Sama dengan script bootstrap di app/layout.tsx: tema tersimpan, atau
   preferensi sistem bila belum pernah dipilih. */
function temaTersimpan(): Tema {
  try {
    const t = localStorage.getItem(KUNCI_TEMA);
    if (t === "light" || t === "dark") return t;
  } catch {
    /* penyimpanan diblokir: ikuti preferensi sistem */
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function HeaderPublik() {
  const pathname = usePathname();
  const aktif = pathname === "/" ? "/kgb" : pathname;

  // Script bootstrap hanya berjalan saat muat penuh. Selaraskan ulang saat
  // header dipasang (misalnya datang dari dashboard lewat navigasi
  // client-side) dan saat tab lain atau preferensi sistem mengganti tema.
  useEffect(() => {
    const terapkan = () => document.documentElement.setAttribute("data-pub-theme", temaTersimpan());
    terapkan();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    window.addEventListener("storage", terapkan);
    mq.addEventListener("change", terapkan);
    return () => {
      window.removeEventListener("storage", terapkan);
      mq.removeEventListener("change", terapkan);
    };
  }, []);

  function gantiTema() {
    const html = document.documentElement;
    const baru: Tema = html.getAttribute("data-pub-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-pub-theme", baru);
    try {
      localStorage.setItem(KUNCI_TEMA, baru);
    } catch {
      /* penyimpanan diblokir: tema berlaku sampai halaman dimuat ulang */
    }
  }

  return (
    <header className="pub-header">
      <div className="pub-container pub-header-row">
        <Link href="/kgb" className="pub-brand">
          <Image src="/icons.svg" alt="" width={30} height={24} />
          <span className="pub-brand-text">
            <span className="pub-brand-name">SIM-KGB</span>{" "}
            <span className="pub-brand-sub">Kanwil Ditjenpas Kalimantan Selatan</span>
          </span>
        </Link>

        <nav className="pub-nav" aria-label="Utama">
          <ul>
            {TAUTAN.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={aktif === t.href || aktif.startsWith(`${t.href}/`) ? "page" : undefined}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="pub-theme-btn"
          onClick={gantiTema}
          aria-label="Ganti tema terang atau gelap"
          title="Ganti tema terang atau gelap"
        >
          <svg className="pub-theme-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M20.6 14.2A8.6 8.6 0 0 1 9.8 3.4a8.6 8.6 0 1 0 10.8 10.8z" />
          </svg>
          <svg className="pub-theme-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="4.4" />
            <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
          </svg>
        </button>
      </div>
    </header>
  );
}
