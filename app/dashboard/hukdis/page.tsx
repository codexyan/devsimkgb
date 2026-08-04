"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { canManageHukdis } from "@/lib/auth";

/* ─────────────────────────────────────────────────────────────────────────
   Modul Hukuman Disiplin (mandiri). Daftar SEMUA catatan hukdis lintas
   pegawai + statistik + input. Sumber: RiwayatHukdis (via /api/hukdis).
   ───────────────────────────────────────────────────────────────────────── */

interface Hukdis {
  id: string;
  pegawai: { id: string; nama: string; nip: string; jabatan: string; golonganRuang: string; aktif: boolean };
  jenisHukdis: string; jenisLabel: string; kategori: string;
  nomorSK: string; tanggalSK: string; tmtMulai: string; tmtBerakhir: string;
  berdampakKGB: boolean; durasiTunda: number | null; dasarHukum: string | null; keterangan: string | null;
  aktif: boolean;
}
interface Summary { total: number; aktif: number; ringan: number; sedang: number; berat: number; berdampakKGB: number; }
interface Jenis { kode: string; label: string; kategori: string; durasiHukdis: number; berdampakKGB: boolean; durasiTunda: number | null; dasarHukum: string | null; aktif: boolean; }
interface PegawaiOpt { id: string; nip: string; nama: string; jabatan: string; golonganRuang: string; statusHukdis: boolean; }
interface RegulasiOpt { id: string; nomor: string; tahun: string; tentang: string; status: string; }
const regText = (r: RegulasiOpt) => `${r.nomor} Tahun ${r.tahun}`;

