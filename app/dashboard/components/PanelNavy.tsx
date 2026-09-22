"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import LatarNavy from "@/app/_bersama/LatarNavy";

/* Panel pembuka dashboard: permukaan navy beranimasi berisi sapaan, ringkasan hari ini, dan KPI.
   Dipakai ketiga varian dashboard peran; kelas dan token ada di app/dashboard/dasbor.css. */

export type Nada = "merah" | "kuning" | "hijau" | "ungu" | "biru" | "navy" | "emas";

/** Sapaan menurut jam WITA, sehingga server (UTC) dan peramban memberi teks yang sama. */
export function sapaanWita(sekarang = new Date()): string {
  const jam = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Makassar" }).format(sekarang),
  );
  if (jam < 11) return "Selamat pagi";
  if (jam < 15) return "Selamat siang";
  if (jam < 19) return "Selamat sore";
  return "Selamat malam";
}

/** Nama depan untuk sapaan; kosong bila nama belum ada. */
export function namaDepan(nama: string | null | undefined): string {
  return nama?.trim().split(/\s+/)[0] ?? "";
}

export function tanggalPanjangWita(sekarang = new Date()): string {
  return sekarang.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Makassar",
  });
}

export interface ChipRingkas {
  teks: ReactNode;
  nada: Nada;
}

export function PanelNavy({
  label,
  judul,
  sub,
  chips = [],
  diperbarui,
  onMuatUlang,
  memuat = false,
  children,
}: {
  label: string;
  judul: string;
  sub?: ReactNode;
  chips?: ChipRingkas[];
  diperbarui?: Date | null;
  onMuatUlang?: () => void;
  memuat?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="dsb-navy dsb-kepala dsb-muncul" aria-labelledby="dsb-sapaan">
      <LatarNavy />
      <div className="dsb-kepala-atas">
        <div className="min-w-0">
          <p className="dsb-label">{label}</p>
          <h1 id="dsb-sapaan" className="dsb-sapaan" suppressHydrationWarning>
            {judul}
          </h1>
          {sub && (
            <p className="dsb-kepala-sub" suppressHydrationWarning>
              {sub}
            </p>
          )}
        </div>
        {onMuatUlang && (
          <div className="dsb-segar">
            {diperbarui && (
              <span className="hidden sm:inline">
                Diperbarui{" "}
                {diperbarui.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" })}
              </span>
            )}
            <button
              type="button"
              className="dsb-ikon-tombol"
              onClick={onMuatUlang}
              disabled={memuat}
              title="Perbarui data dashboard"
              aria-label="Perbarui data dashboard"
            >
              <svg
                aria-hidden="true"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={memuat ? "dsb-putar" : undefined}
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {chips.length > 0 && (
        <ul className="dsb-chips" aria-label="Ringkasan hari ini">
          {chips.map((c, i) => (
            <li key={i} className="dsb-chip">
              <span className="dsb-titik" data-nada={c.nada} aria-hidden="true" />
              {c.teks}
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}

export function KisiKpi({ children, jumlah = 4 }: { children: ReactNode; jumlah?: 3 | 4 }) {
  return (
    <div className="dsb-kpi-kisi" data-jumlah={jumlah}>
      {children}
    </div>
  );
}

function Panah() {
  return (
    <svg
      className="dsb-kpi-panah"
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

/** Satu ubin KPI di panel navy: tautan, tombol, atau ringkasan saja bila tanpa href dan onClick. */
export function Kpi({
  label,
  angka,
  satuan,
  meta,
  metaNada,
  progres,
  href,
  onClick,
  sorot = false,
}: {
  label: string;
  angka: ReactNode;
  satuan?: ReactNode;
  meta?: ReactNode;
  metaNada?: Nada;
  /** 0 sampai 100; garis tipis di bawah angka. */
  progres?: number;
  href?: string;
  onClick?: () => void;
  /** Tandai ubin yang perlu perhatian (mis. rapelan terkonfirmasi). */
  sorot?: boolean;
}) {
  const isi = (
    <>
      <span className="dsb-kpi-label">
        {label}
        {(href || onClick) && <Panah />}
      </span>
      <span className="dsb-kpi-angka">
        {angka}
        {satuan && <span className="dsb-kpi-satuan">{satuan}</span>}
      </span>
      {progres !== undefined && (
        <span className="dsb-kpi-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, progres))}%` }} />
        </span>
      )}
      {meta && (
        <span className="dsb-kpi-meta">
          {metaNada && <span className="dsb-titik" data-nada={metaNada} aria-hidden="true" />}
          <span>{meta}</span>
        </span>
      )}
    </>
  );
  const sorotAttr = sorot ? "" : undefined;
  if (href)
    return (
      <Link href={href} className="dsb-kpi" data-sorot={sorotAttr}>
        {isi}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="dsb-kpi" data-sorot={sorotAttr}>
        {isi}
      </button>
    );
  return (
    <div className="dsb-kpi" data-sorot={sorotAttr}>
      {isi}
    </div>
  );
}

/** Kepala kartu: label kecil, judul, keterangan, dan aksi di kanan. */
export function KepalaKartu({
  label,
  judul,
  sub,
  aksi,
  idJudul,
}: {
  label?: string;
  judul: string;
  sub?: ReactNode;
  aksi?: ReactNode;
  idJudul?: string;
}) {
  return (
    <div className="dsb-kartu-kepala">
      <div className="min-w-0">
        {label && <p className="dsb-label">{label}</p>}
        <h2 id={idJudul} className="dsb-judul">
          {judul}
        </h2>
        {sub && <p className="dsb-sub">{sub}</p>}
      </div>
      {aksi}
    </div>
  );
}

/** Kerangka saat data dashboard dimuat: panel navy dan tiga kartu berkilau. */
export function KerangkaDashboard() {
  return (
    <div className="dsb-halaman" role="status" aria-label="Memuat dashboard">
      <div className="dsb-kerangka-navy" style={{ height: 300 }} />
      <div className="dsb-kisi-3">
        <div className="dsb-kerangka" style={{ height: 300 }} />
        <div className="dsb-kerangka" style={{ height: 300 }} />
        <div className="dsb-kerangka" style={{ height: 300 }} />
      </div>
    </div>
  );
}
