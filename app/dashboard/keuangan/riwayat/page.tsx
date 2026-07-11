"use client";

import { useEffect, useState, useCallback } from "react";

/* ─── interfaces ─── */
interface LogEntry {
  id: string; waktu: string; aksi: string; detail: string;
  targetNama: string | null; user: { nama: string; nip: string } | null;
}
interface RekonBulanan {
  id: string; bulanTmt: string; tanggalInput: string;
  jumlahData: number; catatan: string | null;
  creator: { nama: string; nip: string };
}
interface KGBItem {
  id: string; status: string; nomorSK: string;
  tmtKgbBaru: string; golonganLama: string; golonganBaru: string;
  gajiPokokLama: number; gajiPokokBaru: number;
  mkgTahunBaru: number; mkgBulanBaru: number;
  flagRapelan: boolean; rapelanDitetapkan: boolean | null;
  createdAt: string;
  pegawai: { id: string; nama: string; nip: string; jabatan: string; unitKerja: string };
  surat: { nomorSurat: string; pathFile?: string | null } | null;
}

/* ─── helpers ─── */
function fmtTgl(s: string) {
  return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function fmtWaktu(s: string) {
  return new Date(s).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function bulanLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}
function fmtRp(n: number) { return "Rp " + n.toLocaleString("id-ID"); }

const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  belum_diproses:    { bg: "var(--tint-amber-bg)", color: "var(--st-amber)",  label: "Belum Diproses" },
  sedang_diproses:   { bg: "var(--tint-navy)", color: "var(--dtn)",  label: "Sedang Diproses" },
  menunggu_keuangan: { bg: "var(--tint-violet-bg)", color: "var(--st-violet)",  label: "Menunggu Konfirmasi" },
  selesai:           { bg: "var(--tint-green-bg)", color: "var(--st-green)",  label: "Selesai" },
  ditolak:           { bg: "var(--tint-red-bg)", color: "var(--st-red)",  label: "Dibatalkan" },
};

