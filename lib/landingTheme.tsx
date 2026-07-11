"use client";

import { useCallback, useSyncExternalStore } from "react";

/* ── Mode tema halaman publik SIM-KGB (landing + login) ──────────────────
   Preferensi disimpan di localStorage; default mengikuti preferensi sistem.
   Dibaca lewat useSyncExternalStore agar SSR-safe (server merender "light",
   klien menyesuaikan setelah hidrasi) dan ikut berubah saat preferensi
   sistem atau tab lain mengganti tema.                                     */
export type ThemeMode = "light" | "dark";
const STORAGE_KEY = "kgb-theme";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  listeners.add(cb);
  window.addEventListener("storage", cb);
  mq.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
    mq.removeEventListener("change", cb);
  };
}

function getSnapshot(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const getServerSnapshot = (): ThemeMode => "light";

export function useThemeMode(): [ThemeMode, () => void] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, getSnapshot() === "light" ? "dark" : "light");
    emit();
  }, []);

  return [mode, toggle];
}

/* ── Tombol pengalih tema ────────────────────────────────────────────────── */
export function ThemeToggle({ mode, onToggle }: { mode: ThemeMode; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="kgb-icon-btn"
      aria-label={mode === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"}
      title={mode === "dark" ? "Mode terang" : "Mode gelap"}
    >
      {mode === "dark" ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.4" />
          <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.6 14.2A8.6 8.6 0 0 1 9.8 3.4a8.6 8.6 0 1 0 10.8 10.8z" />
        </svg>
      )}
    </button>
  );
}

/* ── Design tokens + motion (di-inject sebagai <style> oleh tiap halaman) ──
   Semua warna dirujuk lewat CSS variables sehingga peralihan tema cukup
   mengganti atribut data-kgb-theme dan dianimasikan murni oleh CSS.        */
