"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cariPeran, daftarUntuk, PERAN, pilihanSah, SEMUA, type BagianPanduan } from "./peran";

/* Navigasi panduan dashboard. Bagian yang tampil mengikuti peran akun yang masuk (dipilih server, jadi tidak
   ada kedipan); pembaca boleh beralih ke peran lain atau membaca seluruhnya. Pilihan dipasang pada atribut
   data-peran pembungkus .pg-dasbor, dan panduan.css menyembunyikan bagian yang tidak relevan. Daftar isi
   mengikuti posisi baca di area gulir dashboard (<main>). */

interface KeadaanPanduan {
  pilihan: string;
  pilih: (nilai: string, gulir?: boolean) => void;
}

const KonteksPanduan = createContext<KeadaanPanduan>({ pilihan: SEMUA, pilih: () => {} });

const kurangiGerak = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function gulirKe(id: string) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: kurangiGerak() ? "auto" : "smooth", block: "start" });
  });
}

/** Pembungkus panduan: memegang peran yang sedang dibaca. `bawaan` berasal dari role akun. */
export function PanduanPeran({ bawaan, children }: { bawaan: string; children: React.ReactNode }) {
  const [pilihan, setPilihan] = useState(bawaan);

  const pilih = useCallback((nilai: string, gulir = true) => {
    setPilihan(nilai);
    const url = new URL(window.location.href);
    url.searchParams.set("peran", nilai);
    url.hash = "";
    window.history.replaceState(null, "", url);
    if (gulir) gulirKe("panduan-isi");
  }, []);

  // ?peran= di URL didahulukan; tautan ke bagian yang tersembunyi bagi peran ini membuka seluruh panduan.
  useLayoutEffect(() => {
    const dariUrl = new URL(window.location.href).searchParams.get("peran");
    const tujuan = window.location.hash.slice(1);
    const bagian = tujuan ? document.getElementById(tujuan)?.closest<HTMLElement>(".pg-bagian") : null;
    let awal = pilihanSah(dariUrl) ? dariUrl : bawaan;
    if (bagian && awal !== SEMUA && !(bagian.dataset.peran ?? "").split(" ").includes(awal)) awal = SEMUA;
    // Sinkron dengan URL sekali saat dibuka; sesudahnya pilihan hanya berubah lewat pilih().
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (awal !== bawaan) setPilihan(awal);
    if (tujuan) gulirKe(tujuan);
  }, [bawaan]);

  useEffect(() => {
    const saatKlik = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('.pg-isi a[href^="#"]');
      if (!a) return;
      const tujuan = document.getElementById(a.hash.slice(1));
      if (!tujuan || tujuan.offsetParent !== null) return;
      e.preventDefault();
      setPilihan(SEMUA);
      window.history.replaceState(null, "", `${window.location.pathname}?peran=${SEMUA}${a.hash}`);
      gulirKe(tujuan.id);
    };
    document.addEventListener("click", saatKlik);
    return () => document.removeEventListener("click", saatKlik);
  }, []);

  return (
    <KonteksPanduan.Provider value={{ pilihan, pilih }}>
      <div className="pub pg-dasbor" data-peran={pilihan}>
        {children}
      </div>
    </KonteksPanduan.Provider>
  );
}

/** Pilihan peran yang ringkas di atas isi panduan. */
export function PilihPeran({ milik }: { milik: string | null }) {
  const { pilihan, pilih } = useContext(KonteksPanduan);
  const aktif = cariPeran(pilihan);
  const jumlah = daftarUntuk(pilihan).length;

  return (
    <div className="pg-peran" id="pilih-peran">
      <p className="pg-peran-ket">
        {aktif ? (
          <>
            Panduan untuk <b>{aktif.label}</b>
            {milik === aktif.id ? " (peran Anda)" : ""}. {aktif.ringkas}
          </>
        ) : (
          <>
            <b>Seluruh panduan</b>, untuk semua peran.
          </>
        )}{" "}
        <span className="pg-peran-jumlah">{jumlah} bagian</span>
      </p>
      <div className="pg-peran-pilihan" role="group" aria-label="Baca panduan untuk peran">
        {PERAN.map((p) => (
          <button key={p.id} type="button" aria-pressed={pilihan === p.id} onClick={() => pilih(p.id)}>
            {p.label}
            {milik === p.id && <span className="pg-peran-milik" aria-label="peran Anda" />}
          </button>
        ))}
        <button type="button" aria-pressed={pilihan === SEMUA} onClick={() => pilih(SEMUA)}>
          Semua
        </button>
      </div>
    </div>
  );
}

/** Tautan ke bagian berikutnya untuk peran yang dipilih; di bagian terakhir, ajakan memilih peran lain. */
export function LanjutBagian({ dari }: { dari: string }) {
  const { pilihan } = useContext(KonteksPanduan);
  const daftar = daftarUntuk(pilihan);
  const i = daftar.findIndex((b) => b.id === dari);
  if (i < 0) return null;
  const berikut = daftar[i + 1];

  if (!berikut) {
    return (
      <div className="pg-lanjut pg-lanjut-selesai">
        <p>
          <b>Selesai.</b> {cariPeran(pilihan) ? "Itu seluruh bagian untuk peran ini." : "Itu seluruh isi panduan."}
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
  const { pilihan } = useContext(KonteksPanduan);
  const daftar = daftarUntuk(pilihan);
  const [aktif, setAktif] = useState<string>(daftar[0]?.id ?? "");
  const [bilahBuka, setBilahBuka] = useState(false);
  const daftarRef = useRef<HTMLOListElement>(null);
  const tandaRef = useRef<HTMLSpanElement>(null);
  const kunci = daftar.map((b) => b.id).join(",");

  // Bagian aktif: judul bagian terakhir yang sudah melewati pita atas layar. Area gulir dashboard adalah
  // <main>, bukan window, jadi gulir didengar pada fase tangkap di dokumen.
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
    document.addEventListener("scroll", saatGulir, { passive: true, capture: true });
    window.addEventListener("resize", saatGulir);
    return () => {
      cancelAnimationFrame(bingkai);
      document.removeEventListener("scroll", saatGulir, { capture: true });
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
