"use client";

import { useEffect, useState } from "react";
import { ambilRiwayatKgb, ambilSkDasarUsulan, inputKgb, type DataDasarSk, type SkDasarUsulan } from "@/lib/kgbAksi";
import { pernahKgb } from "@/lib/usulanPegawai";
import { formatTanggalId } from "@/lib/waktu";
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
  dasarAwalDariRiwayat,
  formatMkg,
  formatRupiah,
  isianDasarKosong,
  isianDasarSk,
  pesanBidangWajib,
  subjudulPegawai,
  type DasarSkAwal,
  type RingkasPegawai,
} from "./format";
import { IkonTambah } from "./ikon";
import { usePegawaiKgb } from "./usePegawaiKgb";

interface PropsModalInputKgb {
  pegawai: RingkasPegawai & { id: string };
  /** true untuk Input Ulang KGB (sesudah KGB dibatalkan). */
  ulang?: boolean;
  /** Isian awal Atas Dasar SK Terakhir, misalnya SK KGB yang terakhir selesai. */
  dasarAwal?: DasarSkAwal | null;
  /**
   * Bila true dan dasarAwal kosong, isian Atas Dasar SK Terakhir diambil dari riwayat KGB pegawai
   * (SK KGB terakhir yang selesai). Isian hanya diisi selama keempatnya masih kosong.
   */
  dasarDariRiwayat?: boolean;
  onTutup: () => void;
  onBerhasil: (pesan: string) => void;
  /** Bila diisi, modal menawarkan pindah ke Arsip KGB untuk SK yang terbit di luar SIM-KGB. */
  onArsipKgb?: () => void;
}

