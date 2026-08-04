"use client";

import { useEffect, useState, useCallback } from "react";

/* ─────────────── interfaces ─────────────── */

interface KGB {
  id: string;
  status: string;
  nomorSK: string;
  tmtKgbBaru: string;
  tmtKgbBerikutnya: string;
  golonganLama: string;
  golonganBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  flagRapelan: boolean;
  rapelanDitetapkan: boolean | null;
  createdAt: string;
  pegawai: { id: string; nip: string; nama: string; jabatan: string; golonganRuang: string; unitKerja: string };
  surat: { nomorSurat: string; tanggalSurat: string; pathFile?: string | null } | null;
}

interface RekonBulanan {
  id: string;
  bulanTmt: string;
  tanggalInput: string;
  jumlahData: number;
}

/* ─────────────── helpers ─────────────── */

const fmt     = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const fmtFull = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
const fmtRp   = (n: number) => "Rp " + n.toLocaleString("id-ID");

function initials(nama: string) {
  return nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function bulanKey(d: string) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function bulanLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  belum_diproses:    { bg: "var(--tint-amber-bg)", color: "var(--st-amber)", label: "Belum Diproses" },
  sedang_diproses:   { bg: "var(--tint-navy)", color: "var(--dtn)", label: "Sedang Diproses" },
  menunggu_keuangan: { bg: "var(--tint-violet-bg)", color: "var(--st-violet)", label: "Menunggu Keuangan" },
  selesai:           { bg: "var(--tint-green-bg)", color: "var(--st-green)", label: "Selesai" },
  ditolak:           { bg: "var(--tint-red-bg)", color: "var(--st-red)", label: "Dibatalkan" },
};

const BULAN_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];

/* ─────────────── MonthGrid ─────────────── */

