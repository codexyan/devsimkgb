"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Tautan {
  href: string;
  label: string;
  /** Id bagian di beranda /kgb yang membuat tautan ini aktif saat digulir. */
  bagian?: string;
}

const TAUTAN: Tautan[] = [
  { href: "/kgb#beranda", label: "Cek status", bagian: "beranda" },
  { href: "/kgb#alur", label: "Alur", bagian: "alur" },
  { href: "/kgb#jadwal", label: "Jadwal", bagian: "jadwal" },
  { href: "/kgb#status", label: "Arti status", bagian: "status" },
  { href: "/panduan", label: "Panduan" },
];

const BAGIAN_BERANDA = TAUTAN.flatMap((t) => (t.bagian ? [t.bagian] : []));

const IkonMenu = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true" focusable="false">
    <path d="M4 8h16M4 16h16" />
  </svg>
);
const IkonTutup = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export default function NavPublik() {
  const pathname = usePathname();
  const diBeranda = pathname === "/" || pathname === "/kgb";

  const [padat, setPadat] = useState(false);
  const [bagianAktif, setBagianAktif] = useState("beranda");
  const [menuBuka, setMenuBuka] = useState(false);

  const barisRef = useRef<HTMLDivElement>(null);
  const tandaRef = useRef<HTMLSpanElement>(null);
  const tombolMenuRef = useRef<HTMLButtonElement>(null);
  const lembarRef = useRef<HTMLDivElement>(null);

  const hrefAktif = diBeranda
    ? TAUTAN.find((t) => t.bagian === bagianAktif)?.href
    : TAUTAN.find((t) => !t.bagian && (pathname === t.href || pathname.startsWith(`${t.href}/`)))?.href;

  // Bilah menjadi padat setelah halaman mulai digulir.
  useEffect(() => {
    let bingkai = 0;
    const periksa = () => {
      bingkai = 0;
      setPadat(window.scrollY > 12);
    };
    const saatGulir = () => {
      if (!bingkai) bingkai = requestAnimationFrame(periksa);
    };
    periksa();
    window.addEventListener("scroll", saatGulir, { passive: true });
    return () => {
      window.removeEventListener("scroll", saatGulir);
      cancelAnimationFrame(bingkai);
    };
  }, []);

  // Di beranda, tautan aktif mengikuti bagian yang sedang berada di tengah layar.
  useEffect(() => {
    if (!diBeranda) return;
    const elemen = BAGIAN_BERANDA.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (elemen.length === 0) return;
    const pengamat = new IntersectionObserver(
      (entri) => {
        const terlihat = entri.filter((e) => e.isIntersecting);
        if (terlihat.length > 0) setBagianAktif(terlihat[terlihat.length - 1].target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    elemen.forEach((el) => pengamat.observe(el));
    return () => pengamat.disconnect();
  }, [diBeranda, pathname]);

  // Penanda aktif bergeser ke tautan yang aktif.
  const posisikanTanda = useCallback(() => {
    const baris = barisRef.current;
    const tanda = tandaRef.current;
    if (!baris || !tanda) return;
    const aktif = baris.querySelector<HTMLElement>('a[aria-current="page"], a[aria-current="location"]');
    if (!aktif) {
      tanda.style.setProperty("--tampil", "0");
      return;
    }
    tanda.style.setProperty("--x", `${aktif.offsetLeft}px`);
    tanda.style.setProperty("--w", `${aktif.offsetWidth}px`);
    tanda.style.setProperty("--tampil", "1");
  }, []);

  useLayoutEffect(() => {
    posisikanTanda();
  }, [hrefAktif, posisikanTanda]);

  useEffect(() => {
    const baris = barisRef.current;
    if (!baris) return;
    const pengamat = new ResizeObserver(posisikanTanda);
    pengamat.observe(baris);
    return () => pengamat.disconnect();
  }, [posisikanTanda]);

  // Menu ponsel: Escape menutup dan fokus kembali ke tombol; fokus pertama masuk ke daftar.
  useEffect(() => {
    if (!menuBuka) return;
    lembarRef.current?.querySelector<HTMLElement>("a")?.focus();
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuBuka(false);
        tombolMenuRef.current?.focus();
      }
    };
    const saatLebar = () => {
      if (window.innerWidth > 960) setMenuBuka(false);
    };
    document.addEventListener("keydown", saatTombol);
    window.addEventListener("resize", saatLebar);
    return () => {
      document.removeEventListener("keydown", saatTombol);
      window.removeEventListener("resize", saatLebar);
    };
  }, [menuBuka]);

  const tutupMenu = () => setMenuBuka(false);
  const tandaiAktif = (t: Tautan) => {
    if (diBeranda && t.bagian) setBagianAktif(t.bagian);
  };

  const ariaCurrent = (t: Tautan) => (t.href !== hrefAktif ? undefined : t.bagian ? "location" : "page");
  const masukAktif = pathname === "/login";

  return (
    <header className="nv" data-padat={padat || menuBuka ? "1" : "0"}>
      <div className="nv-dalam">
        <Link href="/kgb#beranda" className="nv-merek" onClick={() => setBagianAktif("beranda")}>
          <span className="nv-merek-logo">
            <Image src="/icons.svg" alt="" width={36} height={29} loading="eager" />
          </span>
          <span className="nv-merek-teks">
            <span className="nv-merek-nama">SIM-KGB</span>
            <span className="nv-merek-sub">Kenaikan gaji berkala</span>
          </span>
        </Link>

        <nav aria-label="Utama" className="nv-utama">
          <div className="nv-baris" ref={barisRef}>
            <span className="nv-tanda" ref={tandaRef} aria-hidden="true" />
            {TAUTAN.map((t) => (
              <Link key={t.href} href={t.href} className="nv-tautan" aria-current={ariaCurrent(t)} onClick={() => tandaiAktif(t)}>
                {t.label}
              </Link>
            ))}
          </div>
        </nav>

        <span className="nv-instansi">Kanwil Ditjenpas Kalimantan Selatan</span>

        <Link href="/login" className="nv-masuk" aria-current={masukAktif ? "page" : undefined}>
          Masuk
        </Link>

        <button
          ref={tombolMenuRef}
          type="button"
          className="nv-menu-tombol"
          aria-expanded={menuBuka}
          aria-controls="nv-lembar"
          aria-label={menuBuka ? "Tutup menu" : "Buka menu"}
          onClick={() => setMenuBuka((v) => !v)}
        >
          <span className="nv-menu-ikon">{menuBuka ? IkonTutup : IkonMenu}</span>
        </button>
      </div>

      <span className="nv-prog" aria-hidden="true" />

      {menuBuka && (
        <>
          <button type="button" className="nv-tirai" aria-label="Tutup menu" tabIndex={-1} onClick={tutupMenu} />
          <div className="nv-lembar" id="nv-lembar" ref={lembarRef}>
            <nav aria-label="Menu">
              {TAUTAN.map((t, i) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="nv-lembar-item"
                  style={{ "--i": i } as React.CSSProperties}
                  aria-current={ariaCurrent(t)}
                  onClick={() => {
                    tandaiAktif(t);
                    tutupMenu();
                  }}
                >
                  {t.label}
                </Link>
              ))}
              <Link
                href="/login"
                className="nv-lembar-item nv-lembar-masuk"
                style={{ "--i": TAUTAN.length } as React.CSSProperties}
                aria-current={masukAktif ? "page" : undefined}
                onClick={tutupMenu}
              >
                Masuk ke SIM-KGB
              </Link>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
