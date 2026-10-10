"use client";

import { useState } from "react";
import { unggahSk } from "@/lib/kgbAksi";
import KerangkaModal from "./KerangkaModal";
import { BidangBerkasPdf, Catatan, PesanGalat } from "./BidangForm";
import PemeriksaanTte, { bolehUnggahTte, useTteBerkas } from "./PemeriksaanTte";
import { BATAS_UNGGAH_SK_LABEL } from "@/lib/batasUnggah";
import { PESAN_TANPA_TTE, PESAN_TTE_RUSAK } from "@/lib/tteSk";
import { berkasPdfSah, subjudulPegawai, type RingkasPegawai } from "./format";
import { IkonUnggah } from "./ikon";

interface PropsModalUnggahSk {
  kgbId: string;
  pegawai: RingkasPegawai;
  /** Status KGB saat modal dibuka; menentukan keterangan. Bawaan sedang_diproses. */
  status?: string;
  isArsip?: boolean;
  onTutup: () => void;
  onBerhasil: (pesan: string) => void;
}

function keteranganUnggah(status: string, isArsip: boolean): { teks: string; ganti: boolean } {
  if (status === "menunggu_keuangan") {
    return {
      teks: "KGB ini sudah menunggu konfirmasi keuangan. Berkas yang dipilih menggantikan SK yang sudah diunggah; status KGB tidak berubah.",
      ganti: true,
    };
  }
  if (status === "selesai" && isArsip) {
    return {
      teks: "Berkas yang dipilih menjadi berkas SK arsip KGB ini dan menggantikan berkas yang tersimpan; status KGB tetap Selesai.",
      ganti: true,
    };
  }
  return {
    teks: "Unggah PDF SK KGB yang sudah ditandatangani: hasil TTE dari Srikandi, atau pindaian SK bertanda tangan basah. Setelah diunggah, status KGB berpindah ke Menunggu Keuangan sampai bagian keuangan melakukan konfirmasi.",
    ganti: false,
  };
}

export default function ModalUnggahSk({
  kgbId,
  pegawai,
  status = "sedang_diproses",
  isArsip = false,
  onTutup,
  onBerhasil,
}: PropsModalUnggahSk) {
  const [berkas, setBerkas] = useState<File | null>(null);
  const [basah, setBasah] = useState(false);
  const tte = useTteBerkas(berkas);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const keterangan = keteranganUnggah(status, isArsip);

  async function kirim() {
    if (sibuk) return;
    if (!berkas) {
      setGalat("Pilih berkas SK dalam format PDF.");
      return;
    }
    if (!berkasPdfSah(berkas)) {
      setGalat("Berkas SK harus berformat PDF.");
      return;
    }
    if (tte === "memeriksa") return;
    if (!bolehUnggahTte(tte, basah)) {
      setGalat(tte === "rusak" ? PESAN_TTE_RUSAK : PESAN_TANPA_TTE);
      return;
    }
    setSibuk(true);
    setGalat(null);
    const hasil = await unggahSk(kgbId, berkas, { ttdBasah: tte === "tanpa" && basah });
    setSibuk(false);
    if (!hasil.ok) {
      setGalat(hasil.error);
      return;
    }
    onBerhasil(
      keterangan.ganti
        ? `Berkas SK ${pegawai.nama} diganti.`
        : `SK ${pegawai.nama} terunggah. Status KGB: Menunggu Keuangan.`,
    );
  }

  return (
    <KerangkaModal
      judul="Unggah SK yang Sudah Ditandatangani"
      subjudul={subjudulPegawai(pegawai)}
      ikon={<IkonUnggah />}
      nada="hijau"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={kirim}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-hijau" disabled={sibuk || !berkas || !bolehUnggahTte(tte, basah)}>
            {sibuk ? "Mengunggah..." : "Unggah SK"}
          </button>
        </>
      }
    >
      <Catatan>{keterangan.teks}</Catatan>
      <BidangBerkasPdf
        label="Berkas SK (PDF)"
        wajib
        berkas={berkas}
        onPilih={(b) => {
          setBerkas(b);
          setBasah(false);
          setGalat(b && !berkasPdfSah(b) ? "Berkas SK harus berformat PDF." : null);
        }}
        nonaktif={sibuk}
        petunjuk={`Unggah berkas asli hasil unduhan Srikandi tanpa dikompres, paling besar ${BATAS_UNGGAH_SK_LABEL}.`}
        tinggiPratinjau={300}
      />
      <PemeriksaanTte keadaan={tte} basah={basah} onBasah={setBasah} nonaktif={sibuk} />
      <PesanGalat pesan={galat} />
    </KerangkaModal>
  );
}
