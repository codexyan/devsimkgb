"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRole, useDashUser } from "@/app/dashboard/components/RoleContext";
import { ROLES } from "@/lib/auth";
import DashboardHukdis from "@/app/dashboard/components/DashboardHukdis";
import DashboardKeuangan from "@/app/dashboard/components/DashboardKeuangan";
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
  const palette: Record<Tier, { accent: string; soft: string; text: string; bar: string }> = {
    terlambat: { accent: "var(--st-red)", soft: "var(--tint-red-bg)", text: "var(--st-red)", bar: "#ef4444" },
    kritis:    { accent: "var(--st-amber)", soft: "var(--tint-amber-bg)", text: "var(--st-amber2)", bar: "#f59e0b" },
    warn:      { accent: "var(--st-amber)", soft: "#fef9ec", text: "var(--st-amber2)", bar: "#fcd34d" },
    aman:      { accent: "var(--st-green)", soft: "var(--tint-green-bg)", text: "#0a8f6a", bar: "#34d399" },
    empty:     { accent: "var(--dt6)", soft: "var(--sub)", text: "var(--dt6)", bar: "#e5eaf0" },
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "5px" }}>
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

        const { accent, soft, text } = palette[tier];

        // Progress bar width inside bottom strip
        const progressPct = count > 0 ? (done / count) * 100 : 0;

        return (
          <button
            key={key}
            type="button"
            aria-pressed={isSelected}
            aria-label={`${BULAN_ID[mo]} ${yr}: ${count} KGB, ${done} selesai`}
            onClick={() => onSelect(isSelected ? null : key)}
            className="relative flex flex-col items-center justify-center rounded-lg overflow-hidden transition-all"
            style={{
              height: "54px",
              background: isSelected ? accent : soft,
              outline: isCurrentMonth && !isSelected ? `2px solid ${accent}` : "none",
              outlineOffset: "0px",
              boxShadow: isSelected ? "0 3px 10px rgba(9,20,40,0.25)" : "none",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: isSelected ? "rgba(255,255,255,0.7)" : isCurrentMonth ? accent : "var(--dt5)",
                lineHeight: 1,
              }}
            >
              {BULAN_ID[mo]}
            </span>
            <span
              style={{
                fontSize: count >= 10 ? "15px" : "17px",
                fontWeight: 800,
                lineHeight: 1.1,
                marginTop: "3px",
                color: isSelected ? "#fff" : tier === "empty" ? "var(--dt6)" : text,
              }}
            >
              {count}
            </span>
            {/* Progress fraction */}
            {count > 0 && (
              <span style={{
                fontSize: "9px",
                fontWeight: 600,
                lineHeight: 1,
                marginTop: "2px",
                color: isSelected
                  ? "rgba(255,255,255,0.75)"
                  : allDone ? "var(--st-green)" : "var(--dt5)",
              }}>
                {allDone ? "semua selesai" : `${done}/${count} selesai`}
              </span>
            )}
            {/* Bottom bar: grey track + green progress */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", background: isSelected ? "rgba(255,255,255,0.2)" : "#e5eaf0" }}>
              {count > 0 && (
                <div style={{ height: "100%", width: `${progressPct}%`, background: isSelected ? "rgba(255,255,255,0.7)" : "#34d399", transition: "width 0.6s ease" }} />
              )}
            </div>
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
  const VW = 500;
  const VH = 180;
  const padL = 30;
  const padR = 16;
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
    { key: "diproses" as const, color: "var(--dtn)", fillOpacity: 0.08, label: "Diproses", futureOnly: false },
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
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        {series.filter((s) => !s.futureOnly).map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded-full" style={{ background: s.color }} />
            <span className="text-xs" style={{ color: "var(--dt4)" }}>{s.label}</span>
          </div>
        ))}
        {futureStartIdx > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded-full" style={{ borderTop: "2px dashed var(--st-violet)" }} />
            <span className="text-xs" style={{ color: "var(--st-violet)" }}>Mendatang (proj.)</span>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <svg width="100%" viewBox={`0 0 ${VW} ${VH}`} style={{ minWidth: "300px", display: "block" }}>
          {/* Future background shading */}
          {dividerX !== null && (
            <rect
              x={dividerX}
              y={padT}
              width={VW - padR - dividerX}
              height={cH}
              fill="#f0f7ff"
              opacity="0.7"
            />
          )}

          {/* Grid */}
          {gridSteps.map((pct) => {
            const y = padT + cH - pct * cH;
            const val = Math.round(pct * maxVal);
            return (
              <g key={pct}>
                <line x1={padL} y1={y} x2={VW - padR} y2={y} stroke="#f0f4f8" strokeWidth="1" />
                {pct > 0 && (
                  <text x={padL - 5} y={y + 3.5} textAnchor="end" fontSize="9" fill="#c0cdd8">{val}</text>
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
              stroke="#b0c8e0"
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
                    <text x={cx} y={cy - 8} textAnchor="middle" fontSize="9" fill={s.color} fontWeight="600" opacity={isFut ? 0.7 : 1}>{v}</text>
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
                fontSize="10"
                fill={d.isFuture ? "#a0b8d0" : isCurrentMonth ? "var(--dtn)" : "var(--dt4)"}
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

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat dashboard...</p>
      </div>
    );

  if (apiError)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm font-semibold" style={{ color: "var(--st-red)" }}>Gagal memuat dashboard</p>
        <p className="text-xs" style={{ color: "var(--dt4)" }}>{apiError}</p>
        <button
          onClick={() => fetchDashboard()}
          className="text-xs px-4 py-2 rounded"
          style={{ background: "var(--navy-solid)", color: "#fff" }}
        >
          Coba Lagi
        </button>
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
  const banners: { id: string; bg: string; border: string; color: string; icon: React.ReactNode; message: React.ReactNode }[] = [];

  const terlambatList = pegawaiJatuhTempo.filter((p) => p.terlambat);
  if (terlambatList.length > 0)
    banners.push({
      id: "terlambat",
      bg: "var(--tint-red-bg)", border: "var(--tint-red-ln)", color: "var(--st-red)",
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
      message: <><strong>{terlambatList.length} pegawai</strong> deadline input SK-nya sudah lewat dan belum diproses, berisiko selisih gaji (rapelan). Segera selesaikan.</>,
    });

  const deadline7 = pegawaiJatuhTempo.filter((p) => p.statusKGB !== "selesai" && !p.terlambat && daysDiff(p.deadlineSDM) >= 0 && daysDiff(p.deadlineSDM) <= 7);
  if (deadline7.length > 0)
    banners.push({
      id: "deadline7",
      bg: "var(--tint-amber-bg)", border: "var(--tint-amber-ln)", color: "var(--st-amber2)",
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b87c0a" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
      message: <><strong>{deadline7.length} pegawai</strong> batas input SK-nya tinggal kurang dari 7 hari, segera proses sebelum terlambat.</>,
    });

  if (stats.totalHukdis > 0)
    banners.push({
      id: "hukdis",
      bg: "var(--tint-red-bg)", border: "var(--tint-red-ln)", color: "var(--st-red)",
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
      message: <><strong>{stats.totalHukdis} pegawai</strong> sedang menjalani Hukuman Disiplin. KGB diblokir otomatis hanya untuk jenis <em>Penundaan KGB</em>. <Link href="/dashboard/pegawai" className="underline font-semibold">Lihat daftar</Link></>,
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
        bg: "var(--tint-blue-bg)", border: "var(--tint-blue-ln)", color: "var(--st-blue)",
        icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
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
      bg: "var(--tint-amber-bg)", border: "var(--tint-amber-ln)", color: "var(--st-amber2)",
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b87c0a" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.3a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17.92z"/></svg>,
      message: <>{notif.pesan}</>,
    });
  }

  const visibleBanners = banners.filter((b) => !dismissedBanners.has(b.id));

  /* -- KGB Jatuh Tempo filter : berdasarkan DEADLINE SDM bukan TMT -- */
  const today = new Date();
  const jamSekarang = today.getHours();
  const greeting =
    jamSekarang < 11 ? "Selamat pagi" :
    jamSekarang < 15 ? "Selamat siang" :
    jamSekarang < 19 ? "Selamat sore" : "Selamat malam";

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

  return (
    <>
    <div className="space-y-3">

      {/* -- Header : sapaan + ringkasan hari ini -- */}
      <div className="dash-sec rounded-xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3" style={{
        background: "linear-gradient(120deg, var(--tint-navy) 0%, var(--card) 70%)",
        border: "0.5px solid var(--ln1)",
      }}>
        <div className="min-w-0">
          <h1 className="text-base font-bold leading-tight" style={{ color: "var(--dtn)", letterSpacing: "-0.01em" }}>
            {greeting}{dashUser.nama ? `, ${dashUser.nama.split(" ")[0]}` : ""}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
            {today.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}Monitoring KGB Kanwil Ditjenpas Kalsel
          </p>
          <p className="text-xs mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: "var(--dt3)" }}>
            {stats.belumDiproses > 0 ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", fontSize: "10px" }}>
                {stats.belumDiproses} KGB menunggu diproses
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", fontSize: "10px" }}>
                Semua KGB tahun ini tertangani
              </span>
            )}
            {terlambatList.length > 0 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", fontSize: "10px" }}>
                {terlambatList.length} melewati deadline
              </span>
            )}
            <span style={{ fontSize: "10px", color: "var(--dt5)" }}>
              {stats.selesai}/{totalKGBAktif} selesai ({progressPct}%)
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <p className="hidden sm:block text-xs" style={{ color: "var(--dt5)" }}>
              Diperbarui {lastRefresh.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="Perbarui data dashboard"
            aria-label="Perbarui data dashboard"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--card)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }}>
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes dashRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .dash-sec { animation: dashRise .4s cubic-bezier(.22,1,.36,1) both; }
        .dash-sec:nth-child(2) { animation-delay: .04s } .dash-sec:nth-child(3) { animation-delay: .08s }
        .dash-sec:nth-child(4) { animation-delay: .12s } .dash-sec:nth-child(5) { animation-delay: .16s }
        .dash-card { transition: box-shadow .18s, transform .18s, border-color .18s; }
        a.dash-card:hover, button.dash-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(9,20,40,0.12);
        }
        /* — KPI card system — */
        .kpi-strip { position: absolute; top: 0; left: 0; right: 0; height: 2.5px; opacity: .85; }
        .kpi-chip {
          width: 38px; height: 38px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 16px rgba(9,20,40,0.18), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .kpi-num { font-size: 26px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; margin-bottom: 3px; }
        .kpi-foot {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 7px 10px; font-size: 11px; font-weight: 600;
          background: var(--sub); border-top: 0.5px solid var(--ln2);
          transition: gap .15s;
        }
        .kpi-card:hover .kpi-foot { gap: 9px; }
      `}</style>

      {/* -- Banners -- */}
      {visibleBanners.length > 0 && (
        <div className="space-y-1.5">
          {visibleBanners.map((b) => (
            <div key={b.id} className="rounded-lg px-3 py-1.5 flex items-center gap-2.5" style={{ background: b.bg, border: `1px solid ${b.border}` }}>
              <div className="shrink-0">{b.icon}</div>
              <p className="text-xs leading-relaxed flex-1" style={{ color: b.color }}>{b.message}</p>
              <button type="button" aria-label="Tutup pemberitahuan" onClick={() => setDismissedBanners((prev) => new Set(prev).add(b.id))} className="shrink-0 opacity-50 hover:opacity-100 transition">
                <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={b.color} strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* -- KPI Cards : 4 kolom seragam, semuanya interaktif -- */}
      <div className="dash-sec grid grid-cols-2 lg:grid-cols-4 gap-3">

        {/* Total Pegawai → /dashboard/pegawai */}
        <Link href="/dashboard/pegawai" className="dash-card kpi-card bg-white rounded-xl w-full text-left active:scale-95 overflow-hidden flex flex-col" style={{ border: "0.5px solid var(--ln1)", textDecoration: "none", position: "relative" }}>
          <span aria-hidden className="kpi-strip" style={{ background: "linear-gradient(90deg, var(--navy-solid), transparent)" }} />
          <div className="p-3.5 flex items-start gap-3 flex-1">
            <div className="kpi-chip shrink-0" style={{ background: "linear-gradient(135deg, #2d5d94, var(--navy-solid))" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="kpi-num" style={{ color: "var(--dtn)" }}>{stats.totalPegawai}</p>
              <p className="text-xs font-medium" style={{ color: "var(--dt3)" }}>Pegawai Aktif</p>
              <p className="text-xs mt-1" style={{ color: stats.totalHukdis > 0 ? "var(--st-red)" : "var(--dt5)", fontSize: "10.5px" }}>
                {stats.totalHukdis > 0 ? `${stats.totalHukdis} dalam hukdis aktif` : "Tidak ada hukdis"}
              </p>
            </div>
          </div>
          <div className="kpi-foot" style={{ color: "var(--dtn)" }}>
            Lihat Pegawai
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
        </Link>

        {/* KGB Tahun Ini → /dashboard/kgb, dengan progress selesai */}
        <Link href="/dashboard/kgb" className="dash-card kpi-card bg-white rounded-xl w-full text-left active:scale-95 overflow-hidden flex flex-col" style={{ border: "0.5px solid var(--ln1)", textDecoration: "none", position: "relative" }}>
          <span aria-hidden className="kpi-strip" style={{ background: "linear-gradient(90deg, var(--green-solid), transparent)" }} />
          <div className="p-3.5 flex items-start gap-3 flex-1">
            <div className="kpi-chip shrink-0" style={{ background: "linear-gradient(135deg, #17a37e, var(--green-solid))" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <p className="kpi-num" style={{ color: "var(--st-green)" }}>{stats.kgbTahunIni}</p>
                <span className="text-xs font-bold" style={{ color: "var(--st-green)", opacity: 0.45 }}>{today.getFullYear()}</span>
              </div>
              <p className="text-xs font-medium" style={{ color: "var(--dt3)" }}>KGB Tahun Ini</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div style={{ flex: 1, height: "4px", borderRadius: "99px", background: "var(--ln2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${stats.kgbTahunIni > 0 ? Math.round((stats.selesai / stats.kgbTahunIni) * 100) : 0}%`, background: "linear-gradient(90deg, #17a37e, var(--green-solid))", borderRadius: "99px", transition: "width .8s ease" }} />
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--st-green)", flexShrink: 0 }}>
                  {stats.kgbTahunIni > 0 ? Math.round((stats.selesai / stats.kgbTahunIni) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
          <div className="kpi-foot" style={{ color: "var(--st-green)" }}>
            {stats.selesai} selesai · {stats.sedangDiproses} dalam proses
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
        </Link>

        {/* Belum Diproses → /dashboard/kgb */}
        <Link href="/dashboard/kgb" className="dash-card kpi-card bg-white rounded-xl w-full text-left active:scale-95 overflow-hidden flex flex-col" style={{ border: "0.5px solid var(--ln1)", textDecoration: "none", position: "relative" }}>
          <span aria-hidden className="kpi-strip" style={{ background: "linear-gradient(90deg, var(--amber-solid), transparent)" }} />
          <div className="p-3.5 flex items-start gap-3 flex-1">
            <div className="kpi-chip shrink-0" style={{ background: "linear-gradient(135deg, #d99414, var(--amber-solid))" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="kpi-num" style={{ color: "var(--st-amber)" }}>{stats.belumDiproses}</p>
              <p className="text-xs font-medium" style={{ color: "var(--dt3)" }}>{infoStatusKgb("belum_diproses").label}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <div style={{ flex: 1, height: "4px", borderRadius: "99px", background: "var(--ln2)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${totalKGBAktif > 0 ? Math.round((stats.belumDiproses / totalKGBAktif) * 100) : 0}%`, background: "linear-gradient(90deg, #d99414, var(--amber-solid))", borderRadius: "99px", transition: "width .8s ease" }} />
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--st-amber)", flexShrink: 0 }}>
                  {totalKGBAktif > 0 ? Math.round((stats.belumDiproses / totalKGBAktif) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
          <div className="kpi-foot" style={{ color: "var(--st-amber)" }}>
            {stats.belumDiproses > 0 ? "Proses sekarang" : "Semua sudah diproses"}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
        </Link>

        {/* Rapelan : klik untuk lihat detail */}
        <button type="button" onClick={() => {
            setShowRapelanPopup(true);
            setRapelanKonfirmasiLoading(true);
            fetch("/api/kgb?rapelanDitetapkan=true")
              .then((r) => r.json() as Promise<unknown>)
              .then((d) => setRapelanKonfirmasiList(Array.isArray(d) ? d : []))
              .catch(() => setRapelanKonfirmasiList([]))
              .finally(() => setRapelanKonfirmasiLoading(false));
          }} className="dash-card kpi-card rounded-xl w-full text-left active:scale-95 overflow-hidden flex flex-col"
          style={{ border: (stats.rapelanKonfirmasi > 0 || stats.rapelanBerisiko > 0) ? "0.5px solid var(--tint-red-ln)" : "0.5px solid var(--ln1)", background: stats.rapelanKonfirmasi > 0 ? "var(--tint-red-bg)" : "var(--card)", position: "relative", cursor: "pointer" }}>
          <span aria-hidden className="kpi-strip" style={{ background: "linear-gradient(90deg, var(--red-solid), transparent)" }} />
          <div className="p-3.5 flex items-start gap-3 flex-1">
            <div className="kpi-chip shrink-0" style={{ background: "linear-gradient(135deg, #e35d5d, var(--red-solid))" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="kpi-num" style={{ color: "var(--st-red)" }}>{stats.rapelanKonfirmasi}</p>
              <p className="text-xs font-medium" style={{ color: "var(--dt3)" }}>Rapelan Terkonfirmasi</p>
              <p className="text-xs mt-1" style={{ color: stats.rapelanBerisiko > 0 ? "var(--st-amber)" : "var(--dt5)", fontSize: "10.5px" }}>
                {stats.rapelanBerisiko > 0 ? `${stats.rapelanBerisiko} berpotensi rapelan` : "Tidak ada potensi rapelan"}
              </p>
            </div>
          </div>
          <div className="kpi-foot" style={{ color: "var(--st-red)" }}>
            Lihat Detail
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
        </button>
      </div>

      {/* -- Row 2: KGB per Bulan | Progress | Tren -- */}
      <div className="dash-sec grid grid-cols-1 gap-3 lg:grid-cols-3">

        {/* KGB per Bulan */}
        <div className="bg-white rounded-xl p-4 flex flex-col gap-2.5" style={{ border: "0.5px solid var(--ln1)" }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <p className="text-xs font-semibold leading-tight" style={{ color: "var(--dtn)" }}>KGB per Bulan</p>
                <p style={{ fontSize: "10px", color: "var(--dt4)" }}>{today.getFullYear()} · klik bulan untuk filter</p>
              </div>
            </div>
            {filterMonth && (
              <button type="button" onClick={() => { setFilterMonth(null); setKgbPage(0); }}
                aria-label={`Hapus filter bulan ${filterMonth}`}
                className="shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg transition hover:opacity-75"
                style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>
                <svg aria-hidden="true" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                {filterMonth}
              </button>
            )}
          </div>
          <MonthGrid pegawaiKalender={pegawaiKalenderDerived} selesaiKalender={selesaiKalenderDerived} filterMonth={filterMonth} onSelect={(m) => { setFilterMonth(m); setKgbPage(0); }} />
          <div className="flex items-center gap-3 flex-wrap">
            {([{ bar: "#ef4444", label: "Terlambat" }, { bar: "#f59e0b", label: "Kritis" }, { bar: "#fcd34d", label: "≤30 hari" }, { bar: "#34d399", label: "Aman" }] as { bar: string; label: string }[]).map(({ bar, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div style={{ width: "10px", height: "3px", borderRadius: "2px", background: bar, flexShrink: 0 }} />
                <span style={{ fontSize: "10px", color: "var(--dt5)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress KGB */}
        <div className="bg-white rounded-xl p-4 flex flex-col gap-3" style={{ border: "0.5px solid var(--ln1)" }}>
          {(() => {
            // stats.sedangDiproses menggabungkan Sedang Diproses dan Menunggu Keuangan; rinciannya dipisah di sini.
            const menungguKeuangan = Math.min(stats.menungguKeuangan ?? 0, stats.sedangDiproses);
            const label = (status: string) => infoStatusKgb(status).label;
            const statusList = [
              { label: label("selesai"),           value: stats.selesai,                             color: "#10b981", bg: "var(--tint-green-bg2)", icon: (<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>) },
              { label: label("sedang_diproses"),   value: stats.sedangDiproses - menungguKeuangan,   color: "#3b82f6", bg: "var(--tint-blue-bg2)", icon: (<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>) },
              { label: label("menunggu_keuangan"), value: menungguKeuangan,                          color: "#8b5cf6", bg: "var(--tint-violet-bg)", icon: (<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/></svg>) },
              { label: label("belum_diproses"),    value: stats.belumDiproses,                       color: "#f59e0b", bg: "var(--tint-amber-bg2)", icon: (<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>) },
              { label: label("ditolak"),           value: stats.ditolak,                             color: "#ef4444", bg: "var(--tint-red-bg2)", icon: (<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>) },
            ];
            const dominant = statusList.reduce((a, b) => b.value > a.value ? b : a, statusList[0]);
            const dominantPct = totalKGBAktif > 0 ? Math.round((dominant.value / totalKGBAktif) * 100) : 0;
            const R = 48, CX = 64, CY = 64;
            const CIRCUM = 2 * Math.PI * R;
            const dash = (dominantPct / 100) * CIRCUM;
            const infoMsg = stats.selesai === totalKGBAktif && totalKGBAktif > 0
              ? "Semua proses KGB selesai"
              : stats.selesai === 0 ? "Belum ada yang selesai"
              : stats.ditolak > 0 ? `${stats.ditolak} KGB dibatalkan`
              : progressPct >= 75 ? "Hampir selesai"
              : `${stats.sedangDiproses} sedang berjalan`;
            return (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Status Proses KGB {today.getFullYear()}</p>
                    <p style={{ fontSize: "10px", color: "var(--dt4)" }}>{totalKGBAktif} KGB terdaftar tahun ini</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="shrink-0 flex flex-col items-center gap-1.5">
                    <svg width="110" height="110" viewBox="0 0 128 128">
                      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#edf2f7" strokeWidth="10" />
                      {totalKGBAktif > 0 && (
                        <circle cx={CX} cy={CY} r={R} fill="none" stroke={dominant.color} strokeWidth="10" strokeLinecap="round"
                          strokeDasharray={`${dash} ${CIRCUM}`} transform={`rotate(-90 ${CX} ${CY})`} />
                      )}
                      <text x={CX} y={CY - 7} textAnchor="middle" fontSize="20" fontWeight="800" fill={dominant.color}>{dominantPct}%</text>
                      <text x={CX} y={CY + 9} textAnchor="middle" fontSize="9" fontWeight="600" fill="#64748b">{dominant.label}</text>
                      <text x={CX} y={CY + 21} textAnchor="middle" fontSize="8" fill="#a0b4c8">{dominant.value}/{totalKGBAktif}</text>
                    </svg>
                    <div className="rounded-lg px-2 py-0.5 text-center" style={{ background: dominant.bg, maxWidth: "110px" }}>
                      <p style={{ fontSize: "9px", fontWeight: 600, color: dominant.color, lineHeight: "1.4" }}>{infoMsg}</p>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col gap-2 pt-1">
                    {statusList.map((s) => {
                      const pct = totalKGBAktif > 0 ? Math.round((s.value / totalKGBAktif) * 100) : 0;
                      return (
                        <div key={s.label}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                              <span style={{ fontSize: "11px", color: "var(--dt3)", fontWeight: 500 }}>{s.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span style={{ fontSize: "14px", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
                              <span style={{ fontSize: "10px", color: "var(--dt5)", minWidth: "24px", textAlign: "right" }}>{pct}%</span>
                            </div>
                          </div>
                          <div style={{ height: "4px", borderRadius: "99px", background: "var(--ln2)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: s.color, transition: "width 0.8s ease", borderRadius: "99px" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 mt-auto" style={{ background: "var(--tint-amber-bg)", border: "0.5px solid var(--tint-amber-ln)" }}>
                  <p style={{ fontSize: "10px", fontWeight: 700, color: "var(--st-amber2)" }}>Target: semua pegawai KGB-nya selesai tahun ini</p>
                  <div className="flex items-center gap-1.5">
                    <div style={{ width: "64px", height: "4px", borderRadius: "99px", background: "var(--tint-amber-ln)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progressPct}%`, background: progressPct >= 100 ? "#10b981" : "#f59e0b", borderRadius: "99px" }} />
                    </div>
                    <span className="rounded px-1 py-px font-bold" style={{ background: progressPct >= 100 ? "#10b981" : "#f59e0b", color: "#fff", fontSize: "10px" }}>{progressPct}%</span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>

        {/* Tren KGB Bulanan */}
        {trenBulanan?.length > 0 && (
          <div className="bg-white rounded-xl p-4" style={{ border: "0.5px solid var(--ln1)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>
              </div>
              <div>
                <h2 className="text-xs font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Tren KGB Bulanan</h2>
                <p className="text-xs" style={{ color: "var(--dt4)", fontSize: "10px" }}>3 bulan lalu · bulan ini · 3 bulan ke depan</p>
              </div>
            </div>
            <TrenLineChart data={trenBulanan} />
          </div>
        )}

      </div>

      {/* -- KGB Jatuh Tempo | Pipeline : sama tinggi via grid stretch -- */}
      <div className="dash-sec grid grid-cols-1 xl:grid-cols-5 gap-3">

      {/* KGB Jatuh Tempo : col-span-2 */}
      <div className="xl:col-span-2 bg-white rounded-xl overflow-hidden flex flex-col" style={{ border: "0.5px solid var(--ln1)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 shrink-0" style={{ borderBottom: "0.5px solid var(--ln2)" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
            <h2 className="text-xs font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Pegawai Mendekati Deadline</h2>
            <p className="text-xs" style={{ color: "var(--dt4)" }}>
              {filterMonth
                ? `${filtered.length} pegawai, KGB berlaku ${filterMonth}`
                : filterBulan === "terlambat"
                  ? `${filtered.length} pegawai, deadline sudah terlewat`
                  : filterBulan === "bulan_ini"
                    ? `${filtered.length} pegawai, berlaku ${unlockLabel}, SDM kirim bulan ini`
                    : `${filtered.length} pegawai`}
              {filtered.filter((p) => p.terlambat).length > 0 && filterBulan !== "terlambat" && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", fontSize: "9px" }}>
                  {filtered.filter((p) => p.terlambat).length} terlambat
                </span>
              )}
            </p>
            </div>
          </div>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
            {filterButtons.map((b) => {
              const isActive = (filterBulan === b.value) && !filterMonth;
              return (
                <button
                  key={String(b.value)}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => { setFilterBulan(b.value); setFilterMonth(null); setKgbPage(0); }}
                  className="px-2.5 py-1 font-medium transition"
                  style={{
                    fontSize: "10px",
                    background: isActive ? (b.value === "terlambat" ? "var(--red-solid)" : "var(--navy-solid)") : "var(--card)",
                    color: isActive ? "#fff" : b.value === "terlambat" ? "var(--st-red)" : "var(--dt4)",
                    borderRight: "1px solid var(--ln1)",
                  }}
                >
                  {b.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* -- Banner reminder progress bulan yang dipilih -- */}
        {filterMonth && (() => {
          const totalBulan = pegawaiKalenderDerived.filter((p) => kunciBulan(p.tmtKgbBerikutnya) === filterMonth).length;
          const selesaiBulan = selesaiKalenderDerived.filter((p) => kunciBulan(p.tmtKgbBerikutnya) === filterMonth).length;
          const sisa = totalBulan - selesaiBulan;
          if (totalBulan === 0) return null;
          const bulanNama = (() => {
            const [y, m] = filterMonth!.split("-");
            return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
          })();
          if (sisa === 0) return (
            <div className="mx-4 mb-2 px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ background: "var(--tint-green-bg)", border: "1px solid var(--tint-green-ln)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              <p className="text-xs font-medium" style={{ color: "var(--st-green)" }}>
                Semua {totalBulan} KGB berlaku <strong>{bulanNama}</strong> sudah selesai diproses.
              </p>
            </div>
          );
          return (
            <div className="mx-4 mb-2 px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b87c0a" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <p className="text-xs flex-1" style={{ color: "var(--st-amber2)" }}>
                KGB berlaku <strong>{bulanNama}</strong>: {selesaiBulan}/{totalBulan} selesai, <strong>{sisa} masih perlu diproses</strong>.
              </p>
              <div style={{ width: "48px", height: "4px", borderRadius: "99px", background: "var(--tint-amber-ln)", flexShrink: 0, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(selesaiBulan / totalBulan) * 100}%`, background: "#f59e0b" }} />
              </div>
            </div>
          );
        })()}

        <div className="flex flex-col flex-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d0dce8" strokeWidth="1.5"><polyline points="20 6 9 17 4 12" /></svg>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>Tidak ada pegawai untuk filter ini</p>
          </div>
        ) : (() => {
          const totalPages = Math.ceil(filtered.length / KGB_PAGE_SIZE);
          const page = Math.min(kgbPage, totalPages - 1);
          const paged = filtered.slice(page * KGB_PAGE_SIZE, (page + 1) * KGB_PAGE_SIZE);
          const startNo = page * KGB_PAGE_SIZE;

          return (
            <>
              <div className="overflow-x-auto flex-1">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}>
                      {["#", "Pegawai", "Gol.", "Berlaku", "Batas Input SK", "Status"].map((h) => (
                        <th key={h} className="text-left px-3 py-1.5 whitespace-nowrap font-semibold" style={{ fontSize: "10px", color: "var(--dt4)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((p, idx) => {
                      const isSelesai = p.statusKGB === "selesai";
                      const days = daysDiff(p.deadlineSDM);
                      const late = !isSelesai && (p.terlambat || days < 0);
                      const deadlineCfg = isSelesai
                        ? { color: "var(--st-green)", bg: "var(--tint-green-bg)" }
                        : late
                          ? { color: "var(--st-red)", bg: "var(--tint-red-bg)" }
                          : days <= 14 ? { color: "var(--st-red)", bg: "var(--tint-red-bg)" }
                          : days <= 30 ? { color: "var(--st-amber)", bg: "var(--tint-amber-bg)" }
                          : { color: "var(--dt3)", bg: "transparent" };
                      // Pegawai tanpa record KGB berjalan ditampilkan sebagai Belum Diproses.
                      const statusCfg = tampilanStatus(p.statusKGB ?? "belum_diproses");

                      return (
                        <tr key={p.id} style={{ borderBottom: idx < paged.length - 1 ? "0.5px solid var(--ln2)" : "none", background: late && !p.statusKGB ? "var(--tint-red-bg)" : "transparent" }}>
                          <td className="px-3 py-1.5" style={{ color: "var(--dt5)", fontSize: "10px" }}>{startNo + idx + 1}</td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0"
                                style={{ background: p.statusHukdis ? "var(--tint-red-bg)" : "var(--tint-navy)", color: p.statusHukdis ? "var(--st-red)" : "var(--dtn)", fontSize: "9px" }}>
                                {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                              <div style={{ lineHeight: 1.3 }}>
                                <div className="flex items-center gap-1">
                                  <p className="font-medium truncate" style={{ fontSize: "11px", color: "var(--dtn)", maxWidth: "110px" }}>{p.nama}</p>
                                  {p.terlambat && <span className="px-1 rounded font-bold" title="Melewati batas input" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", fontSize: "8px" }}><span aria-hidden="true">!</span><span className="sr-only">Melewati batas input</span></span>}
                                </div>
                                <p style={{ fontSize: "9px", color: "var(--dt5)" }} className="truncate" title={p.jabatan}>{p.jabatan.length > 22 ? p.jabatan.slice(0, 22) + "…" : p.jabatan}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            <span style={{ fontSize: "10px", fontWeight: 600, padding: "1px 5px", borderRadius: "4px", background: "var(--tint-navy)", color: "var(--dtn)" }}>{p.golonganRuang}</span>
                          </td>
                          <td className="px-3 py-1.5" style={{ color: "var(--dt3)" }}>
                            <p className="whitespace-nowrap font-medium" style={{ fontSize: "11px" }}>
                              {formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}
                            </p>
                          </td>
                          <td className="px-3 py-1.5">
                            <p className="whitespace-nowrap font-medium" style={{ fontSize: "11px", color: deadlineCfg.color, background: deadlineCfg.bg, padding: "1px 5px", borderRadius: "4px", display: "inline-block" }}>
                              {isSelesai ? "Selesai" : late ? "Terlambat" : days === 0 ? "Hari ini" : `${days} hari lagi`}
                            </p>
                            <p style={{ fontSize: "9px", color: "var(--dt5)", marginTop: "1px" }}>
                              {formatTanggalId(p.deadlineSDM, { day: "numeric", month: "short" })}
                            </p>
                          </td>
                          <td className="px-3 py-1.5">
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              {p.statusHukdis ? (
                                <span className="px-1.5 py-px rounded-full font-medium" style={{ fontSize: "10px", background: "var(--tint-red-bg)", color: "var(--st-red)" }}>Hukdis</span>
                              ) : (
                                <span className="px-1.5 py-px rounded-full font-medium" style={{ fontSize: "10px", background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>
                              )}
                              {/* Indikator kritis inline */}
                              {!isSelesai && !late && (() => {
                                const d = daysDiff(p.deadlineSDM);
                                if (d <= 7 && d >= 0) return <span className="px-1.5 py-px rounded-full font-bold" style={{ fontSize: "9px", background: "var(--tint-red-bg)", color: "var(--st-red)" }}>Mendesak, {d} hari</span>;
                                if (d <= 14) return <span className="px-1.5 py-px rounded-full font-semibold" style={{ fontSize: "9px", background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}>Kritis, {d} hari</span>;
                                return null;
                              })()}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* -- Pagination footer -- */}
              <div className="flex items-center justify-between px-4 py-2 shrink-0 mt-auto" style={{ borderTop: "0.5px solid var(--ln2)" }}>
                <p style={{ fontSize: "10px", color: "var(--dt5)" }}>
                  {startNo + 1}–{Math.min(startNo + KGB_PAGE_SIZE, filtered.length)} / {filtered.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Halaman sebelumnya"
                    onClick={() => setKgbPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-2 py-1 rounded-lg transition disabled:opacity-30"
                    style={{ fontSize: "10px", background: "var(--sub)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}
                  >
                    ←
                  </button>
                  <span style={{ fontSize: "10px", color: "var(--dt3)" }}>{page + 1}/{totalPages}</span>
                  <button
                    type="button"
                    aria-label="Halaman berikutnya"
                    onClick={() => setKgbPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-2 py-1 rounded-lg transition disabled:opacity-30"
                    style={{ fontSize: "10px", background: "var(--sub)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}
                  >
                    →
                  </button>
                  <Link
                    href={
                      filterBulan === "terlambat" ? "/dashboard/kgb?rapelan=1"
                      : "/dashboard/kgb"
                    }
                    className="px-2.5 py-1 rounded-lg font-medium transition"
                    style={{ fontSize: "10px", background: "var(--navy-solid)", color: "#fff" }}
                  >
                    Lihat Semua
                  </Link>
                </div>
              </div>
            </>
          );
        })()}
        </div>{/* end flex-1 table area */}
      </div>

      {/* Pipeline Status KGB : col-span-2 */}
      {(() => {
        const cols = [
          { colId: "belum",          key: null,              label: infoStatusKgb("belum_diproses").label,  color: "var(--st-amber)", bg: "var(--tint-amber-bg)", activeBg: "var(--tint-amber-bg2)", border: "var(--tint-amber-ln)",  badgeBg: "var(--tint-amber-bg2)" },
          { colId: "sedang_diproses",key: "sedang_diproses", label: infoStatusKgb("sedang_diproses").label, color: "var(--dtn)", bg: "var(--sub)", activeBg: "var(--tint-blue-bg2)", border: "var(--ln0)",  badgeBg: "var(--ln1)" },
          { colId: "selesai",        key: "selesai",         label: infoStatusKgb("selesai").label,         color: "var(--st-green)", bg: "var(--tint-green-bg)", activeBg: "var(--tint-green-bg2)", border: "var(--tint-green-ln)",  badgeBg: "var(--tint-green-bg2)" },
        ];
        return (
          <div className="xl:col-span-3 bg-white rounded-xl p-4" style={{ border: "0.5px solid var(--ln1)" }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="5" width="4" height="16" rx="1"/></svg>
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Alur Proses KGB {today.getFullYear()}</p>
                <p style={{ fontSize: "10px", color: "var(--dt4)" }}>Pilih tombol pada kartu pegawai untuk memproses KGB</p>
              </div>
            </div>
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(3, minmax(200px, 1fr))", minWidth: "620px" }}>
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
                  <div key={col.colId} className="rounded-xl flex flex-col overflow-hidden"
                    style={{ border: `1.5px solid ${col.border}`, background: col.bg }}>

                    {/* Header kolom */}
                    <div className="px-2.5 py-2 flex items-center justify-between"
                      style={{ borderBottom: `1px solid ${col.border}` }}>
                      <span className="font-semibold" style={{ fontSize: "10px", color: col.color }}>{col.label}</span>
                      <span className="font-bold px-1.5 py-px rounded-full" style={{ fontSize: "11px", background: col.badgeBg, color: col.color }}>{items.length}</span>
                    </div>

                    {/* Kartu pegawai */}
                    <div className="flex flex-col gap-1 p-1.5 overflow-y-auto" style={{ maxHeight: "380px", minHeight: "60px" }}>
                      {items.length === 0 ? (
                        <div className="flex items-center justify-center py-4">
                          <p style={{ fontSize: "11px", color: col.color, opacity: 0.4 }}>Tidak ada</p>
                        </div>
                      ) : items.map((p) => {
                        const dibatalkan = p.statusKGB === "ditolak";
                        return (
                        <div key={p.id} className="rounded-lg px-2 py-1.5 transition"
                          style={{ background: "var(--card)", border: `0.5px solid ${col.border}` }}>
                          <div className="flex items-center gap-1.5">
                            <div aria-hidden="true" className="w-5 h-5 rounded-full flex items-center justify-center font-bold shrink-0" style={{ background: col.badgeBg, color: col.color, fontSize: "8px" }}>
                              {p.nama.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate" style={{ fontSize: "11px", color: "var(--dtn)" }}>{p.nama}</p>
                              <p style={{ fontSize: "9px", color: "var(--dt4)" }}>
                                {formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}
                                {p.terlambat && <span className="ml-1 font-semibold" style={{ color: "var(--st-amber)" }}>· terlambat</span>}
                                {dibatalkan && <span className="ml-1 font-semibold" style={{ color: "var(--st-red)" }}>· {infoStatusKgb("ditolak").label}</span>}
                              </p>
                            </div>
                          </div>
                          {/* Aksi per status : hanya tampil jika ada aksi relevan */}
                          {col.key === null && (
                            <div className="mt-1 flex flex-col gap-0.5">
                              {p.statusHukdis && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "var(--tint-amber-bg)", border: "0.5px solid var(--tint-amber-ln)" }}>
                                  <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#b87c0a" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                  <p style={{ fontSize: "9px", color: "var(--st-amber2)", lineHeight: 1.3 }}>
                                    Hukdis aktif{p.tanggalHukdisBerakhir ? ` s.d. ${formatTanggalId(p.tanggalHukdisBerakhir, { day: "numeric", month: "short" })}` : ""}
                                  </p>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setModal({ jenis: "input", pegawai: pegawaiModal(p), ulang: dibatalkan, dasarAwal: dasarAwalInputKgb(p) })}
                                className="w-full py-1 rounded font-semibold transition hover:opacity-80"
                                style={p.terlambat || dibatalkan
                                  ? { fontSize: "10px", background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }
                                  : { fontSize: "10px", background: "var(--tint-amber-bg)", color: "var(--st-amber)", border: `0.5px solid ${col.border}` }}>
                                {dibatalkan ? "Input Ulang KGB" : "Input KGB"}
                              </button>
                              {/* Jalur arsip: SK periode ini sudah terbit di luar SIM-KGB */}
                              {p.terlambat && (
                                <button
                                  type="button"
                                  onClick={() => setModal({ jenis: "arsip", pegawai: pegawaiModal(p) })}
                                  className="w-full py-1 rounded font-semibold flex items-center justify-center gap-1 hover:opacity-80 transition"
                                  style={{ fontSize: "10px", background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>
                                  Arsip KGB
                                </button>
                              )}
                            </div>
                          )}
                          {col.key === "sedang_diproses" && p.kgbId && (
                            <div className="mt-1 flex flex-col gap-0.5">
                              {p.statusKGB === "menunggu_keuangan" ? (
                                <div className="w-full py-1 px-1.5 rounded text-center font-semibold"
                                  style={{ fontSize: "10px", background: "var(--tint-violet-bg)", color: "var(--st-violet)", border: "0.5px solid var(--tint-violet-ln)" }}>
                                  {infoStatusKgb("menunggu_keuangan").label}
                                </div>
                              ) : (
                                <>
                                  <button
                                    type="button"
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
                                    className="w-full py-1 rounded font-semibold transition hover:opacity-80"
                                    style={{ fontSize: "10px", background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>
                                    Buat SK
                                  </button>
                                  {p.skSudahDibuat && (
                                    <button
                                      type="button"
                                      onClick={() => p.kgbId && setModal({ jenis: "unggah_sk", kgbId: p.kgbId, status: p.statusKGB ?? "", pegawai: pegawaiModal(p) })}
                                      className="w-full py-1 rounded font-semibold transition hover:opacity-80"
                                      style={{ fontSize: "10px", background: "var(--tint-green-bg)", color: "var(--st-green)", border: "0.5px solid var(--tint-green-ln)" }}>
                                      Unggah SK TTE
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => p.kgbId && setModal({ jenis: "batalkan", kgbId: p.kgbId, pegawai: pegawaiModal(p) })}
                                    className="w-full py-1 rounded font-semibold transition hover:opacity-80"
                                    style={{ fontSize: "10px", background: "var(--sub)", color: "var(--dt3)", border: "0.5px solid var(--ln1)" }}>
                                    Batalkan KGB
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                          {col.key === "selesai" && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => setModal({ jenis: "riwayat", pegawai: pegawaiModal(p) })}
                                className="w-full py-1 rounded font-semibold transition hover:opacity-80"
                                style={{ fontSize: "10px", background: "var(--tint-green-bg)", color: "var(--st-green)", border: `0.5px solid ${col.border}` }}>
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
          </div>
        );
      })()}

      </div>{/* end KGB Jatuh Tempo | Pipeline grid */}

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
          <div className="pointer-events-auto rounded-xl px-3 py-2.5 flex items-start gap-2.5 shadow-lg"
            style={{ background: "var(--card)", border: "1px solid var(--tint-green-ln)" }}>
            <p className="text-xs leading-relaxed flex-1" style={{ color: "var(--st-green)" }}>{pesanBerhasil}</p>
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
