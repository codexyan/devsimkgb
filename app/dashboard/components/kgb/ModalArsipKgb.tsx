"use client";

import { useState } from "react";
import { simpanArsipKgb, unggahSk } from "@/lib/kgbAksi";
import { bacaAngkaSk, bedaArsipSk } from "@/lib/cocokArsipSk";
import { formatTanggalId, isoTanggalLokal } from "@/lib/waktu";
import KerangkaModal from "./KerangkaModal";
import {
  BagianForm,
  BidangBerkasPdf,
  BidangPenetap,
  BidangTeks,
  Catatan,
  DaftarData,
  Memuat,
  PesanGalat,
} from "./BidangForm";
import {
  berkasPdfSah,
  formatMkg,
  formatRupiah,
  pesanBidangWajib,
  subjudulPegawai,
  type RingkasPegawai,
} from "./format";
import { IkonArsip } from "./ikon";
import { usePegawaiKgb } from "./usePegawaiKgb";

interface PropsModalArsipKgb {
  pegawai: RingkasPegawai & { id: string };
  onTutup: () => void;
  /** Dipanggil setelah arsip tersimpan (juga saat modal ditutup sesudah arsip tersimpan tetapi berkas gagal diunggah). */
  onBerhasil: (pesan: string) => void;
}

interface IsianArsip {
  nomorSK: string;
  tanggalSK: string;
  /** null berarti belum diubah; tampilan memakai TMT hasil perhitungan. */
  tmtSK: string | null;
  penetapSkArsip: string;
  /** Angka yang tertulis pada SK; pembanding, bukan data yang disimpan (ADR-035). */
  mkgTahunSK: string;
  mkgBulanSK: string;
  gajiPokokSK: string;
}