function MonthGrid({
  allKgb, filterMonth, onSelect,
}: {
  allKgb: KGB[];
  filterMonth: string | null;
  onSelect: (key: string | null) => void;
}) {
  const today = new Date();
  const yr = today.getFullYear();

  const total: Record<string,number>    = {};
  const menunggu: Record<string,number> = {};
  const selesai: Record<string,number>  = {};

  for (const k of allKgb) {
    const key = bulanKey(k.tmtKgbBaru);
    total[key]   = (total[key]   ?? 0) + 1;
    if (k.status === "selesai")           selesai[key]  = (selesai[key]  ?? 0) + 1;
    if (k.status === "menunggu_keuangan") menunggu[key] = (menunggu[key] ?? 0) + 1;
  }

  type Tier = "urgent"|"partial"|"done"|"empty";
  const pal: Record<Tier,{accent:string;soft:string;text:string}> = {
    urgent:  { accent:"var(--st-violet)", soft:"var(--tint-violet-bg)", text:"var(--st-violet)" },
    partial: { accent:"var(--dtn)", soft:"var(--tint-navy)", text:"var(--dtn)" },
    done:    { accent:"var(--st-green)", soft:"var(--tint-green-bg)", text:"#0a8f6a" },
    empty:   { accent:"var(--dt6)", soft:"var(--sub)", text:"var(--dt6)" },
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"5px" }}>
      {Array.from({ length:12 }, (_,mo) => {
        const key  = `${yr}-${String(mo+1).padStart(2,"0")}`;
        const isNow = mo === today.getMonth();
        const cnt  = total[key]   ?? 0;
        const done = selesai[key] ?? 0;
        const urg  = menunggu[key] ?? 0;
        const isSel = filterMonth === key;
        const tier: Tier = cnt===0?"empty": urg>0?"urgent": done===cnt?"done":"partial";
        const { accent, soft, text } = pal[tier];
        const pct = cnt > 0 ? (done/cnt)*100 : 0;

        return (
          <button key={key} onClick={() => onSelect(isSel ? null : key)}
            className="relative flex flex-col items-center justify-center overflow-hidden transition-all"
            style={{
              height:"62px", borderRadius:"10px", border:"none", cursor:"pointer",
              background: isSel ? accent : soft,
              outline: isNow && !isSel ? `2px solid ${accent}` : "none",
              boxShadow: isSel ? "0 3px 12px rgba(9,20,40,0.28)" : "none",
            }}
          >
            <span style={{ fontSize:"9px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color: isSel?"rgba(255,255,255,0.7)": isNow?accent:"var(--dt5)", lineHeight:1 }}>
              {BULAN_ID[mo]}
            </span>
            <span style={{ fontSize: cnt>=10?"15px":"18px", fontWeight:800, lineHeight:1.1, marginTop:"3px", color: isSel?"#fff": tier==="empty"?"var(--dt6)":text }}>
              {cnt}
            </span>
            {cnt > 0 && (
              <span style={{ fontSize:"9px", fontWeight:600, lineHeight:1, marginTop:"2px", color: isSel?"rgba(255,255,255,0.75)": urg>0?"var(--st-violet)": done===cnt?"var(--st-green)":"var(--dt5)" }}>
                {urg > 0 ? `${urg} perlu aksi` : done===cnt ? "✓ selesai" : `${done}/${cnt}`}
              </span>
            )}
            <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"3px", background: isSel?"rgba(255,255,255,0.2)":"var(--ln1)" }}>
              {cnt > 0 && <div style={{ height:"100%", width:`${pct}%`, background: isSel?"rgba(255,255,255,0.7)":"#34d399", transition:"width 0.5s" }} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────── KGBCard ─────────────── */

function KGBCard({
  k, onPreview, onKonfirmasi, selectable, selected, onToggleSelect,
}: {
  k: KGB;
  onPreview: (url: string) => void;
  onKonfirmasi: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const selisih = k.gajiPokokBaru - k.gajiPokokLama;
  return (
    <div className="ku-card rounded-xl overflow-hidden"
      style={{ background:"var(--card)", border:`1px solid ${k.flagRapelan ? "var(--tint-amber-ln)" : "var(--tint-violet-ln)"}`, position:"relative" }}>
      {/* Strip aksen kiri */}
      <span aria-hidden style={{ position:"absolute", top:0, bottom:0, left:0, width:"3px", background: k.flagRapelan ? "var(--st-amber)" : "var(--st-violet)" }} />
      <div className="p-3 pl-3.5 space-y-2">
        <div className="flex items-center gap-2">
          {selectable && (
            <input type="checkbox" checked={!!selected} onChange={onToggleSelect} className="w-4 h-4 rounded shrink-0" onClick={(e) => e.stopPropagation()} title="Pilih untuk konfirmasi cepat" />
          )}
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background:"var(--tint-violet-bg)", color:"var(--st-violet)" }}>
            {initials(k.pegawai.nama)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color:"var(--dtn)" }}>{k.pegawai.nama}</p>
            <p className="text-xs truncate" style={{ color:"var(--dt4)" }}>{k.pegawai.nip}</p>
          </div>
          {k.flagRapelan && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background:"var(--tint-amber-bg)", color:"var(--st-amber)", fontSize:"9px" }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
              Berpotensi rapelan
            </span>
          )}
        </div>

        {/* Ringkasan finansial */}
        <div className="rounded-lg p-2 flex items-center gap-3" style={{ background:"var(--sub)" }}>
          <div className="flex-1 min-w-0">
            <p style={{ fontSize:"9px", color:"var(--dt5)" }}>Gaji pokok baru</p>
            <p className="text-sm font-bold leading-tight" style={{ color:"var(--st-green)" }}>{fmtRp(k.gajiPokokBaru)}</p>
            {selisih > 0 && <p style={{ fontSize:"9.5px", color:"var(--dt4)" }}>naik <strong style={{ color:"var(--st-green)" }}>+{fmtRp(selisih)}</strong> dari {fmtRp(k.gajiPokokLama)}</p>}
          </div>
          <div className="text-right shrink-0" style={{ borderLeft:"1px solid var(--ln1)", paddingLeft:"10px" }}>
            <p style={{ fontSize:"9px", color:"var(--dt5)" }}>Golongan</p>
            <p className="text-xs font-semibold" style={{ color:"var(--dtn)" }}>{k.golonganLama}→{k.golonganBaru}</p>
            <p style={{ fontSize:"9px", color:"var(--dt5)", marginTop:"2px" }}>TMT {fmt(k.tmtKgbBaru)}</p>
          </div>
        </div>

        {k.surat?.nomorSurat && (
          <p style={{ fontSize:"10px", color:"var(--dt5)" }} className="truncate">No. SK: {k.surat.nomorSurat}</p>
        )}

        <div className="flex gap-1.5">
          {k.surat?.pathFile && (
            <button onClick={() => onPreview(`/api/blob/download?url=${encodeURIComponent(k.surat!.pathFile!)}`)}
              className="ku-btn flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg text-xs font-medium shrink-0"
              style={{ background:"var(--tint-navy)", color:"var(--dtn)", border:"1px solid var(--ln0)" }} title="Lihat dokumen SK">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              SK
            </button>
          )}
          <button onClick={onKonfirmasi}
            className="ku-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: k.flagRapelan ? "var(--amber-solid)" : "var(--green-solid)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            {k.flagRapelan ? "Tinjau & Konfirmasi" : "Konfirmasi"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── page ─────────────── */

export default function KeuanganDashboardPage() {
  const [kgbList,    setKgbList]    = useState<KGB[]>([]);
  const [allKgb,     setAllKgb]     = useState<KGB[]>([]);
  const [rekonList,  setRekonList]  = useState<RekonBulanan[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingAll, setLoadingAll] = useState(true);

  const [filterMonth,       setFilterMonth]       = useState<string>(() => {
    // Default = TMT bulan ini+2 = masa unlock SDM bulan ini
    const d = new Date();
    const m2 = (d.getMonth() + 2) % 12;
    const y2 = d.getMonth() + 2 > 11 ? d.getFullYear() + 1 : d.getFullYear();
    return `${y2}-${String(m2 + 1).padStart(2, "0")}`;
  });
  const [previewUrl,        setPreviewUrl]         = useState<string | null>(null);
  const [previewKgbId,      setPreviewKgbId]       = useState<string | null>(null);
  const [konfirmasiId,      setKonfirmasiId]       = useState<string | null>(null);
  const [konfirmasiRapelan, setKonfirmasiRapelan]  = useState(false);
  const [konfirmasiLoading, setKonfirmasiLoading]  = useState(false);
  const [success,      setSuccess]      = useState("");
  const [error,        setError]        = useState("");
  const [followupSent,    setFollowupSent]    = useState<Set<string>>(new Set());
  const [popup,           setPopup]           = useState<"total" | "selesai" | "rapelan" | null>(null);
  const [rekonDismissed,  setRekonDismissed]  = useState(false);
  // Konfirmasi cepat (bulk) untuk SK yang tidak berpotensi rapelan
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [showBulk,     setShowBulk]     = useState(false);
  const [bulkLoading,  setBulkLoading]  = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);

  /* fetchers */
  const fetchMenunggu = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kgb?status=menunggu_keuangan");
      if (res.ok) { const d = await res.json() as any; setKgbList(Array.isArray(d) ? d : (d.kgbList ?? [])); }
    } finally { setLoading(false); }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoadingAll(true);
    try {
      const res = await fetch("/api/kgb");
      if (res.ok) { const d = await res.json() as any; setAllKgb(Array.isArray(d) ? d : (d.kgbList ?? [])); }
    } finally { setLoadingAll(false); }
  }, []);

  const fetchRekon = useCallback(async () => {
    const res = await fetch("/api/keuangan/rekon");
    if (res.ok) setRekonList(await res.json() as any);
  }, []);

  useEffect(() => { fetchMenunggu(); fetchAll(); fetchRekon(); }, [fetchMenunggu, fetchAll, fetchRekon]);

  /* konfirmasi */
  async function handleKonfirmasi(kgbId: string, isRapelan: boolean) {
    setKonfirmasiLoading(true);
    try {
      const res = await fetch(`/api/kgb/${kgbId}/konfirmasi-keuangan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRapelan }),
      });
      if (res.ok) {
        const d = await res.json() as any;
        setSuccess(`KGB berhasil dikonfirmasi.${d.autoRekon ? " Seluruh KGB bulan ini selesai, rekap dasar input Gaji Web tercatat." : ""}`);
        setTimeout(() => setSuccess(""), 6000);
        setKonfirmasiId(null);
        setPreviewUrl(null);
        setPreviewKgbId(null);
        fetchMenunggu(); fetchAll(); fetchRekon();
      } else {
        let msg = "Gagal mengkonfirmasi.";
        try { const d = await res.json() as any; msg = d.error ?? msg; } catch { /* empty body */ }
        setError(msg);
        setTimeout(() => setError(""), 6000);
      }
    } finally { setKonfirmasiLoading(false); }
  }

  // Konfirmasi cepat: konfirmasi beberapa SK NON-rapelan sekaligus (sebagai
  // "tidak rapelan"). SK berpotensi rapelan sengaja dikecualikan — wajib
  // ditinjau satu per satu.
  async function handleBulkKonfirmasi() {
    const ids = [...bulkSelected];
    if (ids.length === 0) return;
    setBulkLoading(true); setBulkProgress(0);
    let ok = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/kgb/${id}/konfirmasi-keuangan`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRapelan: false }),
        });
        if (res.ok) ok++;
      } catch { /* lanjut */ }
      setBulkProgress((p) => p + 1);
    }
    setBulkLoading(false); setShowBulk(false);
    setBulkSelected(new Set());
    setSuccess(`${ok} dari ${ids.length} SK berhasil dikonfirmasi.`);
    setTimeout(() => setSuccess(""), 6000);
    fetchMenunggu(); fetchAll(); fetchRekon();
  }

  async function handleFollowUp(kgbId: string) {
    try {
      const res = await fetch("/api/notifikasi/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kgbId }),
      });
      if (res.ok) {
        setFollowupSent((prev) => new Set(prev).add(kgbId));
        setSuccess("Follow up berhasil dikirim ke SDM/Admin.");
        setTimeout(() => setSuccess(""), 4000);
      }
    } catch { /* ignore */ }
  }

  /* derived */
  const today       = new Date();
  const todayDay    = today.getDate();
  const todayMonth  = today.getMonth(); // 0-indexed
  const todayYear   = today.getFullYear();

  // Masa rekon info: window 1-15 bulan H-1 (sebulan sebelum TMT)
  // TMT yang relevan = bulan depan (bulan ini+1)
  const rekonTmtMonth = todayMonth === 11 ? 0 : todayMonth + 1;
  const rekonTmtYear  = todayMonth === 11 ? todayYear + 1 : todayYear;
  const rekonBulanKey = `${rekonTmtYear}-${String(rekonTmtMonth + 1).padStart(2, "0")}`;
  const isRekonWindow = todayDay >= 1 && todayDay <= 15;
  const sudahRekon    = rekonList.some((r) => r.bulanTmt === rekonBulanKey);
  const rekonEntry    = rekonList.find((r) => r.bulanTmt === rekonBulanKey);
  const rekonTmtLabel = new Date(rekonTmtYear, rekonTmtMonth, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  // Follow-up hanya untuk KGB dengan TMT = bulan ini + 2
  // (SDM wajib submit bulan ini karena rekon keuangan = bulan depan tanggal 1-15)
  const followUpTmtMonth = (todayMonth + 2) % 12;
  const followUpTmtYear  = todayMonth + 2 > 11 ? todayYear + 1 : todayYear;
  const followUpBulanKey = `${followUpTmtYear}-${String(followUpTmtMonth + 1).padStart(2, "0")}`;

  // Label untuk context di UI
  const rekonTmtLabel2   = new Date(rekonTmtYear, rekonTmtMonth, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const bulanIniLabel    = new Date(todayYear, todayMonth, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  // Progress rekon: KGB TMT bulan depan yang selesai vs total
  const rekonTmtItems  = allKgb.filter((k) => bulanKey(k.tmtKgbBaru) === rekonBulanKey);
  const rekonSelesaiCount = rekonTmtItems.filter((k) => k.status === "selesai").length;
  const rekonPct = rekonTmtItems.length > 0 ? Math.round((rekonSelesaiCount / rekonTmtItems.length) * 100) : 0;

  // Reset filterMonth ke followUpBulanKey (alias default)
  const defaultFilterMonth = followUpBulanKey;

  const kgbTahunIni    = allKgb.filter((k) => new Date(k.tmtKgbBaru).getFullYear() === todayYear);
  const selesaiTahunIni  = kgbTahunIni.filter((k) => k.status === "selesai");
  const rapelanTahunIni  = kgbTahunIni.filter((k) => k.rapelanDitetapkan === true);
  const totalSelesai     = selesaiTahunIni.length;
  const totalRapelan     = rapelanTahunIni.length;

  // Banner rekon: "selesai" hanya tampil max 2 hari setelah tanggal rekon, lalu hilang
  const rekonSelesaiRecent = rekonEntry
    ? (Date.now() - new Date(rekonEntry.tanggalInput).getTime()) < 2 * 24 * 60 * 60 * 1000
    : false;
  const showRekonBanner = !rekonDismissed && isRekonWindow && (!sudahRekon || rekonSelesaiRecent);

  const popupItems = popup === "total"   ? kgbTahunIni
                   : popup === "selesai" ? selesaiTahunIni
                   : popup === "rapelan" ? rapelanTahunIni
                   : [];
  const popupTitle = popup === "total"   ? `KGB Tahun ${todayYear}`
                   : popup === "selesai" ? "Selesai Dikonfirmasi"
                   : popup === "rapelan" ? "Rapelan"
                   : "";

  const monthItems     = allKgb.filter((k) => bulanKey(k.tmtKgbBaru) === filterMonth);
  const konfirmasiTarget = konfirmasiId ? [...kgbList, ...allKgb].find((k) => k.id === konfirmasiId) ?? null : null;

  return (
    <div className="space-y-5">
      <style>{`
        .ku-card { transition: box-shadow .16s, transform .16s, border-color .16s; }
        .ku-card:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(9,20,40,0.10); }
        .ku-btn { transition: filter .14s, transform .1s; }
        .ku-btn:hover { filter: brightness(1.05); }
        .ku-btn:active { transform: scale(.97); }
      `}</style>

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="adm-chip" style={{ background: "linear-gradient(135deg,#9b7ae0,var(--violet-solid))" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        </div>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-violet)" }}>Keuangan</p>
          <h1 className="text-base font-bold leading-tight" style={{ color:"var(--dtn)" }}>Dashboard Keuangan</h1>
          <p className="text-xs" style={{ color:"var(--dt4)" }}>
            Konfirmasi SK yang masuk · Pantau status KGB berjalan · Data rekap tersimpan otomatis
          </p>
        </div>
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {([
          {
            key: "total" as const,
            label: "Total KGB Tahun Ini",
            value: loadingAll ? "-" : kgbTahunIni.length,
            sub: `Berlaku ${todayYear} · klik lihat daftar`,
            clickable: !loadingAll && kgbTahunIni.length > 0,
            bg: "var(--sub)", border: "var(--ln1)", color: "var(--dtn)",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a7a9a" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
          },
          {
            key: null,
            label: "Menunggu Konfirmasi",
            value: loading ? "-" : kgbList.length,
            sub: "SK masuk, belum dikonfirmasi keuangan",
            clickable: false,
            bg: kgbList.length > 0 ? "var(--tint-violet-bg)" : "var(--sub)",
            border: kgbList.length > 0 ? "var(--tint-violet-ln)" : "var(--ln1)",
            color: kgbList.length > 0 ? "var(--st-violet)" : "var(--dt4)",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={kgbList.length > 0 ? "var(--st-violet)" : "var(--dt5)"} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
          },
          {
            key: "selesai" as const,
            label: "Sudah Dikonfirmasi",
            value: loadingAll ? "-" : totalSelesai,
            sub: `dari ${kgbTahunIni.length} total KGB tahun ini`,
            clickable: !loadingAll && totalSelesai > 0,
            bg: totalSelesai > 0 ? "var(--tint-green-bg)" : "var(--sub)",
            border: totalSelesai > 0 ? "var(--tint-green-ln)" : "var(--ln1)",
            color: totalSelesai > 0 ? "var(--st-green)" : "var(--dt4)",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={totalSelesai > 0 ? "var(--st-green)" : "var(--dt5)"} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
          },
          {
            key: "rapelan" as const,
            label: "Dikonfirmasi Rapelan",
            value: loadingAll ? "-" : totalRapelan,
            sub: totalRapelan > 0 ? "SK terlambat, selisih gaji dibayar mundur" : "Tidak ada rapelan",
            clickable: !loadingAll && totalRapelan > 0,
            bg: totalRapelan > 0 ? "var(--tint-amber-bg)" : "var(--sub)",
            border: totalRapelan > 0 ? "var(--tint-amber-ln)" : "var(--ln1)",
            color: totalRapelan > 0 ? "var(--st-amber)" : "var(--dt4)",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={totalRapelan > 0 ? "var(--st-amber)" : "var(--dt5)"} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
          },
        ] as { key: "total"|"selesai"|"rapelan"|null; label:string; value:string|number; sub:string; clickable:boolean; bg:string; border:string; color:string; icon:React.ReactNode }[]).map(({ key, label, value, sub, clickable, bg, border, color, icon }) => (
          <div
            key={label}
            onClick={() => key && clickable && setPopup(key)}
            className="rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-shadow"
            style={{
              background: bg, border: `1px solid ${border}`,
              cursor: clickable ? "pointer" : "default",
              boxShadow: clickable ? undefined : "none",
            }}
            onMouseEnter={(e) => { if (clickable) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 10px ${border}80`; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "var(--card)", border: `1px solid ${border}` }}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-lg font-bold leading-none" style={{ color }}>{value}</p>
                {clickable && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" style={{ opacity: 0.5 }}>
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                )}
              </div>
              <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--dt4)" }}>{label}</p>
              <p style={{ fontSize:"10px", color:"var(--dt5)", marginTop:"1px" }}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Alerts ── */}
      {success && (
        <div className="rounded-xl px-4 py-2.5 text-xs font-medium flex items-center gap-2"
          style={{ background:"var(--tint-green-bg)", color:"var(--st-green)", border:"1px solid var(--tint-green-ln)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-xl px-4 py-2.5 text-xs font-medium"
          style={{ background:"var(--tint-red-bg)", color:"var(--st-red)", border:"1px solid var(--tint-red-ln)" }}>
          {error}
        </div>
      )}

      {/* ── Masa Rekon Info : hanya tampil saat relevan ── */}
      {showRekonBanner && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: sudahRekon ? "var(--tint-green-bg)" : "var(--tint-blue-bg)", border:`1px solid ${sudahRekon ? "var(--tint-green-ln)" : "var(--tint-blue-ln)"}` }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: sudahRekon ? "var(--tint-green-bg2)" : "var(--tint-blue-bg2)" }}>
            {sudahRekon
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            }
          </div>
          <p className="text-xs flex-1" style={{ color: sudahRekon ? "var(--st-green)" : "var(--st-blue)" }}>
            {sudahRekon
              ? <>✓ Data rekap KGB berlaku <strong>{rekonTmtLabel}</strong> sudah tersimpan, <strong>{rekonEntry?.jumlahData ?? 0} data</strong> ({fmt(rekonEntry?.tanggalInput ?? "")}). Siap dijadikan dasar input ke Sistem Gaji Web.</>
              : <>Periode konfirmasi aktif: <strong>1–15 {bulanIniLabel}</strong> untuk KGB yang berlaku <strong>{rekonTmtLabel}</strong>. Konfirmasi semua KGB agar data rekap tersimpan otomatis.</>
            }
          </p>
          <button onClick={() => setRekonDismissed(true)}
            className="shrink-0 opacity-40 hover:opacity-80 transition-opacity"
            style={{ lineHeight: 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════
          4:3 : Perlu Konfirmasi | Kalender KGB
      ════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-[4fr_3fr] gap-4 items-stretch">

        {/* ── Perlu Konfirmasi (Masa Rekon) ── */}
        <div className="flex flex-col rounded-2xl overflow-hidden"
          style={{ background:"var(--card)", border:"1px solid var(--ln1)" }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2 shrink-0"
            style={{ borderBottom:"1px solid var(--ln2)", background:"var(--sub)" }}>
            <div className="w-1 h-4 rounded-full shrink-0" style={{ background:"var(--violet-solid)" }} />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold leading-none" style={{ color:"var(--dtn)" }}>SK Masuk: Konfirmasi</h2>
              <p className="text-xs mt-0.5" style={{ color:"var(--dt5)" }}>
                {isRekonWindow
                  ? <>KGB berlaku <strong style={{ color:"var(--st-violet)" }}>{rekonTmtLabel2}</strong> · Konfirmasi sebelum 15 {bulanIniLabel}</>
                  : <>KGB berlaku <strong style={{ color:"var(--st-violet)" }}>{rekonTmtLabel2}</strong></>
                }
              </p>
            </div>
            {!loading && kgbList.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                style={{ background:"var(--tint-violet-bg)", color:"var(--st-violet)" }}>{kgbList.length}</span>
            )}
          </div>
          {/* Rekon progress bar */}
          {!loadingAll && rekonTmtItems.length > 0 && (
            <div className="px-4 py-2 shrink-0" style={{ borderBottom:"1px solid var(--ln2)", background:"var(--sub)" }}>
              <div className="flex items-center justify-between mb-1">
                <p style={{ fontSize:"10px", color:"var(--dt4)" }}>
                  KGB berlaku {rekonTmtLabel2}: <strong style={{ color:"var(--dtn)" }}>{rekonSelesaiCount} dari {rekonTmtItems.length}</strong> selesai dikonfirmasi
                </p>
                <p style={{ fontSize:"10px", fontWeight:700, color: rekonPct === 100 ? "var(--st-green)" : isRekonWindow ? "var(--st-violet)" : "var(--dt5)" }}>
                  {rekonPct}%
                </p>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height:"4px", background:"var(--ln2)" }}>
                <div style={{ height:"100%", width:`${rekonPct}%`, background: rekonPct === 100 ? "#10b981" : "#8b5cf6", borderRadius:"999px", transition:"width 0.5s" }} />
              </div>
            </div>
          )}
          {/* Toolbar konfirmasi cepat (hanya SK non-rapelan) */}
          {!loading && (() => {
            const eligible = kgbList.filter((k) => !k.flagRapelan);
            if (eligible.length < 2) return null;
            const allSel = eligible.every((k) => bulkSelected.has(k.id)) && bulkSelected.size > 0;
            return (
              <div className="px-3 py-2 flex items-center gap-2 shrink-0" style={{ borderBottom:"1px solid var(--ln2)" }}>
                <button onClick={() => setBulkSelected(allSel ? new Set() : new Set(eligible.map((k) => k.id)))}
                  className="ku-btn flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                  style={{ background:"var(--sub)", color:"var(--dt3)", border:"0.5px solid var(--ln1)" }}>
                  <span style={{ width:"14px", height:"14px", borderRadius:"4px", border:`1.5px solid ${allSel ? "var(--st-green)" : "var(--dt5)"}`, background: allSel ? "var(--st-green)" : "transparent", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                    {allSel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </span>
                  {allSel ? "Batal pilih" : `Pilih semua (${eligible.length})`}
                </button>
                <span className="text-xs" style={{ color:"var(--dt5)" }}>SK tanpa potensi rapelan</span>
                <div className="flex-1" />
                {bulkSelected.size > 0 && (
                  <button onClick={() => setShowBulk(true)}
                    className="ku-btn flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold text-white"
                    style={{ background:"var(--green-solid)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Konfirmasi cepat ({bulkSelected.size})
                  </button>
                )}
              </div>
            );
          })()}
          <div className="flex-1 overflow-y-auto px-3 pt-2 pb-3 space-y-2" style={{ scrollbarWidth:"thin" }}>
            {loading ? (
              <>{[1,2,3].map(i=>(
                <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background:"var(--ln2)" }} />
              ))}</>
            ) : kgbList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 gap-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background:"var(--tint-green-bg)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <p className="text-xs font-semibold" style={{ color:"var(--st-green)" }}>Tidak ada SK menunggu konfirmasi</p>
              <p className="text-xs text-center mt-1" style={{ color:"var(--dt5)" }}>Semua KGB yang masuk sudah dikonfirmasi</p>
              </div>
            ) : (
              kgbList.map((k) => (
                <KGBCard key={k.id} k={k}
                  selectable={!k.flagRapelan}
                  selected={bulkSelected.has(k.id)}
                  onToggleSelect={() => setBulkSelected((prev) => { const n = new Set(prev); if (n.has(k.id)) n.delete(k.id); else n.add(k.id); return n; })}
                  onPreview={(url) => { setPreviewUrl(url); setPreviewKgbId(k.id); }}
                  onKonfirmasi={() => { setKonfirmasiId(k.id); setKonfirmasiRapelan(k.flagRapelan); }}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Kalender KGB ── */}
        <div className="flex flex-col rounded-2xl overflow-hidden"
          style={{ background:"var(--card)", border:"1px solid var(--ln1)" }}>
          <div className="px-4 py-3 flex items-center gap-2 shrink-0"
            style={{ borderBottom:"1px solid var(--ln2)", background:"var(--sub)" }}>
            <div className="w-1 h-4 rounded-full shrink-0" style={{ background:"var(--navy-solid)" }} />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold leading-none" style={{ color:"var(--dtn)" }}>Kalender KGB</h2>
              <p className="text-xs mt-0.5" style={{ color:"var(--dt5)" }}>Klik bulan untuk filter tabel di bawah</p>
            </div>
          </div>
          <div className="px-3 pt-2 pb-1 flex gap-3 shrink-0">
            {([
              { bar:"#8b5cf6", label:"Perlu aksi" },
              { bar:"#60a5fa", label:"Diproses" },
              { bar:"#34d399", label:"Selesai" },
            ] as {bar:string;label:string}[]).map(({bar,label}) => (
              <div key={label} className="flex items-center gap-1">
                <div style={{ width:"8px", height:"3px", borderRadius:"2px", background:bar }} />
                <span style={{ fontSize:"9px", color:"var(--dt4)" }}>{label}</span>
              </div>
            ))}
          </div>
          <div className="flex-1 px-3 pb-3">
            {loadingAll ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"5px" }}>
                {Array.from({length:12}).map((_,i)=>(
                  <div key={i} className="rounded-lg animate-pulse" style={{ height:"62px", background:"var(--ln2)" }} />
                ))}
              </div>
            ) : (
              <MonthGrid allKgb={allKgb} filterMonth={filterMonth}
                onSelect={(key) => setFilterMonth(key ?? defaultFilterMonth)} />
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          Detail KGB per bulan : selalu tampil
      ════════════════════════════════════════ */}
      <div className="rounded-2xl overflow-hidden" style={{ background:"var(--card)", border:"1px solid var(--ln1)" }}>
        <div className="px-4 py-3 flex items-start justify-between gap-3"
          style={{ borderBottom:"1px solid var(--ln2)", background:"var(--sub)" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold" style={{ color:"var(--dtn)" }}>
                KGB Berlaku {bulanLabel(filterMonth)}
              </p>
              {/* Context badge */}
              {filterMonth === followUpBulanKey && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background:"var(--tint-navy)", color:"var(--dtn)", border:"1px solid var(--ln0)" }}>
                  SDM kirim bulan ini ({bulanIniLabel})
                </span>
              )}
              {filterMonth === rekonBulanKey && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background:"var(--tint-violet-bg)", color:"var(--st-violet)", border:"1px solid var(--tint-violet-ln)" }}>
                  Dalam periode konfirmasi (1–15 {bulanIniLabel})
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color:"var(--dt5)" }}>
              {loadingAll ? "Memuat…" : `${monthItems.length} KGB`}
              {filterMonth === followUpBulanKey && !loadingAll && (() => {
                const terkirim = monthItems.filter(k=>["menunggu_keuangan","selesai"].includes(k.status)).length;
                const belum = monthItems.length - terkirim;
                return <span style={{ color:"var(--dt4)" }}> · {terkirim} sudah dikirim SDM{belum > 0 ? `, ${belum} belum` : ""}</span>;
              })()}
              {filterMonth === rekonBulanKey && !loadingAll && (
                <span style={{ color:"var(--dt4)" }}> · {monthItems.filter(k=>k.status==="selesai").length} selesai dikonfirmasi</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {monthItems.filter(k=>k.status==="menunggu_keuangan").length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background:"var(--tint-violet-bg)", color:"var(--st-violet)", border:"1px solid var(--tint-violet-ln)" }}>
                {monthItems.filter(k=>k.status==="menunggu_keuangan").length} perlu aksi
              </span>
            )}
            {filterMonth !== defaultFilterMonth && (
              <button onClick={() => setFilterMonth(defaultFilterMonth)}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ background:"var(--ln2)", color:"var(--dt3)" }}>
                Tampilkan bulan aktif
              </button>
            )}
          </div>
        </div>

        {loadingAll ? (
          <div className="space-y-2 p-4">
            {[1,2,3].map(i=><div key={i} className="h-10 rounded-xl animate-pulse" style={{ background:"var(--ln2)" }} />)}
          </div>
        ) : monthItems.length === 0 ? (
          <div className="text-center py-10 text-xs" style={{ color:"var(--dt5)" }}>
            Tidak ada data KGB pada bulan ini
          </div>
        ) : (
          <>
            {/* ── Mobile: kartu per KGB ── */}
            <div className="md:hidden divide-y" style={{ borderColor:"var(--ln2)" }}>
              {monthItems.map((k, i) => {
                const st = STATUS_CFG[k.status] ?? STATUS_CFG.belum_diproses;
                const canFollowUp = bulanKey(k.tmtKgbBaru) === followUpBulanKey
                  && !["menunggu_keuangan","selesai","ditolak"].includes(k.status);
                const justSent = followupSent.has(k.id);
                const initials = k.pegawai.nama.split(" ").map((n:string)=>n[0]).slice(0,2).join("").toUpperCase();
                return (
                  <div key={k.id} className="px-4 py-3.5" style={{ background: i%2===0?"var(--card)":"var(--sub)" }}>
                    {/* Row 1: avatar + nama + status */}
                    <div className="flex items-start gap-3 mb-2.5">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{ background:"var(--tint-navy)", color:"var(--dtn)" }}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color:"var(--dtn)" }}>{k.pegawai.nama}</p>
                        <p style={{ fontSize:"10px", color:"var(--dt5)" }}>{k.pegawai.nip}</p>
                        <p style={{ fontSize:"10px", color:"var(--dt4)" }} className="truncate">{k.pegawai.jabatan}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
                        style={{ background:st.bg, color:st.color, fontSize:"10px" }}>
                        {st.label}
                      </span>
                    </div>
                    {/* Row 2: data grid */}
                    <div className="grid grid-cols-3 gap-2 mb-2.5 px-0.5">
                      <div>
                        <p style={{ fontSize:"9px", color:"var(--dt5)" }}>Golongan</p>
                        <p style={{ fontSize:"11px", color:"var(--dtn)", fontWeight:600 }}>{k.golonganLama}→{k.golonganBaru}</p>
                      </div>
                      <div>
                        <p style={{ fontSize:"9px", color:"var(--dt5)" }}>Gaji Baru</p>
                        <p style={{ fontSize:"11px", color:"var(--st-green)", fontWeight:600 }}>{fmtRp(k.gajiPokokBaru)}</p>
                      </div>
                      <div>
                        <p style={{ fontSize:"9px", color:"var(--dt5)" }}>MKG</p>
                        <p style={{ fontSize:"11px", color:"var(--dt3)" }}>{k.mkgTahunBaru}T {k.mkgBulanBaru}B</p>
                      </div>
                    </div>
                    {/* Row 3: actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {k.surat?.pathFile && (
                        <button onClick={() => setPreviewUrl(`/api/blob/download?url=${encodeURIComponent(k.surat!.pathFile!)}`)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background:"var(--tint-navy)", color:"var(--dtn)" }}>
                          Preview SK
                        </button>
                      )}
                      {k.status === "menunggu_keuangan" && (
                        <button onClick={() => { setKonfirmasiId(k.id); setKonfirmasiRapelan(k.flagRapelan); }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white text-center"
                          style={{ background:"var(--green-solid)" }}>
                          Konfirmasi
                        </button>
                      )}
                      {canFollowUp && (
                        <button onClick={() => handleFollowUp(k.id)}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-center"
                          style={{ background: justSent?"var(--tint-green-bg)":"var(--tint-amber-bg)", color: justSent?"var(--st-green)":"var(--st-amber)", border:`1px solid ${justSent?"var(--tint-green-ln)":"var(--tint-amber-ln)"}` }}>
                          {justSent ? "✓ Terkirim" : "Follow Up SDM"}
                        </button>
                      )}
                      {k.status === "selesai" && k.rapelanDitetapkan && (
                        <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 8px", borderRadius:999, background:"var(--tint-amber-bg2)", color:"var(--st-amber)" }}>RAPELAN</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Desktop: tabel ── */}
            <div className="hidden md:block overflow-x-auto tbl-scroll">
              <table className="w-full" style={{ borderCollapse:"collapse", fontSize:"12px" }}>
                <thead>
                  <tr style={{ borderBottom:"1px solid var(--ln2)", background:"var(--sub)" }}>
                    {["Nama / NIP","Jabatan","Golongan","Gaji Baru","MKG","Status","Aksi"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold"
                        style={{ color:"var(--dt4)", whiteSpace:"nowrap", fontWeight:600, fontSize:"11px" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthItems.map((k, i) => {
                    const st = STATUS_CFG[k.status] ?? STATUS_CFG.belum_diproses;
                    const canFollowUp = bulanKey(k.tmtKgbBaru) === followUpBulanKey
                      && !["menunggu_keuangan","selesai","ditolak"].includes(k.status);
                    const justSent = followupSent.has(k.id);
                    return (
                      <tr key={k.id} style={{ borderBottom:"1px solid var(--ln2)", background: i%2===0?"var(--card)":"var(--sub)" }}>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold" style={{ color:"var(--dtn)" }}>{k.pegawai.nama}</p>
                          <p style={{ color:"var(--dt5)", fontSize:"10px" }}>{k.pegawai.nip}</p>
                        </td>
                        <td className="px-4 py-2.5" style={{ color:"var(--dt3)", maxWidth:"180px" }}>
                          <p className="truncate">{k.pegawai.jabatan}</p>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color:"var(--dtn)", fontWeight:600 }}>
                          {k.golonganLama} → {k.golonganBaru}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-semibold" style={{ color:"var(--st-green)" }}>
                          {fmtRp(k.gajiPokokBaru)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color:"var(--dt3)" }}>
                          {k.mkgTahunBaru} Thn {k.mkgBulanBaru} Bln
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                            style={{ background:st.bg, color:st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {k.surat?.pathFile && (
                              <button onClick={() => setPreviewUrl(`/api/blob/download?url=${encodeURIComponent(k.surat!.pathFile!)}`)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
                                style={{ background:"var(--tint-navy)", color:"var(--dtn)" }}>
                                Preview SK
                              </button>
                            )}
                            {k.status === "menunggu_keuangan" && (
                              <button onClick={() => { setKonfirmasiId(k.id); setKonfirmasiRapelan(k.flagRapelan); }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                                style={{ background:"var(--green-solid)" }}>
                                Konfirmasi
                              </button>
                            )}
                            {canFollowUp && (
                              <button onClick={() => handleFollowUp(k.id)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
                                style={{ background: justSent?"var(--tint-green-bg)":"var(--tint-amber-bg)", color: justSent?"var(--st-green)":"var(--st-amber)", border:`1px solid ${justSent?"var(--tint-green-ln)":"var(--tint-amber-ln)"}` }}>
                                {justSent ? "✓ Terkirim" : "Follow Up SDM"}
                              </button>
                            )}
                            {k.status === "selesai" && k.rapelanDitetapkan === true && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                style={{ background:"var(--tint-amber-bg2)", color:"var(--st-amber)", fontSize:"10px" }}>
                                Rapelan
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
          </>
        )}
      </div>

      {/* ════════════════════════════════════════
          MODAL: Preview SK (iframe)
      ════════════════════════════════════════ */}
      {previewUrl && (
        <>
          <div style={{ position:"fixed", inset:0, background:"rgba(6,14,28,0.55)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", zIndex:50, animation:"admFade .2s ease both" }}
            onClick={() => { setPreviewUrl(null); setPreviewKgbId(null); }} />
          <div style={{ position:"fixed", inset:"4%", zIndex:51, display:"flex", flexDirection:"column", background:"var(--card)", border:"1px solid var(--ln1)", borderRadius:"16px", overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.3)", animation:"admRise .32s cubic-bezier(.22,1,.36,1) both" }}>
            <div className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom:"1px solid var(--ln1)", background:"var(--sub)" }}>
              <div>
                <p className="text-sm font-bold" style={{ color:"var(--dtn)" }}>Preview Surat Keputusan</p>
                <p className="text-xs" style={{ color:"var(--dt4)" }}>Verifikasi data sebelum konfirmasi</p>
              </div>
              <div className="flex items-center gap-2">
                {previewKgbId && kgbList.find(k=>k.id===previewKgbId) && (
                  <button
                    onClick={() => {
                      const k = kgbList.find(x=>x.id===previewKgbId)!;
                      setKonfirmasiId(k.id); setKonfirmasiRapelan(k.flagRapelan);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
                    style={{ background:"var(--green-solid)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Konfirmasi
                  </button>
                )}
                <button onClick={() => { setPreviewUrl(null); setPreviewKgbId(null); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background:"var(--ln2)", color:"var(--dt3)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <iframe src={previewUrl} className="flex-1 w-full" style={{ border:"none" }} title="Preview SK" />
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          MODAL: Konfirmasi + Rapelan
      ════════════════════════════════════════ */}
      {konfirmasiId && konfirmasiTarget && (
        <>
          <div style={{ position:"fixed", inset:0, background:"rgba(6,14,28,0.55)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", zIndex:52, animation:"admFade .2s ease both" }}
            onClick={() => !konfirmasiLoading && setKonfirmasiId(null)} />
          <div style={{ position:"fixed", inset:0, zIndex:53, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
            <div className="bg-white rounded-2xl w-full p-6 space-y-4"
              style={{ maxWidth:"420px", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ background:"var(--tint-green-bg)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color:"var(--dtn)" }}>Konfirmasi KGB</p>
                  <p className="text-xs" style={{ color:"var(--dt4)" }}>{konfirmasiTarget.pegawai.nama}</p>
                </div>
              </div>

              {/* Ringkasan finansial dengan selisih */}
              <div className="rounded-xl overflow-hidden" style={{ border:"1px solid var(--ln1)" }}>
                <div className="px-3 py-2.5 flex items-end justify-between" style={{ background:"var(--tint-green-bg)" }}>
                  <div>
                    <p style={{ fontSize:"10px", color:"var(--st-green)" }}>Gaji pokok baru</p>
                    <p className="text-lg font-bold leading-tight" style={{ color:"var(--st-green)" }}>{fmtRp(konfirmasiTarget.gajiPokokBaru)}</p>
                  </div>
                  {konfirmasiTarget.gajiPokokBaru - konfirmasiTarget.gajiPokokLama > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background:"var(--card)", color:"var(--st-green)" }}>
                      +{fmtRp(konfirmasiTarget.gajiPokokBaru - konfirmasiTarget.gajiPokokLama)}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5 space-y-1.5" style={{ background:"var(--sub)" }}>
                  {[
                    { l:"Gaji lama", v:fmtRp(konfirmasiTarget.gajiPokokLama) },
                    { l:"Golongan",  v:`${konfirmasiTarget.golonganLama} → ${konfirmasiTarget.golonganBaru}` },
                    { l:"TMT KGB",   v:fmtFull(konfirmasiTarget.tmtKgbBaru) },
                    { l:"MKG baru",  v:`${konfirmasiTarget.mkgTahunBaru} Thn ${konfirmasiTarget.mkgBulanBaru} Bln` },
                  ].map(({l,v}) => (
                    <div key={l} className="flex justify-between text-xs">
                      <span style={{ color:"var(--dt5)" }}>{l}</span>
                      <span className="font-semibold" style={{ color:"var(--dtn)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peringatan bila SK berpotensi rapelan */}
              {konfirmasiTarget.flagRapelan && (
                <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ background:"var(--tint-amber-bg)", border:"1px solid var(--tint-amber-ln)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--st-amber)" style={{ marginTop:"1px", flexShrink:0 }}><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
                  <p className="text-xs" style={{ color:"var(--st-amber2)", fontSize:"10.5px", lineHeight:1.5 }}>SK ini terbit setelah deadline SDM — <strong>berpotensi rapelan</strong>. Pilih opsi <strong>Rapelan</strong> bila selisih gaji perlu dibayar mundur.</p>
                </div>
              )}

              {/* toggle rapelan */}
              <div className="rounded-xl p-3" style={{ background:"var(--sub)", border:"1px solid var(--ln1)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color:"var(--dtn)" }}>Status pembayaran</p>
                <div className="flex gap-2">
                  {[
                    { val:false, label:"Tidak Rapelan", desc:"Dibayar mulai TMT", bg:"var(--tint-green-bg)", active:"var(--st-green)" },
                    { val:true,  label:"Rapelan",       desc:"Selisih dibayar mundur", bg:"var(--tint-amber-bg2)", active:"var(--st-amber)" },
                  ].map(({val,label,desc,bg,active}) => (
                    <button key={String(val)} onClick={() => setKonfirmasiRapelan(val)}
                      className="flex-1 py-2 px-2 rounded-xl text-xs font-semibold transition text-left"
                      style={{
                        background: konfirmasiRapelan===val ? bg : "var(--ln2)",
                        color:      konfirmasiRapelan===val ? active : "var(--dt4)",
                        border:    `1.5px solid ${konfirmasiRapelan===val ? active : "transparent"}`,
                      }}>
                      <span className="flex items-center gap-1.5">
                        <span style={{ width:"12px", height:"12px", borderRadius:"50%", border:`3px solid ${konfirmasiRapelan===val ? active : "var(--dt6)"}`, display:"inline-block", flexShrink:0 }} />
                        {label}
                      </span>
                      <span className="block mt-0.5" style={{ fontSize:"9.5px", fontWeight:400, color: konfirmasiRapelan===val ? active : "var(--dt5)", opacity:0.85 }}>{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs" style={{ color:"var(--dt2)" }}>
                KGB akan ditandai <strong>selesai</strong> dan data gaji pegawai diperbarui otomatis.
              </p>
              <div className="flex gap-2">
                <button disabled={konfirmasiLoading} onClick={() => setKonfirmasiId(null)}
                  className="flex-1 text-xs py-2.5 rounded-xl"
                  style={{ border:"1px solid var(--ln1)", color:"var(--dt4)" }}>
                  Batal
                </button>
                <button disabled={konfirmasiLoading}
                  onClick={() => handleKonfirmasi(konfirmasiId, konfirmasiRapelan)}
                  className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white"
                  style={{ background: konfirmasiLoading?"#7fb3a0":"var(--green-solid)" }}>
                  {konfirmasiLoading ? "Memproses..." : "Konfirmasi"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          MODAL: Konfirmasi cepat (bulk non-rapelan)
      ════════════════════════════════════════ */}
      {showBulk && (() => {
        const items = kgbList.filter((k) => bulkSelected.has(k.id));
        const totalNaik = items.reduce((s, k) => s + Math.max(0, k.gajiPokokBaru - k.gajiPokokLama), 0);
        return (
          <div className="adm-overlay" onClick={() => !bulkLoading && setShowBulk(false)}>
            <div className="adm-modal" style={{ maxWidth:"26rem", maxHeight:"88dvh", display:"flex", flexDirection:"column" }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-5 py-4 shrink-0" style={{ borderBottom:"0.5px solid var(--ln2)", background:"var(--sub)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background:"linear-gradient(135deg,#17a37e,var(--green-solid))" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="flex-1"><h2 className="text-sm font-semibold leading-tight" style={{ color:"var(--dtn)" }}>Konfirmasi Cepat {items.length} SK</h2><p className="text-xs" style={{ color:"var(--dt4)" }}>Semua ditandai <strong>tidak rapelan</strong></p></div>
              </div>
              <div className="p-5 space-y-2 overflow-y-auto">
                <div className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background:"var(--tint-green-bg)", border:"1px solid var(--tint-green-ln)" }}>
                  <span className="text-xs font-medium" style={{ color:"var(--st-green)" }}>Total kenaikan gaji</span>
                  <span className="text-sm font-bold" style={{ color:"var(--st-green)" }}>+{fmtRp(totalNaik)}/bln</span>
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border:"1px solid var(--ln1)", maxHeight:"200px", overflowY:"auto" }}>
                  {items.map((k, i) => (
                    <div key={k.id} className="flex items-center gap-2.5 px-3 py-2" style={{ borderBottom: i < items.length - 1 ? "0.5px solid var(--ln2)" : "none" }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background:"var(--tint-violet-bg)", color:"var(--st-violet)", fontSize:"9px" }}>{initials(k.pegawai.nama)}</div>
                      <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate" style={{ color:"var(--dtn)" }}>{k.pegawai.nama}</p><p className="text-xs" style={{ color:"var(--dt5)" }}>{k.golonganLama}→{k.golonganBaru}</p></div>
                      <span className="text-xs font-semibold shrink-0" style={{ color:"var(--st-green)" }}>{fmtRp(k.gajiPokokBaru)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs" style={{ color:"var(--dt5)", fontSize:"10.5px" }}>SK berpotensi rapelan tidak termasuk di sini — tinjau satu per satu.</p>
                {bulkLoading && (
                  <div>
                    <div className="rounded-full overflow-hidden" style={{ height:"5px", background:"var(--ln2)" }}>
                      <div style={{ height:"100%", width:`${(bulkProgress / items.length) * 100}%`, background:"var(--green-solid)", transition:"width .2s" }} />
                    </div>
                    <p className="text-xs text-center mt-1" style={{ color:"var(--dt4)" }}>{bulkProgress}/{items.length} diproses…</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 px-5 py-4 shrink-0" style={{ borderTop:"0.5px solid var(--ln2)" }}>
                <button onClick={() => setShowBulk(false)} disabled={bulkLoading} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border:"0.5px solid var(--ln1)", color:"var(--dt4)" }}>Batal</button>
                <button onClick={handleBulkKonfirmasi} disabled={bulkLoading} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-60" style={{ background:"var(--green-solid)" }}>{bulkLoading ? "Memproses…" : `Konfirmasi ${items.length} SK`}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════════════
          POPUP: Daftar KGB (Total / Selesai / Rapelan)
      ════════════════════════════════════════ */}
      {popup && (
        <>
          <div style={{ position:"fixed", inset:0, background:"rgba(6,14,28,0.55)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", zIndex:60, animation:"admFade .2s ease both" }}
            onClick={() => setPopup(null)} />
          <div style={{ position:"fixed", inset:0, zIndex:61, display:"flex", alignItems:"center", justifyContent:"center", padding:"1.5rem", pointerEvents:"none" }}>
            <div style={{ background:"var(--card)", borderRadius:"16px", width:"100%", maxWidth:"700px", maxHeight:"80dvh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.18)", pointerEvents:"all" }}>
              <div className="px-5 py-3.5 flex items-center justify-between shrink-0"
                style={{ borderBottom:"1px solid var(--ln2)" }}>
                <div>
                  <p className="text-sm font-bold" style={{ color:"var(--dtn)" }}>{popupTitle}</p>
                  <p className="text-xs mt-0.5" style={{ color:"var(--dt5)" }}>{popupItems.length} KGB · TMT {todayYear}</p>
                </div>
                <button onClick={() => setPopup(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background:"var(--ln2)", color:"var(--dt3)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto" style={{ scrollbarWidth:"thin" }}>
                <table className="w-full" style={{ borderCollapse:"collapse", fontSize:"12px" }}>
                  <thead className="sticky top-0">
                    <tr style={{ borderBottom:"1px solid var(--ln2)", background:"var(--sub)" }}>
                      {["Pegawai","Golongan","Gaji Baru","TMT","Status"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left"
                          style={{ color:"var(--dt5)", fontWeight:600, fontSize:"11px", whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {popupItems.map((k, i) => {
                      const st = STATUS_CFG[k.status] ?? STATUS_CFG.belum_diproses;
                      return (
                        <tr key={k.id} style={{ borderBottom:"1px solid var(--ln2)", background: i%2===0?"var(--card)":"var(--sub)" }}>
                          <td className="px-4 py-2.5">
                            <p className="font-semibold" style={{ color:"var(--dtn)" }}>{k.pegawai.nama}</p>
                            <p style={{ color:"var(--dt5)", fontSize:"10px" }}>{k.pegawai.nip}</p>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                            <span style={{ color:"var(--dt5)" }}>{k.golonganLama}</span>
                            <span style={{ color:"var(--dt6)", margin:"0 4px" }}>→</span>
                            <span style={{ color:"var(--st-green)", fontWeight:600 }}>{k.golonganBaru}</span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-xs" style={{ color:"var(--st-green)" }}>
                            {fmtRp(k.gajiPokokBaru)}
                            {k.rapelanDitetapkan && (
                              <span className="ml-1 px-1 rounded" style={{ background:"var(--tint-amber-bg2)", color:"var(--st-amber)", fontSize:"9px", fontWeight:700 }}>RAPELAN</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color:"var(--dt3)" }}>
                            {fmt(k.tmtKgbBaru)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
                              style={{ background:st.bg, color:st.color, fontSize:"10px" }}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
