import type { ReactNode } from "react";
import Link from "next/link";
import HeaderPublik from "./HeaderPublik";
import "./publik.css";

/* Kerangka bersama halaman publik (/kgb, /panduan, /login). Kelas dan token
   warna didokumentasikan di awal publik.css. */
export default function LayoutPublik({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="pub">
      <a href="#konten" className="pub-skip">
        Lewati ke konten
      </a>
      <HeaderPublik />
      <main id="konten" className="pub-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="pub-footer">
        <div className="pub-container pub-footer-row">
          <div className="pub-footer-org">
            <p className="pub-footer-name">Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan</p>
            <p>Kementerian Imigrasi dan Pemasyarakatan Republik Indonesia</p>
          </div>
          <nav className="pub-footer-nav" aria-label="Tautan halaman">
            <ul>
              <li>
                <Link href="/kgb">Cek status</Link>
              </li>
              <li>
                <Link href="/panduan">Panduan</Link>
              </li>
              <li>
                <Link href="/login">Masuk</Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
