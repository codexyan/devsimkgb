"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, hariIniWita } from "@/lib/waktu";

interface KGBKeuangan {
  id: string;
  status: string;
  tmtKgbBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  flagRapelan: boolean;
  pegawai: {
    nama: string;
    nip: string;
    jabatan: string;
    golonganRuang?: string;
  } | null;
  surat: { nomorSurat: string; pathFile?: string | null } | null;
}

interface Stats {
  kgbTahunIni: number;
  selesai: number;
  rapelanKonfirmasi: number;
  rapelanBerisiko: number;
}

export default function DashboardKeuangan() {
  const [antrian, setAntrian]     = useState<KGBKeuangan[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  function fetchData() {
    setLoading(true);
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json() as Promise<{ stats?: Stats }>),
      fetch("/api/kgb?status=menunggu_keuangan").then((r) => r.json() as Promise<unknown>),
    ])
      .then(([dash, kgbList]) => {
        if (dash?.stats) setStats(dash.stats);
        setAntrian(Array.isArray(kgbList) ? (kgbList as KGBKeuangan[]) : []);
        setLastRefresh(new Date());
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(fetchData, 0);
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") fetchData();
    }, 60_000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);

  const today = new Date();
  const tahun = hariIniWita().getFullYear();

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Dashboard Keuangan</h1>
          <p className="text-xs" style={{ color: "var(--dt4)" }}>
            Monitoring KGB masuk · Kanwil Ditjen Pemasyarakatan Kalsel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-xs px-2.5 py-1 rounded-lg" style={{ color: "var(--dt3)", background: "var(--sub)" }}>
              {formatTanggalId(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            {lastRefresh && (
              <p className="text-xs" style={{ color: "var(--dt5)" }}>
                {lastRefresh.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" })}
              </p>
            )}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            title="Perbarui data"
            aria-label="Perbarui data"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Ringkasan rapelan tahun berjalan */}
      {!loading && stats && stats.rapelanKonfirmasi > 0 && (
        <div className="rounded-lg px-3 py-1.5 flex items-center gap-2.5"
          style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--st-amber)" }} aria-hidden>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs flex-1" style={{ color: "var(--st-amber2)" }}>
            <strong>{stats.rapelanKonfirmasi} KGB</strong> dengan TMT tahun {tahun} dikonfirmasi sebagai rapelan.
          </p>
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: "var(--card)", border: `0.5px solid ${antrian.length > 0 ? "var(--tint-violet-ln)" : "var(--ln1)"}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tint-violet-bg)", color: "var(--st-violet)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none" style={{ color: "var(--st-violet)" }}>{antrian.length}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>Antrian Masuk</p>
              <p className="text-xs mt-0.5" style={{ color: antrian.length > 0 ? "var(--st-violet)" : "var(--dt5)" }}>
                {antrian.length > 0 ? "Menunggu konfirmasi" : "Tidak ada antrian"}
              </p>
            </div>
          </div>

          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none" style={{ color: "var(--st-green)" }}>{stats.selesai}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>KGB Selesai</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--dt5)" }}>Tahun {tahun}</p>
            </div>
          </div>

          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none" style={{ color: "var(--dtn)" }}>{stats.kgbTahunIni}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>KGB Tahun Ini</p>
            </div>
          </div>

          <div className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: "var(--card)", border: `0.5px solid ${stats.rapelanKonfirmasi > 0 ? "var(--tint-amber-ln)" : "var(--ln1)"}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none" style={{ color: "var(--st-amber)" }}>{stats.rapelanKonfirmasi}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>Rapelan</p>
              <p className="text-xs" style={{ color: "var(--dt5)" }}>Tahun {tahun}</p>
              {stats.rapelanBerisiko > 0 && (
                <p className="text-xs" style={{ color: "var(--st-amber)" }}>{stats.rapelanBerisiko} berpotensi rapelan</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Antrian KGB masuk */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: "0.5px solid var(--ln2)" }}>
          <div>
            <h2 className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>KGB Menunggu Konfirmasi Keuangan</h2>
            <p className="text-xs" style={{ color: "var(--dt4)" }}>{antrian.length} KGB masuk · perlu ditindaklanjuti</p>
          </div>
          {antrian.length > 0 && (
            <Link
              href="/dashboard/keuangan"
              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
              style={{ background: "var(--green-solid)", color: "#fff" }}
            >
              Tinjau dan Konfirmasi
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat data...</p>
          </div>
        ) : antrian.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-xs font-medium" style={{ color: "var(--st-green)" }}>Tidak ada antrian KGB</p>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>Semua KGB sudah diproses oleh keuangan</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--ln2)" }}>
            {antrian.map((k) => {
              const st = { label: infoStatusKgb(k.status).label, ...warnaStatusKgb(k.status) };
              const selisih = k.gajiPokokBaru - k.gajiPokokLama;
              const nama = k.pegawai?.nama ?? "-";
              return (
                <div key={k.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{nama}</p>
                      {k.pegawai?.golonganRuang && (
                        <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{k.pegawai.golonganRuang}</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      {k.flagRapelan && (
                        <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", fontSize: "9px" }}>Berpotensi rapelan</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>{k.pegawai?.nip ?? "-"} · {k.pegawai?.jabatan ?? "-"}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5">
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>TMT KGB</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>
                          {formatTanggalId(k.tmtKgbBaru)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>Gaji Pokok Baru</p>
                        <p className="text-xs font-semibold" style={{ color: "var(--st-green)" }}>
                          Rp {k.gajiPokokBaru.toLocaleString("id-ID")}
                          {selisih > 0 && <span className="ml-1 text-xs" style={{ color: "var(--st-green)", opacity: 0.7 }}>(+{selisih.toLocaleString("id-ID")})</span>}
                        </p>
                      </div>
                      {k.surat && (
                        <div>
                          <p className="text-xs" style={{ color: "var(--dt5)" }}>Nomor SK</p>
                          <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{k.surat.nomorSurat}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {k.surat?.pathFile && (
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Membuka SK yang sudah ditandatangani dan diunggah, bukan SK yang dibuat ulang. */}
                      <a
                        href={`/api/blob/download?url=${encodeURIComponent(k.surat.pathFile)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Lihat SK yang sudah ditandatangani, ${nama}`}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                        style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "0.5px solid var(--tint-green-ln)" }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                        SK
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
