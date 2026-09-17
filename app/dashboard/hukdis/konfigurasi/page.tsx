"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { useDialogModal } from "@/app/dashboard/components/useDialogModal";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface RegulasiRef { id: string; nomor: string; tahun: string; status: string; }
interface HukdisJenis {
  id: string; label: string; kategori: string;
  dasarHukum: string | null; regulasiId: string | null; regulasi: RegulasiRef | null;
  durasiHukdis: number;
  berdampakKGB: boolean; durasiTunda: number | null;
  aktif: boolean; urutan: number;
}

interface NewForm {
  label: string; dasarHukum: string; regulasiId: string; kategori: string;
  durasiHukdis: number; berdampakKGB: boolean; durasiTunda: number; aktif: boolean;
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const KAT: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  ringan: { label: "Ringan", bg: "var(--tint-green-bg)", text: "var(--st-green)", border: "#bbf7d0", dot: "#22c55e" },
  sedang: { label: "Sedang", bg: "#fefce8", text: "var(--st-amber2)", border: "var(--tint-amber-ln)", dot: "#f59e0b" },
  berat:  { label: "Berat",  bg: "var(--tint-red-bg)", text: "var(--st-red)", border: "var(--tint-red-ln)", dot: "#ef4444" },
};

const EMPTY_FORM: NewForm = {
  label: "", dasarHukum: "", regulasiId: "", kategori: "ringan",
  durasiHukdis: 0, berdampakKGB: false, durasiTunda: 12, aktif: true,
};

/* Lebar kolom kontrol dipakai bersama oleh header dan baris agar selalu sejajar */
const COL = { kategori: 104, masa: 96, kgb: 96, aktif: 52, aksi: 60 };
const GAP = 14;
const hintStyle: React.CSSProperties = {
  fontSize: "9px", fontWeight: 700, color: "var(--dt4)",
  textTransform: "uppercase", letterSpacing: "0.07em",
};

/* ── Atoms ───────────────────────────────────────────────────────────────── */
function Toggle({ on, onChange, color = "var(--accent)", size = "md" }: {
  on: boolean; onChange: (v: boolean) => void; color?: string; size?: "sm" | "md";
}) {
  const w = size === "sm" ? 30 : 36;
  const h = size === "sm" ? 17 : 20;
  const d = size === "sm" ? 13 : 16;
  const off = size === "sm" ? 15 : 18;
  return (
    <button type="button" onClick={() => onChange(!on)} style={{
      width: `${w}px`, height: `${h}px`, borderRadius: "9999px",
      background: on ? color : "var(--ln1)",
      border: "none", cursor: "pointer", position: "relative",
      transition: "background .15s", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: "2px",
        left: on ? `${off}px` : "2px",
        width: `${d}px`, height: `${d}px`, borderRadius: "50%",
        background: "var(--card)", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        transition: "left .15s", display: "block",
      }} />
    </button>
  );
}

function NumBox({ value, onChange, min = 0, max = 999, unit, width = 52 }: {
  value: number; onChange: (v: number) => void;
  min?: number; max?: number; unit?: string; width?: number;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
      <input type="number" min={min} max={max} value={value}
        onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v))); }}
        style={{
          width: `${width}px`, padding: "5px 6px",
          fontSize: "12px", fontWeight: 600, textAlign: "center",
          border: "1.5px solid var(--ln1)", borderRadius: "7px",
          color: "var(--dt1)", background: "var(--card)", outline: "none", fontFamily: "inherit",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
        onBlur={(e)  => (e.target.style.borderColor = "var(--ln1)")}
      />
      {unit && <span style={{ fontSize: "11px", color: "var(--dt4)", whiteSpace: "nowrap" }}>{unit}</span>}
    </span>
  );
}

