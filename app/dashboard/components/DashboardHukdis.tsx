"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Pegawai {
  id: string;
  nip: string;
  nama: string;
  jabatan: string;
  golonganRuang: string;
  statusHukdis: boolean;
  tanggalHukdisBerakhir: string | null;
}

function daysDiff(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / 86400000);
}

export default function DashboardHukdis() {
  const [list, setList] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  function fetchData() {
    setLoading(true);
    fetch("/api/pegawai?search=&status=")
      .then((r) => r.json() as any)
      .then((d) => {
        setList(Array.isArray(d) ? d : []);
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

  const aktif        = list.filter((p) => p.statusHukdis);
  const tanpaHukdis  = list.filter((p) => !p.statusHukdis);
  const hampirBerakhir = aktif.filter(
    (p) => p.tanggalHukdisBerakhir && daysDiff(p.tanggalHukdisBerakhir) <= 30 && daysDiff(p.tanggalHukdisBerakhir) >= 0
  );
  const terlambatBerakhir = aktif.filter(
    (p) => p.tanggalHukdisBerakhir && daysDiff(p.tanggalHukdisBerakhir) < 0
  );

  const sortedAktif = [...aktif].sort((a, b) => {
    if (!a.tanggalHukdisBerakhir) return 1;
    if (!b.tanggalHukdisBerakhir) return -1;
    return new Date(a.tanggalHukdisBerakhir).getTime() - new Date(b.tanggalHukdisBerakhir).getTime();
  });

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold leading-tight" style={{ color: "var(--dtn)" }}>
            Dashboard Hukuman Disiplin
          </h1>
          <p className="text-xs" style={{ color: "var(--dt4)" }}>
            Monitoring hukdis aktif · Kanwil Ditjen Pemasyarakatan Kalsel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end">
            <p className="text-xs px-2.5 py-1 rounded-lg" style={{ color: "var(--dt3)", background: "var(--sub)" }}>
              {today.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            {lastRefresh && (
              <p className="text-xs" style={{ color: "var(--dt5)" }}>
                {lastRefresh.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <button
            onClick={fetchData}
            title="Perbarui data"
            disabled={loading}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:opacity-80 disabled:opacity-40"
            style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {!loading && (
        <div className="space-y-1.5">
          {terlambatBerakhir.length > 0 && (
            <div className="rounded-lg px-3 py-1.5 flex items-center gap-2.5"
              style={{ background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p className="text-xs flex-1" style={{ color: "var(--st-red)" }}>
                <strong>{terlambatBerakhir.length} pegawai</strong> masa hukdisnya sudah lewat namun belum diperbarui. Segera tinjau dan perbarui status hukdis.
              </p>
            </div>
          )}
          {hampirBerakhir.length > 0 && (
            <div className="rounded-lg px-3 py-1.5 flex items-center gap-2.5"
              style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b87c0a" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <p className="text-xs flex-1" style={{ color: "var(--st-amber2)" }}>
                <strong>{hampirBerakhir.length} pegawai</strong> masa hukdisnya berakhir dalam 30 hari ke depan.
              </p>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white rounded-xl p-3 flex items-center gap-3" style={{ border: "0.5px solid var(--ln1)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none" style={{ color: "var(--dtn)" }}>{list.length}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>Total Pegawai</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 flex items-center gap-3"
          style={{ border: `0.5px solid ${aktif.length > 0 ? "var(--tint-red-ln)" : "var(--ln1)"}` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none" style={{ color: "var(--st-red)" }}>{aktif.length}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>Hukdis Aktif</p>
            {terlambatBerakhir.length > 0 && (
              <p className="text-xs" style={{ color: "var(--st-red)" }}>{terlambatBerakhir.length} sudah lewat</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 flex items-center gap-3"
          style={{ border: `0.5px solid ${hampirBerakhir.length > 0 ? "var(--tint-amber-ln)" : "var(--ln1)"}` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none" style={{ color: "var(--st-amber)" }}>{hampirBerakhir.length}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>Berakhir &lt;30 Hari</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-3 flex items-center gap-3" style={{ border: "0.5px solid var(--ln1)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-none" style={{ color: "var(--st-green)" }}>{tanpaHukdis.length}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>Tanpa Hukdis</p>
          </div>
        </div>
      </div>

      {/* Daftar pegawai ber-hukdis */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "0.5px solid var(--ln2)" }}>
          <div>
            <h2 className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Pegawai dengan Hukdis Aktif</h2>
            <p className="text-xs" style={{ color: "var(--dt4)" }}>{aktif.length} pegawai · diurutkan berdasarkan tanggal berakhir</p>
          </div>
          <Link
            href="/dashboard/pegawai"
            className="text-xs px-3 py-1.5 rounded-lg font-semibold transition"
            style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}
          >
            Kelola Semua
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-14">
            <p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat data...</p>
          </div>
        ) : sortedAktif.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--tint-green-bg)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-xs font-medium" style={{ color: "var(--st-green)" }}>Tidak ada pegawai dengan hukdis aktif</p>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>Semua pegawai dalam kondisi normal</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}>
                    {["Pegawai", "Jabatan / Golongan", "Masa Hukdis Berakhir", "Sisa Hari", "Aksi"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold whitespace-nowrap" style={{ color: "var(--dt4)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAktif.map((p, i) => {
                    const sisa = p.tanggalHukdisBerakhir ? daysDiff(p.tanggalHukdisBerakhir) : null;
                    const isLewat = sisa !== null && sisa < 0;
                    const isKritis = sisa !== null && sisa >= 0 && sisa <= 7;
                    const isWarn = sisa !== null && sisa > 7 && sisa <= 30;
                    return (
                      <tr key={p.id} style={{ borderBottom: i < sortedAktif.length - 1 ? "0.5px solid var(--ln2)" : "none" }}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>
                              {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{p.nama}</p>
                              <p className="text-xs" style={{ color: "var(--dt4)" }}>{p.nip}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{p.jabatan}</p>
                          <span className="inline-block text-xs px-1.5 py-0.5 rounded-md font-medium mt-0.5" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{p.golonganRuang}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {p.tanggalHukdisBerakhir ? (
                            <p className="text-xs font-medium" style={{ color: isLewat ? "var(--st-red)" : "var(--dtn)" }}>
                              {new Date(p.tanggalHukdisBerakhir).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                          ) : (
                            <p className="text-xs" style={{ color: "var(--dt5)" }}>Tidak ditentukan</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {sisa !== null ? (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{
                                background: isLewat ? "var(--tint-red-bg)" : isKritis ? "var(--tint-red-bg)" : isWarn ? "var(--tint-amber-bg)" : "var(--tint-green-bg)",
                                color: isLewat ? "var(--st-red)" : isKritis ? "var(--st-red)" : isWarn ? "var(--st-amber)" : "var(--st-green)",
                              }}>
                              {isLewat ? `${Math.abs(sisa)} hari lewat` : `${sisa} hari lagi`}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--dt5)" }}>-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/pegawai/${p.id}/riwayat`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap"
                            style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            Kelola Hukdis
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y" style={{ borderColor: "var(--ln2)" }}>
              {sortedAktif.map((p) => {
                const sisa = p.tanggalHukdisBerakhir ? daysDiff(p.tanggalHukdisBerakhir) : null;
                const isLewat = sisa !== null && sisa < 0;
                const isWarn  = sisa !== null && sisa >= 0 && sisa <= 30;
                return (
                  <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>
                      {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: "var(--dtn)" }}>{p.nama}</p>
                      <p className="text-xs" style={{ color: "var(--dt4)" }}>{p.golonganRuang} · {p.jabatan}</p>
                      {p.tanggalHukdisBerakhir && (
                        <p className="text-xs mt-0.5" style={{ color: isLewat ? "var(--st-red)" : "var(--dt4)" }}>
                          Berakhir: {new Date(p.tanggalHukdisBerakhir).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          {sisa !== null && (
                            <span className="ml-1.5 font-semibold" style={{ color: isLewat ? "var(--st-red)" : isWarn ? "var(--st-amber)" : "var(--st-green)" }}>
                              ({isLewat ? `${Math.abs(sisa)}hr lewat` : `${sisa}hr lagi`})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/pegawai/${p.id}/riwayat`}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }}
                    >
                      Kelola
                    </Link>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Quick nav */}
      <Link
        href="/dashboard/pegawai"
        className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition hover:opacity-80"
        style={{ background: "var(--card)", color: "var(--dtn)", border: "0.5px solid var(--ln1)" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        Lihat Semua Pegawai dan Kelola Hukdis
      </Link>
    </div>
  );
}
