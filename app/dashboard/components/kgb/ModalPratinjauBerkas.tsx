"use client";

import KerangkaModal from "./KerangkaModal";

/* Pratinjau satu berkas PDF tanpa meninggalkan halaman.
   Berkasnya dilayani rute berkas dengan Content-Disposition inline, jadi cukup disematkan. Tautan
   "Buka di tab baru" tetap disediakan untuk peramban yang tidak menampilkan PDF di dalam bingkai,
   misalnya sebagian peramban ponsel. */

export default function ModalPratinjauBerkas({
  judul,
  subjudul,
  url,
  onTutup,
}: {
  judul: string;
  subjudul?: string;
  url: string;
  onTutup: () => void;
}) {
  return (
    <KerangkaModal
      judul={judul}
      subjudul={subjudul}
      ukuran="lg"
      onTutup={onTutup}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup}>
            Tutup
          </button>
          <a className="kgbm-tombol kgbm-utama" href={url} target="_blank" rel="noopener noreferrer">
            Buka di tab baru
          </a>
        </>
      }
    >
      <div className="kgbm-pratinjau-isi">
        <iframe src={url} title={judul} />
      </div>
    </KerangkaModal>
  );
}
