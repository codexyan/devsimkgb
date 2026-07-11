"use client";
import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation";

type TriggerFn = (target: string | (() => void)) => void;
const Ctx = createContext<TriggerFn | null>(null);

export function usePageTransition() {
  return useContext(Ctx);
}

type BrandProps = {
  children: ReactNode;
  /** Teks lencana di tengah tirai transisi (default merek KGB). */
  badge?: string;
  /** Label kecil di bawah lencana. */
  label?: string;
  /** Warna aksen lencana (hex 6 digit). */
  accent?: string;
  /** Gradien latar tirai. */
  gradient?: string;
  /** Bila false, navigasi tetap client-side namun tanpa tirai loading. */
  enabled?: boolean;
};

export function PageTransitionProvider({
  children,
  badge = "KGB",
  label = "SIM-KGB",
  accent = "#c9a227",
  gradient = "linear-gradient(135deg, #0f2a45 0%, #1a3a5c 60%, #1e4976 100%)",
  enabled = true,
}: BrandProps) {
  const [phase, setPhase] = useState<"idle" | "in" | "out">("idle");
  const router = useRouter();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const trigger: TriggerFn = useCallback(
    (target) => {
      // Tanpa tirai: langsung navigasi client-side.
      if (!enabled) {
        if (typeof target === "string") router.push(target);
        else target();
        return;
      }

      clearTimers();
      setPhase("in");

      const t1 = setTimeout(() => {
        if (typeof target === "string") {
          router.push(target);
        } else {
          target();
        }
        const t2 = setTimeout(() => {
          setPhase("out");
          const t3 = setTimeout(() => setPhase("idle"), 520);
          timers.current.push(t3);
        }, 220);
        timers.current.push(t2);
      }, 430);
      timers.current.push(t1);
    },
    [router, enabled],
  );

  return (
    <Ctx.Provider value={trigger}>
      {children}
      {phase !== "idle" && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            pointerEvents: "none",
            background: gradient,
            animation:
              phase === "in"
                ? "pgCurtainIn 0.43s cubic-bezier(0.76, 0, 0.24, 1) both"
                : "pgCurtainOut 0.52s cubic-bezier(0.76, 0, 0.24, 1) both",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Subtle center logo mark */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              opacity: phase === "out" ? 0 : 1,
              transition: "opacity 0.15s",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: `${accent}1f`,
                border: `1.5px solid ${accent}47`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: accent,
                  letterSpacing: "-0.02em",
                  fontFamily: "inherit",
                }}
              >
                {badge}
              </span>
            </div>
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "0.1em",
                fontFamily: "inherit",
              }}
            >
              {label}
            </span>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
