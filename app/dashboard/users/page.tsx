"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABEL } from "@/lib/auth";
import { useDialogModal } from "@/app/dashboard/components/useDialogModal";

interface User {
  id: string;
  nip: string;
  nama: string;
  role: string;
  createdAt: string;
}

interface ReassignCounts {
  kgbCount: number;
  suratCount: number;
  serahTerimaCount: number;
  hukdisCount: number;
}

interface ProfileRequest {
  id: string;
  nama: string | null;
  jabatan: string | null;
  email: string | null;
  status: string;
  createdAt: string;
  user: { id: string; nip: string; nama: string; jabatan: string | null; email: string | null; role: string };
}

/* Konfigurasi warna & ikon per role */
const ROLE_ICON: Record<string, React.ReactNode> = {
  superAdminCore: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"><path d="M12 2l2.4 5.4 5.6.6-4.2 3.9 1.2 5.6L12 14.8 7 17.5l1.2-5.6L4 8l5.6-.6z"/></svg>,
  sdm_kgb:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  sdm_hukdis:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  keuangan:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
};
const ROLE_CFG: Record<string, { label: string; bg: string; color: string; grad: string }> = {
  superAdminCore: { label: "Super Admin", bg: "var(--tint-amber-bg)",  color: "var(--st-amber)",  grad: "linear-gradient(135deg,#d9a53a,var(--amber-solid))" },
  sdm_kgb:        { label: "SDM KGB",     bg: "var(--tint-navy)",       color: "var(--dtn)",       grad: "linear-gradient(135deg,#2d5d94,var(--navy-solid))" },
  sdm_hukdis:     { label: "SDM Hukdis",  bg: "var(--tint-red-bg)",     color: "var(--st-red)",    grad: "linear-gradient(135deg,#e35d5d,var(--red-solid))" },
  keuangan:       { label: "Keuangan",    bg: "var(--tint-violet-bg)",  color: "var(--st-violet)", grad: "linear-gradient(135deg,#9b7ae0,var(--violet-solid))" },
};
const roleCfg = (r: string) => ROLE_CFG[r] ?? { label: ROLE_LABEL[r] ?? r, bg: "var(--sub)", color: "var(--dt3)", grad: "linear-gradient(135deg,#8aa0bb,#5f7690)" };
const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export default function UsersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "requests">("users");

  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [requests, setRequests] = useState<ProfileRequest[]>([]);
  const [loadingReq, setLoadingReq] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [showTambah, setShowTambah] = useState(false);
  const [showReset, setShowReset] = useState<User | null>(null);
  const [showHapus, setShowHapus] = useState<User | null>(null);
  const [showTolak, setShowTolak] = useState<ProfileRequest | null>(null);
  const [reassignCounts, setReassignCounts] = useState<ReassignCounts | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [alasanTolak, setAlasanTolak] = useState("");

  const [formTambah, setFormTambah] = useState({ nip: "", nama: "", role: "sdm_kgb", password: "" });
  const [formReset, setFormReset] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwdReset, setShowPwdReset] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function tutupHapus() {
    setShowHapus(null); setReassignCounts(null); setReassignTo(""); setError("");
  }

  // Escape menutup modal teratas, kecuali selama permintaan masih diproses
  const refTambah = useDialogModal(showTambah, () => setShowTambah(false), submitting);
  const refReset = useDialogModal(!!showReset, () => setShowReset(null), submitting);
  const refTolak = useDialogModal(!!showTolak, () => setShowTolak(null), submitting);
  const refHapus = useDialogModal(!!showHapus, tutupHapus, submitting);

  async function fetchUsers() {
    const res = await fetch("/api/users");
    if (res.status === 403) { router.push("/dashboard"); return; }
    const d: unknown = await res.json().catch(() => []);
    setUsers(Array.isArray(d) ? (d as User[]) : []);
    setLoadingUsers(false);
  }
  async function fetchRequests() {
    const res = await fetch("/api/admin/profile-requests");
    const d: unknown = res.ok ? await res.json().catch(() => []) : [];
    if (Array.isArray(d)) setRequests(d as ProfileRequest[]);
    setLoadingReq(false);
  }

  useEffect(() => {
    const t = setTimeout(() => { fetchUsers(); fetchRequests(); }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTambah() {
    setError("");
    // Validasi klien selaras dengan aturan login (NIP 18 digit, pwd >= 6)
    if (!/^\d{18}$/.test(formTambah.nip.trim())) { setError("NIP harus tepat 18 digit angka"); return; }
    if (!formTambah.nama.trim()) { setError("Nama lengkap wajib diisi"); return; }
    if (formTambah.password.length < 6) { setError("Password minimal 6 karakter"); return; }
    setSubmitting(true);
    const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formTambah) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Gagal menambahkan pengguna"); return; }
    setSuccess("Pengguna berhasil ditambahkan.");
    setShowTambah(false);
    setFormTambah({ nip: "", nama: "", role: "sdm_kgb", password: "" });
    fetchUsers();
    setTimeout(() => setSuccess(""), 3000);
  }
  async function handleReset() {
    if (!showReset) return;
    setError(""); setSubmitting(true);
    const res = await fetch(`/api/users/${showReset.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: formReset }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Gagal mengatur ulang password"); return; }
    setSuccess(`Password ${showReset.nama} berhasil diatur ulang.`);
    setShowReset(null); setFormReset("");
    setTimeout(() => setSuccess(""), 3000);
  }
  async function handleHapus() {
    if (!showHapus) return;
    setError(""); setSubmitting(true);
    const body: Record<string, string> = {};
    if (reassignTo) body.reassignTo = reassignTo;
    const res = await fetch(`/api/users/${showHapus.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string; needsReassign?: boolean; counts?: ReassignCounts; reassigned?: number;
    };
    setSubmitting(false);
    if (res.status === 409 && data.needsReassign && data.counts) { setReassignCounts(data.counts); return; }
    if (!res.ok) { setError(data.error ?? "Gagal menghapus pengguna"); return; }
    setSuccess(data.reassigned ? `Pengguna ${showHapus.nama} dihapus. ${data.reassigned} data dialihkan.` : `Pengguna ${showHapus.nama} berhasil dihapus.`);
    setShowHapus(null); setReassignCounts(null); setReassignTo("");
    fetchUsers();
    setTimeout(() => setSuccess(""), 4000);
  }
  async function handleApprove(req: ProfileRequest) {
    setSubmitting(true);
    const res = await fetch(`/api/admin/profile-requests/${req.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) });
    setSubmitting(false);
    if (res.ok) { setSuccess(`Perubahan profil ${req.user.nama} disetujui.`); fetchRequests(); setTimeout(() => setSuccess(""), 3000); }
  }
  async function handleTolak() {
    if (!showTolak) return;
    setSubmitting(true);
    const res = await fetch(`/api/admin/profile-requests/${showTolak.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reject", alasanTolak }) });
    setSubmitting(false);
    if (res.ok) { setSuccess(`Permintaan profil ${showTolak.user.nama} ditolak.`); setShowTolak(null); setAlasanTolak(""); fetchRequests(); setTimeout(() => setSuccess(""), 3000); }
  }

  const roleCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of users) c[u.role] = (c[u.role] ?? 0) + 1;
    return c;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) =>
      (!roleFilter || u.role === roleFilter) &&
      (!q || u.nama.toLowerCase().includes(q) || u.nip.includes(q)),
    );
  }, [users, search, roleFilter]);

  const inputClass = "adm-input";
  const usersLain = showHapus ? users.filter((u) => u.id !== showHapus.id) : [];

  const STAT_ORDER = ["superAdminCore", "sdm_kgb", "sdm_hukdis", "keuangan"];

  return (
    <div className="space-y-4">
      <style>{`.u-row { transition: background .12s; } .u-row:hover { background: var(--sub); }`}</style>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="adm-chip" style={{ background: "linear-gradient(135deg,#2d5d94,var(--navy-solid))" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div className="flex-1">
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-amber)" }}>Administrasi</p>
          <h1 className="text-base font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Pengguna</h1>
          <p className="text-xs" style={{ color: "var(--dt4)" }}>Buat dan kelola akun, tinjau permintaan perubahan profil</p>
        </div>
        {tab === "users" && (
          <button onClick={() => { setShowTambah(true); setError(""); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition shrink-0" style={{ background: "var(--navy-solid)" }}>
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Tambah Pengguna
          </button>
        )}
      </div>

      {/* Stat per role (klik = filter) */}
      {tab === "users" && !loadingUsers && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {STAT_ORDER.map((r) => {
            const cfg = roleCfg(r);
            const active = roleFilter === r;
            return (
              <button key={r} onClick={() => setRoleFilter(active ? "" : r)} aria-pressed={active} className={`adm-stat clickable ${active ? "active" : ""}`} style={{ textAlign: "left" }}>
                <span className="adm-stat-strip" style={{ background: cfg.grad }} />
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: cfg.grad }}>
                    {ROLE_ICON[r] ?? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                  </div>
                  <div>
                    <p className="font-bold leading-none" style={{ fontSize: "20px", color: "var(--dtn)" }}>{roleCounts[r] ?? 0}</p>
                    <p style={{ fontSize: "10.5px", color: "var(--dt4)", marginTop: "2px" }}>{cfg.label}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--ln2)" }}>
        {([{ key: "users", label: "Akun Pengguna" }, { key: "requests", label: "Permintaan Profil", badge: requests.length }] as { key: "users" | "requests"; label: string; badge?: number }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} aria-pressed={tab === t.key} className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition"
            style={{ background: tab === t.key ? "var(--card)" : "transparent", color: tab === t.key ? "var(--dtn)" : "var(--dt4)", boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.07)" : "none" }}>
            {t.label}
            {!!t.badge && <span className="min-w-4 h-4 px-1 rounded-full text-white flex items-center justify-center font-bold" style={{ background: "var(--red-solid)", fontSize: "9px" }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {success && (
        <div role="status" className="px-4 py-3 rounded-xl text-xs font-medium flex items-center gap-2" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "1px solid var(--tint-green-ln)" }}>
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {success}
        </div>
      )}

      {/* -- Tab: Akun -- */}
      {tab === "users" && (
        <div className="space-y-3">
          {/* Search + filter aktif */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-52">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--dt5)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cari pengguna" placeholder="Cari nama atau NIP…" className="adm-input" style={{ paddingLeft: "34px" }} />
            </div>
            {roleFilter && (
              <button onClick={() => setRoleFilter("")} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl transition" style={{ background: roleCfg(roleFilter).bg, color: roleCfg(roleFilter).color }}>
                {roleCfg(roleFilter).label}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-16"><p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat data…</p></div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--dt6)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                <p className="text-xs" style={{ color: "var(--dt5)" }}>{users.length === 0 ? "Belum ada akun pengguna" : "Tidak ada pengguna yang cocok"}</p>
                {users.length === 0 ? (
                  <button onClick={() => { setShowTambah(true); setError(""); }} className="text-xs font-semibold px-4 py-2 rounded-xl text-white transition" style={{ background: "var(--navy-solid)" }}>
                    Tambah Pengguna Pertama
                  </button>
                ) : (
                  <button onClick={() => { setSearch(""); setRoleFilter(""); }} className="text-xs px-3 py-1.5 rounded-lg transition" style={{ color: "var(--dt3)", border: "0.5px solid var(--ln1)" }}>
                    Hapus filter
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto tbl-scroll">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}>
                      {["Nama", "NIP", "Peran", "Dibuat"].map((h) => (
                        <th key={h} className="text-left px-5 py-3 text-xs font-semibold" style={{ color: "var(--dt4)" }}>{h}</th>
                      ))}
                      <th className="px-5 py-3"><span className="sr-only">Aksi</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, i) => {
                      const cfg = roleCfg(user.role);
                      return (
                        <tr key={user.id} className="u-row" style={{ borderBottom: i < filteredUsers.length - 1 ? "0.5px solid var(--ln2)" : "none" }}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: cfg.grad, color: "#fff" }}>{initials(user.nama)}</div>
                              <span className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{user.nama}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs" style={{ color: "var(--dt3)", fontFamily: "monospace" }}>{user.nip}</td>
                          <td className="px-5 py-3">
                            <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          </td>
                          <td className="px-5 py-3 text-xs" style={{ color: "var(--dt4)" }}>{new Date(user.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => { setShowReset(user); setFormReset(""); setError(""); }} title="Atur ulang password" aria-label={`Atur ulang password ${user.nama}`} className="w-8 h-8 rounded-lg flex items-center justify-center transition" style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
                              </button>
                              <button onClick={() => { setShowHapus(user); setReassignCounts(null); setReassignTo(""); setError(""); }} title="Hapus pengguna" aria-label={`Hapus pengguna ${user.nama}`} className="w-8 h-8 rounded-lg flex items-center justify-center transition" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
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
        </div>
      )}

      {/* -- Tab: Permintaan Profil -- */}
      {tab === "requests" && (
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
          {loadingReq ? (
            <div className="flex items-center justify-center py-16"><p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat permintaan…</p></div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--dt6)" strokeWidth="1.5"><polyline points="20 6 9 17 4 12"/></svg>
              <p className="text-xs" style={{ color: "var(--dt5)" }}>Tidak ada permintaan perubahan profil</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--ln2)" }}>
              {requests.map((req) => (
                <div key={req.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: roleCfg(req.user.role).grad, color: "#fff" }}>{initials(req.user.nama)}</div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{req.user.nama}</p>
                      <p className="text-xs" style={{ color: "var(--dt4)" }}>{req.user.nip}</p>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-semibold mb-1" style={{ color: "var(--dt3)" }}>Perubahan diminta:</p>
                    {req.nama && req.nama !== req.user.nama && (
                      <div className="flex items-center gap-2 text-xs"><span style={{ color: "var(--dt4)" }}>Nama:</span><span className="line-through" style={{ color: "var(--dt6)" }}>{req.user.nama}</span><span aria-hidden="true">→</span><span className="sr-only">menjadi</span><span className="font-medium" style={{ color: "var(--dtn)" }}>{req.nama}</span></div>
                    )}
                    {req.jabatan !== null && req.jabatan !== req.user.jabatan && (
                      <div className="flex items-center gap-2 text-xs"><span style={{ color: "var(--dt4)" }}>Jabatan:</span><span className="line-through" style={{ color: "var(--dt6)" }}>{req.user.jabatan || "-"}</span><span aria-hidden="true">→</span><span className="sr-only">menjadi</span><span className="font-medium" style={{ color: "var(--dtn)" }}>{req.jabatan || "-"}</span></div>
                    )}
                    {req.email !== null && req.email !== req.user.email && (
                      <div className="flex items-center gap-2 text-xs"><span style={{ color: "var(--dt4)" }}>Email:</span><span className="line-through" style={{ color: "var(--dt6)" }}>{req.user.email || "-"}</span><span aria-hidden="true">→</span><span className="sr-only">menjadi</span><span className="font-medium" style={{ color: "var(--dtn)" }}>{req.email || "-"}</span></div>
                    )}
                    <p className="text-xs mt-1" style={{ color: "var(--dt5)" }}>Diajukan {new Date(req.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => handleApprove(req)} disabled={submitting} className="text-xs px-4 py-2 rounded-xl font-semibold transition disabled:opacity-50" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "0.5px solid var(--tint-green-ln)" }}>Setujui</button>
                    <button onClick={() => { setShowTolak(req); setAlasanTolak(""); setError(""); }} className="text-xs px-4 py-2 rounded-xl font-semibold transition" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }}>Tolak</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Tambah Pengguna */}
      {showTambah && (
        <div className="adm-overlay" onClick={() => !submitting && setShowTambah(false)}>
          <div ref={refTambah} role="dialog" aria-modal="true" aria-labelledby="judul-tambah-pengguna" tabIndex={-1} className="adm-modal outline-none" style={{ maxWidth: "26rem" }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#2d5d94,var(--navy-solid))" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 id="judul-tambah-pengguna" className="text-sm font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Tambah Pengguna Baru</h2>
                <p className="text-xs" style={{ color: "var(--dt4)" }}>Akun masuk untuk tim pengelola SIM-KGB</p>
              </div>
              <button onClick={() => setShowTambah(false)} disabled={submitting} aria-label="Tutup" className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--ln2)", color: "var(--dt3)" }}>
                <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-3.5">
              <div>
                <label htmlFor="nip-pengguna-baru" className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>NIP</label>
                <input
                  id="nip-pengguna-baru" aria-describedby="nip-pengguna-baru-hitung"
                  autoFocus type="text" inputMode="numeric" maxLength={18}
                  className={inputClass} placeholder="18 digit angka"
                  value={formTambah.nip}
                  onChange={(e) => setFormTambah((p) => ({ ...p, nip: e.target.value.replace(/\D/g, "") }))}
                />
                <p id="nip-pengguna-baru-hitung" className="text-xs mt-1" style={{ color: formTambah.nip.length === 18 ? "var(--st-green)" : "var(--dt5)", fontSize: "10px" }}>
                  {formTambah.nip.length}/18 digit{formTambah.nip.length === 18 ? " (lengkap)" : ""}
                </p>
              </div>
              <div>
                <label htmlFor="nama-pengguna-baru" className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Nama Lengkap</label>
                <input id="nama-pengguna-baru" type="text" className={inputClass} placeholder="Nama beserta gelar" value={formTambah.nama} onChange={(e) => setFormTambah((p) => ({ ...p, nama: e.target.value }))} />
              </div>
              <div>
                <label htmlFor="password-pengguna-baru" className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Password</label>
                <div className="relative">
                  <input id="password-pengguna-baru" type={showPwd ? "text" : "password"} className={inputClass} style={{ paddingRight: "38px" }} placeholder="Minimal 6 karakter" value={formTambah.password} onChange={(e) => setFormTambah((p) => ({ ...p, password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Sembunyikan password" : "Tampilkan password"} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--dt5)", display: "flex" }}>
                    {showPwd
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </div>
              </div>
              <div>
                <p id="peran-pengguna-baru" className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Peran</p>
                <div role="group" aria-labelledby="peran-pengguna-baru" className="grid grid-cols-2 gap-2">
                  {(["sdm_kgb", "sdm_hukdis", "keuangan", "superAdminCore"] as const).map((r) => {
                    const cfg = roleCfg(r);
                    const active = formTambah.role === r;
                    return (
                      <button key={r} type="button" aria-pressed={active} onClick={() => setFormTambah((p) => ({ ...p, role: r }))}
                        className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition"
                        style={{
                          border: active ? "1.5px solid var(--accent)" : "1px solid var(--ln1)",
                          background: active ? "var(--accent-bg)" : "var(--card)",
                        }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: cfg.grad }}>
                          {ROLE_ICON[r]}
                        </div>
                        <span className="text-xs font-medium" style={{ color: active ? "var(--dtn)" : "var(--dt3)" }}>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {error && (
                <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--st-red)"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
                  <p className="text-xs" style={{ color: "var(--st-red)" }}>{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2 px-5 py-4" style={{ borderTop: "0.5px solid var(--ln2)" }}>
              <button onClick={() => setShowTambah(false)} disabled={submitting} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Batal</button>
              <button onClick={handleTambah} disabled={submitting} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: "var(--navy-solid)" }}>{submitting ? "Menyimpan…" : "Simpan Pengguna"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Atur Ulang Password */}
      {showReset && (
        <div className="adm-overlay" onClick={() => !submitting && setShowReset(null)}>
          <div ref={refReset} role="dialog" aria-modal="true" aria-labelledby="judul-atur-ulang-password" tabIndex={-1} className="adm-modal outline-none" style={{ maxWidth: "24rem" }} onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 id="judul-atur-ulang-password" className="text-sm font-semibold mb-3" style={{ color: "var(--dtn)" }}>Atur Ulang Password</h2>
              {/* Identitas user yang direset */}
              <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-4" style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: roleCfg(showReset.role).grad, color: "#fff" }}>{initials(showReset.nama)}</div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: "var(--dtn)" }}>{showReset.nama}</p>
                  <p className="text-xs" style={{ color: "var(--dt4)" }}>{showReset.nip} · {roleCfg(showReset.role).label}</p>
                </div>
              </div>
              <label htmlFor="password-atur-ulang" className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Password Baru</label>
              <div className="relative">
                <input id="password-atur-ulang" autoFocus type={showPwdReset ? "text" : "password"} className={inputClass} style={{ paddingRight: "38px" }} placeholder="Minimal 6 karakter" value={formReset} onChange={(e) => setFormReset(e.target.value)} />
                <button type="button" onClick={() => setShowPwdReset((v) => !v)} aria-label={showPwdReset ? "Sembunyikan password" : "Tampilkan password"} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--dt5)", display: "flex" }}>
                  {showPwdReset
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
              {error && <p className="text-xs mt-3" style={{ color: "var(--st-red)" }}>{error}</p>}
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowReset(null)} disabled={submitting} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Batal</button>
                <button onClick={handleReset} disabled={submitting} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: "var(--navy-solid)" }}>{submitting ? "Menyimpan…" : "Atur Ulang Password"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tolak Permintaan */}
      {showTolak && (
        <div className="adm-overlay" onClick={() => !submitting && setShowTolak(null)}>
          <div ref={refTolak} role="dialog" aria-modal="true" aria-labelledby="judul-tolak-permintaan" tabIndex={-1} className="adm-modal outline-none" style={{ maxWidth: "24rem" }} onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--tint-red-bg)" }}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--st-red)" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </div>
              <h2 id="judul-tolak-permintaan" className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>Tolak Permintaan?</h2>
              <p className="text-xs mb-4" style={{ color: "var(--dt4)" }}>Tolak perubahan profil dari <strong style={{ color: "var(--dtn)" }}>{showTolak.user.nama}</strong></p>
              <label htmlFor="alasan-tolak-profil" className="block text-xs font-medium mb-1" style={{ color: "var(--dt2)" }}>Alasan penolakan <span style={{ color: "var(--dt5)" }}>(opsional)</span></label>
              <textarea id="alasan-tolak-profil" rows={3} className="adm-input resize-none" placeholder="Contoh: Data tidak sesuai, harap lengkapi terlebih dahulu" value={alasanTolak} onChange={(e) => setAlasanTolak(e.target.value)} />
              {error && <p className="text-xs mt-3" style={{ color: "var(--st-red)" }}>{error}</p>}
              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowTolak(null)} disabled={submitting} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Batal</button>
                <button onClick={handleTolak} disabled={submitting} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: "var(--red-solid)" }}>{submitting ? "Memproses…" : "Ya, Tolak"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {showHapus && (
        <div className="adm-overlay" onClick={() => !submitting && tutupHapus()}>
          <div ref={refHapus} role="alertdialog" aria-modal="true" aria-labelledby="judul-hapus-pengguna" tabIndex={-1} className="adm-modal outline-none" style={{ maxWidth: "24rem" }} onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--tint-red-bg)" }}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--st-red)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </div>
              {!reassignCounts ? (
                <>
                  <h2 id="judul-hapus-pengguna" className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>Hapus Pengguna?</h2>
                  <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--dt4)" }}>Yakin ingin menghapus <strong style={{ color: "var(--dtn)" }}>{showHapus.nama}</strong>? Tindakan ini tidak bisa dibatalkan.</p>
                </>
              ) : (
                <>
                  <h2 id="judul-hapus-pengguna" className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>Alihkan Data Sebelum Menghapus</h2>
                  <p className="text-xs mb-3" style={{ color: "var(--dt4)" }}><strong style={{ color: "var(--dtn)" }}>{showHapus.nama}</strong> memiliki data terkait:</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {reassignCounts.kgbCount > 0 && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{reassignCounts.kgbCount} data KGB</span>}
                    {reassignCounts.suratCount > 0 && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{reassignCounts.suratCount} surat SK</span>}
                    {reassignCounts.serahTerimaCount > 0 && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{reassignCounts.serahTerimaCount} serah terima</span>}
                    {reassignCounts.hukdisCount > 0 && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{reassignCounts.hukdisCount} hukdis</span>}
                  </div>
                  <div className="mb-4">
                    <label htmlFor="alihkan-ke-pengguna" className="block text-xs font-medium mb-1" style={{ color: "var(--dt2)" }}>Alihkan data ke <span style={{ color: "var(--st-red)" }}>*</span></label>
                    <select id="alihkan-ke-pengguna" className={inputClass} value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                      <option value="">Pilih pengguna tujuan</option>
                      {usersLain.map((u) => <option key={u.id} value={u.id}>{u.nama} ({roleCfg(u.role).label})</option>)}
                    </select>
                    <p className="text-xs mt-1.5" style={{ color: "var(--dt4)" }}>Semua data akan dipindahkan ke pengguna yang dipilih.</p>
                  </div>
                </>
              )}
              {error && <p className="text-xs mb-3" style={{ color: "var(--st-red)" }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={tutupHapus} disabled={submitting} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Batal</button>
                <button onClick={handleHapus} disabled={submitting || (!!reassignCounts && !reassignTo)} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-40" style={{ background: "var(--red-solid)" }}>{submitting ? "Memproses…" : reassignCounts ? "Alihkan dan Hapus" : "Ya, Hapus"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
