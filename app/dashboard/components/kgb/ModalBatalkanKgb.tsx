"use client";

import { useState } from "react";
import { batalkanKgb } from "@/lib/kgbAksi";
import KerangkaModal from "./KerangkaModal";
import { BidangAlasan, Catatan, PesanGalat } from "./BidangForm";
import { subjudulPegawai, type RingkasPegawai } from "./format";
import { IkonBatal } from "./ikon";

interface PropsModalBatalkanKgb {
  kgbId: string;
  pegawai: RingkasPegawai;
  onTutup: () => void;
  /** Dipanggil setelah API berhasil; induk menutup modal dan memuat ulang data. */
  onBerhasil: (pesan: string) => void;
}

export default function ModalBatalkanKgb({ kgbId, pegawai, onTutup, onBerhasil }: PropsModalBatalkanKgb) {
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function kirim() {
    if (sibuk) return;
    if (!alasan.trim()) {
      setGalat("Lengkapi Alasan pembatalan.");
      return;
    }
    setSibuk(true);
    setGalat(null);
    const hasil = await batalkanKgb(kgbId, alasan);
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.error);
      return;
    }
    onBerhasil(`KGB ${pegawai.nama} dibatalkan. Gunakan Input Ulang KGB setelah data diperbaiki.`);
  }

  return (
    <KerangkaModal
      judul="Batalkan KGB"
      subjudul={subjudulPegawai(pegawai)}
      ikon={<IkonBatal />}
      nada="merah"
      ukuran="sm"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={kirim}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Kembali
          </button>
          <button type="submit" className="kgbm-tombol kgbm-bahaya" disabled={sibuk}>
            {sibuk ? "Membatalkan..." : "Batalkan KGB"}
          </button>
        </>
      }
    >
      <Catatan>
        KGB ini akan berstatus Dibatalkan dan jadwal KGB pegawai dikembalikan, sehingga KGB dapat diinput ulang
        setelah data diperbaiki. Hanya KGB berstatus Belum Diproses atau Sedang Diproses yang dapat dibatalkan.
      </Catatan>
      <BidangAlasan
        label="Alasan pembatalan"
        wajib
        nilai={alasan}
        onUbah={setAlasan}
        placeholder="Contoh: salah input golongan atau TMT"
        nonaktif={sibuk}
        fokusAwal
      />
      <PesanGalat pesan={galat} />
    </KerangkaModal>
  );
}
