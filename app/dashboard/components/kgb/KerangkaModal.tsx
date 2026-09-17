"use client";

import { useEffect, useId, type FormEvent, type ReactNode } from "react";
import { useDialogModal } from "@/app/dashboard/components/useDialogModal";
import { GAYA_MODAL_KGB } from "./gayaModal";

type NadaModal = "navy" | "amber" | "hijau" | "merah" | "netral";

interface PropsKerangkaModal {
  judul: string;
  subjudul?: ReactNode;
  ikon?: ReactNode;
  nada?: NadaModal;
  ukuran?: "sm" | "md" | "lg";
  /** Selama sibuk, modal tidak dapat ditutup (Escape, latar, tombol Tutup). */
  sibuk?: boolean;
  onTutup: () => void;
  /** Bila diisi, badan dan kaki modal menjadi satu form; Enter pada input mengirim form. */
  onKirim?: () => void;
  kaki?: ReactNode;
  children: ReactNode;
}

/**
 * Kerangka dialog modal KGB. Dirender hanya selama modal terbuka. Perilaku Escape, Tab, dan
 * pengembalian fokus ke tombol pemicu memakai useDialogModal; setelah dibuka, fokus pindah ke
 * elemen bertanda data-autofocus bila ada.
 */
export default function KerangkaModal({
  judul,
  subjudul,
  ikon,
  nada = "navy",
  ukuran = "md",
  sibuk = false,
  onTutup,
  onKirim,
  kaki,
  children,
}: PropsKerangkaModal) {
  const idJudul = useId();
  const panelRef = useDialogModal<HTMLDivElement>(true, onTutup, sibuk);

  // Berjalan sesudah efek pembuka useDialogModal, yang sudah mencatat pemicu dan memfokuskan panel.
  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [panelRef]);

  function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!sibuk) onKirim?.();
  }

  const isi = (
    <>
      <div className="kgbm-badan">{children}</div>
      {kaki && <div className="kgbm-kaki">{kaki}</div>}
    </>
  );

  return (
    <div
      className="kgbm-latar"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !sibuk) onTutup();
      }}
    >
      <style href="sim-kgb-modal-kgb" precedence="default">
        {GAYA_MODAL_KGB}
      </style>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idJudul}
        aria-busy={sibuk || undefined}
        tabIndex={-1}
        className={`kgbm-panel kgbm-${ukuran}`}
      >
        <div className="kgbm-kepala">
          {ikon && (
            <div className="kgbm-ikon" data-nada={nada} aria-hidden="true">
              {ikon}
            </div>
          )}
          <div className="kgbm-kepala-teks">
            <h2 id={idJudul} className="kgbm-judul">
              {judul}
            </h2>
            {subjudul && <p className="kgbm-subjudul">{subjudul}</p>}
          </div>
          <button type="button" className="kgbm-tutup" onClick={onTutup} disabled={sibuk} aria-label="Tutup">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {onKirim ? (
          <form className="kgbm-form" onSubmit={kirim} noValidate>
            {isi}
          </form>
        ) : (
          isi
        )}
      </div>
    </div>
  );
}