const KAT: Record<string, { label: string; bg: string; color: string; grad: string }> = {
  ringan: { label: "Ringan", bg: "var(--tint-green-bg)", color: "var(--st-green)", grad: "linear-gradient(135deg,#17a37e,var(--green-solid))" },
  sedang: { label: "Sedang", bg: "var(--tint-amber-bg)", color: "var(--st-amber2)", grad: "linear-gradient(135deg,#d99414,var(--amber-solid))" },
  berat:  { label: "Berat",  bg: "var(--tint-red-bg)",   color: "var(--st-red)",   grad: "linear-gradient(135deg,#e35d5d,var(--red-solid))" },
};
const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
const fmt = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const isoAddMonths = (iso: string, months: number) => { const d = new Date(iso); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); };
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function HukdisPage() {
  const role = useRole();
  const allowed = canManageHukdis(role);

  const [data, setData] = useState<Hukdis[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterKat, setFilterKat] = useState("");
  const [filterStatus, setFilterStatus] = useState<"aktif" | "berakhir" | "">("aktif");

  // Input modal
  const [showInput, setShowInput] = useState(false);
  const [jenisList, setJenisList] = useState<Jenis[]>([]);
  const [regulasiList, setRegulasiList] = useState<RegulasiOpt[]>([]);
  const [dasarManual, setDasarManual] = useState(false);
  const [pegawai, setPegawai] = useState<PegawaiOpt[]>([]);
  const [pegSearch, setPegSearch] = useState("");
  const [selPeg, setSelPeg] = useState<PegawaiOpt | null>(null);
  const [form, setForm] = useState({
    jenisHukdis: "", nomorSK: "", tanggalSK: todayIso(), tmtMulai: todayIso(), tmtBerakhir: "",
    berdampakKGB: false, durasiTunda: 12, dasarHukum: "", keterangan: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Delete modal
  const [delTarget, setDelTarget] = useState<Hukdis | null>(null);
  const [deleting, setDeleting] = useState(false);

  function fetchData() {
    setLoading(true);
    fetch("/api/hukdis").then((r) => r.json() as any).then((d) => {
      if (d && Array.isArray(d.data)) { setData(d.data); setSummary(d.summary); }
    }).finally(() => setLoading(false));
  }
  useEffect(() => { if (allowed) fetchData(); else setLoading(false); }, [allowed]);

  function openInput() {
    setShowInput(true); setError(""); setSelPeg(null); setPegSearch(""); setDasarManual(false);
    setForm({ jenisHukdis: "", nomorSK: "", tanggalSK: todayIso(), tmtMulai: todayIso(), tmtBerakhir: "", berdampakKGB: false, durasiTunda: 12, dasarHukum: "", keterangan: "" });
    // Muat jenis + pegawai + regulasi sekali saat modal dibuka
    Promise.all([
      fetch("/api/hukdis/konfigurasi").then((r) => r.json() as any).catch(() => null),
      fetch("/api/pegawai?search=&status=").then((r) => r.json() as any).catch(() => []),
      fetch("/api/hukdis/regulasi").then((r) => r.json() as any).catch(() => []),
    ]).then(([cfg, peg, reg]) => {
      if (cfg?.jenis) setJenisList(cfg.jenis.filter((j: Jenis) => j.aktif));
      if (Array.isArray(peg)) setPegawai(peg);
      // Hanya regulasi yang masih relevan untuk input baru
      if (Array.isArray(reg)) setRegulasiList(reg.filter((r: RegulasiOpt) => r.status === "berlaku" || r.status === "dicabut_sebagian"));
    });
  }

  // Saat jenis dipilih: isi DEFAULT (bukan mengunci) dari config jenis — dasar
  // hukum, dampak KGB, durasi tunda, tmtBerakhir. PIC bebas mengubah semuanya.
  function pickJenis(kode: string) {
    const j = jenisList.find((x) => x.kode === kode);
    setForm((f) => ({
      ...f, jenisHukdis: kode,
      berdampakKGB: j?.berdampakKGB ?? false,
      durasiTunda: j?.durasiTunda ?? 12,
      dasarHukum: j?.dasarHukum ?? f.dasarHukum,
      tmtBerakhir: j && j.durasiHukdis > 0 && f.tmtMulai ? isoAddMonths(f.tmtMulai, j.durasiHukdis) : f.tmtBerakhir,
    }));
  }
  function setTmtMulai(v: string) {
    const j = jenisList.find((x) => x.kode === form.jenisHukdis);
    setForm((f) => ({ ...f, tmtMulai: v, tmtBerakhir: j && j.durasiHukdis > 0 && v ? isoAddMonths(v, j.durasiHukdis) : f.tmtBerakhir }));
  }

  const filteredPeg = useMemo(() => {
    const q = pegSearch.trim().toLowerCase();
    const list = q ? pegawai.filter((p) => p.nama.toLowerCase().includes(q) || p.nip.includes(q)) : pegawai;
    return list.slice(0, 50);
  }, [pegawai, pegSearch]);

  async function handleSubmit() {
    setError("");
    if (!selPeg) { setError("Pilih pegawai terlebih dahulu"); return; }
    if (!form.jenisHukdis) { setError("Pilih jenis hukuman disiplin"); return; }
    if (!form.nomorSK.trim()) { setError("Nomor SK wajib diisi"); return; }
    if (!form.tanggalSK || !form.tmtMulai || !form.tmtBerakhir) { setError("Tanggal SK, TMT mulai, dan TMT berakhir wajib diisi"); return; }
    if (new Date(form.tmtBerakhir) < new Date(form.tmtMulai)) { setError("TMT berakhir tidak boleh sebelum TMT mulai"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pegawai/${selPeg.id}/hukdis`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await res.json() as any;
      if (!res.ok) { setError(d.error || "Gagal menyimpan hukdis"); return; }
      setShowInput(false);
      setSuccess(`Hukdis untuk ${selPeg.nama} tersimpan.`);
      setTimeout(() => setSuccess(""), 4000);
      fetchData();
    } catch { setError("Gagal menghubungi server"); }
    finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!delTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/hukdis/${delTarget.id}`, { method: "DELETE" });
      if (res.ok) { setDelTarget(null); setSuccess("Catatan hukdis dihapus."); setTimeout(() => setSuccess(""), 3000); fetchData(); }
    } finally { setDeleting(false); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((h) =>
      (filterStatus === "" || (filterStatus === "aktif" ? h.aktif : !h.aktif)) &&
      (filterKat === "" || h.kategori === filterKat) &&
      (!q || h.pegawai.nama.toLowerCase().includes(q) || h.pegawai.nip.includes(q) || h.jenisLabel.toLowerCase().includes(q)),
    );
  }, [data, search, filterKat, filterStatus]);

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>Akses ditolak</p>
        <p className="text-xs" style={{ color: "var(--dt4)" }}>Halaman ini hanya untuk SDM Hukdis dan Super Admin.</p>
      </div>
    );
  }

  const stats = [
    { key: "", label: "Total Aktif", value: summary?.aktif ?? 0, grad: "linear-gradient(135deg,#2d5d94,var(--navy-solid))" },
    { key: "ringan", label: "Ringan", value: summary?.ringan ?? 0, grad: KAT.ringan.grad },
    { key: "sedang", label: "Sedang", value: summary?.sedang ?? 0, grad: KAT.sedang.grad },
    { key: "berat", label: "Berat", value: summary?.berat ?? 0, grad: KAT.berat.grad },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="adm-chip" style={{ background: "linear-gradient(135deg,#e35d5d,var(--red-solid))" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-red)" }}>SDM Hukdis</p>
          <h1 className="text-base font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Hukuman Disiplin</h1>
          <p className="text-xs" style={{ color: "var(--dt4)" }}>Seluruh catatan hukdis pegawai · pantau masa berlaku &amp; dampak KGB</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard/hukdis/regulasi" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition" style={{ background: "var(--sub)", color: "var(--dt3)", border: "0.5px solid var(--ln0)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            Regulasi
          </Link>
          <Link href="/dashboard/hukdis/konfigurasi" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition" style={{ background: "var(--sub)", color: "var(--dt3)", border: "0.5px solid var(--ln0)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Jenis Hukdis
          </Link>
          <button onClick={openInput} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition" style={{ background: "var(--red-solid)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Input Hukdis
          </button>
        </div>
      </div>

      {success && (
        <div className="px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "1px solid var(--tint-green-ln)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{success}
        </div>
      )}

      {/* Stat tiles (klik = filter kategori) */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {stats.map((s) => {
            const active = filterKat === s.key && s.key !== "";
            return (
              <button key={s.label} onClick={() => s.key !== "" && setFilterKat(active ? "" : s.key)} className={`adm-stat ${s.key ? "clickable" : ""} ${active ? "active" : ""}`} style={{ textAlign: "left", cursor: s.key ? "pointer" : "default" }}>
                <span className="adm-stat-strip" style={{ background: s.grad }} />
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.grad }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div>
                    <p className="font-bold leading-none" style={{ fontSize: "20px", color: "var(--dtn)" }}>{s.value}</p>
                    <p style={{ fontSize: "10.5px", color: "var(--dt4)", marginTop: "2px" }}>{s.label}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--dt5)" }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, NIP, atau jenis hukdis…" className="adm-input" style={{ paddingLeft: "34px" }} />
        </div>
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
          {([{ v: "aktif", l: "Aktif" }, { v: "berakhir", l: "Berakhir" }, { v: "", l: "Semua" }] as { v: "aktif" | "berakhir" | ""; l: string }[]).map((t) => (
            <button key={t.l} onClick={() => setFilterStatus(t.v)} className="px-3 py-2 text-xs font-medium transition" style={{ background: filterStatus === t.v ? "var(--navy-solid)" : "var(--card)", color: filterStatus === t.v ? "#fff" : "var(--dt4)" }}>{t.l}</button>
          ))}
        </div>
        {filterKat && (
          <button onClick={() => setFilterKat("")} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl" style={{ background: KAT[filterKat]?.bg, color: KAT[filterKat]?.color }}>
            {KAT[filterKat]?.label}<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16"><p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat data hukdis…</p></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--dt6)" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>{data.length === 0 ? "Belum ada catatan hukuman disiplin" : "Tidak ada yang cocok dengan filter"}</p>
            {data.length === 0 && <button onClick={openInput} className="text-xs font-semibold px-4 py-2 rounded-xl text-white" style={{ background: "var(--red-solid)" }}>+ Input Hukdis Pertama</button>}
          </div>
        ) : (
          <div className="overflow-x-auto tbl-scroll">
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}>
                  {["Pegawai", "Jenis Hukdis", "Nomor SK", "Masa Berlaku", "Status", "Dampak KGB", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: "var(--dt4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => {
                  const kat = KAT[h.kategori];
                  return (
                    <tr key={h.id} style={{ borderBottom: i < filtered.length - 1 ? "0.5px solid var(--ln2)" : "none" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{initials(h.pegawai.nama)}</div>
                          <div className="min-w-0"><p className="text-xs font-medium truncate" style={{ color: "var(--dtn)" }}>{h.pegawai.nama}</p><p className="text-xs" style={{ color: "var(--dt4)" }}>{h.pegawai.nip}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{h.jenisLabel}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {kat && <span className="inline-block text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: kat.bg, color: kat.color, fontSize: "10px" }}>{kat.label}</span>}
                          {h.dasarHukum && <span className="text-xs truncate" style={{ color: "var(--dt5)", fontSize: "10px", maxWidth: "160px" }} title={h.dasarHukum}>{h.dasarHukum}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--dt3)" }}>{h.nomorSK || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs" style={{ color: "var(--dtn)" }}>{fmt(h.tmtMulai)} – {fmt(h.tmtBerakhir)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap" style={{ background: h.aktif ? "var(--tint-red-bg)" : "var(--ln2)", color: h.aktif ? "var(--st-red)" : "var(--dt5)" }}>
                          {h.aktif ? "Aktif" : "Berakhir"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {h.berdampakKGB
                          ? <span className="text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}>Tunda {h.durasiTunda ?? "-"} bln</span>
                          : <span className="text-xs" style={{ color: "var(--dt5)" }}>Tidak</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/dashboard/pegawai/${h.pegawai.id}/riwayat`} title="Lihat riwayat pegawai" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </Link>
                          <button onClick={() => setDelTarget(h)} title="Hapus catatan hukdis" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
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

      {/* Modal Input Hukdis */}
      {showInput && (
        <div className="adm-overlay" onClick={() => !submitting && setShowInput(false)}>
          <div className="adm-modal" style={{ maxWidth: "30rem", maxHeight: "92dvh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 shrink-0" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#e35d5d,var(--red-solid))" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div className="flex-1"><h2 className="text-sm font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Input Hukuman Disiplin</h2><p className="text-xs" style={{ color: "var(--dt4)" }}>Pilih pegawai lalu isi detail SK hukdis</p></div>
              <button onClick={() => setShowInput(false)} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--ln2)", color: "var(--dt3)" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>

            <div className="p-5 space-y-3.5 overflow-y-auto">
              {/* Pilih pegawai */}
              {!selPeg ? (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Pegawai</label>
                  <input autoFocus value={pegSearch} onChange={(e) => setPegSearch(e.target.value)} placeholder="Cari nama atau NIP…" className="adm-input mb-2" />
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)", maxHeight: "200px", overflowY: "auto" }}>
                    {filteredPeg.length === 0 ? <p className="text-xs text-center py-6" style={{ color: "var(--dt5)" }}>{pegawai.length === 0 ? "Memuat / belum ada pegawai" : "Tidak ada yang cocok"}</p>
                     : filteredPeg.map((p, i) => (
                        <button key={p.id} onClick={() => setSelPeg(p)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left" style={{ borderBottom: i < filteredPeg.length - 1 ? "0.5px solid var(--ln2)" : "none", cursor: "pointer" }}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{initials(p.nama)}</div>
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate" style={{ color: "var(--dtn)" }}>{p.nama}</p><p className="text-xs truncate" style={{ color: "var(--dt4)" }}>{p.nip} · {p.jabatan}</p></div>
                          {p.statusHukdis && <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", fontSize: "9px" }}>hukdis aktif</span>}
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{initials(selPeg.nama)}</div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate" style={{ color: "var(--dtn)" }}>{selPeg.nama}</p><p className="text-xs" style={{ color: "var(--dt4)" }}>{selPeg.nip} · Gol. {selPeg.golonganRuang}</p></div>
                    <button onClick={() => setSelPeg(null)} className="text-xs px-2 py-1 rounded-lg shrink-0" style={{ color: "var(--dt4)", border: "0.5px solid var(--ln1)" }}>Ganti</button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Jenis Hukuman Disiplin</label>
                    <select value={form.jenisHukdis} onChange={(e) => pickJenis(e.target.value)} className="adm-input">
                      <option value="">Pilih jenis…</option>
                      {["ringan", "sedang", "berat"].map((kat) => {
                        const grp = jenisList.filter((j) => j.kategori === kat);
                        if (grp.length === 0) return null;
                        return <optgroup key={kat} label={KAT[kat]?.label ?? kat}>{grp.map((j) => <option key={j.kode} value={j.kode}>{j.label}{j.berdampakKGB ? " · menunda KGB" : ""}</option>)}</optgroup>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Nomor SK</label>
                    <input value={form.nomorSK} onChange={(e) => setForm((f) => ({ ...f, nomorSK: e.target.value }))} placeholder="Nomor SK hukuman disiplin" className="adm-input" />
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Tanggal SK</label><input type="date" value={form.tanggalSK} onChange={(e) => setForm((f) => ({ ...f, tanggalSK: e.target.value }))} className="adm-input" style={{ fontSize: "12px" }} /></div>
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>TMT Mulai</label><input type="date" value={form.tmtMulai} onChange={(e) => setTmtMulai(e.target.value)} className="adm-input" style={{ fontSize: "12px" }} /></div>
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>TMT Berakhir</label><input type="date" value={form.tmtBerakhir} onChange={(e) => setForm((f) => ({ ...f, tmtBerakhir: e.target.value }))} className="adm-input" style={{ fontSize: "12px" }} /></div>
                  </div>

                  {/* Dasar hukum: pilih dari master Regulasi (berlaku/sebagian) atau ketik manual */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium" style={{ color: "var(--dt2)" }}>Dasar Hukum / Peraturan</label>
                      <Link href="/dashboard/hukdis/regulasi" className="text-xs" style={{ color: "var(--accent)", fontSize: "10px" }}>Kelola regulasi →</Link>
                    </div>
                    {!dasarManual && regulasiList.length > 0 ? (
                      <select
                        value={regulasiList.some((r) => regText(r) === form.dasarHukum) ? form.dasarHukum : ""}
                        onChange={(e) => { if (e.target.value === "__manual__") { setDasarManual(true); setForm((f) => ({ ...f, dasarHukum: "" })); } else setForm((f) => ({ ...f, dasarHukum: e.target.value })); }}
                        className="adm-input">
                        <option value="">Pilih regulasi…</option>
                        {regulasiList.map((r) => (
                          <option key={r.id} value={regText(r)}>{regText(r)} — {r.tentang}{r.status === "dicabut_sebagian" ? " (dicabut sebagian)" : ""}</option>
                        ))}
                        <option value="__manual__">— ketik manual —</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input value={form.dasarHukum} onChange={(e) => setForm((f) => ({ ...f, dasarHukum: e.target.value }))} placeholder="mis. PP Nomor 94 Tahun 2021" className="adm-input" />
                        {regulasiList.length > 0 && <button type="button" onClick={() => { setDasarManual(false); setForm((f) => ({ ...f, dasarHukum: "" })); }} className="text-xs px-3 rounded-xl shrink-0" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Daftar</button>}
                      </div>
                    )}
                    <p className="text-xs mt-1" style={{ color: "var(--dt5)", fontSize: "10px" }}>
                      {regulasiList.length === 0 ? "Belum ada regulasi terdaftar — ketik manual, atau daftarkan lewat Kelola regulasi." : "Dikunci pada catatan ini; peraturan baru tidak mengubahnya."}
                    </p>
                  </div>

                  {/* Dampak KGB — ditetapkan PIC */}
                  <div className="rounded-xl p-3" style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Berdampak pada KGB?</p>
                        <p className="text-xs" style={{ color: "var(--dt5)", fontSize: "10px" }}>Jika ya, TMT KGB pegawai digeser sesuai durasi penundaan.</p>
                      </div>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, berdampakKGB: !f.berdampakKGB }))}
                        style={{ width: "40px", height: "22px", borderRadius: "9999px", background: form.berdampakKGB ? "var(--st-amber)" : "var(--ln1)", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background .15s" }}>
                        <span style={{ position: "absolute", top: "2px", left: form.berdampakKGB ? "20px" : "2px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .15s", display: "block" }} />
                      </button>
                    </div>
                    {form.berdampakKGB && (
                      <div className="mt-3">
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Penundaan KGB (bulan)</label>
                        <div className="relative" style={{ maxWidth: "140px" }}>
                          <input type="number" inputMode="numeric" min={1} value={String(form.durasiTunda)}
                            onChange={(e) => setForm((f) => ({ ...f, durasiTunda: Math.max(1, parseInt(e.target.value.replace(/\D/g, "")) || 0) }))}
                            className="adm-input" style={{ paddingRight: "48px" }} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--dt5)" }}>bulan</span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: "var(--st-amber2)", fontSize: "10px" }}>TMT KGB berikutnya akan digeser +{form.durasiTunda || 0} bulan. Nilai ini ditetapkan Anda, bukan otomatis.</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Keterangan <span style={{ color: "var(--dt5)" }}>(opsional)</span></label>
                    <textarea rows={2} value={form.keterangan} onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))} placeholder="Catatan tambahan…" className="adm-input resize-none" />
                  </div>

                  {/* Catatan patokan */}
                  <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: "var(--tint-blue-bg)", border: "1px solid var(--tint-blue-ln)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--st-blue)" strokeWidth="2" style={{ marginTop: "1px", flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                    <p className="text-xs" style={{ color: "var(--st-blue)", fontSize: "10.5px", lineHeight: 1.5 }}>
                      Patokan: <strong>tanggal SK Hukdis</strong>. Semua nilai di atas dikunci pada catatan ini saat disimpan — perubahan regulasi/konfigurasi berikutnya tidak berlaku surut ke catatan ini.
                    </p>
                  </div>
                </>
              )}
              {error && <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="var(--st-red)"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg><p className="text-xs" style={{ color: "var(--st-red)" }}>{error}</p></div>}
            </div>

            <div className="flex gap-2 px-5 py-4 shrink-0" style={{ borderTop: "0.5px solid var(--ln2)" }}>
              <button onClick={() => setShowInput(false)} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Batal</button>
              <button onClick={handleSubmit} disabled={submitting || !selPeg} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: "var(--red-solid)" }}>{submitting ? "Menyimpan…" : "Simpan Hukdis"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus */}
      {delTarget && (
        <div className="adm-overlay" onClick={() => !deleting && setDelTarget(null)}>
          <div className="adm-modal" style={{ maxWidth: "24rem" }} onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--tint-red-bg)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--st-red)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></div>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>Hapus Catatan Hukdis?</h2>
              <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--dt4)" }}>Hapus hukdis <strong style={{ color: "var(--dtn)" }}>{delTarget.jenisLabel}</strong> milik <strong style={{ color: "var(--dtn)" }}>{delTarget.pegawai.nama}</strong>? Tindakan ini tidak bisa dibatalkan.</p>
              <div className="flex gap-2">
                <button onClick={() => setDelTarget(null)} disabled={deleting} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Batal</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: "var(--red-solid)" }}>{deleting ? "Menghapus…" : "Ya, Hapus"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
