"use client";

import { useEffect, useMemo, useState } from "react";

interface KGBLaporan {
  id: string;
  pegawai: { nama: string; nip: string; jabatan: string; golonganRuang: string; unitKerja: string };
  golonganLama: string;
  golonganBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  tmtKgbBaru: string;
  status: string;
  flagRapelan: boolean;
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

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; border: string; printLabel: string }> = {
  belum_diproses: { label: "Belum Diproses", bg: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "var(--tint-amber-ln)", printLabel: "Belum" },
  sedang_diproses: { label: "Sedang Diproses", bg: "var(--tint-navy)", color: "var(--dtn)", border: "var(--ln0)", printLabel: "Diproses" },
  selesai: { label: "Selesai", bg: "#ecfdf5", color: "var(--st-green)", border: "var(--tint-green-ln)", printLabel: "Selesai ✓" },
  ditolak: { label: "Dibatalkan", bg: "var(--tint-red-bg)", color: "var(--st-red)", border: "var(--tint-red-ln)", printLabel: "Dibatalkan" },
};

const GOL_COLOR: Record<string, { bar: string; badge: string; text: string }> = {
  I:   { bar: "#3b82f6", badge: "var(--tint-blue-bg)", text: "var(--st-blue)" },
  II:  { bar: "#10b981", badge: "var(--tint-green-bg)", text: "var(--st-green)" },
  III: { bar: "#f59e0b", badge: "var(--tint-amber-bg)", text: "var(--st-amber2)" },
  IV:  { bar: "#ef4444", badge: "var(--tint-red-bg)", text: "var(--st-red)" },
};

