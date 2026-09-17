"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, hariIniWita, tanggalKalender } from "@/lib/waktu";
import { kunciBulanTmt, rekapPerBulanTmt, satuPerSiklus, tahunTmt, type RekapBulanTmt } from "@/lib/rekapKgb";
import { useDialogModal } from "@/app/dashboard/components/useDialogModal";

/* ─────────────── interfaces ─────────────── */

interface KGB {
  /** null untuk entri Belum Diproses virtual (pegawai belum punya record KGB aktif). */
  id: string | null;
  pegawaiId: string;
  isVirtual?: boolean;
  isArsip?: boolean;
  status: string;
  tmtKgbBaru: string;
  golonganLama: string;
  golonganBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number | null;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  flagRapelan: boolean;
  rapelanDitetapkan: boolean | null;
  createdAt: string;
  pegawai: { nip: string; nama: string; jabatan: string; unitKerja: string } | null;
  surat: { nomorSurat: string; tanggalSurat: string; pathFile?: string | null } | null;
}

/* ─────────────── helpers ─────────────── */

const fmt     = (s: string) => formatTanggalId(s, { day: "numeric", month: "short", year: "numeric" });
const fmtFull = (s: string) => formatTanggalId(s);
const fmtRp   = (n: number | null | undefined) => (typeof n === "number" ? "Rp " + n.toLocaleString("id-ID") : "-");
const fmtMkg  = (k: KGB) => (k.mkgTahunBaru === null ? "-" : `${k.mkgTahunBaru} Thn ${k.mkgBulanBaru ?? 0} Bln`);

