"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { buatPdfSk, namaFileSk, simpanDasarSk, unduhBlob, type DataDasarSk } from "@/lib/kgbAksi";
import { alasanTolakBuatSk } from "@/lib/prosesKgb";
import { formatTanggalId, hariIniWita, isoTanggalLokal, type NilaiTanggal } from "@/lib/waktu";
import KerangkaModal from "./KerangkaModal";
import {
  BagianForm,
  BidangPenetap,
  BidangTeks,
  Catatan,
  DaftarData,
  LencanaRapelan,
  Memuat,
  PesanGalat,
} from "./BidangForm";
import {
  formatMkg,
  formatRupiah,
  isianDasarSk,
  nilaiInputTanggal,
  nomorSkTerisi,
  pesanBidangWajib,
  subjudulPegawai,
  tahunTanggalInput,
  type DasarSkAwal,
  type RingkasPegawai,
} from "./format";
import { IkonDokumen } from "./ikon";

type Versi = "biasa" | "srikandi";
const DAFTAR_VERSI: readonly Versi[] = ["biasa", "srikandi"];
const LABEL_VERSI: Record<Versi, string> = { biasa: "SK biasa", srikandi: "Versi Srikandi" };

/** Data KGB yang tercetak di SK, untuk ditinjau sebelum SK dibuat. */
export interface RingkasanSk {
  golongan?: string | null;
  gajiPokokLama?: number | null;
  gajiPokokBaru?: number | null;
  mkgTahunBaru?: number | null;
  mkgBulanBaru?: number | null;
  tmtKgbBaru?: NilaiTanggal;
  flagRapelan?: boolean;
}

interface PropsModalBuatSk {
  kgbId: string;
  /** Status KGB; selain sedang_diproses modal hanya menampilkan alasan penolakan. */
  status?: string;
  pegawai: RingkasPegawai;
  ringkasan?: RingkasanSk | null;
  dasarAwal?: DasarSkAwal | null;
  /** Nomor dan tanggal SK baru yang sudah pernah dibuat; tanggal bawaan hari ini (WITA). */
  skBaruAwal?: { nomorSurat?: string | null; tanggalSurat?: NilaiTanggal } | null;
  onTutup: () => void;
  onBerhasil: (pesan: string) => void;
}

