"use client";

import { useEffect, useRef, useState } from "react";
import { KerangkaModal, Catatan, DaftarData, PesanGalat } from "@/app/dashboard/components/kgb";
import { Memuat } from "@/app/dashboard/components/kgb/BidangForm";
import { pratinjauSkUsulan, type PratinjauSkUsulan } from "@/lib/kgbAksi";
import { formatTanggalId } from "@/lib/waktu";

/* Pratinjau SK KGB dari isian usulan yang belum diajukan (ADR-078). Admin UPT memeriksa SK KGB berikutnya menurut
   isiannya sendiri sebelum mengajukan: golongan, gaji pokok, masa kerja, TMT, dan Atas dasar SK. Isinya disusun server
   dengan hitungan yang sama dengan persetujuan Kanwil dan Buat SK; nomor surat, tanggal, dan penandatangannya
   ditetapkan Kanwil, dan SK yang kelak dibuat Kanwil tetap direview UPT sebelum dicetak (ADR-077). */

const rupiah = (n: number | null | undefined) => (typeof n === "number" ? `Rp${n.toLocaleString("id-ID")}` : "-");
const mkg = (tahun: number, bulan: number) => `${tahun} tahun ${bulan} bulan`;
const tgl = (t: unknown) => (t ? formatTanggalId(t as string) : "-");

export default function ModalPratinjauSkUsulan({
  isian,
  nama,
  onTutup,
}: {
  /** Isian formulir saat tombol ditekan, dalam bentuk yang sama dengan yang disimpan. */
  isian: Record<string, string>;
  nama: string;
  onTutup: () => void;
}) {
  const [data, setData] = useState<PratinjauSkUsulan | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  // Isian dibaca sekali saat jendela dibuka; pratinjau baru dibuat dengan menutup lalu menekan tombolnya lagi.
  const isianRef = useRef(isian);

  useEffect(() => {
    let batal = false;
    async function muat() {
      const hasil = await pratinjauSkUsulan(isianRef.current);
      if (batal) return;
      if (!hasil.ok) {
        setGalat(hasil.error);
        return;
      }
      setData(hasil.data);
      const alamat = URL.createObjectURL(hasil.data.pdf);
      urlRef.current = alamat;
      setUrl(alamat);
    }
    void muat();
    return () => {
      batal = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    };
  }, []);

  const s = data?.surat;

  return (
    <KerangkaModal
      judul="Pratinjau SK KGB"
      subjudul={`${nama} · dari isian formulir, belum diajukan`}
      nada="navy"
      ukuran="lg"
      onTutup={onTutup}
      kaki={
        <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup}>
          Kembali ke formulir
        </button>
      }
    >
      <div className="kgbm-sk-grid">
        <div className="kgbm-kolom">
          <Catatan nada="navy">
            SK KGB berikutnya menurut isian Anda, dihitung dengan cara yang sama dengan persetujuan Kanwil. Bila ada yang
            keliru, betulkan isiannya lalu buka pratinjau lagi. Nomor dan tanggal surat serta penandatangannya ditetapkan
            Kanwil saat membuat SK, dan SK itu tetap Anda periksa sebelum dicetak.
          </Catatan>
          {!s && !galat && <Memuat teks="Menyusun pratinjau SK..." />}
          {s && (
            <DaftarData
              judul="Isi SK"
              baris={[
                { label: "Pangkat dan golongan", nilai: `${s.pegawai.pangkat} (${s.pegawai.golonganRuang})` },
                { label: "Gaji pokok lama", nilai: rupiah(s.kgb.gajiPokokLama) },
                { label: "Atas dasar SK", nilai: `${s.kgb.nomorSK || "-"}, ${tgl(s.kgb.tanggalSK)}` },
                { label: "TMT SK dasar", nilai: tgl(s.kgb.tmtSK) },
                { label: "Gaji pokok baru", nilai: rupiah(s.kgb.gajiPokokBaru), nada: "hijau" },
                { label: "Masa kerja golongan baru", nilai: mkg(s.kgb.mkgTahunBaru, s.kgb.mkgBulanBaru) },
                { label: "TMT KGB", nilai: tgl(s.kgb.tmtKgbBaru) },
                { label: "KGB berikutnya", nilai: tgl(s.kgb.tmtKgbBerikutnya) },
              ]}
            />
          )}
          {data?.atasDasar && (
            <p className="kgbm-petunjuk">
              Atas dasar: {data.atasDasar.label}
              {data.atasDasar.tmt ? `, TMT ${tgl(data.atasDasar.tmt)}` : ""}.
            </p>
          )}
          {data?.catatan.map((c) => (
            <Catatan key={c} nada="amber">
              {c}
            </Catatan>
          ))}
          <PesanGalat pesan={galat} />
        </div>
        <div className="kgbm-pratinjau">
          <div className="kgbm-pratinjau-isi">
            {url ? <iframe src={url} title={`Pratinjau SK KGB ${nama}`} /> : !galat ? <Memuat teks="Menyusun pratinjau SK..." /> : null}
          </div>
          {url && (
            <div className="kgbm-baris-tombol">
              <a href={url} target="_blank" rel="noopener noreferrer" className="kgbm-tautan">
                Buka pratinjau di tab baru
              </a>
            </div>
          )}
        </div>
      </div>
    </KerangkaModal>
  );
}
