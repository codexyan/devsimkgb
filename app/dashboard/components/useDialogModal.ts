"use client";

import { useEffect, useRef, type RefObject } from "react";

const ELEMEN_FOKUS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

// Dialog yang sedang terbuka, urut dari yang paling awal. Hanya dialog teratas yang menanggapi
// Escape dan Tab, sehingga dialog konfirmasi di atas dialog lain tidak ikut menutup keduanya.
const tumpukanDialog: object[] = [];

/**
 * Perilaku dialog modal untuk panel yang dirender bersyarat.
 * Saat dibuka fokus pindah ke panel (kecuali isian di dalamnya sudah autoFocus), Tab berputar di
 * dalam panel, Escape menutup kecuali `terkunci` (misalnya selama menyimpan), dan setelah ditutup
 * fokus kembali ke elemen pemicu. Pasang ref yang dikembalikan pada panel bersama
 * role="dialog", aria-modal="true", aria-labelledby, dan tabIndex={-1}.
 */
export function useDialogModal<T extends HTMLElement = HTMLDivElement>(
  terbuka: boolean,
  tutup: () => void,
  terkunci = false,
): RefObject<T | null> {
  const panelRef = useRef<T>(null);
  const tutupRef = useRef(tutup);
  const terkunciRef = useRef(terkunci);
  // Dua fokus terakhir selama dialog tertutup. autoFocus di dalam panel terjadi sebelum efek
  // pembuka berjalan, jadi pemicu yang sebenarnya bisa berada di slot sebelumnya.
  const fokusRef = useRef<{ sebelumnya: HTMLElement | null; terakhir: HTMLElement | null }>({
    sebelumnya: null,
    terakhir: null,
  });

  useEffect(() => {
    tutupRef.current = tutup;
    terkunciRef.current = terkunci;
  });

  useEffect(() => {
    if (terbuka) return;
    const catat = () => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement) || el === fokusRef.current.terakhir) return;
      fokusRef.current = { sebelumnya: fokusRef.current.terakhir, terakhir: el };
    };
    catat();
    document.addEventListener("focusin", catat);
    return () => document.removeEventListener("focusin", catat);
  }, [terbuka]);

  useEffect(() => {
    if (!terbuka) return;
    const kunci = {};
    tumpukanDialog.push(kunci);
    const panel = panelRef.current;
    const { sebelumnya, terakhir } = fokusRef.current;
    const diLuarPanel = (el: Element | null): el is HTMLElement =>
      el instanceof HTMLElement && !(panel && panel.contains(el));
    // Panel yang dipasang langsung dalam keadaan terbuka tidak sempat mencatat fokus; pakai elemen aktif.
    const pemicu = [terakhir, sebelumnya, document.activeElement].find(diLuarPanel) ?? null;
    if (panel && !panel.contains(document.activeElement)) panel.focus();

    function onKeyDown(e: KeyboardEvent) {
      const p = panelRef.current;
      if (!p || e.defaultPrevented || tumpukanDialog[tumpukanDialog.length - 1] !== kunci) return;
      if (e.key === "Escape") {
        if (terkunciRef.current) return;
        e.preventDefault();
        tutupRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const daftar = Array.from(p.querySelectorAll<HTMLElement>(ELEMEN_FOKUS)).filter(
        (el) => el.getClientRects().length > 0,
      );
      const aktif = document.activeElement;
      if (daftar.length === 0) {
        e.preventDefault();
        p.focus();
        return;
      }
      const pertama = daftar[0];
      const terakhirDiPanel = daftar[daftar.length - 1];
      if (!p.contains(aktif)) {
        e.preventDefault();
        pertama.focus();
      } else if (e.shiftKey && (aktif === pertama || aktif === p)) {
        e.preventDefault();
        terakhirDiPanel.focus();
      } else if (!e.shiftKey && aktif === terakhirDiPanel) {
        e.preventDefault();
        pertama.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const i = tumpukanDialog.indexOf(kunci);
      if (i >= 0) tumpukanDialog.splice(i, 1);
      if (pemicu?.isConnected) pemicu.focus();
    };
  }, [terbuka]);

  return panelRef;
}
