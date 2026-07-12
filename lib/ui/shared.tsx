import Image from "next/image";

/* ── Palette ─────────────────────────────────────────────────────────────── */
export const C = {
  ink:    "#0b1224",
  blue:   "#1254a7",
  sky:    "#2563eb",
  slate:  "#475569",
  muted:  "#64748b",
  silver: "#94a3b8",
  line:   "#e2e8f0",
  cloud:  "#f1f5f9",
  snow:   "#f8fafc",
  white:  "#ffffff",
};

export const NAMA_KANWIL =
  "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan";

/* Versi ringkas untuk ruang sempit di UI (badge, header, footer, mobile).
   Nama lengkap tetap dipakai pada dokumen/naskah resmi. */
export const NAMA_KANWIL_SINGKAT = "Kanwil Ditjenpas Kalimantan Selatan";

export const fmt = (s: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(s).toLocaleDateString("id-ID", opts ?? { day: "numeric", month: "long", year: "numeric" });

/* ── Icons ──────────────────────────────────────────────────────────────── */
export const Ic = {
  search:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  arrow:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  arrowSm: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  back:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>,
  spin:    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "spin .7s linear infinite" }}><path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/></svg>,
  warn:    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg>,
  lock:    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM8 8V6a4 4 0 0 1 8 0v2H8z"/></svg>,
  check:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  grid:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  trend:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>,
  home:    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/></svg>,
  store:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 3 0"/><path d="M9 20v-5h6v5"/></svg>,
  award:   <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 13.5L7 22l5-3 5 3-1.5-8.5"/></svg>,
  clock:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
};

/* Rasio asli crest IMIPAS (icons.svg = 141 x 112), dijaga agar tidak gepeng */
const LOGO_RATIO = 141 / 112;
export function LogoMark({ height, priority = false }: { height: number; priority?: boolean }) {
  return (
    <Image
      src="/icons.svg"
      alt="Logo"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      priority={priority}
      style={{ flexShrink: 0, display: "block" }}
    />
  );
}

/* ── BrandMark · logo tanpa latar belakang ─────────────────────────────────
   Logo umum (crest IMIPAS) tampil polos tanpa kotak/latar.                    */
export function BrandMark({
  size = 28,
  title = "Portal Layanan Digital",
  subtitle = NAMA_KANWIL,
  titleSize = 13,
}: {
  size?: number;
  title?: string;
  subtitle?: string;
  titleSize?: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
      <LogoMark height={size} priority />
      <div>
        <div style={{ fontSize: `${titleSize}px`, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
          {title}
        </div>
        <div style={{ fontSize: "9.5px", color: C.silver, lineHeight: 1.25, letterSpacing: "0.01em", maxWidth: "320px" }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

/* ── Footer ────────────────────────────────────────────────────────────── */
export function LandingFooter() {
  return (
    <footer style={{
      borderTop: `1px solid ${C.line}`,
      padding: "18px clamp(20px,5vw,72px)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: "8px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
        <LogoMark height={18} />
        <span style={{ fontSize: "11px", color: C.silver }}>
          {`© ${new Date().getFullYear()} ${NAMA_KANWIL}`}
        </span>
      </div>
      <span style={{ fontSize: "11px", color: C.silver }}>
        Kementerian Imigrasi dan Pemasyarakatan RI
      </span>
    </footer>
  );
}

/* ── Akses terbatas badge ──────────────────────────────────────────────── */
export function AksesBadge() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      fontSize: "11px", color: C.muted, fontWeight: 500,
      background: C.snow, border: `1px solid ${C.line}`,
      borderRadius: "9999px", padding: "4px 10px",
    }}>
      <span style={{ color: C.silver, display: "flex" }}>{Ic.lock}</span>
      Akses terbatas
    </div>
  );
}

/* ── Keyframes & utilitas animasi bersama ──────────────────────────────── */
export const sharedKeyframes = `
  *, *::before, *::after { box-sizing: border-box; }
  @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes spin   { to{transform:rotate(360deg)} }
  @keyframes riseIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
  @keyframes glow   { 0%,100%{opacity:.35} 50%{opacity:.55} }
  .fu  { animation: riseIn .55s cubic-bezier(.22,1,.36,1) both }
  .d1  { animation-delay: .06s }
  .d2  { animation-delay: .13s }
  .d3  { animation-delay: .20s }
  .d4  { animation-delay: .28s }
  .d5  { animation-delay: .36s }
  .d6  { animation-delay: .44s }
`;