export default function ModalInputKgb({
  pegawai: ringkas,
  ulang = false,
  dasarAwal,
  dasarDariRiwayat = false,
  onTutup,
  onBerhasil,
  onArsipKgb,
}: PropsModalInputKgb) {
  const { memuat, galat: galatMuat, pegawai, perhitungan, muatUlang } = usePegawaiKgb(ringkas.id);
  const [form, setForm] = useState<DataDasarSk>(() => isianDasarSk(dasarAwal));
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const cariDiRiwayat = dasarDariRiwayat && isianDasarKosong(isianDasarSk(dasarAwal));
  // null selama riwayat dimuat; catatan "belum tercatat" menunggu hasilnya agar tidak berkedip.
  const [dasarRiwayat, setDasarRiwayat] = useState<DasarSkAwal | null | undefined>(() => (cariDiRiwayat ? null : undefined));
  // SK dasar yang diketik UPT pada usulan yang disetujui, dipakai bila riwayat KGB belum memuatnya.
  const [skUsulan, setSkUsulan] = useState<SkDasarUsulan | null>(null);

  useEffect(() => {
    if (!cariDiRiwayat) return;
    let batal = false;
    ambilRiwayatKgb(ringkas.id).then(async (hasilRiwayat) => {
      if (batal) return;
      let dasar = hasilRiwayat.ok ? dasarAwalDariRiwayat(hasilRiwayat.data) : null;
      if (!dasar?.nomorSK?.trim()) {
        const hasilUsulan = await ambilSkDasarUsulan(ringkas.id);
        if (batal) return;
        const usulan = hasilUsulan.ok ? hasilUsulan.data : null;
        if (usulan) {
          setSkUsulan(usulan);
          dasar = { ...dasar, nomorSK: usulan.nomorSK, tanggalSK: usulan.tanggalSK, tmtSK: usulan.tmtSK };
        }
      }
      setDasarRiwayat(dasar ?? undefined);
      if (dasar) setForm((f) => (isianDasarKosong(f) ? isianDasarSk(dasar) : f));
    });
    return () => {
      batal = true;
    };
  }, [cariDiRiwayat, ringkas.id]);

  const judul = ulang ? "Input Ulang KGB" : "Input KGB";
  const hasil = perhitungan?.ok ? perhitungan.hasil : null;
  const terkunci = hasil?.isLocked ?? false;
  const riwayatDimuat = dasarRiwayat === null;
  const dasarTercatat = !!(
    dasarAwal?.nomorSK?.trim() ||
    dasarAwal?.tanggalSK ||
    dasarRiwayat?.nomorSK?.trim() ||
    dasarRiwayat?.tanggalSK
  );
  const bisaKirim = !sibuk && !memuat && !terkunci && perhitungan?.ok !== false;
  // KGB pertama berdasar SK CPNS; sesudahnya berdasar SK KGB terakhir. Masa kerja golongan 0 berarti
  // pegawai belum pernah KGB, aturan yang sama dengan formulir UPT (lib/usulanPegawai.ts).
  const kgbPertama = !!pegawai && !pernahKgb(pegawai.mkgTahun, pegawai.mkgBulan);
  const sk = kgbPertama
    ? { nama: "SK CPNS", nomor: "Nomor SK CPNS", tanggal: "Tanggal SK CPNS", tmt: "TMT CPNS" }
    : { nama: "SK KGB terakhir", nomor: "Nomor SK KGB Terakhir", tanggal: "Tanggal SK KGB Terakhir", tmt: "TMT SK KGB Terakhir" };

  const ubah = (kolom: keyof DataDasarSk) => (nilai: string) => setForm((f) => ({ ...f, [kolom]: nilai }));

  async function kirim() {
    if (!bisaKirim) return;
    const kurang = pesanBidangWajib([
      [sk.nomor, form.nomorSK],
      [sk.tanggal, form.tanggalSK],
      [sk.tmt, form.tmtSK],
    ]);
    if (kurang) {
      setGalat(kurang);
      return;
    }
    setSibuk(true);
    setGalat(null);
    const hasilSimpan = await inputKgb(ringkas.id, {
      nomorSK: form.nomorSK.trim(),
      tanggalSK: form.tanggalSK,
      tmtSK: form.tmtSK,
      penetapSkDasar: form.penetapSkDasar.trim(),
    });
    setSibuk(false);
    if (!hasilSimpan.ok) {
      setGalat(hasilSimpan.error);
      return;
    }
    onBerhasil(`${judul} ${ringkas.nama} tersimpan dengan status Sedang Diproses. Langkah berikutnya: Buat SK.`);
  }

  return (
    <KerangkaModal
      judul={judul}
      subjudul={subjudulPegawai(ringkas)}
      ikon={<IkonTambah />}
      nada={ulang ? "merah" : "amber"}
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={kirim}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={!bisaKirim}>
            {sibuk ? "Menyimpan..." : "Simpan Input KGB"}
          </button>
        </>
      }
    >
      {memuat && <Memuat teks="Memuat data pegawai..." />}
      {galatMuat && (
        <Catatan nada="merah">
          <p>{galatMuat}</p>
          <button
            type="button"
            className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil"
            style={{ marginTop: "6px" }}
            onClick={muatUlang}
          >
            Muat ulang
          </button>
        </Catatan>
      )}
      {pegawai && (
        <DaftarData
          judul="Data Kepegawaian Saat Ini"
          baris={[
            { label: "Jabatan", nilai: pegawai.jabatan || "-" },
            { label: "Golongan", nilai: pegawai.golonganRuang || "-" },
            { label: "Masa kerja golongan", nilai: formatMkg(pegawai.mkgTahun, pegawai.mkgBulan) },
            { label: "Gaji pokok", nilai: formatRupiah(pegawai.gajiPokok) },
            { label: "TMT KGB", nilai: formatTanggalId(pegawai.tmtKgbBerikutnya) },
          ]}
        />
      )}
      {perhitungan && !perhitungan.ok && (
        <Catatan nada="merah">{perhitungan.error}. Perbaiki Data Pegawai terlebih dahulu.</Catatan>
      )}
      {hasil && (
        <DaftarData
          judul="Hasil Perhitungan KGB"
          tambahan={hasil.flagRapelan ? <LencanaRapelan /> : undefined}
          baris={[
            { label: "Masa kerja baru", nilai: formatMkg(hasil.mkgTahunBaru, hasil.mkgBulanBaru) },
            { label: "Gaji pokok baru", nilai: formatRupiah(hasil.gajiPokokBaru), nada: "hijau" },
            { label: "TMT KGB baru", nilai: formatTanggalId(hasil.tmtKgbBaru) },
            { label: "TMT KGB berikutnya", nilai: formatTanggalId(hasil.tmtKgbBerikutnya) },
            { label: "Batas input SDM", nilai: formatTanggalId(hasil.deadlineSDM) },
          ]}
        />
      )}
      {hasil && terkunci && (
        <Catatan nada="navy">
          Jendela proses KGB ini dibuka mulai {formatTanggalId(hasil.unlockDate)}. Input KGB dapat disimpan mulai
          tanggal itu.
        </Catatan>
      )}
      {hasil && !terkunci && hasil.flagRapelan && (
        <Catatan nada="amber">
          Batas input SDM ({formatTanggalId(hasil.deadlineSDM)}) sudah lewat, sehingga KGB ini berpotensi rapelan.
          Bagian keuangan menetapkan rapelan saat konfirmasi.
        </Catatan>
      )}
      {pegawai?.statusHukdis && (
        <Catatan nada="amber">
          Pegawai tercatat menjalani hukuman disiplin
          {pegawai.tanggalHukdisBerakhir ? ` sampai ${formatTanggalId(pegawai.tanggalHukdisBerakhir)}` : ""}. Bila
          hukuman itu menunda KGB, Input KGB akan ditolak.
        </Catatan>
      )}
      <BagianForm
        judul={`Atas Dasar ${kgbPertama ? "SK CPNS" : "SK KGB Terakhir"}`}
        keterangan={
          kgbPertama
            ? "Pegawai ini belum pernah KGB, jadi KGB pertamanya berdasar SK pengangkatan CPNS; tercetak pada bagian Atas dasar di SK KGB."
            : "SK KGB yang terakhir diterima pegawai, dasar KGB ini; tercetak pada bagian Atas dasar di SK KGB."
        }
      >
        {riwayatDimuat && <Memuat teks="Mencari SK dasar di riwayat KGB dan usulan UPT..." />}
        {!riwayatDimuat && skUsulan && (
          <Catatan>
            Diisi dari usulan UPT yang sudah disetujui. Cocokkan dengan dokumennya sebelum menyimpan
            {skUsulan.berkas ? (
              <>
                :{" "}
                <a
                  className="kgbm-tautan"
                  href={`/api/usulan/${encodeURIComponent(skUsulan.usulanId)}/berkas?berkas=${skUsulan.berkas}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  buka pindaian {skUsulan.berkas === "skCpns" ? "SK CPNS" : "SK KGB terakhir"}
                </a>
                .
              </>
            ) : (
              "."
            )}
          </Catatan>
        )}
        {!riwayatDimuat && !dasarTercatat && (
          <Catatan nada="amber">
            Data {sk.nama} belum tercatat di SIM-KGB. Isi sesuai dokumen {sk.nama} pegawai.
            {onArsipKgb && (
              <>
                {" "}Bila SK KGB periode ini sudah terbit di luar SIM-KGB, gunakan{" "}
                <button type="button" className="kgbm-tautan" onClick={onArsipKgb} disabled={sibuk}>
                  Arsip KGB
                </button>
                .
              </>
            )}
          </Catatan>
        )}
        <BidangTeks
          label={sk.nomor}
          wajib
          nilai={form.nomorSK}
          onUbah={ubah("nomorSK")}
          placeholder="Nomor sesuai dokumen SK"
          nonaktif={sibuk}
          fokusAwal
        />
        <div className="kgbm-grid2">
          <BidangTeks
            label={sk.tanggal}
            jenis="date"
            wajib
            nilai={form.tanggalSK}
            onUbah={ubah("tanggalSK")}
            nonaktif={sibuk}
          />
          <BidangTeks
            label={sk.tmt}
            jenis="date"
            wajib
            nilai={form.tmtSK}
            onUbah={ubah("tmtSK")}
            petunjuk={kgbPertama ? "Tanggal mulai berlaku pengangkatan CPNS." : "Tanggal mulai berlaku SK KGB terakhir."}
            nonaktif={sibuk}
          />
        </div>
        <BidangPenetap
          nilai={form.penetapSkDasar}
          onUbah={ubah("penetapSkDasar")}
          petunjuk={`Pejabat yang menetapkan ${sk.nama}; tercetak pada baris Oleh di surat KGB.`}
          nonaktif={sibuk}
        />
      </BagianForm>
      <PesanGalat pesan={galat} />
    </KerangkaModal>
  );
}
