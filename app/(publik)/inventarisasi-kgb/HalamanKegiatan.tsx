import { notFound } from "next/navigation";
import Kata from "../Kata";
import LatarNavy from "@/app/_bersama/LatarNavy";
import FormInventaris from "./FormInventaris";
import { bacaKegiatan } from "@/lib/inventarisServer";
import { keadaanFormulir, teksBatas } from "@/lib/inventarisKgb";
import { TEMPLATE_KEGIATAN, satkerPilihan } from "@/lib/kegiatanInventaris";
import "./inventaris.css";

/* Halaman formulir satu kegiatan pengumpulan data (ADR-022, lib/kegiatanInventaris.ts). Kiriman tersimpan di SIM-KGB
   (lib/inventarisServer.ts) dan diunduh Tim SDM sebagai ZIP berstruktur folder dari menu Inventarisasi di dashboard.
   Halaman ini tidak ada di menu publik; tautannya dibagikan lewat grup WA. */
export default async function HalamanKegiatan({ id }: { id: string }) {
  const kegiatan = await bacaKegiatan(id);
  if (!kegiatan) notFound();
  const keadaan = keadaanFormulir(kegiatan);
  const batas = teksBatas(kegiatan);
  const upt = TEMPLATE_KEGIATAN[kegiatan.template].pakaiSatker;
  return (
    <>
      <section className="pub-navy pub-hero iv-hero" aria-labelledby="iv-judul">
        <LatarNavy />
        <div className="pub-container">
          <header className="iv-kepala">
            <p className="pub-eyebrow masuk">
              {upt
                ? "Pegawai Unit Pelaksana Teknis Pemasyarakatan Kalimantan Selatan"
                : "Khusus pegawai Kanwil Ditjenpas Kalimantan Selatan"}
            </p>
            <h1 id="iv-judul" className="pub-h1 iv-judul">
              <Kata teks="Inventarisasi data KGB" />
            </h1>
            <div className="iv-pengantar masuk" style={{ "--d": 180 } as React.CSSProperties}>
              <p className="pub-lead">
                Data ini dipakai Tim SDM untuk memperbarui data kenaikan gaji berkala Anda di SIM-KGB. Siapkan SK
                terakhir dalam bentuk PDF sebelum mengisi.
              </p>
              {batas && keadaan === "dibuka" && <p className="iv-batas">Batas pengisian: {batas}</p>}
            </div>
          </header>
        </div>
      </section>

      <div className="pub-container iv">
        {keadaan === "dibuka" ? (
          <FormInventaris kegiatan={{ id: kegiatan.id, satker: satkerPilihan(kegiatan) }} />
        ) : keadaan === "lewat_batas" ? (
          <div className="iv-tutup" role="status">
            <h2>Formulir sudah ditutup</h2>
            <p>Batas pengisian {batas} sudah lewat. Bila data Anda belum terkirim, hubungi Tim SDM Kanwil.</p>
          </div>
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
