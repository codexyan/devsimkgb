"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABEL } from "@/lib/auth";

interface TopbarProps {
  nama: string;
  nip: string;
  role: string;
  onToggleSidebar: () => void;
}

interface Notif {
  id: string;
  judul: string;
  pesan: string;
  tipe: string;
  prioritas: string;
  dibaca: boolean;
  createdAt: string;
  linkHref?: string;
}

const PRIORITAS: Record<string, { dot: string; badge: string; text: string }> = {
  critical: { dot: "#ef4444", badge: "var(--tint-red-bg)", text: "var(--st-red)" },
  warning:  { dot: "#f59e0b", badge: "var(--tint-amber-bg)", text: "var(--st-amber2)" },
  info:     { dot: "#127ee3", badge: "var(--tint-blue-bg)", text: "#0f77ff" },
};

/* ── Flat icons ─────────────────────────────────────────────────────────── */
const Ic = {
  menu: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
    </svg>
  ),
  bell: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
    </svg>
  ),
  chevronDown: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
    </svg>
  ),
  chevronRight: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
    </svg>
  ),
  person: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  ),
};

export default function Topbar({ nama, nip, role, onToggleSidebar }: TopbarProps) {
  const router = useRouter();

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifList, setNotifList]     = useState<Notif[]>([]);
  const [showNotif, setShowNotif]     = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const notifRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const initials = nama
    ? nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  async function fetchNotifikasi() {
    try {
      const res  = await fetch("/api/notifikasi");
      const data = await res.json() as any;
      if (Array.isArray(data)) {
        setNotifList(data.slice(0, 6));
        setUnreadCount(data.filter((n: Notif) => !n.dibaca).length);
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    const t = setTimeout(fetchNotifikasi, 800);
    const i = setInterval(fetchNotifikasi, 5 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(i); };
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifikasi/${id}/baca`, { method: "PATCH" }).catch(() => {});
    setNotifList((prev) => prev.map((n) => n.id === id ? { ...n, dibaca: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header
      style={{
        height: "56px",
        paddingInline: "16px",
        background: "var(--paper)",
        borderBottom: "1px solid var(--frost-border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        zIndex: 40,
      }}
    >
      {/* ---- LEFT ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Hamburger */}
        <button
          onClick={onToggleSidebar}
          style={{
            width: "32px", height: "32px", borderRadius: "8px",
            border: "1px solid var(--frost-border)",
            background: "var(--lavender-wash)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "background 0.15s",
            color: "var(--midnight-ink)",
          }}
        >
          {Ic.menu}
        </button>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "7px",
            background: "var(--lavender-wash)", border: "1px solid var(--frost-border)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Image src="/icons.svg" alt="Logo" width={16} height={16} />
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--midnight-ink)", lineHeight: 1.2 }}>SIM-KGB</div>
            <div style={{ fontSize: "11px", color: "var(--mist)", lineHeight: 1.2 }}>Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan</div>
          </div>
        </div>
      </div>

      {/* ---- RIGHT ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>

        {/* Notification */}
        <div style={{ position: "relative" }} ref={notifRef}>
          <button
            onClick={() => { setShowNotif((v) => !v); setShowProfile(false); }}
            style={{
              position: "relative", width: "34px", height: "34px",
              borderRadius: "8px", border: "1px solid var(--frost-border)",
              background: showNotif ? "var(--lavender-wash)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "background 0.15s",
              color: "var(--slate)",
            }}
          >
            {Ic.bell}
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: "-4px", right: "-4px",
                minWidth: "16px", height: "16px", borderRadius: "9999px",
                background: "#ef4444", color: "#fff",
                fontSize: "9px", fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px", boxShadow: "0 0 0 2px var(--paper)",
              }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notif dropdown */}
          {showNotif && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              width: "320px", background: "var(--paper)",
              border: "1px solid var(--frost-border)", borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(9,17,53,0.12), 0 2px 8px rgba(9,17,53,0.06)",
              zIndex: 200, overflow: "hidden",
            }}>
              {/* Header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderBottom: "1px solid var(--frost-border)",
              }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--midnight-ink)" }}>Notifikasi</span>
                {unreadCount > 0 && (
                  <span style={{ fontSize: "10px", fontWeight: 700, background: "#ef4444", color: "#fff", borderRadius: "9999px", padding: "2px 8px" }}>
                    {unreadCount} baru
                  </span>
                )}
              </div>

              {/* List */}
              <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                {notifList.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 16px", gap: "8px" }}>
                    <span style={{ color: "var(--mist)", display: "flex" }}>{Ic.bell}</span>
                    <p style={{ fontSize: "12px", color: "var(--mist)" }}>Tidak ada notifikasi</p>
                  </div>
                ) : (
                  notifList.map((n, i) => {
                    const p = PRIORITAS[n.prioritas] ?? PRIORITAS.info;
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (!n.dibaca) markRead(n.id);
                          setShowNotif(false);
                          if (n.linkHref) router.push(n.linkHref);
                        }}
                        style={{
                          width: "100%", textAlign: "left",
                          display: "flex", alignItems: "flex-start", gap: "10px",
                          padding: "12px 16px",
                          background: n.dibaca ? "var(--paper)" : "var(--lavender-wash)",
                          borderBottom: i < notifList.length - 1 ? "1px solid var(--frost-border)" : "none",
                          border: "none", cursor: "pointer",
                          transition: "background 0.1s", fontFamily: "inherit",
                        }}
                      >
                        <span style={{
                          width: "6px", height: "6px", borderRadius: "50%",
                          background: n.dibaca ? "var(--mist)" : p.dot,
                          flexShrink: 0, marginTop: "5px",
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--midnight-ink)", lineHeight: 1.3 }}>{n.judul}</p>
                            <span style={{
                              fontSize: "9px", fontWeight: 600,
                              background: p.badge, color: p.text,
                              borderRadius: "4px", padding: "2px 5px", flexShrink: 0,
                            }}>
                              {n.prioritas.toUpperCase()}
                            </span>
                          </div>
                          <p style={{ fontSize: "11px", color: "var(--slate)", marginTop: "2px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.pesan}</p>
                          <p style={{ fontSize: "10px", color: "var(--mist)", marginTop: "4px" }}>
                            {new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <Link
                href="/dashboard/notifikasi"
                onClick={() => setShowNotif(false)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
                  padding: "10px", fontSize: "12px", fontWeight: 500,
                  color: "var(--cobalt-surface)", borderTop: "1px solid var(--frost-border)",
                  textDecoration: "none", transition: "background 0.1s",
                }}
              >
                Lihat Semua
                <span style={{ display: "flex", color: "var(--cobalt-surface)" }}>{Ic.chevronRight}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Profile */}
        <div style={{ position: "relative" }} ref={profileRef}>
          <button
            onClick={() => { setShowProfile((v) => !v); setShowNotif(false); }}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "5px 10px 5px 6px", borderRadius: "8px",
              border: "1px solid var(--frost-border)",
              background: showProfile ? "var(--lavender-wash)" : "transparent",
              cursor: "pointer", transition: "background 0.15s", fontFamily: "inherit",
            }}
          >
            <div style={{
              width: "26px", height: "26px", borderRadius: "6px",
              background: "var(--electric-blue)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "10px", fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div className="hidden sm:block" style={{ textAlign: "left" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--midnight-ink)", lineHeight: 1.2, whiteSpace: "nowrap" }}>{nama}</p>
              <p style={{ fontSize: "10px", color: "var(--mist)", lineHeight: 1.2 }}>
                {ROLE_LABEL[role] ?? role}
              </p>
            </div>
            <span style={{
              display: "flex", color: "var(--mist)",
              transform: showProfile ? "rotate(180deg)" : "none", transition: "transform 0.2s",
            }}>
              {Ic.chevronDown}
            </span>
          </button>

          {/* Profile dropdown */}
          {showProfile && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0,
              width: "210px", background: "var(--paper)",
              border: "1px solid var(--frost-border)", borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(9,17,53,0.12), 0 2px 8px rgba(9,17,53,0.06)",
              zIndex: 200, overflow: "hidden",
            }}>
              <div style={{ padding: "16px", borderBottom: "1px solid var(--frost-border)", textAlign: "center" }}>
                <div style={{
                  width: "44px", height: "44px", borderRadius: "10px",
                  background: "var(--electric-blue)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px", fontWeight: 700, margin: "0 auto 10px",
                }}>
                  {initials}
                </div>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--midnight-ink)", margin: 0 }}>{nama}</p>
                <p style={{ fontSize: "11px", color: "var(--mist)", margin: "2px 0 0" }}>NIP: {nip}</p>
                <span style={{
                  display: "inline-block", marginTop: "6px",
                  fontSize: "9px", fontWeight: 700,
                  background: "var(--lavender-wash)", color: "var(--electric-blue)",
                  border: "1px solid var(--frost-border)",
                  borderRadius: "9999px", padding: "2px 8px",
                }}>
                  {(ROLE_LABEL[role] ?? role).toUpperCase()}
                </span>
              </div>

              <div style={{ padding: "4px 0" }}>
                <Link
                  href="/dashboard/profile"
                  onClick={() => setShowProfile(false)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 14px", fontSize: "12px",
                    color: "var(--midnight-ink)", textDecoration: "none",
                    transition: "background 0.1s",
                  }}
                >
                  <div style={{
                    width: "28px", height: "28px", borderRadius: "7px",
                    background: "var(--lavender-wash)", border: "1px solid var(--frost-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, color: "var(--midnight-ink)",
                  }}>
                    {Ic.person}
                  </div>
                  <div>
                    <p style={{ fontWeight: 500, fontSize: "12px", color: "var(--midnight-ink)", margin: 0 }}>Edit Profil</p>
                    <p style={{ fontSize: "10px", color: "var(--mist)", margin: 0 }}>Ubah data dan password</p>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
