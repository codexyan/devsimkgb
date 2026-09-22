import type { Metadata } from "next";
import Link from "next/link";
import { tanggaGaji } from "@/lib/tabelGaji";
import Kata from "../Kata";
import LatarNavy from "@/app/_bersama/LatarNavy";
import TabelGaji from "./TabelGaji";
import "./tabel-gaji.css";

export const metadata: Metadata = {
  title: "Tabel Gaji Pokok PNS",
  description:
    "Daftar gaji pokok Pegawai Negeri Sipil menurut golongan ruang dan masa kerja golongan, sesuai Lampiran Peraturan Pemerintah Nomor 5 Tahun 2024.",
};

export default function HalamanTabelGaji() {
  return (
    <>
      <section className="pub-navy pub-hero tb-hero" aria-labelledby="tb-judul">
        <LatarNavy />
        <div className="pub-container">
          <header className="tb-kepala">
            <p className="pub-eyebrow tb-atas masuk">Lampiran PP Nomor 5 Tahun 2024</p>
            <h1 id="tb-judul" className="pub-h1 tb-judul">
              <Kata teks="Daftar gaji pokok PNS" />
            </h1>
            <div className="tb-pengantar masuk" style={{ "--d": 180 } as React.CSSProperties}>
              <p className="pub-lead">
                Gaji pokok menurut golongan ruang dan masa kerja golongan (MKG), berlaku sejak 1 Januari 2024. Kenaikan
                gaji berkala memindahkan gaji pokok ke anak tangga berikutnya pada kolom yang sama.
              </p>
              <p className="pub-meta">
                Angka di halaman ini adalah tabel yang dipakai SIM-KGB untuk menghitung KGB. Seluruh 272 selnya
                dicocokkan dengan salinan lampiran peraturan pada 18 September 2026.
              </p>
            </div>
          </header>
        </div>
      </section>

      <div className="pub-container tb">
        <div className="masuk" style={{ "--d": 260 } as React.CSSProperties}>
          <TabelGaji baris={tanggaGaji()} />
        </div>

        <section className="tb-catatan" aria-labelledby="tb-catatan-judul">
          <h2 id="tb-catatan-judul" className="tb-catatan-judul">
            Cara membaca
          </h2>
          <ul>
            <li>
              <h3>Sel kosong</h3>
              <p>
                Masa kerja yang tidak tercantum memakai gaji pokok pada MKG terbesar sebelumnya dalam kolom yang sama.
              </p>
            </li>
            <li>
              <h3>Ritme tiap golongan</h3>
              <p>
                Golongan I/a naik pada MKG genap, I/b sampai I/d pada MKG ganjil. II/a naik pada MKG 1, lalu setiap MKG
                ganjil. Golongan III dan IV naik pada MKG genap.
              </p>
            </li>
            <li>
              <h3>Dasar hukum</h3>
              <p>
                <a href="https://peraturan.bpk.go.id/Details/276755/pp-no-5-tahun-2024">
                  Peraturan Pemerintah Nomor 5 Tahun 2024
                </a>
                . Jadwal dan cara pengusulan KGB ada di <Link href="/panduan#jadwal">panduan</Link>.
              </p>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
