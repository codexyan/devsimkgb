"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { TransitionLink } from "@/lib/ui";
import { NAMA_KANWIL_SINGKAT } from "@/lib/ui";
import { themeCss, useThemeMode, ThemeToggle } from "@/lib/landingTheme";

/* ── Flat icons ─────────────────────────────────────────────────────────── */
const Ic = {
  card: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
    </svg>
  ),
  lock: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
    </svg>
  ),
  eyeOff: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.8 11.8 0 0 0 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
    </svg>
  ),
  eye: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
  ),
  warning: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  ),
  login: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 7L9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z"/>
    </svg>
  ),
  back: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M19 12H5M11 6l-6 6 6 6"/>
    </svg>
  ),
  whatsapp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, toggleMode] = useThemeMode();
  const [nip, setNip] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [nipLupa, setNipLupa] = useState("");
  const [waAdmin, setWaAdmin] = useState("");

  // Nomor WA admin diambil dari Pengaturan (endpoint publik); fallback default.
  useEffect(() => {
    fetch("/api/public/kontak")
      .then((r) => r.json() as any)
      .then((d) => { if (d?.waAdmin) setWaAdmin(d.waAdmin); })
      .catch(() => {});
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!nip || !password) { setError("NIP dan password wajib diisi"); return; }
    setLoading(true);
    const result = await signIn("credentials", { nip, password, redirect: false });
    setLoading(false);
    if (result?.error) { setError("NIP atau password salah. Periksa kembali dan coba lagi."); return; }
    router.push("/dashboard");
  }

  return (
    <div className="kgb-scene" data-kgb-theme={mode} style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        ${themeCss}
        .lg-card {
          position: relative;
          background: var(--surface);
          backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px);
          border: 1px solid var(--hair);
          border-radius: 20px;
          box-shadow: var(--shadow);
          transition: background .5s ease, border-color .5s ease;
        }
        .lg-ghost-btn {
          width: 100%; padding: 10px;
          background: transparent; border: 1px solid var(--hair);
          border-radius: 11px; font-size: 13px; font-weight: 500;
          color: var(--soft); cursor: pointer; font-family: inherit;
          transition: background .15s, border-color .15s;
        }
        .lg-ghost-btn:hover { background: var(--surface2); border-color: var(--gold-soft); }
        .lg-forgot { color: var(--gold-ink); transition: color .15s; }
        .lg-forgot:hover { color: var(--gold-hi); }
      `}</style>

      {/* ── Lapisan latar dekoratif ───────────────────────────────────── */}
      <div aria-hidden className="kgb-dots" />
      <div aria-hidden className="kgb-orb kgb-orb-a" />
      <div aria-hidden className="kgb-orb kgb-orb-b" />

      {/* ── Kontrol mengambang ────────────────────────────────────────── */}
      <header className="kgb-rise" style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px clamp(16px,4.5vw,56px)", pointerEvents: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "11px", pointerEvents: "auto" }}>
          <Image src="/icons.svg" alt="Crest IMIPAS" width={34} height={27} priority style={{ display: "block", flexShrink: 0 }} />
          <div style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.06em", color: "var(--text)" }}>SIM-KGB</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", pointerEvents: "auto" }}>
          <ThemeToggle mode={mode} onToggle={toggleMode} />
          <TransitionLink href="/kgb" className="kgb-pill">
            <span style={{ display: "flex" }}>{Ic.back}</span>
            Beranda
          </TransitionLink>
        </div>
      </header>

      {/* ── Kartu auth ────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "104px clamp(18px,5vw,72px) 48px",
      }}>
        <div style={{ width: "100%", maxWidth: "424px" }}>

          {/* Overline + heading di luar kartu */}
          <div className="kgb-rise kgb-d1" style={{ textAlign: "center", marginBottom: "26px" }}>
            <div style={{
              fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.32em",
              color: "var(--gold-ink)", textTransform: "uppercase", marginBottom: "12px",
            }}>
              Area Pengelola
            </div>
            <h1 style={{
              fontFamily: "var(--font-display), 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
              fontSize: "clamp(1.7rem,4.5vw,2.3rem)", fontWeight: 800,
              letterSpacing: "-0.03em", lineHeight: 1.15,
              color: "var(--text)", margin: 0,
            }}>
              Selamat datang <em className="kgb-shimmer" style={{ fontStyle: "normal" }}>kembali.</em>
            </h1>
          </div>

          {/* Kartu form */}
          <div className="kgb-rise kgb-d3 lg-card" style={{ padding: "clamp(22px,5.5vw,32px) clamp(20px,5vw,30px)", overflow: "hidden" }}>
            {/* Hairline emas tepi atas */}
            <span aria-hidden style={{
              position: "absolute", top: 0, left: "8%", right: "8%", height: "1px",
              background: "linear-gradient(90deg, transparent, var(--gold-soft), transparent)",
            }} />

            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "17px" }}>

              {/* NIP */}
              <div>
                <label htmlFor="login-nip" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--soft)", marginBottom: "7px", letterSpacing: "0.02em" }}>
                  NIP
                </label>
                <div className="kgb-fld-wrap">
                  <span className="kgb-fld-ic">{Ic.card}</span>
                  <input
                    id="login-nip"
                    type="text"
                    inputMode="numeric"
                    maxLength={18}
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    placeholder="Masukkan 18 digit NIP..."
                    autoComplete="username"
                    className="kgb-fld"
                    style={{ padding: "12px 14px 12px 39px" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "7px" }}>
                  <label htmlFor="login-pwd" style={{ fontSize: "12px", fontWeight: 600, color: "var(--soft)", letterSpacing: "0.02em" }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="lg-forgot"
                    style={{ fontSize: "11.5px", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit" }}
                  >
                    Lupa password?
                  </button>
                </div>
                <div className="kgb-fld-wrap">
                  <span className="kgb-fld-ic">{Ic.lock}</span>
                  <input
                    id="login-pwd"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password..."
                    autoComplete="current-password"
                    className="kgb-fld"
                    style={{ padding: "12px 42px 12px 39px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={showPwd ? "Sembunyikan password" : "Tampilkan password"}
                    style={{
                      position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: "var(--dim)",
                      padding: "10px", display: "flex", borderRadius: "8px",
                    }}
                  >
                    {showPwd ? Ic.eyeOff : Ic.eye}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: "10px",
                  background: "var(--st-bad-bg)", border: "1px solid var(--st-bad)",
                  borderRadius: "11px", padding: "11px 14px",
                  animation: "kgbRise .35s cubic-bezier(.22,1,.36,1) both, kgbShake .45s ease .1s",
                }}>
                  <span style={{ color: "var(--st-bad)", flexShrink: 0, marginTop: "1px", display: "flex" }}>{Ic.warning}</span>
                  <span style={{ fontSize: "12px", color: "var(--st-bad)", lineHeight: 1.45 }}>{error}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="kgb-gold-btn"
                style={{ width: "100%", padding: "13px 20px", fontSize: "14px", marginTop: "4px" }}
              >
                {loading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ animation: "kgbSpin 0.7s linear infinite" }}>
                      <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
                    </svg>
                    Memproses...
                  </>
                ) : (
                  <>
                    Masuk ke SIM-KGB
                    <span style={{ display: "flex" }}>{Ic.login}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Catatan bawah */}
          <div className="kgb-rise kgb-d5" style={{ textAlign: "center", marginTop: "22px" }}>
            <p style={{
              display: "inline-flex", alignItems: "center", gap: "7px",
              fontSize: "11.5px", color: "var(--dim)", margin: "0 0 6px",
            }}>
              <span style={{ display: "flex", color: "var(--gold-ink)" }}>{Ic.lock}</span>
              Akses terbatas
            </p>
            <p style={{ fontSize: "11px", color: "var(--dim)", opacity: .7, margin: 0 }}>
              {NAMA_KANWIL_SINGKAT}
            </p>
          </div>
        </div>
      </main>

      {/* ── Modal lupa password ───────────────────────────────────────── */}
      {showForgot && (
        <div
          onClick={() => { setShowForgot(false); setNipLupa(""); }}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(4,9,18,0.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="lg-card"
            style={{
              padding: "28px", width: "100%", maxWidth: "364px",
              animation: "kgbModalIn .35s cubic-bezier(.22,1,.36,1) both",
              overflow: "hidden",
            }}
          >
            <span aria-hidden style={{
              position: "absolute", top: 0, left: "8%", right: "8%", height: "1px",
              background: "linear-gradient(90deg, transparent, var(--gold-soft), transparent)",
            }} />

            {/* Icon */}
            <div style={{
              width: "46px", height: "46px", borderRadius: "12px",
              background: "var(--gold-wash)", border: "1px solid var(--gold-soft)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: "16px", color: "var(--gold-hi)",
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
            </div>

            <h3 style={{
              fontFamily: "var(--font-display), 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
              fontSize: "19px", fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", margin: "0 0 6px",
            }}>
              Lupa Password?
            </h3>
            <p style={{ fontSize: "13px", color: "var(--soft)", lineHeight: 1.6, margin: "0 0 20px" }}>
              Masukkan NIP Anda, lalu kirim permintaan reset melalui WhatsApp.
            </p>

            <label htmlFor="forgot-nip" style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--soft)", marginBottom: "7px" }}>
              NIP Anda
            </label>
            <input
              id="forgot-nip"
              type="text"
              inputMode="numeric"
              maxLength={18}
              value={nipLupa}
              onChange={(e) => setNipLupa(e.target.value)}
              placeholder="Masukkan NIP..."
              className="kgb-fld"
              style={{ padding: "11px 13px", marginBottom: "14px" }}
            />

            <a
              href={nipLupa.trim() && waAdmin
                ? `https://wa.me/${waAdmin}?text=Assalamualaikum Admin SIM-KGB,%0ASaya lupa password.%0ANIP: ${nipLupa.trim()}%0AMohon bantuannya.`
                : undefined}
              onClick={(e) => { if (!nipLupa.trim() || !waAdmin) e.preventDefault(); }}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                width: "100%", padding: "11px",
                background: nipLupa.trim() && waAdmin ? "#22c55e" : "var(--surface2)",
                color: nipLupa.trim() && waAdmin ? "#06270f" : "var(--dim)",
                border: "none", borderRadius: "11px",
                fontSize: "13px", fontWeight: 700,
                cursor: nipLupa.trim() && waAdmin ? "pointer" : "not-allowed",
                textDecoration: "none", marginBottom: "8px",
                transition: "background 0.15s, color 0.15s",
                fontFamily: "inherit",
                boxShadow: nipLupa.trim() && waAdmin ? "0 8px 24px rgba(34,197,94,0.25)" : "none",
              }}
            >
              {Ic.whatsapp}
              Kirim Permintaan via WhatsApp
            </a>
            {!waAdmin && (
              <p style={{ fontSize: "11px", color: "var(--dim)", textAlign: "center", margin: "0 0 8px" }}>
                Nomor kontak admin belum diatur. Hubungi Super Admin secara langsung.
              </p>
            )}

            <button
              onClick={() => { setShowForgot(false); setNipLupa(""); }}
              className="lg-ghost-btn"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
