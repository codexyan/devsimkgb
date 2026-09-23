"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import LatarNavy from "@/app/_bersama/LatarNavy";

/* Komponen bersama ketiga varian dashboard: pita navy (sapaan dan strip angka), panel "Perlu tindakan",
   kepala kartu, dan kerangka muat. Kelas dan token ada di app/dashboard/dasbor.css. */

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

/**
 * Nama untuk sapaan: nama depan pemilik akun. Kosong bila nama belum ada atau akun memakai nama peran
 * (mis. akun bernama "Super Admin"), agar sapaan tidak berbunyi "Selamat siang, Super".
 */
export function namaSapaan(nama: string | null | undefined, labelPeran?: string): string {
  const bersih = nama?.trim().replace(/\s+/g, " ") ?? "";
  if (!bersih) return "";
  const kecil = bersih.toLowerCase();
  if ((labelPeran && kecil === labelPeran.toLowerCase()) || /^(super ?admin|admin|administrator)$/.test(kecil)) return "";
  return bersih.split(" ")[0];
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

/* ── Pita navy ─────────────────────────────────────────────────────────── */

/** Pita pembuka: sapaan di kiri, keterangan dan tombol muat ulang di kanan, lalu strip angka (children). */
export function PanelNavy({
  label,
  judul,
  sub,
  diperbarui,
  onMuatUlang,
  memuat = false,
  children,
}: {
  label: string;
  judul: string;
  sub?: ReactNode;
  diperbarui?: Date | null;
  onMuatUlang?: () => void;
  memuat?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="dsb-navy dsb-pita dsb-muncul" aria-labelledby="dsb-sapaan">
      <LatarNavy />
      <div className="dsb-pita-atas">
        <div className="min-w-0">
          <p className="dsb-pita-label">{label}</p>
          <h1 id="dsb-sapaan" className="dsb-sapaan" suppressHydrationWarning>
            {judul}
          </h1>
        </div>
        <div className="dsb-pita-meta">
          {sub && <span suppressHydrationWarning>{sub}</span>}
          {onMuatUlang && (
            <span className="dsb-segar">
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
                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={memuat ? "dsb-putar" : undefined}>
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </button>
            </span>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Strip angka di bawah sapaan: sel bersebelahan yang dipisah garis. */
export function StripStat({ children, kolom = 4 }: { children: ReactNode; kolom?: 3 | 4 }) {
  return (
    <div className="dsb-stat-strip" style={{ "--kolom": kolom } as React.CSSProperties}>
      {children}
    </div>
  );
}

/** Satu sel angka: tautan, tombol, atau ringkasan saja bila tanpa href dan onClick. */
export function Stat({
  label,
  angka,
  satuan,
  meta,
  metaNada,
  progres,
  href,
  onClick,
  sorot = false,
  nada,
}: {
  label: string;
  angka: ReactNode;
  satuan?: ReactNode;
  meta?: ReactNode;
  metaNada?: Nada;
  /** 0 sampai 100; garis tipis di bawah keterangan. */
  progres?: number;
  href?: string;
  onClick?: () => void;
  /** Tandai angka yang perlu perhatian. */
  sorot?: boolean;
  /** Warna sel: garis tipis di atas angka dan latar setipis embun, agar tiap kartu punya identitas. */
  nada?: Nada;
}) {
  const isi = (
    <>
      <span className="dsb-stat-label">{label}</span>
      <span className="dsb-stat-nilai">
        {angka}
        {satuan && <small>{satuan}</small>}
      </span>
      {meta && (
        <span className="dsb-stat-meta">
          {metaNada && <span className="dsb-titik" data-nada={metaNada} aria-hidden="true" />}
          <span>{meta}</span>
        </span>
      )}
      {progres !== undefined && (
        <span className="dsb-stat-bar" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, progres))}%` }} />
        </span>
      )}
    </>
  );
  const sorotAttr = sorot ? "" : undefined;
  if (href)
    return (
      <Link href={href} className="dsb-stat" data-nada={nada} data-sorot={sorotAttr}>
        {isi}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className="dsb-stat" data-nada={nada} data-sorot={sorotAttr}>
        {isi}
      </button>
    );
  return (
    <div className="dsb-stat" data-nada={nada} data-sorot={sorotAttr}>
      {isi}
    </div>
  );
}

/* ── Perlu tindakan ────────────────────────────────────────────────────── */

/** Satu baris "Perlu tindakan": keadaan yang menuntut tindakan beserta tautan menuju tempat mengerjakannya. */
export interface Tindakan {
  id: string;
  nada: Nada;
  isi: ReactNode;
  aksi?: { label: string; href?: string; onClick?: () => void };
}

const BATAS_TINDAKAN = 5;

export function PanelTindakan({
  daftar,
  kosong = "Tidak ada yang perlu ditindaklanjuti saat ini.",
  lainnyaHref,
  className = "dsb-susut",
}: {
  daftar: Tindakan[];
  kosong?: string;
  lainnyaHref?: string;
  /** Peran panel dalam model gulir halaman kerja (dasbor.css): bawaannya menyusut dan bergulir di dalam. */
  className?: string;
}) {
  const tampil = daftar.slice(0, BATAS_TINDAKAN);
  const sisa = daftar.length - tampil.length;
  return (
    <section className={`dsb-panel ${className}`} aria-labelledby="judul-perlu-tindakan">
      <div className="dsb-panel-kepala">
        <h2 id="judul-perlu-tindakan" className="dsb-panel-judul">
          Perlu tindakan {daftar.length > 0 && <small>{daftar.length}</small>}
        </h2>
      </div>
      {daftar.length === 0 ? (
        <p className="dsb-kosong" style={{ padding: "18px 16px", flexDirection: "row" }}>
          <span className="dsb-titik" data-nada="hijau" aria-hidden="true" />
          {kosong}
        </p>
      ) : (
        <ul className="dsb-tindakan-daftar dsb-gulir">
          {tampil.map((t) => (
            <li key={t.id}>
              <span className="dsb-titik" data-nada={t.nada} aria-hidden="true" />
              <p>{t.isi}</p>
              {t.aksi?.href ? (
                <Link href={t.aksi.href} className="dsb-tautan">{t.aksi.label} →</Link>
              ) : t.aksi?.onClick ? (
                <button type="button" onClick={t.aksi.onClick} className="dsb-tautan">{t.aksi.label} →</button>
              ) : null}
            </li>
          ))}
          {sisa > 0 && (
            <li>
              <span className="dsb-titik" aria-hidden="true" />
              <p>{sisa} hal lain perlu ditindaklanjuti.</p>
              {lainnyaHref && <Link href={lainnyaHref} className="dsb-tautan">Lihat semua →</Link>}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

/* ── Kepala kartu dan kerangka muat ────────────────────────────────────── */

/** Kepala kartu: label kecil opsional, judul, keterangan, dan aksi di kanan. */
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

/** Kerangka saat data dashboard dimuat: pita navy, kolom kerja, dan kolom pendamping. */
export function KerangkaDashboard() {
  return (
    <div className="dsb-halaman" role="status" aria-label="Memuat dashboard">
      <div className="dsb-kerangka-navy" style={{ height: 190 }} />
      <div className="dsb-dasbor-isi">
        <div className="dsb-kerangka" style={{ height: 520 }} />
        <div className="dsb-samping">
          <div className="dsb-kerangka" style={{ height: 200 }} />
          <div className="dsb-kerangka" style={{ height: 180 }} />
        </div>
      </div>
    </div>
  );
}
