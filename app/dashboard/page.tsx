"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRole, useDashUser } from "@/app/dashboard/components/RoleContext";
import { ROLES, ROLE_LABEL } from "@/lib/auth";
import dynamic from "next/dynamic";
import type { KartuPapan, KolomPapan } from "@/app/dashboard/components/PapanAntrian";
import type { UsulanMenunggu } from "@/app/dashboard/components/ModalUsulanUpt";

/* Satu akun hanya memakai satu dashboard peran. Memuatnya sesuai kebutuhan menekan kerja server per
   permintaan dan biaya mulai isolate; tampilan sementaranya memakai kerangka yang sama dengan panel lain. */
const Memuat = () => <div className="dsb-halaman"><div className="dsb-kerangka" style={{ height: 240 }} /></div>;
const DashboardHukdis = dynamic(() => import("@/app/dashboard/components/DashboardHukdis"), { ssr: false, loading: Memuat });
const DashboardKeuangan = dynamic(() => import("@/app/dashboard/components/DashboardKeuangan"), { ssr: false, loading: Memuat });
const DashboardUpt = dynamic(() => import("@/app/dashboard/components/DashboardUpt"), { ssr: false, loading: Memuat });
const PanelPantauSatker = dynamic(() => import("@/app/dashboard/components/PanelPantauSatker"), { ssr: false });
const LiniMasaKgb = dynamic(() => import("@/app/dashboard/components/LiniMasaKgb"), { ssr: false });
const ModalUsulanUpt = dynamic(() => import("@/app/dashboard/components/ModalUsulanUpt"), { ssr: false });
const PapanAntrian = dynamic(() => import("@/app/dashboard/components/PapanAntrian"), { ssr: false });
import {
  KerangkaDashboard,
  PanelNavy,
  PanelTindakan,
  namaSapaan,
  sapaanWita,
  tanggalPanjangWita,
  type Nada,
  type Tindakan,
} from "@/app/dashboard/components/PanelNavy";
import {
  IkonPeringatan,
  KerangkaModal,
  ModalArsipKgb,
  ModalBatalkanKgb,
  ModalBuatSk,
  ModalInputKgb,
  ModalRiwayatKgb,
  ModalUnggahSk,
  dasarAwalInputKgb,
  type DasarSkAwal,
  type RingkasanSk,
} from "@/app/dashboard/components/kgb";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, tanggalKalender } from "@/lib/waktu";
import { jendelaProsesKgb } from "@/lib/tabelGaji";
import { SATKER, SATKER_KANWIL, cariSatker } from "@/lib/satker";
import { kodeSatkerPegawai } from "@/lib/rekapSatker";
import { dipegangKeuanganKanwil } from "@/lib/aksesUpt";
import type { BarisPantau } from "@/app/dashboard/components/PanelPantauSatker";
import type { EntriLiniMasa, KelompokLiniMasa } from "@/app/dashboard/components/LiniMasaKgb";
import { namaRingkasSatker } from "@/app/dashboard/satker/labelSatker";
/* -----------------------------------------
   Interfaces
   ----------------------------------------- */

interface PegawaiJatuhTempo {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  golonganRuang: string;
  unitKerja: string | null;
  tmtKgbBerikutnya: string;
  deadlineSDM: string;
  statusHukdis: boolean;
  tanggalHukdisBerakhir: string | null;
  flagRapelan: boolean;
  terlambat: boolean;
  isLocked: boolean;
  statusKGB: string | null;
  kgbId: string | null;
  nomorSK: string | null;
  penetapSkDasar: string | null;
  /** SK sudah dibuat di SIM-KGB; syarat Unggah SK TTE. */
  skSudahDibuat: boolean;
  suratNomorSurat: string | null;
  /** Tanggal SK baru yang tersimpan; tanpa nilai ini Buat SK memakai tanggal hari ini. */
  suratTanggalSurat?: string | null;
  tanggalSK: string | null;
  tmtSK: string | null;
  gajiPokokLama: number | null;
  gajiPokokBaru: number | null;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  prevNomorSK: string | null;
  prevTanggalSK: string | null;
  prevTmtSK: string | null;
  prevPenetapSkDasar: string | null;
}

interface DashboardStats {
  totalPegawai: number;
  totalHukdis: number;
  kgbTahunIni: number;
  belumDiproses: number;
  /** Sedang Diproses ditambah Menunggu Keuangan. */
  sedangDiproses: number;
  menungguKeuangan?: number;
  selesai: number;
  ditolak: number;
  rapelanKonfirmasi: number;
  rapelanBerisiko: number;
}

interface DashboardData {
  stats: DashboardStats;
  pegawaiJatuhTempo: PegawaiJatuhTempo[];
  followupNotifs: { id: string; pesan: string; createdAt: string }[];
}

/* -----------------------------------------
   Helpers
   ----------------------------------------- */

/** Label dan warna badge status KGB dari lib/statusKgb.ts. */
function tampilanStatus(status: string) {
  return { label: infoStatusKgb(status).label, ...warnaStatusKgb(status) };
}

/** "yyyy-mm" menurut tanggal kalender WITA; string kosong bila tanggal kosong atau tidak valid. */
function kunciBulan(nilai: string | null | undefined): string {
  const t = tanggalKalender(nilai);
  return t ? `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}` : "";
}

function daysDiff(date: string) {
  return Math.ceil((new Date(date).getTime() - new Date().getTime()) / 86400000);
}

/* -----------------------------------------
   Main Dashboard
   ----------------------------------------- */

/** Pegawai pada kartu pipeline yang diteruskan ke modal aksi KGB. */
interface PegawaiModal {
  id: string;
  nama: string;
  nip: string;
  jabatan: string | null;
  golonganRuang: string | null;
}

type ModalAksi =
  | { jenis: "input"; pegawai: PegawaiModal; ulang: boolean; dasarAwal: DasarSkAwal | null }
  | { jenis: "arsip"; pegawai: PegawaiModal }
  | {
      jenis: "buat_sk";
      kgbId: string;
      status: string;
      pegawai: PegawaiModal;
      ringkasan: RingkasanSk;
      dasarAwal: DasarSkAwal;
      nomorSkBaru: string | null;
      tanggalSkBaru: string | null;
    }
  | { jenis: "unggah_sk"; kgbId: string; status: string; pegawai: PegawaiModal }
  | { jenis: "batalkan"; kgbId: string; pegawai: PegawaiModal }
  | { jenis: "riwayat"; pegawai: PegawaiModal };

/* -----------------------------------------
   Antrian kerja
   ----------------------------------------- */

/** Saringan tahap antrian kerja di dashboard. */
type Tahap = "perlu" | "lewat" | "keuangan" | "selesai" | "semua";

