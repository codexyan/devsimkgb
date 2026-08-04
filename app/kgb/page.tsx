"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { TransitionLink } from "@/lib/ui";
import { fmt, Ic, NAMA_KANWIL_SINGKAT } from "@/lib/ui";
import { themeCss, useThemeMode, ThemeToggle } from "@/lib/landingTheme";

/* ── Typewriter: frasa penutup headline ─────────────────────────────────── */
const WORDS = ["tepat waktu.", "transparan.", "tanpa terlewat.", "penuh kepastian."];

function TypewriterCycle() {
  const [displayed, setDisplayed] = useState("");
  const [wordIdx, setWordIdx]     = useState(0);
  const [phase, setPhase]         = useState<"typing" | "pausing" | "erasing">("typing");

  useEffect(() => {
    const word = WORDS[wordIdx];
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (displayed.length < word.length)
        t = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 90);
      else
        t = setTimeout(() => setPhase("pausing"), 2600);
    } else if (phase === "pausing") {
      t = setTimeout(() => setPhase("erasing"), 100);
    } else {
      if (displayed.length > 0)
        t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 45);
      else
        t = setTimeout(() => { setWordIdx((i) => (i + 1) % WORDS.length); setPhase("typing"); }, 320);
    }
    return () => clearTimeout(t);
  }, [displayed, phase, wordIdx]);

  return (
    <span style={{ whiteSpace: "nowrap" }}>
      <em className="kgb-shimmer" style={{ fontStyle: "normal" }}>{displayed}</em>
      <span aria-hidden style={{
        display: "inline-block", width: "3px", height: "0.78em",
        background: "var(--gold-hi)", marginLeft: "4px", verticalAlign: "baseline",
        borderRadius: "2px", animation: "kgbBlink 1.1s step-end infinite",
      }} />
    </span>
  );
}

/* ── Types ──────────────────────────────────────────────────────────────── */
interface CekResult {
  nama: string; jabatan: string; golonganRuang: string; unitKerja: string;
  tmtKgbBerikutnya: string;
  kgbTerbaru: {
    status: string; tmtKgbBaru: string; tmtKgbBerikutnya: string;
    flagRapelan: boolean; nomorSurat: string | null;
  } | null;
}

