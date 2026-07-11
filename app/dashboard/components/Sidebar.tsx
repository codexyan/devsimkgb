"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { usePageTransition } from "@/lib/ui";
import { ROLES, ROLE_LABEL } from "@/lib/auth";
import { useThemeMode } from "@/lib/landingTheme";

interface SidebarProps {
  role: string;
  nama: string;
  nip: string;
}

interface Notif {
  id: string;
  judul: string;
  pesan: string;
  prioritas: string;
  dibaca: boolean;
  createdAt: string;
  linkHref?: string;
}

/* ── Icons ────────────────────────────────────────────────────────────────── */
const Ic = {
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>,
  document:  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>,
  people:    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
  chart:     <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z"/></svg>,
  book:      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>,
  person:    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
  history:   <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.25 2.52.77-1.28-3.52-2.09V8H12z"/></svg>,
  lock:      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>,
  shield:    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>,
  bell:      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>,
  edit:      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>,
  logout:    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg>,
  chevLeft:  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>,
  chevRight: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>,
  menu:      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>,
  close:     <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>,
  gear:      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>,
  sun:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="4.4"/><path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7"/></svg>,
  moon:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20.6 14.2A8.6 8.6 0 0 1 9.8 3.4a8.6 8.6 0 1 0 10.8 10.8z"/></svg>,
  chevDown:  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>,
  dot:       <svg width="7" height="7" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="3"/></svg>,
};

/* ── Menus ────────────────────────────────────────────────────────────────── */
type Leaf  = { href: string; label: string; icon: React.ReactNode };
type Group = { groupLabel: string; icon: React.ReactNode; children: Leaf[] };
type Entry = Leaf | Group;
const isGroup = (e: Entry): e is Group => "children" in e;

// Grup "Data": data induk pegawai + proses KGB dalam satu tempat, karena
// keduanya berpusat pada entitas yang sama (peran KGB & admin).
const grupKepegawaian: Group = {
  groupLabel: "Data",
  icon: Ic.people,
  children: [
    { href: "/dashboard/pegawai", label: "Data Pegawai", icon: Ic.people    },
    { href: "/dashboard/kgb",     label: "Proses KGB",   icon: Ic.document  },
  ],
};

// Super Admin: akses penuh, termasuk modul Hukdis. (sdm_kgb TIDAK — hukdis
// hanya untuk superAdmin & sdm_hukdis, lihat canManageHukdis.)
const menuUtama: Entry[] = [
  { href: "/dashboard", label: "Dashboard", icon: Ic.dashboard },
  grupKepegawaian,
  { href: "/dashboard/hukdis",  label: "Hukuman Disiplin", icon: Ic.shield },
  { href: "/dashboard/laporan", label: "Laporan", icon: Ic.chart },
];
const menuSdmKgb: Entry[] = [
  { href: "/dashboard", label: "Dashboard", icon: Ic.dashboard },
  grupKepegawaian,
  { href: "/dashboard/laporan", label: "Laporan", icon: Ic.chart },
];

const menuKeuanganItems: Entry[] = [
  { href: "/dashboard",                  label: "Dashboard",         icon: Ic.dashboard },
  { href: "/dashboard/keuangan",         label: "Keuangan",          icon: Ic.lock      },
  { href: "/dashboard/keuangan/riwayat", label: "Riwayat Aktivitas", icon: Ic.history   },
];
// Peran Hukdis: modul Hukuman Disiplin mandiri + browse pegawai + konfigurasi jenis.
const menuSdmHukdis: Entry[] = [
  { href: "/dashboard",                    label: "Dashboard",        icon: Ic.dashboard },
  { href: "/dashboard/hukdis",             label: "Hukuman Disiplin", icon: Ic.shield    },
  { href: "/dashboard/pegawai",            label: "Data Pegawai",     icon: Ic.people    },
  { href: "/dashboard/hukdis/konfigurasi", label: "Jenis Hukdis",     icon: Ic.lock      },
];
const menuKeuanganSub = [
  { href: "/dashboard/keuangan",         label: "Keuangan",          icon: Ic.lock    },
  { href: "/dashboard/keuangan/riwayat", label: "Riwayat Aktivitas", icon: Ic.history },
];
const menuBantuan = [
  { href: "/dashboard/panduan", label: "Panduan", icon: Ic.book },
];
const menuAdmin = [
  { href: "/dashboard/users",         label: "Pengguna",      icon: Ic.person  },
  { href: "/dashboard/log-aktivitas", label: "Log Aktivitas", icon: Ic.history },
  { href: "/dashboard/pengaturan",    label: "Pengaturan",    icon: Ic.gear    },
];