/** Posisi satu pegawai dalam antrian kerja KGB. */
/** "keuangan" = menunggu keuangan Kanwil; "rekam_upt" = SK pegawai UPT menunggu direkam keuangan UPT (ADR-009). */
type PosisiAntrian = "lewat" | "diproses" | "siap" | "keuangan" | "rekam_upt" | "terkunci" | "selesai";

const URUTAN_POSISI: Record<PosisiAntrian, number> = { lewat: 0, diproses: 1, siap: 2, keuangan: 3, rekam_upt: 4, terkunci: 5, selesai: 6 };

function posisiAntrian(p: PegawaiJatuhTempo): PosisiAntrian {
  if (p.statusKGB === "selesai") return "selesai";
  if (p.statusKGB === "menunggu_keuangan") return dipegangKeuanganKanwil(p.unitKerja) ? "keuangan" : "rekam_upt";
  if (p.statusKGB === "sedang_diproses") return "diproses";
  if (p.isLocked) return "terkunci";
  return p.terlambat ? "lewat" : "siap";
}

function cocokTahap(pos: PosisiAntrian, tahap: Tahap): boolean {
  switch (tahap) {
    case "perlu": return pos === "lewat" || pos === "diproses" || pos === "siap";
    case "lewat": return pos === "lewat";
    case "keuangan": return pos === "keuangan" || pos === "rekam_upt";
    case "selesai": return pos === "selesai";
    default: return true;
  }
}

/** Status di tabel antrian: titik dan teks. */
function StatusAntrian({ pos, dibatalkan, skDibuat, buka, tertahan = false }: { pos: PosisiAntrian; dibatalkan: boolean; skDibuat: boolean; buka: Date | null; tertahan?: boolean }) {
  const [nada, teks]: [Nada | undefined, string] =
    tertahan ? ["ungu", "Tertahan usulan UPT"] :
    // Lamanya lewat batas sudah tertulis di kolom TMT; status cukup menyebut keadaannya.
    pos === "lewat" ? ["merah", dibatalkan ? "Dibatalkan" : "Belum diinput"]
    : pos === "siap" ? ["kuning", dibatalkan ? "Dibatalkan, input ulang" : "Belum diproses"]
    : pos === "diproses" ? ["navy", skDibuat ? "SK dibuat, tunggu TTE" : "Sedang diproses"]
    : pos === "keuangan" ? ["ungu", "Keuangan Kanwil"]
    : pos === "rekam_upt" ? ["ungu", "Direkam keuangan UPT"]
    : pos === "selesai" ? ["hijau", "Selesai"]
    : [undefined, buka ? `Dibuka ${formatTanggalId(buka, { day: "numeric", month: "short" })}` : "Belum dibuka"];
  return (
    <span className="dsb-status" data-nada={pos === "lewat" ? "merah" : undefined}>
      <span className="dsb-titik" data-nada={nada} aria-hidden="true" />
      {teks}
    </span>
  );
}

const KUNCI_TAMPILAN = "kgb-antrian-tampilan";

/** Kolom papan untuk posisi antrian. */
function kolomPapan(pos: PosisiAntrian): KolomPapan {
  if (pos === "lewat" || pos === "siap") return "input";
  if (pos === "diproses") return "proses";
  return pos;
}

/** Saringan satker antrian: semua, Kanwil, seluruh UPT, atau kode satu satker. */
function cocokSatker(p: PegawaiJatuhTempo, saring: string): boolean {
  if (saring === "semua") return true;
  const kode = kodeSatkerPegawai(p.unitKerja);
  if (saring === "upt") return kode !== SATKER_KANWIL.kode;
  return kode === saring;
}

/** Kelompok lini masa untuk satu posisi antrian. */
function kelompokLiniMasa(pos: PosisiAntrian): KelompokLiniMasa {
  if (pos === "lewat") return "lewat";
  if (pos === "siap" || pos === "terkunci") return "belum";
  if (pos === "diproses") return "proses";
  if (pos === "keuangan" || pos === "rekam_upt") return "keuangan";
  return "selesai";
}

function pegawaiModal(p: PegawaiJatuhTempo): PegawaiModal {
  return { id: p.id, nama: p.nama, nip: p.nip, jabatan: p.jabatan, golonganRuang: p.golonganRuang };
}


