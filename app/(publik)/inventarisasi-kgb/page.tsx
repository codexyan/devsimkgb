import type { Metadata } from "next";
import Kata from "../Kata";
import LatarNavy from "@/app/_bersama/LatarNavy";
import FormInventaris from "./FormInventaris";
import { bacaKonfigurasi } from "@/lib/inventarisServer";
import "./inventaris.css";

export const metadata: Metadata = {
  title: "Inventarisasi Data KGB Pegawai Kanwil",
  description: "Formulir pemutakhiran data kenaikan gaji berkala pegawai Kantor Wilayah Ditjenpas Kalimantan Selatan.",
};

// Buka-tutup formulir dan batas waktunya diatur Super Admin di dashboard, jadi dibaca saat permintaan.
export const dynamic = "force-dynamic";

/* Formulir inventarisasi data KGB pegawai Kanwil (lib/inventarisKgb.ts). Kiriman tersimpan di SIM-KGB
   (lib/inventarisServer.ts) dan diunduh Tim SDM sebagai ZIP berstruktur folder dari menu Inventarisasi di
   dashboard. Halaman ini tidak ada di menu publik; tautannya dibagikan lewat grup WA pegawai Kanwil. */
export default async function HalamanInventarisasi() {
  const { terbuka, kode, batas } = await bacaKonfigurasi();
  return (
    <>
      <section className="pub-navy pub-hero iv-hero" aria-labelledby="iv-judul">
        <LatarNavy />
        <div className="pub-container">
          <header className="iv-kepala">
            <p className="pub-eyebrow masuk">Khusus pegawai Kanwil Ditjenpas Kalimantan Selatan</p>
            <h1 id="iv-judul" className="pub-h1 iv-judul">
              <Kata teks="Inventarisasi data KGB" />
            </h1>
            <div className="iv-pengantar masuk" style={{ "--d": 180 } as React.CSSProperties}>
              <p className="pub-lead">
                Data ini dipakai Tim SDM untuk memperbarui data kenaikan gaji berkala Anda di SIM-KGB. Siapkan SK
                terakhir dalam bentuk PDF sebelum mengisi.
              </p>
              {batas && <p className="iv-batas">Batas pengisian: {batas}</p>}
            </div>
          </header>
        </div>
      </section>

      <div className="pub-container iv">
        {terbuka && kode ? (
          <FormInventaris />
        ) : (
          <div className="iv-tutup" role="status">
            <h2>Formulir belum dibuka</h2>
            <p>Tunggu pengumuman dari Tim SDM Kanwil di grup WA pegawai.</p>
          </div>
        )}
      </div>
    </>
  );
}
