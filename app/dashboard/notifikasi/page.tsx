"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTanggalId } from "@/lib/waktu";

interface Notifikasi {
  id: string;
  judul: string;
  pesan: string;
  tipe: string;
  dibaca: boolean;
  createdAt: string;
  prioritas: string;
  linkHref: string | null;
  kategori: string | null;
}

// Server hanya mengirim tipe notifikasi yang boleh dilihat role pengguna (GET /api/notifikasi),
// sehingga tab kategori disusun dari notifikasi yang benar-benar diterima.
type KunciKategori = "kgb" | "followup" | "sk" | "hukdis";
type TabFilter = "semua" | "belum" | KunciKategori;

const KATEGORI: { key: KunciKategori; label: string; tipe: readonly string[] }[] = [
  { key: "kgb", label: "KGB & Rapelan", tipe: ["kgb_jatuh_tempo", "rapelan"] },
  { key: "followup", label: "Follow Up Keuangan", tipe: ["followup_keuangan"] },
  { key: "sk", label: "SK Menunggu Keuangan", tipe: ["sk_menunggu_keuangan"] },
  { key: "hukdis", label: "Hukdis", tipe: ["hukdis_berakhir"] },
];

function IkonTipe({ tipe }: { tipe: string }) {
  const umum = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true } as const;
  switch (tipe) {
    case "hukdis_berakhir":
      return <svg {...umum}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case "rapelan":
      return <svg {...umum}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case "followup_keuangan":
      return <svg {...umum}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case "sk_menunggu_keuangan":
      return <svg {...umum}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
    default:
      return <svg {...umum}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  }
}

const TIPE_CONFIG: Record<string, { bg: string; color: string; border: string }> = {
  hukdis_berakhir: { bg: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "var(--tint-amber-ln)" },
  kgb_jatuh_tempo: { bg: "var(--tint-navy)", color: "var(--dtn)", border: "var(--ln0)" },
  rapelan: { bg: "var(--tint-red-bg)", color: "var(--st-red)", border: "var(--tint-red-ln)" },
  followup_keuangan: { bg: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "var(--tint-amber-ln)" },
  sk_menunggu_keuangan: { bg: "var(--tint-violet-bg)", color: "var(--st-violet)", border: "var(--tint-violet-ln)" },
};

const PRIORITAS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  critical: { label: "Kritis", bg: "var(--tint-red-bg)", color: "var(--st-red)" },
  warning: { label: "Peringatan", bg: "var(--tint-amber-bg)", color: "var(--st-amber)" },
  info: { label: "Info", bg: "var(--tint-blue-bg)", color: "var(--st-blue)" },
  normal: { label: "Normal", bg: "var(--ln2)", color: "var(--dt3)" },
};

function waktuRelatif(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMnt = Math.floor(diffMs / 60000);
  const diffJam = Math.floor(diffMnt / 60);
  const diffHari = Math.floor(diffJam / 24);

  if (diffMnt < 1) return "Baru saja";
  if (diffMnt < 60) return `${diffMnt} menit lalu`;
  if (diffJam < 24) return `${diffJam} jam lalu`;
  if (diffHari === 1) return "Kemarin";
  if (diffHari < 30) return `${diffHari} hari lalu`;
  return formatTanggalId(d, { day: "numeric", month: "short", year: "numeric" });
}