const todayNorm = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();
function isRapelan(k: KGBLaporan) {
  if (k.status === "selesai" || k.status === "ditolak") return false;
  const tmt = new Date(k.tmtKgbBaru);
  return todayNorm > new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
}
function fmtRp(n: number) { return "Rp " + n.toLocaleString("id-ID"); }
function fmtTgl(s: string) {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function LaporanPage() {
  const [rawList, setRawList] = useState<KGBLaporan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tahun, setTahun]   = useState(new Date().getFullYear().toString());
  const [bulan, setBulan]   = useState("");
  const [status, setStatus] = useState("");

  const tahunList = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/laporan?tahun=${tahun}`)
        .then(r => r.json() as any)
        .then(d => setRawList(d.kgbList ?? []))
        .catch(() => setRawList([]))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, [tahun]);

  const kgbList = useMemo(() => rawList.filter(k => {
    if (bulan && new Date(k.tmtKgbBaru).getMonth() + 1 !== parseInt(bulan)) return false;
    if (status && k.status !== status) return false;
    return true;
  }), [rawList, bulan, status]);

  const stats = useMemo(() => ({
    total: kgbList.length,
    selesai: kgbList.filter(k => k.status === "selesai").length,
    diproses: kgbList.filter(k => k.status === "sedang_diproses").length,
    belum: kgbList.filter(k => k.status === "belum_diproses").length,
    ditolak: kgbList.filter(k => k.status === "ditolak").length,
    rapelan: kgbList.filter(isRapelan).length,
  }), [kgbList]);

  const perGolongan = useMemo(() => {
    const map: Record<string, number> = {};
    kgbList.forEach(k => { map[k.golonganBaru] = (map[k.golonganBaru] || 0) + 1; });
    return map;
  }, [kgbList]);

  const perBulan = useMemo(() => {
    const map: Record<number, { label: string; selesai: number; diproses: number; belum: number; ditolak: number; rapelan: number; total: number }> = {};
    kgbList.forEach(k => {
      const bln = new Date(k.tmtKgbBaru).getMonth() + 1;
      if (!map[bln]) map[bln] = { label: BULAN_LIST.find(b => b.value === String(bln))?.label || String(bln), selesai: 0, diproses: 0, belum: 0, ditolak: 0, rapelan: 0, total: 0 };
      map[bln].total++;
      if (k.status === "selesai") map[bln].selesai++;
      else if (k.status === "sedang_diproses") map[bln].diproses++;
      else if (k.status === "belum_diproses") map[bln].belum++;
      else if (k.status === "ditolak") map[bln].ditolak++;
      if (isRapelan(k)) map[bln].rapelan++;
    });
    return Object.entries(map).sort(([a], [b]) => Number(a) - Number(b)).map(([, v]) => v);
  }, [kgbList]);

  const perUnit = useMemo(() => {
    const map: Record<string, { selesai: number; total: number }> = {};
    kgbList.forEach(k => {
      const u = k.pegawai.unitKerja || "Lainnya";
      if (!map[u]) map[u] = { selesai: 0, total: 0 };
      map[u].total++;
      if (k.status === "selesai") map[u].selesai++;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [kgbList]);

  const golEntries = Object.entries(perGolongan).sort((a, b) => a[0].localeCompare(b[0]));

  const judulBulan = bulan ? (BULAN_LIST.find(b => b.value === bulan)?.label + " ") : "";
  const judulLaporan = `Rekap KGB ${judulBulan}${tahun}`;
  const selesaiPct = stats.total > 0 ? Math.round((stats.selesai / stats.total) * 100) : 0;
  const tanggalCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

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
            <select value={tahun} onChange={e => setTahun(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs outline-none"
              style={{ border: "1px solid var(--ln0)", background: "var(--card)", color: "var(--dtn)", minWidth: "90px" }}>
              {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={bulan} onChange={e => setBulan(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs outline-none"
              style={{ border: "1px solid var(--ln0)", background: "var(--card)", color: "var(--dtn)", minWidth: "125px" }}>
              {BULAN_LIST.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs outline-none"
              style={{ border: "1px solid var(--ln0)", background: "var(--card)", color: "var(--dtn)", minWidth: "145px" }}>
              <option value="">Semua Status</option>
              <option value="belum_diproses">Belum Diproses</option>
              <option value="sedang_diproses">Sedang Diproses</option>
              <option value="selesai">Selesai</option>
              <option value="ditolak">Dibatalkan</option>
            </select>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--navy-solid)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <table className="print-stat-row" style={{ width: "100%", borderCollapse: "collapse", marginTop: "4px", marginBottom: "6px" }}>
              <tbody>
                <tr>
                  {[
                    { l: "Total", v: stats.total, c: "var(--dtn)" },
                    { l: "Selesai", v: stats.selesai, c: "var(--st-green)" },
                    { l: "Diproses", v: stats.diproses, c: "var(--dtn)" },
                    { l: "Belum", v: stats.belum, c: "var(--st-amber)" },
                    { l: "Dibatalkan", v: stats.ditolak, c: "var(--st-red)" },
                    { l: "Rapelan", v: stats.rapelan, c: "var(--st-red)" },
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
          </div>

          {/* ════ STAT BAR (screen only) ════ */}
          <div className="no-print mb-3 rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
            <div className="grid" style={{ gridTemplateColumns: "repeat(6, 1fr)", borderBottom: "0.5px solid var(--ln1)" }}>
              {[
                { label: "Total KGB",    value: stats.total,    color: "var(--dtn)", bg: "var(--sub)" },
                { label: "Selesai",      value: stats.selesai,  color: "var(--st-green)", bg: "var(--tint-green-bg)" },
                { label: "Diproses",     value: stats.diproses, color: "var(--dtn)", bg: "var(--sub)" },
                { label: "Belum",        value: stats.belum,    color: "var(--st-amber)", bg: stats.belum > 0 ? "var(--tint-amber-bg)" : "var(--sub)" },
                { label: "Dibatalkan",   value: stats.ditolak,  color: "var(--st-red)", bg: stats.ditolak > 0 ? "var(--tint-red-bg)" : "var(--sub)" },
                { label: "Rapelan",      value: stats.rapelan,  color: "var(--st-red)", bg: stats.rapelan > 0 ? "var(--tint-red-bg)" : "var(--sub)" },
              ].map((c, idx) => (
                <div key={c.label} className="px-3 py-2.5" style={{ background: c.bg, borderRight: idx < 5 ? "0.5px solid var(--ln2)" : "none" }}>
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
                            {b.rapelan > 0 && (
                              <td className="px-2 py-1.5">
                                <span style={{ fontSize: "9px", color: "var(--st-red)", fontWeight: 700 }}>⚠{b.rapelan}</span>
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
                  <tr>{["Bulan","Total","Selesai","Diproses","Belum","Dibatalkan","Rapelan"].map(h => <th key={h} style={{ textAlign: "center" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {perBulan.map(b => (
                    <tr key={b.label}>
                      <td style={{ fontWeight: 600 }}>{b.label}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{b.total}</td>
                      <td style={{ textAlign: "center", color: "var(--st-green)" }}>{b.selesai}</td>
                      <td style={{ textAlign: "center", color: "var(--dtn)" }}>{b.diproses}</td>
                      <td style={{ textAlign: "center", color: "var(--st-amber)" }}>{b.belum}</td>
                      <td style={{ textAlign: "center", color: "var(--st-red)" }}>{b.ditolak}</td>
                      <td style={{ textAlign: "center", color: "var(--st-red)", fontWeight: b.rapelan > 0 ? 700 : 400 }}>{b.rapelan}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: "1px solid var(--dtn)" }}>
                    <td>Total</td>
                    <td style={{ textAlign: "center" }}>{stats.total}</td>
                    <td style={{ textAlign: "center", color: "var(--st-green)" }}>{stats.selesai}</td>
                    <td style={{ textAlign: "center" }}>{stats.diproses}</td>
                    <td style={{ textAlign: "center", color: "var(--st-amber)" }}>{stats.belum}</td>
                    <td style={{ textAlign: "center", color: "var(--st-red)" }}>{stats.ditolak}</td>
                    <td style={{ textAlign: "center", color: "var(--st-red)" }}>{stats.rapelan}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ════ TABEL DETAIL ════ */}
          <div className="rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
            <div className="no-print px-4 py-2 flex items-center justify-between" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
              <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--dtn)" }}>Detail: {judulLaporan}</p>
              <p style={{ fontSize: "10px", color: "var(--dt4)" }}>{kgbList.length} data</p>
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
                      const selisih = k.gajiPokokBaru - k.gajiPokokLama;
                      const rapelan = isRapelan(k);
                      const stCfg = STATUS_CFG[k.status] ?? STATUS_CFG.belum_diproses;
                      const grp = k.golonganBaru.split("/")[0];
                      const gc = GOL_COLOR[grp] ?? { bar: "var(--dt4)", badge: "var(--ln2)", text: "#475569" };
                      return (
                        <tr key={k.id} style={{ borderBottom: i < kgbList.length - 1 ? "0.5px solid var(--ln2)" : "none", background: rapelan ? "var(--tint-red-bg)" : i % 2 === 0 ? "var(--card)" : "var(--sub)" }}>
                          <td className="px-3 py-2" style={{ color: "var(--dt5)", fontSize: "10px", whiteSpace: "nowrap" }}>{i + 1}</td>
                          <td className="px-3 py-2">
                            <p className="font-semibold" style={{ fontSize: "11px", color: "var(--dtn)", whiteSpace: "nowrap" }}>{k.pegawai.nama}</p>
                            <p style={{ fontSize: "10px", color: "var(--dt5)", fontFamily: "monospace" }}>{k.pegawai.nip}</p>
                          </td>
                          <td className="px-3 py-2" style={{ maxWidth: "160px" }}>
                            <p style={{ fontSize: "10px", color: "var(--dtn)" }} className="truncate">{k.pegawai.jabatan}</p>
                            <p style={{ fontSize: "9px", color: "var(--dt5)" }} className="truncate">{k.pegawai.unitKerja}</p>
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
                              <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 7px", borderRadius: "999px", background: stCfg.bg, color: stCfg.color, border: `1px solid ${stCfg.border}`, whiteSpace: "nowrap", width: "fit-content" }}>
                                {stCfg.printLabel}
                              </span>
                              {rapelan && (
                                <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: "999px", background: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "1px solid var(--tint-amber-ln)", whiteSpace: "nowrap", width: "fit-content" }}>
                                  ⚠ RAPELAN
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