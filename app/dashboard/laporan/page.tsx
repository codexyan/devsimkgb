"use client";

import { useEffect, useMemo, useState } from "react";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, hariIniWita, tanggalKalender } from "@/lib/waktu";
import { hitungRekapStatus, rapelanSiklus, satuPerSiklus, type StatusRapelan } from "@/lib/rekapKgb";

interface KGBLaporan {
  id: string;
  pegawaiId: string;
  pegawai: { nama: string; nip: string; jabatan: string; golonganRuang: string; unitKerja: string } | null;
  golonganLama: string;
  golonganBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  tmtKgbBaru: string;
  status: string;
  flagRapelan: boolean;
  rapelanDitetapkan: boolean | null;
  isArsip: boolean | null;
  createdAt: string | null;
  surat: { nomorSurat: string; tanggalSurat: string; pathFile?: string | null } | null;
}

const BULAN_LIST = [
  { value: "", label: "Semua Bulan" },
  { value: "1", label: "Januari" }, { value: "2", label: "Februari" },
  { value: "3", label: "Maret" }, { value: "4", label: "April" },
  { value: "5", label: "Mei" }, { value: "6", label: "Juni" },
  { value: "7", label: "Juli" }, { value: "8", label: "Agustus" },
  { value: "9", label: "September" }, { value: "10", label: "Oktober" },
  { value: "11", label: "November" }, { value: "12", label: "Desember" },
];

const STATUS_FILTER = ["belum_diproses", "sedang_diproses", "menunggu_keuangan", "selesai", "ditolak"] as const;

const GOL_COLOR: Record<string, { bar: string; badge: string; text: string }> = {
  I:   { bar: "#3b82f6", badge: "var(--tint-blue-bg)", text: "var(--st-blue)" },
  II:  { bar: "#10b981", badge: "var(--tint-green-bg)", text: "var(--st-green)" },
  III: { bar: "#f59e0b", badge: "var(--tint-amber-bg)", text: "var(--st-amber2)" },
  IV:  { bar: "#ef4444", badge: "var(--tint-red-bg)", text: "var(--st-red)" },
};

const LABEL_RAPELAN: Record<StatusRapelan, string> = {
  ditetapkan: "Rapelan",
  berpotensi: "Berpotensi rapelan",
};

function fmtRp(n: number | null | undefined) { return typeof n === "number" ? "Rp " + n.toLocaleString("id-ID") : "-"; }
function fmtTgl(s: string) {
  return formatTanggalId(s, { day: "numeric", month: "short", year: "numeric" });
}
function bulanTmt(k: KGBLaporan) {
  const tmt = tanggalKalender(k.tmtKgbBaru);
  return tmt ? tmt.getMonth() + 1 : 0;
}

interface RekapBulanLaporan {
  label: string;
  total: number;
  selesai: number;
  menungguKeuangan: number;
  sedangDiproses: number;
  belumDiproses: number;
  ditolak: number;
  rapelanDitetapkan: number;
  berpotensiRapelan: number;
}

