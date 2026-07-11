"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Notifikasi {
  id: string;
  judul: string;
  pesan: string;
  tipe: string;
  referenceId: string | null;
  dibaca: boolean;
  createdAt: string;
  prioritas: string;
  linkHref: string | null;
  kategori: string | null;
}

type TabFilter = "semua" | "belum" | "kgb" | "hukdis";

const TIPE_CONFIG: Record<
  string,
  { icon: string; bg: string; color: string; border: string }
> = {
  hukdis_berakhir: {
    icon: "⚠",
    bg: "var(--tint-amber-bg)",
    color: "var(--st-amber)",
    border: "var(--tint-amber-ln)",
  },
  kgb_jatuh_tempo: {
    icon: "📅",
    bg: "var(--tint-navy)",
    color: "var(--dtn)",
    border: "var(--ln0)",
  },
  rapelan: {
    icon: "⏰",
    bg: "var(--tint-red-bg)",
    color: "var(--st-red)",
    border: "var(--tint-red-ln)",
  },
};

const PRIORITAS_BADGE: Record<
  string,
  { label: string; bg: string; color: string }
> = {
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
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
      const data = await res.json() as any;
      setNotifikasi(Array.isArray(data) ? data : []);
    } catch {
      setNotifikasi([]);
    } finally {
      setLoading(false);
    }
  }

  async function tandaiBaca(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch("/api/notifikasi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifikasi((prev) =>
      prev.map((n) => (n.id === id ? { ...n, dibaca: true } : n)),
    );
  }

  async function tandaiSemuaBaca() {
    await fetch("/api/notifikasi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dibacaSemua: true }),
    });
    setNotifikasi((prev) => prev.map((n) => ({ ...n, dibaca: true })));
  }

  function handleCardClick(n: Notifikasi) {
    if (!n.dibaca) {
      fetch("/api/notifikasi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
      setNotifikasi((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, dibaca: true } : x)),
      );
    }
    if (n.linkHref) router.push(n.linkHref);
  }

  async function hapusNotifikasi(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await fetch(`/api/notifikasi?id=${id}`, { method: "DELETE" });
      setNotifikasi((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function hapusSemua() {
    if (!confirm("Hapus semua notifikasi? Tindakan ini tidak dapat dibatalkan.")) return;
    setDeletingAll(true);
    try {
      await fetch("/api/notifikasi?all=true", { method: "DELETE" });
      setNotifikasi([]);
    } finally {
      setDeletingAll(false);
    }
  }

  useEffect(() => {
    fetchNotifikasi();
    fetch("/api/auth/session")
      .then((r) => r.json() as any)
      .then((s) => setRole(s?.user?.role ?? ""));
  }, []);

  const unread = notifikasi.filter((n) => !n.dibaca).length;
  const unreadKGB = notifikasi.filter(
    (n) =>
      !n.dibaca &&
      (n.tipe === "kgb_jatuh_tempo" || n.tipe === "rapelan"),
  ).length;
  const unreadHukdis = notifikasi.filter(
    (n) => !n.dibaca && n.tipe === "hukdis_berakhir",
  ).length;

  const filtered = notifikasi.filter((n) => {
    if (tab === "belum") return !n.dibaca;
    if (tab === "kgb")
      return n.tipe === "kgb_jatuh_tempo" || n.tipe === "rapelan";
    if (tab === "hukdis") return n.tipe === "hukdis_berakhir";
    return true;
  });

  const tabs: { key: TabFilter; label: string; count?: number }[] = [
    { key: "semua", label: "Semua" },
    { key: "belum", label: "Belum Dibaca", count: unread },
    { key: "kgb", label: "KGB & Rapelan", count: unreadKGB },
    { key: "hukdis", label: "Hukdis", count: unreadHukdis },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold" style={{ color: "var(--dtn)" }}>
            Notifikasi
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
            {loading ? "Memuat..." : unread > 0 ? `${unread} belum dibaca dari ${notifikasi.length} notifikasi` : `${notifikasi.length} notifikasi · semua sudah dibaca`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {unread > 0 && (
            <button
              onClick={tandaiSemuaBaca}
              className="text-xs px-3 py-1.5 rounded-lg transition"
              style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}
            >
              Tandai Semua Dibaca
            </button>
          )}
          {isSuperAdmin && notifikasi.length > 0 && (
            <button
              onClick={hapusSemua}
              disabled={deletingAll}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition disabled:opacity-50"
              style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              {deletingAll ? "Menghapus..." : "Hapus Semua"}
            </button>
          )}
        </div>
      </div>

      {/* Tab + List dalam satu card */}
      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
        {/* Tab Filter */}
        <div className="flex gap-1 px-4 pt-3 pb-0 flex-wrap" style={{ borderBottom: "0.5px solid var(--ln2)" }}>
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
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
                    className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                    style={{ background: "var(--navy-solid)", color: "#fff" }}
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
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d0dce8" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>
              {tab === "semua" ? "Belum ada notifikasi" : "Tidak ada notifikasi untuk filter ini"}
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
                  onClick={() => handleCardClick(n)}
                >
                  {/* Unread dot */}
                  {!n.dibaca && (
                    <span
                      className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: cfg.color }}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    {cfg.icon}
                  </div>

                  {/* Konten */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold" style={{ color: cfg.color }}>
                        {n.judul}
                      </p>
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
                        <p className="text-[11px]" style={{ color: "var(--dt5)" }}>· Klik untuk lihat</p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.dibaca && (
                      <button
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs transition hover:opacity-70"
                        style={{ background: "var(--ln1)", color: "var(--dt4)" }}
                        title="Tandai dibaca"
                        onClick={(e) => tandaiBaca(n.id, e)}
                      >
                        ×
                      </button>
                    )}
                    {isSuperAdmin && (
                      <button
                        className="w-6 h-6 rounded-full flex items-center justify-center transition hover:opacity-70"
                        style={{ background: deletingId === n.id ? "var(--tint-red-ln)" : "var(--tint-red-bg)", color: "var(--st-red)" }}
                        title="Hapus notifikasi"
                        disabled={deletingId === n.id}
                        onClick={(e) => hapusNotifikasi(n.id, e)}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
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