export const themeCss = `
  *, *::before, *::after { box-sizing: border-box; }

  .kgb-scene {
    /* ── Light: ivory hangat + tinta navy + aksen emas ── */
    --bg0:        #faf9f5;
    --bg1:        #f0eee6;
    --surface:    rgba(255,255,255,0.82);
    --surface2:   rgba(15,23,42,0.035);
    --field:      rgba(255,255,255,0.9);
    --hair:       rgba(15,23,42,0.10);
    --hair-soft:  rgba(15,23,42,0.06);
    --text:       #101828;
    --soft:       #3d4a5e;
    --dim:        #71809a;
    --gold:       #a9821f;
    --gold-hi:    #c9a227;
    --gold-ink:   #8a6a12;
    --gold-soft:  rgba(169,130,31,0.34);
    --gold-wash:  rgba(201,162,39,0.10);
    --glow1:      rgba(201,162,39,0.16);
    --glow2:      rgba(37,99,235,0.09);
    --grid-dot:   rgba(15,23,42,0.16);
    --shadow:     0 24px 70px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.05);
    --btn-ink:    #211903;
    --st-ok:      #047857; --st-ok-bg:   rgba(16,185,129,0.10);
    --st-info:    #1d4ed8; --st-info-bg: rgba(59,130,246,0.10);
    --st-warn:    #b45309; --st-warn-bg: rgba(245,158,11,0.12);
    --st-bad:     #b91c1c; --st-bad-bg:  rgba(239,68,68,0.09);
    color-scheme: light;
    background: linear-gradient(180deg, var(--bg0) 0%, var(--bg1) 100%);
    color: var(--text);
    transition: background .5s ease, color .5s ease;
  }

  .kgb-scene[data-kgb-theme="dark"] {
    /* ── Dark: navy pekat + emas ── */
    --bg0:        #060b16;
    --bg1:        #0b1728;
    --surface:    rgba(14,27,46,0.74);
    --surface2:   rgba(255,255,255,0.035);
    --field:      rgba(5,12,24,0.62);
    --hair:       rgba(255,255,255,0.10);
    --hair-soft:  rgba(255,255,255,0.06);
    --text:       #eef3fb;
    --soft:       #b9c7db;
    --dim:        #8496b0;
    --gold:       #c9a227;
    --gold-hi:    #e3c05a;
    --gold-ink:   #e3c05a;
    --gold-soft:  rgba(201,162,39,0.36);
    --gold-wash:  rgba(201,162,39,0.09);
    --glow1:      rgba(201,162,39,0.13);
    --glow2:      rgba(37,99,235,0.13);
    --grid-dot:   rgba(255,255,255,0.075);
    --shadow:     0 28px 80px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.35);
    --btn-ink:    #1b1503;
    --st-ok:      #34d399; --st-ok-bg:   rgba(16,185,129,0.13);
    --st-info:    #60a5fa; --st-info-bg: rgba(59,130,246,0.14);
    --st-warn:    #fbbf24; --st-warn-bg: rgba(245,158,11,0.13);
    --st-bad:     #f87171; --st-bad-bg:  rgba(239,68,68,0.13);
    color-scheme: dark;
  }

  .kgb-scene input::placeholder { color: var(--dim); opacity: .75; }

  /* ── Lapisan latar ── */
  .kgb-dots {
    position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(circle, var(--grid-dot) 1px, transparent 1px);
    background-size: 26px 26px;
    -webkit-mask-image: radial-gradient(ellipse 70% 62% at 50% 38%, #000 0%, transparent 78%);
            mask-image: radial-gradient(ellipse 70% 62% at 50% 38%, #000 0%, transparent 78%);
  }
  .kgb-orb {
    position: absolute; border-radius: 50%; pointer-events: none;
    filter: blur(70px); will-change: transform, opacity;
  }
  .kgb-orb-a {
    width: 560px; height: 560px; top: -220px; left: -140px;
    background: radial-gradient(circle, var(--glow1) 0%, transparent 65%);
    animation: kgbFloatA 16s ease-in-out infinite alternate;
  }
  .kgb-orb-b {
    width: 640px; height: 640px; bottom: -280px; right: -180px;
    background: radial-gradient(circle, var(--glow2) 0%, transparent 65%);
    animation: kgbFloatB 20s ease-in-out infinite alternate;
  }

  /* ── Teks emas berkilau ── */
  .kgb-shimmer {
    background: linear-gradient(110deg,
      var(--gold-ink) 0%, var(--gold-hi) 32%, #f2e2a4 50%, var(--gold-hi) 68%, var(--gold-ink) 100%);
    background-size: 220% 100%;
    -webkit-background-clip: text; background-clip: text; color: transparent;
    animation: kgbShimmer 5.5s linear infinite;
  }

  /* ── Tombol ikon kaca (toggle tema, dsb.) ── */
  .kgb-icon-btn {
    width: 34px; height: 34px; border-radius: 50%;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--surface); color: var(--soft);
    border: 1px solid var(--hair); cursor: pointer;
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    transition: color .2s, border-color .2s, transform .2s, box-shadow .2s;
    flex-shrink: 0;
  }
  .kgb-icon-btn:hover { color: var(--gold-hi); border-color: var(--gold-soft); transform: translateY(-1px); }

  /* ── Pill kaca (tautan Masuk / kembali) ── */
  .kgb-pill {
    display: inline-flex; align-items: center; gap: 7px;
    height: 34px; padding: 0 15px; border-radius: 9999px;
    background: var(--surface); color: var(--soft);
    border: 1px solid var(--hair); text-decoration: none;
    font-size: 12px; font-weight: 600; letter-spacing: .01em;
    backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    transition: color .2s, border-color .2s, transform .2s, box-shadow .2s;
    white-space: nowrap;
  }
  .kgb-pill:hover {
    color: var(--text); border-color: var(--gold-soft);
    transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.10);
  }

  /* ── Tombol emas utama ── */
  .kgb-gold-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    border: none; border-radius: 12px; cursor: pointer;
    background: linear-gradient(135deg, var(--gold-hi) 0%, var(--gold) 55%, var(--gold) 100%);
    color: var(--btn-ink); font-family: inherit; font-weight: 700;
    letter-spacing: .01em;
    box-shadow: 0 8px 26px rgba(201,162,39,0.30), inset 0 1px 0 rgba(255,255,255,0.28);
    transition: transform .2s, box-shadow .2s, filter .2s;
  }
  .kgb-gold-btn:hover:not(:disabled) {
    transform: translateY(-1.5px);
    box-shadow: 0 12px 32px rgba(201,162,39,0.40), inset 0 1px 0 rgba(255,255,255,0.28);
    filter: brightness(1.04);
  }
  .kgb-gold-btn:active:not(:disabled) { transform: translateY(0); }
  .kgb-gold-btn:disabled { cursor: not-allowed; opacity: .55; box-shadow: none; }

  /* ── Field input ── */
  .kgb-fld-wrap { position: relative; }
  .kgb-fld {
    width: 100%; font-family: inherit; font-size: 13.5px; color: var(--text);
    background: var(--field); border: 1.5px solid var(--hair);
    border-radius: 12px; outline: none;
    transition: border-color .18s, box-shadow .18s, background .5s ease;
  }
  .kgb-fld:focus { border-color: var(--gold-hi); box-shadow: 0 0 0 4px var(--gold-wash); }
  .kgb-fld-ic {
    position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
    color: var(--dim); display: flex; transition: color .18s; pointer-events: none;
  }
  .kgb-fld-wrap:focus-within .kgb-fld-ic { color: var(--gold-hi); }

  /* ── Motion ── */
  @keyframes kgbRise {
    from { opacity: 0; transform: translateY(22px); filter: blur(6px); }
    to   { opacity: 1; transform: none; filter: blur(0); }
  }
  @keyframes kgbShimmer { to { background-position: -220% 0; } }
  @keyframes kgbBlink   { 0%,100% { opacity: 1 } 50% { opacity: 0 } }
  @keyframes kgbSpin    { to { transform: rotate(360deg) } }
  @keyframes kgbPulse   { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.45) } 70% { box-shadow: 0 0 0 6px rgba(34,197,94,0) } }
  @keyframes kgbFloatA  { from { transform: translate(0,0) scale(1) } to { transform: translate(70px,50px) scale(1.12) } }
  @keyframes kgbFloatB  { from { transform: translate(0,0) scale(1.08) } to { transform: translate(-80px,-55px) scale(1) } }
  @keyframes kgbShake {
    10%,90% { transform: translateX(-1px) } 20%,80% { transform: translateX(2px) }
    30%,50%,70% { transform: translateX(-3px) } 40%,60% { transform: translateX(3px) }
  }
  @keyframes kgbModalIn {
    from { opacity: 0; transform: translateY(16px) scale(.97); }
    to   { opacity: 1; transform: none; }
  }

  .kgb-rise { animation: kgbRise .7s cubic-bezier(.22,1,.36,1) both; }
  .kgb-d1 { animation-delay: .08s } .kgb-d2 { animation-delay: .16s }
  .kgb-d3 { animation-delay: .24s } .kgb-d4 { animation-delay: .34s }
  .kgb-d5 { animation-delay: .44s } .kgb-d6 { animation-delay: .56s }

  @media (prefers-reduced-motion: reduce) {
    .kgb-scene, .kgb-scene *, .kgb-scene *::before, .kgb-scene *::after {
      animation-duration: .01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: .01ms !important;
    }
  }
`;
