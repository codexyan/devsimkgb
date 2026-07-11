"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { canManageHukdis } from "@/lib/auth";

/* ─────────────────────────────────────────────────────────────────────────
   Master Regulasi/Peraturan (untuk modul Hukdis). Mengelola siklus hidup
   regulasi: berlaku → dicabut sebagian → dicabut, rantai pergantian, dan
   pasal yang masih berlaku. Dipilih saat input hukdis lalu di-snapshot.
   ───────────────────────────────────────────────────────────────────────── */

interface Regulasi {
  id: string; nomor: string; tahun: string; tentang: string;
  status: string; pasalBerlaku: string | null;
  digantikanOlehId: string | null;
  digantikanOleh: { id: string; nomor: string; tahun: string } | null;
  catatan: string | null;
}

const STATUS: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  berlaku:          { label: "Berlaku",          bg: "var(--tint-green-bg)", color: "var(--st-green)", dot: "#22c55e" },
  dicabut_sebagian: { label: "Dicabut sebagian", bg: "var(--tint-amber-bg)", color: "var(--st-amber2)", dot: "#f59e0b" },
  dicabut:          { label: "Dicabut",          bg: "var(--tint-red-bg)",   color: "var(--st-red)",   dot: "#ef4444" },
};
const FORM_INIT = { nomor: "", tahun: "", tentang: "", status: "berlaku", pasalBerlaku: "", digantikanOlehId: "", catatan: "" };
const regLabel = (r: { nomor: string; tahun: string }) => `${r.nomor} Tahun ${r.tahun}`;

