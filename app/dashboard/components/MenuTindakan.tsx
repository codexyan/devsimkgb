"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
 * Menu tindakan tambahan berbentuk tombol titik tiga (ADR-042).
 *
 * Dipakai baris tabel yang punya lebih dari satu tindakan: satu tindakan utama tetap berupa tombol,
 * sisanya masuk ke sini. Tanpa ini, tiap baris menumpuk tiga kendali dan tabel berisi tujuh pegawai
 * sudah setinggi satu layar penuh.
 *
 * Panelnya dirender lewat portal dengan position: fixed, bukan absolute di dalam sel. Pembungkus tabel
 * (.dsb-antrian-gulir) memakai `overflow: auto`, sehingga panel yang diposisikan di dalamnya akan
 * terpotong begitu menjorok keluar batas gulir.
 *
 * Panel ditutup saat menggulir, bukan diikutkan bergulir: koordinatnya dihitung sekali saat dibuka, dan
 * panel yang mengambang jauh dari tombolnya lebih membingungkan daripada panel yang tertutup.
 */

export interface ItemMenuTindakan {
  label: string;
  /** Satu baris penjelas di bawah label; untuk tindakan yang namanya saja belum cukup terang. */
  keterangan?: string;
  onPilih: () => void;
}

/** Jarak panel dari tombol, dan ruang sisa minimum ke tepi layar. */
const JARAK = 6;
const TEPI = 8;
const LEBAR_PANEL = 232;

export default function MenuTindakan({
  judul,
  item,
  nonaktif,
  bentuk = "titik",
  kelasPemicu,
}: {
  /** Dibacakan pembaca layar sebagai nama menunya, mis. "Tindakan lain untuk Budi". */
  judul: string;
  item: readonly ItemMenuTindakan[];
  nonaktif?: boolean;
  /** "titik": ikon titik tiga; "panah": separuh kanan tombol berbelah, mis. Cetak SK (ADR-095). */
  bentuk?: "titik" | "panah";
  /** Kelas pemicu pengganti, mis. tombol kgbm di kaki jendela. */
  kelasPemicu?: string;
}) {
  const [buka, setBuka] = useState(false);
  const [posisi, setPosisi] = useState<{ top: number; left: number } | null>(null);
  const tombolRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const tutup = useCallback((kembalikanFokus = true) => {
    setBuka(false);
    setPosisi(null);
    if (kembalikanFokus) tombolRef.current?.focus();
  }, []);

  // Posisi dihitung setelah panel terpasang, supaya tingginya sudah terukur saat membalik ke atas.
  useLayoutEffect(() => {
    if (!buka) return;
    const tombol = tombolRef.current;
    const panel = panelRef.current;
    if (!tombol || !panel) return;
    const r = tombol.getBoundingClientRect();
    const tinggi = panel.offsetHeight;
    const keBawah = r.bottom + JARAK + tinggi <= window.innerHeight - TEPI;
    const top = keBawah ? r.bottom + JARAK : Math.max(TEPI, r.top - JARAK - tinggi);
    const left = Math.min(Math.max(TEPI, r.right - LEBAR_PANEL), window.innerWidth - LEBAR_PANEL - TEPI);
    setPosisi({ top, left });
  }, [buka]);

  // Fokus dipindahkan setelah posisinya ada, bukan pada lintasan pengukuran. Sebelum itu panel masih
  // disembunyikan, dan elemen yang tersembunyi mengabaikan .focus() tanpa memberi tanda apa pun.
  useEffect(() => {
    if (!buka || !posisi) return;
    panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [buka, posisi]);

  useEffect(() => {
    if (!buka) return;
    const diLuar = (e: MouseEvent) => {
      const sasaran = e.target as Node;
      if (panelRef.current?.contains(sasaran) || tombolRef.current?.contains(sasaran)) return;
      tutup(false);
    };
    const padaTombol = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        tutup();
      }
    };
    // Gulir apa pun menutup panel, termasuk gulir mendatar pada tabel.
    const padaGulir = () => tutup(false);
    document.addEventListener("mousedown", diLuar);
    document.addEventListener("keydown", padaTombol);
    window.addEventListener("scroll", padaGulir, true);
    window.addEventListener("resize", padaGulir);
    return () => {
      document.removeEventListener("mousedown", diLuar);
      document.removeEventListener("keydown", padaTombol);
      window.removeEventListener("scroll", padaGulir, true);
      window.removeEventListener("resize", padaGulir);
    };
  }, [buka, tutup]);

  if (item.length === 0) return null;

  return (
    <>
      <button
        ref={tombolRef}
        type="button"
        className={kelasPemicu ?? (bentuk === "panah" ? "dsb-tombol dsb-tombol-kecil mnu-pemicu mnu-pemicu-panah" : "dsb-ikon-tombol mnu-pemicu")}
        aria-haspopup="menu"
        aria-expanded={buka}
        aria-label={judul}
        title={judul}
        disabled={nonaktif}
        onClick={() => (buka ? tutup() : setBuka(true))}
      >
        {bentuk === "panah" ? (
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        ) : (
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        )}
      </button>

      {buka &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            aria-label={judul}
            className="mnu-panel"
            style={{
              top: posisi?.top ?? -9999,
              left: posisi?.left ?? -9999,
              width: LEBAR_PANEL,
              // Sebelum posisinya terukur, panel dirender tanpa terlihat agar tidak berkedip di pojok.
              // Dipakai opacity, bukan visibility: elemen dengan visibility: hidden tidak dapat difokus,
              // sehingga fokus papan ketik hilang diam-diam saat menu dibuka.
              opacity: posisi ? 1 : 0,
              pointerEvents: posisi ? undefined : "none",
            }}
          >
            {item.map((t) => (
              <button
                key={t.label}
                type="button"
                role="menuitem"
                className="mnu-item"
                onClick={() => {
                  tutup(false);
                  t.onPilih();
                }}
              >
                <span>{t.label}</span>
                {t.keterangan && <small>{t.keterangan}</small>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
