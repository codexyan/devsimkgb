"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDashUser } from "@/app/dashboard/components/RoleContext";
import { PanelNavy, namaSapaan, sapaanWita, tanggalPanjangWita, type Nada } from "@/app/dashboard/components/PanelNavy";
import { formatTanggalId, hariIniWita, tanggalKalender } from "@/lib/waktu";
import { hitungDeadlineSDM } from "@/lib/tabelGaji";
import { kunciBulanTmt, type RekapStatusKgb } from "@/lib/rekapKgb";
import { geserBulan, namaBulan, namaTampilSatker, namaUnitKerja } from "@/app/dashboard/satker/labelSatker";
import { LABEL_KONFIRMASI_UPT, type StatusKonfirmasiUpt } from "@/lib/konfirmasiUpt";
import { BELUM_SELESAI, LABEL_JENIS_USULAN } from "@/lib/usulanPegawai";
import { kunciNomorSk } from "@/lib/nomorSurat";
import { TUGAS_UPT, daftarTugasUpt } from "@/lib/tugasUpt";
import { kartuPerKolom, type KolomUpt, type SumberKartu } from "@/lib/papanUpt";
import FormulirUsulan, { type DrafUsulanUpt, type PegawaiUntukUsulan } from "@/app/dashboard/components/upt/FormulirUsulan";
import ModalDasarBaru from "@/app/dashboard/components/upt/ModalDasarBaru";
import ModalLaporMutasi from "@/app/dashboard/components/upt/ModalLaporMutasi";
import MenuTindakan from "@/app/dashboard/components/MenuTindakan";
import type { JenisMutasi } from "@/lib/mutasiPegawai";
import { KIRIM_SURAT_BATAS } from "@/lib/batasInputSdm";
import { KerangkaModal, Catatan, ModalPratinjauBerkas, PesanGalat } from "@/app/dashboard/components/kgb";
import type { Satker } from "@/lib/satker";
import type { DasarKgbBerikutnya } from "@/lib/dasarKgbBerikutnya";
import PengingatUsulan from "@/app/dashboard/components/upt/PengingatUsulan";

/** Satu baris "Dasar KGB berikutnya": SK yang gaji pokoknya dipakai SK KGB berikutnya (ADR-030). */
function teksDasarKgb(dasar: DasarKgbBerikutnya | null | undefined): string | null {
  if (!dasar) return null;
  return [dasar.label, dasar.nomorSK, dasar.tanggalSK ? fmtTgl(dasar.tanggalSK) : null].filter(Boolean).join(" · ");
}

/* Dashboard Admin UPT: satu halaman berisi jadwal pengiriman surat usulan, daftar pegawai satker dengan status
   KGB-nya di Kanwil, dan SK yang sudah selesai untuk diunduh. Seluruh datanya dari /api/upt, yang membatasi
   isinya ke satker akun. UPT mengusulkan data, melaporkan mutasi, dan menandai SK yang sudah direkam di Gaji
   Web; data induk tetap diubah Kanwil. Hukuman disiplin hanya tampil sebagai "KGB ditunda". */

interface PegawaiUpt {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  golonganRuang: string;
  gajiPokok: number;
  tmtKgb: string | null;
  bulanTmt: string | null;
  deadlineSDM: string | null;
  terkunci: boolean;
  statusKGB: string | null;
  terlambat: boolean;
  kgbDitunda: boolean;
  konfirmasi: StatusKonfirmasiUpt;
  konfirmasiAt: string | null;
  konfirmasiOleh: string | null;
  /**
   * Satker tempat pegawai ini sedang bertugas sebagai BKO; kosong berarti bertugas di satkernya sendiri.
   * BKO tidak memindahkan unit kerja, jadi KGB-nya tetap diusulkan dan direkam satker asal; satker yang
   * membuka layar ini. Karena itu ia keterangan, bukan tugas (ADR-041).
   */
  satkerTugas?: string | null;
  /** Pengingat pemeriksaan masih berlaku: KGB belum diinput Kanwil dan batas inputnya belum lewat. */
  perluDiperiksa: boolean;
  /** "draf", "menunggu", atau "revisi" bila ada usulan berjalan. */
  usulanBerjalan?: string | null;
  /** SK yang menjadi dasar KGB berikutnya (ADR-030); null bila belum ada SK yang tercatat. */
  dasarKgb?: DasarKgbBerikutnya | null;
  /** SK dasar pada usulan UPT yang belum selesai; menjadi dasar setelah disetujui Kanwil (ADR-057). */
  skDiUsulan?: { status: string; nomorSK: string | null; tanggalSK: string | null; berkas: boolean } | null;
  dataSekarang: Record<string, string>;
  /** SK dasar dan berkas yang sudah disetujui Kanwil; terbawa ke usulan perbaikan berikutnya. */
  bawaan?: PegawaiUntukUsulan["bawaan"];
}

/**
 * Usulan yang masih dipegang UPT dan boleh disunting: draf yang belum pernah dikirim, dan usulan yang
 * dikembalikan Kanwil untuk diperbaiki. Keduanya muncul di panel yang sama dan berangkat lewat satu surat.
 */
const dipegangUpt = (status: string) => status === "draf" || status === "revisi";

/**
 * Kalimat dialog penghapusan menurut status usulannya. Ketiganya menghapus baris yang sama, tetapi
 * akibatnya berbeda di mata UPT: draf belum pernah dilihat siapa pun, usulan terkirim sedang ditunggu
 * Kanwil, dan yang dikembalikan justru sedang ditunggu perbaikannya.
 */
function salinanHapusUsulan(status: string) {
  if (status === "draf")
    return {
      judul: "Hapus data yang disiapkan",
      tombol: "Hapus data",
      peringatan:
        "Data yang sudah diketik beserta berkas yang diunggah hilang dan tidak dapat dikembalikan. Kanwil belum pernah melihat data ini.",
    };
  if (status === "revisi")
    return {
      judul: "Hapus usulan yang dikembalikan",
      tombol: "Hapus usulan",
      peringatan:
        "Usulan ini beserta berkasnya hilang dan tidak dapat dikembalikan. Hapus hanya bila Kanwil memang meminta demikian; bila datanya cuma perlu diralat, tekan Perbaiki agar isinya tidak perlu diketik ulang.",
    };
  return {
    judul: "Batalkan usulan",
    tombol: "Batalkan usulan",
    peringatan:
      "Usulan ini beserta berkas yang sudah diunggah dihapus dan tidak lagi masuk antrian tinjauan Kanwil. Isinya tidak dapat dikembalikan; bila datanya keliru, kirim usulan baru setelah diperbaiki.",
  };
}

/** Satu baris pada daftar usulan UPT: draf yang masih disiapkan maupun usulan yang sudah dikirim. */
interface UsulanTerkirim extends DrafUsulanUpt {
  pegawaiId: string | null;
  status: string;
  nomorSurat: string | null;
  tanggalSurat: string | null;
  hukdisAda: boolean;
  /** Kolom yang diusulkan berubah; null setelah ditinjau Kanwil. */
  jumlahPerubahan: number | null;
  /** Yang masih kurang sebelum draf ini boleh diajukan; selalu kosong untuk usulan yang sudah dikirim. */
  kekurangan: string[];
  diajukanAt: string | null;
  ditinjauAt: string | null;
  ditinjauOleh: string | null;
  alasanTolak: string | null;
}

/** Satu laporan mutasi atau pemberhentian yang dikirim satker ini (lib/laporanMutasi.ts). */
interface LaporanUpt {
  id: string;
  pegawaiId: string;
  nama: string;
  nip: string;
  label: string;
  satkerTujuan: string | null;
  tmt: string | null;
  nomorSK: string | null;
  alasan: string | null;
  status: string;
  catatanKanwil: string | null;
  ditinjauOleh: string | null;
}

interface SkUpt {
  id: string;
  pegawaiId: string;
  nama: string;
  nip: string;
  tmtKgbBaru: string | null;
  golonganBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  nomorSurat: string | null;
  tanggalSurat: string | null;
  /** "menunggu_keuangan" (baru diunggah Tim SDM, menunggu keuangan UPT) atau "selesai". */
  status: string;
  /** Waktu SK bertanda tangan diunggah Tim SDM Kanwil. */
  diunggahAt: string | null;
  konfirmasiKeuanganAt: string | null;
  /** Batas input Kanwil terlewat; keputusan rapelannya diambil keuangan UPT. */
  potensiRapelan: boolean;
  rapelan: boolean;
  berkasAda: boolean;
  /** Penanda KGB sudah direkam di Gaji Web satker oleh operator gaji UPT. */
  gajiWebAt: string | null;
  gajiWebOleh: string | null;
}

interface DataUpt {
  satker: Satker;
  pegawaiAktif: number;
  kgbDitunda: number;
  tahunIni: RekapStatusKgb | null;
  terlambat: number;
  mendatang: { bulanTmt: string; jumlah: number }[];
  pegawai: PegawaiUpt[];
  sk: SkUpt[];
}

type Saring = "semua" | "usulkan" | "proses" | "selesai";

const fmtRp = (n: number | null | undefined) => (typeof n === "number" ? "Rp " + n.toLocaleString("id-ID") : "-");
const fmtTgl = (s: string | null | undefined) => (s ? formatTanggalId(s, { day: "numeric", month: "short", year: "numeric" }) : "-");

/** Bulan TMT yang suratnya dikirim bulan ini: surat UPT dikirim pada bulan ketiga sebelum TMT. */
function bulanUsulanSekarang(hariIni: Date): string {
  // Surat usulan dikirim tanggal 1 sampai 10 bulan kedua sebelum TMT, bulan yang sama dengan dibukanya
  // input di SIM-KGB, sehingga TMT yang diusulkan bulan ini adalah TMT dua bulan ke depan.
  return geserBulan(kunciBulanTmt(hariIni) ?? "", 2);
}