export default function RegulasiPage() {
  const role = useRole();
  const allowed = canManageHukdis(role);

  const [list, setList] = useState<Regulasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Regulasi | null>(null);
  const [form, setForm] = useState(FORM_INIT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [delTarget, setDelTarget] = useState<Regulasi | null>(null);
  const [deleting, setDeleting] = useState(false);

  function fetchData() {
    setLoading(true);
    fetch("/api/hukdis/regulasi").then((r) => r.json() as any).then((d) => { if (Array.isArray(d)) setList(d); }).finally(() => setLoading(false));
  }
  useEffect(() => { if (allowed) fetchData(); else setLoading(false); }, [allowed]);

  function openAdd() { setEditing(null); setForm(FORM_INIT); setError(""); setShowForm(true); }
  function openEdit(r: Regulasi) {
    setEditing(r);
    setForm({ nomor: r.nomor, tahun: r.tahun, tentang: r.tentang, status: r.status, pasalBerlaku: r.pasalBerlaku ?? "", digantikanOlehId: r.digantikanOlehId ?? "", catatan: r.catatan ?? "" });
    setError(""); setShowForm(true);
  }

  async function handleSave() {
    setError("");
    if (!form.nomor.trim() || !form.tahun.trim() || !form.tentang.trim()) { setError("Nomor, tahun, dan tentang wajib diisi"); return; }
    setSaving(true);
    try {
      const url = editing ? `/api/hukdis/regulasi/${editing.id}` : "/api/hukdis/regulasi";
      const res = await fetch(url, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json() as any;
      if (!res.ok) { setError(d.error || "Gagal menyimpan"); return; }
      setShowForm(false); fetchData();
    } catch { setError("Gagal menghubungi server"); }
    finally { setSaving(false); }
  }
  async function handleDelete() {
    if (!delTarget) return;
    setDeleting(true);
    try { const res = await fetch(`/api/hukdis/regulasi/${delTarget.id}`, { method: "DELETE" }); if (res.ok) { setDelTarget(null); fetchData(); } }
    finally { setDeleting(false); }
  }

  // Opsi "digantikan oleh": regulasi lain (kecuali diri sendiri)
  const opsiPengganti = useMemo(() => list.filter((r) => r.id !== editing?.id), [list, editing]);
  const counts = useMemo(() => ({
    berlaku: list.filter((r) => r.status === "berlaku").length,
    dicabut_sebagian: list.filter((r) => r.status === "dicabut_sebagian").length,
    dicabut: list.filter((r) => r.status === "dicabut").length,
  }), [list]);

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>Akses ditolak</p>
        <p className="text-xs" style={{ color: "var(--dt4)" }}>Halaman ini hanya untuk SDM Hukdis dan Super Admin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/hukdis" className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--sub)", color: "var(--dt3)", border: "0.5px solid var(--ln1)" }} title="Kembali ke Hukdis">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div className="adm-chip" style={{ background: "linear-gradient(135deg,#8a9ec0,#5f7690)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-red)" }}>SDM Hukdis</p>
          <h1 className="text-base font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Regulasi / Dasar Hukum</h1>
          <p className="text-xs" style={{ color: "var(--dt4)" }}>Kelola peraturan &amp; siklus hidupnya · dipakai saat input hukdis</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition shrink-0" style={{ background: "var(--navy-solid)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Tambah Regulasi
        </button>
      </div>

      {/* Info non-retroaktif */}
      <div className="rounded-xl px-3 py-2 flex items-start gap-2" style={{ background: "var(--tint-blue-bg)", border: "1px solid var(--tint-blue-ln)" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--st-blue)" strokeWidth="2" style={{ marginTop: "1px", flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <p className="text-xs" style={{ color: "var(--st-blue)", fontSize: "10.5px", lineHeight: 1.5 }}>
          Menandai regulasi <strong>dicabut</strong> atau <strong>dicabut sebagian</strong> tidak mengubah catatan hukdis yang sudah ada (patokan tanggal SK). Hanya input baru yang mengikuti daftar regulasi berlaku.
        </p>
      </div>

      {/* Ringkasan status */}
      {!loading && list.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(STATUS).map(([k, s]) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.dot }} />
              {s.label}: {counts[k as keyof typeof counts]}
            </span>
          ))}
        </div>
      )}

      {/* List — grid kartu (memanfaatkan lebar layar) */}
      {loading ? (
        <div className="bg-white rounded-2xl flex items-center justify-center py-16" style={{ border: "0.5px solid var(--ln1)" }}><p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat regulasi…</p></div>
      ) : list.length === 0 ? (
        <div className="bg-white rounded-2xl flex flex-col items-center justify-center py-16 gap-3" style={{ border: "0.5px solid var(--ln1)" }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--dt6)" strokeWidth="1.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <p className="text-xs" style={{ color: "var(--dt5)" }}>Belum ada regulasi terdaftar</p>
          <button onClick={openAdd} className="text-xs font-semibold px-4 py-2 rounded-xl text-white" style={{ background: "var(--navy-solid)" }}>+ Tambah Regulasi Pertama</button>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {list.map((r) => {
            const st = STATUS[r.status] ?? STATUS.berlaku;
            return (
              <div key={r.id} className="bg-white rounded-2xl p-4 flex flex-col" style={{ border: "0.5px solid var(--ln1)", position: "relative", overflow: "hidden" }}>
                <span aria-hidden style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "3px", background: st.dot }} />
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-tight" style={{ color: "var(--dtn)" }}>{regLabel(r)}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--dt3)" }}>{r.tentang}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(r)} title="Edit" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => setDelTarget(r)} title="Hapus" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium" style={{ background: st.bg, color: st.color, fontSize: "10px" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: st.dot }} />{st.label}
                  </span>
                </div>
                {(r.status === "dicabut_sebagian" && r.pasalBerlaku) || r.digantikanOleh || r.catatan ? (
                  <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: "0.5px solid var(--ln2)" }}>
                    {r.status === "dicabut_sebagian" && r.pasalBerlaku && (
                      <div className="flex items-start gap-1.5">
                        <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--st-amber2)", marginTop: "1px", flexShrink: 0 }}>Pasal berlaku</span>
                        <span className="text-xs" style={{ color: "var(--dt3)", fontSize: "10.5px" }}>{r.pasalBerlaku}</span>
                      </div>
                    )}
                    {r.digantikanOleh && (
                      <p className="text-xs inline-flex items-center gap-1" style={{ color: "var(--dt5)", fontSize: "10.5px" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                        Digantikan oleh {regLabel(r.digantikanOleh)}
                      </p>
                    )}
                    {r.catatan && <p className="text-xs" style={{ color: "var(--dt5)", fontSize: "10.5px" }}>{r.catatan}</p>}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="adm-overlay" onClick={() => !saving && setShowForm(false)}>
          <div className="adm-modal" style={{ maxWidth: "28rem", maxHeight: "92vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 shrink-0" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
              <div className="flex-1"><h2 className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>{editing ? "Ubah Regulasi" : "Tambah Regulasi"}</h2></div>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--ln2)", color: "var(--dt3)" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="p-5 space-y-3.5 overflow-y-auto">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="col-span-2"><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Nomor</label><input value={form.nomor} onChange={(e) => setForm((f) => ({ ...f, nomor: e.target.value }))} placeholder="PP Nomor 94" className="adm-input" /></div>
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Tahun</label><input value={form.tahun} onChange={(e) => setForm((f) => ({ ...f, tahun: e.target.value.replace(/\D/g, "") }))} placeholder="2021" className="adm-input" /></div>
              </div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Tentang</label><input value={form.tentang} onChange={(e) => setForm((f) => ({ ...f, tentang: e.target.value }))} placeholder="Disiplin Pegawai Negeri Sipil" className="adm-input" /></div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Status</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(STATUS).map(([k, s]) => {
                    const active = form.status === k;
                    return (
                      <button key={k} type="button" onClick={() => setForm((f) => ({ ...f, status: k }))} className="px-2 py-2 rounded-xl text-xs font-medium transition"
                        style={{ border: active ? `1.5px solid ${s.dot}` : "1px solid var(--ln1)", background: active ? s.bg : "var(--card)", color: active ? s.color : "var(--dt4)" }}>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {form.status === "dicabut_sebagian" && (
                <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Pasal yang masih berlaku</label><input value={form.pasalBerlaku} onChange={(e) => setForm((f) => ({ ...f, pasalBerlaku: e.target.value }))} placeholder="mis. Pasal 3, Pasal 5 ayat (2)" className="adm-input" /></div>
              )}
              {form.status !== "berlaku" && opsiPengganti.length > 0 && (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Digantikan oleh <span style={{ color: "var(--dt5)" }}>(opsional)</span></label>
                  <select value={form.digantikanOlehId} onChange={(e) => setForm((f) => ({ ...f, digantikanOlehId: e.target.value }))} className="adm-input">
                    <option value="">— tidak ditentukan —</option>
                    {opsiPengganti.map((r) => <option key={r.id} value={r.id}>{regLabel(r)} — {r.tentang}</option>)}
                  </select>
                </div>
              )}
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Catatan <span style={{ color: "var(--dt5)" }}>(opsional)</span></label><textarea rows={2} value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} className="adm-input resize-none" /></div>
              {error && <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="var(--st-red)"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg><p className="text-xs" style={{ color: "var(--st-red)" }}>{error}</p></div>}
            </div>
            <div className="flex gap-2 px-5 py-4 shrink-0" style={{ borderTop: "0.5px solid var(--ln2)" }}>
              <button onClick={() => setShowForm(false)} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Batal</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: "var(--navy-solid)" }}>{saving ? "Menyimpan…" : "Simpan"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus */}
      {delTarget && (
        <div className="adm-overlay" onClick={() => !deleting && setDelTarget(null)}>
          <div className="adm-modal" style={{ maxWidth: "24rem" }} onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>Hapus Regulasi?</h2>
              <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--dt4)" }}>Hapus <strong style={{ color: "var(--dtn)" }}>{regLabel(delTarget)}</strong> dari daftar? Catatan hukdis yang sudah memakainya tetap aman (dasar hukum tersimpan sebagai teks).</p>
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
