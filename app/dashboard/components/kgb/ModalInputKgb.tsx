"use client";

import { useEffect, useRef, useState } from "react";
import {
  ambilPegawaiKgb,
  ambilRiwayatKgb,
  ambilRiwayatPangkat,
  ambilRiwayatPmk,
  ambilSkDasarUsulan,
  inputKgb,
  type DataDasarSk,
  type SkDasarUsulan,
} from "@/lib/kgbAksi";
import { pernahKgb } from "@/lib/usulanPegawai";
import { SARAN_GAJI_MENYIMPANG, gajiTercatatMenyimpang, kalimatGajiMenyimpang } from "@/lib/koreksiDasarGaji";
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
  dasarDariKenaikanPangkat,
  formatMkg,
  formatRupiah,
  isianDasarKosong,
  isianDasarSk,
  pesanBidangWajib,
  selaraskanDasarPegawai,
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
  // Isian Atas Dasar yang terakhir diisi otomatis. Sumber berikutnya (riwayat, data pegawai, SK kenaikan pangkat)
  // boleh menggantinya selama operator belum menyunting; isian yang sudah disunting tidak pernah ditimpa. Penandanya
  // dipasang saat operator mengetik, bukan dibandingkan di dalam pembaru state: pembaru dijalankan dua kali di mode
  // pengembangan React, dan pembaru yang mengubah ref membuat panggilan keduanya mengira isian sudah disunting.
  const otomatis = useRef<DataDasarSk>(form);
  const disunting = useRef(false);
  const isiOtomatis = (baru: DataDasarSk) => {
    if (disunting.current) return;
    otomatis.current = baru;
    setForm(baru);
  };
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const cariDiRiwayat = dasarDariRiwayat && isianDasarKosong(isianDasarSk(dasarAwal));
  // null selama riwayat dimuat; catatan "belum tercatat" menunggu hasilnya agar tidak berkedip.
  const [dasarRiwayat, setDasarRiwayat] = useState<DasarSkAwal | null | undefined>(() => (cariDiRiwayat ? null : undefined));
  // Asal isian SK dasar bila bukan dari riwayat KGB: data pegawai (ADR-010), atau usulan UPT yang disetujui
  // sebelum SK-nya disalin ke data pegawai.
  const [skUsulan, setSkUsulan] = useState<SkDasarUsulan | null>(null);
  const [dariDataPegawai, setDariDataPegawai] = useState(false);
  // SK kenaikan pangkat/PI yang lebih baru dari SK dasar di atas, dan karena itu menjadi Atas dasar (ADR-020).
  const [dasarKp, setDasarKp] = useState<ReturnType<typeof dasarDariKenaikanPangkat>>(null);

  // Berjalan setelah SK dasar dari riwayat KGB, data pegawai, atau usulan UPT diketahui. Isian hanya diganti
  // selama belum disunting: masih kosong atau masih sama dengan SK dasar yang ditemukan.
  const dasarDiketahui = dasarRiwayat === null ? null : (dasarRiwayat ?? dasarAwal ?? undefined);
  const riwayatDimuatAwal = dasarRiwayat === null;
  useEffect(() => {
    // Menunggu data pegawai: TMT KGB terakhir dan TMT KGB yang diinput membatasi SK yang boleh menjadi dasar.
    if (dasarDiketahui === null || !pegawai) return;
    const batasKp = {
      tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
      tmtKgbBaru: perhitungan?.ok ? perhitungan.hasil.tmtKgbBaru : null,
    };
    let batal = false;
    Promise.all([ambilRiwayatPangkat(ringkas.id), ambilRiwayatPmk(ringkas.id)]).then(([hasilKp, hasilPmk]) => {
      if (batal) return;
      // SK kenaikan pangkat dan SK PMK sama-sama menetapkan gaji pokok; yang TMT-nya paling baru menang.
      const kandidat = [
        ...(hasilKp.ok ? hasilKp.data.map((r) => ({ ...r, jenis: "kp" as const })) : []),
        ...(hasilPmk.ok
          ? hasilPmk.data.map((r) => ({ jenis: "pmk" as const, nomorSK: r.nomorSK, tanggalSK: r.tanggalSK, tmtPangkat: r.tmtPmk, penetapSK: r.penetapSK }))
          : []),
      ];
      const kp = dasarDariKenaikanPangkat(dasarDiketahui, kandidat, batasKp);
      if (!kp) return;
      setDasarKp(kp);
      isiOtomatis(isianDasarSk(kp));
    });
    return () => {
      batal = true;
    };
    // dasarDiketahui berganti sekali, saat pencarian SK dasar selesai; data pegawai dimuat sekali.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dasarDiketahui === null, ringkas.id, !!pegawai]);

  useEffect(() => {
    if (!cariDiRiwayat) return;
    let batal = false;
    ambilRiwayatKgb(ringkas.id).then(async (hasilRiwayat) => {
      if (batal) return;
      let dasar = hasilRiwayat.ok ? dasarAwalDariRiwayat(hasilRiwayat.data) : null;
      if (!dasar?.nomorSK?.trim()) {
        const hasilPegawai = await ambilPegawaiKgb(ringkas.id);
        if (batal) return;
        const p = hasilPegawai.ok ? hasilPegawai.data : null;
        if (p && (p.nomorSkDasar?.trim() || p.tanggalSkDasar)) {
          setDariDataPegawai(true);
          dasar = {
            nomorSK: p.nomorSkDasar ?? null,
            tanggalSK: p.tanggalSkDasar ?? null,
            tmtSK: p.tmtKgbTerakhir,
            // Penetap jadwal Belum Diproses milik SK lain (SK KGB terbitan SIM-KGB atau SK kenaikan pangkat), jadi
            // tidak dipasangkan dengan nomor SK dasar data pegawai; kosong lebih aman daripada pejabat yang keliru.
            penetapSkDasar: p.penetapSkDasar?.trim() || null,
          };
        }
      }
      if (!dasar?.nomorSK?.trim()) {
        const hasilUsulan = await ambilSkDasarUsulan(ringkas.id);
        if (batal) return;
        const usulan = hasilUsulan.ok ? hasilUsulan.data : null;
        if (usulan) {
          setSkUsulan(usulan);
          // Usulan UPT tidak memuat pejabat penetap; penetap dari sumber lain milik SK lain.
          dasar = { nomorSK: usulan.nomorSK, tanggalSK: usulan.tanggalSK, tmtSK: usulan.tmtSK, penetapSkDasar: null };
        }
      }
      setDasarRiwayat(dasar ?? undefined);
      if (dasar) isiOtomatis(isianDasarSk(dasar));
    });
    return () => {
      batal = true;
    };
  }, [cariDiRiwayat, ringkas.id]);

  // SK dasar pada data pegawai (Ditetapkan oleh, nomor, tanggal) adalah data terbaru: salinan pada data KGB yang
  // ditolak atau pada kartu dasbor tidak ikut berubah saat SK dasar dibetulkan (ADR-056). Diselaraskan setelah
  // pencarian riwayat selesai, dan tidak dipakai bila dasarnya SK kenaikan pangkat atau PMK yang lebih baru.
  useEffect(() => {
    if (!pegawai || riwayatDimuatAwal || dasarKp) return;
    const selaras = selaraskanDasarPegawai(otomatis.current, pegawai);
    if (!selaras) return;
    isiOtomatis(selaras);
    setDariDataPegawai(true);
  }, [pegawai, riwayatDimuatAwal, dasarKp]);

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
  // Gaji pokok tercatat tercetak sebagai Gaji Pokok Lama di SK. Yang tidak sejalan dengan golongan dan masa
  // kerjanya ditandai; yang bahkan lebih besar dari gaji barunya ditahan, sebab SK-nya akan mencetak
  // penurunan gaji. Rute yang sama juga menolaknya (ADR-054).
  const gajiMenyimpang = pegawai ? gajiTercatatMenyimpang(pegawai) : null;
  const gajiTurun = !!hasil && !!pegawai?.gajiPokok && hasil.gajiPokokBaru < pegawai.gajiPokok;
  const bisaKirim = !sibuk && !memuat && !terkunci && perhitungan?.ok !== false && !gajiTurun;
  // KGB pertama berdasar SK CPNS; sesudahnya berdasar SK KGB terakhir. Masa kerja golongan 0 berarti
  // pegawai belum pernah KGB, aturan yang sama dengan formulir UPT (lib/usulanPegawai.ts).
  const kgbPertama = !!pegawai && !pernahKgb(pegawai.mkgTahun, pegawai.mkgBulan);
  const dasarPmk = dasarKp?.kp.jenis === "pmk";
  const sk = dasarPmk
    ? { nama: "SK PMK", nomor: "Nomor SK PMK", tanggal: "Tanggal SK PMK", tmt: "TMT PMK" }
    : dasarKp
    ? { nama: "SK kenaikan pangkat", nomor: "Nomor SK Kenaikan Pangkat", tanggal: "Tanggal SK Kenaikan Pangkat", tmt: "TMT Pangkat" }
    : kgbPertama
      ? { nama: "SK CPNS", nomor: "Nomor SK CPNS", tanggal: "Tanggal SK CPNS", tmt: "TMT CPNS" }
      : { nama: "SK KGB terakhir", nomor: "Nomor SK KGB Terakhir", tanggal: "Tanggal SK KGB Terakhir", tmt: "TMT SK KGB Terakhir" };

  const ubah = (kolom: keyof DataDasarSk) => (nilai: string) => {
    disunting.current = true;
    setForm((f) => ({ ...f, [kolom]: nilai }));
  };

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
      {(gajiMenyimpang || gajiTurun) && (
        <Catatan nada={gajiTurun ? "merah" : "amber"}>
          {gajiTurun && (
            <>
              <strong>Gaji pokok baru lebih kecil dari gaji pokok tercatat</strong>, sehingga SK akan mencetak penurunan
              gaji. Input KGB ditahan sampai gaji tercatatnya dibetulkan.{" "}
            </>
          )}
          {gajiMenyimpang && `${kalimatGajiMenyimpang(gajiMenyimpang)} `}
          {SARAN_GAJI_MENYIMPANG}
        </Catatan>
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
        judul={`Atas Dasar ${dasarPmk ? "SK PMK" : dasarKp ? "SK Kenaikan Pangkat" : kgbPertama ? "SK CPNS" : "SK KGB Terakhir"}`}
        keterangan={
          dasarKp
            ? "SK terbaru yang menetapkan gaji pokok pegawai, dasar KGB ini; tercetak pada bagian Atas dasar di SK KGB."
            : kgbPertama
              ? "Pegawai ini belum pernah KGB, jadi KGB pertamanya berdasar SK pengangkatan CPNS; tercetak pada bagian Atas dasar di SK KGB."
              : "SK KGB yang terakhir diterima pegawai, dasar KGB ini; tercetak pada bagian Atas dasar di SK KGB."
        }
      >
        {riwayatDimuat && <Memuat teks="Mencari SK dasar di riwayat KGB dan usulan UPT..." />}
        {dasarKp && (
          <Catatan nada={dasarKp.penetapSkDasar ? undefined : "amber"}>
            Diisi dari {dasarPmk ? "SK peninjauan masa kerja (PMK)" : "SK kenaikan pangkat"}
            {!dasarPmk && dasarKp.kp.jenisLabel ? ` (${dasarKp.kp.jenisLabel.replace(/^Pilihan: /, "")})` : ""}
            {dasarKp.kp.nomorSK ? ` nomor ${dasarKp.kp.nomorSK}` : ""}
            {dasarKp.kp.tmtPangkat ? `, TMT ${formatTanggalId(dasarKp.kp.tmtPangkat)}` : ""}, karena SK itu lebih baru dari{" "}
            {kgbPertama ? "SK CPNS" : "SK KGB terakhir"} dan menetapkan gaji pokok sekarang.
            {dasarKp.penetapSkDasar ? " Periksa kembali sebelum menyimpan." : " Pejabat penetapnya belum tercatat; isi baris Oleh."}
          </Catatan>
        )}
        {!riwayatDimuat && !dasarKp && dariDataPegawai && (
          <Catatan>Diisi dari SK dasar pada data pegawai. Periksa kembali sebelum menyimpan.</Catatan>
        )}
        {!riwayatDimuat && !dasarKp && skUsulan && (
          <Catatan nada={skUsulan.status === "disetujui" ? undefined : "amber"}>
            {skUsulan.status === "disetujui" ? (
              "Diisi dari usulan UPT yang sudah disetujui."
            ) : (
              <>
                Diisi dari usulan UPT yang{" "}
                {skUsulan.status === "revisi" ? "sedang dikembalikan untuk revisi" : "belum ditinjau Kanwil"}; datanya
                belum diperiksa. Tinjau di{" "}
                <a className="kgbm-tautan" href="/dashboard/usulan" target="_blank" rel="noopener noreferrer">
                  Usulan UPT
                </a>
                .
              </>
            )}{" "}
            Cocokkan dengan dokumennya sebelum menyimpan
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
        {!riwayatDimuat && !dasarTercatat && !dasarKp && (
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
          petunjuk={
            /\s[-./]|[-./]\s/.test(form.nomorSK)
              ? "Ada spasi di sekitar tanda pemisah, misalnya \"- 5591\". Nomor tercetak apa adanya; cocokkan dengan SK."
              : undefined
          }
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
            petunjuk={dasarPmk ? "Tanggal mulai berlaku pada SK PMK." : dasarKp ? "Tanggal mulai berlaku pangkat pada SK kenaikan pangkat." : kgbPertama ? "Tanggal mulai berlaku pengangkatan CPNS." : "Tanggal mulai berlaku SK KGB terakhir."}
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
