"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import Sidebar from "./Sidebar";
import { RoleContext, UserContext } from "./RoleContext";
import { useThemeMode } from "@/lib/landingTheme";

const TICK_INTERVAL = 10 * 1000;
const WARN_LEAD     = 2 * 60 * 1000; // peringatan muncul 2 menit sebelum logout

interface DashboardShellProps {
  nama: string;
  nip: string;
  role: string;
  /** Durasi idle (menit) sebelum auto-logout; dari Pengaturan. Default 60. */
  sesiTimeoutMenit?: number;
  children: React.ReactNode;
}

export default function DashboardShell({ nama, nip, role, sesiTimeoutMenit = 60, children }: DashboardShellProps) {
  const IDLE_LIMIT = Math.max(5, sesiTimeoutMenit) * 60 * 1000;
  const WARN_AT    = Math.max(0, IDLE_LIMIT - WARN_LEAD);

  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [countdown, setCountdown]             = useState(120);
  const lastActivityRef = useRef<number>(0);
  const warningShownAt  = useRef<number | null>(null);
  const [themeMode] = useThemeMode();

  // Terapkan mode tema ke <html> agar token dashboard di globals.css aktif;
  // dibersihkan saat keluar dashboard supaya halaman publik tidak terpengaruh.
  useEffect(() => {
    document.documentElement.setAttribute("data-dash-theme", themeMode);
    return () => {
      document.documentElement.removeAttribute("data-dash-theme");
    };
  }, [themeMode]);

  useEffect(() => { lastActivityRef.current = Date.now(); }, []);

  const resetIdle = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showIdleWarning) {
      setShowIdleWarning(false);
      warningShownAt.current = null;
    }
  }, [showIdleWarning]);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, resetIdle));
  }, [resetIdle]);

  useEffect(() => {
    const tick = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_LIMIT) {
        clearInterval(tick);
        signOut({ callbackUrl: "/login" });
        return;
      }
      if (idle >= WARN_AT) {
        if (!warningShownAt.current) {
          warningShownAt.current = Date.now();
          setShowIdleWarning(true);
        }
        setCountdown(Math.max(0, Math.ceil((IDLE_LIMIT - idle) / 1000)));
      }
    }, TICK_INTERVAL);
    return () => clearInterval(tick);
  }, [IDLE_LIMIT, WARN_AT]);

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--lavender-wash)" }}>

      {/* Idle warning */}
      {showIdleWarning && (
        <>
          <div style={{ position: "fixed", inset: 0, background: "rgba(9,17,53,0.4)", backdropFilter: "blur(4px)", zIndex: 9998 }} />
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <div style={{ background: "var(--paper)", border: "1px solid var(--frost-border)", borderRadius: "12px", width: "100%", maxWidth: "340px", padding: "24px", display: "flex", flexDirection: "column", gap: "16px", boxShadow: "0 20px 60px rgba(9,17,53,0.18)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "9px", background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#b45309">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--midnight-ink)", margin: 0 }}>Sesi Akan Berakhir</p>
                  <p style={{ fontSize: "11px", color: "var(--mist)", margin: 0 }}>Tidak ada aktivitas terdeteksi</p>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "var(--slate)", lineHeight: 1.5, margin: 0 }}>
                Anda akan otomatis keluar dalam{" "}
                <span style={{ fontWeight: 600, color: "var(--st-amber)" }}>
                  {Math.floor(countdown / 60) > 0 ? `${Math.floor(countdown / 60)} menit ` : ""}
                  {countdown % 60} detik
                </span>{" "}
                karena tidak ada aktivitas.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => signOut({ callbackUrl: "/login" })} className="cb-btn-ghost" style={{ flex: 1, fontSize: "12px", padding: "9px" }}>
                  Logout Sekarang
                </button>
                <button onClick={resetIdle} className="cb-btn" style={{ flex: 1, fontSize: "12px", padding: "9px" }}>
                  Tetap Login
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Sidebar (self-contained: handles open/collapsed + notifications) */}
      <Sidebar role={role} nama={nama} nip={nip} />

      {/* Main content */}
      <main style={{ flex: 1, overflowY: "auto", padding: "20px", minWidth: 0 }}>
        <RoleContext.Provider value={role}>
          <UserContext.Provider value={{ nama, nip, role }}>
            {children}
          </UserContext.Provider>
        </RoleContext.Provider>
      </main>
    </div>
  );
}
