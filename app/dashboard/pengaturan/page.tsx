"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { ROLES } from "@/lib/auth";
import PenandatanganManager from "./PenandatanganManager";

/* ─────────────────────────────────────────────────────────────────────────
   Pengaturan (super admin). Terbagi menjadi beberapa seksi:
   1. Penandatangan surat KGB   — definitif, Plh, Plt, Dirjen, dengan masa berlaku
   2. Dasar hukum KGB
   3. Notifikasi KGB            — ambang H-… peringatan
   4. Keamanan sesi             — durasi auto-logout
   5. Kontak                    — nomor WA admin (dipakai tombol lupa password)
   ───────────────────────────────────────────────────────────────────────── */

interface Konfigurasi {
  nomorPP: string; tahunPP: string;
  waAdmin: string; notifKgbH1: number; notifKgbH2: number; sesiTimeoutMenit: number;
  updatedAt?: string; updatedBy?: string | null;
}

const EMPTY: Konfigurasi = {
  nomorPP: "Nomor 5 Tahun 2024", tahunPP: "2024",
  waAdmin: "", notifKgbH1: 14, notifKgbH2: 7, sesiTimeoutMenit: 60,
};

/* Kartu seksi dengan chip ikon — siap masonry (break-inside-avoid) + anchor id */
function Section({ id, icon, grad, title, desc, children, badge }: {
  id?: string; icon: React.ReactNode; grad: string; title: string; desc: string;
  children: React.ReactNode; badge?: React.ReactNode;
}) {
  return (
    <div id={id} className="bg-white rounded-2xl p-4 space-y-3 break-inside-avoid mb-4" style={{ border: "0.5px solid var(--ln1)", scrollMarginTop: "12px" }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: grad }}>{icon}</div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{title}</h2>
          <p style={{ fontSize: "10.5px", color: "var(--dt4)" }}>{desc}</p>
        </div>
        {badge}
      </div>
      {children}
    </div>
  );
}
/* Badge status terisi/belum untuk kepala seksi */
function StatusBadge({ ok, okLabel = "Terisi", noLabel = "Belum diatur" }: { ok: boolean; okLabel?: string; noLabel?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: ok ? "var(--tint-green-bg)" : "var(--tint-amber-bg)", color: ok ? "var(--st-green)" : "var(--st-amber2)", fontSize: "10px" }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: ok ? "#22c55e" : "#f59e0b" }} />{ok ? okLabel : noLabel}
    </span>
  );
}
function Field({ label, hint, value, onChange, placeholder, type = "text", suffix }: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; suffix?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--dt2)" }}>{label}</label>
      <div className="relative">
        <input type={type} inputMode={type === "number" ? "numeric" : undefined} value={value}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="adm-input" style={suffix ? { paddingRight: "58px" } : undefined} />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--dt5)" }}>{suffix}</span>}
      </div>
      {hint && <p className="text-xs mt-1" style={{ color: "var(--dt5)", fontSize: "10px" }}>{hint}</p>}
    </div>
  );
}