export default function LaporanPage() {
  // Tanggal hari ini (WITA) diambil sekali saat halaman dimuat.
  const [hariIni] = useState(() => hariIniWita());
  const tahunIni = hariIni.getFullYear();
  const [rawList, setRawList] = useState<KGBLaporan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tahun, setTahun]   = useState(tahunIni.toString());
  const [bulan, setBulan]   = useState("");
  const [status, setStatus] = useState("");

  const tahunList = Array.from({ length: 5 }, (_, i) => (tahunIni - i).toString());

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/laporan?tahun=${tahun}`)
        .then(r => r.json() as Promise<{ kgbList?: KGBLaporan[] }>)
        .then(d => setRawList(Array.isArray(d.kgbList) ? d.kgbList : []))
        .catch(() => setRawList([]))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, [tahun]);

  // Daftar detail tetap memuat entri yang dibatalkan. Hitungan memakai definisi bersama lib/rekapKgb.ts:
  // satu KGB per pegawai per TMT, jadi KGB yang dibatalkan lalu diinput ulang dihitung satu kali.
  const dalamBulan = useMemo(
    () => rawList.filter(k => !bulan || bulanTmt(k) === parseInt(bulan)),
    [rawList, bulan],
  );
  const kgbList = useMemo(
    () => dalamBulan.filter(k => !status || k.status === status),
    [dalamBulan, status],
  );
  const siklus = useMemo(
    () => satuPerSiklus(dalamBulan).filter(k => !status || k.status === status),
    [dalamBulan, status],
  );

  // Status rapelan hanya untuk entri yang mewakili siklusnya; entri batal yang sudah diinput ulang tidak.
  const rapelanPerId = useMemo(() => {
    const peta = new Map<string, StatusRapelan | null>();
    for (const k of siklus) peta.set(k.id, rapelanSiklus(k, hariIni).rapelan);
    return peta;
  }, [siklus, hariIni]);

  const stats = useMemo(() => hitungRekapStatus(siklus, hariIni), [siklus, hariIni]);

  const perGolongan = useMemo(() => {
    const map: Record<string, number> = {};
    siklus.forEach(k => { map[k.golonganBaru] = (map[k.golonganBaru] || 0) + 1; });
    return map;
  }, [siklus]);

  const perBulan = useMemo(() => {
    const map: Record<number, RekapBulanLaporan> = {};
    siklus.forEach(k => {
      const bln = bulanTmt(k);
      if (!bln) return;
      if (!map[bln]) map[bln] = { label: BULAN_LIST.find(b => b.value === String(bln))?.label || String(bln), total: 0, selesai: 0, menungguKeuangan: 0, sedangDiproses: 0, belumDiproses: 0, ditolak: 0, rapelanDitetapkan: 0, berpotensiRapelan: 0 };
      const r = map[bln];
      r.total++;
      if (k.status === "selesai") r.selesai++;
      else if (k.status === "menunggu_keuangan") r.menungguKeuangan++;
      else if (k.status === "sedang_diproses") r.sedangDiproses++;
      else if (k.status === "belum_diproses") r.belumDiproses++;
      else if (k.status === "ditolak") r.ditolak++;
      const rapelan = rapelanPerId.get(k.id);
      if (rapelan === "ditetapkan") r.rapelanDitetapkan++;
      if (rapelan === "berpotensi") r.berpotensiRapelan++;
    });
    return Object.entries(map).sort(([a], [b]) => Number(a) - Number(b)).map(([, v]) => v);
  }, [siklus, rapelanPerId]);

  const perUnit = useMemo(() => {
    const map: Record<string, { selesai: number; total: number }> = {};
    siklus.forEach(k => {
      const u = k.pegawai?.unitKerja || "Lainnya";
      if (!map[u]) map[u] = { selesai: 0, total: 0 };
      map[u].total++;
      if (k.status === "selesai") map[u].selesai++;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [siklus]);

  const golEntries = Object.entries(perGolongan).sort((a, b) => a[0].localeCompare(b[0]));

  const judulBulan = bulan ? (BULAN_LIST.find(b => b.value === bulan)?.label + " ") : "";
  const judulLaporan = `Rekap KGB ${judulBulan}${tahun}`;
  const selesaiPct = stats.total > 0 ? Math.round((stats.selesai / stats.total) * 100) : 0;
  const tanggalCetak = formatTanggalId(new Date());

  const kolomStat = [
    { label: "Total KGB",          value: stats.total,             color: "var(--dtn)",       bg: "var(--sub)" },
    { label: infoStatusKgb("selesai").label,           value: stats.selesai,           color: "var(--st-green)",  bg: "var(--tint-green-bg)" },
    { label: infoStatusKgb("menunggu_keuangan").label, value: stats.menungguKeuangan,  color: "var(--st-violet)", bg: stats.menungguKeuangan > 0 ? "var(--tint-violet-bg)" : "var(--sub)" },
    { label: infoStatusKgb("sedang_diproses").label,   value: stats.sedangDiproses,    color: "var(--dtn)",       bg: "var(--sub)" },
    { label: infoStatusKgb("belum_diproses").label,    value: stats.belumDiproses,     color: "var(--st-amber)",  bg: stats.belumDiproses > 0 ? "var(--tint-amber-bg)" : "var(--sub)" },
    { label: infoStatusKgb("ditolak").label,           value: stats.ditolak,           color: "var(--st-red)",    bg: stats.ditolak > 0 ? "var(--tint-red-bg)" : "var(--sub)" },
    { label: "Rapelan",            value: stats.rapelanDitetapkan, color: "var(--st-red)",    bg: stats.rapelanDitetapkan > 0 ? "var(--tint-red-bg)" : "var(--sub)" },
    { label: "Berpotensi Rapelan", value: stats.berpotensiRapelan, color: "var(--st-amber)",  bg: stats.berpotensiRapelan > 0 ? "var(--tint-amber-bg)" : "var(--sub)" },
  ];
  const catatanHitungan = "Total dihitung satu KGB per pegawai per TMT: KGB yang dibatalkan lalu diinput ulang dihitung satu kali, dan Dibatalkan hanya memuat yang belum diinput ulang. Rapelan = ditetapkan keuangan saat konfirmasi.";

  return (
    <>
      <style>{`
        .no-print-screen { display: none !important; }
        @media print {
          body * { visibility: hidden !important; }
          #laporan-print-area, #laporan-print-area * { visibility: visible !important; }
          #laporan-print-area { position: absolute; top: 0; left: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          .no-print-screen { display: revert !important; }
          @page { margin: 1cm 1.5cm; size: A4 landscape; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 0.5px solid #c0ccd8; padding: 3px 5px; font-size: 8px; }
          th { background: var(--tint-navy) !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: var(--dtn) !important; font-weight: 700; }
          .print-kop-divider { border-top: 2px solid var(--dtn); border-bottom: 0.5px solid var(--dtn); margin: 5px 0; }
          .print-meta-table td, .print-meta-table th { border: none !important; padding: 2px 4px !important; background: transparent !important; }
          .print-stat-row td { border: none !important; padding: 2px 8px !important; font-size: 9px !important; }
        }
      `}</style>

      <div>
        {/* ── Header + Filter ── */}
        <div className="no-print flex flex-wrap items-center gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold" style={{ color: "var(--dtn)" }}>Laporan & Rekap KGB</h1>
            <p className="text-xs mt-px" style={{ color: "var(--dt4)" }}>
              {loading ? "Memuat…" : `${stats.total} KGB · ${selesaiPct}% selesai · Tahun ${tahun}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={tahun} onChange={e => setTahun(e.target.value)} aria-label="Tahun TMT"
              className="rounded-xl px-3 py-2 text-xs outline-none"
              style={{ border: "1px solid var(--ln0)", background: "var(--card)", color: "var(--dtn)", minWidth: "90px" }}>
              {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={bulan} onChange={e => setBulan(e.target.value)} aria-label="Bulan TMT"
              className="rounded-xl px-3 py-2 text-xs outline-none"
              style={{ border: "1px solid var(--ln0)", background: "var(--card)", color: "var(--dtn)", minWidth: "125px" }}>
              {BULAN_LIST.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status KGB"
              className="rounded-xl px-3 py-2 text-xs outline-none"
              style={{ border: "1px solid var(--ln0)", background: "var(--card)", color: "var(--dtn)", minWidth: "145px" }}>
              <option value="">Semua Status</option>
              {STATUS_FILTER.map(s => <option key={s} value={s}>{infoStatusKgb(s).label}</option>)}
            </select>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--navy-solid)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Cetak / PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat laporan...</p>
          </div>
        ) : (
        <div id="laporan-print-area">

          {/* ════ KOP SURAT (print only) ════ */}
          <div className="no-print-screen" style={{ marginBottom: "8px" }}>
            <table className="print-meta-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5px" }}>
              <tbody>
                <tr>
                  <td style={{ width: "70px", textAlign: "center", verticalAlign: "middle", border: "none", padding: "0" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo-imipas.png" alt="Logo Imipas" style={{ width: "58px", height: "58px", objectFit: "contain" }} />
                  </td>
                  <td style={{ textAlign: "center", verticalAlign: "middle", border: "none", padding: "0" }}>
                    <p style={{ fontSize: "8px", fontWeight: 600, color: "var(--dtn)", letterSpacing: "0.5px", margin: 0 }}>
                      KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN REPUBLIK INDONESIA
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--dtn)", margin: "2px 0 0" }}>
                      KANTOR WILAYAH DIREKTORAT JENDERAL PEMASYARAKATAN
                    </p>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--dtn)", margin: 0 }}>KALIMANTAN SELATAN</p>
                  </td>
                  <td style={{ width: "70px", textAlign: "center", verticalAlign: "middle", border: "none", padding: "0" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo-imipas.png" alt="Logo Imipas" style={{ width: "58px", height: "58px", objectFit: "contain" }} />
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="print-kop-divider" />
            <div style={{ textAlign: "center", margin: "5px 0 3px" }}>
              <p style={{ fontSize: "12px", fontWeight: 800, color: "var(--dtn)", letterSpacing: "0.5px", margin: 0 }}>
                REKAP KENAIKAN GAJI BERKALA (KGB)
              </p>
              <p style={{ fontSize: "8.5px", color: "var(--dt3)", margin: "2px 0 0" }}>
                {judulLaporan} &nbsp;·&nbsp; Dicetak: {tanggalCetak}
              </p>
            </div>
            {/* Print stats row */}
            <table className="print-stat-row" style={{ width: "100%", borderCollapse: "collapse", marginTop: "4px", marginBottom: "2px" }}>
              <tbody>
                <tr>
                  {[
                    ...kolomStat.map(c => ({ l: c.label, v: c.value as number | string, c: c.color })),
                    { l: "Selesai %", v: `${selesaiPct}%`, c: "var(--st-green)" },
                  ].map(({ l, v, c }) => (
                    <td key={l} style={{ textAlign: "center", border: "0.5px solid var(--ln0)", padding: "3px 8px", background: "var(--sub)" }}>
                      <div style={{ fontSize: "7px", color: "var(--dt4)" }}>{l}</div>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: c }}>{v}</div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: "7px", color: "var(--dt4)", margin: "0 0 6px" }}>{catatanHitungan}</p>
          </div>

          {/* ════ STAT BAR (screen only) ════ */}
          <div className="no-print mb-3 rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8" style={{ borderBottom: "0.5px solid var(--ln1)" }}>
              {kolomStat.map((c) => (
                <div key={c.label} className="px-3 py-2.5" style={{ background: c.bg, borderRight: "0.5px solid var(--ln2)", borderBottom: "0.5px solid var(--ln2)" }}>
                  <p style={{ fontSize: "18px", fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</p>
                  <p style={{ fontSize: "10px", color: "var(--dt4)", marginTop: "2px" }}>{c.label}</p>
                </div>
              ))}
            </div>
            {/* Progress bar */}
            <div className="px-3 py-2 flex items-center gap-3" style={{ background: "var(--sub)" }}>
              <span style={{ fontSize: "10px", color: "var(--dt4)", whiteSpace: "nowrap" }}>{selesaiPct}% selesai</span>
              <div className="flex-1 rounded-full overflow-hidden" style={{ height: "5px", background: "var(--ln2)" }}>
                <div style={{ height: "100%", width: `${selesaiPct}%`, background: "#10b981", transition: "width 0.5s", borderRadius: "999px" }} />
              </div>
              <span style={{ fontSize: "10px", color: "var(--st-green)", whiteSpace: "nowrap" }}>{stats.selesai}/{stats.total}</span>
            </div>
            <p className="px-3 pb-2" style={{ fontSize: "10px", color: "var(--dt5)", background: "var(--sub)" }}>{catatanHitungan}</p>
          </div>

          {/* ════ REKAP 3-KOLOM: Golongan | Bulan | Unit ════ */}
          <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-2 mb-3">

            {/* Per Golongan */}
            <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
              <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--dtn)" }}>Per Golongan</p>
                <p style={{ fontSize: "10px", color: "var(--dt5)" }}>{golEntries.length} ruang</p>
              </div>
              <div className="p-2.5 flex flex-wrap gap-1.5">
                {golEntries.map(([ruang, count]) => {
                  const grp = ruang.split("/")[0];
                  const c = GOL_COLOR[grp] ?? { bar: "var(--dt4)", badge: "var(--ln2)", text: "#475569" };
                  return (
                    <span key={ruang} style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", borderRadius: "999px", background: c.badge, border: `1px solid ${c.bar}55`, fontSize: "11px", fontWeight: 600, color: c.text }}>
                      {ruang}
                      <span style={{ fontSize: "10px", fontWeight: 800, color: "#fff", background: c.bar, padding: "0 5px", borderRadius: "999px", lineHeight: "15px", minWidth: "17px", textAlign: "center" }}>{count}</span>
                    </span>
                  );
                })}
                {golEntries.length === 0 && <p style={{ fontSize: "11px", color: "var(--dt5)" }}>Tidak ada data</p>}
              </div>
            </div>

            {/* Per Bulan */}
            <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
              <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--dtn)" }}>Per Bulan TMT</p>
                <p style={{ fontSize: "10px", color: "var(--dt5)" }}>{perBulan.length} bulan</p>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "130px" }}>
                {perBulan.length === 0 ? (
                  <p className="px-3 py-2" style={{ fontSize: "11px", color: "var(--dt5)" }}>Tidak ada data</p>
                ) : (
                  <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "11px" }}>
                    <tbody>
                      {perBulan.map(b => {
                        const pct = b.total > 0 ? (b.selesai / b.total) * 100 : 0;
                        const rapelan = b.rapelanDitetapkan + b.berpotensiRapelan;
                        return (
                          <tr key={b.label} style={{ borderBottom: "0.5px solid var(--ln2)" }}>
                            <td className="px-3 py-1.5 font-medium" style={{ color: "var(--dtn)", whiteSpace: "nowrap" }}>{b.label}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <div style={{ flex: 1, height: "4px", background: "var(--ln2)", borderRadius: "99px", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${pct}%`, background: "#10b981" }} />
                                </div>
                                <span style={{ fontSize: "10px", color: "var(--st-green)", whiteSpace: "nowrap" }}>{b.selesai}/{b.total}</span>
                              </div>
                            </td>
                            {rapelan > 0 && (
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                <span style={{ fontSize: "9px", color: "var(--st-red)", fontWeight: 700 }}>{rapelan} rapelan</span>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Per Unit Kerja */}
            <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
              <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--dtn)" }}>Per Unit Kerja</p>
                <p style={{ fontSize: "10px", color: "var(--dt5)" }}>{perUnit.length} unit</p>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: "130px" }}>
                {perUnit.length === 0 ? (
                  <p className="px-3 py-2" style={{ fontSize: "11px", color: "var(--dt5)" }}>Tidak ada data</p>
                ) : (
                  <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "11px" }}>
                    <tbody>
                      {perUnit.map(([unit, { selesai, total }]) => {
                        const pct = total > 0 ? (selesai / total) * 100 : 0;
                        const shortUnit = unit.length > 32 ? unit.slice(0, 32) + "…" : unit;
                        return (
                          <tr key={unit} style={{ borderBottom: "0.5px solid var(--ln2)" }}>
                            <td className="px-3 py-1.5" style={{ color: "var(--dt3)", maxWidth: "160px" }}>
                              <p className="truncate" style={{ fontSize: "10px" }} title={unit}>{shortUnit}</p>
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <div style={{ flex: 1, height: "4px", background: "var(--ln2)", borderRadius: "99px", overflow: "hidden", minWidth: "40px" }}>
                                  <div style={{ height: "100%", width: `${pct}%`, background: "#10b981" }} />
                                </div>
                                <span style={{ fontSize: "10px", color: "var(--st-green)", whiteSpace: "nowrap" }}>{selesai}/{total}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          {/* ════ REKAP PER BULAN (print only) ════ */}
          {perBulan.length > 0 && (
            <div className="no-print-screen" style={{ marginBottom: "6px" }}>
              <p style={{ fontSize: "9px", fontWeight: 700, color: "var(--dtn)", marginBottom: "3px" }}>REKAP PER BULAN</p>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>{["Bulan","Total","Selesai","Menunggu Keuangan","Sedang Diproses","Belum Diproses","Dibatalkan","Rapelan","Berpotensi Rapelan"].map(h => <th key={h} style={{ textAlign: "center" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {perBulan.map(b => (
                    <tr key={b.label}>
                      <td style={{ fontWeight: 600 }}>{b.label}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{b.total}</td>
                      <td style={{ textAlign: "center", color: "var(--st-green)" }}>{b.selesai}</td>
                      <td style={{ textAlign: "center", color: "var(--st-violet)" }}>{b.menungguKeuangan}</td>
                      <td style={{ textAlign: "center", color: "var(--dtn)" }}>{b.sedangDiproses}</td>
                      <td style={{ textAlign: "center", color: "var(--st-amber)" }}>{b.belumDiproses}</td>
                      <td style={{ textAlign: "center", color: "var(--st-red)" }}>{b.ditolak}</td>
                      <td style={{ textAlign: "center", color: "var(--st-red)", fontWeight: b.rapelanDitetapkan > 0 ? 700 : 400 }}>{b.rapelanDitetapkan}</td>
                      <td style={{ textAlign: "center", color: "var(--st-amber)", fontWeight: b.berpotensiRapelan > 0 ? 700 : 400 }}>{b.berpotensiRapelan}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: "1px solid var(--dtn)" }}>
                    <td>Total</td>
                    <td style={{ textAlign: "center" }}>{stats.total}</td>
                    <td style={{ textAlign: "center", color: "var(--st-green)" }}>{stats.selesai}</td>
                    <td style={{ textAlign: "center", color: "var(--st-violet)" }}>{stats.menungguKeuangan}</td>
                    <td style={{ textAlign: "center" }}>{stats.sedangDiproses}</td>
                    <td style={{ textAlign: "center", color: "var(--st-amber)" }}>{stats.belumDiproses}</td>
                    <td style={{ textAlign: "center", color: "var(--st-red)" }}>{stats.ditolak}</td>
                    <td style={{ textAlign: "center", color: "var(--st-red)" }}>{stats.rapelanDitetapkan}</td>
                    <td style={{ textAlign: "center", color: "var(--st-amber)" }}>{stats.berpotensiRapelan}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ════ TABEL DETAIL ════ */}
          <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
            <div className="no-print px-4 py-2 flex items-center justify-between" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--dtn)" }}>Detail: {judulLaporan}</p>
              <p style={{ fontSize: "10px", color: "var(--dt4)" }}>{kgbList.length} entri</p>
            </div>
            <div className="no-print-screen" style={{ marginBottom: "3px" }}>
              <p style={{ fontSize: "9px", fontWeight: 700, color: "var(--dtn)" }}>DAFTAR PEGAWAI KGB: {judulLaporan.toUpperCase()}</p>
            </div>

            {kgbList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <p className="text-xs" style={{ color: "var(--dt5)" }}>Tidak ada data KGB pada periode ini</p>
              </div>
            ) : (
              <div className="overflow-x-auto tbl-scroll">
                <table className="w-full" style={{ fontSize: "12px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}>
                      {["No","Nama / NIP","Jabatan / Unit","Gol.","Gaji Baru","Selisih","MKG","TMT KGB","No. SK","Status"].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap" style={{ fontSize: "10px", color: "var(--dt4)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kgbList.map((k, i) => {
                      const selisih = (k.gajiPokokBaru ?? 0) - k.gajiPokokLama;
                      const rapelan = rapelanPerId.get(k.id) ?? null;
                      const warna = warnaStatusKgb(k.status);
                      const grp = k.golonganBaru.split("/")[0];
                      const gc = GOL_COLOR[grp] ?? { bar: "var(--dt4)", badge: "var(--ln2)", text: "#475569" };
                      return (
                        <tr key={k.id} style={{ borderBottom: i < kgbList.length - 1 ? "0.5px solid var(--ln2)" : "none", background: rapelan === "berpotensi" ? "var(--tint-amber-bg)" : i % 2 === 0 ? "var(--card)" : "var(--sub)" }}>
                          <td className="px-3 py-2" style={{ color: "var(--dt5)", fontSize: "10px", whiteSpace: "nowrap" }}>{i + 1}</td>
                          <td className="px-3 py-2">
                            <p className="font-semibold" style={{ fontSize: "11px", color: "var(--dtn)", whiteSpace: "nowrap" }}>{k.pegawai?.nama ?? "-"}</p>
                            <p style={{ fontSize: "10px", color: "var(--dt5)", fontFamily: "monospace" }}>{k.pegawai?.nip ?? "-"}</p>
                          </td>
                          <td className="px-3 py-2" style={{ maxWidth: "160px" }}>
                            <p style={{ fontSize: "10px", color: "var(--dtn)" }} className="truncate">{k.pegawai?.jabatan ?? "-"}</p>
                            <p style={{ fontSize: "9px", color: "var(--dt5)" }} className="truncate">{k.pegawai?.unitKerja ?? "-"}</p>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <span style={{ fontSize: "9px", color: "var(--dt5)", textDecoration: "line-through" }}>{k.golonganLama}</span>
                              <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "5px", background: gc.badge, color: gc.text, width: "fit-content" }}>{k.golonganBaru}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--st-green)" }}>{fmtRp(k.gajiPokokBaru)}</p>
                            <p style={{ fontSize: "9px", color: "var(--dt5)", textDecoration: "line-through" }}>{fmtRp(k.gajiPokokLama)}</p>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {selisih > 0 && (
                              <span style={{ fontSize: "10px", color: "#10b981", fontWeight: 600 }}>+{fmtRp(selisih)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ fontSize: "11px", color: "var(--dt3)" }}>
                            {k.mkgTahunBaru} thn{k.mkgBulanBaru > 0 ? ` ${k.mkgBulanBaru} bln` : ""}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ fontSize: "11px", color: "var(--dt3)" }}>
                            {fmtTgl(k.tmtKgbBaru)}
                          </td>
                          <td className="px-3 py-2" style={{ minWidth: "110px" }}>
                            {k.surat ? (
                              <>
                                <p style={{ fontSize: "10px", color: "var(--dtn)", fontWeight: 600 }}>{k.surat.nomorSurat}</p>
                                <p style={{ fontSize: "9px", color: "var(--dt4)" }}>{fmtTgl(k.surat.tanggalSurat)}</p>
                              </>
                            ) : (
                              <span style={{ fontSize: "10px", color: "var(--dt6)" }}>-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "999px", background: warna.bg, color: warna.color, border: `1px solid ${warna.color}`, whiteSpace: "nowrap", width: "fit-content" }}>
                                {infoStatusKgb(k.status).label}
                              </span>
                              {rapelan && (
                                <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "999px", background: rapelan === "ditetapkan" ? "var(--tint-red-bg)" : "var(--tint-amber-bg)", color: rapelan === "ditetapkan" ? "var(--st-red)" : "var(--st-amber)", border: `1px solid ${rapelan === "ditetapkan" ? "var(--tint-red-ln)" : "var(--tint-amber-ln)"}`, whiteSpace: "nowrap", width: "fit-content" }}>
                                  {LABEL_RAPELAN[rapelan]}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Print footer */}
          <div className="no-print-screen" style={{ marginTop: "10px", borderTop: "0.5px solid #c0ccd8", paddingTop: "4px" }}>
            <table className="print-meta-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ border: "none", fontSize: "7px", color: "var(--dt3)", padding: 0 }}>SIM-KGB · Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan · Berdasarkan PP No. 5 Tahun 2024</td>
                  <td style={{ border: "none", fontSize: "7px", color: "var(--dt3)", padding: 0, textAlign: "right" }}>{judulLaporan} · Dicetak {tanggalCetak}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
        )}
      </div>
    </>
  );
}