export default function NotifikasiPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const isSuperAdmin = role === "superAdminCore";
  const [notifikasi, setNotifikasi] = useState<Notifikasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>("semua");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  async function fetchNotifikasi() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifikasi?limit=100");
      const data = (await res.json()) as unknown;
      setNotifikasi(res.ok && Array.isArray(data) ? (data as Notifikasi[]) : []);
    } catch {
      setNotifikasi([]);
    } finally {
      setLoading(false);
    }
  }

  async function tandaiBaca(id: string) {
    const res = await fetch("/api/notifikasi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    if (!res?.ok) return;
    setNotifikasi((prev) => prev.map((n) => (n.id === id ? { ...n, dibaca: true } : n)));
  }

  async function tandaiSemuaBaca() {
    const res = await fetch("/api/notifikasi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dibacaSemua: true }),
    }).catch(() => null);
    if (!res?.ok) return;
    setNotifikasi((prev) => prev.map((n) => ({ ...n, dibaca: true })));
  }

  function bukaNotifikasi(n: Notifikasi) {
    if (!n.dibaca) void tandaiBaca(n.id);
    if (n.linkHref) router.push(n.linkHref);
  }

  async function hapusNotifikasi(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/notifikasi?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) setNotifikasi((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function hapusSemua() {
    if (!confirm("Hapus semua notifikasi? Pengingat untuk KGB atau hukdis yang masih berlaku akan dibuat kembali pada pemeriksaan berikutnya.")) return;
    setDeletingAll(true);
    try {
      const res = await fetch("/api/notifikasi?all=true", { method: "DELETE" });
      if (res.ok) setNotifikasi([]);
    } finally {
      setDeletingAll(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      void fetchNotifikasi();
      fetch("/api/auth/session")
        .then((r) => r.json() as Promise<{ user?: { role?: string } } | null>)
        .then((s) => setRole(s?.user?.role ?? ""))
        .catch(() => setRole(""));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const unread = notifikasi.filter((n) => !n.dibaca).length;
  const kategoriAda = KATEGORI.filter((k) => notifikasi.some((n) => k.tipe.includes(n.tipe)));
  // Tab kategori hanya ditampilkan bila notifikasi yang diterima berasal dari lebih dari satu kategori.
  const tabKategori = kategoriAda.length > 1 ? kategoriAda : [];
  const tabs: { key: TabFilter; label: string; count?: number }[] = [
    { key: "semua", label: "Semua" },
    { key: "belum", label: "Belum Dibaca", count: unread },
    ...tabKategori.map((k) => ({
      key: k.key,
      label: k.label,
      count: notifikasi.filter((n) => !n.dibaca && k.tipe.includes(n.tipe)).length,
    })),
  ];
  const tabAktif: TabFilter = tabs.some((t) => t.key === tab) ? tab : "semua";

  const filtered = notifikasi.filter((n) => {
    if (tabAktif === "semua") return true;
    if (tabAktif === "belum") return !n.dibaca;
    return KATEGORI.find((k) => k.key === tabAktif)?.tipe.includes(n.tipe) ?? false;
  });

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold" style={{ color: "var(--dtn)" }}>
            Notifikasi
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
            {loading ? "Memuat..." : unread > 0 ? `${unread} belum dibaca dari ${notifikasi.length} notifikasi` : `${notifikasi.length} notifikasi · semua sudah dibaca`}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--dt5)" }}>
            Status dibaca berlaku untuk semua pengguna yang menerima notifikasi yang sama.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unread > 0 && (
            <button
              type="button"
              onClick={tandaiSemuaBaca}
              className="text-xs px-3 py-1.5 rounded-lg transition"
              style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}
            >
              Tandai Semua Dibaca
            </button>
          )}
          {isSuperAdmin && notifikasi.length > 0 && (
            <button
              type="button"
              onClick={hapusSemua}
              disabled={deletingAll}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              {deletingAll ? "Menghapus..." : "Hapus Semua"}
            </button>
          )}
        </div>
      </div>

      {/* Tab + List dalam satu card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}>
        {/* Tab Filter */}
        <div className="flex gap-1 px-4 pt-3 pb-0 flex-wrap" role="tablist" aria-label="Filter notifikasi" style={{ borderBottom: "0.5px solid var(--ln2)" }}>
          {tabs.map((t) => {
            const active = tabAktif === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition relative"
                style={{
                  color: active ? "var(--dtn)" : "var(--dt4)",
                  borderBottom: active ? "2px solid var(--dtn)" : "2px solid transparent",
                  marginBottom: "-1px",
                }}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span
                    className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-bold"
                    style={{ background: "var(--navy-solid)", color: "#fff" }}
                    aria-label={`${t.count} belum dibaca`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat notifikasi...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--dt6)" }} aria-hidden>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>
              {tabAktif === "semua" ? "Belum ada notifikasi" : "Tidak ada notifikasi untuk filter ini"}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--ln2)" }}>
            {filtered.map((n) => {
              const cfg = TIPE_CONFIG[n.tipe] || TIPE_CONFIG.kgb_jatuh_tempo;
              const pBadge = PRIORITAS_BADGE[n.prioritas] || PRIORITAS_BADGE.normal;
              const clickable = !!n.linkHref;

              return (
                <div
                  key={n.id}
                  className="flex items-start gap-3 px-4 py-3 transition relative"
                  style={{
                    background: n.dibaca ? "var(--card)" : cfg.bg,
                    opacity: n.dibaca ? 0.75 : 1,
                    cursor: clickable ? "pointer" : "default",
                  }}
                  role={clickable ? "link" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => bukaNotifikasi(n)}
                  onKeyDown={(e) => {
                    if (!clickable || e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      bukaNotifikasi(n);
                    }
                  }}
                >
                  {/* Unread dot */}
                  {!n.dibaca && (
                    <span
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: cfg.color }}
                      aria-hidden
                    />
                  )}

                  {/* Icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
                  >
                    <IkonTipe tipe={n.tipe} />
                  </div>

                  {/* Konten */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold" style={{ color: cfg.color }}>
                        {n.judul}
                      </p>
                      {!n.dibaca && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "var(--card)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>
                          Belum dibaca
                        </span>
                      )}
                      {n.prioritas !== "normal" && (
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          style={{ background: pBadge.bg, color: pBadge.color }}
                        >
                          {pBadge.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--dt3)" }}>
                      {n.pesan}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px]" style={{ color: "var(--dt5)" }}>
                        {waktuRelatif(n.createdAt)}
                      </p>
                      {clickable && (
                        <p className="text-[11px]" style={{ color: "var(--dt5)" }}>· Klik untuk membuka</p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.dibaca && (
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 rounded-lg transition hover:opacity-80"
                        style={{ background: "var(--ln2)", color: "var(--dt3)" }}
                        onClick={(e) => { e.stopPropagation(); void tandaiBaca(n.id); }}
                      >
                        Tandai dibaca
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        type="button"
                        className="w-6 h-6 rounded-full flex items-center justify-center transition hover:opacity-70"
                        style={{ background: deletingId === n.id ? "var(--tint-red-ln)" : "var(--tint-red-bg)", color: "var(--st-red)" }}
                        title="Hapus notifikasi"
                        aria-label={`Hapus notifikasi: ${n.judul}`}
                        disabled={deletingId === n.id}
                        onClick={(e) => { e.stopPropagation(); void hapusNotifikasi(n.id); }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