export default function ModalBuatSk({
  kgbId,
  status,
  pegawai,
  ringkasan,
  dasarAwal,
  skBaruAwal,
  onTutup,
  onBerhasil,
}: PropsModalBuatSk) {
  const alasanTolak = status ? alasanTolakBuatSk(status) : null;
  const idTab = useId();
  const [dasar, setDasar] = useState<DataDasarSk>(() => isianDasarSk(dasarAwal));
  const [skBaru, setSkBaru] = useState(() => ({
    nomorSurat: nomorSkTerisi(skBaruAwal?.nomorSurat),
    tanggalSurat: nilaiInputTanggal(skBaruAwal?.tanggalSurat) || isoTanggalLokal(hariIniWita()),
  }));
  const [tab, setTab] = useState<Versi>("biasa");
  const [pratinjau, setPratinjau] = useState<Record<Versi, string | null>>({ biasa: null, srikandi: null });
  const [memuatVersi, setMemuatVersi] = useState<Versi | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  // Data SK terakhir yang terakhir tersimpan lewat PATCH, agar tidak dikirim ulang tanpa perubahan.
  const dasarTersimpan = useRef<string | null>(null);
  // Naik setiap isian berubah; hasil pratinjau yang dimulai sebelum perubahan dibuang.
  const putaranIsian = useRef(0);
  const urlPratinjau = useRef<Record<Versi, string | null>>({ biasa: null, srikandi: null });
  const perubahan = useRef<"tidak" | "dasar" | "sk">("tidak");
  const refKolomForm = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const daftarUrl = urlPratinjau.current;
    return () => {
      for (const versi of DAFTAR_VERSI) {
        const url = daftarUrl[versi];
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, []);

  function gantiPratinjau(versi: Versi, url: string | null) {
    const lama = urlPratinjau.current[versi];
    if (lama && lama !== url) URL.revokeObjectURL(lama);
    urlPratinjau.current[versi] = url;
    setPratinjau((p) => ({ ...p, [versi]: url }));
  }

  function isianBerubah() {
    putaranIsian.current += 1;
    if (urlPratinjau.current.biasa) gantiPratinjau("biasa", null);
    if (urlPratinjau.current.srikandi) gantiPratinjau("srikandi", null);
    setMemuatVersi(null);
  }

  function ubahDasar(kolom: keyof DataDasarSk, nilai: string) {
    setDasar((d) => ({ ...d, [kolom]: nilai }));
    isianBerubah();
  }
  function ubahSkBaru(kolom: "nomorSurat" | "tanggalSurat", nilai: string) {
    setSkBaru((s) => ({ ...s, [kolom]: nilai }));
    isianBerubah();
  }

  const bidangWajib = (): [string, string][] => [
    ["Nomor SK Terakhir", dasar.nomorSK],
    ["Tanggal SK Terakhir", dasar.tanggalSK],
    ["TMT SK Terakhir", dasar.tmtSK],
    ["Ditetapkan oleh", dasar.penetapSkDasar],
    ["Nomor SK Baru", skBaru.nomorSurat],
    ["Tanggal SK Baru", skBaru.tanggalSurat],
  ];

  function periksaIsian(): string | null {
    return pesanBidangWajib(bidangWajib());
  }

  /** Fokus ke bidang wajib pertama yang kosong, agar bidang itu terlihat pada layar sempit. */
  function fokusBidangKosong() {
    const kosong = bidangWajib().find(([, nilai]) => !nilai.trim())?.[0];
    const label = Array.from(refKolomForm.current?.querySelectorAll<HTMLLabelElement>("label.kgbm-label") ?? []).find(
      (el) => el.textContent?.replace(/\*$/, "").trim() === kosong,
    );
    if (label?.htmlFor) document.getElementById(label.htmlFor)?.focus();
  }

  /** PDF dibuat dari data SK terakhir yang tersimpan, jadi isian disimpan dulu bila berubah. */
  async function simpanDasarBilaBerubah(): Promise<string | null> {
    const isi: DataDasarSk = {
      nomorSK: dasar.nomorSK.trim(),
      tanggalSK: dasar.tanggalSK,
      tmtSK: dasar.tmtSK,
      penetapSkDasar: dasar.penetapSkDasar.trim(),
    };
    const kunci = JSON.stringify(isi);
    if (dasarTersimpan.current === kunci) return null;
    const hasil = await simpanDasarSk(kgbId, isi);
    if (!hasil.ok) return hasil.error;
    dasarTersimpan.current = kunci;
    if (perubahan.current === "tidak") perubahan.current = "dasar";
    return null;
  }

  const isiSkBaru = () => ({ nomorSurat: skBaru.nomorSurat.trim(), tanggalSurat: skBaru.tanggalSurat });

  async function muatPratinjau(versi: Versi) {
    if (sibuk || memuatVersi || alasanTolak) return;
    const kurang = periksaIsian();
    if (kurang) {
      setGalat(`${kurang} Pratinjau memerlukan semua isian.`);
      fokusBidangKosong();
      return;
    }
    const putaran = putaranIsian.current;
    setMemuatVersi(versi);
    setGalat(null);
    const galatSimpan = await simpanDasarBilaBerubah();
    if (putaranIsian.current !== putaran) return;
    if (galatSimpan) {
      setMemuatVersi(null);
      setGalat(galatSimpan);
      return;
    }
    const hasil = await buatPdfSk(kgbId, isiSkBaru(), { pratinjau: true, srikandi: versi === "srikandi" });
    if (putaranIsian.current !== putaran) return;
    setMemuatVersi(null);
    if (!hasil.ok) {
      setGalat(hasil.error);
      return;
    }
    gantiPratinjau(versi, URL.createObjectURL(hasil.data));
  }

  function pilihTab(versi: Versi) {
    setTab(versi);
    if (!pratinjau[versi] && !memuatVersi && !sibuk && !periksaIsian()) void muatPratinjau(versi);
  }

  function tombolTab(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const berikut: Versi = tab === "biasa" ? "srikandi" : "biasa";
    document.getElementById(`${idTab}-tab-${berikut}`)?.focus();
    pilihTab(berikut);
  }

  async function buatDanUnduh() {
    if (sibuk || memuatVersi || alasanTolak) return;
    const kurang = periksaIsian();
    if (kurang) {
      setGalat(kurang);
      fokusBidangKosong();
      return;
    }
    setSibuk(true);
    setGalat(null);
    const galatSimpan = await simpanDasarBilaBerubah();
    if (galatSimpan) {
      setSibuk(false);
      setGalat(galatSimpan);
      return;
    }
    const isi = isiSkBaru();
    // Hanya SK biasa yang mencatat surat; versi Srikandi diminta sebagai pratinjau agar tidak tercatat dua kali.
    const [biasa, srikandi] = await Promise.all([
      buatPdfSk(kgbId, isi, { pratinjau: false, srikandi: false }),
      buatPdfSk(kgbId, isi, { pratinjau: true, srikandi: true }),
    ]);
    setSibuk(false);
    if (!biasa.ok) {
      setGalat(biasa.error);
      return;
    }
    perubahan.current = "sk";
    unduhBlob(biasa.data, namaFileSk({ nama: pegawai.nama, tahun: tahunTanggalInput(isi.tanggalSurat), versi: "biasa" }));
    if (!srikandi.ok) {
      setGalat(
        `SK biasa sudah dibuat dan diunduh, tetapi versi Srikandi gagal dibuat (${srikandi.error}). Pilih tab Versi Srikandi untuk mencoba lagi.`,
      );
      return;
    }
    unduhBlob(srikandi.data, namaFileSk({ nama: pegawai.nama, versi: "srikandi" }));
    onBerhasil(
      `SK KGB ${pegawai.nama} dibuat dan diunduh sebagai SK biasa dan versi Srikandi. Setelah SK ditandatangani, pilih Unggah SK TTE.`,
    );
  }

  function tutup() {
    if (sibuk) return;
    if (perubahan.current === "sk") onBerhasil(`SK KGB ${pegawai.nama} sudah dibuat.`);
    else if (perubahan.current === "dasar") onBerhasil(`Data SK terakhir ${pegawai.nama} tersimpan.`);
    else onTutup();
  }

  const urlTab = pratinjau[tab];
  const kurangIsian = alasanTolak ? null : periksaIsian();
  const skPernahDibuat = !!nomorSkTerisi(skBaruAwal?.nomorSurat);

  return (
    <KerangkaModal
      judul="Buat Surat Keputusan KGB"
      subjudul={subjudulPegawai(pegawai)}
      ikon={<IkonDokumen />}
      nada="navy"
      ukuran={alasanTolak ? "sm" : "lg"}
      sibuk={sibuk}
      onTutup={tutup}
      onKirim={alasanTolak ? undefined : buatDanUnduh}
      kaki={
        alasanTolak ? (
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={tutup}>
            Tutup
          </button>
        ) : (
          <>
            <button type="button" className="kgbm-tombol kgbm-kedua" onClick={tutup} disabled={sibuk}>
              Batal
            </button>
            <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk || !!memuatVersi}>
              {sibuk ? "Membuat SK..." : "Buat dan Unduh SK"}
            </button>
          </>
        )
      }
    >
      {alasanTolak ? (
        <Catatan nada="merah">{alasanTolak}</Catatan>
      ) : (
        <div className="kgbm-sk-grid">
          <div className="kgbm-kolom" ref={refKolomForm}>
            {ringkasan && (
              <DaftarData
                judul="Data yang Tercetak di SK"
                tambahan={ringkasan.flagRapelan ? <LencanaRapelan /> : undefined}
                baris={[
                  { label: "Golongan", nilai: ringkasan.golongan || "-" },
                  { label: "Gaji pokok lama", nilai: formatRupiah(ringkasan.gajiPokokLama) },
                  { label: "Gaji pokok baru", nilai: formatRupiah(ringkasan.gajiPokokBaru), nada: "hijau" },
                  { label: "Masa kerja baru", nilai: formatMkg(ringkasan.mkgTahunBaru, ringkasan.mkgBulanBaru) },
                  { label: "TMT KGB", nilai: formatTanggalId(ringkasan.tmtKgbBaru) },
                ]}
              />
            )}
            <BagianForm judul="Atas Dasar SK Terakhir" keterangan="SK terakhir pegawai yang menjadi dasar KGB ini.">
              <BidangTeks
                label="Nomor SK Terakhir"
                wajib
                nilai={dasar.nomorSK}
                onUbah={(nilai) => ubahDasar("nomorSK", nilai)}
                placeholder="Nomor sesuai dokumen SK"
                nonaktif={sibuk}
                fokusAwal
              />
              <div className="kgbm-grid2">
                <BidangTeks
                  label="Tanggal SK Terakhir"
                  jenis="date"
                  wajib
                  nilai={dasar.tanggalSK}
                  onUbah={(nilai) => ubahDasar("tanggalSK", nilai)}
                  nonaktif={sibuk}
                />
                <BidangTeks
                  label="TMT SK Terakhir"
                  jenis="date"
                  wajib
                  nilai={dasar.tmtSK}
                  onUbah={(nilai) => ubahDasar("tmtSK", nilai)}
                  nonaktif={sibuk}
                />
              </div>
              <BidangPenetap
                wajib
                nilai={dasar.penetapSkDasar}
                onUbah={(nilai) => ubahDasar("penetapSkDasar", nilai)}
                petunjuk="Pejabat yang menetapkan SK terakhir; tercetak pada baris Oleh."
                nonaktif={sibuk}
              />
            </BagianForm>
            <BagianForm
              judul="SK KGB Baru"
              nada="hijau"
              keterangan="Nomor dan tanggal yang tercetak di bagian atas SK KGB."
            >
              <BidangTeks
                label="Nomor SK Baru"
                wajib
                nilai={skBaru.nomorSurat}
                onUbah={(nilai) => ubahSkBaru("nomorSurat", nilai)}
                placeholder="Nomor dari Tata Usaha"
                nonaktif={sibuk}
              />
              <BidangTeks
                label="Tanggal SK Baru"
                jenis="date"
                wajib
                nilai={skBaru.tanggalSurat}
                onUbah={(nilai) => ubahSkBaru("tanggalSurat", nilai)}
                petunjuk="Penandatangan dipilih menurut tanggal ini sesuai Pengaturan."
                nonaktif={sibuk}
              />
              {skPernahDibuat && (
                <Catatan nada="amber">
                  SK baru untuk KGB ini sudah pernah dibuat. Buat dan Unduh SK akan mencatat ulang nomor, tanggal, dan
                  penandatangan SK sesuai isian di atas.
                </Catatan>
              )}
            </BagianForm>
            <PesanGalat pesan={galat} />
          </div>

          <div className="kgbm-pratinjau">
            <div role="tablist" aria-label="Pratinjau SK" className="kgbm-tab">
              {DAFTAR_VERSI.map((versi) => (
                <button
                  key={versi}
                  type="button"
                  role="tab"
                  id={`${idTab}-tab-${versi}`}
                  aria-selected={tab === versi}
                  aria-controls={`${idTab}-panel`}
                  tabIndex={tab === versi ? 0 : -1}
                  onClick={() => pilihTab(versi)}
                  onKeyDown={tombolTab}
                  disabled={sibuk}
                >
                  {LABEL_VERSI[versi]}
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={`${idTab}-panel`}
              aria-labelledby={`${idTab}-tab-${tab}`}
              className="kgbm-pratinjau-isi"
            >
              {memuatVersi === tab ? (
                <Memuat teks={`Membuat pratinjau ${LABEL_VERSI[tab]}...`} />
              ) : urlTab ? (
                <iframe src={urlTab} title={`Pratinjau ${LABEL_VERSI[tab]}`} />
              ) : (
                <div className="kgbm-pratinjau-kosong">
                  <p>
                    {kurangIsian
                      ? `${kurangIsian} Setelah itu muat pratinjau ${LABEL_VERSI[tab]}.`
                      : `Pratinjau ${LABEL_VERSI[tab]} belum dimuat.`}
                  </p>
                  <button
                    type="button"
                    className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil"
                    onClick={() => void muatPratinjau(tab)}
                    disabled={sibuk || !!memuatVersi}
                  >
                    Muat pratinjau
                  </button>
                </div>
              )}
            </div>
            {urlTab && (
              <div className="kgbm-baris-tombol">
                <a href={urlTab} target="_blank" rel="noopener noreferrer" className="kgbm-tautan">
                  Buka pratinjau di tab baru
                </a>
                {tab === "srikandi" && (
                  <a href={urlTab} download={namaFileSk({ nama: pegawai.nama, versi: "srikandi" })} className="kgbm-tautan">
                    Unduh Versi Srikandi
                  </a>
                )}
              </div>
            )}
            <p className="kgbm-petunjuk">
              Pratinjau menyimpan data SK terakhir, tetapi SK baru baru tercatat setelah Buat dan Unduh SK dipilih. SK
              biasa dan versi Srikandi (dengan tempat TTE) diunduh bersamaan.
            </p>
          </div>
        </div>
      )}
    </KerangkaModal>
  );
}