/* ── Palet panel sidebar (selalu navy gelap, di kedua tema) ───────────────── */
const SB = {
  bg:        "linear-gradient(180deg, #0e1e33 0%, #0a1526 100%)",
  hair:      "rgba(255,255,255,0.07)",
  text:      "#8ea3c0",
  icon:      "#6b81a1",
  hover:     "#dce6f5",
  active:    "#ffffff",
  activeBg:  "rgba(201,162,39,0.12)",
  gold:      "#c9a227",
  goldHi:    "#e0bd54",
  label:     "#51678a",
  danger:    "#f08a8a",
};

/* ── NavItem ──────────────────────────────────────────────────────────────── */
function NavItem({
  href, label, icon, isActive, expanded, onClose, indent = false,
}: {
  href: string; label: string; icon: React.ReactNode;
  isActive: boolean; expanded: boolean; onClose: () => void; indent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      title={!expanded ? label : undefined}
      className={isActive ? "sb-item sb-active" : "sb-item"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: expanded ? "10px" : 0,
        justifyContent: expanded ? "flex-start" : "center",
        padding: expanded ? (indent ? "7px 12px 7px 20px" : "8px 12px 8px 14px") : "9px",
        margin: indent ? "1px 10px 1px 18px" : "1px 10px",
        borderRadius: "9px",
        fontSize: indent ? "12.5px" : "13px",
        fontWeight: isActive ? 600 : 400,
        color: isActive ? SB.active : SB.text,
        background: isActive ? SB.activeBg : "transparent",
        textDecoration: "none",
        whiteSpace: "nowrap",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Left accent bar on active */}
      {isActive && (
        <span style={{
          position: "absolute",
          left: 0,
          top: "6px",
          bottom: "6px",
          width: "3px",
          borderRadius: "0 3px 3px 0",
          background: `linear-gradient(180deg, ${SB.goldHi}, ${SB.gold})`,
        }} />
      )}
      <span className="sb-ic" style={{
        color: isActive ? SB.goldHi : SB.icon,
        flexShrink: 0,
        display: "flex",
        transform: indent ? "scale(0.88)" : "none",
      }}>
        {icon}
      </span>
      {expanded && (
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "0.01em" }}>
          {label}
        </span>
      )}
    </Link>
  );
}

/* ── NavGroup : header collapsible + anak ter-indentasi ─────────────────────
   Saat sidebar diciutkan (rail ikon), anak-anak tampil sebagai item ikon biasa
   (tanpa chrome grup) agar tetap terjangkau.                                  */