export default function ModalArsipKgb({ pegawai: ringkas, onTutup, onBerhasil }: PropsModalArsipKgb) {
  const { memuat, galat: galatMuat, pegawai, perhitungan, muatUlang } = usePegawaiKgb(ringkas.id);
  const [form, setForm] = useState<IsianArsip>({
    nomorSK: "",
    tanggalSK: "",
    tmtSK: null,
    penetapSkArsip: "",
    mkgTahunSK: "",
    mkgBulanSK: "",
    gajiPokokSK: "",
  });
  const [berkas, setBerkas] = useState<File | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  // Id record arsip yang sudah tersimpan: unggahan ulang tidak boleh membuat record arsip kedua.
  const [idTersimpan, setIdTersimpan] = useState<string | null>(null);

  const hasil = perhitungan?.ok ? perhitungan.hasil : null;
  const tmtHitung = hasil ? isoTanggalLokal(hasil.tmtKgbBaru) : "";
  const tmtSK = form.tmtSK ?? tmtHitung;
  const tmtBerbeda = !!hasil && !!tmtSK && tmtSK !== tmtHitung;
  const terkunci = !idTersimpan && (hasil?.isLocked ?? false);
  const isianTerkunci = sibuk || !!idTersimpan;

  // Pencocokan dengan angka yang tertulis pada SK (ADR-035). Selama belum cocok, tombol simpan mati:
  // arsip yang angkanya meleset akan mengunci angka keliru itu sebagai dasar KGB berikutnya.
  const angkaSk = bacaAngkaSk({
    mkgTahun: form.mkgTahunSK,
    mkgBulan: form.mkgBulanSK,
    gajiPokok: form.gajiPokokSK,
  });
  const angkaSkTerbaca = !!angkaSk && !!hasil;
  const bedaSk =
    angkaSk && hasil
      ? bedaArsipSk(
          { mkgTahun: hasil.mkgTahunBaru, mkgBulan: hasil.mkgBulanBaru, gajiPokok: hasil.gajiPokokBaru },
          angkaSk,
        )
      : [];

  const bisaKirim =
    !sibuk &&
    !memuat &&
    !terkunci &&
    (!!idTersimpan || (perhitungan?.ok !== false && angkaSkTerbaca && bedaSk.length === 0));

  function tutup() {
    if (sibuk) return;
    if (idTersimpan) {
      onBerhasil(
        `Arsip KGB ${ringkas.nama} tersimpan dengan status Selesai, tetapi berkas SK belum diunggah. Unggah berkas SK melalui menu Proses KGB: pilih Detail pada baris KGB ini, lalu Unggah SK TTE.`,
      );
      return;
    }
    onTutup();
  }

  async function kirim() {
    if (!bisaKirim) return;
    const kurang = pesanBidangWajib([
      ["Nomor SK", form.nomorSK],
      ["Tanggal SK", form.tanggalSK],
      ["TMT SK", tmtSK],
      ["Berkas SK", berkas?.name],
    ]);
    if (kurang) {
      setGalat(kurang);
      return;
    }
    if (!berkas || !berkasPdfSah(berkas)) {
      setGalat("Berkas SK harus berformat PDF.");
      return;
    }
    setSibuk(true);
    setGalat(null);

    let id = idTersimpan;
    if (!id) {
      const simpan = await simpanArsipKgb(ringkas.id, {
        nomorSK: form.nomorSK,
        tanggalSK: form.tanggalSK,
        tmtSK,
        penetapSkArsip: form.penetapSkArsip,
        mkgTahunSK: form.mkgTahunSK,
        mkgBulanSK: form.mkgBulanSK,
        gajiPokokSK: form.gajiPokokSK,
      });
      if (!simpan.ok) {
        setSibuk(false);
        setGalat(simpan.error);
        return;
      }
      id = simpan.data.id;
      setIdTersimpan(id);
    }

    const unggah = await unggahSk(id, berkas, { nomorSurat: form.nomorSK, tanggalSurat: form.tanggalSK });
    setSibuk(false);
    if (!unggah.ok) {
      setGalat(
        `Arsip KGB sudah tersimpan dengan status Selesai, tetapi berkas SK gagal diunggah (${unggah.error}). Pilih Simpan Arsip untuk mengulang unggahan berkas.`,
      );
      return;
    }
    onBerhasil(`Arsip KGB ${ringkas.nama} tersimpan dengan status Selesai. Jadwal KGB berikutnya sudah dibuat.`);
  }

  return (
    <KerangkaModal
      judul="Arsip KGB"
      subjudul={subjudulPegawai(ringkas)}
      ikon={<IkonArsip />}
      nada="navy"
      sibuk={sibuk}
      onTutup={tutup}
      onKirim={kirim}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={tutup} disabled={sibuk}>
            {idTersimpan ? "Tutup" : "Batal"}
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={!bisaKirim}>
            {sibuk ? "Menyimpan..." : "Simpan Arsip"}
          </button>
        </>
      }
    >
      <Catatan nada="navy">
        Catat SK KGB yang sudah terbit di luar SIM-KGB. Setelah disimpan, KGB ini langsung berstatus Selesai, gaji
        pokok dan masa kerja pegawai diperbarui, dan jadwal KGB berikutnya dibuat.
      </Catatan>
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
      {perhitungan && !perhitungan.ok && (
        <Catatan nada="merah">{perhitungan.error}. Perbaiki Data Pegawai terlebih dahulu.</Catatan>
      )}
      {pegawai && hasil && (
        <DaftarData
          judul="KGB yang Akan Tercatat"
          baris={[
            { label: "Golongan", nilai: pegawai.golonganRuang || "-" },
            { label: "TMT KGB", nilai: formatTanggalId(hasil.tmtKgbBaru) },
            { label: "Gaji pokok saat ini", nilai: formatRupiah(pegawai.gajiPokok) },
            { label: "Gaji pokok baru", nilai: formatRupiah(hasil.gajiPokokBaru), nada: "hijau" },
            { label: "Masa kerja baru", nilai: formatMkg(hasil.mkgTahunBaru, hasil.mkgBulanBaru) },
            { label: "TMT KGB berikutnya", nilai: formatTanggalId(hasil.tmtKgbBerikutnya) },
          ]}
        />
      )}
      {hasil && terkunci && (
        <Catatan nada="navy">
          Arsip KGB untuk TMT {formatTanggalId(hasil.tmtKgbBaru)} dapat dicatat mulai{" "}
          {formatTanggalId(hasil.unlockDate)}, sama dengan jendela Input KGB.
        </Catatan>
      )}
      {pegawai?.statusHukdis && (
        <Catatan nada="amber">
          Pegawai tercatat menjalani hukuman disiplin
          {pegawai.tanggalHukdisBerakhir ? ` sampai ${formatTanggalId(pegawai.tanggalHukdisBerakhir)}` : ""}. Bila
          hukuman itu menunda KGB, Arsip KGB akan ditolak.
        </Catatan>
      )}
      {idTersimpan && (
        <Catatan nada="amber">
          Data arsip sudah tersimpan dan tidak dapat diubah dari sini. Pilih berkas SK, lalu Simpan Arsip untuk
          mengunggahnya.
        </Catatan>
      )}
      <BagianForm judul="SK KGB yang Diarsipkan" keterangan="Isi sesuai dokumen SK KGB yang sudah terbit.">
        <BidangTeks
          label="Nomor SK"
          wajib
          nilai={form.nomorSK}
          onUbah={(nilai) => setForm((f) => ({ ...f, nomorSK: nilai }))}
          placeholder="Nomor sesuai dokumen SK"
          nonaktif={isianTerkunci}
          fokusAwal
        />
        <div className="kgbm-grid2">
          <BidangTeks
            label="Tanggal SK"
            jenis="date"
            wajib
            nilai={form.tanggalSK}
            onUbah={(nilai) => setForm((f) => ({ ...f, tanggalSK: nilai }))}
            nonaktif={isianTerkunci}
          />
          <BidangTeks
            label="TMT SK"
            jenis="date"
            wajib
            nilai={tmtSK}
            onUbah={(nilai) => setForm((f) => ({ ...f, tmtSK: nilai }))}
            petunjuk="Tanggal gaji pokok baru mulai berlaku menurut SK."
            nonaktif={isianTerkunci}
          />
        </div>
        {tmtBerbeda && (
          <Catatan nada="amber">
            TMT SK berbeda dengan TMT KGB menurut Data Pegawai ({formatTanggalId(hasil?.tmtKgbBaru)}). Periksa kembali
            dokumen SK atau perbarui Data Pegawai sebelum menyimpan.
          </Catatan>
        )}

        {/* Pembanding, bukan data yang disimpan: yang tersimpan tetap hitungan sistem dari tabel PP 5/2024.
            Tanpa pembanding ini, arsip yang angkanya meleset tersimpan diam-diam lalu mengunci angka keliru
            itu menjadi dasar KGB berikutnya (ADR-035). */}
        <div className="kgbm-grid2">
          <div className="kgbm-grid2">
            <BidangTeks
              label="Masa kerja pada SK (tahun)"
              wajib
              nilai={form.mkgTahunSK}
              onUbah={(nilai) => setForm((f) => ({ ...f, mkgTahunSK: nilai.replace(/\D/g, "").slice(0, 2) }))}
              placeholder="14"
              nonaktif={isianTerkunci}
            />
            <BidangTeks
              label="bulan"
              wajib
              nilai={form.mkgBulanSK}
              onUbah={(nilai) => setForm((f) => ({ ...f, mkgBulanSK: nilai.replace(/\D/g, "").slice(0, 2) }))}
              placeholder="0"
              nonaktif={isianTerkunci}
            />
          </div>
          <BidangTeks
            label="Gaji pokok pada SK"
            wajib
            nilai={form.gajiPokokSK}
            onUbah={(nilai) => setForm((f) => ({ ...f, gajiPokokSK: nilai }))}
            placeholder="3.607.500"
            petunjuk="Salin dari baris Gaji Pokok Baru pada SK."
            nonaktif={isianTerkunci}
          />
        </div>

        {bedaSk.length > 0 && (
          <Catatan nada="merah">
            <strong>Angka pada SK tidak cocok dengan hitungan sistem.</strong>
            <ul style={{ margin: "6px 0", paddingLeft: 18 }}>
              {bedaSk.map((b) => (
                <li key={b.label}>
                  {b.label} — sistem <b>{b.sistem}</b>, SK <b>{b.sk}</b>
                </li>
              ))}
            </ul>
            Biasanya masa kerja golongan atau golongan pegawai di Data Pegawai yang belum sesuai SK dasarnya.
            Perbaiki data pegawainya lebih dulu, baru arsipkan SK ini. Menyimpan sekarang akan mengunci angka
            yang keliru sebagai dasar KGB berikutnya.
          </Catatan>
        )}
        {angkaSkTerbaca && bedaSk.length === 0 && (
          <Catatan nada="hijau">Angka pada SK cocok dengan hitungan sistem.</Catatan>
        )}
        <BidangPenetap
          nilai={form.penetapSkArsip}
          onUbah={(nilai) => setForm((f) => ({ ...f, penetapSkArsip: nilai }))}
          petunjuk="Pejabat yang menetapkan SK ini. Bila diisi, menjadi penetap SK dasar pada KGB berikutnya."
          nonaktif={isianTerkunci}
        />
        <BidangBerkasPdf
          label="Berkas SK (PDF)"
          wajib
          berkas={berkas}
          onPilih={(b) => {
            setBerkas(b);
            setGalat(b && !berkasPdfSah(b) ? "Berkas SK harus berformat PDF." : null);
          }}
          petunjuk="Pindaian atau berkas digital SK dari arsip kantor, paling besar 500 KB."
          nonaktif={sibuk}
          tinggiPratinjau={220}
        />
      </BagianForm>
      <PesanGalat pesan={galat} />
    </KerangkaModal>
  );
}
