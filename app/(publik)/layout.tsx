import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import NavPublik from "./NavPublik";
import KakiPublik from "./KakiPublik";
import DokPublik from "./DokPublik";
import Muncul from "./Muncul";
import "./publik.css";
import "./kerangka.css";

// Huruf judul yang sama dengan portal SDM Pas Kalsel, hanya untuk halaman publik.
const hurufJudul = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["700", "800"],
  display: "swap",
});

/* Kerangka bersama halaman publik (/kgb, /panduan, /login). Token dan kelas didokumentasikan di awal
   publik.css; nav, kaki, dan dok di kerangka.css. */
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