/* ── Add Modal ───────────────────────────────────────────────────────────── */
function AddModal({ form, setForm, onSave, onClose, saving, error, regulasiList }: {
  form: NewForm; setForm: (f: NewForm) => void;
  onSave: () => void; onClose: () => void;
  saving: boolean; error: string; regulasiList: RegulasiRef[];
}) {
  const [manual, setManual] = useState(false);
  // Modal ini dipasang hanya saat terbuka; Escape tidak menutup selama menyimpan.
  const refPanel = useDialogModal(true, onClose, saving);
  const idBidang = useId();

  const set = <K extends keyof NewForm>(k: K, v: NewForm[K]) => setForm({ ...form, [k]: v });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px",
    border: "1.5px solid var(--ln1)", borderRadius: "9px",
    fontSize: "13px", color: "var(--dt1)", fontFamily: "inherit", outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 600, color: "var(--dt2)",
    display: "block", marginBottom: "6px",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(15,23,42,0.5)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
      }}
    >
      <div ref={refPanel} role="dialog" aria-modal="true" aria-labelledby="judul-tambah-jenis" tabIndex={-1} style={{
        width: "100%", maxWidth: "500px", background: "var(--card)",
        borderRadius: "18px", overflow: "hidden", outline: "none",
        boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
        animation: "slideUp .22s cubic-bezier(.22,1,.36,1) both",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 22px 16px", borderBottom: "1px solid var(--ln2)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <p id="judul-tambah-jenis" style={{ fontSize: "15px", fontWeight: 700, color: "var(--dt1)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                Tambah Jenis Hukdis Baru
              </p>
              <p style={{ fontSize: "12px", color: "var(--dt4)", margin: 0 }}>
                Jenis baru akan langsung tersedia di form input hukdis pegawai.
              </p>
            </div>
            <button onClick={onClose} aria-label="Tutup" style={{
              width: "28px", height: "28px", flexShrink: 0, borderRadius: "8px",
              border: "1px solid var(--ln2)", background: "var(--sub)",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--dt4)",
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label htmlFor={`${idBidang}-nama`} style={labelStyle}>Nama Jenis Hukdis <span style={{ color: "var(--st-red)" }}>*</span></label>
            <input id={`${idBidang}-nama`} type="text" value={form.label} placeholder="Contoh: Penundaan KGB Selama 2 Tahun"
              onChange={(e) => set("label", e.target.value)} style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e)  => (e.target.style.borderColor = "var(--ln1)")}
            />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <label htmlFor={`${idBidang}-regulasi`} style={{ ...labelStyle, marginBottom: 0 }}>Dasar Hukum / Regulasi <span style={{ color: "var(--st-red)" }}>*</span></label>
              <Link href="/dashboard/hukdis/regulasi" style={{ fontSize: "10px", color: "var(--accent)" }}>Kelola regulasi <span aria-hidden="true">→</span></Link>
            </div>
            {!manual && regulasiList.length > 0 ? (
              <select
                id={`${idBidang}-regulasi`}
                value={form.regulasiId}
                onChange={(e) => { if (e.target.value === "__manual__") { setManual(true); setForm({ ...form, regulasiId: "", dasarHukum: "" }); } else setForm({ ...form, regulasiId: e.target.value }); }}
                style={{ ...inputStyle, cursor: "pointer", background: "var(--card)" }}>
                <option value="">Pilih regulasi…</option>
                {regulasiList.map((r) => (
                  <option key={r.id} value={r.id}>{r.nomor} Tahun {r.tahun}{r.status === "dicabut_sebagian" ? " (dicabut sebagian)" : ""}</option>
                ))}
                <option value="__manual__">— ketik manual —</option>
              </select>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <input id={`${idBidang}-regulasi`} type="text" value={form.dasarHukum} placeholder="Contoh: PP Nomor 94 Tahun 2021"
                  onChange={(e) => set("dasarHukum", e.target.value)} style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e)  => (e.target.style.borderColor = "var(--ln1)")} />
                {regulasiList.length > 0 && <button type="button" onClick={() => { setManual(false); setForm({ ...form, dasarHukum: "" }); }} style={{ ...inputStyle, width: "auto", padding: "0 14px", cursor: "pointer", whiteSpace: "nowrap", color: "var(--dt4)" }}>Daftar</button>}
              </div>
            )}
            <p style={{ fontSize: "10px", color: "var(--dt5)", margin: "5px 0 0", lineHeight: 1.5 }}>
              {regulasiList.length === 0 ? "Belum ada regulasi terdaftar — ketik manual atau daftarkan lewat Kelola regulasi." : "Regulasi yang mendasari jenis ini; jadi default dasar hukum saat input hukdis."}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label htmlFor={`${idBidang}-kategori`} style={labelStyle}>Kategori</label>
              <select id={`${idBidang}-kategori`} value={form.kategori} onChange={(e) => set("kategori", e.target.value)}
                style={{ ...inputStyle, cursor: "pointer", background: "var(--card)" }}>
                <option value="ringan">Ringan</option>
                <option value="sedang">Sedang</option>
                <option value="berat">Berat</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${idBidang}-masa`} style={labelStyle}>Masa Berlaku</label>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input id={`${idBidang}-masa`} type="number" min={0} max={120} value={form.durasiHukdis}
                  onChange={(e) => { const v = parseInt(e.target.value,10); if (!isNaN(v)) set("durasiHukdis", Math.min(120,Math.max(0,v))); }}
                  style={{ ...inputStyle, width: "72px" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e)  => (e.target.style.borderColor = "var(--ln1)")}
                />
                <span style={{ fontSize: "12px", color: "var(--dt4)" }}>bulan (0=manual)</span>
              </div>
            </div>
          </div>

          {/* KGB */}
          <div style={{ border: "1.5px solid var(--ln2)", borderRadius: "12px", overflow: "hidden" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px", background: form.berdampakKGB ? "var(--tint-red-bg)" : "var(--sub)",
              transition: "background .15s",
            }}>
              <div>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--dt1)", margin: 0 }}>Blokir / Tunda KGB</p>
                <p style={{ fontSize: "11px", color: "var(--dt3)", margin: "2px 0 0" }}>
                  TMT KGB digeser otomatis saat hukdis ini dicatat
                </p>
              </div>
              <Toggle on={form.berdampakKGB} onChange={(v) => set("berdampakKGB", v)} color="var(--st-red)" />
            </div>
            {form.berdampakKGB && (
              <div style={{ padding: "10px 14px", borderTop: "1px solid var(--tint-red-ln)", background: "var(--card)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--dt3)" }}>Durasi penundaan:</span>
                  <NumBox value={form.durasiTunda} onChange={(v) => set("durasiTunda", v)} min={1} max={60} unit="bulan" width={60} />
                </div>
              </div>
            )}
          </div>

          {/* Status aktif */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", border: "1.5px solid var(--ln1)", borderRadius: "12px",
            background: form.aktif ? "var(--tint-green-bg)" : "var(--sub)", transition: "background .15s",
          }}>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--dt1)", margin: 0 }}>Status Aktif</p>
              <p style={{ fontSize: "11px", color: "var(--dt3)", margin: "2px 0 0" }}>
                {form.aktif ? "Muncul di form input hukdis pegawai" : "Tersembunyi dari form input"}
              </p>
            </div>
            <Toggle on={form.aktif} onChange={(v) => set("aktif", v)} />
          </div>

          {error && (
            <div style={{
              display: "flex", gap: "8px", alignItems: "center",
              background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)",
              borderRadius: "9px", padding: "10px 12px",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#dc2626"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
              <span style={{ fontSize: "12px", color: "var(--st-red)" }}>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", gap: "8px", justifyContent: "flex-end",
          padding: "14px 22px", borderTop: "1px solid var(--ln2)", background: "var(--sub)",
        }}>
          <button onClick={onClose} style={{
            padding: "9px 18px", borderRadius: "9px",
            border: "1.5px solid var(--ln1)", background: "var(--card)",
            fontSize: "13px", fontWeight: 500, color: "var(--dt2)",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            Batal
          </button>
          <button onClick={onSave} disabled={saving} style={{
            padding: "9px 22px", borderRadius: "9px", border: "none",
            background: saving ? "var(--ln1)" : "var(--accent-solid)",
            fontSize: "13px", fontWeight: 600,
            color: saving ? "var(--dt4)" : "#fff",
            cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: "7px",
          }}>
            {saving && <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "spin .7s linear infinite" }}><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>}
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Jenis Row ─────────────────────────────────────────────────────────── */
function JenisRow({ j, onPatch, onDelete, deleting, confirmId, setConfirmId, galatHapus }: {
  j: HukdisJenis;
  onPatch: (id: string, p: Partial<HukdisJenis>) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  /** Pesan bila penghapusan jenis ini ditolak atau gagal. */
  galatHapus: string | null;
}) {
  const k = KAT[j.kategori] ?? KAT.ringan;
  const isConfirm = confirmId === j.id;

  const ghostStyle: React.CSSProperties = {
    width: "100%", background: "transparent",
    border: "1.5px solid transparent", borderRadius: "7px",
    padding: "4px 7px", fontSize: "13px", color: "var(--dt1)",
    fontFamily: "inherit", outline: "none",
    transition: "border-color .12s, background .12s",
  };

  return (
    <div className="jenis-row" style={{
      display: "flex", alignItems: "flex-start", gap: "0",
      padding: "14px 20px",
      background: j.aktif ? "var(--card)" : "var(--sub)",
      borderBottom: "1px solid var(--ln2)",
      opacity: j.aktif ? 1 : 0.65,
      transition: "background .12s, opacity .15s",
    }}>
      {/* Urutan */}
      <div style={{ width: "32px", flexShrink: 0, paddingTop: "5px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: "22px", height: "22px", borderRadius: "6px",
          background: k.bg, border: `1px solid ${k.border}`,
          fontSize: "10px", fontWeight: 700, color: k.text,
        }}>
          {j.urutan}
        </span>
      </div>

      {/* Nama dan dasar peraturan, mengambil ruang terlebar */}
      <div style={{ flex: 1, minWidth: 0, marginRight: "16px" }}>
        <input
          type="text"
          value={j.label}
          onChange={(e) => onPatch(j.id, { label: e.target.value })}
          placeholder="Nama jenis hukdis..."
          style={{ ...ghostStyle, fontWeight: 600 }}
          onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; e.target.style.background = "var(--sub)"; }}
          onBlur={(e)  => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
        />
        <input
          type="text"
          value={j.dasarHukum ?? ""}
          onChange={(e) => onPatch(j.id, { dasarHukum: e.target.value })}
          placeholder="Dasar peraturan / pasal..."
          style={{ ...ghostStyle, fontSize: "11px", color: "var(--dt3)", marginTop: "2px" }}
          onFocus={(e) => { e.target.style.borderColor = "var(--dt4)"; e.target.style.background = "var(--sub)"; }}
          onBlur={(e)  => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
        />
        {galatHapus && (
          <p role="alert" style={{ fontSize: "11px", color: "var(--st-red)", margin: "4px 7px 0", lineHeight: 1.5 }}>
            {galatHapus}
          </p>
        )}
      </div>

      {/* Kontrol sisi kanan, lebar kolom tetap agar sejajar dengan header */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: `${GAP}px`,
        flexShrink: 0, paddingTop: "2px",
      }}>
        {/* Kategori */}
        <div style={{ width: COL.kategori, flexShrink: 0 }}>
          <select
            value={j.kategori}
            onChange={(e) => onPatch(j.id, { kategori: e.target.value })}
            style={{
              width: "100%", padding: "6px 8px", borderRadius: "7px",
              border: `1.5px solid ${k.border}`, background: k.bg,
              fontSize: "11px", fontWeight: 600, color: k.text,
              fontFamily: "inherit", cursor: "pointer", outline: "none",
            }}
          >
            <option value="ringan">Ringan</option>
            <option value="sedang">Sedang</option>
            <option value="berat">Berat</option>
          </select>
        </div>

        {/* Masa berlaku */}
        <div style={{ width: COL.masa, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", paddingTop: "1px" }}>
          <NumBox value={j.durasiHukdis} onChange={(v) => onPatch(j.id, { durasiHukdis: v })} min={0} max={120} width={48} />
          <span style={{ fontSize: "10px", color: "var(--dt4)", whiteSpace: "nowrap" }}>
            {j.durasiHukdis === 0 ? "manual" : "bln"}
          </span>
        </div>

        {/* Blokir KGB */}
        <div style={{ width: COL.kgb, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", paddingTop: "1px" }}>
          <Toggle
            on={j.berdampakKGB}
            onChange={(v) => onPatch(j.id, { berdampakKGB: v, durasiTunda: v ? (j.durasiTunda ?? 12) : null })}
            color="var(--st-red)" size="sm"
          />
          {j.berdampakKGB && (
            <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <NumBox value={j.durasiTunda ?? 12} onChange={(v) => onPatch(j.id, { durasiTunda: v })} min={1} max={60} width={40} />
              <span style={{ fontSize: "10px", color: "var(--dt4)" }}>bln</span>
            </div>
          )}
        </div>

        {/* Aktif */}
        <div style={{ width: COL.aktif, flexShrink: 0, display: "flex", justifyContent: "center", paddingTop: "1px" }}>
          <Toggle on={j.aktif} onChange={(v) => onPatch(j.id, { aktif: v })} size="sm" />
        </div>

        {/* Aksi hapus */}
        <div style={{ width: COL.aksi, flexShrink: 0, display: "flex", justifyContent: "center" }}>
          {isConfirm ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <button
                onClick={() => onDelete(j.id)}
                disabled={deleting}
                style={{
                  padding: "4px 10px", borderRadius: "6px", border: "none",
                  background: "var(--red-solid)", color: "#fff",
                  fontSize: "10px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? "..." : "Hapus"}
              </button>
              <button
                onClick={() => setConfirmId(null)}
                style={{
                  padding: "3px 10px", borderRadius: "6px",
                  border: "1px solid var(--ln1)", background: "var(--card)",
                  fontSize: "10px", color: "var(--dt3)", cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              className="del-btn"
              onClick={() => setConfirmId(j.id)}
              title="Hapus jenis ini"
              style={{
                width: "28px", height: "28px", borderRadius: "8px",
                border: "1px solid var(--tint-red-ln)", background: "var(--tint-red-bg)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--st-red)", opacity: 0, transition: "opacity .15s",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function HukdisKonfigurasiPage() {
  const [draft,      setDraft]      = useState<HukdisJenis[]>([]);
  const [orig,       setOrig]       = useState<HukdisJenis[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [savedOk,    setSavedOk]    = useState(false);
  const [saveError,  setSaveError]  = useState("");
  const [showAdd,   setShowAdd]    = useState(false);
  const [addForm,    setAddForm]    = useState<NewForm>(EMPTY_FORM);
  const [addSaving,  setAddSaving]  = useState(false);
  const [addError,   setAddError]   = useState("");
  const [confirmId,  setConfirmId]  = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [galatHapus, setGalatHapus] = useState<{ id: string; pesan: string } | null>(null);
  const [filterKat,  setFilterKat]  = useState("semua");
  const [loadError,  setLoadError]  = useState("");
  const [regulasiList, setRegulasiList] = useState<RegulasiRef[]>([]);

  useEffect(() => {
    let aktif = true;
    (async () => {
      try {
        const res = await fetch("/api/hukdis/konfigurasi");
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as any;
          throw new Error(d.error || `Gagal memuat (HTTP ${res.status})`);
        }
        const d = await res.json() as any;
        const jenis: HukdisJenis[] = Array.isArray(d.jenis) ? d.jenis : [];
        if (!aktif) return;
        setDraft(jenis);
        setOrig(structuredClone(jenis));
      } catch (e) {
        if (aktif) setLoadError(e instanceof Error ? e.message : "Gagal memuat konfigurasi");
      } finally {
        if (aktif) setLoading(false);
      }
    })();
    // Regulasi aktif (untuk picker dasar hukum saat menambah jenis)
    fetch("/api/hukdis/regulasi").then((r) => r.json() as any)
      .then((d) => { if (aktif && Array.isArray(d)) setRegulasiList(d.filter((r: RegulasiRef) => r.status === "berlaku" || r.status === "dicabut_sebagian")); })
      .catch(() => {});
    return () => { aktif = false; };
  }, []);

  const patch = useCallback((id: string, changes: Partial<HukdisJenis>) => {
    setDraft((prev) => prev.map((j) => j.id === id ? { ...j, ...changes } : j));
  }, []);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(orig);

  async function handleSave() {
    setSaving(true); setSavedOk(false); setSaveError("");
    const jenisUpdates = draft
      .filter((j, i) => JSON.stringify(j) !== JSON.stringify(orig[i]))
      .map((j) => ({
        id: j.id, label: j.label, dasarHukum: j.dasarHukum,
        kategori: j.kategori, durasiHukdis: j.durasiHukdis,
        berdampakKGB: j.berdampakKGB,
        durasiTunda: j.berdampakKGB ? (j.durasiTunda ?? 12) : null,
        aktif: j.aktif,
      }));
    // API memeriksa semua perubahan sebelum menulis: bila ditolak, tidak ada yang tersimpan dan draf tetap.
    try {
      const res = await fetch("/api/hukdis/konfigurasi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenisUpdates }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setSaveError(d.error || "Perubahan gagal disimpan.");
        setSaving(false);
        return;
      }
    } catch {
      setSaveError("Gagal menghubungi server. Periksa koneksi, lalu coba lagi.");
      setSaving(false);
      return;
    }
    setOrig(JSON.parse(JSON.stringify(draft)));
    setSaving(false); setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
  }

  async function handleAdd() {
    if (!addForm.label.trim()) { setAddError("Nama jenis wajib diisi"); return; }
    if (!addForm.regulasiId && !addForm.dasarHukum.trim()) { setAddError("Pilih regulasi atau isi dasar peraturan"); return; }
    setAddSaving(true); setAddError("");
    const res = await fetch("/api/hukdis/konfigurasi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    if (res.ok) {
      const newJ = await res.json() as any;
      // Sisipkan referensi regulasi agar baris langsung menampilkannya
      const reg = regulasiList.find((r) => r.id === newJ.regulasiId) ?? null;
      setDraft((p) => [...p, { ...newJ, regulasi: reg }]);
      setOrig((p)  => [...p, { ...newJ, regulasi: reg }]);
      setShowAdd(false);
      setAddForm(EMPTY_FORM);
    } else {
      const d = await res.json() as any;
      setAddError(d.error || "Gagal menyimpan");
    }
    setAddSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setGalatHapus(null);
    try {
      const res = await fetch(`/api/hukdis/jenis/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDraft((p) => p.filter((j) => j.id !== id));
        setOrig((p)  => p.filter((j) => j.id !== id));
        setConfirmId(null);
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setGalatHapus({ id, pesan: d.error || "Jenis hukdis gagal dihapus." });
      }
    } catch {
      setGalatHapus({ id, pesan: "Gagal menghubungi server. Coba lagi." });
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = filterKat === "semua" ? draft : draft.filter((j) => j.kategori === filterKat);

  // Group by kategori, preserve order
  const groups: Array<{ kat: string; items: HukdisJenis[] }> = [];
  for (const kat of ["ringan", "sedang", "berat"]) {
    const items = filtered.filter((j) => j.kategori === kat);
    if (items.length) groups.push({ kat, items });
  }

  const totalAktif  = draft.filter((j) => j.aktif).length;
  const totalKGB    = draft.filter((j) => j.berdampakKGB).length;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "260px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", border: "3px solid var(--ln1)", borderTopColor: "var(--accent)", margin: "0 auto 10px", animation: "spin .7s linear infinite" }} />
          <p style={{ fontSize: "12px", color: "var(--dt4)", margin: 0 }}>Memuat konfigurasi...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "260px" }}>
        <div style={{
          textAlign: "center", maxWidth: "360px",
          background: "var(--card)", border: "1px solid var(--tint-red-ln)", borderRadius: "14px",
          padding: "28px 24px",
        }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "11px", margin: "0 auto 12px",
            background: "var(--tint-red-bg)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#dc2626"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
          </div>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--dt1)", margin: "0 0 4px" }}>Konfigurasi gagal dimuat</p>
          <p style={{ fontSize: "12px", color: "var(--dt3)", margin: "0 0 16px", lineHeight: 1.6 }}>{loadError}</p>
          <button
            onClick={() => { setLoadError(""); setLoading(true); window.location.reload(); }}
            style={{
              padding: "8px 18px", borderRadius: "9px", border: "none",
              background: "var(--accent-solid)", color: "#fff", fontSize: "12px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Muat ulang
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        input[type=number] { -moz-appearance:textfield }
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none }
        .jenis-row:hover  { background: #fafbff !important }
        .jenis-row:hover .del-btn { opacity: 1 !important }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <Link href="/dashboard/hukdis" title="Kembali ke Hukuman Disiplin"
            style={{ width: "34px", height: "34px", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "2px", background: "var(--sub)", color: "var(--dt3)", border: "0.5px solid var(--ln1)" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </Link>
          <div>
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-red)", margin: "0 0 3px" }}>SDM Hukdis</p>
            <h1 style={{ fontSize: "17px", fontWeight: 700, color: "var(--dt1)", margin: "0 0 5px", letterSpacing: "-0.02em" }}>
              Jenis Hukuman Disiplin
            </h1>
            <p style={{ fontSize: "12px", color: "var(--dt3)", margin: 0, lineHeight: 1.65 }}>
              Master data jenis hukdis: nama, dasar peraturan, masa berlaku, dan dampak ke KGB.<br />
              Perubahan di sini langsung memengaruhi pilihan pada form input hukdis pegawai.
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowAdd(true); setAddForm(EMPTY_FORM); setAddError(""); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: "7px",
            background: "var(--accent-solid)", color: "#fff", border: "none",
            borderRadius: "10px", padding: "10px 18px",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", flexShrink: 0,
            boxShadow: "0 1px 4px rgba(18,84,167,0.3)",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          Tambah Jenis
        </button>
      </div>

      {/* ── Regulasi aktif banner ─────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
        padding: "14px 18px", marginBottom: "16px",
        background: "var(--card)", border: "1px solid var(--ln1)", borderRadius: "14px",
      }}>
        {/* Ikon dokumen */}
        <div style={{
          width: "40px", height: "40px", borderRadius: "10px",
          background: "var(--tint-blue-bg)", border: "1px solid var(--tint-blue-ln)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1254a7" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Regulasi Aktif
            </span>
            <span style={{
              fontSize: "12px", fontWeight: 700, color: "var(--dt1)",
              background: "var(--tint-blue-bg)", border: "1px solid var(--tint-blue-ln)",
              borderRadius: "9999px", padding: "2px 10px",
            }}>
              PP Nomor 94 Tahun 2021
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--dt3)", margin: "3px 0 0" }}>
            Peraturan Pemerintah tentang Disiplin Pegawai Negeri Sipil. Jenis hukdis di bawah
            mencerminkan pasal-pasal relevan dari regulasi ini.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: "1px", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--ln2)", flexShrink: 0 }}>
          {[
            { val: draft.length,  sub: "total jenis",  bg: "var(--card)" },
            { val: totalAktif,    sub: "aktif",         bg: "var(--tint-green-bg)" },
            { val: totalKGB,      sub: "blokir KGB",    bg: "var(--tint-red-bg)" },
          ].map(({ val, sub, bg }) => (
            <div key={sub} style={{ padding: "8px 14px", textAlign: "center", background: bg }}>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "var(--dt1)", margin: 0, letterSpacing: "-0.03em" }}>{val}</p>
              <p style={{ fontSize: "9px", color: "var(--dt4)", margin: 0, whiteSpace: "nowrap" }}>{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Jenis section ─────────────────────────────────────────────── */}
      <div style={{ background: "var(--card)", border: "1px solid var(--ln1)", borderRadius: "14px", overflow: "hidden", marginBottom: "16px" }}>

        {/* Section toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "13px 20px", borderBottom: "1px solid var(--ln2)", flexWrap: "wrap" }}>
          <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--dt1)", margin: 0, flex: 1 }}>
            Daftar Jenis Hukuman Disiplin
          </p>
          {/* Filter chips */}
          <div style={{ display: "flex", gap: "4px" }}>
            {(["semua", "ringan", "sedang", "berat"] as const).map((k) => {
              const active = filterKat === k;
              const ks = k !== "semua" ? KAT[k] : null;
              return (
                <button key={k} onClick={() => setFilterKat(k)} style={{
                  padding: "4px 12px", borderRadius: "9999px",
                  border: `1.5px solid ${active ? (ks?.border ?? "var(--accent)") : "var(--ln1)"}`,
                  background: active ? (ks?.bg ?? "var(--tint-blue-bg)") : "var(--card)",
                  color: active ? (ks?.text ?? "var(--accent)") : "var(--dt3)",
                  fontSize: "11px", fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", transition: "all .1s",
                }}>
                  {k === "semua" ? "Semua" : KAT[k].label}
                  {k !== "semua" && (
                    <span style={{ marginLeft: "5px", opacity: 0.7 }}>
                      ({draft.filter((j) => j.kategori === k).length})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Header kolom, lebar sama persis dengan kontrol di tiap baris */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "7px 20px", background: "var(--sub)", borderBottom: "1px solid var(--ln2)",
        }}>
          <div style={{ width: "32px", flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, marginRight: "16px" }}>
            <span style={hintStyle}>Nama jenis dan dasar peraturan (klik untuk edit)</span>
          </div>
          <div style={{ display: "flex", gap: `${GAP}px`, flexShrink: 0, alignItems: "center" }}>
            <span style={{ ...hintStyle, width: COL.kategori, textAlign: "center" }}>Kategori</span>
            <span style={{ ...hintStyle, width: COL.masa,     textAlign: "center" }}>Masa Berlaku</span>
            <span style={{ ...hintStyle, width: COL.kgb,      textAlign: "center" }}>Blokir KGB</span>
            <span style={{ ...hintStyle, width: COL.aktif,    textAlign: "center" }}>Aktif</span>
            <span style={{ width: COL.aksi, flexShrink: 0 }} />
          </div>
        </div>

        {/* Grouped rows */}
        {groups.map(({ kat, items }) => {
          const k = KAT[kat];
          return (
            <div key={kat}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 20px 4px" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "5px",
                  fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em",
                  padding: "3px 10px", borderRadius: "9999px",
                  background: k.bg, color: k.text, border: `1px solid ${k.border}`,
                }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: k.dot, display: "inline-block" }} />
                  HUKDIS {k.label.toUpperCase()}
                </span>
                <div style={{ flex: 1, height: "1px", background: "var(--ln2)" }} />
              </div>
              {items.map((j) => (
                <JenisRow
                  key={j.id}
                  j={j}
                  onPatch={patch}
                  onDelete={handleDelete}
                  deleting={deletingId === j.id}
                  confirmId={confirmId}
                  setConfirmId={(id) => { setConfirmId(id); setGalatHapus(null); }}
                  galatHapus={galatHapus?.id === j.id ? galatHapus.pesan : null}
                />
              ))}
            </div>
          );
        })}

        {groups.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <p style={{ fontSize: "13px", color: "var(--dt4)", margin: 0 }}>
              Tidak ada jenis hukdis pada kategori ini.
            </p>
          </div>
        )}

        {/* Footer note */}
        <div style={{ padding: "12px 20px", background: "var(--sub)", borderTop: "1px solid var(--ln2)" }}>
          <p style={{ fontSize: "11px", color: "var(--dt4)", margin: 0, lineHeight: 1.65 }}>
            <strong style={{ color: "var(--dt3)" }}>Masa berlaku 0</strong>: tanggal berakhir diisi manual saat input hukdis.
            <span style={{ margin: "0 10px", color: "var(--ln1)" }}>|</span>
            <strong style={{ color: "var(--dt3)" }}>Blokir KGB</strong>: TMT KGB pegawai digeser otomatis sesuai durasi tunda yang diset.
            <span style={{ margin: "0 10px", color: "var(--ln1)" }}>|</span>
            Jenis hanya dapat dihapus jika belum pernah digunakan pada riwayat hukdis pegawai.
          </p>
        </div>
      </div>

      {/* ── Save bar ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" }}>
        {savedOk && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: 500, color: "var(--st-green)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Perubahan tersimpan
          </span>
        )}
        {saveError && (
          <span role="alert" style={{ fontSize: "12px", fontWeight: 500, color: "var(--st-red)" }}>
            {saveError}
          </span>
        )}
        {isDirty && !saving && (
          <span style={{ fontSize: "11px", color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>
            Ada perubahan yang belum disimpan
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "10px 24px", borderRadius: "10px", border: "none",
            background: isDirty && !saving ? "var(--accent-solid)" : "var(--ln2)",
            color: isDirty && !saving ? "#fff" : "var(--dt4)",
            fontSize: "13px", fontWeight: 600,
            cursor: isDirty && !saving ? "pointer" : "default",
            fontFamily: "inherit", transition: "all .12s",
            boxShadow: isDirty && !saving ? "0 1px 4px rgba(18,84,167,0.3)" : "none",
          }}
        >
          {saving && <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "spin .7s linear infinite" }}><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>}
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </div>

      {/* ── Add modal ────────────────────────────────────────────────── */}
      {showAdd && (
        <AddModal
          form={addForm} setForm={setAddForm}
          onSave={handleAdd} onClose={() => setShowAdd(false)}
          saving={addSaving} error={addError} regulasiList={regulasiList}
        />
      )}
    </>
  );
}
