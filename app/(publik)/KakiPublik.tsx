import Image from "next/image";
import Link from "next/link";
import { JAM_LAYANAN } from "@/lib/jamLayanan";
import { StatusLayanan } from "./JamLayanan";

const HALAMAN = [
  { href: "/kgb#beranda", label: "Cek status" },
  { href: "/kgb#alur", label: "Alur pengajuan" },
  { href: "/kgb#jadwal", label: "Jadwal pengusulan" },
  { href: "/kgb#status", label: "Arti status" },
  { href: "/tabel-gaji", label: "Tabel gaji PNS" },
  { href: "/panduan", label: "Panduan KGB" },
];

const LAYANAN_TERKAIT = [
  { href: "https://paskalsel.online", label: "Portal SDM Pas Kalsel" },
  { href: "https://myasn.bkn.go.id", label: "MyASN BKN" },
];

export default function KakiPublik() {
  return (
    <footer className="kk">
      <div className="pub-container">
        <div className="kk-kartu">
          <div className="kk-atas">
            <div className="kk-merek">
              <div className="kk-merek-baris">
                <Image src="/icons.svg" alt="" width={34} height={27} loading="eager" />
                <span className="kk-merek-nama">SIM-KGB</span>
              </div>
              <p className="kk-teks">
                Sistem Informasi Manajemen Kenaikan Gaji Berkala, Kantor Wilayah Direktorat Jenderal Pemasyarakatan
                Kalimantan Selatan. Dikelola Tim SDM Kanwil.
              </p>
              <StatusLayanan />
            </div>

            <nav aria-label="Peta halaman" className="kk-kolom">
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

            <div className="kk-kolom">
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

              <h2 className="kk-label kk-label-lanjut">Layanan terkait</h2>
              <ul className="kk-daftar">
                {LAYANAN_TERKAIT.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="kk-tautan" target="_blank" rel="noopener noreferrer">
                      {l.label}
                      <span className="kk-luar" aria-hidden="true">
                        ↗
                      </span>
                      <span className="pub-visually-hidden"> (membuka tab baru)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="kk-bawah">
            <span>Kementerian Imigrasi dan Pemasyarakatan Republik Indonesia</span>
            <Link href="/login" className="kk-tautan">
              Masuk untuk petugas
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
