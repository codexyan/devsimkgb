import type { ReactNode } from "react";
import { Newsreader } from "next/font/google";
import NavPublik from "./NavPublik";
import KakiPublik from "./KakiPublik";
import DokPublik from "./DokPublik";
import Muncul from "./Muncul";
import "./publik.css";
import "./kerangka.css";

// Serif untuk judul: suara dokumen dinas (surat, SK) yang menjadi inti layanan KGB. Teks isi tetap Inter,
// huruf yang sama dengan dashboard SIM-KGB.
const hurufJudul = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

/* Kerangka bersama halaman publik (/kgb, /tabel-gaji, /panduan, /login). Token dan kelas didokumentasikan
   di awal publik.css; nav, kaki, dan dok di kerangka.css. */
export default function LayoutPublik({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className={`pub ${hurufJudul.variable}`}>
      <span id="puncak" aria-hidden="true" className="pub-puncak" />
      <a href="#konten" className="pub-skip">
        Lewati ke konten
      </a>
      <NavPublik />
      <main id="konten" className="pub-main" tabIndex={-1}>
        {children}
      </main>
      <KakiPublik />
      <DokPublik />
      <Muncul />
    </div>
  );
}