/** Keadaan KGB satu pegawai dari kacamata UPT. */
function keadaan(p: PegawaiUpt): { teks: string; nada?: Nada } {
  if (p.statusKGB === "selesai") return { teks: "Selesai", nada: "hijau" };
  // Sejak SK diunggah Tim SDM, keuangan UPT sendiri yang menindaklanjutinya (ADR-009).
  if (p.statusKGB === "menunggu_keuangan") return { teks: "SK terbit, rekam di Gaji Web", nada: "hijau" };
  if (p.statusKGB === "sedang_diproses") return { teks: "Sedang diproses Kanwil", nada: "navy" };
  if (p.terkunci) return { teks: "Belum masuk jadwal" };
  if (p.terlambat) return { teks: "Lewat batas input Kanwil", nada: "merah" };
  return { teks: "Menunggu diproses Kanwil", nada: "kuning" };
}

/** Satu dokumen di papan beserta cara menggambarnya; penggabungan per pegawai di lib/papanUpt.ts. */
interface SumberPapan extends SumberKartu {
  /** Nama pegawai; dipakai pencarian di Perlu dikerjakan (ADR-060). */
  nama: string;
  /** Id usulan bila kartu ini draf lengkap yang dapat dicentang untuk diajukan. */
  pilihSiap?: string | null;
  render: (lain: string[]) => React.ReactNode;
}

/** Kolom papan alur KGB dari kacamata UPT. */
const KOLOM_UPT: { k: KolomUpt; judul: string; ket: string; nada: Nada }[] = [
  { k: "kerja", judul: "Perlu dikerjakan", ket: "Menunggu tindakan UPT", nada: "kuning" },
  { k: "kanwil", judul: "Di Kanwil", ket: "Ditinjau atau diproses Kanwil", nada: "biru" },
  { k: "sk", judul: "SK terbit", ket: "Unduh, lalu rekam di Gaji Web", nada: "hijau" },
  // "Selesai" hanya berarti KGB-nya sudah direkam di Gaji Web satker, langkah terakhir yang memang
  // dipegang Admin UPT. Usulan data yang ditinjau Kanwil tidak masuk sini (lihat sumberPapan).
  { k: "selesai", judul: "Selesai", ket: "Sudah direkam di Gaji Web", nada: "hijau" },
];

const KOSONG_UPT: Record<KolomUpt, string> = {
  kerja: "Tidak ada yang perlu dikerjakan. Pegawai baru ditambahkan dari Data Pegawai.",
  kunci: "",
  kanwil: "Tidak ada yang sedang di Kanwil.",
  sk: "Belum ada SK baru yang perlu direkam.",
  selesai: "Belum ada KGB yang direkam di Gaji Web.",
};

/** Satu kartu di papan: nama, satu baris keterangan, satu label, catatan pendek, dan tombol. */
function KartuUpt({
  nama,
  sub,
  nada,
  tanda,
  catatan,
  petunjuk,
  pilih,
  aksi,
  lain,
  terkunci,
}: {
  nama: string;
  sub: string;
  nada?: Nada;
  /** Draf yang masa usul KGB-nya belum dibuka; tampil redup di kelompok terlipat (ADR-059). */
  terkunci?: boolean;
  tanda?: { teks: string; nada?: Nada };
  catatan?: string | null;
  /** Kalimat langkah berikutnya; ditampilkan sebagai keterangan saat kartu disorot, bukan teks tetap. */
  petunjuk?: string;
  pilih?: React.ReactNode;
  aksi?: React.ReactNode;
  /** Dokumen lain milik pegawai yang sama, supaya satu orang tetap satu kartu (lib/papanUpt.ts). */
  lain?: string[];
}) {
  return (
    <article
      className="dsb-kartu-kgb upt-kartu"
      data-nada={nada}
      data-terkunci={terkunci ? "" : undefined}
      title={petunjuk}
      aria-label={nama}
    >
      <p className="dsb-kartu-kepala">
        {pilih}
        <span className="dsb-nama truncate">{nama}</span>
      </p>
      <p className="dsb-kecil truncate" style={{ margin: 0 }} title={sub}>{sub}</p>
      {tanda && (
        <p className="dsb-kartu-tanda">
          <span className="dsb-tag" data-garis="" data-nada={tanda.nada}>{tanda.teks}</span>
        </p>
      )}
      {catatan && <p className="upt-kartu-catatan">{catatan}</p>}
      {lain && lain.length > 0 && (
        <p className="upt-kartu-lain">Juga: {lain.join(" · ")}</p>
      )}
      {aksi && <div className="dsb-kartu-aksi">{aksi}</div>}
    </article>
  );
}

/**
 * Dasbor Admin UPT. Satu komponen melayani dua halaman agar keadaan dan dialognya (formulir usulan,
 * konfirmasi, laporan mutasi, unggah daftar) tidak terduplikasi:
 *   - "dasbor": ringkasan, Perlu dikerjakan, SK terbit, usulan terkirim, dan jadwal;
 *   - "pegawai": modul Data Pegawai, berisi tabel Pegawai dan KGB selebar halaman.
 */