export default function PengaturanPage() {
  const role = useRole();
  const [form, setForm]       = useState<Konfigurasi>(EMPTY);
  const [initial, setInitial] = useState<Konfigurasi | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [saved, setSaved]     = useState(false);
  const [adaPenandatangan, setAdaPenandatangan] = useState(false);

  useEffect(() => {
    fetch("/api/konfigurasi")
      .then((r) => r.json() as any)
      .catch(() => null)
      .then((cfg) => {
        if (cfg && cfg.id) {
          const c: Konfigurasi = {
            nomorPP: cfg.nomorPP ?? EMPTY.nomorPP, tahunPP: cfg.tahunPP ?? EMPTY.tahunPP,
            waAdmin: cfg.waAdmin ?? "", notifKgbH1: cfg.notifKgbH1 ?? 14,
            notifKgbH2: cfg.notifKgbH2 ?? 7, sesiTimeoutMenit: cfg.sesiTimeoutMenit ?? 60,
            updatedAt: cfg.updatedAt, updatedBy: cfg.updatedBy,
          };
          setForm(c); setInitial(c);
        } else setInitial(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const isDirty = !initial || (Object.keys(EMPTY) as (keyof Konfigurasi)[]).some((k) => form[k] !== initial[k]);
  const num = (v: string, fb: number) => { const n = parseInt(v.replace(/\D/g, "")); return Number.isFinite(n) ? n : fb; };

  async function handleSave() {
    setError(""); setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/konfigurasi", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomorPP: form.nomorPP.trim(), tahunPP: form.tahunPP.trim(),
          waAdmin: form.waAdmin.trim(), notifKgbH1: form.notifKgbH1,
          notifKgbH2: form.notifKgbH2, sesiTimeoutMenit: form.sesiTimeoutMenit,
        }),
      });
      const d = await res.json() as any;
      if (!res.ok) { setError(d.error || "Gagal menyimpan pengaturan"); return; }
      const c: Konfigurasi = {
        nomorPP: d.nomorPP, tahunPP: d.tahunPP,
        waAdmin: d.waAdmin ?? "", notifKgbH1: d.notifKgbH1, notifKgbH2: d.notifKgbH2,
        sesiTimeoutMenit: d.sesiTimeoutMenit, updatedAt: d.updatedAt, updatedBy: d.updatedBy,
      };
      setForm(c); setInitial(c); setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch { setError("Gagal menghubungi server"); }
    finally { setSaving(false); }
  }

  if (role !== ROLES.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-2">
        <p className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>Akses ditolak</p>
        <p className="text-xs" style={{ color: "var(--dt4)" }}>Halaman ini hanya untuk Super Admin.</p>
      </div>
    );
  }
  if (loading) return <div className="flex items-center justify-center py-24"><p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat pengaturan…</p></div>;

  // Status ringkas per seksi untuk rail navigasi + overview
  const nav = [
    { id: "pejabat",    label: "Penandatangan Surat",    ok: adaPenandatangan, grad: "linear-gradient(135deg,#2d5d94,var(--navy-solid))" },
    { id: "dokumen",    label: "Dasar Hukum KGB",        ok: !!form.nomorPP.trim(), grad: "linear-gradient(135deg,#17a37e,var(--green-solid))" },
    { id: "notifikasi", label: "Notifikasi KGB",         ok: true,           grad: "linear-gradient(135deg,#d99414,var(--amber-solid))" },
    { id: "keamanan",   label: "Keamanan Sesi",          ok: true,           grad: "linear-gradient(135deg,#e35d5d,var(--red-solid))" },
    { id: "kontak",     label: "Kontak WhatsApp",        ok: !!form.waAdmin.trim(), grad: "linear-gradient(135deg,#22c55e,#15803d)" },
  ];
  const okCount = nav.filter((n) => n.ok).length;

  return (
    <div className="pb-24 mx-auto" style={{ maxWidth: "1360px" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="adm-chip" style={{ background: "linear-gradient(135deg, #d9a53a, var(--amber-solid))" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </div>
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-amber)" }}>Administrasi</p>
          <h1 className="text-base font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Pengaturan</h1>
          <p className="text-xs" style={{ color: "var(--dt4)" }}>Konfigurasi dokumen, notifikasi, keamanan &amp; kontak sistem</p>
        </div>
      </div>

      {!initial && (
        <div className="rounded-xl px-3 py-2 flex items-center gap-2.5 mb-4" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--st-amber)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p className="text-xs" style={{ color: "var(--st-amber2)" }}>Dasar hukum, notifikasi, dan kontak belum pernah disimpan, sehingga nilai bawaan yang dipakai.</p>
        </div>
      )}

      {/* Dua panel: rail navigasi sticky + konten masonry */}
      <div className="flex gap-5 items-start">

        {/* ── Rail navigasi (desktop) ── */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-0 self-start">
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
            {/* Overview kelengkapan */}
            <div className="px-4 py-3.5" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Kelengkapan</p>
                <span className="text-xs font-bold" style={{ color: okCount === nav.length ? "var(--st-green)" : "var(--st-amber)" }}>{okCount}/{nav.length}</span>
              </div>
              <div style={{ height: "5px", borderRadius: "99px", background: "var(--ln1)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(okCount / nav.length) * 100}%`, background: okCount === nav.length ? "linear-gradient(90deg,#17a37e,var(--green-solid))" : "linear-gradient(90deg,#d99414,var(--amber-solid))", borderRadius: "99px", transition: "width .5s ease" }} />
              </div>
            </div>
            {/* Tautan seksi */}
            <nav className="p-2">
              {nav.map((n) => (
                <a key={n.id} href={`#${n.id}`} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition"
                  style={{ textDecoration: "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sub)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: n.grad }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#fff" }} />
                  </span>
                  <span className="text-xs flex-1 truncate" style={{ color: "var(--dt2)" }}>{n.label}</span>
                  <span title={n.ok ? "Terisi" : "Belum diatur"} style={{ width: "7px", height: "7px", borderRadius: "50%", background: n.ok ? "#22c55e" : "#f59e0b", flexShrink: 0 }} />
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Konten (masonry mengisi lebar) ── */}
        <div className="flex-1 min-w-0">
        <div className="columns-1 xl:columns-2" style={{ columnGap: "16px" }}>

        {/* 1. Penandatangan surat KGB */}
        <Section id="pejabat" badge={<StatusBadge ok={adaPenandatangan} okLabel="Berlaku" noLabel="Belum ada" />} grad="linear-gradient(135deg,#2d5d94,var(--navy-solid))" title="Penandatangan Surat KGB" desc="Dipilih otomatis menurut tanggal surat · Plh, Plt, dan Dirjen punya masa berlaku"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>}>
          <PenandatanganManager onStatus={setAdaPenandatangan} />
        </Section>

        {/* 2. Dasar hukum */}
        <Section id="dokumen" badge={<StatusBadge ok={!!form.nomorPP.trim()} />} grad="linear-gradient(135deg,#17a37e,var(--green-solid))" title="Dasar Hukum KGB" desc="Peraturan Pemerintah yang dirujuk pada SK"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nomor PP" value={form.nomorPP} onChange={(v) => setForm((f) => ({ ...f, nomorPP: v }))} placeholder="Nomor 5 Tahun 2024" />
            <Field label="Tahun PP" value={form.tahunPP} onChange={(v) => setForm((f) => ({ ...f, tahunPP: v }))} placeholder="2024" />
          </div>
        </Section>

        {/* 3. Notifikasi */}
        <Section id="notifikasi" grad="linear-gradient(135deg,#d99414,var(--amber-solid))" title="Notifikasi KGB" desc="Kapan sistem mulai memperingatkan sebelum deadline SDM"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peringatan awal" type="number" suffix="hari" value={String(form.notifKgbH1)} onChange={(v) => setForm((f) => ({ ...f, notifKgbH1: num(v, 14) }))} hint="prioritas info" />
            <Field label="Peringatan mendesak" type="number" suffix="hari" value={String(form.notifKgbH2)} onChange={(v) => setForm((f) => ({ ...f, notifKgbH2: num(v, 7) }))} hint="prioritas warning" />
          </div>
          <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber2)", fontSize: "10.5px", lineHeight: 1.5 }}>
            Contoh: H-{form.notifKgbH1 || 14} muncul lebih dulu (info), lalu H-{form.notifKgbH2 || 7} (mendesak). Deadline terlewat otomatis jadi peringatan rapelan (critical).
          </p>
        </Section>

        {/* 4. Keamanan */}
        <Section id="keamanan" grad="linear-gradient(135deg,#e35d5d,var(--red-solid))" title="Keamanan Sesi" desc="Keluar otomatis saat perangkat tidak aktif"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}>
          <Field label="Durasi idle sebelum auto-logout" type="number" suffix="menit" value={String(form.sesiTimeoutMenit)} onChange={(v) => setForm((f) => ({ ...f, sesiTimeoutMenit: num(v, 60) }))} hint="Peringatan muncul 2 menit sebelum keluar. Rentang aman 5–480 menit." />
        </Section>

        {/* 5. Kontak */}
        <Section id="kontak" badge={<StatusBadge ok={!!form.waAdmin.trim()} okLabel="Aktif" noLabel="Nonaktif" />} grad="linear-gradient(135deg,#22c55e,#15803d)" title="Kontak Admin (WhatsApp)" desc="Dipakai tombol 'Lupa Password' di halaman login"
          icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>}>
          <Field label="Nomor WhatsApp" value={form.waAdmin} onChange={(v) => setForm((f) => ({ ...f, waAdmin: v.replace(/[^\d]/g, "") }))} placeholder="6281234567890" hint="Format internasional tanpa + atau spasi (mis. 62812…). Kosongkan untuk menonaktifkan tombol." />
          {form.waAdmin && (
            <p className="text-xs" style={{ color: "var(--dt5)", fontSize: "10.5px" }}>Pratinjau: <span style={{ fontFamily: "monospace" }}>wa.me/{form.waAdmin}</span></p>
          )}
        </Section>

        </div>{/* end masonry */}

        {initial?.updatedAt && (
          <div className="rounded-xl px-3 py-2 flex items-center gap-2" style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--dt5)" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            <p className="text-xs" style={{ color: "var(--dt4)", fontSize: "10.5px" }}>Terakhir diubah {new Date(initial.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}{initial.updatedBy ? ` · oleh NIP ${initial.updatedBy}` : ""}</p>
          </div>
        )}

        {error && (
          <div className="rounded-xl px-3 py-2 flex items-center gap-2 mt-3" style={{ background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--st-red)"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
            <p className="text-xs" style={{ color: "var(--st-red)" }}>{error}</p>
          </div>
        )}

        {/* Bilah simpan menempel di bawah area konten */}
        <div className="sticky bottom-0 -mx-1 px-1 pt-2 pb-2 mt-3" style={{ background: "linear-gradient(to top, var(--lavender-wash) 60%, transparent)" }}>
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--card)", border: "0.5px solid var(--ln1)", boxShadow: "0 4px 16px rgba(9,20,40,0.08)" }}>
          <button onClick={handleSave} disabled={saving || !isDirty} className="text-xs font-semibold px-5 py-2.5 rounded-xl transition disabled:cursor-not-allowed"
            style={{ background: saving || !isDirty ? "var(--ln1)" : "var(--accent-solid)", color: saving || !isDirty ? "var(--dt4)" : "#fff", border: "none" }}>
            {saving ? "Menyimpan…" : "Simpan Pengaturan"}
          </button>
          {saved ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--st-green)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Tersimpan
            </span>
          ) : isDirty ? (
            <span className="text-xs" style={{ color: "var(--st-amber)", fontSize: "10.5px" }}>Ada perubahan yang belum disimpan</span>
          ) : (
            <span className="text-xs" style={{ color: "var(--dt5)", fontSize: "10.5px" }}>Semua tersimpan</span>
          )}
        </div>
        </div>{/* end sticky save bar */}
        </div>{/* end content flex-1 */}
      </div>{/* end two-pane */}
    </div>
  );
}
