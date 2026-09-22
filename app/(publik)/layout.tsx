import type { ReactNode } from "react";
import { Inter_Tight } from "next/font/google";
import NavPublik from "./NavPublik";
import KakiPublik from "./KakiPublik";
import DokPublik from "./DokPublik";
import Muncul from "./Muncul";
import "./publik.css";
import "./kerangka.css";

// Judul memakai sans rapat berbobot ringan: tenang dan jelas, sepasang dengan Inter (teks isi dan dashboard).
const hurufJudul = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-judul",
  weight: ["300", "400", "500", "600"],
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