function initials(nama: string) {
  return nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const namaPegawai = (k: KGB) => k.pegawai?.nama ?? "-";
const kunciKgb = (k: KGB) => k.id ?? `virtual-${k.pegawaiId}`;
const badgeStatus = (status: string) => ({ label: infoStatusKgb(status).label, ...warnaStatusKgb(status) });

const ALASAN_TMT_LEWAT = "TMT sudah lewat, tinjau satu per satu";

/**
 * Alasan SK tidak dapat dipilih untuk Konfirmasi cepat; null bila dapat dipilih.
 * SK berpotensi rapelan tidak diberi kotak pilih sama sekali (null juga). SK yang TMT-nya (tanggal WITA)
 * hari ini atau sebelumnya ditinjau satu per satu; API menolak konfirmasi cepat untuk SK itu.
 */
function alasanTanpaKonfirmasiCepat(k: KGB, hariIni: Date): string | null {
  if (!k.id || k.flagRapelan) return null;
  const tmt = tanggalKalender(k.tmtKgbBaru);
  return !tmt || tmt.getTime() <= hariIni.getTime() ? ALASAN_TMT_LEWAT : null;
}

function bisaKonfirmasiCepat(k: KGB, hariIni: Date): k is KGB & { id: string } {
  return !!k.id && !k.flagRapelan && alasanTanpaKonfirmasiCepat(k, hariIni) === null;
}

function kunciBulan(tahun: number, bulan0: number) {
  const d = new Date(tahun, bulan0, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function bulanLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

/** Daftar KGB dari respons API; null bila isinya bukan daftar. */
async function bacaDaftarKgb(res: Response): Promise<KGB[] | null> {
  const d = (await res.json()) as unknown;
  return Array.isArray(d) ? (d as KGB[]) : null;
}

// Pengganti daftar kosong saat data gagal dimuat, agar kegagalan tidak terbaca sebagai "tidak ada data".
function GalatMuat({ pesan, onMuatUlang }: { pesan: string; onMuatUlang: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
      <p role="alert" className="text-xs font-semibold" style={{ color:"var(--st-red)" }}>{pesan}</p>
      <button type="button" onClick={onMuatUlang}
        className="ku-btn text-xs px-3 py-1.5 rounded-lg font-semibold"
        style={{ background:"var(--tint-navy)", color:"var(--dtn)", border:"1px solid var(--ln0)" }}>
        Muat ulang
      </button>
    </div>
  );
}

const BULAN_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agt","Sep","Okt","Nov","Des"];

/* ─────────────── MonthGrid ─────────────── */

// Warna tingkat pada kalender; setiap ubin juga menulis keterangannya sebagai teks.
const WARNA_TINGKAT = {
  urgent:  "var(--st-violet)",
  partial: "var(--dtn)",
  done:    "var(--st-green)",
} as const;

function MonthGrid({
  rekapBulan, filterMonth, onSelect,
}: {
  rekapBulan: Map<string, RekapBulanTmt>;
  filterMonth: string | null;
  onSelect: (key: string | null) => void;
}) {
  const today = hariIniWita();
  const yr = today.getFullYear();

  type Tier = "urgent"|"partial"|"done"|"empty";
  const pal: Record<Tier,{accent:string;soft:string;text:string}> = {
    urgent:  { accent:WARNA_TINGKAT.urgent, soft:"var(--tint-violet-bg)", text:"var(--st-violet)" },
    partial: { accent:WARNA_TINGKAT.partial, soft:"var(--tint-navy)", text:"var(--dtn)" },
    done:    { accent:WARNA_TINGKAT.done, soft:"var(--tint-green-bg)", text:"var(--st-green)" },
    empty:   { accent:"var(--dt6)", soft:"var(--sub)", text:"var(--dt6)" },
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"5px" }}>
      {Array.from({ length:12 }, (_,mo) => {
        const key  = `${yr}-${String(mo+1).padStart(2,"0")}`;
        const isNow = mo === today.getMonth();
        const r    = rekapBulan.get(key);
        const cnt  = r?.total ?? 0;
        const done = r?.dikonfirmasi ?? 0;
        const urg  = r?.menungguKeuangan ?? 0;
        const isSel = filterMonth === key;
        const tier: Tier = cnt===0?"empty": urg>0?"urgent": done===cnt?"done":"partial";
        const { accent, soft, text } = pal[tier];
        const pct = cnt > 0 ? (done/cnt)*100 : 0;
        const keterangan = cnt === 0 ? "tidak ada KGB" : urg > 0 ? `${urg} SK menunggu konfirmasi` : done === cnt ? "seluruhnya dikonfirmasi" : `${done} dari ${cnt} dikonfirmasi`;

        return (
          <button key={key} type="button" onClick={() => onSelect(isSel ? null : key)}
            aria-pressed={isSel}
            aria-label={`${bulanLabel(key)}: ${cnt} KGB, ${keterangan}`}
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
                {urg > 0 ? `${urg} perlu aksi` : done===cnt ? "selesai" : `${done}/${cnt}`}
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
  k, onPreview, onKonfirmasi, selectable, selected, onToggleSelect, alasanTanpaPilih,
}: {
  k: KGB;
  onPreview: (url: string) => void;
  onKonfirmasi: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Bila diisi, kotak pilih dinonaktifkan dan alasannya ditampilkan. */
  alasanTanpaPilih?: string | null;
}) {
  const selisih = (k.gajiPokokBaru ?? 0) - k.gajiPokokLama;
  const nama = namaPegawai(k);
  const idAlasan = `alasan-tanpa-pilih-${kunciKgb(k)}`;
  return (
    <div className="ku-card rounded-xl overflow-hidden"
      style={{ background:"var(--card)", border:`1px solid ${k.flagRapelan ? "var(--tint-amber-ln)" : "var(--tint-violet-ln)"}`, position:"relative" }}>
      {/* Strip aksen kiri */}
      <span aria-hidden style={{ position:"absolute", top:0, bottom:0, left:0, width:"3px", background: k.flagRapelan ? "var(--st-amber)" : "var(--st-violet)" }} />
      <div className="p-3 pl-3.5 space-y-2">
        <div className="flex items-center gap-2">
          {selectable && (
            <input type="checkbox" checked={!!selected} onChange={onToggleSelect} className="w-4 h-4 rounded shrink-0" onClick={(e) => e.stopPropagation()} title="Pilih untuk konfirmasi cepat" aria-label={`Pilih SK ${nama} untuk konfirmasi cepat`} />
          )}
          {!selectable && alasanTanpaPilih && (
            <input type="checkbox" checked={false} disabled className="w-4 h-4 rounded shrink-0 cursor-not-allowed" title={alasanTanpaPilih} aria-label={`Pilih SK ${nama} untuk konfirmasi cepat`} aria-describedby={idAlasan} />
          )}
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" aria-hidden
            style={{ background:"var(--tint-violet-bg)", color:"var(--st-violet)" }}>
            {initials(nama)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color:"var(--dtn)" }}>{nama}</p>
            <p className="text-xs truncate" style={{ color:"var(--dt4)" }}>{k.pegawai?.nip ?? "-"}</p>
          </div>
          {k.flagRapelan && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ background:"var(--tint-amber-bg)", color:"var(--st-amber)", fontSize:"9px" }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
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
        {!selectable && alasanTanpaPilih && (
          <p id={idAlasan} style={{ fontSize:"10px", color:"var(--st-amber2)" }}>{alasanTanpaPilih}</p>
        )}

        <div className="flex gap-1.5">
          {k.surat?.pathFile && (
            <button onClick={() => onPreview(`/api/blob/download?url=${encodeURIComponent(k.surat!.pathFile!)}`)}
              className="ku-btn flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg text-xs font-medium shrink-0"
              style={{ background:"var(--tint-navy)", color:"var(--dtn)", border:"1px solid var(--ln0)" }} title="Lihat SK Tertandatangani" aria-label={`Lihat SK Tertandatangani, ${nama}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              SK
            </button>
          )}
          <button onClick={onKonfirmasi}
            className="ku-btn flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ background: k.flagRapelan ? "var(--amber-solid)" : "var(--green-solid)" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><polyline points="20 6 9 17 4 12"/></svg>
            {k.flagRapelan ? "Tinjau dan Konfirmasi" : "Konfirmasi"}
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
  const [loading,    setLoading]    = useState(true);
  const [loadingAll, setLoadingAll] = useState(true);
  // Galat memuat; selama terisi, daftar ditampilkan sebagai galat, bukan sebagai daftar kosong.
  const [galatMenunggu, setGalatMenunggu] = useState(false);
  const [galatSemua,    setGalatSemua]    = useState(false);

  const [filterMonth,       setFilterMonth]       = useState<string>(() => {
    // Default = TMT bulan ini+2, yang deadline input SDM-nya jatuh pada bulan ini.
    const d = hariIniWita();
    return kunciBulan(d.getFullYear(), d.getMonth() + 2);
  });
  const [previewUrl,        setPreviewUrl]         = useState<string | null>(null);
  const [previewKgbId,      setPreviewKgbId]       = useState<string | null>(null);
  const [konfirmasiId,      setKonfirmasiId]       = useState<string | null>(null);
  const [konfirmasiRapelan, setKonfirmasiRapelan]  = useState(false);
  const [konfirmasiLoading, setKonfirmasiLoading]  = useState(false);
  const [konfirmasiGalat,   setKonfirmasiGalat]    = useState<string | null>(null);
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
  // Bila pemuatan ulang gagal, daftar yang sudah ada tidak ditimpa.
  const fetchMenunggu = useCallback(async () => {
    setLoading(true);
    setGalatMenunggu(false);
    try {
      const res = await fetch("/api/kgb?status=menunggu_keuangan");
      const daftar = res.ok ? await bacaDaftarKgb(res) : null;
      if (!daftar) {
        setGalatMenunggu(true);
        return;
      }
      setKgbList(daftar);
      // Pilihan konfirmasi cepat hanya untuk SK yang masih menunggu, tidak berpotensi rapelan, dan TMT-nya belum lewat.
      const hariIni = hariIniWita();
      const layak = new Set(daftar.filter((k) => bisaKonfirmasiCepat(k, hariIni)).map((k) => k.id as string));
      setBulkSelected((prev) => {
        const sisa = new Set([...prev].filter((id) => layak.has(id)));
        return sisa.size === prev.size ? prev : sisa;
      });
    } catch {
      setGalatMenunggu(true);
    } finally { setLoading(false); }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoadingAll(true);
    setGalatSemua(false);
    try {
      const res = await fetch("/api/kgb");
      const daftar = res.ok ? await bacaDaftarKgb(res) : null;
      if (daftar) setAllKgb(daftar);
      else setGalatSemua(true);
    } catch {
      setGalatSemua(true);
    } finally { setLoadingAll(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { fetchMenunggu(); fetchAll(); }, 0);
    return () => clearTimeout(t);
  }, [fetchMenunggu, fetchAll]);

  async function pesanGalat(res: Response, bawaan: string) {
    try {
      const d = (await res.json()) as { error?: string };
      return d.error ?? bawaan;
    } catch {
      return bawaan;
    }
  }

  /* konfirmasi */
  function bukaKonfirmasi(k: KGB) {
    setKonfirmasiId(k.id);
    setKonfirmasiRapelan(k.flagRapelan);
    setKonfirmasiGalat(null);
  }

  function tutupPreview() {
    setPreviewUrl(null);
    setPreviewKgbId(null);
  }

  // Galat ditampilkan di dalam dialog, karena banner halaman tertutup latar dialog.
  async function handleKonfirmasi(kgbId: string, isRapelan: boolean) {
    setKonfirmasiLoading(true);
    setKonfirmasiGalat(null);
    try {
      const res = await fetch(`/api/kgb/${kgbId}/konfirmasi-keuangan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRapelan }),
      });
      if (res.ok) {
        setSuccess("KGB berhasil dikonfirmasi.");
        setTimeout(() => setSuccess(""), 6000);
        setKonfirmasiId(null);
        tutupPreview();
        fetchMenunggu(); fetchAll();
      } else {
        setKonfirmasiGalat(await pesanGalat(res, "Gagal mengkonfirmasi."));
        // 404/409: KGB sudah tidak menunggu konfirmasi, jadi daftar dimuat ulang.
        if (res.status === 404 || res.status === 409) { fetchMenunggu(); fetchAll(); }
      }
    } catch {
      setKonfirmasiGalat("Gagal menghubungi server. Coba lagi.");
    } finally { setKonfirmasiLoading(false); }
  }

  // Konfirmasi cepat: beberapa SK yang tidak berpotensi rapelan dan TMT-nya belum lewat dikonfirmasi
  // sekaligus sebagai tidak rapelan. SK lain ditinjau satu per satu; API memeriksa ulang dengan cepat: true.
  async function handleBulkKonfirmasi() {
    if (bulkSelected.size === 0) return;
    const hariIni = hariIniWita();
    const ids = [...bulkSelected].filter((id) => {
      const item = kgbList.find((k) => k.id === id);
      return !!item && bisaKonfirmasiCepat(item, hariIni);
    });
    setBulkLoading(true); setBulkProgress(0);
    let ok = 0;
    const gagal: string[] = [];
    for (const id of ids) {
      const item = kgbList.find((k) => k.id === id);
      const nama = item ? namaPegawai(item) : id;
      try {
        const res = await fetch(`/api/kgb/${id}/konfirmasi-keuangan`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRapelan: false, cepat: true }),
        });
        if (res.ok) ok++;
        else gagal.push(`${nama} (${await pesanGalat(res, `HTTP ${res.status}`)})`);
      } catch {
        gagal.push(`${nama} (koneksi gagal)`);
      }
      setBulkProgress((p) => p + 1);
    }
    setBulkLoading(false); setShowBulk(false);
    setBulkSelected(new Set());
    if (ids.length === 0) {
      setError(`SK yang dipilih tidak lagi dapat dikonfirmasi cepat: ${ALASAN_TMT_LEWAT}.`);
      setTimeout(() => setError(""), 10000);
    }
    if (ok > 0) {
      setSuccess(`${ok} dari ${ids.length} SK berhasil dikonfirmasi.`);
      setTimeout(() => setSuccess(""), 6000);
    }
    if (gagal.length > 0) {
      setError(`${gagal.length} SK gagal dikonfirmasi: ${gagal.join("; ")}.`);
      setTimeout(() => setError(""), 10000);
    }
    fetchMenunggu(); fetchAll();
  }

  // KGB yang belum punya record aktif (virtual) atau dibatalkan dikirim dengan pegawaiId.
  async function handleFollowUp(k: KGB) {
    const body = k.id && (k.status === "belum_diproses" || k.status === "sedang_diproses")
      ? { kgbId: k.id }
      : { pegawaiId: k.pegawaiId };
    try {
      const res = await fetch("/api/notifikasi/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const d = (await res.json()) as { sudahAda?: boolean };
        setFollowupSent((prev) => new Set(prev).add(kunciKgb(k)));
        setSuccess(d.sudahAda
          ? "Follow up untuk pegawai ini sudah dikirim sebelumnya dan belum dibaca Tim SDM."
          : "Follow up berhasil dikirim ke Tim SDM.");
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(await pesanGalat(res, "Follow up gagal dikirim."));
        setTimeout(() => setError(""), 6000);
      }
    } catch {
      setError("Follow up gagal dikirim.");
      setTimeout(() => setError(""), 6000);
    }
  }

  /* derived */
  const today       = hariIniWita();
  const todayMonth  = today.getMonth(); // 0-indexed
  const todayYear   = today.getFullYear();
  const dataSemuaSiap = !loadingAll && !galatSemua;

  // Hitungan memakai definisi bersama lib/rekapKgb.ts: satu KGB per pegawai per TMT (dibatalkan lalu
  // diinput ulang dihitung sekali) dan arsip tidak dihitung. Rekap dihitung dari data KGB saat dibuka.
  const kgbSiklus = satuPerSiklus(allKgb);
  const rekapBulan = new Map(rekapPerBulanTmt(kgbSiklus, today).map((r) => [r.bulanTmt, r]));

  // Ringkasan rekap untuk KGB berlaku bulan depan.
  const rekonBulanKey = kunciBulan(todayYear, todayMonth + 1);
  const rekonTmtLabel = bulanLabel(rekonBulanKey);
  const rekapBulanDepan = rekapBulan.get(rekonBulanKey) ?? null;
  const rekonPct = rekapBulanDepan && rekapBulanDepan.total > 0
    ? Math.round((rekapBulanDepan.dikonfirmasi / rekapBulanDepan.total) * 100)
    : 0;
  const rekapLengkap = !!rekapBulanDepan && rekapBulanDepan.total > 0 && rekapBulanDepan.dikonfirmasi === rekapBulanDepan.total;
  const showRekonBanner = !rekonDismissed && dataSemuaSiap && !!rekapBulanDepan && rekapBulanDepan.total > 0;

  // Follow-up untuk KGB dengan TMT bulan ini + 2, yang deadline input SDM-nya jatuh pada bulan ini.
  const followUpBulanKey = kunciBulan(todayYear, todayMonth + 2);
  const bulanIniLabel    = bulanLabel(kunciBulan(todayYear, todayMonth));
  const defaultFilterMonth = followUpBulanKey;

  const kgbTahunIni    = kgbSiklus.filter((k) => tahunTmt(k) === todayYear);
  const selesaiTahunIni  = kgbTahunIni.filter((k) => k.status === "selesai");
  const rapelanTahunIni  = selesaiTahunIni.filter((k) => k.rapelanDitetapkan === true);
  const totalSelesai     = selesaiTahunIni.length;
  const totalRapelan     = rapelanTahunIni.length;

  const popupItems = popup === "total"   ? kgbTahunIni
                   : popup === "selesai" ? selesaiTahunIni
                   : popup === "rapelan" ? rapelanTahunIni
                   : [];
  const popupTitle = popup === "total"   ? `KGB Tahun ${todayYear}`
                   : popup === "selesai" ? "Selesai Dikonfirmasi"
                   : popup === "rapelan" ? "Dikonfirmasi Rapelan"
                   : "";

  // Tabel per bulan: KGB siklus bulan itu, ditambah arsip (SK terbit di luar SIM-KGB) sebagai keterangan.
  const monthSiklus    = kgbSiklus.filter((k) => kunciBulanTmt(k.tmtKgbBaru) === filterMonth);
  const monthArsip     = allKgb.filter((k) => k.isArsip && kunciBulanTmt(k.tmtKgbBaru) === filterMonth);
  const monthItems     = [...monthSiklus, ...monthArsip];
  const konfirmasiTarget = konfirmasiId ? [...kgbList, ...allKgb].find((k) => k.id === konfirmasiId) ?? null : null;

  // Fokus, Tab di dalam panel, Escape, dan fokus kembali ke pemicu. Konfirmasi yang dibuka dari
  // pratinjau SK berada di atas tumpukan, jadi hanya dialog itu yang menanggapi Escape.
  const refPreview = useDialogModal(!!previewUrl, tutupPreview);
  const refKonfirmasi = useDialogModal(!!konfirmasiId && !!konfirmasiTarget, () => setKonfirmasiId(null), konfirmasiLoading);
  const refPopup = useDialogModal(!!popup, () => setPopup(null));

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
            Konfirmasi SK yang masuk · Pantau status KGB berjalan · Rekap per bulan TMT dihitung dari data KGB
          </p>
        </div>
      </div>

      {/* ── Stat chips ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {([
          {
            key: "total" as const,
            label: "Total KGB Tahun Ini",
            value: dataSemuaSiap ? kgbTahunIni.length : "-",
            sub: galatSemua ? "Data KGB gagal dimuat" : `Berlaku ${todayYear} · klik lihat daftar`,
            clickable: dataSemuaSiap && kgbTahunIni.length > 0,
            bg: "var(--sub)", border: "var(--ln1)", color: "var(--dtn)",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a7a9a" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
          },
          {
            key: null,
            label: "Menunggu Konfirmasi",
            value: loading || galatMenunggu ? "-" : kgbList.length,
            sub: galatMenunggu ? "Daftar SK gagal dimuat" : "SK masuk, belum dikonfirmasi keuangan",
            clickable: false,
            bg: kgbList.length > 0 ? "var(--tint-violet-bg)" : "var(--sub)",
            border: kgbList.length > 0 ? "var(--tint-violet-ln)" : "var(--ln1)",
            color: kgbList.length > 0 ? "var(--st-violet)" : "var(--dt4)",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={kgbList.length > 0 ? "var(--st-violet)" : "var(--dt5)"} strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
          },
          {
            key: "selesai" as const,
            label: "Sudah Dikonfirmasi",
            value: dataSemuaSiap ? totalSelesai : "-",
            sub: galatSemua ? "Data KGB gagal dimuat" : `dari ${kgbTahunIni.length} total KGB tahun ini`,
            clickable: dataSemuaSiap && totalSelesai > 0,
            bg: totalSelesai > 0 ? "var(--tint-green-bg)" : "var(--sub)",
            border: totalSelesai > 0 ? "var(--tint-green-ln)" : "var(--ln1)",
            color: totalSelesai > 0 ? "var(--st-green)" : "var(--dt4)",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={totalSelesai > 0 ? "var(--st-green)" : "var(--dt5)"} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
          },
          {
            key: "rapelan" as const,
            label: "Dikonfirmasi Rapelan",
            value: dataSemuaSiap ? totalRapelan : "-",
            sub: galatSemua ? "Data KGB gagal dimuat" : totalRapelan > 0 ? "SK terlambat, selisih gaji dibayar mundur" : "Tidak ada rapelan",
            clickable: dataSemuaSiap && totalRapelan > 0,
            bg: totalRapelan > 0 ? "var(--tint-amber-bg)" : "var(--sub)",
            border: totalRapelan > 0 ? "var(--tint-amber-ln)" : "var(--ln1)",
            color: totalRapelan > 0 ? "var(--st-amber)" : "var(--dt4)",
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={totalRapelan > 0 ? "var(--st-amber)" : "var(--dt5)"} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
          },
        ] as { key: "total"|"selesai"|"rapelan"|null; label:string; value:string|number; sub:string; clickable:boolean; bg:string; border:string; color:string; icon:React.ReactNode }[]).map(({ key, label, value, sub, clickable, bg, border, color, icon }) => (
          <div
            key={label}
            onClick={() => key && clickable && setPopup(key)}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-label={clickable ? `${label}: ${value}. Lihat daftar` : undefined}
            onKeyDown={(e) => {
              if (key && clickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setPopup(key); }
            }}
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
        <div role="status" className="rounded-xl px-4 py-2.5 text-xs font-medium flex items-center gap-2"
          style={{ background:"var(--tint-green-bg)", color:"var(--st-green)", border:"1px solid var(--tint-green-ln)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {success}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl px-4 py-2.5 text-xs font-medium"
          style={{ background:"var(--tint-red-bg)", color:"var(--st-red)", border:"1px solid var(--tint-red-ln)" }}>
          {error}
        </div>
      )}

      {/* ── Rekap KGB berlaku bulan depan (dihitung dari data KGB) ── */}
      {showRekonBanner && rekapBulanDepan && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: rekapLengkap ? "var(--tint-green-bg)" : "var(--tint-blue-bg)", border:`1px solid ${rekapLengkap ? "var(--tint-green-ln)" : "var(--tint-blue-ln)"}` }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" aria-hidden
            style={{ background: rekapLengkap ? "var(--tint-green-bg2)" : "var(--tint-blue-bg2)", color: rekapLengkap ? "var(--st-green)" : "var(--st-blue)" }}>
            {rekapLengkap
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            }
          </div>
          <p className="text-xs flex-1" style={{ color: rekapLengkap ? "var(--st-green)" : "var(--st-blue)" }}>
            {rekapLengkap
              ? <>Seluruh <strong>{rekapBulanDepan.total} KGB</strong> berlaku <strong>{rekonTmtLabel}</strong> sudah dikonfirmasi dan dapat dijadikan dasar input Sistem Gaji Web.</>
              : <>KGB berlaku <strong>{rekonTmtLabel}</strong>: <strong>{rekapBulanDepan.dikonfirmasi} dari {rekapBulanDepan.total}</strong> sudah dikonfirmasi, {rekapBulanDepan.menungguKeuangan} menunggu konfirmasi, {rekapBulanDepan.belumSampaiKeuangan} belum sampai keuangan.</>
            }
            {" "}
            <Link href="/dashboard/keuangan/riwayat" className="underline font-semibold">Lihat Rekap Gaji Web</Link>
          </p>
          <button type="button" onClick={() => setRekonDismissed(true)}
            className="shrink-0 opacity-40 hover:opacity-80 transition-opacity"
            aria-label="Tutup ringkasan rekap" title="Tutup ringkasan rekap"
            style={{ lineHeight: 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
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
                SK yang sudah ditandatangani dan menunggu konfirmasi keuangan
              </p>
            </div>
            {!loading && !galatMenunggu && kgbList.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
                style={{ background:"var(--tint-violet-bg)", color:"var(--st-violet)" }}>{kgbList.length}</span>
            )}
          </div>
          {/* Progres konfirmasi KGB berlaku bulan depan */}
          {dataSemuaSiap && rekapBulanDepan && rekapBulanDepan.total > 0 && (
            <div className="px-4 py-2 shrink-0" style={{ borderBottom:"1px solid var(--ln2)", background:"var(--sub)" }}>
              <div className="flex items-center justify-between mb-1">
                <p style={{ fontSize:"10px", color:"var(--dt4)" }}>
                  KGB berlaku {rekonTmtLabel}: <strong style={{ color:"var(--dtn)" }}>{rekapBulanDepan.dikonfirmasi} dari {rekapBulanDepan.total}</strong> selesai dikonfirmasi
                </p>
                <p style={{ fontSize:"10px", fontWeight:700, color: rekonPct === 100 ? "var(--st-green)" : "var(--st-violet)" }}>
                  {rekonPct}%
                </p>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height:"4px", background:"var(--ln2)" }}
                role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rekonPct} aria-label={`Progres konfirmasi KGB berlaku ${rekonTmtLabel}`}>
                <div style={{ height:"100%", width:`${rekonPct}%`, background: rekonPct === 100 ? "var(--st-green)" : "var(--st-violet)", borderRadius:"999px", transition:"width 0.5s" }} />
              </div>
            </div>
          )}
          {/* Toolbar konfirmasi cepat (hanya SK non-rapelan) */}
          {!loading && !galatMenunggu && (() => {
            const eligibleIds = kgbList.filter((k) => bisaKonfirmasiCepat(k, today)).map((k) => k.id);
            if (eligibleIds.length === 0) return null;
            const allSel = eligibleIds.every((id) => bulkSelected.has(id));
            return (
              <div className="px-3 py-2 flex items-center gap-2 shrink-0" style={{ borderBottom:"1px solid var(--ln2)" }}>
                <button type="button" onClick={() => setBulkSelected(allSel ? new Set() : new Set(eligibleIds))}
                  aria-pressed={allSel}
                  className="ku-btn flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                  style={{ background:"var(--sub)", color:"var(--dt3)", border:"0.5px solid var(--ln1)" }}>
                  <span aria-hidden style={{ width:"14px", height:"14px", borderRadius:"4px", border:`1.5px solid ${allSel ? "var(--st-green)" : "var(--dt5)"}`, background: allSel ? "var(--st-green)" : "transparent", display:"inline-flex", alignItems:"center", justifyContent:"center" }}>
                    {allSel && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </span>
                  {allSel ? "Batal pilih" : `Pilih semua (${eligibleIds.length})`}
                </button>
                <span className="text-xs" style={{ color:"var(--dt5)" }}>SK tanpa potensi rapelan dengan TMT yang belum lewat</span>
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
            ) : galatMenunggu ? (
              <GalatMuat pesan="Daftar SK menunggu konfirmasi gagal dimuat." onMuatUlang={() => void fetchMenunggu()} />
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
                <KGBCard key={kunciKgb(k)} k={k}
                  selectable={bisaKonfirmasiCepat(k, today)}
                  alasanTanpaPilih={alasanTanpaKonfirmasiCepat(k, today)}
                  selected={!!k.id && bulkSelected.has(k.id)}
                  onToggleSelect={() => setBulkSelected((prev) => {
                    if (!k.id) return prev;
                    const n = new Set(prev); if (n.has(k.id)) n.delete(k.id); else n.add(k.id); return n;
                  })}
                  onPreview={(url) => { setPreviewUrl(url); setPreviewKgbId(k.id); }}
                  onKonfirmasi={() => bukaKonfirmasi(k)}
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
          {/* Keterangan warna; setiap ubin juga menuliskan tingkatnya sebagai teks. */}
          <div className="px-3 pt-2 pb-1 flex flex-wrap gap-x-3 gap-y-1 shrink-0">
            {([
              { bar:WARNA_TINGKAT.urgent, label:"\"n perlu aksi\": ada SK menunggu konfirmasi" },
              { bar:WARNA_TINGKAT.partial, label:"\"x/y\": sebagian dikonfirmasi" },
              { bar:WARNA_TINGKAT.done, label:"\"selesai\": seluruhnya dikonfirmasi" },
            ] as {bar:string;label:string}[]).map(({bar,label}) => (
              <div key={label} className="flex items-center gap-1">
                <div aria-hidden style={{ width:"8px", height:"3px", borderRadius:"2px", background:bar }} />
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
            ) : galatSemua ? (
              <GalatMuat pesan="Data KGB gagal dimuat." onMuatUlang={() => void fetchAll()} />
            ) : (
              <MonthGrid rekapBulan={rekapBulan} filterMonth={filterMonth}
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
                  Berlaku bulan depan
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color:"var(--dt5)" }}>
              {loadingAll ? "Memuat…" : galatSemua ? "Data KGB gagal dimuat" : `${monthSiklus.length} KGB`}
              {dataSemuaSiap && monthArsip.length > 0 && <span style={{ color:"var(--dt4)" }}> · {monthArsip.length} arsip</span>}
              {filterMonth === followUpBulanKey && dataSemuaSiap && (() => {
                const terkirim = monthSiklus.filter(k=>["menunggu_keuangan","selesai"].includes(k.status)).length;
                const belum = monthSiklus.length - terkirim;
                return <span style={{ color:"var(--dt4)" }}> · {terkirim} sudah dikirim SDM{belum > 0 ? `, ${belum} belum` : ""}</span>;
              })()}
              {filterMonth === rekonBulanKey && dataSemuaSiap && (
                <span style={{ color:"var(--dt4)" }}> · {monthSiklus.filter(k=>k.status==="selesai").length} selesai dikonfirmasi</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {monthSiklus.filter(k=>k.status==="menunggu_keuangan").length > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ background:"var(--tint-violet-bg)", color:"var(--st-violet)", border:"1px solid var(--tint-violet-ln)" }}>
                {monthSiklus.filter(k=>k.status==="menunggu_keuangan").length} perlu aksi
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
        ) : galatSemua ? (
          <GalatMuat pesan="Data KGB gagal dimuat." onMuatUlang={() => void fetchAll()} />
        ) : monthItems.length === 0 ? (
          <div className="text-center py-10 text-xs" style={{ color:"var(--dt5)" }}>
            Tidak ada data KGB pada bulan ini
          </div>
        ) : (
          <>
            {/* ── Mobile: kartu per KGB ── */}
            <div className="md:hidden divide-y" style={{ borderColor:"var(--ln2)" }}>
              {monthItems.map((k, i) => {
                const st = badgeStatus(k.status);
                const canFollowUp = !k.isArsip && kunciBulanTmt(k.tmtKgbBaru) === followUpBulanKey
                  && ["belum_diproses","sedang_diproses","ditolak"].includes(k.status);
                const justSent = followupSent.has(kunciKgb(k));
                const nama = namaPegawai(k);
                return (
                  <div key={kunciKgb(k)} className="px-4 py-3.5" style={{ background: i%2===0?"var(--card)":"var(--sub)" }}>
                    {/* Row 1: avatar + nama + status */}
                    <div className="flex items-start gap-3 mb-2.5">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold" aria-hidden
                        style={{ background:"var(--tint-navy)", color:"var(--dtn)" }}>
                        {initials(nama)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color:"var(--dtn)" }}>{nama}</p>
                        <p style={{ fontSize:"10px", color:"var(--dt5)" }}>{k.pegawai?.nip ?? "-"}</p>
                        <p style={{ fontSize:"10px", color:"var(--dt4)" }} className="truncate">{k.pegawai?.jabatan ?? "-"}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
                        style={{ background:st.bg, color:st.color, fontSize:"10px" }}>
                        {st.label}{k.isArsip ? " (arsip)" : ""}
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
                        <p style={{ fontSize:"11px", color:"var(--dt3)" }}>{fmtMkg(k)}</p>
                      </div>
                    </div>
                    {/* Row 3: actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {k.surat?.pathFile && (
                        <button onClick={() => setPreviewUrl(`/api/blob/download?url=${encodeURIComponent(k.surat!.pathFile!)}`)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium"
                          style={{ background:"var(--tint-navy)", color:"var(--dtn)" }}>
                          Lihat SK Tertandatangani
                        </button>
                      )}
                      {k.status === "menunggu_keuangan" && k.id && (
                        <button onClick={() => bukaKonfirmasi(k)}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white text-center"
                          style={{ background:"var(--green-solid)" }}>
                          {k.flagRapelan ? "Tinjau dan Konfirmasi" : "Konfirmasi"}
                        </button>
                      )}
                      {canFollowUp && (
                        <button onClick={() => handleFollowUp(k)} disabled={justSent}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-center"
                          style={{ background: justSent?"var(--tint-green-bg)":"var(--tint-amber-bg)", color: justSent?"var(--st-green)":"var(--st-amber)", border:`1px solid ${justSent?"var(--tint-green-ln)":"var(--tint-amber-ln)"}` }}>
                          {justSent ? "Terkirim" : "Follow Up SDM"}
                        </button>
                      )}
                      {k.status === "selesai" && k.rapelanDitetapkan && (
                        <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 8px", borderRadius:999, background:"var(--tint-amber-bg2)", color:"var(--st-amber)" }}>Rapelan ditetapkan</span>
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
                    const st = badgeStatus(k.status);
                    const canFollowUp = !k.isArsip && kunciBulanTmt(k.tmtKgbBaru) === followUpBulanKey
                      && ["belum_diproses","sedang_diproses","ditolak"].includes(k.status);
                    const justSent = followupSent.has(kunciKgb(k));
                    return (
                      <tr key={kunciKgb(k)} style={{ borderBottom:"1px solid var(--ln2)", background: i%2===0?"var(--card)":"var(--sub)" }}>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold" style={{ color:"var(--dtn)" }}>{namaPegawai(k)}</p>
                          <p style={{ color:"var(--dt5)", fontSize:"10px" }}>{k.pegawai?.nip ?? "-"}</p>
                        </td>
                        <td className="px-4 py-2.5" style={{ color:"var(--dt3)", maxWidth:"180px" }}>
                          <p className="truncate">{k.pegawai?.jabatan ?? "-"}</p>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color:"var(--dtn)", fontWeight:600 }}>
                          {k.golonganLama} → {k.golonganBaru}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-semibold" style={{ color:"var(--st-green)" }}>
                          {fmtRp(k.gajiPokokBaru)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color:"var(--dt3)" }}>
                          {fmtMkg(k)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                            style={{ background:st.bg, color:st.color }}>
                            {st.label}{k.isArsip ? " (arsip)" : ""}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {k.surat?.pathFile && (
                              <button onClick={() => setPreviewUrl(`/api/blob/download?url=${encodeURIComponent(k.surat!.pathFile!)}`)}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
                                style={{ background:"var(--tint-navy)", color:"var(--dtn)" }}>
                                Lihat SK Tertandatangani
                              </button>
                            )}
                            {k.status === "menunggu_keuangan" && k.id && (
                              <button onClick={() => bukaKonfirmasi(k)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                                style={{ background:"var(--green-solid)" }}>
                                {k.flagRapelan ? "Tinjau dan Konfirmasi" : "Konfirmasi"}
                              </button>
                            )}
                            {canFollowUp && (
                              <button onClick={() => handleFollowUp(k)} disabled={justSent}
                                className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
                                style={{ background: justSent?"var(--tint-green-bg)":"var(--tint-amber-bg)", color: justSent?"var(--st-green)":"var(--st-amber)", border:`1px solid ${justSent?"var(--tint-green-ln)":"var(--tint-amber-ln)"}` }}>
                                {justSent ? "Terkirim" : "Follow Up SDM"}
                              </button>
                            )}
                            {k.status === "selesai" && k.rapelanDitetapkan === true && (
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                style={{ background:"var(--tint-amber-bg2)", color:"var(--st-amber)", fontSize:"10px" }}>
                                Rapelan ditetapkan
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
            onClick={tutupPreview} />
          <div ref={refPreview} role="dialog" aria-modal="true" aria-labelledby="judul-pratinjau-sk" tabIndex={-1}
            style={{ outline:"none", position:"fixed", inset:"4%", zIndex:51, display:"flex", flexDirection:"column", background:"var(--card)", border:"1px solid var(--ln1)", borderRadius:"16px", overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.3)", animation:"admRise .32s cubic-bezier(.22,1,.36,1) both" }}>
            <div className="flex items-center justify-between px-4 py-3 shrink-0"
              style={{ borderBottom:"1px solid var(--ln1)", background:"var(--sub)" }}>
              <div>
                <p id="judul-pratinjau-sk" className="text-sm font-bold" style={{ color:"var(--dtn)" }}>SK yang Sudah Ditandatangani</p>
                <p className="text-xs" style={{ color:"var(--dt4)" }}>Verifikasi data sebelum konfirmasi</p>
              </div>
              <div className="flex items-center gap-2">
                {previewKgbId && kgbList.find(k=>k.id===previewKgbId) && (
                  <button
                    onClick={() => {
                      bukaKonfirmasi(kgbList.find(x=>x.id===previewKgbId)!);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5"
                    style={{ background:"var(--green-solid)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Konfirmasi
                  </button>
                )}
                <button type="button" onClick={tutupPreview}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  aria-label="Tutup pratinjau SK" title="Tutup pratinjau SK"
                  style={{ background:"var(--ln2)", color:"var(--dt3)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <iframe src={previewUrl} className="flex-1 w-full" style={{ border:"none" }} title="Pratinjau SK tertandatangani" />
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
            <div ref={refKonfirmasi} className="rounded-2xl w-full p-6 space-y-4"
              role="dialog" aria-modal="true" aria-labelledby="judul-konfirmasi-kgb" aria-busy={konfirmasiLoading} tabIndex={-1}
              style={{ outline:"none", maxWidth:"420px", background:"var(--card)", border:"1px solid var(--ln1)", boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }}>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" aria-hidden
                  style={{ background:"var(--tint-green-bg)", color:"var(--st-green)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <p id="judul-konfirmasi-kgb" className="text-sm font-bold" style={{ color:"var(--dtn)" }}>Konfirmasi KGB</p>
                  <p className="text-xs" style={{ color:"var(--dt4)" }}>{namaPegawai(konfirmasiTarget)}</p>
                </div>
              </div>

              {/* Ringkasan finansial dengan selisih */}
              <div className="rounded-xl overflow-hidden" style={{ border:"1px solid var(--ln1)" }}>
                <div className="px-3 py-2.5 flex items-end justify-between" style={{ background:"var(--tint-green-bg)" }}>
                  <div>
                    <p style={{ fontSize:"10px", color:"var(--st-green)" }}>Gaji pokok baru</p>
                    <p className="text-lg font-bold leading-tight" style={{ color:"var(--st-green)" }}>{fmtRp(konfirmasiTarget.gajiPokokBaru)}</p>
                  </div>
                  {(konfirmasiTarget.gajiPokokBaru ?? 0) - konfirmasiTarget.gajiPokokLama > 0 && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background:"var(--card)", color:"var(--st-green)" }}>
                      +{fmtRp((konfirmasiTarget.gajiPokokBaru ?? 0) - konfirmasiTarget.gajiPokokLama)}
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5 space-y-1.5" style={{ background:"var(--sub)" }}>
                  {[
                    { l:"Gaji lama", v:fmtRp(konfirmasiTarget.gajiPokokLama) },
                    { l:"Golongan",  v:`${konfirmasiTarget.golonganLama} → ${konfirmasiTarget.golonganBaru}` },
                    { l:"TMT KGB",   v:fmtFull(konfirmasiTarget.tmtKgbBaru) },
                    { l:"MKG baru",  v:fmtMkg(konfirmasiTarget) },
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
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--st-amber)" style={{ marginTop:"1px", flexShrink:0 }} aria-hidden><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
                  <p className="text-xs" style={{ color:"var(--st-amber2)", fontSize:"10.5px", lineHeight:1.5 }}>KGB ini diinput Tim SDM setelah deadline input, sehingga <strong>berpotensi rapelan</strong>. Pilih opsi <strong>Rapelan</strong> bila selisih gaji perlu dibayar mundur.</p>
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
                    <button key={String(val)} type="button" onClick={() => setKonfirmasiRapelan(val)} aria-pressed={konfirmasiRapelan===val}
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

              <div>
                <p className="text-xs" style={{ color:"var(--dt2)" }}>
                  KGB akan ditandai <strong>selesai</strong> dan data gaji pegawai diperbarui otomatis.
                </p>
                <div role="alert" aria-live="assertive">
                  {konfirmasiGalat && (
                    <p className="text-xs rounded-lg px-3 py-2 mt-2"
                      style={{ background:"var(--tint-red-bg)", color:"var(--st-red)", border:"1px solid var(--tint-red-ln)" }}>
                      {konfirmasiGalat}
                    </p>
                  )}
                </div>
              </div>
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
        const items = kgbList.filter((k) => bisaKonfirmasiCepat(k, today) && bulkSelected.has(k.id));
        const totalNaik = items.reduce((s, k) => s + Math.max(0, (k.gajiPokokBaru ?? 0) - k.gajiPokokLama), 0);
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
                    <div key={kunciKgb(k)} className="flex items-center gap-2.5 px-3 py-2" style={{ borderBottom: i < items.length - 1 ? "0.5px solid var(--ln2)" : "none" }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" aria-hidden style={{ background:"var(--tint-violet-bg)", color:"var(--st-violet)", fontSize:"9px" }}>{initials(namaPegawai(k))}</div>
                      <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate" style={{ color:"var(--dtn)" }}>{namaPegawai(k)}</p><p className="text-xs" style={{ color:"var(--dt5)" }}>{k.golonganLama}→{k.golonganBaru}</p></div>
                      <span className="text-xs font-semibold shrink-0" style={{ color:"var(--st-green)" }}>{fmtRp(k.gajiPokokBaru)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs" style={{ color:"var(--dt5)", fontSize:"10.5px" }}>SK berpotensi rapelan dan SK dengan TMT hari ini atau sebelumnya tidak termasuk di sini; tinjau satu per satu.</p>
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
            <div ref={refPopup} role="dialog" aria-modal="true" aria-labelledby="judul-daftar-kgb" tabIndex={-1}
              style={{ outline:"none", background:"var(--card)", borderRadius:"16px", width:"100%", maxWidth:"700px", maxHeight:"80dvh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.18)", pointerEvents:"all" }}>
              <div className="px-5 py-3.5 flex items-center justify-between shrink-0"
                style={{ borderBottom:"1px solid var(--ln2)" }}>
                <div>
                  <p id="judul-daftar-kgb" className="text-sm font-bold" style={{ color:"var(--dtn)" }}>{popupTitle}</p>
                  <p className="text-xs mt-0.5" style={{ color:"var(--dt5)" }}>{popupItems.length} KGB · TMT {todayYear}</p>
                </div>
                <button type="button" onClick={() => setPopup(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  aria-label="Tutup daftar" title="Tutup daftar"
                  style={{ background:"var(--ln2)", color:"var(--dt3)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
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
                      const st = badgeStatus(k.status);
                      return (
                        <tr key={kunciKgb(k)} style={{ borderBottom:"1px solid var(--ln2)", background: i%2===0?"var(--card)":"var(--sub)" }}>
                          <td className="px-4 py-2.5">
                            <p className="font-semibold" style={{ color:"var(--dtn)" }}>{namaPegawai(k)}</p>
                            <p style={{ color:"var(--dt5)", fontSize:"10px" }}>{k.pegawai?.nip ?? "-"}</p>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                            <span style={{ color:"var(--dt5)" }}>{k.golonganLama}</span>
                            <span style={{ color:"var(--dt6)", margin:"0 4px" }}>→</span>
                            <span style={{ color:"var(--st-green)", fontWeight:600 }}>{k.golonganBaru}</span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-xs" style={{ color:"var(--st-green)" }}>
                            {fmtRp(k.gajiPokokBaru)}
                            {k.rapelanDitetapkan && (
                              <span className="ml-1 px-1 rounded" style={{ background:"var(--tint-amber-bg2)", color:"var(--st-amber)", fontSize:"9px", fontWeight:700 }}>Rapelan ditetapkan</span>
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