const STATUS_MAP: Record<string, { label: string; fg: string; bg: string }> = {
  belum_diproses:  { label: "Belum Diproses",  fg: "var(--st-warn)", bg: "var(--st-warn-bg)" },
  sedang_diproses: { label: "Sedang Diproses", fg: "var(--st-info)", bg: "var(--st-info-bg)" },
  selesai:         { label: "Selesai",          fg: "var(--st-ok)",   bg: "var(--st-ok-bg)" },
  ditolak:         { label: "Ditolak",          fg: "var(--st-bad)",  bg: "var(--st-bad-bg)" },
};

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function KgbLandingPage() {
  const [mode, toggleMode] = useThemeMode();
  const [nip,     setNip]     = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<CekResult | null>(null);
  const [error,   setError]   = useState("");

  // Hasil/error muncul di bawah lipatan pada layar pendek (hero di tengah
  // vertikal) — gulirkan agar langsung terlihat tanpa harus scroll manual.
  const hasilRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result || error) hasilRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result, error]);

  async function handleCek() {
    const q = nip.trim();
    if (!q) return;
    setLoading(true); setResult(null); setError("");
    try {
      const res  = await fetch(`/api/public/cek-kgb?nip=${encodeURIComponent(q)}`);
      const data = await res.json() as any;
      if (!res.ok) setError(data.error || "Data tidak ditemukan");
      else          setResult(data);
    } catch {
      setError("Gagal menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="kgb-scene" data-kgb-theme={mode} style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      fontFamily: "var(--font-inter), 'Inter', system-ui, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        ${themeCss}
        .cek-shell {
          display: flex; align-items: center; gap: 6px;
          border-radius: 18px; padding: 6px 6px 6px 16px;
          background: var(--surface);
          border: 1.5px solid var(--hair);
          backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
          transition: border-color .2s, box-shadow .2s, background .5s ease;
        }
        .cek-shell:focus-within {
          border-color: var(--gold-hi);
          box-shadow: 0 0 0 4px var(--gold-wash), 0 10px 34px rgba(0,0,0,0.08);
        }
        .cek-row { display: flex; align-items: center; gap: 11px; flex: 1; min-width: 0; }
        .cek-input {
          flex: 1; min-width: 0; background: transparent; border: none; outline: none;
          font-family: inherit; font-size: 15px; color: var(--text);
          padding: 12px 0; letter-spacing: 0.01em;
        }
        .cek-btn { padding: 12px 22px; font-size: 13.5px; flex-shrink: 0; }
        /* Mobile: input & tombol bertumpuk agar tidak saling menabrak */
        @media (max-width: 560px) {
          .cek-shell { flex-direction: column; align-items: stretch; padding: 8px; gap: 8px; border-radius: 20px; }
          .cek-row { padding: 2px 10px 0; }
          .cek-input { font-size: 16px; padding: 10px 0; } /* 16px: cegah zoom iOS */
          .cek-btn { width: 100%; padding: 13px 20px; font-size: 14px; }
        }
        .row-sep { border-bottom: 1px solid var(--hair-soft); }
        .row-sep:last-child { border-bottom: none; }
      `}</style>

      {/* ── Lapisan latar dekoratif ───────────────────────────────────── */}
      <div aria-hidden className="kgb-dots" />
      <div aria-hidden className="kgb-orb kgb-orb-a" />
      <div aria-hidden className="kgb-orb kgb-orb-b" />

      {/* ── Kontrol mengambang (bukan navbar) ─────────────────────────── */}
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
          <TransitionLink href="/login" className="kgb-pill">
            Masuk
            <span style={{ display: "flex" }}>{Ic.arrowSm}</span>
          </TransitionLink>
        </div>
      </header>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, position: "relative", zIndex: 1,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "108px clamp(18px,5vw,72px) 56px",
      }}>
        <div style={{ width: "100%", maxWidth: "640px", textAlign: "center" }}>

          {/* Badge */}
          <div className="kgb-rise kgb-d1" style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "var(--surface)", border: "1px solid var(--hair)",
            backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            borderRadius: "9999px", padding: "6px 15px 6px 11px",
            marginBottom: "34px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}>
            <span style={{
              width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e",
              flexShrink: 0, display: "inline-block", animation: "kgbPulse 2.4s ease-out infinite",
            }} />
            <span style={{ fontSize: "11.5px", color: "var(--soft)", fontWeight: 500, letterSpacing: "0.015em" }}>
              Layanan resmi · {NAMA_KANWIL_SINGKAT}
            </span>
          </div>

          {/* Overline */}
          <div className="kgb-rise kgb-d2" style={{
            fontSize: "11px", fontWeight: 700, letterSpacing: "0.32em",
            color: "var(--gold-ink)", textTransform: "uppercase", marginBottom: "18px",
          }}>
            Sistem Informasi Manajemen
          </div>

          {/* Headline */}
          <h1 className="kgb-rise kgb-d2" style={{
            fontFamily: "var(--font-display), 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
            fontSize: "clamp(2rem,6vw,3.9rem)",
            fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.08,
            color: "var(--text)", margin: "0 0 4px",
          }}>
            Kenaikan Gaji Berkala,
          </h1>
          <div className="kgb-rise kgb-d3" style={{
            fontFamily: "var(--font-display), 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
            fontSize: "clamp(2rem,6vw,3.9rem)",
            fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.14,
            color: "var(--text)", marginBottom: "24px",
          }}>
            kini <TypewriterCycle />
          </div>

          {/* Subline */}
          <p className="kgb-rise kgb-d4" style={{
            fontSize: "clamp(14px,1.8vw,15.5px)", color: "var(--dim)",
            lineHeight: 1.8, maxWidth: "480px", margin: "0 auto 42px",
          }}>
            Cukup masukkan NIP Anda. Status, jadwal, dan riwayat kenaikan gaji
            berkala tersaji dalam hitungan detik. Akurat, resmi, dan selalu diperbarui.
          </p>

          {/* Search bar */}
          <div className="kgb-rise kgb-d5 cek-shell" style={{
            marginBottom: result || error ? "22px" : "0",
          }}>
            <div className="cek-row">
              <span style={{ color: "var(--dim)", display: "flex", flexShrink: 0 }}>
                {Ic.search}
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="search"
                maxLength={18}
                placeholder="Masukkan NIP pegawai..."
                aria-label="NIP pegawai"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCek()}
                className="cek-input"
              />
            </div>
            <button
              onClick={handleCek}
              disabled={loading || !nip.trim()}
              className="kgb-gold-btn cek-btn"
            >
              {loading ? Ic.spin : Ic.arrow}
              {loading ? "Mencari" : "Cek Status"}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div ref={hasilRef} style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: "var(--st-bad-bg)", border: "1px solid var(--st-bad)",
              borderRadius: "12px", padding: "12px 16px",
              marginBottom: "24px", textAlign: "left",
              animation: "kgbRise .4s cubic-bezier(.22,1,.36,1) both, kgbShake .45s ease .1s",
            }}>
              <span style={{ color: "var(--st-bad)", display: "flex", flexShrink: 0 }}>{Ic.warn}</span>
              <span style={{ fontSize: "13px", color: "var(--st-bad)" }}>{error}</span>
            </div>
          )}

          {/* Result */}
          {result && (() => {
            const st = result.kgbTerbaru
              ? (STATUS_MAP[result.kgbTerbaru.status] ?? STATUS_MAP.belum_diproses)
              : null;
            const initials = result.nama.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

            return (
              <div ref={hasilRef} style={{
                position: "relative",
                background: "var(--surface)",
                backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                border: "1px solid var(--hair)",
                borderRadius: "18px", overflow: "hidden", textAlign: "left",
                boxShadow: "var(--shadow)",
                animation: "kgbRise .5s cubic-bezier(.22,1,.36,1) both",
                marginBottom: "24px",
              }}>
                {/* Hairline emas tepi atas */}
                <span aria-hidden style={{
                  position: "absolute", top: 0, left: "8%", right: "8%", height: "1px",
                  background: "linear-gradient(90deg, transparent, var(--gold-soft), transparent)",
                }} />

                {/* Identity */}
                <div style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "18px 20px", background: "var(--surface2)",
                  borderBottom: "1px solid var(--hair-soft)",
                }}>
                  <div style={{
                    width: "46px", height: "46px", borderRadius: "13px",
                    background: "linear-gradient(135deg, var(--gold-hi), var(--gold))",
                    color: "var(--btn-ink)", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "15px", fontWeight: 800, letterSpacing: "-0.02em",
                    boxShadow: "0 6px 18px rgba(201,162,39,0.28)",
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--text)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {result.nama}
                    </p>
                    <p style={{ fontSize: "12px", color: "var(--soft)", margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {result.jabatan}
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--dim)", margin: 0 }}>
                      Golongan {result.golonganRuang}
                    </p>
                  </div>
                </div>

                {/* Data rows */}
                {[
                  {
                    label: "Status KGB",
                    node: st ? (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: "6px",
                        fontSize: "12px", fontWeight: 600, color: st.fg,
                        background: st.bg, borderRadius: "9999px", padding: "3px 11px",
                      }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: st.fg, display: "inline-block" }} />
                        {st.label}
                      </span>
                    ) : (
                      <span style={{ fontSize: "13px", color: "var(--dim)" }}>Belum ada data</span>
                    ),
                  },
                  {
                    label: "TMT KGB Berikutnya",
                    node: <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{fmt(result.tmtKgbBerikutnya)}</span>,
                  },
                  ...(result.kgbTerbaru ? [{
                    label: "Periode KGB",
                    node: <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{fmt(result.kgbTerbaru.tmtKgbBaru, { month: "long", year: "numeric" })}</span>,
                  }] : []),
                  ...(result.kgbTerbaru?.nomorSurat ? [{
                    label: "Nomor SK",
                    node: <span style={{ fontSize: "12px", color: "var(--soft)", wordBreak: "break-all" as const }}>{result.kgbTerbaru.nomorSurat}</span>,
                  }] : []),
                ].map((row) => (
                  <div key={row.label} className="row-sep" style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    flexWrap: "wrap", gap: "6px 16px", padding: "13px clamp(16px,4vw,20px)",
                  }}>
                    <span style={{ fontSize: "12px", color: "var(--dim)", flexShrink: 0 }}>{row.label}</span>
                    <div style={{ textAlign: "right", minWidth: 0 }}>{row.node}</div>
                  </div>
                ))}

                {/* Banner rapelan */}
                {result.kgbTerbaru?.flagRapelan && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "11px 20px", background: "var(--st-warn-bg)",
                    borderTop: "1px solid var(--hair-soft)",
                  }}>
                    <span style={{ color: "var(--st-warn)", display: "flex", flexShrink: 0 }}>{Ic.warn}</span>
                    <span style={{ fontSize: "12px", color: "var(--st-warn)", fontWeight: 500 }}>
                      Berpotensi terjadi rapelan. Hubungi bagian kepegawaian.
                    </span>
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </main>

      {/* ── Footer minimal ────────────────────────────────────────────── */}
      <footer className="kgb-rise kgb-d6" style={{
        position: "relative", zIndex: 1,
        padding: "18px clamp(20px,5vw,72px) 22px",
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "10px", flexWrap: "wrap", textAlign: "center",
      }}>
        <span style={{ fontSize: "11px", color: "var(--dim)" }}>
          {`© ${new Date().getFullYear()} ${NAMA_KANWIL_SINGKAT}`}
        </span>
        <span aria-hidden style={{ width: "3px", height: "3px", borderRadius: "50%", background: "var(--dim)", opacity: .5 }} />
        <span style={{ fontSize: "11px", color: "var(--dim)" }}>
          Kementerian Imigrasi dan Pemasyarakatan RI
        </span>
      </footer>
    </div>
  );
}
