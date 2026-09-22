"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRole, useDashUser } from "@/app/dashboard/components/RoleContext";
import { ROLES, ROLE_LABEL } from "@/lib/auth";
import DashboardHukdis from "@/app/dashboard/components/DashboardHukdis";
import DashboardKeuangan from "@/app/dashboard/components/DashboardKeuangan";
import {
  KepalaKartu,
  KerangkaDashboard,
  KisiKpi,
  Kpi,
  PanelNavy,
  namaDepan,
  sapaanWita,
  tanggalPanjangWita,
  type Nada,
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
/* -----------------------------------------
   Interfaces
   ----------------------------------------- */

interface PegawaiJatuhTempo {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  golonganRuang: string;
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

interface TrenBulanan {
  bulan: string;
  selesai: number;
  diproses: number;
  terlambat: number;
  mendatang: number;
  isFuture?: boolean;
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
  trenBulanan: TrenBulanan[];
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
   Tren Line Chart
   ----------------------------------------- */

function TrenLineChart({ data }: { data: TrenBulanan[] }) {
  // viewBox dekat ukuran tampil di kartu (sekitar 340 px) agar teks sumbu tidak ikut mengecil
  const VW = 360;
  const VH = 230;
  const padL = 26;
  const padR = 24;
  const padT = 20;
  const padB = 32;
  const cW = VW - padL - padR;
  const cH = VH - padT - padB;
  const n = data.length;
  const maxVal = Math.max(...data.flatMap((d) => [d.selesai, d.diproses, d.terlambat, d.mendatang ?? 0]), 1);

  const xOf = (i: number) => padL + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
  const yOf = (v: number) => padT + cH - (v / maxVal) * cH;

  // Index of the first future month (isFuture === true)
  const futureStartIdx = data.findIndex((d) => d.isFuture);
  // x position of the divider line (between last past/current and first future)
  const dividerX = futureStartIdx > 0 ? (xOf(futureStartIdx - 1) + xOf(futureStartIdx)) / 2 : null;

  const series = [
    { key: "selesai" as const, color: "var(--st-green)", fillOpacity: 0.08, label: "Selesai", futureOnly: false },
    { key: "diproses" as const, color: "var(--accent)", fillOpacity: 0.08, label: "Diproses", futureOnly: false },
    { key: "terlambat" as const, color: "var(--st-red)", fillOpacity: 0.08, label: "Rapelan", futureOnly: false },
    { key: "mendatang" as const, color: "var(--st-violet)", fillOpacity: 0.08, label: "Mendatang", futureOnly: true },
  ];

  const linePath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(" ");

  const areaPath = (vals: number[]) => {
    const base = padT + cH;
    return `${linePath(vals)} L ${xOf(n - 1).toFixed(1)} ${base} L ${xOf(0).toFixed(1)} ${base} Z`;
  };

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div>
      <div className="dsb-legenda mb-3">
        {series.filter((s) => !s.futureOnly).map((s) => (
          <span key={s.label}><span className="dsb-legenda-garis" style={{ background: s.color }} aria-hidden="true" />{s.label}</span>
        ))}
        {futureStartIdx > 0 && (
          <span><span className="dsb-legenda-garis" style={{ background: "none", height: 0, borderTop: "2px dashed var(--st-violet)" }} aria-hidden="true" />Mendatang (proyeksi)</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{ minWidth: "280px", display: "block", overflow: "visible" }}>
          {/* Future background shading */}
          {dividerX !== null && (
            <rect
              x={dividerX}
              y={padT}
              width={VW - padR - dividerX}
              height={cH}
              fill="var(--sub)"
            />
          )}

          {/* Grid */}
          {gridSteps.map((pct) => {
            const y = padT + cH - pct * cH;
            const val = Math.round(pct * maxVal);
            return (
              <g key={pct}>
                <line x1={padL} y1={y} x2={VW - padR} y2={y} stroke="var(--ln2)" strokeWidth="1" />
                {pct > 0 && (
                  <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize="11" fill="var(--dt5)">{val}</text>
                )}
              </g>
            );
          })}

          {/* Divider line between past and future */}
          {dividerX !== null && (
            <line
              x1={dividerX}
              y1={padT}
              x2={dividerX}
              y2={padT + cH}
              stroke="var(--ln0)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          )}

          {/* Area fills : past series only (non-futureOnly) */}
          {series.filter((s) => !s.futureOnly).map((s) => {
            const pastVals = data.map((d) => d.isFuture ? 0 : d[s.key]);
            return (
              <path
                key={`area-${s.key}`}
                d={areaPath(pastVals)}
                fill={s.color}
                fillOpacity={s.fillOpacity}
              />
            );
          })}

          {/* Lines : past series solid, mendatang series dashed in future only */}
          {series.map((s) => {
            if (s.futureOnly) {
              // mendatang: only draw in future months
              if (futureStartIdx <= 0) return null;
              const futureVals = data.slice(futureStartIdx).map((d) => d[s.key] ?? 0);
              const dashPath = futureVals.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(futureStartIdx + i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(" ");
              return (
                <path
                  key={`line-${s.key}`}
                  d={dashPath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray="6 3"
                />
              );
            }
            // Past series: solid only up to current month (futureStartIdx - 1)
            const endIdx = futureStartIdx > 0 ? futureStartIdx : n - 1;
            const solidVals = data.slice(0, endIdx + 1).map((d) => d[s.key]);
            const solidPath = solidVals.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(v).toFixed(1)}`).join(" ");
            return (
              <path
                key={`line-${s.key}`}
                d={solidPath}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          {/* Dots + value labels */}
          {series.map((s) =>
            data.map((d, i) => {
              const isFut = !!d.isFuture;
              // futureOnly series: only show in future months
              if (s.futureOnly && !isFut) return null;
              // past series: only show in past/current months
              if (!s.futureOnly && isFut) return null;
              const v = (d[s.key] ?? 0) as number;
              const cx = xOf(i);
              const cy = yOf(v);
              return (
                <g key={`${s.key}-${i}`}>
                  <circle
                    cx={cx} cy={cy} r="3.5"
                    fill={isFut ? "var(--tint-blue-bg)" : "var(--card)"}
                    stroke={s.color}
                    strokeWidth="1.8"
                    opacity={isFut ? 0.8 : 1}
                  />
                  {v > 0 && (
                    <text x={cx} y={cy - 8} textAnchor="middle" fontSize="11" fill={s.color} fontWeight="600" opacity={isFut ? 0.7 : 1}>{v}</text>
                  )}
                </g>
              );
            }).filter(Boolean)
          )}

          {/* X-axis labels : current month (last non-future) is bold */}
          {data.map((d, i) => {
            const isCurrentMonth = !d.isFuture && (i === n - 1 || data[i + 1]?.isFuture);
            return (
              <text
                key={d.bulan}
                x={xOf(i)}
                y={VH - 8}
                textAnchor="middle"
                fontSize="11"
                fill={d.isFuture ? "var(--dt5)" : isCurrentMonth ? "var(--dtn)" : "var(--dt4)"}
                fontWeight={isCurrentMonth ? "700" : "400"}
              >
                {d.bulan}
              </text>
            );
          })}
        </svg>
      </div>
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

function pegawaiModal(p: PegawaiJatuhTempo): PegawaiModal {
  return { id: p.id, nama: p.nama, nip: p.nip, jabatan: p.jabatan, golonganRuang: p.golonganRuang };
}


function DashboardMain() {
  const dashUser = useDashUser();
  const role = useRole();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [filterBulan, setFilterBulan] = useState<0 | "bulan_ini" | "terlambat">("bulan_ini");
  const [filterMonth, setFilterMonth] = useState<string | null>(null);
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());
  const [kgbPage, setKgbPage] = useState(0);
  const KGB_PAGE_SIZE = 8;
  const [modal, setModal] = useState<ModalAksi | null>(null);
  const [pesanBerhasil, setPesanBerhasil] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [showRapelanPopup, setShowRapelanPopup] = useState(false);
  const [rapelanKonfirmasiList, setRapelanKonfirmasiList] = useState<{ id: string; pegawai: { nama: string; nip: string }; tmtKgbBaru: string; golonganBaru: string; gajiPokokBaru: number; konfirmasiKeuanganAt: string | null }[]>([]);
  const [rapelanKonfirmasiLoading, setRapelanKonfirmasiLoading] = useState(false);

  const fetchDashboard = (silent = false) => {
    if (!silent) setApiError(null);
    fetch("/api/dashboard")
      .then((r) => r.json() as Promise<(Partial<DashboardData> & { error?: string }) | null>)
      .then((d) => {
        if (d && d.stats && Array.isArray(d.pegawaiJatuhTempo)) {
          setData(d as DashboardData);
          setApiError(null);
          setLastRefresh(new Date());
        } else {
          setApiError(d?.error ?? "Respons tidak valid dari server");
        }
        setLoading(false);
        setRefreshing(false);
      })
      .catch((e) => { setApiError(e?.message ?? "Gagal menghubungi server"); setLoading(false); setRefreshing(false); });
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

  const { stats, pegawaiJatuhTempo, trenBulanan, followupNotifs } = data;

  // Derive calendar counts from pegawaiJatuhTempo so newly added employees (no riwayatKGB yet)
  // are counted consistently with the table. pegawaiJatuhTempo uses effectiveTmt (tmtKgbBaru for
  // selesai employees) so the month assignment is already correct.
  const pegawaiKalenderDerived: PegawaiKalender[] = pegawaiJatuhTempo.map((p) => ({
    id: p.id,
    tmtKgbBerikutnya: p.tmtKgbBerikutnya,
  }));
  const selesaiKalenderDerived = pegawaiJatuhTempo
    .filter((p) => p.statusKGB === "selesai")
    .map((p) => ({ tmtKgbBerikutnya: p.tmtKgbBerikutnya }));

  /* -- Banners -- */
  const ikonPesan = (d: React.ReactNode) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
  );
  const IKON_PERINGATAN = ikonPesan(<><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>);
  const IKON_JAM = ikonPesan(<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>);
  const banners: { id: string; nada: "merah" | "kuning" | "biru"; icon: React.ReactNode; message: React.ReactNode }[] = [];

  const terlambatList = pegawaiJatuhTempo.filter((p) => p.terlambat);
  if (terlambatList.length > 0)
    banners.push({
      id: "terlambat",
      nada: "merah",
      icon: IKON_PERINGATAN,
      message: <><strong>{terlambatList.length} pegawai</strong> melewati batas input SK dan belum diproses, berisiko selisih gaji (rapelan). Segera selesaikan.</>,
    });

  const deadline7 = pegawaiJatuhTempo.filter((p) => p.statusKGB !== "selesai" && !p.terlambat && daysDiff(p.deadlineSDM) >= 0 && daysDiff(p.deadlineSDM) <= 7);
  if (deadline7.length > 0)
    banners.push({
      id: "deadline7",
      nada: "kuning",
      icon: IKON_JAM,
      message: <><strong>{deadline7.length} pegawai</strong> batas input SK-nya tinggal kurang dari 7 hari, segera proses sebelum terlambat.</>,
    });

  if (stats.totalHukdis > 0)
    banners.push({
      id: "hukdis",
      nada: "merah",
      icon: ikonPesan(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
      message: <><strong>{stats.totalHukdis} pegawai</strong> sedang menjalani Hukuman Disiplin. KGB diblokir otomatis hanya untuk jenis <em>Penundaan KGB</em>. <Link href="/dashboard/pegawai">Lihat daftar</Link></>,
    });

  // H-2 banner: KGB dengan TMT bulan depan+1 (= 2 bulan dari sekarang) yang belum dikirim ke keuangan
  {
    const todayH2 = new Date();
    const h2Target = new Date(todayH2.getFullYear(), todayH2.getMonth() + 2, 1);
    const belumKirimH2 = pegawaiJatuhTempo.filter((p) => {
      const tmt = tanggalKalender(p.tmtKgbBerikutnya);
      return (
        !!tmt &&
        tmt.getFullYear() === h2Target.getFullYear() &&
        tmt.getMonth()    === h2Target.getMonth()    &&
        p.statusKGB !== "menunggu_keuangan"          &&
        p.statusKGB !== "selesai"                    &&
        !p.isLocked
      );
    });
    const h2BulanNama = h2Target.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    const deadlineBulanNama = new Date(todayH2.getFullYear(), todayH2.getMonth(), 1)
      .toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    if (belumKirimH2.length > 0)
      banners.push({
        id: "h2-deadline",
        nada: "biru",
        icon: ikonPesan(<><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></>),
        message: <>
          <strong>{belumKirimH2.length} KGB berlaku {h2BulanNama}</strong> belum dikirim ke keuangan.
          {" "}Kirim SK ke keuangan sebelum akhir <strong>{deadlineBulanNama}</strong>. Setelah itu masuk masa konfirmasi keuangan.
        </>,
      });
  }

  // Follow-up banners dari keuangan
  for (const notif of (followupNotifs ?? [])) {
    banners.push({
      id: `followup-${notif.id}`,
      nada: "kuning",
      icon: ikonPesan(<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.3a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17.92z" />),
      message: <>{notif.pesan}</>,
    });
  }

  const visibleBanners = banners.filter((b) => !dismissedBanners.has(b.id));

  /* -- KGB Jatuh Tempo filter : berdasarkan DEADLINE SDM bukan TMT -- */
  const today = new Date();

  // "Bulan Berjalan" = masa unlock SDM bulan ini → TMT = bulan ini + 2
  const unlockTmtMonth = (today.getMonth() + 2) % 12;
  const unlockTmtYear  = today.getMonth() + 2 > 11 ? today.getFullYear() + 1 : today.getFullYear();

  const filtered = pegawaiJatuhTempo.filter((p) => {
    // Kalender click override semua button filter
    if (filterMonth) return kunciBulan(p.tmtKgbBerikutnya) === filterMonth;
    if (filterBulan === 0) return true;
    if (filterBulan === "terlambat") return p.terlambat;
    if (filterBulan === "bulan_ini") {
      const tmt = tanggalKalender(p.tmtKgbBerikutnya);
      return !!tmt && tmt.getMonth() === unlockTmtMonth && tmt.getFullYear() === unlockTmtYear;
    }
    return true;
  });

  /* -- Progress -- */
  const totalKGBAktif = stats.selesai + stats.sedangDiproses + stats.belumDiproses + stats.ditolak;
  const progressPct = totalKGBAktif > 0 ? Math.round((stats.selesai / totalKGBAktif) * 100) : 0;

  function tutupModal() {
    setModal(null);
  }

  function aksiBerhasil(pesan: string) {
    setModal(null);
    setPesanBerhasil(pesan);
    fetchDashboard(true);
  }

  const unlockLabel = new Date(unlockTmtYear, unlockTmtMonth, 1)
    .toLocaleDateString("id-ID", { month: "short", year: "numeric" });
  const filterButtons: { value: 0 | "bulan_ini" | "terlambat"; label: string }[] = [
    { value: 0,           label: "Semua" },
    { value: "bulan_ini", label: `Berlaku ${unlockLabel}` },
    { value: "terlambat", label: "Terlambat" },
  ];

  function bukaRapelan() {
    setShowRapelanPopup(true);
    setRapelanKonfirmasiLoading(true);
    fetch("/api/kgb?rapelanDitetapkan=true")
      .then((r) => r.json() as Promise<unknown>)
      .then((d) => setRapelanKonfirmasiList(Array.isArray(d) ? d : []))
      .catch(() => setRapelanKonfirmasiList([]))
      .finally(() => setRapelanKonfirmasiLoading(false));
  }

  const tahunIni = today.getFullYear();
  const pctKgbSelesai = stats.kgbTahunIni > 0 ? Math.round((stats.selesai / stats.kgbTahunIni) * 100) : 0;
  const pctBelum = totalKGBAktif > 0 ? Math.round((stats.belumDiproses / totalKGBAktif) * 100) : 0;
  const namaBulanFilter = filterMonth
    ? (() => {
        const [y, m] = filterMonth.split("-");
        return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
      })()
    : null;

  return (
    <>
    <div className="dsb-halaman">

      {/* -- Panel navy: sapaan, ringkasan hari ini, dan KPI -- */}
      <PanelNavy
        label={`Dashboard · ${ROLE_LABEL[role] ?? "SIM-KGB"}`}
        judul={`${sapaanWita()}${namaDepan(dashUser.nama) ? `, ${namaDepan(dashUser.nama)}` : ""}`}
        sub={<>{tanggalPanjangWita()} · Monitoring KGB Kanwil Ditjenpas Kalimantan Selatan</>}
        chips={[
          stats.belumDiproses > 0
            ? { teks: `${stats.belumDiproses} KGB menunggu diproses`, nada: "kuning" }
            : { teks: "Semua KGB tahun ini tertangani", nada: "hijau" },
          ...(terlambatList.length > 0 ? [{ teks: `${terlambatList.length} melewati batas input`, nada: "merah" as const }] : []),
          { teks: `${stats.selesai} dari ${totalKGBAktif} selesai (${progressPct}%)`, nada: "hijau" },
        ]}
        diperbarui={lastRefresh}
        onMuatUlang={handleManualRefresh}
        memuat={refreshing}
      >
        <KisiKpi>
          <Kpi
            href="/dashboard/pegawai"
            label="Pegawai aktif"
            angka={stats.totalPegawai}
            meta={stats.totalHukdis > 0 ? `${stats.totalHukdis} dalam hukdis aktif` : "Tidak ada hukdis aktif"}
            metaNada={stats.totalHukdis > 0 ? "merah" : undefined}
          />
          <Kpi
            href="/dashboard/kgb"
            label="KGB tahun ini"
            angka={stats.kgbTahunIni}
            satuan={tahunIni}
            progres={pctKgbSelesai}
            meta={`${stats.selesai} selesai · ${stats.sedangDiproses} dalam proses`}
            metaNada="hijau"
          />
          <Kpi
            href="/dashboard/kgb"
            label="Belum diproses"
            angka={stats.belumDiproses}
            satuan={`${pctBelum}%`}
            progres={pctBelum}
            meta={stats.belumDiproses > 0 ? "Proses sekarang" : "Semua sudah diproses"}
            metaNada={stats.belumDiproses > 0 ? "kuning" : "hijau"}
          />
          <Kpi
            onClick={bukaRapelan}
            label="Rapelan terkonfirmasi"
            angka={stats.rapelanKonfirmasi}
            meta={stats.rapelanBerisiko > 0 ? `${stats.rapelanBerisiko} berpotensi rapelan` : "Tidak ada potensi rapelan"}
            metaNada={stats.rapelanBerisiko > 0 ? "kuning" : undefined}
            sorot={stats.rapelanKonfirmasi > 0}
          />
        </KisiKpi>
      </PanelNavy>

      {/* -- Pemberitahuan -- */}
      {visibleBanners.length > 0 && (
        <div className="dsb-pesan-daftar dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
          {visibleBanners.map((b) => (
            <div key={b.id} className="dsb-pesan" data-nada={b.nada}>
              <span className="dsb-pesan-ikon" aria-hidden="true">{b.icon}</span>
              <p>{b.message}</p>
              <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pemberitahuan" onClick={() => setDismissedBanners((prev) => new Set(prev).add(b.id))}>
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* -- KGB per bulan | Status proses | Tren -- */}
      <div className="dsb-kisi-3 dsb-muncul" style={{ "--i": 2 } as React.CSSProperties}>

        {/* KGB per bulan */}
        <section className="dsb-kartu dsb-kartu-isi flex flex-col gap-4" aria-labelledby="judul-kgb-bulan">
          <KepalaKartu
            idJudul="judul-kgb-bulan"
            label={`Tahun ${tahunIni}`}
            judul="KGB per bulan"
            sub="Pilih bulan untuk menyaring daftar pegawai"
            aksi={filterMonth && (
              <button type="button" onClick={() => { setFilterMonth(null); setKgbPage(0); }}
                aria-label={`Hapus filter bulan ${namaBulanFilter}`}
                className="dsb-tombol dsb-tombol-kecil" data-jenis="lembut">
                <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {namaBulanFilter}
              </button>
            )}
          />
          <MonthGrid pegawaiKalender={pegawaiKalenderDerived} selesaiKalender={selesaiKalenderDerived} filterMonth={filterMonth} onSelect={(m) => { setFilterMonth(m); setKgbPage(0); }} />
          <div className="dsb-legenda">
            <span><span className="dsb-titik" data-nada="merah" aria-hidden="true" />Terlambat</span>
            <span><span className="dsb-titik" data-nada="kuning" aria-hidden="true" />Kritis</span>
            <span><span className="dsb-titik" data-nada="kuning" data-cincin="" aria-hidden="true" />≤30 hari</span>
            <span><span className="dsb-titik" data-nada="hijau" aria-hidden="true" />Aman</span>
            <span><span className="dsb-titik" data-nada="emas" data-cincin="" aria-hidden="true" />Bulan ini</span>
          </div>
        </section>

        {/* Status proses */}
        {(() => {
          // stats.sedangDiproses menggabungkan Sedang Diproses dan Menunggu Keuangan; rinciannya dipisah di sini.
          const menungguKeuangan = Math.min(stats.menungguKeuangan ?? 0, stats.sedangDiproses);
          const label = (status: string) => infoStatusKgb(status).label;
          const statusList: { label: string; value: number; nada: Nada; warna: string }[] = [
            { label: label("selesai"),           value: stats.selesai,                           nada: "hijau",  warna: "var(--st-green)" },
            { label: label("sedang_diproses"),   value: stats.sedangDiproses - menungguKeuangan, nada: "navy",   warna: "var(--accent)" },
            { label: label("menunggu_keuangan"), value: menungguKeuangan,                        nada: "ungu",   warna: "var(--st-violet)" },
            { label: label("belum_diproses"),    value: stats.belumDiproses,                     nada: "kuning", warna: "var(--st-amber)" },
            { label: label("ditolak"),           value: stats.ditolak,                           nada: "merah",  warna: "var(--st-red)" },
          ];
          const R = 56;
          const KELILING = 2 * Math.PI * R;
          const infoMsg = stats.selesai === totalKGBAktif && totalKGBAktif > 0
            ? "Semua proses KGB selesai"
            : stats.selesai === 0 ? "Belum ada yang selesai"
            : stats.ditolak > 0 ? `${stats.ditolak} KGB dibatalkan`
            : progressPct >= 75 ? "Hampir selesai"
            : `${stats.sedangDiproses} sedang berjalan`;
          return (
            <section className="dsb-kartu dsb-kartu-isi flex flex-col gap-4" aria-labelledby="judul-status-proses">
              <KepalaKartu idJudul="judul-status-proses" label={`Tahun ${tahunIni}`} judul="Status proses KGB" sub={`${totalKGBAktif} KGB terdaftar tahun ini`} />
              <div className="flex items-center gap-5">
                <div className="dsb-cincin" style={{ width: 112, height: 112 }}>
                  <svg viewBox="0 0 128 128" width="112" height="112" aria-hidden="true">
                    <circle cx="64" cy="64" r={R} fill="none" stroke="var(--ln2)" strokeWidth="8" />
                    {totalKGBAktif > 0 && (
                      <circle cx="64" cy="64" r={R} fill="none" stroke={progressPct >= 100 ? "var(--st-green)" : "var(--accent)"} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${(progressPct / 100) * KELILING} ${KELILING}`} transform="rotate(-90 64 64)"
                        style={{ transition: "stroke-dasharray .8s cubic-bezier(.16,1,.3,1)" }} />
                    )}
                  </svg>
                  <p className="dsb-cincin-angka" style={{ fontSize: "26px" }}>
                    {progressPct}%
                    <span className="dsb-cincin-label">selesai</span>
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="dsb-status-nilai" style={{ fontSize: "22px", fontWeight: 400, letterSpacing: "-0.03em", margin: 0 }}>
                    {stats.selesai} <span style={{ fontSize: "14px", color: "var(--dt4)" }}>dari {totalKGBAktif}</span>
                  </p>
                  <p className="dsb-sub" style={{ marginTop: "6px" }}>{infoMsg}. Target: semua KGB tahun ini selesai.</p>
                </div>
              </div>
              <div className="dsb-status-daftar">
                  {statusList.map((s) => {
                    const pct = totalKGBAktif > 0 ? Math.round((s.value / totalKGBAktif) * 100) : 0;
                    return (
                      <div key={s.label} className="dsb-status-baris">
                        <span className="dsb-status-nama">
                          <span className="dsb-titik" data-nada={s.nada} aria-hidden="true" />
                          <span>{s.label}</span>
                        </span>
                        <span className="dsb-status-nilai">{s.value}</span>
                        <span className="dsb-status-persen">{pct}%</span>
                        <span className="dsb-status-bar" aria-hidden="true">
                          <span style={{ width: `${pct}%`, background: s.warna }} />
                        </span>
                      </div>
                    );
                  })}
              </div>
            </section>
          );
        })()}

        {/* Tren bulanan */}
        {trenBulanan?.length > 0 && (
          <section className="dsb-kartu dsb-kartu-isi flex flex-col gap-4" aria-labelledby="judul-tren">
            <KepalaKartu idJudul="judul-tren" label="Tren" judul="KGB per bulan TMT" sub="Tiga bulan lalu sampai tiga bulan ke depan" />
            <TrenLineChart data={trenBulanan} />
          </section>
        )}

      </div>

      {/* -- Pegawai mendekati deadline | Alur proses -- */}
      <div className="dsb-kisi-dua dsb-muncul" style={{ "--i": 3 } as React.CSSProperties}>

      <section className="dsb-kartu flex flex-col overflow-hidden" aria-labelledby="judul-deadline">
        <div className="dsb-kartu-isi flex flex-col gap-3" style={{ paddingBottom: "14px" }}>
          <KepalaKartu
            idJudul="judul-deadline"
            label="Batas input SDM"
            judul="Pegawai mendekati deadline"
            sub={<>
              {filterMonth
                ? `${filtered.length} pegawai, KGB berlaku ${namaBulanFilter}`
                : filterBulan === "terlambat"
                  ? `${filtered.length} pegawai, batas input sudah terlewat`
                  : filterBulan === "bulan_ini"
                    ? `${filtered.length} pegawai berlaku ${unlockLabel}, SDM kirim bulan ini`
                    : `${filtered.length} pegawai`}
              {filtered.filter((p) => p.terlambat).length > 0 && filterBulan !== "terlambat" && (
                <span style={{ color: "var(--st-red)" }}> · {filtered.filter((p) => p.terlambat).length} terlambat</span>
              )}
            </>}
            aksi={
              <div className="dsb-segmen" role="group" aria-label="Saring daftar pegawai">
                {filterButtons.map((b) => {
                  const isActive = (filterBulan === b.value) && !filterMonth;
                  return (
                    <button
                      key={String(b.value)}
                      type="button"
                      aria-pressed={isActive}
                      data-nada={b.value === "terlambat" ? "merah" : undefined}
                      onClick={() => { setFilterBulan(b.value); setFilterMonth(null); setKgbPage(0); }}
                    >
                      {b.value === "bulan_ini" && <span className="dsb-titik" data-nada="emas" aria-hidden="true" />}
                      {b.label}
                    </button>
                  );
                })}
              </div>
            }
          />

          {/* Progres bulan yang dipilih di kalender */}
          {filterMonth && (() => {
            const totalBulan = pegawaiKalenderDerived.filter((p) => kunciBulan(p.tmtKgbBerikutnya) === filterMonth).length;
            const selesaiBulan = selesaiKalenderDerived.filter((p) => kunciBulan(p.tmtKgbBerikutnya) === filterMonth).length;
            const sisa = totalBulan - selesaiBulan;
            if (totalBulan === 0) return null;
            return (
              <div className="dsb-catatan">
                <span>
                  {sisa === 0
                    ? <>Semua {totalBulan} KGB berlaku <strong style={{ fontSize: "inherit" }}>{namaBulanFilter}</strong> sudah selesai diproses.</>
                    : <>KGB berlaku {namaBulanFilter}: {selesaiBulan} dari {totalBulan} selesai, {sisa} masih perlu diproses.</>}
                </span>
                <span className="dsb-status-bar" style={{ width: "64px", marginTop: 0, flexShrink: 0 }} aria-hidden="true">
                  <span style={{ width: `${(selesaiBulan / totalBulan) * 100}%`, background: "var(--st-green)" }} />
                </span>
              </div>
            );
          })()}
        </div>

        <div className="flex flex-col flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="dsb-kosong flex-1">
            <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--dt6)" strokeWidth="1.5"><polyline points="20 6 9 17 4 12" /></svg>
            Tidak ada pegawai untuk saringan ini
          </div>
        ) : (() => {
          const totalPages = Math.ceil(filtered.length / KGB_PAGE_SIZE);
          const page = Math.min(kgbPage, totalPages - 1);
          const paged = filtered.slice(page * KGB_PAGE_SIZE, (page + 1) * KGB_PAGE_SIZE);
          const startNo = page * KGB_PAGE_SIZE;

          return (
            <>
              <div className="overflow-x-auto flex-1" style={{ borderTop: "1px solid var(--ln2)" }}>
                <table className="dsb-tabel">
                  <thead>
                    <tr>
                      {["Pegawai", "Berlaku", "Batas input SK", "Status"].map((h) => (
                        <th key={h} scope="col" className={h === "Berlaku" ? "hidden sm:table-cell" : undefined}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((p) => {
                      const isSelesai = p.statusKGB === "selesai";
                      const days = daysDiff(p.deadlineSDM);
                      const late = !isSelesai && (p.terlambat || days < 0);
                      const deadlineCfg = isSelesai
                        ? { color: "var(--st-green)", bg: "var(--tint-green-bg)" }
                        : late
                          ? { color: "var(--st-red)", bg: "var(--tint-red-bg)" }
                          : days <= 14 ? { color: "var(--st-red)", bg: "var(--tint-red-bg)" }
                          : days <= 30 ? { color: "var(--st-amber)", bg: "var(--tint-amber-bg)" }
                          : { color: "var(--dt3)", bg: "var(--sub)" };
                      // Pegawai tanpa record KGB berjalan ditampilkan sebagai Belum Diproses.
                      const statusCfg = tampilanStatus(p.statusKGB ?? "belum_diproses");
                      const dMendesak = !isSelesai && !late ? daysDiff(p.deadlineSDM) : null;

                      return (
                        <tr key={p.id} style={{ background: late && !p.statusKGB ? "var(--tint-red-bg)" : undefined }}>
                          <td>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="dsb-avatar" data-nada={p.statusHukdis ? "merah" : undefined} aria-hidden="true">
                                {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                              </span>
                              <div className="min-w-0" style={{ lineHeight: 1.35 }}>
                                <p className="dsb-nama truncate" style={{ maxWidth: "220px" }}>
                                  {p.nama}
                                  {p.terlambat && <span className="sr-only">, melewati batas input</span>}
                                </p>
                                <p className="dsb-kecil truncate" style={{ maxWidth: "220px" }} title={p.jabatan}>
                                  {p.golonganRuang} · {p.jabatan}
                                </p>
                                <p className="dsb-kecil sm:hidden">
                                  Berlaku {formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap hidden sm:table-cell">
                            {formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="dsb-tag" style={{ background: deadlineCfg.bg, color: deadlineCfg.color }}>
                              {isSelesai ? "Selesai" : late ? "Terlambat" : days === 0 ? "Hari ini" : `${days} hari lagi`}
                            </span>
                            <p className="dsb-kecil" style={{ marginTop: "3px" }}>
                              {formatTanggalId(p.deadlineSDM, { day: "numeric", month: "short" })}
                            </p>
                          </td>
                          <td>
                            <div className="flex flex-col items-start gap-1">
                              {p.statusHukdis ? (
                                <span className="dsb-tag" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>Hukdis</span>
                              ) : (
                                <span className="dsb-tag" style={{ background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>
                              )}
                              {dMendesak !== null && dMendesak >= 0 && dMendesak <= 7 && (
                                <span className="dsb-tag" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>Mendesak, {dMendesak} hari</span>
                              )}
                              {dMendesak !== null && dMendesak > 7 && dMendesak <= 14 && (
                                <span className="dsb-tag" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}>Kritis, {dMendesak} hari</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="dsb-kaki mt-auto">
                <span>{startNo + 1}–{Math.min(startNo + KGB_PAGE_SIZE, filtered.length)} dari {filtered.length}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="dsb-ikon-tombol"
                    style={{ width: 30, height: 30 }}
                    aria-label="Halaman sebelumnya"
                    onClick={() => setKgbPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{page + 1}/{totalPages}</span>
                  <button
                    type="button"
                    className="dsb-ikon-tombol"
                    style={{ width: 30, height: 30 }}
                    aria-label="Halaman berikutnya"
                    onClick={() => setKgbPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                  <Link
                    href={filterBulan === "terlambat" ? "/dashboard/kgb?rapelan=1" : "/dashboard/kgb"}
                    className="dsb-tombol dsb-tombol-kecil"
                  >
                    Lihat semua
                  </Link>
                </div>
              </div>
            </>
          );
        })()}
        </div>
      </section>

      {/* Alur proses KGB */}
      {(() => {
        const cols: { colId: string; key: string | null; label: string; nada: Nada }[] = [
          { colId: "belum",           key: null,              label: infoStatusKgb("belum_diproses").label,  nada: "kuning" },
          { colId: "sedang_diproses", key: "sedang_diproses", label: infoStatusKgb("sedang_diproses").label, nada: "navy" },
          { colId: "selesai",         key: "selesai",         label: infoStatusKgb("selesai").label,         nada: "hijau" },
        ];
        return (
          <section className="dsb-kartu dsb-kartu-isi flex flex-col gap-4" aria-labelledby="judul-alur">
            <KepalaKartu idJudul="judul-alur" label={`Tahun ${tahunIni}`} judul="Alur proses KGB" sub="Pilih tombol pada kartu pegawai untuk memproses KGB" />
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <div className="dsb-alur">
              {cols.map((col) => {
                // Locked items (today < unlockDate) tidak ditampilkan : muncul saat masa unlock tiba
                // menunggu_keuangan masuk ke kolom sedang_diproses (pipeline tetap 3 stage)
                const rawItems = pegawaiJatuhTempo.filter((p) => {
                  if (p.isLocked) return false;
                  if (col.key === "sedang_diproses") return p.statusKGB === "sedang_diproses" || p.statusKGB === "menunggu_keuangan";
                  // KGB yang dibatalkan kembali ke kolom Belum Diproses untuk Input Ulang KGB
                  if (col.key === null) return p.statusKGB === null || p.statusKGB === "ditolak";
                  return p.statusKGB === col.key;
                });
                // Sort Belum Diproses: rapelan dulu, lalu soonest TMT
                const items = col.key === null
                  ? [...rawItems].sort((a, b) => {
                      if (a.terlambat !== b.terlambat) return a.terlambat ? -1 : 1;
                      return new Date(a.tmtKgbBerikutnya).getTime() - new Date(b.tmtKgbBerikutnya).getTime();
                    })
                  : rawItems;
                return (
                  <div key={col.colId} className="dsb-alur-kolom">
                    <div className="dsb-alur-kepala">
                      <span><span className="dsb-titik" data-nada={col.nada} aria-hidden="true" />{col.label}</span>
                      <span className="dsb-alur-jumlah">{items.length}</span>
                    </div>

                    <div className="dsb-alur-isi">
                      {items.length === 0 ? (
                        <p className="dsb-kosong" style={{ padding: "18px 8px", fontSize: "12.5px" }}>Tidak ada</p>
                      ) : items.map((p) => {
                        const dibatalkan = p.statusKGB === "ditolak";
                        return (
                        <div key={p.id} className="dsb-alur-kartu">
                          <div className="dsb-alur-orang">
                            <span aria-hidden="true" className="dsb-avatar">
                              {p.nama.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="dsb-nama truncate" style={{ fontSize: "13px" }}>{p.nama}</p>
                              <p className="dsb-kecil">
                                {formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}
                                {p.terlambat && <span style={{ color: "var(--st-amber)", fontWeight: 600 }}> · terlambat</span>}
                                {dibatalkan && <span style={{ color: "var(--st-red)", fontWeight: 600 }}> · {infoStatusKgb("ditolak").label}</span>}
                              </p>
                            </div>
                          </div>
                          {/* Aksi per status : hanya tampil jika ada aksi relevan */}
                          {col.key === null && (
                            <>
                              {p.statusHukdis && (
                                <p className="dsb-alur-info">
                                  <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                  Hukdis aktif{p.tanggalHukdisBerakhir ? ` s.d. ${formatTanggalId(p.tanggalHukdisBerakhir, { day: "numeric", month: "short" })}` : ""}
                                </p>
                              )}
                              <div className="dsb-alur-aksi">
                                <button
                                  type="button"
                                  className="dsb-tombol"
                                  data-nada={p.terlambat || dibatalkan ? "merah" : undefined}
                                  onClick={() => setModal({ jenis: "input", pegawai: pegawaiModal(p), ulang: dibatalkan, dasarAwal: dasarAwalInputKgb(p) })}
                                >
                                  {dibatalkan ? "Input Ulang KGB" : "Input KGB"}
                                </button>
                                {/* Jalur arsip: SK periode ini sudah terbit di luar SIM-KGB */}
                                {p.terlambat && (
                                  <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => setModal({ jenis: "arsip", pegawai: pegawaiModal(p) })}>
                                    Arsip KGB
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                          {col.key === "sedang_diproses" && p.kgbId && (
                            p.statusKGB === "menunggu_keuangan" ? (
                              <span className="dsb-tag" style={{ justifyContent: "center", background: "var(--tint-violet-bg)", color: "var(--st-violet)" }}>
                                {infoStatusKgb("menunggu_keuangan").label}
                              </span>
                            ) : (
                              <div className="dsb-alur-aksi">
                                <button
                                  type="button"
                                  className="dsb-tombol"
                                  onClick={() => p.kgbId && setModal({
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
                                  })}
                                >
                                  Buat SK
                                </button>
                                {p.skSudahDibuat && (
                                  <button
                                    type="button"
                                    className="dsb-tombol"
                                    data-nada="hijau"
                                    onClick={() => p.kgbId && setModal({ jenis: "unggah_sk", kgbId: p.kgbId, status: p.statusKGB ?? "", pegawai: pegawaiModal(p) })}
                                  >
                                    Unggah SK TTE
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="dsb-tombol"
                                  data-jenis="garis"
                                  onClick={() => p.kgbId && setModal({ jenis: "batalkan", kgbId: p.kgbId, pegawai: pegawaiModal(p) })}
                                >
                                  Batalkan KGB
                                </button>
                              </div>
                            )
                          )}
                          {col.key === "selesai" && (
                            <div className="dsb-alur-aksi">
                              <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => setModal({ jenis: "riwayat", pegawai: pegawaiModal(p) })}>
                                Riwayat KGB
                              </button>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>{/* end overflow-x-auto */}
          </section>
        );
      })()}

      </div>{/* end Pegawai mendekati deadline | Alur proses */}

    </div>

      {/* ── Status Rapelan ── */}
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
  return <DashboardMain />;
}
