"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ambilRiwayatKgb,
  namaFileSk,
  tautanBerkasSk,
  unduhBlob,
  unduhUlangSk,
  type HasilAksi,
  type RiwayatKgbItem,
} from "@/lib/kgbAksi";
import { formatTanggalId, tanggalKalender } from "@/lib/waktu";
import KerangkaModal from "./KerangkaModal";
import { Catatan, Lencana, LencanaRapelan, LencanaStatus, Memuat, PesanGalat } from "./BidangForm";
import { formatMkg, formatRupiah, nomorSkTerisi, subjudulPegawai, type RingkasPegawai } from "./format";
import { IkonRiwayat } from "./ikon";

interface PropsModalRiwayatKgb {
  pegawai: RingkasPegawai & { id: string; jabatan?: string | null; golonganRuang?: string | null };
  onTutup: () => void;
}

export default function ModalRiwayatKgb({ pegawai, onTutup }: PropsModalRiwayatKgb) {
  const [data, setData] = useState<HasilAksi<RiwayatKgbItem[]> | null>(null);
  const [mengunduhId, setMengunduhId] = useState<string | null>(null);
  const [galatUnduh, setGalatUnduh] = useState<string | null>(null);
  const tautan = `/dashboard/pegawai/${encodeURIComponent(pegawai.id)}/riwayat`;

  useEffect(() => {
    let batal = false;
    ambilRiwayatKgb(pegawai.id).then((hasil) => {
      if (!batal) setData(hasil);
    });
    return () => {
      batal = true;
    };
  }, [pegawai.id]);

  async function unduhSk(k: RiwayatKgbItem) {
    if (mengunduhId) return;
    setMengunduhId(k.id);
    setGalatUnduh(null);
    const hasil = await unduhUlangSk(k.id);
    setMengunduhId(null);
    if (!hasil.ok) {
      setGalatUnduh(hasil.error);
      return;
    }
    const tahun = tanggalKalender(k.surat?.tanggalSurat)?.getFullYear() ?? null;
    unduhBlob(hasil.data, namaFileSk({ nama: pegawai.nama, tahun, versi: "biasa" }));
  }

  const identitas = [pegawai.jabatan, pegawai.golonganRuang].filter(Boolean).join(" · ");

  return (
    <KerangkaModal
      judul="Riwayat KGB"
      subjudul={identitas ? `${subjudulPegawai(pegawai)} · ${identitas}` : subjudulPegawai(pegawai)}
      ikon={<IkonRiwayat />}
      nada="hijau"
      onTutup={onTutup}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup}>
            Tutup
          </button>
          <Link href={tautan} className="kgbm-tombol kgbm-hijau" onClick={onTutup}>
            Buka Riwayat Pegawai
          </Link>
        </>
      }
    >
      <PesanGalat pesan={galatUnduh} />
      {data === null && <Memuat teks="Memuat riwayat KGB..." />}
      {data && !data.ok && <Catatan nada="merah">{data.error}</Catatan>}
      {data?.ok && data.data.length === 0 && <Catatan>Belum ada riwayat KGB.</Catatan>}
      {data?.ok && data.data.length > 0 && (
        <ul className="kgbm-daftar">
          {data.data.map((k) => {
            const nomorSkBaru = nomorSkTerisi(k.surat?.nomorSurat);
            const bisaUnduhUlang = !k.surat?.pathFile && !!nomorSkBaru;
            const dalamProses = k.status !== "selesai" && k.status !== "ditolak";
            return (
              <li key={k.id} className="kgbm-item">
                <div className="kgbm-item-kepala">
                  <p className="kgbm-item-judul">TMT {formatTanggalId(k.tmtKgbBaru)}</p>
                  {k.isArsip && <Lencana nada="navy">Arsip</Lencana>}
                  {k.flagRapelan && !k.isArsip && dalamProses && <LencanaRapelan />}
                  {k.rapelanDitetapkan === true && <Lencana nada="amber">Rapelan ditetapkan</Lencana>}
                  <LencanaStatus status={k.status} />
                </div>
                <dl className="kgbm-item-data">
                  <div>
                    <dt>Gaji pokok lama</dt>
                    <dd>{formatRupiah(k.gajiPokokLama)}</dd>
                  </div>
                  <div>
                    <dt>Gaji pokok baru</dt>
                    <dd>{formatRupiah(k.gajiPokokBaru)}</dd>
                  </div>
                  <div>
                    <dt>Masa kerja baru</dt>
                    <dd>{formatMkg(k.mkgTahunBaru, k.mkgBulanBaru)}</dd>
                  </div>
                  <div>
                    <dt>Nomor SK Terakhir</dt>
                    <dd>{nomorSkTerisi(k.nomorSK) || "-"}</dd>
                  </div>
                  {nomorSkBaru && (
                    <div>
                      <dt>Nomor SK Baru</dt>
                      <dd>{nomorSkBaru}</dd>
                    </div>
                  )}
                </dl>
                {(k.surat?.pathFile || bisaUnduhUlang) && (
                  <div className="kgbm-baris-tombol" style={{ justifyContent: "flex-end" }}>
                    {k.surat?.pathFile && (
                      <a
                        href={tautanBerkasSk(k.surat.pathFile)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil"
                      >
                        Lihat SK Tertandatangani
                      </a>
                    )}
                    {bisaUnduhUlang && (
                      <button
                        type="button"
                        className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil"
                        onClick={() => void unduhSk(k)}
                        disabled={!!mengunduhId}
                      >
                        {mengunduhId === k.id ? "Mengunduh..." : "Unduh SK"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </KerangkaModal>
  );
}
