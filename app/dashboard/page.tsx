"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRole, useDashUser } from "@/app/dashboard/components/RoleContext";
import { ROLES, ROLE_LABEL } from "@/lib/auth";
import dynamic from "next/dynamic";
import type { KartuPapan, KolomPapan } from "@/app/dashboard/components/PapanAntrian";

/* Satu akun hanya memakai satu dashboard peran. Memuatnya sesuai kebutuhan menekan kerja server per
   permintaan dan biaya mulai isolate; tampilan sementaranya memakai kerangka yang sama dengan panel lain. */
const Memuat = () => <div className="dsb-halaman"><div className="dsb-kerangka" style={{ height: 240 }} /></div>;
const DashboardHukdis = dynamic(() => import("@/app/dashboard/components/DashboardHukdis"), { ssr: false, loading: Memuat });
const DashboardKeuangan = dynamic(() => import("@/app/dashboard/components/DashboardKeuangan"), { ssr: false, loading: Memuat });
const DashboardUpt = dynamic(() => import("@/app/dashboard/components/DashboardUpt"), { ssr: false, loading: Memuat });
const PemantauanSatker = dynamic(() => import("@/app/dashboard/components/PemantauanSatker"), { ssr: false });
const PapanAntrian = dynamic(() => import("@/app/dashboard/components/PapanAntrian"), { ssr: false });
import {
  KerangkaDashboard,
  PanelNavy,
  PanelTindakan,
  Stat,
  StripStat,
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
import { SATKER_KANWIL, cariSatker } from "@/lib/satker";
import { namaTampilSatker } from "@/app/dashboard/satker/labelSatker";
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

interface PegawaiKalender {
  id: string;
  tmtKgbBerikutnya: string;
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
   Monthly Strip Calendar
   ----------------------------------------- */

const BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];

function MonthGrid({
  pegawaiKalender,
  selesaiKalender,
  filterMonth,
  onSelect,
}: {
  pegawaiKalender: PegawaiKalender[];
  selesaiKalender: { tmtKgbBerikutnya: string }[];
  filterMonth: string | null;
  onSelect: (month: string | null) => void;
}) {
  const today = new Date();
  const yr = today.getFullYear();

  const grouped: Record<string, number> = {};
  for (const p of pegawaiKalender) {
    const key = kunciBulan(p.tmtKgbBerikutnya);
    grouped[key] = (grouped[key] ?? 0) + 1;
  }

  const selesaiGrouped: Record<string, number> = {};
  for (const p of selesaiKalender) {
    const key = kunciBulan(p.tmtKgbBerikutnya);
    selesaiGrouped[key] = (selesaiGrouped[key] ?? 0) + 1;
  }

  type Tier = "terlambat" | "kritis" | "warn" | "aman" | "empty";
  // Tingkat hanya ditandai titik kecil; warna status tidak mewarnai seluruh ubin.
  const tanda: Record<Tier, { nada?: Nada; cincin?: boolean; label: string }> = {
    terlambat: { nada: "merah", label: "terlambat" },
    kritis:    { nada: "kuning", label: "kritis, batas input 7 hari lagi atau kurang" },
    warn:      { nada: "kuning", cincin: true, label: "batas input 30 hari lagi atau kurang" },
    aman:      { nada: "hijau", label: "aman" },
    empty:     { label: "" },
  };

  return (
    <div className="dsb-bulan-kisi">
      {Array.from({ length: 12 }, (_, mo) => {
        const key = `${yr}-${String(mo + 1).padStart(2, "0")}`;
        const isCurrentMonth = mo === today.getMonth();
        const isPast = mo < today.getMonth();
        const count = grouped[key] ?? 0;
        const done = selesaiGrouped[key] ?? 0;
        const isSelected = filterMonth === key;
        const daysToDeadline = Math.ceil((new Date(yr, mo - 1, 0).getTime() - today.getTime()) / 86400000);
        const allDone = count > 0 && done === count;

        let tier: Tier;
        if ((isPast && count > 0) || (count > 0 && daysToDeadline < 0)) tier = "terlambat";
        else if (count > 0 && daysToDeadline <= 7)  tier = "kritis";
        else if (count > 0 && daysToDeadline <= 30) tier = "warn";
        else if (count > 0)                          tier = "aman";
        else                                         tier = "empty";

        const t = tanda[tier];
        const progressPct = count > 0 ? (done / count) * 100 : 0;

        return (
          <button
            key={key}
            type="button"
            className="dsb-bulan"
            aria-pressed={isSelected}
            data-sekarang={isCurrentMonth ? "" : undefined}
            data-kosong={count === 0 ? "" : undefined}
            aria-label={`${BULAN_ID[mo]} ${yr}: ${count} KGB, ${done} selesai${t.label ? `, ${t.label}` : ""}${isCurrentMonth ? ", bulan ini" : ""}`}
            onClick={() => onSelect(isSelected ? null : key)}
          >
            <span className="dsb-bulan-nama">
              {BULAN_ID[mo]}
              {t.nada && <span className="dsb-titik" data-nada={t.nada} data-cincin={t.cincin ? "" : undefined} aria-hidden="true" />}
            </span>
            <span className="dsb-bulan-baris">
              <span className="dsb-bulan-angka">{count}</span>
              {count > 0 && <span className="dsb-bulan-sub">{allDone ? "selesai" : `${done}/${count}`}</span>}
            </span>
            <span className="dsb-bulan-bar" aria-hidden="true">
              {count > 0 && <span style={{ width: `${progressPct}%` }} />}
            </span>
          </button>
        );
      })}
    </div>
  );
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
type PosisiAntrian = "lewat" | "diproses" | "siap" | "keuangan" | "terkunci" | "selesai";

const URUTAN_POSISI: Record<PosisiAntrian, number> = { lewat: 0, diproses: 1, siap: 2, keuangan: 3, terkunci: 4, selesai: 5 };

function posisiAntrian(p: PegawaiJatuhTempo): PosisiAntrian {
  if (p.statusKGB === "selesai") return "selesai";
  if (p.statusKGB === "menunggu_keuangan") return "keuangan";
  if (p.statusKGB === "sedang_diproses") return "diproses";
  if (p.isLocked) return "terkunci";
  return p.terlambat ? "lewat" : "siap";
}

function cocokTahap(pos: PosisiAntrian, tahap: Tahap): boolean {
  switch (tahap) {
    case "perlu": return pos === "lewat" || pos === "diproses" || pos === "siap";
    case "lewat": return pos === "lewat";
    case "keuangan": return pos === "keuangan";
    case "selesai": return pos === "selesai";
    default: return true;
  }
}

/** Status di tabel antrian: titik dan teks. */
function StatusAntrian({ pos, dibatalkan, skDibuat, buka }: { pos: PosisiAntrian; dibatalkan: boolean; skDibuat: boolean; buka: Date | null }) {
  const [nada, teks]: [Nada | undefined, string] =
    pos === "lewat" ? ["merah", dibatalkan ? "Dibatalkan, lewat batas" : "Lewat batas input"]
    : pos === "siap" ? ["kuning", dibatalkan ? "Dibatalkan, input ulang" : "Belum diproses"]
    : pos === "diproses" ? ["navy", skDibuat ? "SK dibuat, tunggu TTE" : "Sedang diproses"]
    : pos === "keuangan" ? ["ungu", "Menunggu keuangan"]
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
  const [modal, setModal] = useState<ModalAksi | null>(null);
  const [pesanBerhasil, setPesanBerhasil] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  /**
   * Rincian di balik satu angka pada pita ringkasan. Dibuka sebagai jendela agar dasbor tidak
   * ditinggalkan; daftarnya diambil dari antrian kerja, jadi jumlahnya bisa lebih sedikit daripada
   * angka setahun penuh pada kartunya, dan subjudulnya menyebut keduanya.
   */
  const [rincian, setRincian] = useState<
    { judul: string; nada: "navy" | "amber" | "hijau"; posisi: PosisiAntrian[]; tahap: Tahap; dariTahun?: string } | null
  >(null);
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
  const today = new Date();
  const tahunIni = today.getFullYear();

  // Kalender dihitung dari daftar yang sama dengan antrian (TMT efektif), sehingga angkanya selalu cocok.
  const pegawaiKalenderDerived: PegawaiKalender[] = pegawaiJatuhTempo.map((p) => ({
    id: p.id,
    tmtKgbBerikutnya: p.tmtKgbBerikutnya,
  }));
  const selesaiKalenderDerived = pegawaiJatuhTempo
    .filter((p) => p.statusKGB === "selesai")
    .map((p) => ({ tmtKgbBerikutnya: p.tmtKgbBerikutnya }));

  /* -- Antrian kerja: satu daftar untuk semua tahap, menggantikan tabel deadline dan kanban -- */
  const qAntrian = cariAntrian.trim().toLowerCase();
  const dalamBulan = pegawaiJatuhTempo
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
  const pilihanTahap: { nilai: Tahap; label: string; nada?: "merah" }[] = [
    { nilai: "perlu", label: "Perlu diproses" },
    { nilai: "lewat", label: "Lewat batas", nada: "merah" },
    { nilai: "keuangan", label: "Di keuangan" },
    { nilai: "selesai", label: "Selesai" },
    { nilai: "semua", label: "Semua" },
  ];
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
      isi: <><strong>{terlambatList.length} KGB belum diinput</strong> padahal batas input SK sudah lewat, berisiko rapelan.</>,
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

  // KGB dengan TMT dua bulan ke depan yang belum dikirim ke keuangan
  {
    const h2Target = new Date(today.getFullYear(), today.getMonth() + 2, 1);
    const kunciH2 = `${h2Target.getFullYear()}-${String(h2Target.getMonth() + 1).padStart(2, "0")}`;
    const belumKirimH2 = pegawaiJatuhTempo.filter(
      (p) => kunciBulan(p.tmtKgbBerikutnya) === kunciH2 && p.statusKGB !== "menunggu_keuangan" && p.statusKGB !== "selesai" && !p.isLocked,
    );
    const h2BulanNama = h2Target.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    const deadlineBulanNama = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    if (belumKirimH2.length > 0)
      tindakan.push({
        id: "h2-deadline",
        nada: "biru",
        isi: <><strong>{belumKirimH2.length} KGB berlaku {h2BulanNama}</strong> belum dikirim ke keuangan. Kirim sebelum akhir {deadlineBulanNama}.</>,
        aksi: { label: "Tampilkan", onClick: bukaAntrian("perlu", kunciH2) },
      });
  }

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
    const pindah: Partial<Record<KolomPapan, string>> = {};
    if (kolom === "input") {
      pindah.proses = dibatalkan ? "Input ulang KGB" : "Input KGB";
      if (pos === "lewat") pindah.selesai = "Arsip, SK sudah terbit di luar SIM-KGB";
    }
    if (kolom === "proses" && p.kgbId) {
      pindah.keuangan = p.skSudahDibuat ? "Unggah SK TTE" : "Buat SK dulu";
      pindah.input = "Batalkan proses";
    }
    const tanda: NonNullable<KartuPapan["tanda"]> = [];
    if (kolom === "proses") tanda.push(p.skSudahDibuat ? { teks: "SK dibuat, tunggu TTE", nada: "navy" } : { teks: "Perlu buat SK" });
    if (dibatalkan) tanda.push({ teks: "Dibatalkan", nada: "merah" });
    if (p.flagRapelan && pos !== "selesai") tanda.push({ teks: "Berpotensi rapelan", nada: "kuning" });
    if (p.statusHukdis) tanda.push({ teks: `Hukdis${p.tanggalHukdisBerakhir ? ` s.d. ${formatTanggalId(p.tanggalHukdisBerakhir, { day: "numeric", month: "short" })}` : ""}`, nada: "merah" });
    const [catatan, catatanNada]: [string | undefined, Nada | undefined] =
      pos === "terkunci" ? [buka ? `dibuka ${formatTanggalId(buka, { day: "numeric", month: "short" })}` : "belum dibuka", undefined]
      : pos === "keuangan" || pos === "selesai" ? [undefined, undefined]
      : hari < 0 ? [`lewat batas ${-hari} hari`, "merah"]
      : hari <= 7 ? [hari === 0 ? "batas hari ini" : `batas ${hari} hari lagi`, "merah"]
      : [`batas ${formatTanggalId(p.deadlineSDM, { day: "numeric", month: "short" })}`, undefined];
    return {
      id: p.id,
      kolom,
      nama: p.nama,
      sub: `${p.golonganRuang} · ${satker ? namaTampilSatker(satker) : p.unitKerja}`,
      // Penanda asal, bukan singkatan nama satker: nama satker tetap utuh pada baris di bawahnya.
      asal: { teks: satker?.jenis === "kanwil" ? "Kanwil" : "UPT", kanwil: satker?.jenis === "kanwil" },
      judulSub: p.unitKerja ?? undefined,
      tmt: `TMT ${formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}`,
      catatan,
      catatanNada,
      nada: pos === "lewat" ? "merah" : undefined,
      tanda,
      aksi: tombol ? <div className="dsb-aksi" style={{ flexWrap: "wrap", justifyContent: "flex-start" }}>{tombol}</div> : undefined,
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
    } else if (dari === "proses" && ke === "keuangan" && p.kgbId) {
      if (p.skSudahDibuat) setModal({ jenis: "unggah_sk", kgbId: p.kgbId, status: p.statusKGB ?? "", pegawai: pegawaiModal(p) });
      else bukaBuatSk(p);
    } else if (dari === "proses" && ke === "input" && p.kgbId) {
      setModal({ jenis: "batalkan", kgbId: p.kgbId, pegawai: pegawaiModal(p) });
    }
  }

  /** Tombol aksi baris antrian menurut posisinya. */
  function aksiBaris(p: PegawaiJatuhTempo, pos: PosisiAntrian) {
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
          {p.skSudahDibuat && (
            <button type="button" className="dsb-tombol dsb-tombol-kecil" data-nada="hijau" onClick={() => setModal({ jenis: "unggah_sk", kgbId, status: p.statusKGB ?? "", pegawai: pegawaiModal(p) })}>
              Unggah TTE
            </button>
          )}
          <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={() => bukaBuatSk(p)}>
            Buat SK
          </button>
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

  const pctKgbSelesai = stats.kgbTahunIni > 0 ? Math.round((stats.selesai / stats.kgbTahunIni) * 100) : 0;
  const menungguKeuangan = Math.min(stats.menungguKeuangan ?? 0, stats.sedangDiproses);
  const nama = namaSapaan(dashUser.nama, ROLE_LABEL[role]);
  const rincianRapelan = [
    stats.rapelanBerisiko > 0 ? `${terlambatList.length} belum diinput` : "Tidak ada potensi rapelan",
    stats.rapelanKonfirmasi > 0 ? `${stats.rapelanKonfirmasi} ditetapkan keuangan` : null,
  ].filter(Boolean).join(" · ");

  return (
    <>
    <div className="dsb-halaman" data-muat-layar="">

      {/* -- Pita: sapaan dan angka alur KGB tahun ini -- */}
      <PanelNavy
        label={`Dashboard ${ROLE_LABEL[role] ?? "SIM-KGB"}`}
        judul={`${sapaanWita()}${nama ? `, ${nama}` : ""}`}
        sub={<>
          {tanggalPanjangWita()} · {stats.totalPegawai} pegawai aktif
          {stats.totalHukdis > 0 && <> · {stats.totalHukdis} hukdis aktif</>}
        </>}
        diperbarui={lastRefresh}
        onMuatUlang={handleManualRefresh}
        memuat={refreshing}
      >
        <StripStat>
          <Stat
            nada="kuning"
            onClick={() =>
              setRincian({
                judul: "Belum diproses",
                nada: "amber",
                posisi: ["lewat", "siap", "terkunci"],
                tahap: "perlu",
                dariTahun: `${stats.belumDiproses} dari ${stats.kgbTahunIni} KGB ${tahunIni}`,
              })
            }
            label="Belum diproses"
            angka={stats.belumDiproses}
            satuan={`dari ${stats.kgbTahunIni} KGB ${tahunIni}`}
            meta={terlambatList.length > 0 ? `${terlambatList.length} lewat batas input` : "Semua masih dalam jadwal"}
            metaNada={terlambatList.length > 0 ? "merah" : "hijau"}
          />
          <Stat
            nada="biru"
            onClick={() =>
              setRincian({
                judul: "Dalam proses",
                nada: "navy",
                posisi: ["diproses", "keuangan"],
                tahap: "keuangan",
                dariTahun: `${stats.sedangDiproses} sedang berjalan`,
              })
            }
            label="Dalam proses"
            angka={stats.sedangDiproses}
            meta={menungguKeuangan > 0 ? `${menungguKeuangan} di keuangan` : "Tidak ada yang di keuangan"}
            metaNada={menungguKeuangan > 0 ? "ungu" : undefined}
          />
          <Stat
            nada="hijau"
            onClick={() =>
              setRincian({
                judul: "Selesai",
                nada: "hijau",
                posisi: ["selesai"],
                tahap: "selesai",
                dariTahun: `${stats.selesai} dari ${stats.kgbTahunIni} KGB ${tahunIni}`,
              })
            }
            label="Selesai"
            angka={stats.selesai}
            satuan={`/ ${stats.kgbTahunIni} · ${pctKgbSelesai}%`}
            progres={pctKgbSelesai}
          />
          <Stat
            nada="merah"
            onClick={bukaRapelan}
            label="Berpotensi rapelan"
            angka={stats.rapelanBerisiko}
            meta={rincianRapelan}
            metaNada={stats.rapelanBerisiko > 0 ? "kuning" : "hijau"}
            sorot={stats.rapelanBerisiko > 0}
          />
        </StripStat>
      </PanelNavy>

      <div className="dsb-dasbor-isi">

        {/* -- Antrian kerja KGB -- */}
        <section id="antrian-kerja" className="dsb-panel dsb-antrian dsb-tujuan dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="judul-antrian">
          <div className="dsb-panel-kepala">
            <h2 id="judul-antrian" className="dsb-panel-judul">
              Antrian kerja KGB <small>{tampilan === "papan" ? dalamBulan.length : antrian.length}</small>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {filterMonth && (
                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="lembut" onClick={() => setFilterMonth(null)} aria-label={`Hapus saringan TMT ${namaBulanFilter}`}>
                  TMT {namaBulanFilter}
                  <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
              <div className="dsb-segmen" role="group" aria-label="Tampilan antrian">
                <button type="button" aria-pressed={tampilan === "daftar"} onClick={() => pilihTampilan("daftar")} title="Tampilan daftar">
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                  Daftar
                </button>
                <button type="button" aria-pressed={tampilan === "papan"} onClick={() => pilihTampilan("papan")} title="Tampilan papan (kanban)">
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></svg>
                  Papan
                </button>
              </div>
            </div>
          </div>

          <div className="dsb-alat" style={{ padding: "10px 16px", borderBottom: "1px solid var(--ln2)" }}>
            {tampilan === "daftar" ? (
              <div className="dsb-segmen" role="group" aria-label="Saring tahap">
                {pilihanTahap.map((t) => (
                  <button key={t.nilai} type="button" aria-pressed={tahap === t.nilai} data-nada={t.nada} onClick={() => setTahap(t.nilai)}>
                    {t.label} <span style={{ color: "var(--dt5)" }}>{jumlahTahap(t.nilai)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span className="dsb-kecil" style={{ fontSize: "12.5px", color: "var(--dt4)" }}>
                <span className="dsb-hanya-lebar">Seret kartu ke kolom lain untuk membuka aksinya. Klik judul kolom untuk menciutkan.</span>
                <span className="dsb-hanya-sempit">Geser mendatar untuk kolom lain; aksi ada di tombol kartu.</span>
              </span>
            )}
            <input
              type="search"
              className="dsb-cari"
              style={{ flex: "0 1 220px", marginLeft: "auto" }}
              aria-label="Cari di antrian"
              placeholder="Cari nama, NIP, satker"
              value={cariAntrian}
              onChange={(e) => setCariAntrian(e.target.value)}
            />
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
              <table className="dsb-tabel" style={{ minWidth: "700px" }}>
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
                    return (
                      <tr key={p.id} className={pos === "terkunci" ? "dsb-redup" : undefined} style={{ background: pos === "lewat" ? "var(--tint-red-bg)" : undefined }}>
                        <td style={{ maxWidth: "210px" }}>
                          <p className="dsb-nama truncate" style={{ margin: 0 }} title={p.jabatan}>{p.nama}</p>
                          <p className="dsb-kecil truncate" style={{ margin: 0 }} title={p.unitKerja ?? undefined}>
                            {p.golonganRuang} · {satker ? namaTampilSatker(satker) : p.unitKerja}
                          </p>
                        </td>
                        <td className="whitespace-nowrap">
                          {formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}
                          {pos !== "selesai" && pos !== "keuangan" && (
                            <p className="dsb-kecil" style={{ margin: 0, color: pos === "lewat" || (hari >= 0 && hari <= 7) ? "var(--st-red)" : undefined }}>
                              Batas {formatTanggalId(p.deadlineSDM, { day: "numeric", month: "short" })} ·{" "}
                              {pos === "terkunci" ? "belum dibuka" : hari < 0 ? `lewat ${-hari} hari` : hari === 0 ? "hari ini" : `${hari} hari lagi`}
                            </p>
                          )}
                        </td>
                        <td>
                          <StatusAntrian pos={pos} dibatalkan={p.statusKGB === "ditolak"} skDibuat={p.skSudahDibuat} buka={buka ?? null} />
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
            <span>{tampilan === "papan" ? "Aksi tetap lewat konfirmasi di jendela aksi; tombol di kartu melakukan hal yang sama." : "Urut: lewat batas, sedang diproses, lalu TMT terdekat."}</span>
            <Link href={tahap === "lewat" ? "/dashboard/kgb?rapelan=1" : "/dashboard/kgb"} className="dsb-tautan">Buka Proses KGB →</Link>
          </div>
        </section>

        {/* -- Kolom pendamping: tindakan, kalender, satker -- */}
        <aside className="dsb-samping dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-label="Ringkasan pendamping">
          <PanelTindakan daftar={tindakan} kosong="Tidak ada KGB yang perlu ditindaklanjuti saat ini." lainnyaHref="/dashboard/notifikasi" />

          <section className="dsb-panel" aria-labelledby="judul-kgb-bulan">
            <div className="dsb-panel-kepala">
              <h2 id="judul-kgb-bulan" className="dsb-panel-judul">KGB per bulan <small>{tahunIni}</small></h2>
              {filterMonth && <button type="button" className="dsb-tautan" onClick={() => setFilterMonth(null)}>Semua bulan</button>}
            </div>
            <div className="dsb-panel-isi flex flex-col gap-3">
              <MonthGrid pegawaiKalender={pegawaiKalenderDerived} selesaiKalender={selesaiKalenderDerived} filterMonth={filterMonth} onSelect={(m) => { setFilterMonth(m); setTahap("semua"); }} />
              <div className="dsb-legenda">
                <span><span className="dsb-titik" data-nada="merah" aria-hidden="true" />Terlambat</span>
                <span><span className="dsb-titik" data-nada="kuning" aria-hidden="true" />≤7 hari</span>
                <span><span className="dsb-titik" data-nada="kuning" data-cincin="" aria-hidden="true" />≤30 hari</span>
                <span><span className="dsb-titik" data-nada="hijau" aria-hidden="true" />Aman</span>
                <span><span className="dsb-titik" data-nada="emas" data-cincin="" aria-hidden="true" />Bulan ini</span>
              </div>
            </div>
          </section>

          <PemantauanSatker versi={lastRefresh?.getTime()} />
        </aside>
      </div>

    </div>

      {/* ── Status Rapelan ── */}
      {rincian && (() => {
        const daftar = pegawaiJatuhTempo.filter((p) => rincian.posisi.includes(posisiAntrian(p)));
        const tampil = daftar.slice(0, 12);
        const tutup = () => setRincian(null);
        return (
          <KerangkaModal
            judul={rincian.judul}
            subjudul={`${daftar.length} pegawai pada antrian kerja${rincian.dariTahun ? ` · ${rincian.dariTahun}` : ""}`}
            nada={rincian.nada}
            ukuran="md"
            onTutup={tutup}
            kaki={
              <>
                <button type="button" className="kgbm-tombol kgbm-kedua" onClick={tutup}>
                  Tutup
                </button>
                <button
                  type="button"
                  className="kgbm-tombol kgbm-utama"
                  onClick={() => { tutup(); bukaAntrian(rincian.tahap)(); }}
                >
                  Tampilkan di antrian
                </button>
              </>
            }
          >
            {daftar.length === 0 ? (
              <p className="dsb-kosong">Tidak ada pegawai pada tahap ini.</p>
            ) : (
              <ul className="dsb-log-ringkas">
                {tampil.map((p) => {
                  const satker = p.unitKerja?.trim() ? cariSatker(p.unitKerja) : SATKER_KANWIL;
                  const pos = posisiAntrian(p);
                  return (
                    <li key={p.id}>
                      <span className="dsb-titik" data-nada={pos === "lewat" ? "merah" : pos === "selesai" ? "hijau" : undefined} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="dsb-nama">{p.nama}</span>
                        <span className="dsb-kecil"> · {p.golonganRuang}</span>
                        <p className="dsb-kecil" style={{ margin: 0 }}>
                          {satker ? namaTampilSatker(satker) : p.unitKerja} · TMT{" "}
                          {formatTanggalId(p.tmtKgbBerikutnya, { day: "numeric", month: "short", year: "numeric" })}
                          {pos === "lewat" && <span style={{ color: "var(--st-red)" }}> · lewat batas input</span>}
                        </p>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {daftar.length > tampil.length && (
              <p className="dsb-kecil" style={{ margin: 0 }}>
                dan {daftar.length - tampil.length} pegawai lainnya. Tekan Tampilkan di antrian untuk melihat semuanya.
              </p>
            )}
          </KerangkaModal>
        );
      })()}

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


      {/* -- Modal aksi KGB bersama (app/dashboard/components/kgb) -- */}
      {modal?.jenis === "input" && (
        <ModalInputKgb
          pegawai={modal.pegawai}
          ulang={modal.ulang}
          dasarAwal={modal.dasarAwal}
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
