import Image from "next/image";
import Link from "next/link";
import { JAM_LAYANAN } from "@/lib/jamLayanan";
import { StatusLayanan } from "./JamLayanan";

const HALAMAN = [
  { href: "/kgb#beranda", label: "Cek status" },
  { href: "/kgb#alur", label: "Alur pengajuan" },
  { href: "/kgb#jadwal", label: "Jadwal pengusulan" },
  { href: "/kgb#status", label: "Arti status" },
  { href: "/panduan", label: "Panduan KGB" },
  { href: "/login", label: "Masuk" },
];

export default function KakiPublik() {
  return (
    <footer className="kk">
      <div className="kk-atas">
        <div className="kk-merek">
          <div className="kk-merek-baris">
            <Image src="/icons.svg" alt="" width={40} height={32} loading="eager" />
            <span>
              <span className="kk-merek-nama">SIM-KGB</span>
              <span className="kk-merek-sub">Sistem Informasi Manajemen Kenaikan Gaji Berkala</span>
            </span>
          </div>
          <p className="kk-teks">
            Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan. Dikelola Tim SDM Kanwil.
          </p>
          <StatusLayanan />
        </div>

        <nav aria-label="Peta halaman">
          <h2 className="kk-label">Halaman</h2>
          <ul className="kk-daftar">
            {HALAMAN.map((h) => (
              <li key={h.href}>
                <Link href={h.href} className="kk-tautan">
                  {h.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="kk-label">Jam layanan</h2>
          <dl className="kk-jam">
            {JAM_LAYANAN.map((b) => (
              <div key={b.hari}>
                <dt>{b.hari}</dt>
                <dd>{b.jam}</dd>
              </div>
            ))}
          </dl>
          <p className="kk-catatan">Waktu Indonesia Tengah (WITA).</p>
        </div>
      </div>

      <div className="kk-bawah">
        <span>Kementerian Imigrasi dan Pemasyarakatan Republik Indonesia</span>
        <a href="https://paskalsel.online" className="kk-tautan" target="_blank" rel="noopener noreferrer">
          Portal SDM Pas Kalsel<span className="pub-visually-hidden"> (membuka tab baru)</span>
        </a>
      </div>
    </footer>
  );
}