/* ─── PegawaiRow ─── */
function PegawaiRow({
  nama, nip, jabatan, unitKerja, kgbs, expanded, onToggle,
}: {
  nama: string; nip: string; jabatan: string; unitKerja: string;
  kgbs: KGBItem[]; expanded: boolean; onToggle: () => void;
}) {
  const latest   = kgbs[0];
  const st       = STATUS_CFG[latest?.status] ?? STATUS_CFG.belum_diproses;
  const thisYear = new Date().getFullYear();
  const hasThisYear = kgbs.some((k) => new Date(k.tmtKgbBaru).getFullYear() === thisYear);
  const initials = nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer transition-colors"
        style={{ borderBottom: expanded ? "none" : "1px solid var(--ln2)" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "var(--sub)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = expanded ? "var(--sub)" : ""; }}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
              style={{ background: hasThisYear ? "var(--tint-navy)" : "var(--ln2)", color: hasThisYear ? "var(--dtn)" : "var(--dt5)" }}>
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{nama}</p>
                {hasThisYear && (
                  <span className="px-1 py-px rounded text-xs font-bold"
                    style={{ background: "var(--tint-navy)", color: "var(--dtn)", fontSize: "9px" }}>
                    {thisYear}
                  </span>
                )}
              </div>
              <p style={{ fontSize: "10px", color: "var(--dt5)" }}>{nip}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3" style={{ maxWidth: "180px" }}>
          <p className="text-xs truncate" style={{ color: "var(--dt3)" }}>{jabatan}</p>
          <p className="truncate" style={{ fontSize: "10px", color: "var(--dt6)" }}>{unitKerja}</p>
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "var(--dt3)" }}>
          {latest ? `${latest.golonganLama} → ${latest.golonganBaru}` : "-"}
        </td>
        <td className="px-4 py-3 whitespace-nowrap text-xs font-semibold" style={{ color: "var(--st-green)" }}>
          {latest ? fmtRp(latest.gajiPokokBaru) : "-"}
        </td>
        <td className="px-4 py-3 whitespace-nowrap" style={{ fontSize: "11px", color: "var(--dt4)" }}>
          {latest ? fmtTgl(latest.tmtKgbBaru) : "-"}
        </td>
        <td className="px-4 py-3">
          {latest && (
            <span className="px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
              style={{ background: st.bg, color: st.color, fontSize: "10px" }}>
              {st.label}
            </span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span style={{ fontSize: "10px", color: "var(--dt5)" }}>{kgbs.length} riwayat</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a0b4c8" strokeWidth="2.5"
              style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </td>
      </tr>

      {/* ── Expanded: perjalanan KGB ── */}
      {expanded && (
        <tr>
          <td colSpan={7} style={{ padding: "0 0 4px 0", borderBottom: "1px solid var(--ln1)" }}>
            <div className="mx-4 mb-3 rounded-xl overflow-hidden"
              style={{ background: "var(--sub)", border: "1px solid var(--ln1)" }}>
              <div className="px-4 py-2 flex items-center gap-2"
                style={{ borderBottom: "1px solid var(--ln1)", background: "var(--sub)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#5a7a9a" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--dtn)" }}>
                  Perjalanan KGB: {nama}
                </p>
                <span style={{ fontSize: "10px", color: "var(--dt5)" }}>({kgbs.length} siklus)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "11px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--ln1)" }}>
                      {["TMT KGB","Golongan","Gaji Lama","Gaji Baru","MKG","Status","Nomor SK","SK"].map(h => (
                        <th key={h} className="px-3 py-2 text-left"
                          style={{ color: "var(--dt5)", fontWeight: 600, fontSize: "10px", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kgbs.map((k, idx) => {
                      const s = STATUS_CFG[k.status] ?? STATUS_CFG.belum_diproses;
                      const isLatest = idx === 0;
                      return (
                        <tr key={k.id} style={{ borderBottom: "1px solid var(--ln2)" }}>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              {isLatest && (
                                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: "var(--navy-solid)" }} />
                              )}
                              <span style={{ color: isLatest ? "var(--dtn)" : "var(--dt3)", fontWeight: isLatest ? 600 : 400 }}>
                                {fmtTgl(k.tmtKgbBaru)}
                              </span>
                              {k.rapelanDitetapkan && (
                                <span className="px-1 rounded" style={{ background: "var(--tint-amber-bg2)", color: "var(--st-amber)", fontSize: "9px", fontWeight: 700 }}>
                                  RAPELAN
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--dt3)" }}>
                            <span style={{ color: "var(--dt5)" }}>{k.golonganLama}</span>
                            <span style={{ color: "var(--dt6)", margin: "0 3px" }}>→</span>
                            <span style={{ color: "var(--st-green)", fontWeight: 600 }}>{k.golonganBaru}</span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--dt5)" }}>
                            {fmtRp(k.gajiPokokLama)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-semibold" style={{ color: "var(--st-green)" }}>
                            {fmtRp(k.gajiPokokBaru)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--dt4)" }}>
                            {k.mkgTahunBaru} Thn {k.mkgBulanBaru} Bln
                          </td>
                          <td className="px-3 py-2">
                            <span className="px-1.5 py-px rounded-full font-semibold whitespace-nowrap"
                              style={{ background: s.bg, color: s.color, fontSize: "9px" }}>
                              {s.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--dt5)" }}>
                            {k.nomorSK || k.surat?.nomorSurat || "-"}
                          </td>
                          <td className="px-3 py-2">
                            {k.surat?.pathFile ? (
                              <a href={`/api/blob/download?url=${encodeURIComponent(k.surat.pathFile)}`} download
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-medium"
                                style={{ background: "var(--tint-navy)", color: "var(--dtn)", textDecoration: "none", fontSize: "10px" }}>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Unduh
                              </a>
                            ) : (
                              <span style={{ color: "var(--dt6)", fontSize: "10px" }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── page ─── */
export default function RiwayatKeuanganPage() {
  const [logs,      setLogs]      = useState<LogEntry[]>([]);
  const [rekonList, setRekonList] = useState<RekonBulanan[]>([]);
  const [kgbList,   setKgbList]   = useState<KGBItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<"kgb" | "log" | "rekon">("kgb");
  const [kgbSearch, setKgbSearch] = useState("");
  const [expanded,  setExpanded]  = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch("/api/keuangan/log"),
        fetch("/api/keuangan/rekon"),
        fetch("/api/kgb"),
      ]);
      if (r1.ok) setLogs(await r1.json() as any);
      if (r2.ok) setRekonList(await r2.json() as any);
      if (r3.ok) {
        const d = await r3.json() as any;
        setKgbList(Array.isArray(d) ? d : (d.kgbList ?? []));
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Group KGBs by pegawai, sorted: current year first ── */
  const thisYear = new Date().getFullYear();

  const pegawaiMap = new Map<string, KGBItem[]>();
  for (const k of kgbList) {
    const key = k.pegawai.nip;
    if (!pegawaiMap.has(key)) pegawaiMap.set(key, []);
    pegawaiMap.get(key)!.push(k);
  }

  const employees = [...pegawaiMap.entries()].map(([nip, kgbs]) => {
    const sorted = [...kgbs].sort(
      (a, b) => new Date(b.tmtKgbBaru).getTime() - new Date(a.tmtKgbBaru).getTime()
    );
    return {
      nip,
      nama:         sorted[0].pegawai.nama,
      jabatan:      sorted[0].pegawai.jabatan,
      unitKerja:    sorted[0].pegawai.unitKerja,
      kgbs:         sorted,
      hasThisYear:  kgbs.some((k) => new Date(k.tmtKgbBaru).getFullYear() === thisYear),
    };
  });

  employees.sort((a, b) => {
    if (a.hasThisYear !== b.hasThisYear) return a.hasThisYear ? -1 : 1;
    return a.nama.localeCompare(b.nama, "id");
  });

  const filteredEmployees = employees.filter((e) => {
    if (!kgbSearch.trim()) return true;
    const q = kgbSearch.toLowerCase();
    return (
      e.nama.toLowerCase().includes(q) ||
      e.nip.includes(q) ||
      e.kgbs.some((k) => k.nomorSK?.toLowerCase().includes(q))
    );
  });

  const TAB = [
    { key: "kgb",   label: "Riwayat KGB",    count: employees.length,  countBg: "var(--tint-navy)",  countColor: "var(--dtn)" },
    { key: "log",   label: "Log Aktivitas",   count: logs.length,       countBg: "var(--tint-navy)",  countColor: "var(--dtn)" },
    { key: "rekon", label: "Rekap Gaji Web",  count: rekonList.length,  countBg: "var(--tint-green-bg)",  countColor: "var(--st-green)" },
  ] as const;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="adm-chip" style={{ background: "linear-gradient(135deg,#9b7ae0,var(--violet-solid))" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        </div>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-violet)" }}>Keuangan</p>
          <h1 className="text-base font-bold leading-tight" style={{ color: "var(--dtn)" }}>Riwayat Aktivitas Keuangan</h1>
          <p className="text-xs" style={{ color: "var(--dt4)" }}>
            Seluruh riwayat KGB pegawai · Log konfirmasi · Rekap dasar input Gaji Web
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: "var(--ln2)", width: "fit-content", maxWidth: "100%" }}>
        {TAB.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
            style={{
              background: tab === t.key ? "var(--card)" : "transparent",
              color:      tab === t.key ? "var(--dtn)" : "var(--dt4)",
              boxShadow:  tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>
            {t.label}
            {!loading && t.count > 0 && (
              <span className="px-1.5 py-px rounded-full"
                style={{ background: t.countBg, color: t.countColor, fontWeight: 700, fontSize: "10px" }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--ln2)" }} />
          ))}
        </div>

      ) : tab === "kgb" ? (
        /* ════ Riwayat KGB per Pegawai ════ */
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--ln1)" }}>
          {/* sub-header */}
          <div className="px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-2"
            style={{ borderBottom: "1px solid var(--ln2)", background: "var(--sub)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
              {filteredEmployees.length} pegawai
              <span className="ml-1.5 px-1.5 py-px rounded font-medium"
                style={{ background: "var(--tint-navy)", color: "var(--dt3)", fontSize: "10px" }}>
                {employees.filter(e => e.hasThisYear).length} aktif {thisYear}
              </span>
            </p>
            <div className="relative">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a0b4c8" strokeWidth="2"
                className="absolute" style={{ left: "9px", top: "50%", transform: "translateY(-50%)" }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={kgbSearch} onChange={(e) => setKgbSearch(e.target.value)}
                placeholder="Cari nama / NIP…"
                className="text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none"
                style={{ background: "var(--sub)", border: "1px solid var(--ln1)", color: "var(--dtn)", width: "min(220px, 100%)" }}
              />
            </div>
          </div>

          {filteredEmployees.length === 0 ? (
            <div className="text-center py-12 text-xs" style={{ color: "var(--dt5)" }}>
              {kgbSearch ? "Tidak ada hasil pencarian" : "Belum ada data KGB"}
            </div>
          ) : (
            <>
              {/* ── Mobile: employee cards ── */}
              <div className="md:hidden divide-y" style={{ borderColor: "var(--ln2)" }}>
                {filteredEmployees.map((e) => {
                  const latest = e.kgbs[0];
                  const st = latest ? (STATUS_CFG[latest.status] ?? STATUS_CFG.belum_diproses) : null;
                  const isExp = expanded === e.nip;
                  const initials = e.nama.split(" ").map((n: string) => n[0]).slice(0,2).join("").toUpperCase();
                  return (
                    <div key={e.nip}>
                      <div onClick={() => setExpanded(isExp ? null : e.nip)}
                        className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                        style={{ borderBottom: isExp ? "none" : "1px solid var(--ln2)", background: isExp ? "var(--sub)" : "var(--card)" }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                          style={{ background: e.hasThisYear ? "var(--tint-navy)" : "var(--ln2)", color: e.hasThisYear ? "var(--dtn)" : "var(--dt5)" }}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-semibold truncate" style={{ color: "var(--dtn)" }}>{e.nama}</p>
                            {e.hasThisYear && <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "var(--tint-navy)", color: "var(--dtn)" }}>{thisYear}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p style={{ fontSize: "10px", color: "var(--dt5)" }}>{e.nip}</p>
                            {st && <span style={{ fontSize: "9px", fontWeight: 600, padding: "1px 5px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {latest && <p className="text-xs font-semibold" style={{ color: "var(--st-green)" }}>{latest.golonganBaru}</p>}
                          <p style={{ fontSize: "10px", color: "var(--dt5)" }}>{e.kgbs.length} KGB</p>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a0b4c8" strokeWidth="2.5"
                          style={{ transform: isExp ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                      {isExp && (
                        <div className="px-4 pb-3 pt-2" style={{ background: "var(--sub)", borderBottom: "1px solid var(--ln1)" }}>
                          <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--dtn)", marginBottom: "8px" }}>
                            Perjalanan KGB: {e.nama}
                          </p>
                          <div className="flex flex-col gap-2">
                            {e.kgbs.map((k, idx) => {
                              const s = STATUS_CFG[k.status] ?? STATUS_CFG.belum_diproses;
                              return (
                                <div key={k.id} className="rounded-xl p-3" style={{ background: "var(--card)", border: `1px solid ${idx === 0 ? "var(--ln0)" : "var(--ln2)"}` }}>
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {idx === 0 && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--navy-solid)" }} />}
                                      <p className="text-xs font-semibold" style={{ color: idx === 0 ? "var(--dtn)" : "var(--dt3)" }}>{fmtTgl(k.tmtKgbBaru)}</p>
                                      {k.rapelanDitetapkan && <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "var(--tint-amber-bg2)", color: "var(--st-amber)" }}>RAPELAN</span>}
                                    </div>
                                    <span style={{ fontSize: "9px", fontWeight: 600, padding: "2px 7px", borderRadius: 999, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                                    <div>
                                      <p style={{ fontSize: "9px", color: "var(--dt5)" }}>Golongan</p>
                                      <p style={{ fontSize: "11px", color: "var(--dt3)" }}>
                                        <span>{k.golonganLama}</span>
                                        <span style={{ color: "var(--dt6)", margin: "0 3px" }}>→</span>
                                        <span style={{ color: "var(--st-green)", fontWeight: 600 }}>{k.golonganBaru}</span>
                                      </p>
                                    </div>
                                    <div>
                                      <p style={{ fontSize: "9px", color: "var(--dt5)" }}>Gaji Baru</p>
                                      <p style={{ fontSize: "11px", fontWeight: 600, color: "var(--st-green)" }}>{fmtRp(k.gajiPokokBaru)}</p>
                                    </div>
                                    <div>
                                      <p style={{ fontSize: "9px", color: "var(--dt5)" }}>MKG</p>
                                      <p style={{ fontSize: "11px", color: "var(--dt3)" }}>{k.mkgTahunBaru} Thn {k.mkgBulanBaru} Bln</p>
                                    </div>
                                    {k.surat?.pathFile && (
                                      <div className="flex items-end">
                                        <a href={`/api/blob/download?url=${encodeURIComponent(k.surat.pathFile)}`} download
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg"
                                          style={{ background: "var(--tint-navy)", color: "var(--dtn)", textDecoration: "none", fontSize: "10px", fontWeight: 600 }}>
                                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                          </svg>
                                          Unduh SK
                                        </a>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop: table ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--ln2)", background: "var(--sub)" }}>
                      {["Pegawai","Jabatan / Unit","Golongan Terkini","Gaji Terkini","TMT Terakhir","Status","Riwayat"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left"
                          style={{ color: "var(--dt5)", fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((e) => (
                      <PegawaiRow
                        key={e.nip}
                        nama={e.nama}
                        nip={e.nip}
                        jabatan={e.jabatan}
                        unitKerja={e.unitKerja}
                        kgbs={e.kgbs}
                        expanded={expanded === e.nip}
                        onToggle={() => setExpanded(expanded === e.nip ? null : e.nip)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      ) : tab === "log" ? (
        /* ════ Log Aktivitas ════ */
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--ln1)" }}>
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2" style={{ background: "var(--ln2)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a0b4c8" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <p className="text-xs" style={{ color: "var(--dt5)" }}>Belum ada aktivitas tercatat</p>
            </div>
          ) : (
            <>
              {/* ── Mobile: log cards ── */}
              <div className="md:hidden divide-y" style={{ borderColor: "var(--ln2)" }}>
                {logs.map((log, i) => {
                  const isRekon = log.aksi === "rekon_keuangan";
                  return (
                    <div key={log.id} className="px-4 py-3" style={{ background: i % 2 === 0 ? "var(--card)" : "var(--sub)" }}>
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: isRekon ? "var(--tint-amber-bg2)" : "var(--tint-green-bg)" }}>
                          {isRekon
                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
                              {isRekon ? "Rekap Dasar Gaji Web" : "Konfirmasi KGB"}
                            </p>
                            {!isRekon && log.detail.includes("Rapelan: Ya") && (
                              <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "var(--tint-amber-bg2)", color: "var(--st-amber)" }}>RAPELAN</span>
                            )}
                            {isRekon && (
                              <span style={{ fontSize: "9px", fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "var(--tint-green-bg)", color: "var(--st-green)" }}>OTOMATIS</span>
                            )}
                          </div>
                          <p className="text-xs leading-relaxed mb-1.5" style={{ color: "var(--dt3)" }}>{log.detail}</p>
                          <p style={{ fontSize: "10px", color: "var(--dt5)" }}>
                            {log.user?.nama ?? "-"} {fmtWaktu(log.waktu)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Desktop: table ── */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--ln2)", background: "var(--sub)" }}>
                      {["Tipe","Detail","Oleh","Waktu"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left"
                          style={{ color: "var(--dt5)", fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => {
                      const isRekon = log.aksi === "rekon_keuangan";
                      return (
                        <tr key={log.id} style={{ borderBottom: "1px solid var(--ln2)", background: i % 2 === 0 ? "var(--card)" : "var(--sub)" }}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                                style={{ background: isRekon ? "var(--tint-amber-bg2)" : "var(--tint-green-bg)" }}>
                                {isRekon
                                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                                  : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                }
                              </div>
                              <div>
                                <p className="font-semibold whitespace-nowrap" style={{ color: "var(--dtn)", fontSize: "11px" }}>
                                  {isRekon ? "Rekap Gaji Web" : "Konfirmasi KGB"}
                                </p>
                                {!isRekon && log.detail.includes("Rapelan: Ya") && (
                                  <span className="px-1 py-px rounded font-semibold" style={{ background: "var(--tint-amber-bg2)", color: "var(--st-amber)", fontSize: "9px" }}>RAPELAN</span>
                                )}
                                {isRekon && (
                                  <span className="px-1 py-px rounded font-semibold" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", fontSize: "9px" }}>OTOMATIS</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5" style={{ color: "var(--dt3)", maxWidth: "320px" }}>
                            <p className="text-xs leading-relaxed">{log.detail}</p>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--dt4)", fontSize: "11px" }}>
                            {log.user?.nama ?? "-"}
                            {log.user && <p style={{ color: "var(--dt6)", fontSize: "10px" }}>{log.user.nip}</p>}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--dt5)", fontSize: "11px" }}>
                            {fmtWaktu(log.waktu)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

      ) : (
        /* ════ Rekap Gaji Web ════ */
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--ln1)" }}>
          {rekonList.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-10 h-10 rounded-full mx-auto flex items-center justify-center mb-2" style={{ background: "var(--ln2)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a0b4c8" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
              </div>
              <p className="text-xs font-medium" style={{ color: "var(--dt5)" }}>Belum ada rekon tercatat</p>
              <p className="text-xs mt-1" style={{ color: "var(--dt6)" }}>Otomatis tercatat saat semua KGB TMT dikonfirmasi dalam window 1–15</p>
            </div>
          ) : (
            <>
              {/* ── Mobile: rekon cards ── */}
              <div className="md:hidden divide-y" style={{ borderColor: "var(--ln2)" }}>
                {rekonList.map((r, i) => (
                  <div key={r.id} className="px-4 py-3.5" style={{ background: i % 2 === 0 ? "var(--card)" : "var(--sub)" }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--tint-green-bg)" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                          </svg>
                        </div>
                        <p className="text-sm font-bold" style={{ color: "var(--dtn)" }}>KGB TMT {bulanLabel(r.bulanTmt)}</p>
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: "var(--tint-green-bg)", color: "var(--st-green)", whiteSpace: "nowrap" }}>
                        {r.jumlahData} data
                      </span>
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--dt3)" }}>{r.creator.nama} <span style={{ color: "var(--dt6)" }}>({r.creator.nip})</span></p>
                    <p style={{ fontSize: "10px", color: "var(--dt5)", marginTop: "2px" }}>{fmtWaktu(r.tanggalInput)}</p>
                    {r.catatan && <p style={{ fontSize: "10px", color: "var(--dt5)", fontStyle: "italic", marginTop: "4px" }}>{r.catatan}</p>}
                  </div>
                ))}
              </div>

              {/* ── Desktop: table ── */}
              <table className="hidden md:table w-full" style={{ borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--ln2)", background: "var(--sub)" }}>
                    {["Bulan TMT","Jumlah Data","Dicatat Oleh","Tanggal Input","Catatan"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left"
                        style={{ color: "var(--dt5)", fontWeight: 600, fontSize: "11px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rekonList.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--ln2)", background: i % 2 === 0 ? "var(--card)" : "var(--sub)" }}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--tint-green-bg)" }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                          </div>
                          <span className="font-semibold whitespace-nowrap" style={{ color: "var(--dtn)" }}>KGB TMT {bulanLabel(r.bulanTmt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full font-bold" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", fontSize: "11px" }}>{r.jumlahData} data</span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--dt3)", fontSize: "11px" }}>
                        {r.creator.nama}<p style={{ color: "var(--dt6)", fontSize: "10px" }}>{r.creator.nip}</p>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--dt4)", fontSize: "11px" }}>{fmtWaktu(r.tanggalInput)}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--dt5)", fontSize: "11px", fontStyle: "italic" }}>{r.catatan ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}
