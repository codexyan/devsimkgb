"use client";

import { useState } from "react";
import Link from "next/link";
import { KerangkaModal } from "@/app/dashboard/components/kgb";
import { KIRIM_SURAT_BATAS } from "@/lib/batasInputSdm";
import { formatTanggalId } from "@/lib/waktu";

/* Pengingat periode pengusulan KGB untuk Admin UPT (ADR-029). Surat usulan dikirim ke Kanwil tanggal 1 sampai 10
   bulan kedua sebelum TMT. Begitu masa kirim dibuka, dashboard menampilkan jendela ini sekali per periode selama
   masih ada pegawai jatuh tempo yang belum diajukan, dengan pintasan ke Usulan kolektif yang langsung mencentang
   pegawai itu. Setelah ditutup, jendela tidak tampil lagi untuk periode yang sama di perangkat ini. */

export interface PegawaiJatuhTempo {
  id: string;
  nama: string;
  nip: string;
  golonganRuang: string;
}

const kunciSimpan = (satker: string, bulanTmt: string) => `kgb-pengingat-usulan:${satker}:${bulanTmt}`;

function sudahDitutup(kunci: string): boolean {
  try {
    return localStorage.getItem(kunci) === "1";
  } catch {
    return false;
  }
}

export default function PengingatUsulan({
  satker,
  bulanTmt,
  namaBulanTmt,
  hariIni,
  jumlahJatuhTempo,
  belumDiajukan,
}: {
  satker: string;
  /** yyyy-mm */
  bulanTmt: string;
  namaBulanTmt: string;
  hariIni: Date;
  jumlahJatuhTempo: number;
  belumDiajukan: PegawaiJatuhTempo[];
}) {
  const kunci = kunciSimpan(satker, bulanTmt);
  // Masa kirim surat: tanggal 1 sampai 10 bulan ini (bulan kedua sebelum TMT).
  const dalamMasaKirim = hariIni.getDate() <= KIRIM_SURAT_BATAS;
  const [tutup, setTutup] = useState(() => sudahDitutup(kunci));
  if (tutup || !dalamMasaKirim || belumDiajukan.length === 0) return null;

  const batas = new Date(hariIni.getFullYear(), hariIni.getMonth(), KIRIM_SURAT_BATAS);
  const sisaHari = Math.round((batas.getTime() - new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate()).getTime()) / 86_400_000);
  const selesai = () => {
    try {
      localStorage.setItem(kunci, "1");
    } catch {
      /* penyimpanan tidak tersedia: jendela tampil lagi saat dimuat ulang */
    }
    setTutup(true);
  };

  return (
    <KerangkaModal
      judul={`Masa kirim usulan KGB TMT ${namaBulanTmt} dibuka`}
      subjudul="Kirim surat usulan ke Kanwil lewat Srikandi"
      nada="amber"
      ukuran="md"
      onTutup={selesai}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={selesai}>
            Nanti saja
          </button>
          <Link href={`/dashboard/upt/kolektif?bulan=${bulanTmt}`} className="kgbm-tombol kgbm-utama" onClick={selesai}>
            Siapkan usulan kolektif
          </Link>
        </>
      }
    >
      <div className="pgu-batas">
        <span className="pgu-tanggal" aria-hidden="true">
          <small>{formatTanggalId(batas, { month: "short" })}</small>
          <strong>{KIRIM_SURAT_BATAS}</strong>
        </span>
        <span className="min-w-0">
          <strong>Batas kirim surat {formatTanggalId(batas, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong>
          <span>{sisaHari === 0 ? "Hari ini hari terakhir." : `${sisaHari} hari lagi.`} Surat yang terlambat menggeser proses KGB pegawai.</span>
        </span>
      </div>

      <div className="pgu-angka">
        <div>
          <strong>{jumlahJatuhTempo}</strong>
          <span>pegawai KGB TMT {namaBulanTmt}</span>
        </div>
        <div data-nada="amber">
          <strong>{belumDiajukan.length}</strong>
          <span>belum diajukan ke Kanwil</span>
        </div>
      </div>

      <ul className="pgu-daftar" aria-label="Pegawai yang belum diajukan">
        {belumDiajukan.slice(0, 6).map((p) => (
          <li key={p.id}>
            <span className="min-w-0">
              <strong>{p.nama}</strong>
              <span>{p.nip}</span>
            </span>
            <span className="dsb-tag" data-garis="">{p.golonganRuang}</span>
          </li>
        ))}
      </ul>
      {belumDiajukan.length > 6 && <p className="pgu-lain">dan {belumDiajukan.length - 6} pegawai lainnya.</p>}

      <ol className="pgu-langkah">
        <li>Siapkan data dan berkas SK tiap pegawai di Usulan kolektif; pegawai di atas sudah tercentang.</li>
        <li>Kirim surat usulan lewat Srikandi, lalu ajukan dengan nomor surat yang sama di SIM-KGB.</li>
      </ol>
    </KerangkaModal>
  );
}
