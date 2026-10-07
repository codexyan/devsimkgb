"use client";

import { useState } from "react";
import { lewatiReviewSkUpt } from "@/lib/kgbAksi";
import type { InfoReviewSk } from "@/lib/reviewSkUpt";
import KerangkaModal from "./KerangkaModal";
import { BidangAlasan, Catatan, PesanGalat } from "./BidangForm";
import { subjudulPegawai, type RingkasPegawai } from "./format";
import { IkonPeringatan } from "./ikon";

/* Super Admin melanjutkan SK pegawai UPT tanpa menunggu review Admin UPT (ADR-077). Hanya untuk keadaan mendesak,
   misalnya batas waktu; alasannya wajib dan tercatat di Log Aktivitas. Sesudahnya SK dapat dicetak tanpa tanda air
   dan diunggah TTE. */

interface PropsModalLewatiReview {
  kgbId: string;
  pegawai: RingkasPegawai;
  reviewSk: InfoReviewSk | null;
  onTutup: () => void;
  onBerhasil: (pesan: string) => void;
}

export default function ModalLewatiReview({ kgbId, pegawai, reviewSk, onTutup, onBerhasil }: PropsModalLewatiReview) {
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function kirim() {
    if (sibuk) return;
    if (!alasan.trim()) {
      setGalat("Tulis alasan melewati review.");
      return;
    }
    setSibuk(true);
    setGalat(null);
    const hasil = await lewatiReviewSkUpt(kgbId, alasan.trim());
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.error);
      return;
    }
    onBerhasil(`Review UPT untuk SK ${pegawai.nama} dilewati. SK dapat dicetak tanpa tanda air dan diunggah TTE.`);
  }

  return (
    <KerangkaModal
      judul="Lewati review UPT"
      subjudul={subjudulPegawai(pegawai)}
      ikon={<IkonPeringatan />}
      nada="amber"
      ukuran="sm"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={kirim}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Kembali
          </button>
          <button type="submit" className="kgbm-tombol kgbm-amber" disabled={sibuk || !alasan.trim()}>
            {sibuk ? "Menyimpan..." : "Lewati review"}
          </button>
        </>
      }
    >
      <Catatan nada="amber">
        SK ini akan dicetak dan diunggah TTE tanpa persetujuan Admin UPT. Pakai hanya untuk keadaan mendesak, misalnya
        batas waktu yang hampir lewat. Alasannya tercatat di Log Aktivitas, dan permintaan review di daftar kerja UPT
        ditutup.
      </Catatan>
      {reviewSk?.status === "perbaikan" && reviewSk.catatan && (
        <Catatan nada="merah">UPT meminta perbaikan: {reviewSk.catatan}</Catatan>
      )}
      <BidangAlasan
        label="Alasan melewati review"
        wajib
        nilai={alasan}
        onUbah={setAlasan}
        placeholder="Contoh: batas proses hari ini dan UPT belum dapat dihubungi"
        nonaktif={sibuk}
        fokusAwal
      />
      <PesanGalat pesan={galat} />
    </KerangkaModal>
  );
}
