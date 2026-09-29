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
  { href: "/tabel-gaji", label: "Tabel gaji" },
  { href: "/panduan", label: "Panduan" },
];

const BAGIAN_BERANDA = ["beranda", "alur", "jadwal", "status", "bantuan"];

/* Nav publik. Di puncak halaman bilahnya menyatu dengan latar; setelah digulir ia menjadi bilah melayang
   dengan penanda emas di bawah tautan yang aktif dan garis kemajuan baca. Di layar sempit tautan pindah
   ke lembar menu yang turun dari bilah. */
export default function NavPublik() {
  const pathname = usePathname();
  const diBeranda = pathname === "/" || pathname === "/kgb";

  const [padat, setPadat] = useState(false);
  const [bagianAktif, setBagianAktif] = useState("beranda");
  const [menuBuka, setMenuBuka] = useState(false);

  const barisRef = useRef<HTMLDivElement>(null);
  const tandaRef = useRef<HTMLSpanElement>(null);
  const tombolMenuRef = useRef<HTMLButtonElement>(null);

  const hrefAktif = diBeranda
    ? TAUTAN.find((t) => t.bagian === bagianAktif)?.href
    : TAUTAN.find((t) => !t.bagian && (pathname === t.href || pathname.startsWith(`${t.href}/`)))?.href;

  // Bilah menjadi padat setelah halaman mulai digulir.
  useEffect(() => {
    let bingkai = 0;
    const periksa = () => {
      bingkai = 0;
      setPadat(window.scrollY > 16);
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

  // Penanda emas bergeser ke tautan yang aktif.
  const posisikanTanda = useCallback(() => {
    const baris = barisRef.current;
    const tanda = tandaRef.current;
    if (!baris || !tanda) return;
    const aktif = baris.querySelector<HTMLElement>('a[aria-current="page"], a[aria-current="location"]');
    if (!aktif) {
      tanda.style.setProperty("--tampil", "0");
      return;
    }
    tanda.style.setProperty("--x", `${aktif.offsetLeft + 12}px`);
    tanda.style.setProperty("--w", `${Math.max(0, aktif.offsetWidth - 24)}`);
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

  /* Lembar menu mengikuti pola disclosure: fokus tetap di tombol yang membukanya, dan lembar berada tepat
     sesudahnya dalam urutan DOM sehingga Tab langsung masuk ke daftar tautan. Selama terbuka halaman di
     belakang tidak bergulir dan Escape menutup lembar. */
  useEffect(() => {
    if (!menuBuka) return;
    const html = document.documentElement;
    const overflowSebelumnya = html.style.overflow;
    html.style.overflow = "hidden";
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
      html.style.overflow = overflowSebelumnya;
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
    <header className="nv" data-padat={padat || menuBuka ? "1" : "0"} data-menu={menuBuka ? "1" : "0"}>
      <div className="nv-bingkai">
        <div className="nv-dalam">
          <Link href="/kgb#beranda" className="nv-merek" onClick={() => setBagianAktif("beranda")}>
            <Image src="/icons.svg" alt="" width={30} height={24} loading="eager" />
            <span className="nv-merek-teks">
              <span className="nv-merek-nama">SIM-KGB</span>
              <span className="nv-merek-sub">Kanwil Ditjenpas Kalimantan Selatan</span>
            </span>
          </Link>

          <nav aria-label="Utama" className="nv-utama">
            <div className="nv-baris" ref={barisRef}>
              {TAUTAN.map((t) => (
                <Link key={t.href} href={t.href} className="nv-tautan" aria-current={ariaCurrent(t)} onClick={() => tandaiAktif(t)}>
                  {t.label}
                </Link>
              ))}
              <span className="nv-tanda" ref={tandaRef} aria-hidden="true" />
            </div>
          </nav>

          <Link href="/login" className="nv-masuk" aria-current={masukAktif ? "page" : undefined}>
            Masuk
          </Link>

          <button
            ref={tombolMenuRef}
            type="button"
            className="nv-menu-tombol"
            aria-expanded={menuBuka}
            aria-controls="nv-lembar"
            onClick={() => setMenuBuka((v) => !v)}
          >
            <span className="nv-menu-garis" aria-hidden="true">
              <span />
              <span />
            </span>
            {menuBuka ? "Tutup" : "Menu"}
          </button>
        </div>
        <span className="nv-prog" aria-hidden="true" />
      </div>

      <button type="button" className="nv-tirai" aria-hidden="true" tabIndex={-1} onClick={tutupMenu} />
      <div className="nv-lembar" id="nv-lembar" inert={!menuBuka}>
        <nav aria-label="Menu">
          <ol className="nv-lembar-daftar">
            {TAUTAN.map((t, i) => (
              <li key={t.href} style={{ "--i": i } as React.CSSProperties}>
                <Link
                  href={t.href}
                  className="nv-lembar-item"
                  aria-current={ariaCurrent(t)}
                  onClick={() => {
                    tandaiAktif(t);
                    tutupMenu();
                  }}
                >
                  <span className="nv-lembar-nomor" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {t.label}
                </Link>
              </li>
            ))}
          </ol>
          <Link
            href="/login"
            className="nv-lembar-masuk"
            style={{ "--i": TAUTAN.length } as React.CSSProperties}
            aria-current={masukAktif ? "page" : undefined}
            onClick={tutupMenu}
          >
            Masuk ke SIM-KGB
          </Link>
        </nav>
      </div>
    </header>
  );
}