export default function DashboardUpt({ halaman = "dasbor" }: { halaman?: "dasbor" | "pegawai" } = {}) {
  const dashUser = useDashUser();
  const [hariIni] = useState(() => hariIniWita());
  const [data, setData] = useState<DataUpt | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [segar, setSegar] = useState<Date | null>(null);
  const [saring, setSaring] = useState<Saring>("semua");
  const [cari, setCari] = useState("");

  function muat() {
    setMemuat(true);
    fetch("/api/upt")
      .then(async (r) => {
        const d = (await r.json()) as DataUpt & { error?: string };
        if (!r.ok) throw new Error(d.error ?? "Data gagal dimuat");
        setData(d);
        setGalat(null);
        setSegar(new Date());
      })
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : "Data gagal dimuat"))
      .finally(() => setMemuat(false));
  }

  useEffect(() => {
    const t = setTimeout(muat, 0);
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") muat();
    }, 120_000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);

  const [kabar, setKabar] = useState<string | null>(null);

  // Data pegawai UPT disiapkan dulu sebagai draf, baru diajukan: satu surat usulan lazimnya memuat
  // beberapa pegawai, dan datanya dilengkapi bertahap dari SK yang tidak selalu ada di meja.
  const [formulir, setFormulir] = useState<
    { jenis: "perubahan" | "baru"; pegawai: PegawaiUntukUsulan | null; draf: DrafUsulanUpt | null } | null
  >(null);
  /* Kartu tersendiri untuk SK yang mengubah golongan atau masa kerja golongan (ADR-045). */
  const [dasarBaru, setDasarBaru] = useState<{
    jenis: "kp" | "pmk";
    pegawai: PegawaiUntukUsulan;
    draf: DrafUsulanUpt | null;
  } | null>(null);
  const [usulan, setUsulan] = useState<UsulanTerkirim[]>([]);
  /** Laporan mutasi satker ini beserta hasil tinjauan Kanwil. */
  const [laporan, setLaporan] = useState<LaporanUpt[]>([]);
  /** Jendela laporan mutasi; `jenisAwal` terisi bila dibuka lewat pintasan pembatalan pencatatan. */
  const [laporMutasi, setLaporMutasi] = useState<{ pegawai: PegawaiUpt; jenisAwal?: JenisMutasi } | null>(null);
  /** Kartu pita jadwal yang sedang dibuka: satu bulan TMT, atau kumpulan yang terlambat. */
  const [dialogPeriode, setDialogPeriode] = useState<
    { jenis: "bulan"; bulanTmt: string } | { jenis: "terlambat" } | null
  >(null);
  const [pilihAjukan, setPilihAjukan] = useState<Set<string>>(() => new Set());
  const [cariKerja, setCariKerja] = useState("");
  const [dialogAjukan, setDialogAjukan] = useState(false);
  /** Unggahan massal: satu berkas menjadi banyak draf sekaligus. */
  const [suratAjukan, setSuratAjukan] = useState({ nomorSurat: "", tanggalSurat: "" });
  const [berkasAjukan, setBerkasAjukan] = useState<File | null>(null);
  const [mengajukan, setMengajukan] = useState(false);
  const [galatAjukan, setGalatAjukan] = useState<string | null>(null);
  /** Berkas usulan yang sedang dibuka; UPT dapat memastikan yang terkirim memang benar. */
  const [pratinjau, setPratinjau] = useState<{ judul: string; subjudul: string; url: string } | null>(null);
  // Kolom Selesai diciutkan sejak awal: isinya tidak menuntut tindakan.
  const [ciutPapan, setCiutPapan] = useState<Set<KolomUpt>>(() => new Set<KolomUpt>(["selesai"]));
  function alihCiut(k: KolomUpt) {
    setCiutPapan((lama) => {
      const baru = new Set(lama);
      if (baru.has(k)) baru.delete(k);
      else baru.add(k);
      return baru;
    });
  }

  const muatUsulan = useCallback(async () => {
    const res = await fetch("/api/upt/usulan");
    const d: unknown = res.ok ? await res.json().catch(() => []) : [];
    if (Array.isArray(d)) setUsulan(d as UsulanTerkirim[]);
    const resMutasi = await fetch("/api/upt/mutasi");
    const m: unknown = resMutasi.ok ? await resMutasi.json().catch(() => []) : [];
    if (Array.isArray(m)) setLaporan(m as LaporanUpt[]);
  }, []);

  /** Batalkan laporan yang belum ditetapkan Kanwil. */
  async function batalkanLaporan(l: LaporanUpt) {
    const res = await fetch(`/api/upt/mutasi/${l.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setGalat(d.error ?? "Laporan gagal dibatalkan");
      return;
    }
    setKabar(`Laporan ${l.label.toLowerCase()} ${l.nama} dibatalkan.`);
    setTimeout(() => setKabar(null), 6000);
    void muatUsulan();
  }

  useEffect(() => {
    const t = setTimeout(() => void muatUsulan(), 0);
    return () => clearTimeout(t);
  }, [muatUsulan]);

  /** Usulan pegawai ini yang masih di tangan UPT, bila ada: draf, atau yang dikembalikan Kanwil. */
  function drafPegawai(pegawaiId: string): UsulanTerkirim | null {
    return usulan.find((u) => dipegangUpt(u.status) && u.pegawaiId === pegawaiId) ?? null;
  }

  function bukaUsulan(p: PegawaiUpt) {
    setFormulir({
      jenis: "perubahan",
      pegawai: { id: p.id, nama: p.nama, nip: p.nip, dataSekarang: p.dataSekarang, bawaan: p.bawaan, dasarKgb: p.dasarKgb },
      draf: drafPegawai(p.id),
    });
  }

  /**
   * Kartu SK tersendiri: satu SK, satu jendela. Jalurnya tetap usulan perbaikan yang sama; Kanwil yang
   * mencatat riwayat KP atau PMK saat menyetujui (ADR-030), hanya isiannya dibatasi pada apa yang
   * tertulis di SK itu, lengkap dengan pindaiannya.
   */
  function bukaDasarBaru(p: PegawaiUpt, jenis: "kp" | "pmk") {
    setDasarBaru({
      jenis,
      pegawai: { id: p.id, nama: p.nama, nip: p.nip, dataSekarang: p.dataSekarang, bawaan: p.bawaan },
      draf: drafPegawai(p.id),
    });
  }

  function bukaPegawaiBaru() {
    setFormulir({ jenis: "baru", pegawai: null, draf: null });
  }

  function lanjutkanDraf(u: UsulanTerkirim) {
    const p = (data?.pegawai ?? []).find((x) => x.id === u.pegawaiId) ?? null;
    setFormulir({
      jenis: u.jenis === "baru" ? "baru" : "perubahan",
      pegawai: p ? { id: p.id, nama: p.nama, nip: p.nip, dataSekarang: p.dataSekarang, bawaan: p.bawaan, dasarKgb: p.dasarKgb } : null,
      draf: u,
    });
  }

  function selesaiFormulir(pesan: string) {
    setFormulir(null);
    setKabar(pesan);
    setTimeout(() => setKabar(null), 7000);
    void muatUsulan();
    // Data pegawai ikut dimuat ulang: penanda usulan berjalan berubah begitu draf tersimpan.
    muat();
  }

  function pilihDraf(id: string) {
    setPilihAjukan((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  }

  /**
   * Buka dialog pengiriman, dengan surat yang lama sudah terisi bila memang ada.
   *
   * Usulan yang dikembalikan Kanwil sudah pernah berangkat dengan satu surat, dan surat itulah yang
   * dipakai lagi: satu salah ketik tidak sepatutnya menuntut nomor surat baru dari arsiparis. Nomornya
   * tetap boleh diubah, dan hanya diisikan bila seluruh yang dipilih memang berasal dari surat yang sama.
   */
  function bukaDialogAjukan() {
    setGalatAjukan(null);
    const terpilih = draf.filter((u) => pilihAjukan.has(u.id));
    const nomor = [...new Set(terpilih.map((u) => u.surat?.nomorSurat?.trim()).filter((n): n is string => !!n))];
    if (nomor.length === 1) {
      const asal = terpilih.find((u) => u.surat?.nomorSurat?.trim() === nomor[0]);
      setSuratAjukan({ nomorSurat: nomor[0], tanggalSurat: asal?.surat?.tanggalSurat ?? "" });
    }
    setDialogAjukan(true);
  }

  /** Kirim draf terpilih ke Kanwil dengan satu surat usulan untuk semuanya. */
  async function ajukanTerpilih() {
    setMengajukan(true);
    setGalatAjukan(null);
    try {
      const form = new FormData();
      for (const id of pilihAjukan) form.append("id", id);
      form.set("nomorSurat", suratAjukan.nomorSurat);
      form.set("tanggalSurat", suratAjukan.tanggalSurat);
      if (berkasAjukan) form.set("berkas", berkasAjukan);

      const res = await fetch("/api/upt/usulan/ajukan", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string; jumlah?: number };
      if (!res.ok) {
        setGalatAjukan(d.error ?? "Usulan gagal dikirim");
        return;
      }
      setKabar(`${d.jumlah ?? 0} pegawai diusulkan ke Kanwil dengan surat ${suratAjukan.nomorSurat}.`);
      setTimeout(() => setKabar(null), 7000);
      setDialogAjukan(false);
      setPilihAjukan(new Set());
      setSuratAjukan({ nomorSurat: "", tanggalSurat: "" });
      setBerkasAjukan(null);
      void muatUsulan();
    } catch {
      setGalatAjukan("Usulan gagal dikirim");
    } finally {
      setMengajukan(false);
    }
  }

  /**
   * Usulan yang telanjur salah dibatalkan, bukan disunting di tempat: Kanwil tidak boleh menerima dua
   * versi usulan untuk pegawai yang sama. Hanya usulan yang belum ditinjau yang bisa ditarik kembali.
   */
  const [dialogBatal, setDialogBatal] = useState<UsulanTerkirim | null>(null);
  const [membatalkan, setMembatalkan] = useState(false);

  async function batalkanUsulan() {
    if (!dialogBatal) return;
    setMembatalkan(true);
    try {
      const res = await fetch(`/api/upt/usulan/${dialogBatal.id}`, { method: "DELETE" });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Usulan gagal dibatalkan");
        return;
      }
      setKabar(
        dialogBatal.status === "draf"
          ? `Data ${dialogBatal.nama} yang disiapkan sudah dihapus.`
          : dialogBatal.status === "revisi"
            ? `Usulan ${dialogBatal.nama} yang dikembalikan Kanwil sudah dihapus.`
            : `Usulan ${dialogBatal.nama} dibatalkan. Kirim ulang setelah datanya diperbaiki.`,
      );
      setTimeout(() => setKabar(null), 6000);
      setDialogBatal(null);
      void muatUsulan();
    } catch {
      setGalat("Usulan gagal dibatalkan");
    } finally {
      setMembatalkan(false);
    }
  }

  const [menandaiGajiWeb, setMenandaiGajiWeb] = useState<string | null>(null);

  // Dialog konfirmasi keuangan UPT: keputusan rapelan lalu rekam Gaji Web.
  const [dialogGajiWeb, setDialogGajiWeb] = useState<{ sk: SkUpt; rapelan: boolean } | null>(null);
  const [galatGajiWeb, setGalatGajiWeb] = useState<string | null>(null);

  /**
   * Keuangan UPT menetapkan rapelan dan merekam KGB di Gaji Web satkernya sendiri (ADR-009). Untuk SK yang
   * masih menunggu keuangan, langkah ini sekaligus konfirmasi keuangan: gaji pokok, masa kerja, dan jadwal
   * KGB berikutnya pegawai diperbarui. SK lama yang sudah dikonfirmasi keuangan Kanwil cukup ditandai.
   */
  async function tandaiGajiWeb() {
    if (!dialogGajiWeb) return;
    const { sk, rapelan } = dialogGajiWeb;
    setMenandaiGajiWeb(sk.id);
    setGalatGajiWeb(null);
    try {
      const res = await fetch("/api/upt/gaji-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sk.status === "menunggu_keuangan" ? { kgbId: sk.id, isRapelan: rapelan } : { kgbId: sk.id }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalatGajiWeb(d.error ?? "Penandaan Gaji Web gagal disimpan");
        return;
      }
      setDialogGajiWeb(null);
      setKabar(`KGB ${sk.nama} dikonfirmasi dan ditandai sudah direkam di Gaji Web satker.`);
      setTimeout(() => setKabar(null), 5000);
      muat();
    } catch {
      setGalatGajiWeb("Penandaan Gaji Web gagal disimpan");
    } finally {
      setMenandaiGajiWeb(null);
    }
  }

  const bulanUsulan = bulanUsulanSekarang(hariIni);
  const pegawai = useMemo(() => data?.pegawai ?? [], [data]);
  /** Data yang masih di tangan UPT: draf yang belum dikirim, dan yang dikembalikan Kanwil. */
  const draf = usulan.filter((u) => dipegangUpt(u.status));
  const terkirim = usulan.filter((u) => !dipegangUpt(u.status));

  /**
   * Satu daftar kerja untuk menggantikan empat panel yang dulu terpisah: tiap pegawai muncul sekali,
   * dengan satu langkah berikutnya yang jelas (lib/tugasUpt.ts). Yang sedang ditinjau Kanwil tidak
   * masuk, sebab UPT tidak dapat berbuat apa pun atasnya.
   */
  const tugas = useMemo(
    () =>
      daftarTugasUpt(
        usulan.map((u) => ({
          id: u.id, pegawaiId: u.pegawaiId, status: u.status, jenis: u.jenis,
          nama: u.nama, nip: u.nip, kekurangan: u.kekurangan, alasanTolak: u.alasanTolak,
        })),
        pegawai.map((p) => ({
          id: p.id, nama: p.nama, nip: p.nip, tmtKgb: p.tmtKgb, bulanTmt: p.bulanTmt,
          // Draf atau usulan yang baru disimpan di peramban ini sudah menggantikan tugas pemeriksaannya,
          // walau data pegawai dari server belum sempat dimuat ulang.
          usulanBerjalan:
            p.usulanBerjalan ??
            (usulan.some((u) => u.pegawaiId === p.id && BELUM_SELESAI.includes(u.status)) ? "draf" : null),
          perluDiperiksa: p.perluDiperiksa,
          batasInput: p.deadlineSDM,
        })),
        bulanUsulan,
      ),
    [usulan, pegawai, bulanUsulan],
  );
  /** Laporan mutasi pegawai ini yang belum ditetapkan Kanwil; selama ada, laporan kedua tidak ditawarkan. */
  const laporanBerjalan = (pegawaiId: string) =>
    laporan.find((l) => l.pegawaiId === pegawaiId && l.status !== "diterima") ?? null;
  const usulanById = (id: string | null) => (id ? usulan.find((u) => u.id === id) ?? null : null);
  const pegawaiById = (id: string | null) => (id ? pegawai.find((p) => p.id === id) ?? null : null);
  const perluDiusulkan = pegawai.filter((p) => p.bulanTmt === bulanUsulan);
  /**
   * KGB yang jendela kirimnya sudah terlewat namun belum selesai: TMT-nya sebelum bulan usulan berjalan.
   * Pita jadwal hanya melihat ke depan, sehingga tanpa daftar ini satker yang tertinggal tidak melihat
   * tanda apa pun di dashboardnya, dan angka "Selesai TMT tahun ini" yang timpang tidak dapat ditelusuri.
   */
  const tertinggal = pegawai.filter((p) => p.bulanTmt && p.bulanTmt < bulanUsulan && p.statusKGB !== "selesai");
  /**
   * Pegawai jatuh tempo periode ini yang belum masuk surat usulan: tidak ada usulan yang sedang ditinjau atau
   * sudah diajukan sejak awal bulan ini, dan Kanwil belum memproses KGB-nya. Dasar pengingat periode (ADR-029).
   */
  const awalBulanIni = new Date(hariIni.getFullYear(), hariIni.getMonth(), 1).getTime();
  const belumDiajukan = perluDiusulkan.filter(
    (p) =>
      p.usulanBerjalan !== "menunggu" &&
      !["sedang_diproses", "menunggu_keuangan", "selesai"].includes(p.statusKGB ?? "") &&
      !usulan.some(
        (u) => u.pegawaiId === p.id && !dipegangUpt(u.status) && !!u.diajukanAt && new Date(u.diajukanAt).getTime() >= awalBulanIni,
      ),
  );
  // SK yang sudah diunggah (menunggu keuangan) pindah ke kolom SK terbit, jadi tidak lagi dihitung di Kanwil.
  const sedangDiproses = pegawai.filter((p) => p.statusKGB === "sedang_diproses");

  const q = cari.trim().toLowerCase();
  const tampil = useMemo(
    () =>
      pegawai.filter((p) => {
        if (saring === "usulkan" && p.bulanTmt !== bulanUsulan) return false;
        if (saring === "proses" && !(p.statusKGB === "sedang_diproses" || p.statusKGB === "menunggu_keuangan")) return false;
        if (saring === "selesai" && p.statusKGB !== "selesai") return false;
        return !q || p.nama.toLowerCase().includes(q) || p.nip.includes(q) || p.jabatan.toLowerCase().includes(q);
      }),
    [pegawai, saring, q, bulanUsulan],
  );
  const jumlah = (s: Saring) =>
    s === "semua" ? pegawai.length
    : s === "usulkan" ? perluDiusulkan.length
    : s === "proses" ? sedangDiproses.length
    : pegawai.filter((p) => p.statusKGB === "selesai").length;

  const skSelesai = data?.sk ?? [];
  const nama = namaSapaan(dashUser.nama, "Admin UPT");
  const tahunIni = data?.tahunIni;
  const pctSelesai = tahunIni && tahunIni.total > 0 ? Math.round((tahunIni.selesai / tahunIni.total) * 100) : 0;

  if (galat && !data) {
    return (
      <div className="dsb-halaman">
        <div className="dsb-panel dsb-kosong" style={{ padding: "56px 20px" }} role="alert">
          <p className="dsb-nama" style={{ margin: 0 }}>Dashboard tidak dapat dibuka</p>
          <p style={{ margin: 0 }}>{galat}</p>
          <button type="button" className="dsb-tombol" onClick={muat}>Coba lagi</button>
        </div>
      </div>
    );
  }

  // Modul Data Pegawai: tabel pegawai satker beserta status KGB-nya di Kanwil.
  const panelPegawai = (
        <section className="dsb-panel dsb-antrian dsb-penuh overflow-hidden dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="judul-pegawai-upt">
          <div className="dsb-panel-kepala">
            <h2 id="judul-pegawai-upt" className="dsb-panel-judul">
              Pegawai dan KGB <small>{tampil.length} dari {pegawai.length}</small>
            </h2>
          </div>
          <div className="dsb-alat" style={{ padding: "10px 16px", borderBottom: "1px solid var(--ln2)" }}>
            <div className="dsb-segmen" role="group" aria-label="Saring pegawai">
              {([
                ["semua", "Semua"],
                ["usulkan", `Diusulkan ${namaBulan(bulanUsulan)}`],
                ["proses", "Diproses Kanwil"],
                ["selesai", "Selesai"],
              ] as [Saring, string][]).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={saring === v} onClick={() => setSaring(v)}>
                  {l} {data && <span style={{ color: "var(--dt5)" }}>{jumlah(v)}</span>}
                </button>
              ))}
            </div>
            {/* Satu-satunya tempat menambah pegawai: pegawai baru tersimpan sebagai draf di Perlu dikerjakan. */}
            <span className="upt-deret" style={{ marginLeft: "auto" }}>
              <Link href="/dashboard/upt/kolektif" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" title="Siapkan banyak pegawai untuk satu surat Srikandi sekaligus">
                Usulan kolektif
              </Link>
              <Link
                href="/dashboard/upt/unggah"
                className="dsb-tombol dsb-tombol-kecil"
                data-jenis="garis"
                title="Satu berkas CSV berisi banyak pegawai, diperiksa dan dikonfirmasi per baris sebelum tersimpan"
              >
                Unggah daftar
              </Link>
              <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={bukaPegawaiBaru}>
                Tambah pegawai
              </button>
            </span>
            <input
              type="search"
              className="dsb-cari"
              style={{ flex: "0 1 200px" }}
              aria-label="Cari pegawai"
              placeholder="Cari nama, NIP, jabatan"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </div>

          {memuat && !data ? (
            <div className="flex flex-col gap-2" style={{ padding: "16px" }} role="status" aria-label="Memuat data">
              {[1, 2, 3, 4].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 44, borderRadius: 8 }} />)}
            </div>
          ) : tampil.length === 0 ? (
            <p className="dsb-kosong" style={{ padding: "44px 16px" }}>
              {pegawai.length === 0 ? "Belum ada pegawai satker ini di SIM-KGB." : "Tidak ada pegawai yang cocok dengan saringan."}
            </p>
          ) : (
            <div className="dsb-antrian-gulir">
              <table className="dsb-tabel" style={{ minWidth: "720px" }}>
                <thead>
                  <tr>
                    {/* Gaji pokok menyatu dengan KGB berikutnya: keduanya menjawab hal yang sama, dan
                        kolom Tindakan tersendiri membuat kolom Status kembali berisi status saja. */}
                    <th scope="col">Pegawai</th>
                    <th scope="col">KGB berikutnya</th>
                    <th scope="col">Dasar KGB berikutnya</th>
                    <th scope="col">Status di Kanwil</th>
                    <th scope="col" className="kanan">Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((p) => {
                    const k = keadaan(p);
                    // Usulan yang sedang ditinjau Kanwil tidak boleh disentuh UPT, jadi tombolnya pun
                    // tidak ditawarkan: dulu tombol itu tetap hidup dan penolakannya baru muncul setelah
                    // operator mengisi seluruh formulir.
                    const milikSendiri = drafPegawai(p.id);
                    const sedangDitinjau = p.usulanBerjalan === "menunggu";
                    const bulanKirim = p.bulanTmt ? geserBulan(p.bulanTmt, -2) : null;
                    const tmt = tanggalKalender(p.tmtKgb);
                    const batas = tmt ? hitungDeadlineSDM(tmt) : null;
                    return (
                      <tr key={p.id}>
                        <td style={{ maxWidth: "260px" }}>
                          <p className="dsb-nama truncate" style={{ margin: 0 }}>{p.nama}</p>
                          <p className="dsb-kecil truncate" style={{ margin: 0 }} title={p.jabatan}>{p.nip} · {p.golonganRuang} · {p.jabatan}</p>
                          {/* BKO hanya keterangan: yang mengusulkan dan merekam KGB-nya tetap satker ini.
                              Kalimat itu pindah ke tooltip agar identitas pegawai tidak kalah menonjol oleh
                              catatan penugasan; nama satkernya tetap resmi lengkap, hanya dipotong CSS. */}
                          {p.satkerTugas && (
                            <p
                              className="upt-bko"
                              title={`Bertugas di ${namaUnitKerja(p.satkerTugas)}. KGB tetap diusulkan dan direkam satker ini.`}
                            >
                              <span className="dsb-tag" data-nada="kuning">BKO</span>
                              <span className="truncate">{namaUnitKerja(p.satkerTugas)}</span>
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {p.tmtKgb ? formatTanggalId(p.tmtKgb, { month: "short", year: "numeric" }) : "-"}
                          <p className="dsb-kecil" style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>{fmtRp(p.gajiPokok)}</p>
                          {bulanKirim && (
                            <p className="dsb-kecil" style={{ margin: 0, color: p.bulanTmt === bulanUsulan ? "var(--st-amber)" : undefined }}>
                              {p.bulanTmt === bulanUsulan ? "usulkan bulan ini" : `usulkan ${namaBulan(bulanKirim)}`}
                              {batas && !p.terkunci ? ` · batas Kanwil ${formatTanggalId(batas, { day: "numeric", month: "short" })}` : ""}
                            </p>
                          )}
                        </td>
                        {/* SK yang gaji pokoknya dipakai SK KGB berikutnya; berpindah sendiri bila ada SK pangkat/PI atau PMK yang lebih baru (ADR-030). */}
                        <td style={{ maxWidth: "230px" }}>
                          {p.dasarKgb ? (
                            <>
                              {/* Dasar yang bukan SK KGB berarti ada SK yang terbit sesudah KGB terakhir dan
                                  menggeser masa kerja golongannya. Ditandai agar terlihat sekilas, sebab
                                  justru baris inilah yang paling mudah keliru saat dikonfirmasi. */}
                              {(p.dasarKgb.jenis === "kp" || p.dasarKgb.jenis === "pmk") && (
                                <span
                                  className="dsb-tag"
                                  data-garis=""
                                  data-nada="ungu"
                                  title={`Dasar KGB berikutnya bukan SK KGB terakhir, melainkan ${p.dasarKgb.label.toLowerCase()} yang terbit sesudahnya`}
                                >
                                  {p.dasarKgb.jenis === "kp" ? "Dari KP/PI" : "Dari PMK"}
                                </span>
                              )}
                              <p className="dsb-kecil truncate" style={{ margin: 0, color: "var(--dtn)" }} title={p.dasarKgb.label}>
                                {p.dasarKgb.label}
                              </p>
                              <p className="dsb-kecil truncate" style={{ margin: 0 }} title={p.dasarKgb.nomorSK ?? undefined}>
                                {[p.dasarKgb.nomorSK ?? "tanpa nomor", p.dasarKgb.tanggalSK ? fmtTgl(p.dasarKgb.tanggalSK) : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            </>
                          ) : (
                            <span className="dsb-kecil">Belum ada SK tercatat</span>
                          )}
                          {/* SK yang sudah diunggah UPT pada usulannya belum menjadi dasar sebelum Kanwil menyetujui;
                              ditampilkan agar tidak terkira berkasnya hilang (ADR-057). */}
                          {p.skDiUsulan &&
                            (!p.dasarKgb || kunciNomorSk(p.dasarKgb.nomorSK) !== kunciNomorSk(p.skDiUsulan.nomorSK)) && (
                              <div
                                className="upt-dasar-usulan"
                                title="SK ini menjadi dasar KGB berikutnya setelah usulannya disetujui Kanwil"
                              >
                                <span
                                  className="dsb-tag"
                                  data-garis=""
                                  data-nada={p.skDiUsulan.status === "menunggu" ? "biru" : p.skDiUsulan.status === "revisi" ? "ungu" : "kuning"}
                                >
                                  {p.skDiUsulan.status === "menunggu"
                                    ? "Menunggu Kanwil"
                                    : p.skDiUsulan.status === "revisi"
                                      ? "Dikembalikan"
                                      : "Di draf, belum diajukan"}
                                </span>
                                <p className="dsb-kecil truncate" style={{ margin: 0 }} title={p.skDiUsulan.nomorSK ?? undefined}>
                                  {[
                                    p.skDiUsulan.nomorSK ?? (p.skDiUsulan.berkas ? "Pindaian SK, nomor belum diisi" : null),
                                    p.skDiUsulan.tanggalSK ? fmtTgl(p.skDiUsulan.tanggalSK) : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>
                            )}
                        </td>
                        <td>
                          <span className="dsb-status" data-nada={k.nada === "merah" ? "merah" : undefined}>
                            <span className="dsb-titik" data-nada={k.nada} aria-hidden="true" />
                            {k.teks}
                          </span>
                          {p.kgbDitunda && <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-red)" }}>KGB ditunda</p>}
                          {p.konfirmasi === "berlaku" ? (
                            <p className="dsb-kecil" style={{ margin: "2px 0 0" }} title={p.konfirmasiOleh ?? undefined}>
                              <span className="dsb-titik" data-nada="hijau" aria-hidden="true" />{" "}
                              {LABEL_KONFIRMASI_UPT.berlaku}
                              {p.konfirmasiAt ? ` ${formatTanggalId(p.konfirmasiAt, { day: "numeric", month: "short" })}` : ""}
                            </p>
                          ) : p.usulanBerjalan ? (
                            <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>
                              <span
                                className="dsb-titik"
                                data-nada={p.usulanBerjalan === "revisi" ? "ungu" : "biru"}
                                aria-hidden="true"
                              />{" "}
                              {p.usulanBerjalan === "draf"
                                ? "Sedang disiapkan usulannya"
                                : p.usulanBerjalan === "revisi"
                                  ? "Dikembalikan Kanwil, perlu diperbaiki lalu dikirim ulang"
                                  : "Sudah diusulkan, menunggu tinjauan Kanwil"}
                            </p>
                          ) : null}
                        </td>
                        {/* Satu tindakan utama yang berubah menurut keadaan, sisanya di menu titik tiga.
                            Sebelumnya ketiganya bertumpuk di kolom Status, sehingga tujuh pegawai saja
                            sudah setinggi satu layar dan tidak ada yang tampak lebih penting (ADR-042). */}
                        <td className="kanan">
                          <span className="upt-tindakan">
                            {!sedangDitinjau && (
                              // Tombol pekat hanya bila memang ada yang menunggu dikerjakan: draf yang
                              // belum diajukan atau usulan yang dikembalikan Kanwil. Membuat seluruh baris
                              // pekat berarti tidak ada yang menonjol, dan kolomnya menjadi dinding tinta.
                              <button
                                type="button"
                                className="dsb-tombol dsb-tombol-kecil"
                                data-jenis={milikSendiri ? undefined : "garis"}
                                onClick={() => bukaUsulan(p)}
                              >
                                {milikSendiri?.status === "revisi"
                                  ? "Perbaiki usulan"
                                  : milikSendiri
                                    ? milikSendiri.kekurangan.length > 0 ? "Lengkapi draf" : "Ubah draf"
                                    : "Usulkan perbaikan"}
                              </button>
                            )}
                            <MenuTindakan
                              judul={`Tindakan lain untuk ${p.nama}`}
                              item={
                                laporanBerjalan(p.id)
                                  ? []
                                  : [
                                      {
                                        // Golongan dan masa kerja golongan hanya berubah karena ketiga
                                        // sebab ini. Sesudah SK KGB terakhir pun masih mungkin terbit SK
                                        // kenaikan pangkat atau PMK, dan SK itulah yang menggeser masa
                                        // kerja golongan sekaligus menjadi dasar SK KGB berikutnya.
                                        label: "Laporkan kenaikan pangkat",
                                        keterangan: "Termasuk penyesuaian ijazah; golongan naik menurut SK",
                                        onPilih: () => bukaDasarBaru(p, "kp"),
                                      },
                                      {
                                        label: "Laporkan peninjauan masa kerja",
                                        keterangan: "SK PMK; masa kerja golongan bertambah dan jadwal KGB dapat maju",
                                        onPilih: () => bukaDasarBaru(p, "pmk"),
                                      },
                                      {
                                        label: "Laporkan mutasi",
                                        keterangan: "Pindah satker, BKO, selesai BKO, atau pemberhentian",
                                        onPilih: () => setLaporMutasi({ pegawai: p }),
                                      },
                                      {
                                        // UPT memang tidak menghapus data pegawai (ADR-033); yang dikirim
                                        // tetap laporan, dan Kanwil yang menonaktifkannya.
                                        label: "Seharusnya tidak tercatat?",
                                        keterangan: "Entri ganda, NIP salah ketik, atau tidak pernah bertugas di sini",
                                        onPilih: () => setLaporMutasi({ pegawai: p, jenisAwal: "pembatalan" }),
                                      },
                                    ]
                              }
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="dsb-kaki">
            <span>Urut TMT terdekat · data diperbarui Tim SDM Kanwil</span>
            <span>Surat usulan dikirim lewat Srikandi</span>
          </div>
        </section>
  );

  // ── Papan alur KGB: satu kartu per urusan, di kolom tahap yang sedang dijalani ──────────────
  const jadwal = (() => {
    const peta = new Map((data?.mendatang ?? []).map((m) => [m.bulanTmt, m.jumlah]));
    // Mulai dari bulan usulan berjalan: jendela kirim bulan sebelumnya sudah lewat.
    return Array.from({ length: 4 }, (_, i) => {
      const bulanTmt = geserBulan(bulanUsulan, i);
      return { bulanTmt, jumlah: peta.get(bulanTmt) ?? (i === 0 ? perluDiusulkan.length : 0) };
    });
  })();
  // Tombol Ajukan hanya bila ada draf yang memang dapat dicentang; draf terkunci tidak bercentang.
  const adaDraf = tugas.some((t) => t.usulanId && !t.terkunci);
  const tmtSingkat = (t: string | null) => (t ? `TMT ${formatTanggalId(t, { month: "short", year: "numeric" })}` : "TMT belum tercatat");

  /** Sumber kartu papan; satu entri per dokumen, digabungkan per pegawai di bawah (ADR-026). */
  const sumberPapan: SumberPapan[] = [
    ...tugas.map((t) => {
      const u = usulanById(t.usulanId);
      const p = pegawaiById(t.pegawaiId);
      const cfg = TUGAS_UPT[t.jenis];
      // Draf yang masa usul KGB-nya belum dibuka dikunci di dasbor (ADR-059): tanpa centang, terlipat di bawah
      // Perlu dikerjakan, dan terbuka sendiri pada bulan kirimnya.
      const kunci = t.terkunci;
      return {
        kolom: kunci ? ("kunci" as const) : ("kerja" as const),
        kunci: t.kunci,
        pegawaiId: t.pegawaiId,
        nip: t.nip,
        nama: t.nama,
        waktu: u?.diajukanAt ?? null,
        // Draf lengkap yang dapat dicentang; dipakai "Centang semua yang siap" di Perlu dikerjakan (ADR-060).
        pilihSiap: u && !kunci && t.jenis === "ajukan" ? u.id : null,
        ringkas: kunci ? `draf data terkunci sampai ${namaBulan(kunci.bulanKirim)}` : cfg.judul.toLowerCase(),
        render: (lain: string[]) => (
          <KartuUpt
            lain={lain}
            terkunci={!!kunci}
            nama={t.nama}
            // Kartu draf adalah usulan DATA (perbaikan atau pegawai baru), bukan usulan KGB; jenisnya disebut di sini.
            // Dulu baris ini hanya "TMT Jan 2028", sehingga draf yang siap diajukan terbaca sebagai KGB yang
            // seharusnya masih terkunci (ADR-057).
            sub={u ? `${t.nip} · ${LABEL_JENIS_USULAN[u.jenis] ?? "Usulan data"}` : `${t.nip} · ${tmtSingkat(t.tmt)}`}
            nada={t.jenis === "perbaiki" ? "ungu" : undefined}
            tanda={kunci ? { teks: `Terkunci sampai ${namaBulan(kunci.bulanKirim)}` } : { teks: cfg.judul, nada: cfg.nada }}
            // Penugasan BKO disebut di sini supaya tidak terkira orangnya sudah pindah dan usulannya
            // bukan urusan satker ini lagi; unit kerjanya memang tetap di satker ini.
            catatan={
              [
                t.catatan ? `${t.jenis === "perbaiki" ? "Catatan Kanwil" : "Belum ada"}: ${t.catatan}` : "",
                // Masa usul KGB-nya belum dibuka: kapan terbuka, dan jalan lain bila perbaikannya mendesak.
                kunci
                  ? `Masa usul KGB ${namaBulan(kunci.bulanTmt)} dibuka ${namaBulan(kunci.bulanKirim)}, 2 bulan sebelum TMT. Bila mendesak, ajukan lewat Usulan kolektif`
                  : "",
                p?.satkerTugas ? `Sedang BKO di ${namaUnitKerja(p.satkerTugas)}; KGB tetap diusulkan satker ini` : "",
              ]
                .filter(Boolean)
                .join(" · ") || null
            }
            petunjuk={t.langkah}
            pilih={
              u && !kunci ? (
                <input
                  type="checkbox"
                  className="dsb-cek"
                  checked={pilihAjukan.has(u.id)}
                  onChange={() => pilihDraf(u.id)}
                  aria-label={`Pilih ${t.nama} untuk diajukan`}
                />
              ) : null
            }
            aksi={
              u ? (
                <>
                  {/* Draf yang sudah lengkap tinggal dicentang dan diajukan, jadi menyuntingnya menjadi aksi kedua. */}
                  <button
                    type="button"
                    className="dsb-tombol dsb-tombol-kecil"
                    data-jenis={t.jenis === "ajukan" || kunci ? "garis" : undefined}
                    onClick={() => lanjutkanDraf(u)}
                  >
                    {t.jenis === "perbaiki" ? "Perbaiki" : t.jenis === "lengkapi" ? "Lengkapi" : "Ubah"}
                  </button>
                  <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setDialogBatal(u)}>
                    Hapus
                  </button>
                </>
              ) : p ? (
                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => bukaUsulan(p)}>
                  Usulkan perbaikan
                </button>
              ) : null
            }
          />
        ),
      };
    }),
    ...laporan
      .filter((l) => l.status === "dikembalikan")
      .map((l) => ({
        kolom: "kerja" as const,
        kunci: `laporan:${l.id}`,
        pegawaiId: l.pegawaiId ?? null,
        nip: l.nip,
        nama: l.nama,
        waktu: l.tmt ?? null,
        ringkas: `laporan ${l.label.toLowerCase()} dikembalikan`,
        render: (lain: string[]) => (
          <KartuUpt
            lain={lain}
            nama={l.nama}
            sub={`${l.nip} · ${l.label}`}
            nada="ungu"
            tanda={{ teks: "Laporan dikembalikan", nada: "ungu" }}
            catatan={l.catatanKanwil ? `Catatan Kanwil: ${l.catatanKanwil}` : null}
            aksi={
              <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => void batalkanLaporan(l)}>
                Batalkan laporan
              </button>
            }
          />
        ),
      })),
    ...terkirim
      .filter((u) => u.status === "menunggu")
      .map((u) => ({
        kolom: "kanwil" as const,
        kunci: `usulan:${u.id}`,
        pegawaiId: u.pegawaiId,
        nip: u.nip,
        nama: u.nama,
        waktu: u.diajukanAt ?? null,
        ringkas: `${LABEL_JENIS_USULAN[u.jenis] ?? u.jenis} menunggu tinjauan Kanwil`,
        render: (lain: string[]) => (
          <KartuUpt
            lain={lain}
            nama={u.nama}
            sub={`${u.nip} · dikirim ${fmtTgl(u.diajukanAt)}`}
            tanda={{ teks: `${LABEL_JENIS_USULAN[u.jenis] ?? u.jenis}: menunggu tinjauan`, nada: "kuning" }}
            catatan={u.nomorSurat ? `Surat ${u.nomorSurat}` : null}
            aksi={
              <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setDialogBatal(u)}>
                Batalkan usulan
              </button>
            }
          />
        ),
      })),
    ...sedangDiproses.map((p) => ({
      kolom: "kanwil" as const,
      kunci: `proses:${p.id}`,
      pegawaiId: p.id,
      nip: p.nip,
      nama: p.nama,
      waktu: null,
      ringkas: "SK sedang dibuat Kanwil",
      render: (lain: string[]) => (
        <KartuUpt
          lain={lain}
          nama={p.nama}
          sub={`${p.nip} · ${tmtSingkat(p.tmtKgb)}`}
          tanda={{ teks: "SK sedang dibuat Kanwil", nada: "biru" }}
        />
      ),
    })),
    ...laporan
      .filter((l) => l.status === "menunggu")
      .map((l) => ({
        kolom: "kanwil" as const,
        kunci: `laporan:${l.id}`,
        pegawaiId: l.pegawaiId ?? null,
        nip: l.nip,
        nama: l.nama,
        waktu: l.tmt ?? null,
        ringkas: `laporan ${l.label.toLowerCase()} menunggu tinjauan`,
        render: (lain: string[]) => (
          <KartuUpt
            lain={lain}
            nama={l.nama}
            sub={`${l.nip} · ${l.label}${l.tmt ? ` · TMT ${fmtTgl(l.tmt)}` : ""}`}
            tanda={{ teks: "Laporan menunggu tinjauan", nada: "kuning" }}
            catatan={l.satkerTujuan ? `ke ${l.satkerTujuan}` : l.alasan}
            aksi={
              <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => void batalkanLaporan(l)}>
                Batalkan laporan
              </button>
            }
          />
        ),
      })),
    ...skSelesai
      .filter((sk) => !sk.gajiWebAt)
      .map((sk) => ({
        kolom: "sk" as const,
        kunci: `sk:${sk.id}`,
        pegawaiId: sk.pegawaiId ?? null,
        nip: sk.nip ?? "",
        nama: sk.nama,
        waktu: sk.diunggahAt ?? null,
        ringkas: sk.berkasAda ? "SK terbit, belum direkam di Gaji Web" : "SK menunggu berkas dari Tim SDM",
        render: (lain: string[]) => (
        <KartuUpt
          lain={lain}
          nama={sk.nama}
          sub={`TMT ${fmtTgl(sk.tmtKgbBaru)} · ${sk.golonganBaru} · ${fmtRp(sk.gajiPokokBaru)}`}
          // Berkas SK yang belum diunggah Tim SDM berarti belum dapat direkam; rapelan tetap disebut di catatan.
          tanda={
            sk.berkasAda
              ? { teks: "Siap direkam di Gaji Web", nada: "hijau" }
              : { teks: "Menunggu berkas SK dari Tim SDM", nada: "kuning" }
          }
          catatan={
            [
              sk.nomorSurat ? `SK ${sk.nomorSurat}` : "",
              sk.status === "menunggu_keuangan"
                ? sk.potensiRapelan ? "berpotensi rapelan" : ""
                : sk.rapelan ? "dibayar sebagai rapelan" : "",
              sk.diunggahAt ? `diunggah ${fmtTgl(sk.diunggahAt)}` : "",
            ].filter(Boolean).join(" · ") || null
          }
          aksi={
            <>
              {sk.berkasAda && (
                <a href={`/api/upt/sk/${sk.id}`} target="_blank" rel="noopener noreferrer" className="dsb-tombol dsb-tombol-kecil">
                  Unduh SK
                </a>
              )}
              <button
                type="button"
                className="dsb-tombol dsb-tombol-kecil"
                data-jenis="garis"
                disabled={menandaiGajiWeb === sk.id}
                onClick={() => {
                  setGalatGajiWeb(null);
                  setDialogGajiWeb({ sk, rapelan: sk.potensiRapelan });
                }}
              >
                Sudah direkam di Gaji Web
              </button>
            </>
          }
        />
        ),
      })),
    ...skSelesai
      .filter((sk) => sk.gajiWebAt)
      .map((sk) => ({
        kolom: "selesai" as const,
        kunci: `sk:${sk.id}`,
        pegawaiId: sk.pegawaiId ?? null,
        nip: sk.nip ?? "",
        nama: sk.nama,
        waktu: sk.gajiWebAt ?? null,
        ringkas: `SK TMT ${fmtTgl(sk.tmtKgbBaru)} sudah direkam di Gaji Web`,
        render: (lain: string[]) => (
          <KartuUpt
            lain={lain}
            nama={sk.nama}
            sub={`TMT ${fmtTgl(sk.tmtKgbBaru)} · ${fmtRp(sk.gajiPokokBaru)}`}
            tanda={{ teks: `Direkam di Gaji Web ${fmtTgl(sk.gajiWebAt)}`, nada: "hijau" }}
            // SK yang sudah direkam menjadi dasar KGB berikutnya, kecuali nanti ada SK pangkat/PI atau PMK.
            catatan={
              teksDasarKgb(pegawaiById(sk.pegawaiId)?.dasarKgb)
                ? `Dasar KGB berikutnya: ${teksDasarKgb(pegawaiById(sk.pegawaiId)?.dasarKgb)}`
                : null
            }
            aksi={
              sk.berkasAda ? (
                <a href={`/api/upt/sk/${sk.id}`} target="_blank" rel="noopener noreferrer" className="dsb-tautan">
                  Unduh SK →
                </a>
              ) : null
            }
          />
        ),
      })),
    // Usulan yang sudah ditinjau Kanwil sengaja tidak masuk kolom Selesai. "Selesai" di papan ini berarti
    // satu hal saja: KGB-nya sudah direkam di Gaji Web satker. Usulan yang disetujui hanya mengubah data
    // pegawai, dan yang ditolak justru belum selesai sama sekali. Hasil tinjauannya ada di notifikasi dan
    // di Riwayat usulan dan laporan (/dashboard/upt/riwayat/aktivitas).
  ];

  /** Satu kartu per pegawai; dokumen lain miliknya disebut di kartu itu (lib/papanUpt.ts). */
  const kolomPapan = kartuPerKolom(sumberPapan);
  // Pencarian di Perlu dikerjakan: sesudah Unggah daftar kolom ini dapat berisi ratusan draf (ADR-060).
  const qKerja = cariKerja.trim().toLowerCase();
  const angkaKerja = qKerja.replace(/\D/g, "");
  const cocokKerja = (g: { utama: SumberPapan }) =>
    !qKerja ||
    g.utama.nama.toLowerCase().includes(qKerja) ||
    (!!angkaKerja && g.utama.nip.replace(/\D/g, "").includes(angkaKerja));
  const kerjaTampil = kolomPapan.kerja.filter(cocokKerja);
  const kunciTampil = kolomPapan.kunci.filter(cocokKerja);
  const siapTampil = kerjaTampil.map((g) => g.utama.pilihSiap).filter((id): id is string => !!id);
  const semuaSiapDipilih = siapTampil.length > 0 && siapTampil.every((id) => pilihAjukan.has(id));
  function centangSemuaSiap() {
    setPilihAjukan((lama) => {
      const baru = new Set(lama);
      for (const id of siapTampil) {
        if (semuaSiapDipilih) baru.delete(id);
        else baru.add(id);
      }
      return baru;
    });
  }

  return (
    <div className="dsb-halaman" data-muat-layar="">
      {halaman === "dasbor" && data && !memuat && (
        <PengingatUsulan
          satker={data.satker.kode}
          bulanTmt={bulanUsulan}
          namaBulanTmt={namaBulan(bulanUsulan)}
          hariIni={hariIni}
          jumlahJatuhTempo={perluDiusulkan.length}
          belumDiajukan={belumDiajukan}
        />
      )}
      {halaman === "pegawai" ? (
        <header className="dsb-halaman-kepala dsb-muncul">
          <div className="min-w-0">
            <p className="dsb-label">Data Pegawai</p>
            <h1 className="dsb-halaman-judul">{data ? `Pegawai ${namaTampilSatker(data.satker)}` : "Pegawai satker"}</h1>
            <p className="dsb-sub">
              Status KGB setiap pegawai di Kanwil. Dari sini pegawai baru ditambahkan, daftar pegawai diunggah
              sekaligus, perbaikan data diusulkan, dan mutasi atau pemberhentian dilaporkan.
            </p>
          </div>
        </header>
      ) : (
      <PanelNavy
        label="Dashboard Admin UPT"
        judul={`${sapaanWita()}${nama ? `, ${nama}` : ""}`}
        sub={
          <>
            {tanggalPanjangWita()}
            {data && <> · {namaTampilSatker(data.satker)} · KPPN {data.satker.kppn}</>}
          </>
        }
        diperbarui={segar}
        onMuatUlang={muat}
        memuat={memuat}
      >
        {/* Kapan surat usulan tiap bulan TMT dikirim; bulan yang jendela kirimnya sedang terbuka disorot.
            Tiap kartu dapat dibuka untuk melihat siapa saja yang jatuh tempo pada periode itu, sebab angka
            saja tidak dapat ditindaklanjuti: operator tetap harus tahu namanya. */}
        <div className="upt-jadwal" aria-label="Jadwal surat usulan per bulan TMT">
          {/* Yang TMT-nya sudah lewat jendela kirim namun belum selesai. Tanpa kartu ini mereka lenyap dari
              pita, sebab pita hanya melihat ke depan, dan satker tidak punya penanda bahwa ada yang tertinggal. */}
          {tertinggal.length > 0 && (
            <button
              type="button"
              className="upt-jadwal-bulan"
              data-terlambat=""
              onClick={() => setDialogPeriode({ jenis: "terlambat" })}
            >
              <span className="upt-jadwal-nama">Terlambat</span>
              <span className="upt-jadwal-angka">
                {tertinggal.length}
                <small> pegawai</small>
              </span>
              {/* Teksnya sengaja pendek: pita ini memotong keterangan yang melebihi satu baris. */}
              <span className="upt-jadwal-ket">TMT sudah lewat</span>
            </button>
          )}
          {jadwal.map((m) => {
            const sekarang = m.bulanTmt === bulanUsulan;
            return (
              <button
                key={m.bulanTmt}
                type="button"
                className="upt-jadwal-bulan"
                data-sekarang={sekarang ? "" : undefined}
                data-kosong={m.jumlah === 0 ? "" : undefined}
                onClick={() => setDialogPeriode({ jenis: "bulan", bulanTmt: m.bulanTmt })}
              >
                <span className="upt-jadwal-nama">TMT {namaBulan(m.bulanTmt)}</span>
                <span className="upt-jadwal-angka">
                  {m.jumlah}
                  <small> pegawai</small>
                </span>
                <span className="upt-jadwal-ket">
                  {sekarang ? `kirim bulan ini, 1–${KIRIM_SURAT_BATAS}` : `kirim 1–${KIRIM_SURAT_BATAS} ${namaBulan(geserBulan(m.bulanTmt, -2))}`}
                </span>
              </button>
            );
          })}
          <div className="upt-jadwal-bulan" data-ringkas="">
            <span className="upt-jadwal-nama">Selesai TMT {hariIni.getFullYear()}</span>
            <span className="upt-jadwal-angka">
              {tahunIni?.selesai ?? 0}
              <small> / {tahunIni?.total ?? 0}</small>
            </span>
            <span className="upt-jadwal-ket">
              {(data?.kgbDitunda ?? 0) > 0 ? `${data?.kgbDitunda} KGB ditunda karena hukdis` : `${pctSelesai}% dari KGB tahun ini`}
            </span>
          </div>
        </div>
      </PanelNavy>
      )}

      {/* Isi satu kartu pita jadwal: siapa saja yang jatuh tempo pada periode itu dan sedang di mana. */}
      {dialogPeriode && (() => {
        const terlambatMode = dialogPeriode.jenis === "terlambat";
        const daftar = terlambatMode
          ? tertinggal
          : pegawai.filter((p) => p.bulanTmt === dialogPeriode.bulanTmt);
        // Yang masih menunggu tindakan UPT: tidak ada usulan yang sedang ditinjau, dan Kanwil belum memproses.
        const perluDikerjakan = daftar.filter((p) => p.usulanBerjalan !== "menunggu" && !p.statusKGB);
        const tautan = terlambatMode
          ? "/dashboard/upt/kolektif?terlambat=1"
          : `/dashboard/upt/kolektif?bulan=${dialogPeriode.bulanTmt}`;
        return (
          <KerangkaModal
            judul={terlambatMode ? "KGB yang sudah lewat jadwal kirim" : `KGB TMT ${namaBulan(dialogPeriode.bulanTmt)}`}
            subjudul={
              terlambatMode
                ? "TMT-nya sudah lewat dan KGB-nya belum selesai"
                : `Surat usulannya dikirim 1–${KIRIM_SURAT_BATAS} ${namaBulan(geserBulan(dialogPeriode.bulanTmt, -2))}`
            }
            nada={terlambatMode ? "amber" : undefined}
            ukuran="md"
            onTutup={() => setDialogPeriode(null)}
            kaki={
              <>
                <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogPeriode(null)}>
                  Tutup
                </button>
                {perluDikerjakan.length > 0 && (
                  <Link href={tautan} className="kgbm-tombol kgbm-utama" onClick={() => setDialogPeriode(null)}>
                    Siapkan usulan kolektif
                  </Link>
                )}
              </>
            }
          >
            {daftar.length === 0 ? (
              <p className="dsb-kosong" style={{ padding: "18px 0" }}>
                Tidak ada pegawai dengan KGB pada periode ini.
              </p>
            ) : (
              <>
                <div className="pgu-angka">
                  <div>
                    <strong>{daftar.length}</strong>
                    <span>pegawai pada periode ini</span>
                  </div>
                  <div data-nada={perluDikerjakan.length > 0 ? "amber" : undefined}>
                    <strong>{perluDikerjakan.length}</strong>
                    <span>menunggu tindakan Anda</span>
                  </div>
                </div>
                <ul className="pgu-daftar upt-periode-daftar" aria-label="Pegawai pada periode ini">
                  {daftar.map((p) => {
                    const k = keadaan(p);
                    return (
                      <li key={p.id}>
                        <span className="min-w-0">
                          <strong>{p.nama}</strong>
                          <span>
                            {p.nip} · {p.golonganRuang} · TMT {fmtTgl(p.tmtKgb)}
                          </span>
                        </span>
                        <span className="dsb-tag" data-garis="" data-nada={k.nada}>
                          {k.teks}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {perluDikerjakan.length > 0 && (
                  <p className="kgbm-bantuan">
                    {terlambatMode
                      ? "Yang terlambat tetap berhak KGB; selisihnya dibayar sebagai rapelan. Ajukan secepatnya agar tidak makin menumpuk."
                      : "Tombol di bawah membuka Usulan kolektif dengan pegawai periode ini sudah tercentang."}
                  </p>
                )}
              </>
            )}
          </KerangkaModal>
        );
      })()}

      {dialogGajiWeb && (
        <KerangkaModal
          judul="Sudah direkam di Gaji Web"
          subjudul={`${dialogGajiWeb.sk.nama} · ${dialogGajiWeb.sk.nip} · TMT ${fmtTgl(dialogGajiWeb.sk.tmtKgbBaru)}`}
          ukuran="sm"
          sibuk={menandaiGajiWeb === dialogGajiWeb.sk.id}
          onTutup={() => setDialogGajiWeb(null)}
          onKirim={() => void tandaiGajiWeb()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogGajiWeb(null)} disabled={!!menandaiGajiWeb}>
                Batal
              </button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={!!menandaiGajiWeb}>
                {menandaiGajiWeb ? "Menyimpan…" : "Simpan"}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galatGajiWeb} />
          <p className="dsb-sub" style={{ marginTop: 0 }}>
            {dialogGajiWeb.sk.golonganBaru} · gaji pokok baru {fmtRp(dialogGajiWeb.sk.gajiPokokBaru)}
            {dialogGajiWeb.sk.nomorSurat ? ` · SK ${dialogGajiWeb.sk.nomorSurat}` : ""}
          </p>
          {dialogGajiWeb.sk.status === "menunggu_keuangan" ? (
            <>
              <div className="kgbm-pilihan" role="radiogroup" aria-label="Pembayaran KGB">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!dialogGajiWeb.rapelan}
                  onClick={() => setDialogGajiWeb((d) => (d ? { ...d, rapelan: false } : d))}
                >
                  Tidak rapelan
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={dialogGajiWeb.rapelan}
                  onClick={() => setDialogGajiWeb((d) => (d ? { ...d, rapelan: true } : d))}
                >
                  Dibayar sebagai rapelan
                </button>
              </div>
              {dialogGajiWeb.sk.potensiRapelan && (
                <Catatan nada="amber">Batas input Kanwil terlewat, sehingga KGB ini berpotensi rapelan.</Catatan>
              )}
              <Catatan>
                Simpan setelah KGB ini direkam di Gaji Web satker. Langkah ini sekaligus konfirmasi keuangan: gaji
                pokok, masa kerja golongan, dan jadwal KGB berikutnya pegawai diperbarui, dan tidak dapat dibatalkan
                dari sini.
              </Catatan>
            </>
          ) : (
            <Catatan>
              SK ini sudah dikonfirmasi keuangan Kanwil{dialogGajiWeb.sk.rapelan ? " dan dibayar sebagai rapelan" : ""}.
              Simpan setelah KGB-nya direkam di Gaji Web satker.
            </Catatan>
          )}
        </KerangkaModal>
      )}

      {kabar && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
          <p>{kabar}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setKabar(null)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {pratinjau && (
        <ModalPratinjauBerkas
          judul={pratinjau.judul}
          subjudul={pratinjau.subjudul}
          url={pratinjau.url}
          onTutup={() => setPratinjau(null)}
        />
      )}

      {dialogBatal && (
        <KerangkaModal
          judul={salinanHapusUsulan(dialogBatal.status).judul}
          subjudul={
            dialogBatal.status === "draf"
              ? `${dialogBatal.nama} · belum diajukan ke Kanwil`
              : `${dialogBatal.nama} · surat ${dialogBatal.nomorSurat}${dialogBatal.status === "revisi" ? " · dikembalikan Kanwil" : ""}`
          }
          nada="merah"
          ukuran="sm"
          sibuk={membatalkan}
          onTutup={() => setDialogBatal(null)}
          onKirim={() => void batalkanUsulan()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogBatal(null)} disabled={membatalkan}>
                Tidak jadi
              </button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={membatalkan}>
                {membatalkan ? "Menghapus…" : salinanHapusUsulan(dialogBatal.status).tombol}
              </button>
            </>
          }
        >
          <Catatan nada="amber">{salinanHapusUsulan(dialogBatal.status).peringatan}</Catatan>
        </KerangkaModal>
      )}

      {laporMutasi && (
        <ModalLaporMutasi
          pegawai={{ id: laporMutasi.pegawai.id, nama: laporMutasi.pegawai.nama, nip: laporMutasi.pegawai.nip }}
          jenisAwal={laporMutasi.jenisAwal}
          onTutup={() => setLaporMutasi(null)}
          onSelesai={(pesan) => { setLaporMutasi(null); selesaiFormulir(pesan); }}
        />
      )}

      {formulir && (
        <FormulirUsulan
          jenis={formulir.jenis}
          pegawai={formulir.pegawai}
          draf={formulir.draf}
          onTutup={() => setFormulir(null)}
          onSelesai={selesaiFormulir}
        />
      )}

      {dasarBaru && (
        <ModalDasarBaru
          jenis={dasarBaru.jenis}
          pegawai={dasarBaru.pegawai}
          draf={dasarBaru.draf}
          onTutup={() => setDasarBaru(null)}
          onSelesai={(pesan) => {
            setDasarBaru(null);
            selesaiFormulir(pesan);
          }}
        />
      )}

      {dialogAjukan && (
        <KerangkaModal
          judul="Ajukan ke Kanwil"
          subjudul={`${pilihAjukan.size} pegawai dalam satu surat usulan`}
          ukuran="md"
          sibuk={mengajukan}
          onTutup={() => setDialogAjukan(false)}
          onKirim={() => void ajukanTerpilih()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogAjukan(false)} disabled={mengajukan}>
                Batal
              </button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={mengajukan || pilihAjukan.size === 0}>
                {mengajukan ? "Mengirim…" : `Kirim ${pilihAjukan.size} pegawai`}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galatAjukan} />
          <Catatan>
            Surat usulan yang sudah dikirim lewat Srikandi diisikan sekali di sini dan berlaku untuk seluruh
            pegawai yang dipilih. Setelah terkirim, datanya masuk antrian tinjauan Kanwil dan tidak lagi dapat
            disunting; yang keliru dibatalkan lalu dikirim ulang.
          </Catatan>
          {draf.some((u) => pilihAjukan.has(u.id) && u.status === "revisi") && (
            <Catatan nada="amber">
              Ada usulan yang dikembalikan Kanwil di antara pilihan ini. Nomor surat lamanya sudah terisi dan
              boleh dipakai lagi, jadi tidak perlu meminta nomor baru ke arsiparis untuk sekadar ralat.
            </Catatan>
          )}
          <ul className="dsb-log-ringkas">
            {draf.filter((u) => pilihAjukan.has(u.id)).map((u) => (
              <li key={u.id}>
                <span className="dsb-titik" data-nada={u.kekurangan.length > 0 ? "merah" : "hijau"} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="dsb-nama">{u.nama}</span>
                  <span className="dsb-kecil"> · {LABEL_JENIS_USULAN[u.jenis] ?? u.jenis}</span>
                  {u.kekurangan.length > 0 && (
                    <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-red)" }}>
                      Belum lengkap: {u.kekurangan.join(", ")}
                    </p>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="kgbm-grid2">
            <label className="kgbm-label">
              <span className="kgbm-wajib">Nomor surat</span>
              <input
                className="kgbm-input"
                data-autofocus
                value={suratAjukan.nomorSurat}
                onChange={(e) => setSuratAjukan((f) => ({ ...f, nomorSurat: e.target.value }))}
                placeholder="WP.19.PAS.7-SA.04.04-1"
              />
            </label>
            <label className="kgbm-label">
              <span className="kgbm-wajib">Tanggal surat</span>
              <input
                className="kgbm-input"
                type="date"
                value={suratAjukan.tanggalSurat}
                onChange={(e) => setSuratAjukan((f) => ({ ...f, tanggalSurat: e.target.value }))}
              />
            </label>
          </div>
          <label className="kgbm-label">
            Surat usulan Srikandi (PDF, paling besar 500 KB)
            <input
              className="kgbm-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setBerkasAjukan(e.target.files?.[0] ?? null)}
            />
            <span className="kgbm-bantuan">Satu salinan untuk seluruh pegawai pada surat ini.</span>
          </label>
        </KerangkaModal>
      )}

      {halaman === "pegawai" ? (
        panelPegawai
      ) : (
      <section className="dsb-panel dsb-penuh overflow-hidden dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-label="Papan alur KGB satker">
        <div className="dsb-panel-kepala">
          <h2 className="dsb-panel-judul">
            Alur KGB <small>tiap pegawai berada di kolom tahapnya</small>
          </h2>
          <span className="upt-deret" style={{ marginLeft: "auto" }}>
            <Link href="/dashboard/upt/riwayat" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">Riwayat</Link>
            <Link href="/dashboard/upt/pegawai" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">
              Data pegawai ({pegawai.length})
            </Link>
          </span>
        </div>
        <div className="dsb-papan dsb-antrian-gulir" role="list" aria-label="Kolom alur KGB">
          {KOLOM_UPT.map(({ k, judul, ket, nada }) => {
            const isi = k === "kerja" ? kerjaTampil : kolomPapan[k];
            const diciut = ciutPapan.has(k);
            return (
              <section key={k} role="listitem" className="dsb-papan-kolom" data-ciut={diciut ? "" : undefined} aria-label={`${judul}: ${isi.length}`}>
                <button
                  type="button"
                  className="dsb-papan-kepala"
                  onClick={() => alihCiut(k)}
                  aria-expanded={!diciut}
                  title={diciut ? `Buka kolom ${judul}` : `Ciutkan kolom ${judul}`}
                >
                  <span className="dsb-titik" data-nada={nada} aria-hidden="true" />
                  <span className="dsb-papan-judul">{judul}</span>
                  <span className="dsb-papan-jumlah">{k === "kerja" ? kolomPapan.kerja.length : isi.length}</span>
                  {!diciut && <span className="upt-papan-ket">{ket}</span>}
                </button>
                {!diciut && (
                  <div className="dsb-papan-isi">
                    {/* Kotak cari muncul bila kartunya cukup banyak; tetap terlihat selama ada kata carian. */}
                    {k === "kerja" && (kolomPapan.kerja.length + kolomPapan.kunci.length > 4 || cariKerja) && (
                      <div className="upt-papan-cari">
                        <input
                          type="search"
                          className="dsb-cari"
                          placeholder="Cari nama atau NIP"
                          value={cariKerja}
                          onChange={(e) => setCariKerja(e.target.value)}
                          aria-label="Cari di Perlu dikerjakan"
                        />
                        {siapTampil.length > 1 && (
                          <button type="button" className="pgw-tautan" onClick={centangSemuaSiap}>
                            {semuaSiapDipilih ? "Batalkan centang" : `Centang ${siapTampil.length} yang siap`}
                          </button>
                        )}
                      </div>
                    )}
                    {isi.length === 0 && (
                      <p className="dsb-papan-kosong">
                        {memuat && !data ? "Memuat…" : k === "kerja" && qKerja ? "Tidak ada yang cocok dengan pencarian." : KOSONG_UPT[k]}
                      </p>
                    )}
                    {isi.map((g) => (
                      <React.Fragment key={g.kunci}>{g.utama.render(g.lain.map((l) => l.ringkas))}</React.Fragment>
                    ))}
                    {/* Draf data yang masa usul KGB-nya belum dibuka (ADR-059): terlipat, tanpa centang, dan
                        terbuka sendiri pada bulan kirimnya, 2 bulan sebelum TMT. */}
                    {k === "kerja" && kunciTampil.length > 0 && (
                      <details className="upt-terkunci" open={qKerja ? true : undefined}>
                        <summary>
                          Terkunci sampai masa usul KGB
                          <span className="dsb-papan-jumlah">{kunciTampil.length}</span>
                        </summary>
                        <p className="upt-terkunci-ket">
                          Draf data pegawai yang KGB-nya belum masuk masa usul. Terbuka sendiri pada bulan kirimnya, 2 bulan
                          sebelum TMT. Yang mendesak tetap dapat diajukan lewat Usulan kolektif.
                        </p>
                        <div className="upt-terkunci-isi">
                          {kunciTampil.map((g) => (
                            <React.Fragment key={g.kunci}>{g.utama.render(g.lain.map((l) => l.ringkas))}</React.Fragment>
                          ))}
                        </div>
                      </details>
                    )}
                    {k === "selesai" && isi.length > 0 && (
                      <Link href="/dashboard/upt/riwayat" className="dsb-tautan" style={{ padding: "4px 4px 8px" }}>
                        Selengkapnya di Riwayat →
                      </Link>
                    )}
                  </div>
                )}
                {!diciut && k === "kerja" && adaDraf && (
                  <div className="upt-papan-kaki">
                    <button type="button" className="dsb-tombol" disabled={pilihAjukan.size === 0} onClick={bukaDialogAjukan}>
                      {pilihAjukan.size > 0 ? `Ajukan ${pilihAjukan.size} ke Kanwil` : "Centang draf yang akan diajukan"}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>
      )}
    </div>
  );
}
