"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { cariPeran, daftarUntuk, PERAN, pilihanSah, SEMUA, type BagianPanduan } from "./peran";

/* Navigasi panduan berperan. Pembaca memilih peran lebih dulu; bagian yang relevan lalu tampil, daftar isi
   tersaring, dan tiap bagian ditutup tautan ke bagian berikutnya.

   Pilihan disimpan di <html data-peran> (dan ?peran= di URL). Skrip awal di halaman memasangnya sebelum isi
   tergambar, sehingga CSS (panduan.css) menyembunyikan bagian yang tidak relevan tanpa kedipan. Tanpa
   JavaScript atribut itu tidak pernah terpasang dan seluruh panduan tampil seperti dokumen biasa. */

const pendengar = new Set<() => void>();

function bacaPilihan(): string | null {
  return document.documentElement.dataset.peran ?? null;
}

function usePilihan() {
  return useSyncExternalStore(
    (cb) => {
      pendengar.add(cb);
      return () => pendengar.delete(cb);
    },
    bacaPilihan,
    () => null,
  );
}

const kurangiGerak = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function gulirKe(id: string) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: kurangiGerak() ? "auto" : "smooth", block: "start" });
  });
}

function pilih(nilai: string) {
  document.documentElement.dataset.peran = nilai;
  const url = new URL(window.location.href);
  url.searchParams.set("peran", nilai);
  url.hash = "";
  window.history.replaceState(null, "", url);
  pendengar.forEach((f) => f());
  gulirKe("panduan-isi");
}

const IKON: Record<string, React.ReactNode> = {
  upt: <path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5M9 11h.01M15 11h.01" />,
  tu: <path d="M4 4h16v13H4zM4 13h4l2 3h4l2-3h4M9 8h6" />,
  sdm: <path d="M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  keuangan: <path d="M3 7h18v12H3zM3 11h18M7 15h3M16 3l-4 4-4-4" />,
  super: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4" />,
  pegawai: <path d="M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
};

