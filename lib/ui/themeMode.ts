"use client";

import { useCallback, useSyncExternalStore } from "react";

/* ── Mode tema SIM-KGB (halaman publik dan dashboard) ────────────────────
   Bawaan selalu terang; mode gelap hanya bila pengguna memilihnya lewat
   tombol di sidebar (disimpan di localStorage). Dibaca lewat
   useSyncExternalStore agar SSR-safe dan ikut berubah saat tab lain
   mengganti tema.                                                          */
type ThemeMode ="light" | "dark";
const STORAGE_KEY = "kgb-theme";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): ThemeMode {
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
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