function NavGroup({
  entry, pathname, expanded, onClose,
}: {
  entry: Group; pathname: string; expanded: boolean; onClose: () => void;
}) {
  const anyActive = entry.children.some((c) => pathname === c.href);
  // manual = null → ikuti anyActive (auto-buka saat rute anak aktif);
  // sekali di-klik, hormati pilihan manual. Menghindari setState-in-effect.
  const [manual, setManual] = useState<boolean | null>(null);
  const open = manual ?? anyActive;

  if (!expanded) {
    return (
      <>
        {entry.children.map((c) => (
          <NavItem key={c.href} {...c} isActive={pathname === c.href} expanded={false} onClose={onClose} />
        ))}
      </>
    );
  }

  return (
    <div>
      <button
        onClick={() => setManual(!open)}
        className={anyActive && !open ? "sb-item sb-active" : "sb-item"}
        style={{
          width: "calc(100% - 20px)",
          display: "flex", alignItems: "center", gap: "10px",
          padding: "8px 12px 8px 14px", margin: "1px 10px",
          borderRadius: "9px", fontSize: "13px",
          fontWeight: anyActive ? 600 : 400,
          color: anyActive ? SB.active : SB.text,
          background: anyActive && !open ? SB.activeBg : "transparent",
          border: "none", cursor: "pointer", fontFamily: "inherit",
          whiteSpace: "nowrap", overflow: "hidden", position: "relative",
        }}
      >
        <span className="sb-ic" style={{ color: anyActive ? SB.goldHi : SB.icon, flexShrink: 0, display: "flex" }}>
          {entry.icon}
        </span>
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "0.01em" }}>
          {entry.groupLabel}
        </span>
        <span style={{ flexShrink: 0, display: "flex", color: SB.label, transform: open ? "none" : "rotate(-90deg)", transition: "transform .18s" }}>
          {Ic.chevDown}
        </span>
      </button>
      <div style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows .22s cubic-bezier(.22,1,.36,1)",
      }}>
        <div style={{ overflow: "hidden" }}>
          {entry.children.map((c) => (
            <NavItem key={c.href} {...c} isActive={pathname === c.href} expanded onClose={onClose} indent />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Garis pemisah tipis ──────────────────────────────────────────────────── */
function Sep() {
  return <div style={{ height: "1px", background: SB.hair, margin: "8px 14px" }} />;
}

/* ── Label grup menu ──────────────────────────────────────────────────────── */
function GroupLabel({ text, expanded }: { text: string; expanded: boolean }) {
  if (!expanded)
    return <div style={{ height: "1px", background: SB.hair, margin: "8px 14px" }} />;
  return (
    <p style={{
      fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.14em",
      textTransform: "uppercase", color: SB.label,
      margin: "12px 0 3px", padding: "0 24px",
    }}>
      {text}
    </p>
  );
}

/* ── Main Sidebar ─────────────────────────────────────────────────────────── */
export default function Sidebar({ role, nama, nip }: SidebarProps) {
  const pathname          = usePathname();
  const router            = useRouter();
  const triggerTransition = usePageTransition();

  const [isOpen,      setIsOpen]      = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [notifList,   setNotifList]   = useState<Notif[]>([]);
  const [unread,      setUnread]      = useState(0);
  const [showNotif,   setShowNotif]   = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [themeMode, toggleTheme]      = useThemeMode();

  const notifRef   = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const expanded = isOpen || !isCollapsed;

  const initials = nama
    ? nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  async function fetchNotif() {
    try {
      const res  = await fetch("/api/notifikasi");
      const data = await res.json() as any;
      if (Array.isArray(data)) {
        setNotifList(data.slice(0, 6));
        setUnread(data.filter((n: Notif) => !n.dibaca).length);
      }
    } catch { /* silent */ }
  }

  /* notif polling (dilewati untuk role hukdis yang tidak punya modul notifikasi) */
  useEffect(() => {
    if (role === ROLES.SDM_HUKDIS) return;
    const t  = setTimeout(fetchNotif, 1200);
    const iv = setInterval(fetchNotif, 5 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [role]);

  async function markRead(id: string) {
    await fetch(`/api/notifikasi/${id}/baca`, { method: "PATCH" }).catch(() => {});
    setNotifList((prev) => prev.map((n) => n.id === id ? { ...n, dibaca: true } : n));
    setUnread((c) => Math.max(0, c - 1));
  }

  /* close dropdowns on outside click */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleLogout() {
    if (triggerTransition) triggerTransition(() => signOut({ callbackUrl: "/login" }));
    else signOut({ callbackUrl: "/login" });
  }

  /* menu by role */
  const mainMenu =
    role === ROLES.KEUANGAN   ? menuKeuanganItems :
    role === ROLES.SDM_HUKDIS ? menuSdmHukdis :
    role === ROLES.SDM_KGB    ? menuSdmKgb :
    menuUtama;

  const roleLabel = ROLE_LABEL[role] ?? role;

  /* popup offset */
  const popupLeft = expanded ? "232px" : "70px";

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden"
          onClick={() => setIsOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(15,23,42,0.2)", backdropFilter: "blur(2px)" }}
        />
      )}

      {/* Mobile FAB */}
      {!isOpen && (
        <button
          className="lg:hidden"
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed", top: "14px", left: "14px", zIndex: 19,
            width: "36px", height: "36px", borderRadius: "10px",
            background: "var(--card)", border: "1px solid var(--ln1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#334155",
            boxShadow: "0 1px 6px rgba(15,23,42,0.08)",
          }}
        >
          {Ic.menu}
        </button>
      )}

      {/* Hover states panel gelap */}
      <style>{`
        .sb-item { transition: background .12s, color .12s; }
        .sb-item:hover:not(.sb-active) { background: rgba(255,255,255,0.055); color: ${SB.hover}; }
        .sb-item:hover:not(.sb-active) .sb-ic { color: ${SB.goldHi}; }
        .sb-btn { transition: background .12s, color .12s; }
        .sb-btn:hover { background: rgba(255,255,255,0.055); color: ${SB.hover}; }
        .sb-chev { transition: color .12s; }
        .sb-chev:hover { color: ${SB.goldHi} !important; }
        .sb-logout:hover { background: rgba(239,68,68,0.12); }
      `}</style>

      {/* Sidebar */}
      <aside
        style={{
          background: SB.bg,
          borderRight: "1px solid rgba(8,15,28,0.35)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          overflow: "hidden",
          transition: "width 0.22s cubic-bezier(.22,1,.36,1)",
          zIndex: 30,
        }}
        className={[
          "fixed top-0 left-0 h-screen",
          "lg:relative lg:top-auto lg:left-auto lg:h-full lg:translate-x-0",
          isCollapsed ? "lg:w-15" : "lg:w-56",
          isOpen ? "translate-x-0 w-56" : "-translate-x-full w-56",
        ].join(" ")}
      >

        {/* ── Brand ── */}
        <div style={{
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: expanded ? "space-between" : "center",
          padding: expanded ? "0 10px 0 16px" : "0 10px",
          flexShrink: 0,
          borderBottom: `1px solid ${SB.hair}`,
          position: "relative",
        }}>
          {/* Hairline emas bawah brand */}
          <span aria-hidden style={{
            position: "absolute", bottom: "-1px", left: "12%", right: "12%", height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(201,162,39,0.45), transparent)",
          }} />
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
            {/* Logo tanpa latar, gambar polos */}
            <Image
              src="/icons.svg"
              alt="Logo"
              width={30}
              height={24}
              style={{ flexShrink: 0, display: "block" }}
            />
            {expanded && (
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.2, letterSpacing: "0.05em" }}>
                SIM-KGB
              </p>
            )}
          </div>

          {/* Toggle collapse, desktop saja; mobile ditutup lewat tap overlay */}
          <button
            className="hidden lg:flex items-center justify-center sb-chev"
            onClick={() => setIsCollapsed((p) => !p)}
            title={isCollapsed ? "Perluas" : "Ciutkan"}
            style={{
              width: "24px", height: "24px", borderRadius: "6px",
              background: "transparent", border: "none",
              cursor: "pointer", color: SB.label, flexShrink: 0,
            }}
          >
            {isCollapsed ? Ic.chevRight : Ic.chevLeft}
          </button>
        </div>

        {/* ── Nav ── */}
        <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0" }}>

          {/* Main items (mendukung grup collapsible) */}
          <div>
            <GroupLabel text="Menu" expanded={expanded} />
            {mainMenu.map((item) =>
              isGroup(item) ? (
                <NavGroup
                  key={item.groupLabel}
                  entry={item}
                  pathname={pathname}
                  expanded={expanded}
                  onClose={() => setIsOpen(false)}
                />
              ) : (
                <NavItem
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href}
                  expanded={expanded}
                  onClose={() => setIsOpen(false)}
                />
              )
            )}
          </div>

          {/* Keuangan sub (super admin only) */}
          {role === ROLES.SUPER_ADMIN && (
            <>
              <GroupLabel text="Keuangan" expanded={expanded} />
              {menuKeuanganSub.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href}
                  expanded={expanded}
                  onClose={() => setIsOpen(false)}
                />
              ))}
            </>
          )}

          {/* Bantuan */}
          {role !== ROLES.KEUANGAN && (
            <>
              <GroupLabel text="Bantuan" expanded={expanded} />
              {menuBantuan.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href}
                  expanded={expanded}
                  onClose={() => setIsOpen(false)}
                />
              ))}
            </>
          )}

          {/* Admin */}
          {role === ROLES.SUPER_ADMIN && (
            <>
              <GroupLabel text="Administrasi" expanded={expanded} />
              {menuAdmin.map((item) => (
                <NavItem
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href}
                  expanded={expanded}
                  onClose={() => setIsOpen(false)}
                />
              ))}
            </>
          )}

          {/* Notifikasi (tidak untuk role hukdis) */}
          {role !== ROLES.SDM_HUKDIS && (
          <div ref={notifRef}>
            <Sep />
            <button
              onClick={() => { setShowNotif((v) => !v); setShowProfile(false); }}
              title={!expanded ? `Notifikasi${unread > 0 ? ` (${unread})` : ""}` : undefined}
              className={showNotif ? "" : "sb-btn"}
              style={{
                width: "calc(100% - 20px)",
                display: "flex",
                alignItems: "center",
                gap: expanded ? "10px" : 0,
                justifyContent: expanded ? "flex-start" : "center",
                padding: expanded ? "8px 12px 8px 14px" : "9px",
                margin: "1px 10px",
                borderRadius: "9px",
                fontSize: "13px",
                fontWeight: showNotif ? 600 : 400,
                color: showNotif ? SB.active : SB.text,
                background: showNotif ? SB.activeBg : "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                position: "relative",
              }}
            >
              <span style={{ color: showNotif ? SB.goldHi : SB.icon, flexShrink: 0, display: "flex", position: "relative" }}>
                {Ic.bell}
                {unread > 0 && (
                  <span style={{
                    position: "absolute", top: "-4px", right: "-5px",
                    minWidth: "14px", height: "14px", borderRadius: "9999px",
                    background: "#ef4444", color: "#fff",
                    fontSize: "8px", fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 2px", boxShadow: "0 0 0 1.5px #0c1830",
                  }}>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              {expanded && (
                <>
                  <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis" }}>Notifikasi</span>
                  {unread > 0 && (
                    <span style={{ minWidth: "18px", height: "18px", borderRadius: "9999px", background: "#ef4444", color: "#fff", fontSize: "9px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </>
              )}
            </button>

            {/* Notif panel */}
            {showNotif && (
              <div style={{
                position: "fixed", top: "68px", left: popupLeft,
                width: "296px",
                background: "var(--card)",
                border: "1px solid var(--ln1)",
                borderRadius: "12px",
                boxShadow: "0 4px 24px rgba(15,23,42,0.10), 0 1px 4px rgba(15,23,42,0.06)",
                zIndex: 200, overflow: "hidden",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--ln2)" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--dt1)" }}>Notifikasi</span>
                  {unread > 0 && (
                    <span style={{ fontSize: "9px", fontWeight: 700, background: "var(--tint-red-bg2)", color: "var(--st-red)", borderRadius: "9999px", padding: "2px 7px" }}>
                      {unread} baru
                    </span>
                  )}
                </div>
                <div style={{ maxHeight: "260px", overflowY: "auto" }}>
                  {notifList.length === 0 ? (
                    <div style={{ padding: "28px 14px", textAlign: "center" }}>
                      <p style={{ fontSize: "12px", color: "var(--dt4)", margin: 0 }}>Tidak ada notifikasi</p>
                    </div>
                  ) : notifList.map((n, i) => {
                    const dotColor = n.prioritas === "critical" ? "#ef4444" : n.prioritas === "warning" ? "#f59e0b" : "#3b82f6";
                    return (
                      <button
                        key={n.id}
                        onClick={() => { if (!n.dibaca) markRead(n.id); setShowNotif(false); if (n.linkHref) router.push(n.linkHref); }}
                        style={{
                          width: "100%", textAlign: "left",
                          display: "flex", alignItems: "flex-start", gap: "10px",
                          padding: "10px 14px",
                          background: n.dibaca ? "var(--card)" : "var(--sub)",
                          borderBottom: i < notifList.length - 1 ? "1px solid var(--sub)" : "none",
                          border: "none", cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: n.dibaca ? "var(--dt6)" : dotColor, flexShrink: 0, marginTop: "5px" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--dt1)", margin: 0, lineHeight: 1.3 }}>{n.judul}</p>
                          <p style={{ fontSize: "11px", color: "var(--dt3)", margin: "2px 0 0", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.pesan}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <Link href="/dashboard/notifikasi" onClick={() => setShowNotif(false)} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px", fontSize: "12px", color: "var(--accent)", borderTop: "1px solid var(--ln2)", textDecoration: "none", fontWeight: 500 }}>
                  Lihat Semua
                </Link>
              </div>
            )}
          </div>
          )}
        </nav>

        {/* ── User section ── */}
        <div style={{ borderTop: `1px solid ${SB.hair}`, flexShrink: 0, padding: "8px", display: "flex", flexDirection: "column", gap: "2px" }}>

          {/* Profile row */}
          <div ref={profileRef} style={{ position: "relative" }}>
            <button
              onClick={() => { setShowProfile((v) => !v); setShowNotif(false); }}
              title={!expanded ? nama : undefined}
              className={showProfile ? "" : "sb-btn"}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: expanded ? "10px" : 0,
                justifyContent: expanded ? "flex-start" : "center",
                padding: expanded ? "8px 10px" : "8px",
                borderRadius: "9px",
                background: showProfile ? SB.activeBg : "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{
                width: "32px", height: "32px", borderRadius: "9px",
                background: `linear-gradient(135deg, ${SB.goldHi}, ${SB.gold})`,
                color: "#1b1503",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "11px", fontWeight: 800, flexShrink: 0,
                letterSpacing: "0.02em",
                boxShadow: "0 4px 12px rgba(201,162,39,0.25)",
              }}>
                {initials}
              </div>

              {expanded && (
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#eaf0f9", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
                    {nama}
                  </p>
                  <p style={{ fontSize: "10px", color: SB.text, margin: 0, lineHeight: 1.3 }}>
                    {roleLabel}
                  </p>
                </div>
              )}
            </button>

            {/* Profile popup */}
            {showProfile && (
              <div style={{
                position: "fixed",
                bottom: "72px",
                left: popupLeft,
                width: "220px",
                background: "var(--card)",
                border: "1px solid var(--ln1)",
                borderRadius: "12px",
                boxShadow: "0 4px 24px rgba(15,23,42,0.10), 0 1px 4px rgba(15,23,42,0.06)",
                zIndex: 200,
                overflow: "hidden",
              }}>
                <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--ln2)" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--dt1)", margin: 0, lineHeight: 1.3 }}>{nama}</p>
                  <p style={{ fontSize: "10px", color: "var(--dt4)", margin: "2px 0 6px" }}>NIP {nip}</p>
                  <span style={{
                    fontSize: "9px", fontWeight: 600,
                    background: "var(--accent-bg)", color: "var(--accent)",
                    borderRadius: "9999px", padding: "2px 8px",
                    letterSpacing: "0.05em",
                  }}>
                    {roleLabel}
                  </span>
                </div>
                <div style={{ padding: "6px" }}>
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setShowProfile(false)}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "8px 10px", borderRadius: "8px",
                      color: "#334155", textDecoration: "none",
                      transition: "background 0.1s",
                    }}
                  >
                    <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "var(--sub)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--dt3)" }}>
                      {Ic.edit}
                    </div>
                    <div>
                      <p style={{ fontSize: "12px", fontWeight: 500, color: "var(--dt1)", margin: 0 }}>Edit Profil</p>
                      <p style={{ fontSize: "10px", color: "var(--dt4)", margin: 0 }}>Ubah data dan password</p>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Toggle mode gelap/terang */}
          <button
            onClick={toggleTheme}
            title={!expanded ? (themeMode === "dark" ? "Mode terang" : "Mode gelap") : undefined}
            className="sb-btn"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: expanded ? "10px" : 0,
              justifyContent: expanded ? "flex-start" : "center",
              padding: expanded ? "7px 10px" : "7px",
              borderRadius: "9px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              color: SB.text,
            }}
          >
            <span style={{ flexShrink: 0, display: "flex", color: SB.goldHi }}>
              {themeMode === "dark" ? Ic.sun : Ic.moon}
            </span>
            {expanded && (
              <span style={{ fontSize: "12px", fontWeight: 500 }}>
                {themeMode === "dark" ? "Mode Terang" : "Mode Gelap"}
              </span>
            )}
          </button>

          {/* Logout CTA, selalu tampil */}
          <button
            onClick={handleLogout}
            title={!expanded ? "Keluar" : undefined}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: expanded ? "10px" : 0,
              justifyContent: expanded ? "flex-start" : "center",
              padding: expanded ? "7px 10px" : "7px",
              borderRadius: "9px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              color: SB.danger,
              transition: "background 0.12s",
            }}
            className="sb-logout"
          >
            <span style={{ flexShrink: 0, display: "flex", color: SB.danger, opacity: 0.85 }}>
              {Ic.logout}
            </span>
            {expanded && (
              <span style={{ fontSize: "12px", fontWeight: 500 }}>Keluar</span>
            )}
          </button>

        </div>
      </aside>
    </>
  );
}