/** Kartu peran di kepala halaman. */
export function PilihPeran() {
  const pilihan = usePilihan();

  // Skrip awal di halaman hanya berjalan pada muat penuh. Setelah navigasi dari halaman lain, keadaan yang
  // sama dipasang di sini sebelum tergambar (layout effect), lalu dilepas saat meninggalkan panduan.
  useLayoutEffect(() => {
    const html = document.documentElement;
    html.dataset.panduan = "siap";
    const dariUrl = new URL(window.location.href).searchParams.get("peran");
    const tujuan = window.location.hash.slice(1);
    if (pilihanSah(dariUrl)) html.dataset.peran = dariUrl;
    else if (tujuan && document.getElementById(tujuan)) html.dataset.peran = SEMUA;
    pendengar.forEach((f) => f());
    return () => {
      delete html.dataset.panduan;
    };
  }, []);

  // Tautan di dalam panduan yang menuju bagian tersembunyi untuk peran ini membuka seluruh panduan dulu.
  useEffect(() => {
    const saatKlik = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('.pg-isi a[href^="#"]');
      if (!a) return;
      const tujuan = document.getElementById(a.hash.slice(1));
      if (!tujuan || tujuan.offsetParent !== null) return;
      e.preventDefault();
      document.documentElement.dataset.peran = SEMUA;
      pendengar.forEach((f) => f());
      window.history.replaceState(null, "", `${window.location.pathname}?peran=${SEMUA}${a.hash}`);
      gulirKe(tujuan.id);
    };
    document.addEventListener("click", saatKlik);
    return () => document.removeEventListener("click", saatKlik);
  }, []);

  return (
    <div className="pg-pilih" id="pilih-peran">
      <ul className="pg-pilih-daftar">
        {PERAN.map((p, i) => (
          <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
            <button
              type="button"
              className="pg-pilih-kartu"
              aria-pressed={pilihan === p.id}
              onClick={() => pilih(p.id)}
            >
              <span className="pg-pilih-ikon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {IKON[p.id]}
                </svg>
              </span>
              <span className="pg-pilih-label">{p.label}</span>
              <span className="pg-pilih-ringkas">{p.ringkas}</span>
              <span className="pg-pilih-meta">
                {p.bagian.length} bagian
                <svg className="pg-pilih-panah" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" />
                </svg>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="pg-pilih-semua">
        Ingin membaca semuanya?{" "}
        <button type="button" aria-pressed={pilihan === SEMUA} onClick={() => pilih(SEMUA)}>
          Baca seluruh panduan
        </button>
      </p>
    </div>
  );
}

/** Keterangan peran yang sedang dibaca, di atas isi panduan. */
export function PeranAktif() {
  const pilihan = usePilihan();
  if (!pilihan) return null;
  const peran = cariPeran(pilihan);
  const jumlah = daftarUntuk(pilihan).length;

  return (
    <div className="pg-aktif">
      <span className="pg-aktif-ikon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          {peran ? IKON[peran.id] : <path d="M4 5h16M4 12h16M4 19h10" />}
        </svg>
      </span>
      <p className="pg-aktif-teks">
        <span>{peran ? "Panduan untuk" : "Panduan lengkap"}</span>
        <b>{peran ? peran.label : "Seluruh bagian"}</b>
      </p>
      <span className="pg-aktif-jumlah">{jumlah} bagian</span>
      <button type="button" className="pg-aktif-ganti" onClick={() => gulirKe("pilih-peran")}>
        Ganti peran
      </button>
    </div>
  );
}

/** Tautan ke bagian berikutnya untuk peran yang dipilih; di bagian terakhir, ajakan memilih peran lain. */
export function LanjutBagian({ dari }: { dari: string }) {
  const pilihan = usePilihan();
  const daftar = daftarUntuk(pilihan);
  const i = daftar.findIndex((b) => b.id === dari);
  if (i < 0) return null;
  const berikut = daftar[i + 1];

  if (!berikut) {
    return (
      <div className="pg-lanjut pg-lanjut-selesai">
        <p>
          <b>Selesai.</b> {pilihan ? "Itu seluruh bagian untuk peran ini." : "Itu seluruh isi panduan."}
        </p>
        <button type="button" onClick={() => gulirKe("pilih-peran")}>
          Pilih peran lain
        </button>
      </div>
    );
  }

  return (
    <a
      href={`#${berikut.id}`}
      className="pg-lanjut"
      onClick={(e) => {
        e.preventDefault();
        gulirKe(berikut.id);
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${berikut.id}`);
      }}
    >
      <span className="pg-lanjut-label">
        Berikutnya · {String(i + 2).padStart(2, "0")}
      </span>
      <span className="pg-lanjut-judul">{berikut.judul}</span>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    </a>
  );
}

/** Daftar isi yang mengikuti posisi baca, tersaring menurut peran (rel di layar lebar, bilah di ponsel). */
export function DaftarIsiPanduan() {
  const id = useId();
  const pilihan = usePilihan();
  const daftar = daftarUntuk(pilihan);
  const [aktif, setAktif] = useState<string>(daftar[0]?.id ?? "");
  const [bilahBuka, setBilahBuka] = useState(false);
  const daftarRef = useRef<HTMLOListElement>(null);
  const tandaRef = useRef<HTMLSpanElement>(null);
  const kunci = daftar.map((b) => b.id).join(",");

  // Bagian aktif: judul bagian terakhir yang sudah melewati pita atas layar.
  useEffect(() => {
    const judul = kunci
      .split(",")
      .map((b) => document.getElementById(b))
      .filter((el): el is HTMLElement => !!el);
    if (judul.length === 0) return;
    let bingkai = 0;
    const periksa = () => {
      bingkai = 0;
      const batas = window.innerHeight * 0.3;
      let terakhir = judul[0].id;
      for (const el of judul) {
        if (el.getBoundingClientRect().top <= batas) terakhir = el.id;
      }
      setAktif(terakhir);
    };
    const saatGulir = () => {
      if (!bingkai) bingkai = requestAnimationFrame(periksa);
    };
    periksa();
    window.addEventListener("scroll", saatGulir, { passive: true });
    window.addEventListener("resize", saatGulir);
    return () => {
      cancelAnimationFrame(bingkai);
      window.removeEventListener("scroll", saatGulir);
      window.removeEventListener("resize", saatGulir);
    };
  }, [kunci]);

  // Penanda tinta bergeser ke butir aktif di rel daftar isi.
  const letakkanTanda = useCallback(() => {
    const li = daftarRef.current?.querySelector<HTMLElement>(`[data-bagian="${aktif}"]`);
    const tanda = tandaRef.current;
    if (!li || !tanda) return;
    tanda.style.setProperty("--y", `${li.offsetTop}px`);
    tanda.style.setProperty("--h", `${li.offsetHeight}`);
  }, [aktif]);

  useLayoutEffect(() => {
    letakkanTanda();
  }, [letakkanTanda, kunci]);

  useEffect(() => {
    const el = daftarRef.current;
    if (!el) return;
    const pengamat = new ResizeObserver(letakkanTanda);
    pengamat.observe(el);
    return () => pengamat.disconnect();
  }, [letakkanTanda]);

  const indeksAktif = Math.max(0, daftar.findIndex((b) => b.id === aktif));

  const butir = (b: BagianPanduan, i: number, tutup?: () => void) => (
    <li key={b.id} data-bagian={b.id} data-lewat={i < indeksAktif ? "1" : undefined}>
      <a href={`#${b.id}`} aria-current={b.id === aktif ? "location" : undefined} onClick={tutup}>
        <span className="pg-daftar-nomor" aria-hidden="true">
          {String(i + 1).padStart(2, "0")}
        </span>
        <span className="pg-daftar-teks">{b.judul}</span>
      </a>
    </li>
  );

  return (
    <>
      <nav className="pg-daftar" aria-label="Daftar isi">
        <p className="pg-daftar-judul">Daftar isi</p>
        <div className="pg-daftar-rel">
          <span className="pg-daftar-tanda" ref={tandaRef} aria-hidden="true" />
          <ol ref={daftarRef}>{daftar.map((b, i) => butir(b, i))}</ol>
        </div>
      </nav>

      <div className="pg-bilah" data-buka={bilahBuka ? "1" : "0"}>
        <button
          type="button"
          className="pg-bilah-tombol"
          aria-expanded={bilahBuka}
          aria-controls={`${id}-bilah`}
          onClick={() => setBilahBuka((v) => !v)}
        >
          <span className="pg-bilah-label">Daftar isi</span>
          <span className="pg-bilah-aktif">
            {String(indeksAktif + 1).padStart(2, "0")} {daftar[indeksAktif]?.judul}
          </span>
          <span className="pg-bilah-panah" aria-hidden="true" />
        </button>
        <span className="pg-bilah-kemajuan" aria-hidden="true" />
        <nav id={`${id}-bilah`} className="pg-bilah-daftar" aria-label="Daftar isi" inert={!bilahBuka}>
          <ol>{daftar.map((b, i) => butir(b, i, () => setBilahBuka(false)))}</ol>
        </nav>
      </div>
    </>
  );
}