function DashboardMain() {
  const dashUser = useDashUser();
  const role = useRole();
  const [data, setData] = useState<DashboardData | null>(null);
  // Dibaca penyegaran latar, yang berjalan di luar siklus render.
  const dataRef = useRef<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tahap, setTahap] = useState<Tahap>("perlu");
  // Tampilan antrian: daftar (tabel) atau papan (kanban); pilihan diingat per peramban.
  const [tampilan, setTampilan] = useState<"daftar" | "papan">("daftar");
  const [cariAntrian, setCariAntrian] = useState("");
  const [filterMonth, setFilterMonth] = useState<string | null>(null);
  // Saringan satker (ADR-012): "semua", "upt", atau kode satker ("kanwil" untuk pegawai Kanwil).
  const [saringSatker, setSaringSatker] = useState("semua");
  const [modal, setModal] = useState<ModalAksi | null>(null);
  // Usulan data UPT yang menunggu tinjauan, per pegawai: tampil langsung di papan dan daftar (ADR-011).
  const [usulanPerPegawai, setUsulanPerPegawai] = useState<Map<string, UsulanMenunggu>>(() => new Map());
  const [usulanDibuka, setUsulanDibuka] = useState<UsulanMenunggu | null>(null);
  const [pesanBerhasil, setPesanBerhasil] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  /**
   * Rincian di balik satu angka pada pita ringkasan. Dibuka sebagai jendela agar dasbor tidak
   * ditinggalkan; daftarnya diambil dari antrian kerja, jadi jumlahnya bisa lebih sedikit daripada
   * angka setahun penuh pada kartunya, dan subjudulnya menyebut keduanya.
   */
  const [showRapelanPopup, setShowRapelanPopup] = useState(false);
  const [rapelanKonfirmasiList, setRapelanKonfirmasiList] = useState<{ id: string; pegawai: { nama: string; nip: string }; tmtKgbBaru: string; golonganBaru: string; gajiPokokBaru: number; konfirmasiKeuanganAt: string | null }[]>([]);
  const [rapelanKonfirmasiLoading, setRapelanKonfirmasiLoading] = useState(false);

  const fetchDashboard = (silent = false) => {
    if (!silent) setApiError(null);
    fetch("/api/dashboard")
      .then((r) => r.json() as Promise<(Partial<DashboardData> & { error?: string }) | null>)
      .then((d) => {
        if (d && d.stats && Array.isArray(d.pegawaiJatuhTempo)) {
          dataRef.current = d as DashboardData;
          setData(d as DashboardData);
          setApiError(null);
          setLastRefresh(new Date());
        } else if (!silent || !dataRef.current) {
          // Penyegaran latar yang gagal tidak menghapus dasbor yang sudah tampil; berikutnya dicoba lagi.
          setApiError(d?.error ?? "Respons tidak valid dari server");
        }
        setLoading(false);
        setRefreshing(false);
      })
      .catch((e) => {
        if (!silent || !dataRef.current) setApiError(e?.message ?? "Gagal menghubungi server");
        setLoading(false);
        setRefreshing(false);
      });
  };

  function handleManualRefresh() {
    setRefreshing(true);
    fetchDashboard(true);
  }

  useEffect(() => {
    fetchDashboard();
    const onVisible = () => { if (document.visibilityState === "visible") fetchDashboard(true); };
    document.addEventListener("visibilitychange", onVisible);
    // Auto-refresh setiap 60 detik untuk menangkap perubahan dari halaman lain (pegawai baru, dll)
    const interval = setInterval(() => { if (document.visibilityState === "visible") fetchDashboard(true); }, 60_000);
    return () => { document.removeEventListener("visibilitychange", onVisible); clearInterval(interval); };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem(KUNCI_TAMPILAN) === "papan") setTampilan("papan");
      } catch { /* penyimpanan tidak tersedia */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function pilihTampilan(v: "daftar" | "papan") {
    setTampilan(v);
    try { localStorage.setItem(KUNCI_TAMPILAN, v); } catch { /* penyimpanan tidak tersedia */ }
  }

  // Pesan hasil aksi hilang sendiri setelah beberapa detik.
  useEffect(() => {
    if (!pesanBerhasil) return;
    const t = setTimeout(() => setPesanBerhasil(null), 8000);
    return () => clearTimeout(t);
  }, [pesanBerhasil]);

  // Usulan UPT yang menunggu dimuat ulang setiap dasbor disegarkan.
  useEffect(() => {
    if (!lastRefresh) return;
    let batal = false;
    fetch("/api/usulan?status=menunggu")
      .then((r) => (r.ok ? (r.json() as Promise<UsulanMenunggu[]>) : []))
      .then((daftar) => {
        if (batal || !Array.isArray(daftar)) return;
        setUsulanPerPegawai(new Map(daftar.filter((u) => u.pegawaiId).map((u) => [u.pegawaiId as string, u])));
      })
      .catch(() => {
        // Penanda usulan hanya pelengkap; kegagalannya tidak mengganggu papan.
      });
    return () => {
      batal = true;
    };
  }, [lastRefresh]);

  if (loading) return <KerangkaDashboard />;

  if (apiError)
    return (
      <div className="dsb-halaman">
        <div className="dsb-kartu dsb-kosong" style={{ padding: "56px 20px" }} role="alert">
          <p className="dsb-judul" style={{ marginTop: 0 }}>Gagal memuat dashboard</p>
          <p>{apiError}</p>
          <button type="button" onClick={() => fetchDashboard()} className="dsb-tombol" style={{ marginTop: "8px" }}>
            Coba lagi
          </button>
        </div>
      </div>
    );

  if (!data) return null;

  const { stats, pegawaiJatuhTempo, followupNotifs } = data;

  /* -- Antrian kerja: satu daftar untuk semua tahap, disaring satker lalu bulan TMT -- */
  const dalamSatker = pegawaiJatuhTempo.filter((p) => cocokSatker(p, saringSatker));
  // Lini masa dihitung dari daftar yang sama dengan antrian, sehingga angkanya selalu cocok.
  const entriLiniMasa: EntriLiniMasa[] = dalamSatker.map((p) => ({ tmt: p.tmtKgbBerikutnya, kelompok: kelompokLiniMasa(posisiAntrian(p)) }));
  const qAntrian = cariAntrian.trim().toLowerCase();
  const dalamBulan = dalamSatker
    .filter((p) => !filterMonth || kunciBulan(p.tmtKgbBerikutnya) === filterMonth)
    .filter((p) => !qAntrian || p.nama.toLowerCase().includes(qAntrian) || p.nip.includes(qAntrian) || (p.unitKerja ?? "").toLowerCase().includes(qAntrian))
    .sort(
      (a, b) =>
        URUTAN_POSISI[posisiAntrian(a)] - URUTAN_POSISI[posisiAntrian(b)] ||
        new Date(a.tmtKgbBerikutnya).getTime() - new Date(b.tmtKgbBerikutnya).getTime() ||
        a.nama.localeCompare(b.nama, "id"),
    );
  const jumlahTahap = (t: Tahap) => dalamBulan.filter((p) => cocokTahap(posisiAntrian(p), t)).length;
  const antrian = dalamBulan.filter((p) => cocokTahap(posisiAntrian(p), tahap));
  const jumlahPosisi = (...daftar: PosisiAntrian[]) => dalamBulan.filter((p) => daftar.includes(posisiAntrian(p))).length;
  const lewatBatas = jumlahPosisi("lewat");
  const diKeuanganKanwil = jumlahPosisi("keuangan");
  const diRekamUpt = jumlahPosisi("rekam_upt");
  const totalSiklus = dalamBulan.length;
  const tabTahap: {
    nilai: Tahap;
    label: string;
    nada?: "merah";
    meta?: string;
    metaNada?: "merah" | "ungu" | "hijau";
    dari?: number;
    progres?: number;
  }[] = [
    {
      nilai: "perlu",
      label: "Perlu diproses",
      meta: lewatBatas > 0 ? `${lewatBatas} lewat batas` : "semua dalam jadwal",
      metaNada: lewatBatas > 0 ? "merah" : "hijau",
    },
    {
      nilai: "lewat",
      label: "Lewat batas",
      nada: lewatBatas > 0 ? "merah" : undefined,
      meta: lewatBatas > 0 ? "berpotensi rapelan" : "tidak ada",
    },
    {
      nilai: "keuangan",
      label: "Di keuangan",
      meta: diKeuanganKanwil + diRekamUpt > 0
        ? [diKeuanganKanwil > 0 ? `${diKeuanganKanwil} Kanwil` : "", diRekamUpt > 0 ? `${diRekamUpt} rekam UPT` : ""].filter(Boolean).join(" · ")
        : "tidak ada",
      metaNada: diKeuanganKanwil + diRekamUpt > 0 ? "ungu" : undefined,
    },
    {
      nilai: "selesai",
      label: "Selesai",
      dari: totalSiklus,
      progres: totalSiklus > 0 ? Math.round((jumlahPosisi("selesai") / totalSiklus) * 100) : 0,
    },
    { nilai: "semua", label: "Semua", meta: `${jumlahPosisi("terkunci")} belum dibuka` },
  ];
  const jumlahKanwil = pegawaiJatuhTempo.filter((p) => cocokSatker(p, SATKER_KANWIL.kode)).length;
  const uptBerisi = SATKER.filter((st) => st.kode !== SATKER_KANWIL.kode)
    .map((st) => ({ st, jumlah: pegawaiJatuhTempo.filter((p) => cocokSatker(p, st.kode)).length }))
    .filter((x) => x.jumlah > 0);
  const labelSaringan =
    saringSatker === "semua" ? "semua satker"
    : saringSatker === "upt" ? "seluruh UPT"
    : namaRingkasSatker(SATKER.find((st) => st.kode === saringSatker) ?? SATKER_KANWIL);

  // Pantau satker: angka per tahap dari antrian yang sama, ditambah usulan UPT yang menunggu.
  const usulanPerSatker = new Map<string, number>();
  for (const u of usulanPerPegawai.values()) {
    const kode = cariSatker(u.unitKerja)?.kode;
    if (kode) usulanPerSatker.set(kode, (usulanPerSatker.get(kode) ?? 0) + 1);
  }
  const barisPantau: BarisPantau[] = SATKER.map((st) => {
    const milik = pegawaiJatuhTempo.filter((p) => kodeSatkerPegawai(p.unitKerja) === st.kode).map(posisiAntrian);
    return {
      kode: st.kode,
      nama: namaRingkasSatker(st),
      namaLengkap: st.nama,
      kanwil: st.kode === SATKER_KANWIL.kode,
      lewat: milik.filter((x) => x === "lewat").length,
      perluInput: milik.filter((x) => x === "siap").length,
      diproses: milik.filter((x) => x === "diproses").length,
      diKeuangan: milik.filter((x) => x === "keuangan" || x === "rekam_upt").length,
      usulan: usulanPerSatker.get(st.kode) ?? 0,
    };
  });

  const namaBulanFilter = filterMonth
    ? (() => {
        const [y, m] = filterMonth.split("-");
        return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
      })()
    : null;

  // Menyaring antrian lalu menggulir ke panelnya.
  const bukaAntrian = (t: Tahap, bulan: string | null = null) => () => {
    setTampilan("daftar");
    setCariAntrian("");
    setTahap(t);
    setFilterMonth(bulan);
    document.getElementById("antrian-kerja")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* -- Perlu tindakan -- */
  const tindakan: Tindakan[] = [];
  const terlambatList = pegawaiJatuhTempo.filter((p) => p.terlambat);
  if (terlambatList.length > 0)
    tindakan.push({
      id: "terlambat",
      nada: "merah",
      isi: <><strong>{terlambatList.length} KGB lewat batas input</strong>, berpotensi rapelan.</>,
      aksi: { label: "Tampilkan", onClick: bukaAntrian("lewat") },
    });

  const deadline7 = pegawaiJatuhTempo.filter((p) => p.statusKGB !== "selesai" && !p.terlambat && daysDiff(p.deadlineSDM) >= 0 && daysDiff(p.deadlineSDM) <= 7);
  if (deadline7.length > 0)
    tindakan.push({
      id: "deadline7",
      nada: "kuning",
      isi: <><strong>{deadline7.length} pegawai</strong> batas input SK-nya kurang dari 7 hari lagi.</>,
      aksi: { label: "Tampilkan", onClick: bukaAntrian("perlu") },
    });

  // Potensi rapelan hanya jadi butir sendiri bila menambah informasi di luar yang lewat batas input.
  if (stats.rapelanBerisiko > terlambatList.length || stats.rapelanKonfirmasi > 0)
    tindakan.push({
      id: "rapelan",
      nada: "kuning",
      isi:
        stats.rapelanBerisiko > terlambatList.length
          ? <><strong>{stats.rapelanBerisiko} KGB berpotensi rapelan</strong>, termasuk yang sudah diproses setelah batas.</>
          : <><strong>{stats.rapelanKonfirmasi} rapelan</strong> sudah ditetapkan keuangan.</>,
      aksi: { label: "Rincian", onClick: bukaRapelan },
    });

  // Usulan data UPT yang menunggu tinjauan: ditinjau langsung dari kartu atau baris (ADR-011).
  if (usulanPerPegawai.size > 0)
    tindakan.push({
      id: "usulan-upt",
      nada: "ungu",
      isi: <><strong>{usulanPerPegawai.size} usulan data UPT</strong> menunggu tinjauan; proses KGB pegawainya tertahan sampai ditinjau.</>,
      aksi: { label: "Semua usulan", href: "/dashboard/usulan" },
    });

  // Permintaan follow up dari keuangan
  for (const notif of (followupNotifs ?? [])) {
    tindakan.push({
      id: `followup-${notif.id}`,
      nada: "kuning",
      isi: <><strong>Keuangan:</strong> {notif.pesan}</>,
      aksi: { label: "Buka Proses KGB", href: "/dashboard/kgb" },
    });
  }

  function tutupModal() {
    setModal(null);
  }

  /**
   * Proses KGB tertahan selama usulan UPT pegawai ini menunggu tinjauan dan SK TTE-nya belum diunggah
   * (ADR-014); server menolak langkahnya dengan aturan yang sama (lib/usulanMenahan.ts).
   */
  function tertahanUsulan(p: { id: string }, pos: PosisiAntrian): boolean {
    return usulanPerPegawai.has(p.id) && pos !== "keuangan" && pos !== "rekam_upt" && pos !== "selesai";
  }

  /** Tombol tinjauan usulan UPT; tombol utama bila prosesnya sedang tertahan. */
  function tombolUsulan(p: { id: string }, utama = false) {
    const u = usulanPerPegawai.get(p.id);
    if (!u) return null;
    return (
      <button
        type="button"
        className="dsb-tombol dsb-tombol-kecil"
        data-jenis={utama ? undefined : "garis"}
        data-nada={utama ? "ungu" : undefined}
        onClick={() => setUsulanDibuka(u)}
        title="Tinjau usulan data dari UPT"
      >
        {utama ? "Tinjau usulan UPT" : "Usulan UPT"}
        {u.perubahan.length > 0 ? ` (${u.perubahan.length})` : ""}
      </button>
    );
  }

  function aksiBerhasil(pesan: string) {
    setModal(null);
    setPesanBerhasil(pesan);
    fetchDashboard(true);
  }

  function bukaRapelan() {
    setShowRapelanPopup(true);
    setRapelanKonfirmasiLoading(true);
    fetch("/api/kgb?rapelanDitetapkan=true")
      .then((r) => r.json() as Promise<unknown>)
      .then((d) => setRapelanKonfirmasiList(Array.isArray(d) ? d : []))
      .catch(() => setRapelanKonfirmasiList([]))
      .finally(() => setRapelanKonfirmasiLoading(false));
  }

  function bukaBuatSk(p: PegawaiJatuhTempo) {
    if (!p.kgbId) return;
    setModal({
      jenis: "buat_sk",
      kgbId: p.kgbId,
      status: p.statusKGB ?? "",
      pegawai: pegawaiModal(p),
      ringkasan: {
        golongan: p.golonganRuang,
        gajiPokokLama: p.gajiPokokLama,
        gajiPokokBaru: p.gajiPokokBaru,
        mkgTahunBaru: p.mkgTahunBaru,
        mkgBulanBaru: p.mkgBulanBaru,
        tmtKgbBaru: p.tmtKgbBerikutnya,
        flagRapelan: p.flagRapelan,
      },
      dasarAwal: { nomorSK: p.nomorSK, tanggalSK: p.tanggalSK, tmtSK: p.tmtSK, penetapSkDasar: p.penetapSkDasar },
      nomorSkBaru: p.suratNomorSurat,
      tanggalSkBaru: p.suratTanggalSurat ?? null,
    });
  }

  /** Kartu papan: isi yang sama dengan baris daftar, ditambah kolom tujuan yang boleh untuk diseret. */
  function kartuPapan(p: PegawaiJatuhTempo): KartuPapan {
    const pos = posisiAntrian(p);
    const kolom = kolomPapan(pos);
    const hari = daysDiff(p.deadlineSDM);
    const satker = p.unitKerja?.trim() ? cariSatker(p.unitKerja) : SATKER_KANWIL;
    const dibatalkan = p.statusKGB === "ditolak";
    const buka = pos === "terkunci" ? jendelaProsesKgb(p.tmtKgbBerikutnya)?.unlockDate : null;
    const tombol = aksiBaris(p, pos);
    const tertahan = tertahanUsulan(p, pos);
    const pindah: Partial<Record<KolomPapan, string>> = {};
    if (tertahan) {
      // Tidak ada langkah yang boleh dijalankan sampai usulannya ditinjau (ADR-014).
    } else if (kolom === "input") {
      pindah.proses = dibatalkan ? "Input ulang KGB" : "Input KGB";
      if (pos === "lewat") pindah.selesai = "Arsip, SK sudah terbit di luar SIM-KGB";
    }
    if (kolom === "proses" && p.kgbId) {
      // Sesudah diunggah, SK pegawai UPT ditindaklanjuti keuangan UPT, bukan keuangan Kanwil (ADR-009).
      pindah[dipegangKeuanganKanwil(p.unitKerja) ? "keuangan" : "rekam_upt"] = p.skSudahDibuat ? "Unggah SK TTE" : "Buat SK dulu";
      pindah.input = "Batalkan proses";
    }
    const tanda: NonNullable<KartuPapan["tanda"]> = [];
    if (kolom === "proses") tanda.push(p.skSudahDibuat ? { teks: "SK dibuat, tunggu TTE", nada: "navy" } : { teks: "Perlu buat SK" });
    if (dibatalkan) tanda.push({ teks: "Dibatalkan", nada: "merah" });
    // Kartu yang lewat batas sudah menyebutnya di baris TMT; penanda rapelan hanya untuk yang sudah berjalan.
    if (p.flagRapelan && pos !== "selesai" && pos !== "lewat") tanda.push({ teks: "Berpotensi rapelan", nada: "kuning" });
    if (p.statusHukdis) tanda.push({ teks: `Hukdis${p.tanggalHukdisBerakhir ? ` s.d. ${formatTanggalId(p.tanggalHukdisBerakhir, { day: "numeric", month: "short" })}` : ""}`, nada: "merah" });
    if (tertahan) tanda.push({ teks: "Tertahan usulan UPT", nada: "ungu" });
    const [catatan, catatanNada]: [string | undefined, Nada | undefined] =
      pos === "terkunci" ? [buka ? `dibuka ${formatTanggalId(buka, { day: "numeric", month: "short" })}` : "belum dibuka", undefined]
      : pos === "keuangan" || pos === "rekam_upt" || pos === "selesai" ? [undefined, undefined]
      : hari < 0 ? [`lewat batas ${-hari} hari`, "merah"]
      : hari <= 7 ? [hari === 0 ? "batas hari ini" : `batas ${hari} hari lagi`, "merah"]
      : [`batas ${formatTanggalId(p.deadlineSDM, { day: "numeric", month: "short" })}`, undefined];
    return {
      id: p.id,
      kolom,
      nama: p.nama,
      sub: `${p.golonganRuang} · ${satker ? namaRingkasSatker(satker) : p.unitKerja}`,
      // Penanda asal, bukan singkatan nama satker: nama satker tetap utuh pada baris di bawahnya.
      asal: { teks: satker?.jenis === "kanwil" ? "Kanwil" : "UPT", kanwil: satker?.jenis === "kanwil" },
      judulSub: p.unitKerja ?? undefined,
      tmt: `TMT ${formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}`,
      catatan,
      catatanNada,
      nada: pos === "lewat" ? "merah" : undefined,
      tanda,
      aksi: tombol ? (
        <div className="dsb-aksi" style={{ flexWrap: "wrap", justifyContent: "flex-start" }}>{tombol}</div>
      ) : undefined,
      pindah,
    };
  }

  /** Kartu dilepas di kolom lain: buka modal aksi yang sesuai; datanya baru berubah setelah modal dikonfirmasi. */
  function pindahKartu(id: string, ke: KolomPapan) {
    const p = pegawaiJatuhTempo.find((x) => x.id === id);
    if (!p) return;
    const dari = kolomPapan(posisiAntrian(p));
    if (dari === "input" && ke === "proses") {
      setModal({ jenis: "input", pegawai: pegawaiModal(p), ulang: p.statusKGB === "ditolak", dasarAwal: dasarAwalInputKgb(p) });
    } else if (dari === "input" && ke === "selesai" && posisiAntrian(p) === "lewat") {
      setModal({ jenis: "arsip", pegawai: pegawaiModal(p) });
    } else if (dari === "proses" && (ke === "keuangan" || ke === "rekam_upt") && p.kgbId) {
      if (p.skSudahDibuat) setModal({ jenis: "unggah_sk", kgbId: p.kgbId, status: p.statusKGB ?? "", pegawai: pegawaiModal(p) });
      else bukaBuatSk(p);
    } else if (dari === "proses" && ke === "input" && p.kgbId) {
      setModal({ jenis: "batalkan", kgbId: p.kgbId, pegawai: pegawaiModal(p) });
    }
  }

  /** Tombol aksi baris antrian menurut posisinya. */
  function aksiBaris(p: PegawaiJatuhTempo, pos: PosisiAntrian) {
    if (tertahanUsulan(p, pos)) {
      const kgbId = p.kgbId;
      return (
        <>
          {pos === "diproses" && kgbId && (
            <button type="button" className="dsb-ikon-tombol" data-nada="merah" onClick={() => setModal({ jenis: "batalkan", kgbId, pegawai: pegawaiModal(p) })} title="Batalkan proses KGB" aria-label={`Batalkan proses KGB ${p.nama}`}>
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
          {tombolUsulan(p, true)}
        </>
      );
    }
    if (usulanPerPegawai.has(p.id) && (pos === "keuangan" || pos === "rekam_upt" || pos === "selesai")) {
      return <>{tombolUsulan(p)}{aksiBarisTanpaUsulan(p, pos)}</>;
    }
    return aksiBarisTanpaUsulan(p, pos);
  }

  function aksiBarisTanpaUsulan(p: PegawaiJatuhTempo, pos: PosisiAntrian) {
    if (pos === "lewat" || pos === "siap") {
      const dibatalkan = p.statusKGB === "ditolak";
      return (
        <>
          {pos === "lewat" && (
            <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setModal({ jenis: "arsip", pegawai: pegawaiModal(p) })} title="SK KGB periode ini sudah terbit di luar SIM-KGB">
              Arsip
            </button>
          )}
          <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={() => setModal({ jenis: "input", pegawai: pegawaiModal(p), ulang: dibatalkan, dasarAwal: dasarAwalInputKgb(p) })}>
            {dibatalkan ? "Input ulang" : "Input KGB"}
          </button>
        </>
      );
    }
    if (pos === "diproses" && p.kgbId) {
      const kgbId = p.kgbId;
      return (
        <>
          <button type="button" className="dsb-ikon-tombol" data-nada="merah" onClick={() => setModal({ jenis: "batalkan", kgbId, pegawai: pegawaiModal(p) })} title="Batalkan proses KGB" aria-label={`Batalkan proses KGB ${p.nama}`}>
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          {p.skSudahDibuat ? (
            <button type="button" className="dsb-tombol dsb-tombol-kecil" data-nada="hijau" onClick={() => setModal({ jenis: "unggah_sk", kgbId, status: p.statusKGB ?? "", pegawai: pegawaiModal(p) })}>
              Unggah TTE
            </button>
          ) : (
            <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={() => bukaBuatSk(p)}>
              Buat SK
            </button>
          )}
        </>
      );
    }
    if (pos === "selesai")
      return (
        <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setModal({ jenis: "riwayat", pegawai: pegawaiModal(p) })}>
          Riwayat
        </button>
      );
    return null;
  }

  const nama = namaSapaan(dashUser.nama, ROLE_LABEL[role]);

  return (
    <>
    <div className="dsb-halaman" data-muat-layar="">

      {/* -- Pita ringkas: sapaan dan keterangan satu baris (ADR-013) -- */}
      <PanelNavy
        ringkas
        label={`Dashboard ${ROLE_LABEL[role] ?? "SIM-KGB"}`}
        judul={`${sapaanWita()}${nama ? `, ${nama}` : ""}`}
        sub={<>
          {tanggalPanjangWita()} · {stats.totalPegawai} pegawai aktif
          {stats.totalHukdis > 0 && <> · {stats.totalHukdis} hukdis aktif</>}
        </>}
        diperbarui={lastRefresh}
        onMuatUlang={handleManualRefresh}
        memuat={refreshing}
      />

      <div className="dsb-dasbor-isi">

        {/* -- Antrian kerja KGB: kartu utama, mengisi tinggi layar -- */}
        <section id="antrian-kerja" className="dsb-panel dsb-antrian dsb-penuh dsb-tujuan dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="judul-antrian">
          <div className="dsb-panel-kepala dsb-antrian-kepala">
            <h2 id="judul-antrian" className="dsb-panel-judul">
              Antrian kerja KGB <small>{labelSaringan}</small>
            </h2>
            <div className="dsb-antrian-alat">
              {filterMonth && (
                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="lembut" onClick={() => setFilterMonth(null)} aria-label={`Hapus saringan TMT ${namaBulanFilter}`}>
                  TMT {namaBulanFilter}
                  <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
              <select
                className="dsb-cari dsb-pilih-satker"
                aria-label="Saring satker"
                value={saringSatker}
                onChange={(e) => setSaringSatker(e.target.value)}
              >
                <option value="semua">Semua satker ({pegawaiJatuhTempo.length})</option>
                <option value={SATKER_KANWIL.kode}>Kanwil ({jumlahKanwil})</option>
                <option value="upt">Seluruh UPT ({pegawaiJatuhTempo.length - jumlahKanwil})</option>
                {uptBerisi.length > 0 && (
                  <optgroup label="Satu UPT">
                    {uptBerisi.map(({ st, jumlah }) => (
                      <option key={st.kode} value={st.kode}>{namaRingkasSatker(st)} ({jumlah})</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <input
                type="search"
                className="dsb-cari dsb-cari-antrian"
                aria-label="Cari di antrian"
                placeholder="Cari nama, NIP, satker"
                value={cariAntrian}
                onChange={(e) => setCariAntrian(e.target.value)}
              />
              <div className="dsb-segmen" role="group" aria-label="Tampilan antrian">
                <button type="button" aria-pressed={tampilan === "daftar"} onClick={() => pilihTampilan("daftar")} title="Tampilan daftar">
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                  <span className="dsb-label-tampilan">Daftar</span>
                </button>
                <button type="button" aria-pressed={tampilan === "papan"} onClick={() => pilihTampilan("papan")} title="Tampilan papan (kanban)">
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></svg>
                  <span className="dsb-label-tampilan">Papan</span>
                </button>
              </div>
            </div>
          </div>

          {/* Angka tahap sekaligus saringan: menggantikan kartu angka di pita dan tab tahap lama (ADR-013). */}
          <div className="dsb-tahap" role="group" aria-label="Tahap antrian">
            {tabTahap.map((t) => (
              <button
                key={t.nilai}
                type="button"
                className="dsb-tahap-ubin"
                aria-pressed={tampilan === "daftar" && tahap === t.nilai}
                data-nada={t.nada}
                onClick={() => { setTahap(t.nilai); pilihTampilan("daftar"); }}
              >
                <span className="dsb-tahap-label">{t.label}</span>
                <span className="dsb-tahap-angka">
                  {jumlahTahap(t.nilai)}
                  {t.dari != null && <small>/ {t.dari}</small>}
                </span>
                {t.meta && <span className="dsb-tahap-meta" data-nada={t.metaNada} title={t.meta}>{t.meta}</span>}
                {t.progres != null && (
                  <span className="dsb-tahap-bar" aria-hidden="true"><span style={{ width: `${t.progres}%` }} /></span>
                )}
              </button>
            ))}
          </div>

          {tampilan === "papan" ? (
            <PapanAntrian
              className="dsb-antrian-gulir"
              kartu={dalamBulan.map(kartuPapan)}
              keterangan={{
                input: (() => { const n = dalamBulan.filter((p) => posisiAntrian(p) === "lewat").length; return n > 0 ? `${n} lewat batas` : undefined; })(),
                proses: (() => { const n = dalamBulan.filter((p) => posisiAntrian(p) === "diproses" && p.skSudahDibuat).length; return n > 0 ? `${n} tunggu TTE` : undefined; })(),
              }}
              onPindah={pindahKartu}
            />
          ) : antrian.length === 0 ? (
            <p className="dsb-kosong" style={{ padding: "48px 16px" }}>
              {tahap === "perlu" || tahap === "lewat" ? "Tidak ada KGB yang perlu diproses untuk saringan ini." : "Tidak ada KGB untuk saringan ini."}
            </p>
          ) : (
            <div className="dsb-antrian-gulir">
              <table className="dsb-tabel dsb-tabel-padat" style={{ minWidth: "640px" }}>
                <thead>
                  <tr>
                    <th scope="col">Pegawai</th>
                    <th scope="col">TMT dan batas input</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="kanan"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {antrian.map((p) => {
                    const pos = posisiAntrian(p);
                    const hari = daysDiff(p.deadlineSDM);
                    const satker = p.unitKerja?.trim() ? cariSatker(p.unitKerja) : SATKER_KANWIL;
                    const buka = pos === "terkunci" ? jendelaProsesKgb(p.tmtKgbBerikutnya)?.unlockDate : null;
                    // Batas input hanya bermakna sebelum KGB diinput; sesudahnya yang penting tahapnya.
                    const tampilBatas = pos === "lewat" || pos === "siap" || pos === "terkunci";
                    const nadaBaris = pos === "lewat" ? "merah" : tampilBatas && hari >= 0 && hari <= 7 && pos !== "terkunci" ? "kuning" : undefined;
                    return (
                      <tr key={p.id} className={pos === "terkunci" ? "dsb-redup" : undefined} data-nada={nadaBaris}>
                        <td style={{ maxWidth: "260px" }} title={`${p.nama} · NIP ${p.nip}${p.jabatan ? ` · ${p.jabatan}` : ""}\n${satker?.nama ?? p.unitKerja ?? ""}`}>
                          <p className="dsb-nama truncate" style={{ margin: 0 }}>{p.nama}</p>
                          <p className="dsb-kecil truncate" style={{ margin: 0 }}>
                            {p.golonganRuang} · {satker ? namaRingkasSatker(satker) : (p.unitKerja ?? "-")}
                          </p>
                        </td>
                        <td className="whitespace-nowrap">
                          {formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}
                          {tampilBatas && (
                            <p
                              className="dsb-kecil"
                              style={{ margin: 0, color: nadaBaris ? `var(--st-${nadaBaris === "merah" ? "red" : "amber"})` : undefined }}
                              title={`Batas input ${formatTanggalId(p.deadlineSDM)}`}
                            >
                              {pos === "terkunci"
                                ? `dibuka ${buka ? formatTanggalId(buka, { day: "numeric", month: "short" }) : "nanti"}`
                                : hari < 0 ? `lewat batas ${-hari} hari`
                                : hari === 0 ? "batas hari ini"
                                : `batas ${formatTanggalId(p.deadlineSDM, { day: "numeric", month: "short" })}, ${hari} hari lagi`}
                            </p>
                          )}
                        </td>
                        <td>
                          <StatusAntrian pos={pos} dibatalkan={p.statusKGB === "ditolak"} skDibuat={p.skSudahDibuat} buka={buka ?? null} tertahan={tertahanUsulan(p, pos)} />
                          {p.statusHukdis && (
                            <p className="dsb-kecil" style={{ margin: "2px 0 0", color: "var(--st-red)" }}>
                              Hukdis{p.tanggalHukdisBerakhir ? ` s.d. ${formatTanggalId(p.tanggalHukdisBerakhir, { day: "numeric", month: "short" })}` : ""}
                            </p>
                          )}
                        </td>
                        <td className="kanan">
                          <div className="dsb-aksi">{aksiBaris(p, pos)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="dsb-kaki">
            <span>
              {tampilan === "papan"
                ? "Seret kartu ke kolom lain untuk membuka aksinya; tombol di kartu melakukan hal yang sama."
                : `${antrian.length} pegawai · urut lewat batas, sedang diproses, lalu TMT terdekat`}
            </span>
            <Link href={tahap === "lewat" ? "/dashboard/kgb?rapelan=1" : "/dashboard/kgb"} className="dsb-tautan">Buka Proses KGB →</Link>
          </div>
        </section>

        {/* -- Rail: tindakan, jadwal input, dan pantau satker -- */}
        <aside className="dsb-samping dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-label="Ringkasan pendamping">
          <PanelTindakan className="" daftar={tindakan} kosong="Tidak ada KGB yang perlu ditindaklanjuti saat ini." lainnyaHref="/dashboard/notifikasi" />

          <section className="dsb-panel" aria-labelledby="judul-jadwal-input">
            <div className="dsb-panel-kepala">
              <h2 id="judul-jadwal-input" className="dsb-panel-judul">Jadwal input <small>per bulan TMT</small></h2>
              {filterMonth && (
                <button type="button" className="dsb-tautan" onClick={() => setFilterMonth(null)}>
                  Semua bulan
                </button>
              )}
            </div>
            <LiniMasaKgb tegak entri={entriLiniMasa} bulanTerpilih={filterMonth} onPilih={(m) => { setFilterMonth(m); setTahap("semua"); pilihTampilan("daftar"); }} />
          </section>

          <PanelPantauSatker
            baris={barisPantau}
            terpilih={saringSatker === "semua" || saringSatker === "upt" ? null : saringSatker}
            onPilih={(kode) => setSaringSatker(kode ?? "semua")}
            versi={lastRefresh?.getTime()}
          />
        </aside>
      </div>

    </div>

      {showRapelanPopup && (() => {
        const berisiko = pegawaiJatuhTempo.filter((p) => p.flagRapelan);
        const tutupRapelan = () => setShowRapelanPopup(false);
        return (
          <KerangkaModal
            judul="Status Rapelan"
            subjudul={`${stats.rapelanKonfirmasi} terkonfirmasi · ${stats.rapelanBerisiko} berpotensi rapelan`}
            ikon={<IkonPeringatan />}
            nada="merah"
            onTutup={tutupRapelan}
            kaki={
              <>
                <button type="button" className="kgbm-tombol kgbm-kedua" onClick={tutupRapelan}>
                  Tutup
                </button>
                <Link href="/dashboard/kgb" className="kgbm-tombol kgbm-utama" onClick={tutupRapelan}>
                  Buka Proses KGB
                </Link>
              </>
            }
          >
            {/* Ringkasan */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3 text-center" style={{ background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)" }}>
                <p className="text-xl font-bold" style={{ color: "var(--st-red)" }}>{stats.rapelanKonfirmasi}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--st-amber)" }}>Terkonfirmasi</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--dt5)", fontSize: "10px" }}>dikonfirmasi keuangan</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: stats.rapelanBerisiko > 0 ? "var(--tint-amber-bg)" : "var(--sub)", border: `1px solid ${stats.rapelanBerisiko > 0 ? "var(--tint-amber-ln)" : "var(--ln1)"}` }}>
                <p className="text-xl font-bold" style={{ color: stats.rapelanBerisiko > 0 ? "var(--st-amber)" : "var(--dt5)" }}>{stats.rapelanBerisiko}</p>
                <p className="text-xs mt-0.5" style={{ color: stats.rapelanBerisiko > 0 ? "var(--st-amber2)" : "var(--dt5)" }}>Berpotensi rapelan</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--dt5)", fontSize: "10px" }}>belum selesai, sudah lewat batas input</p>
              </div>
            </div>

            {/* Daftar terkonfirmasi */}
            {rapelanKonfirmasiLoading ? (
              <p role="status" className="text-xs text-center py-3" style={{ color: "var(--dt5)" }}>Memuat data terkonfirmasi...</p>
            ) : rapelanKonfirmasiList.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold" style={{ color: "var(--st-red)" }}>
                  Dikonfirmasi Keuangan ({rapelanKonfirmasiList.length})
                </p>
                {rapelanKonfirmasiList.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: "var(--tint-red-bg)", border: "0.5px solid var(--tint-red-ln)" }}>
                    <div aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "var(--tint-red-ln)", color: "var(--st-red)" }}>
                      {k.pegawai.nama.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--dtn)" }}>{k.pegawai.nama}</p>
                      <p className="text-xs truncate" style={{ color: "var(--dt4)" }}>{k.pegawai.nip} · {k.golonganBaru}</p>
                      <p className="text-xs" style={{ color: "var(--st-red)" }}>
                        TMT {formatTanggalId(k.tmtKgbBaru, { month: "short", year: "numeric" })}
                        {k.konfirmasiKeuanganAt && (
                          <span className="ml-1.5" style={{ color: "var(--dt5)" }}>
                            · Dikonfirmasi {formatTanggalId(k.konfirmasiKeuanganAt, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
                        Rp {Number(k.gajiPokokBaru).toLocaleString("id-ID")}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--dt5)" }}>Gaji baru</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Daftar berpotensi rapelan */}
            {berisiko.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold" style={{ color: "var(--st-amber)" }}>
                  Perlu Segera Diproses ({berisiko.length})
                </p>
                {berisiko.map((p) => {
                  const statusCfg = p.statusKGB ? tampilanStatus(p.statusKGB) : null;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "var(--tint-amber-bg)", border: "0.5px solid var(--tint-amber-ln)" }}>
                      <div aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: "var(--tint-amber-ln)", color: "var(--st-amber)" }}>
                        {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--dtn)" }}>{p.nama}</p>
                        <p className="text-xs truncate" style={{ color: "var(--dt4)" }}>{p.nip} · {p.golonganRuang}</p>
                        <p className="text-xs" style={{ color: "var(--st-amber)" }}>
                          TMT {formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}
                          {statusCfg && <span className="ml-1.5 px-1.5 py-px rounded-full text-xs" style={{ background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>}
                        </p>
                      </div>
                      {p.kgbId && (
                        <Link href={`/dashboard/kgb?kgbId=${encodeURIComponent(p.kgbId)}`}
                          onClick={tutupRapelan}
                          aria-label={`Buka KGB ${p.nama} di Proses KGB`}
                          className="text-xs px-2 py-1 rounded-lg shrink-0 font-medium hover:opacity-80 transition"
                          style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>
                          Buka
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 gap-2">
                <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--dt6)" strokeWidth="1.5"><polyline points="20 6 9 17 4 12"/></svg>
                <p className="text-xs text-center" style={{ color: "var(--dt5)" }}>Tidak ada KGB yang berpotensi rapelan saat ini</p>
              </div>
            )}

            {/* Keterangan */}
            <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "var(--tint-navy)", color: "var(--dt3)" }}>
              Rapelan terkonfirmasi adalah KGB yang telah dikonfirmasi keuangan dengan rapelan ditetapkan. KGB berpotensi rapelan adalah KGB yang melewati batas input SDM tetapi belum selesai diproses.
            </div>
          </KerangkaModal>
        );
      })()}


      {usulanDibuka && (
        <ModalUsulanUpt
          usulan={usulanDibuka}
          onTutup={() => setUsulanDibuka(null)}
          onBerhasil={(pesan) => {
            setUsulanDibuka(null);
            aksiBerhasil(pesan);
          }}
        />
      )}

      {/* -- Modal aksi KGB bersama (app/dashboard/components/kgb) -- */}
      {modal?.jenis === "input" && (
        <ModalInputKgb
          pegawai={modal.pegawai}
          ulang={modal.ulang}
          dasarAwal={modal.dasarAwal}
          dasarDariRiwayat
          onTutup={tutupModal}
          onBerhasil={aksiBerhasil}
          onArsipKgb={() => setModal({ jenis: "arsip", pegawai: modal.pegawai })}
        />
      )}
      {modal?.jenis === "arsip" && (
        <ModalArsipKgb pegawai={modal.pegawai} onTutup={tutupModal} onBerhasil={aksiBerhasil} />
      )}
      {modal?.jenis === "buat_sk" && (
        <ModalBuatSk
          kgbId={modal.kgbId}
          status={modal.status}
          pegawai={modal.pegawai}
          ringkasan={modal.ringkasan}
          dasarAwal={modal.dasarAwal}
          skBaruAwal={{ nomorSurat: modal.nomorSkBaru, tanggalSurat: modal.tanggalSkBaru }}
          onTutup={tutupModal}
          onBerhasil={aksiBerhasil}
        />
      )}
      {modal?.jenis === "unggah_sk" && (
        <ModalUnggahSk
          kgbId={modal.kgbId}
          status={modal.status}
          pegawai={modal.pegawai}
          onTutup={tutupModal}
          onBerhasil={aksiBerhasil}
        />
      )}
      {modal?.jenis === "batalkan" && (
        <ModalBatalkanKgb kgbId={modal.kgbId} pegawai={modal.pegawai} onTutup={tutupModal} onBerhasil={aksiBerhasil} />
      )}
      {modal?.jenis === "riwayat" && <ModalRiwayatKgb pegawai={modal.pegawai} onTutup={tutupModal} />}

      {/* Pesan hasil aksi. Wadah live region selalu ada agar pesan baru dibacakan pembaca layar. */}
      <div role="status" aria-live="polite" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-40 pointer-events-none">
        {pesanBerhasil && (
          <div className="dsb-toast">
            <p className="flex-1">{pesanBerhasil}</p>
            <button type="button" onClick={() => setPesanBerhasil(null)} aria-label="Tutup pesan"
              className="shrink-0 opacity-60 hover:opacity-100 transition" style={{ color: "var(--st-green)" }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const role = useRole();
  if (role === ROLES.SDM_HUKDIS) return <DashboardHukdis />;
  if (role === ROLES.KEUANGAN)   return <DashboardKeuangan />;
  if (role === ROLES.ADMIN_UPT)  return <DashboardUpt />;
  return <DashboardMain />;
}
