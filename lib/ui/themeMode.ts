"use client";

import { useCallback, useSyncExternalStore } from "react";

/* ── Mode tema SIM-KGB (halaman publik dan dashboard) ────────────────────
   Preferensi disimpan di localStorage; default mengikuti preferensi sistem.
   Dibaca lewat useSyncExternalStore agar SSR-safe (server merender "light",
   klien menyesuaikan setelah hidrasi) dan ikut berubah saat preferensi
   sistem atau tab lain mengganti tema.                                     */
type ThemeMode ="light" | "dark";
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
