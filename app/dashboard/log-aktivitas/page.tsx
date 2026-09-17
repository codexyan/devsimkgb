"use client";

import { useEffect, useState, useCallback } from "react";
import { useDialogModal } from "@/app/dashboard/components/useDialogModal";

/* ─── Types ─────────────────────────────────────── */
interface LogItem {
  id: string;
  waktu: string;
  user: string;
  aksi: string;
  detail: string;
  targetNama: string | null;
  ipAddress: string | null;
}
interface LogResponse {
  data: LogItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/* ─── Ikon aksi ─────────────────────────────────── */
const I = {
  doc:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>,
  x:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  edit:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  up:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  trash: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>,
  import:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  shield:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  hand:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>,
};
/* Dipetakan dari nilai `aksi` yang dipakai logAudit di codebase, ditambah serah_terima dan
   rekon_keuangan yang fiturnya sudah dihapus tetapi entrinya masih ada di log lama. */
const AKSI_CONFIG: Record<string, { label: string; bg: string; color: string; icon: React.ReactNode }> = {
  input_kgb:                { label: "Input KGB",           bg: "var(--tint-navy)",      color: "var(--dtn)",       icon: I.doc },
  input_kgb_arsip:          { label: "Arsip KGB",           bg: "var(--tint-amber-bg)",  color: "var(--st-amber)",  icon: I.doc },
  generate_surat:           { label: "Buat SK",             bg: "var(--tint-green-bg)",  color: "var(--st-green)",  icon: I.doc },
  upload_sk:                { label: "Unggah SK TTE",       bg: "var(--tint-green-bg)",  color: "var(--st-green)",  icon: I.up },
  ubah_penetap_sk:          { label: "Ubah Penetap SK",     bg: "var(--sub)",            color: "var(--dt3)",       icon: I.edit },
  reject_kgb:               { label: "Batalkan KGB",        bg: "var(--tint-red-bg)",    color: "var(--st-red)",    icon: I.x },
  serah_terima:             { label: "Serah Terima",        bg: "var(--tint-green-bg)",  color: "var(--st-green)",  icon: I.hand },
  konfirmasi_keuangan:      { label: "Konfirmasi Keuangan", bg: "var(--tint-violet-bg)", color: "var(--st-violet)", icon: I.check },
  rekon_keuangan:           { label: "Rekon Keuangan",      bg: "var(--tint-violet-bg)", color: "var(--st-violet)", icon: I.doc },
  tambah_pegawai:           { label: "Tambah Pegawai",      bg: "var(--tint-navy)",      color: "var(--dtn)",       icon: I.doc },
  edit_pegawai:             { label: "Ubah Pegawai",        bg: "var(--sub)",            color: "var(--dt3)",       icon: I.edit },
  hapus_pegawai:            { label: "Hapus Pegawai",       bg: "var(--tint-red-bg)",    color: "var(--st-red)",    icon: I.trash },
  import_pegawai:           { label: "Impor Pegawai",       bg: "var(--tint-navy)",      color: "var(--dtn)",       icon: I.import },
  input_hukdis:             { label: "Input Hukdis",        bg: "var(--tint-amber-bg)",  color: "var(--st-amber)",  icon: I.shield },
  hapus_hukdis:             { label: "Hapus Hukdis",        bg: "var(--tint-red-bg)",    color: "var(--st-red)",    icon: I.shield },
  tambah_jenis_hukdis:      { label: "Tambah Jenis Hukdis", bg: "var(--tint-amber-bg)",  color: "var(--st-amber)",  icon: I.shield },
  ubah_jenis_hukdis:        { label: "Ubah Jenis Hukdis",   bg: "var(--tint-amber-bg)",  color: "var(--st-amber)",  icon: I.edit },
  hapus_jenis_hukdis:       { label: "Hapus Jenis Hukdis",  bg: "var(--tint-red-bg)",    color: "var(--st-red)",    icon: I.trash },
  fix_arsip:                { label: "Koreksi Arsip Historis", bg: "var(--tint-amber-bg)",  color: "var(--st-amber)",  icon: I.edit },
  tambah_penandatangan:     { label: "Tambah Penandatangan", bg: "var(--tint-amber-bg)", color: "var(--st-amber)",  icon: I.edit },
  ubah_penandatangan:       { label: "Ubah Penandatangan",  bg: "var(--tint-amber-bg)",  color: "var(--st-amber)",  icon: I.edit },
  hapus_penandatangan:      { label: "Hapus Penandatangan", bg: "var(--tint-red-bg)",    color: "var(--st-red)",    icon: I.trash },
  edit_profil:              { label: "Ubah Profil",         bg: "var(--sub)",            color: "var(--dt3)",       icon: I.edit },
  ajukan_perubahan_profil:  { label: "Ajuan Profil",        bg: "var(--sub)",            color: "var(--dt3)",       icon: I.edit },
  approve_perubahan_profil: { label: "Setujui Profil",      bg: "var(--tint-green-bg)",  color: "var(--st-green)",  icon: I.check },
  reject_perubahan_profil:  { label: "Tolak Profil",        bg: "var(--tint-red-bg)",    color: "var(--st-red)",    icon: I.x },
  tambah_pengguna:          { label: "Tambah Pengguna",     bg: "var(--tint-navy)",      color: "var(--dtn)",       icon: I.check },
  reset_password:           { label: "Atur Ulang Password", bg: "var(--tint-amber-bg)",  color: "var(--st-amber)",  icon: I.edit },
  hapus_pengguna:           { label: "Hapus Pengguna",      bg: "var(--tint-red-bg)",    color: "var(--st-red)",    icon: I.trash },
  edit_konfigurasi:         { label: "Ubah Pengaturan",     bg: "var(--tint-amber-bg)",  color: "var(--st-amber)",  icon: I.edit },
  hapus_riwayat:            { label: "Hapus Log",           bg: "var(--tint-red-bg)",    color: "var(--st-red)",    icon: I.trash },
};

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Kemarin";
  if (days < 7) return `${days} hari lalu`;
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
const AKSI_OPTIONS = Object.entries(AKSI_CONFIG).map(([k, v]) => ({ value: k, label: v.label }));
// Tanggal LOKAL (bukan UTC) — toISOString bisa mundur sehari di zona WIB/WITA
const localDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* ─── Page ───────────────────────────────────────── */
export default function LogAktivitasPage() {
  const [data, setData] = useState<LogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [filterAksi, setFilterAksi] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterDari, setFilterDari] = useState("");
  const [filterSampai, setFilterSampai] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [range, setRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const refModalHapus = useDialogModal(showDeleteModal, () => setShowDeleteModal(false), deleting);

  // Debounce input teks agar tidak fetch di setiap ketikan
  const [debUser, setDebUser] = useState("");
  const [debQ, setDebQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebUser(filterUser), 400); return () => clearTimeout(t); }, [filterUser]);
  useEffect(() => { const t = setTimeout(() => setDebQ(filterQ), 400); return () => clearTimeout(t); }, [filterQ]);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("perPage", String(perPage));
    if (filterAksi) params.set("aksi", filterAksi);
    if (debUser) params.set("user", debUser);
    if (filterDari) params.set("dari", filterDari);
    if (filterSampai) params.set("sampai", filterSampai);
    if (debQ) params.set("q", debQ);
    const res = await fetch(`/api/audit-log?${params}`);
    if (res.ok) setData((await res.json()) as LogResponse);
    setLoading(false);
  }, [page, perPage, filterAksi, debUser, filterDari, filterSampai, debQ]);

  useEffect(() => { const t = setTimeout(fetchLog, 0); return () => clearTimeout(t); }, [fetchLog]);

  function applyRange(r: "all" | "today" | "7d" | "30d") {
    setRange(r);
    setPage(1);
    if (r === "all") { setFilterDari(""); setFilterSampai(""); }
    else {
      setFilterSampai("");
      setFilterDari(r === "today" ? localDaysAgo(0) : r === "7d" ? localDaysAgo(7) : localDaysAgo(30));
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleAll() {
    if (!data) return;
    if (selected.size === data.data.length) setSelected(new Set());
    else setSelected(new Set(data.data.map((d) => d.id)));
  }
  async function handleDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    const res = await fetch("/api/audit-log", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selected] }) });
    setDeleting(false);
    setShowDeleteModal(false);
    if (res.ok) { setSelected(new Set()); fetchLog(); }
  }
  function handleFilterSubmit(e: React.FormEvent) { e.preventDefault(); setPage(1); fetchLog(); }
  function resetFilters() { setFilterAksi(""); setFilterUser(""); setFilterDari(""); setFilterSampai(""); setFilterQ(""); setRange("all"); setPage(1); }

  const rangeChips: { key: "all" | "today" | "7d" | "30d"; label: string }[] = [
    { key: "all", label: "Semua" }, { key: "today", label: "Hari ini" }, { key: "7d", label: "7 hari" }, { key: "30d", label: "30 hari" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="adm-chip" style={{ background: "linear-gradient(135deg,#8a9ec0,#5f7690)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        </div>
        <div className="flex-1">
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-amber)" }}>Administrasi</p>
          <h1 className="text-base font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Log Aktivitas</h1>
          <p className="text-xs" style={{ color: "var(--dt4)" }}>Jejak audit semua aksi pengguna · khusus Super Admin</p>
        </div>
        {selected.size > 0 && (
          <button onClick={() => setShowDeleteModal(true)} disabled={deleting} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "1px solid var(--tint-red-ln)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Hapus {selected.size} entri
          </button>
        )}
      </div>

      {/* Modal konfirmasi hapus log */}
      {showDeleteModal && (
        <div className="adm-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div ref={refModalHapus} role="alertdialog" aria-modal="true" aria-labelledby="judul-hapus-log" tabIndex={-1} className="adm-modal outline-none" style={{ maxWidth: "24rem" }} onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--tint-red-bg)" }}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--st-red)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </div>
              <h2 id="judul-hapus-log" className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>Hapus {selected.size} Entri Log?</h2>
              <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--dt4)" }}>
                Entri yang dihapus tidak bisa dikembalikan. Penghapusan ini sendiri akan tercatat di log.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowDeleteModal(false)} disabled={deleting} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Batal</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: "var(--red-solid)" }}>
                  {deleting ? "Menghapus…" : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick range + filter bar */}
      <form onSubmit={handleFilterSubmit} className="bg-white rounded-2xl p-4 space-y-3" style={{ border: "0.5px solid var(--ln1)" }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {rangeChips.map((c) => (
            <button key={c.key} type="button" onClick={() => applyRange(c.key)} className="text-xs font-medium px-3 py-1.5 rounded-lg transition"
              style={{ background: range === c.key ? "var(--navy-solid)" : "var(--sub)", color: range === c.key ? "#fff" : "var(--dt3)", border: "0.5px solid " + (range === c.key ? "var(--navy-solid)" : "var(--ln1)") }}>
              {c.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px" style={{ background: "var(--ln1)" }} />
          <span className="text-xs" style={{ color: "var(--dt5)" }}>{loading ? "Memuat…" : `${data?.total ?? 0} entri`}</span>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-35">
            <label htmlFor="filter-aksi-log" className="text-xs font-medium" style={{ color: "var(--dt4)" }}>Jenis Aktivitas</label>
            <select id="filter-aksi-log" value={filterAksi} onChange={(e) => setFilterAksi(e.target.value)} className="adm-input" style={{ padding: "8px 10px" }}>
              <option value="">Semua</option>
              {AKSI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-30">
            <label htmlFor="filter-pengguna-log" className="text-xs font-medium" style={{ color: "var(--dt4)" }}>Pengguna</label>
            <input id="filter-pengguna-log" value={filterUser} onChange={(e) => setFilterUser(e.target.value)} placeholder="Nama pengguna…" className="adm-input" style={{ padding: "8px 10px" }} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-dari-log" className="text-xs font-medium" style={{ color: "var(--dt4)" }}>Dari</label>
            <input id="filter-dari-log" type="date" value={filterDari} onChange={(e) => { setFilterDari(e.target.value); setRange("all"); }} className="adm-input" style={{ padding: "8px 10px" }} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-sampai-log" className="text-xs font-medium" style={{ color: "var(--dt4)" }}>Sampai</label>
            <input id="filter-sampai-log" type="date" value={filterSampai} onChange={(e) => { setFilterSampai(e.target.value); setRange("all"); }} className="adm-input" style={{ padding: "8px 10px" }} />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-40">
            <label htmlFor="filter-cari-log" className="text-xs font-medium" style={{ color: "var(--dt4)" }}>Cari</label>
            <input id="filter-cari-log" value={filterQ} onChange={(e) => setFilterQ(e.target.value)} placeholder="Nama / detail aksi…" className="adm-input" style={{ padding: "8px 10px" }} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ background: "var(--navy-solid)", color: "#fff" }}>Terapkan</button>
            <button type="button" onClick={resetFilters} className="px-4 py-2 rounded-xl text-xs font-medium" style={{ background: "var(--sub)", color: "var(--dt3)", border: "0.5px solid var(--ln0)" }}>Atur Ulang</button>
          </div>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16"><p className="text-xs" style={{ color: "var(--dt5)" }}>Memuat log aktivitas…</p></div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--dt6)" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>Tidak ada log yang sesuai filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto tbl-scroll">
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}>
                  <th className="px-4 py-3 text-left"><input type="checkbox" aria-label="Pilih semua entri di halaman ini" checked={selected.size === data.data.length && data.data.length > 0} onChange={toggleAll} className="rounded" /></th>
                  {["Waktu", "Pengguna", "Aksi", "Detail", "Sasaran", "IP"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: "var(--dt4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((item, i) => {
                  const cfg = AKSI_CONFIG[item.aksi] ?? { label: item.aksi, bg: "var(--sub)", color: "var(--dt3)", icon: I.doc };
                  const isSelected = selected.has(item.id);
                  return (
                    <tr key={item.id} style={{ borderBottom: i < data.data.length - 1 ? "0.5px solid var(--ln2)" : "none", background: isSelected ? "var(--tint-blue-bg)" : "transparent" }}>
                      <td className="px-4 py-3"><input type="checkbox" aria-label={`Pilih entri ${cfg.label} oleh ${item.user}`} checked={isSelected} onChange={() => toggleSelect(item.id)} className="rounded" /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{new Date(item.waktu).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>{new Date(item.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} · {timeAgo(item.waktu)}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)", fontSize: "9px" }}>
                            {item.user === "Sistem" ? "SYS" : item.user.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <span className="text-xs" style={{ color: "var(--dtn)" }}>{item.user}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap" style={{ background: cfg.bg, color: cfg.color }}>
                          <span style={{ display: "flex" }}>{cfg.icon}</span>{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--dtn)", maxWidth: "320px" }}><p className="leading-relaxed">{item.detail}</p></td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--dt4)" }}>{item.targetNama ?? "-"}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--dt5)", fontFamily: "monospace" }}>{item.ipAddress ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "0.5px solid var(--ln2)" }}>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>Hal. {data.page} dari {data.totalPages} · {data.total} entri total</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 transition" style={{ background: "var(--sub)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}><span aria-hidden="true">←</span> Sebelumnya</button>
              <span className="text-xs font-medium" style={{ color: "var(--dt3)" }}>{page} / {data.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-30 transition" style={{ background: "var(--sub)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>Selanjutnya <span aria-hidden="true">→</span></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
