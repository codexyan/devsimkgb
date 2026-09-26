"use client";

import { useRef, useState } from "react";
import { BATAS_BERKAS_USULAN_BYTE, PESAN_BERKAS_TERLALU_BESAR } from "@/lib/usulanPegawai";

/* Satu kolom berkas pada formulir usulan UPT. Selama kosong ia berupa pemilih berkas; begitu ada berkas,
   baik yang baru dipilih maupun yang sudah tersimpan, ia menjadi kartu dengan Pratinjau, Ganti, dan Hapus.
   Berkas yang baru dipilih dapat dipratinjau langsung dari peramban, sebelum diunggah ke server. */

function ukuranBerkas(byte: number): string {
  return byte >= 1048576 ? `${(byte / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(byte / 1024))} KB`;
}

export default function KolomBerkas({
  label,
  wajib,
  bantuan,
  dipilih,
  urlTersimpan,
  ditandaiHapus,
  onPilih,
  onHapusTersimpan,
  onBatalHapus,
  onPratinjau,
}: {
  label: string;
  wajib: boolean;
  bantuan: string;
  /** Berkas baru yang dipilih dan belum disimpan. */
  dipilih: File | null;
  /** Alamat berkas yang sudah tersimpan di server; null bila belum ada. */
  urlTersimpan: string | null;
  /** Berkas tersimpan ditandai untuk dihapus saat formulir disimpan. */
  ditandaiHapus: boolean;
  onPilih: (berkas: File | null) => void;
  onHapusTersimpan: () => void;
  onBatalHapus: () => void;
  /** `lokal` true bila url adalah blob URL dari peramban yang harus dicabut setelah ditutup. */
  onPratinjau: (judul: string, url: string, lokal: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const judul = `${label} (PDF, paling besar 1 MB)`;
  const tersimpan = !!urlTersimpan && !ditandaiHapus;

  function pilih(e: React.ChangeEvent<HTMLInputElement>) {
    const berkas = e.target.files?.[0] ?? null;
    // Dikosongkan agar memilih berkas yang sama sekali lagi tetap terbaca sebagai perubahan.
    e.target.value = "";
    if (!berkas) return;
    if (berkas.type !== "application/pdf") {
      setGalat(`${label} harus berupa PDF.`);
      return;
    }
    if (berkas.size > BATAS_BERKAS_USULAN_BYTE) {
      setGalat(PESAN_BERKAS_TERLALU_BESAR);
      return;
    }
    setGalat(null);
    onPilih(berkas);
  }

  const pemilih = (
    <input
      ref={inputRef}
      className={dipilih || tersimpan ? "sr-only" : "kgbm-input"}
      type="file"
      accept="application/pdf"
      aria-label={dipilih || tersimpan ? `Ganti ${label}` : undefined}
      tabIndex={dipilih || tersimpan ? -1 : undefined}
      onChange={pilih}
    />
  );

  return (
    <div className="kgbm-label">
      {wajib ? <span className="kgbm-wajib">{judul}</span> : <span>{judul}</span>}
      {dipilih || tersimpan ? (
        <div className="kgbm-kartu-berkas" data-keadaan={dipilih ? "baru" : "tersimpan"}>
          <svg className="kgbm-kartu-berkas-ikon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
          <span className="kgbm-kartu-berkas-teks">
            <span className="kgbm-kartu-berkas-nama">{dipilih ? dipilih.name : label}</span>
            <span className="kgbm-kartu-berkas-ket">
              {dipilih
                ? `${ukuranBerkas(dipilih.size)} · baru dipilih, diunggah saat data disimpan`
                : "Tersimpan di SIM-KGB"}
            </span>
          </span>
          <span className="kgbm-kartu-berkas-aksi">
            <button
              type="button"
              onClick={() =>
                dipilih
                  ? onPratinjau(label, URL.createObjectURL(dipilih), true)
                  : onPratinjau(label, urlTersimpan!, false)
              }
            >
              Pratinjau
            </button>
            <button type="button" onClick={() => inputRef.current?.click()}>
              Ganti
            </button>
            <button
              type="button"
              data-bahaya=""
              onClick={() => {
                setGalat(null);
                // Membatalkan berkas baru mengembalikan berkas tersimpan; menghapus berkas tersimpan menandainya.
                if (dipilih) onPilih(null);
                else onHapusTersimpan();
              }}
            >
              Hapus
            </button>
          </span>
        </div>
      ) : null}
      {pemilih}
      {!dipilih && ditandaiHapus && (
        <span className="kgbm-bantuan" style={{ color: "var(--st-red)" }}>
          Berkas tersimpan akan dihapus saat data disimpan.{" "}
          <button type="button" className="kgbm-tautan" onClick={onBatalHapus}>
            Batalkan
          </button>
        </span>
      )}
      {galat && (
        <span className="kgbm-bantuan" role="alert" style={{ color: "var(--st-red)" }}>
          {galat}
        </span>
      )}
      <span className="kgbm-bantuan">{bantuan}</span>
    </div>
  );
}
