"use client";

import { useEffect, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import type { Nada } from "@/app/dashboard/components/PanelNavy";

/* Papan (kanban) antrian kerja KGB di dashboard. Kolomnya mengikuti alur KGB. Kartu dapat diseret ke kolom lain
   untuk membuka aksi yang sesuai (Input KGB, Buat SK, Unggah SK TTE, Batalkan, Arsip); aksinya tetap lewat
   modal yang sama dengan tampilan daftar, jadi menyeret tidak pernah mengubah data tanpa konfirmasi. Setiap aksi
   juga tersedia sebagai tombol di kartu untuk papan ketik dan layar sentuh. */

export type KolomPapan = "terkunci" | "input" | "proses" | "keuangan" | "rekam_upt" | "selesai";

export interface KartuPapan {
  id: string;
  kolom: KolomPapan;
  nama: string;
  /** Baris kedua: golongan dan satker. */
  sub: string;
  /**
   * Asal pegawai: Kanwil atau salah satu UPT. Ditampilkan sebagai penanda berwarna, bukan sebagai
   * warna kartu, sebab warna kartu sudah dipakai untuk kemendesakan batas input.
   */
  asal?: { teks: string; kanwil: boolean };
  judulSub?: string;
  /** Baris ketiga: TMT dan batas input. */
  tmt: string;
  catatan?: string;
  catatanNada?: Nada;
  /** Garis tepi kiri untuk kartu yang mendesak. */
  nada?: Nada;
  tanda?: { teks: string; nada?: Nada }[];
  aksi?: ReactNode;
  /** Kolom tujuan yang boleh dan label aksinya, mis. { proses: "Input KGB" }. */
  pindah?: Partial<Record<KolomPapan, string>>;
}

const KOLOM: { k: KolomPapan; judul: string; nada?: Nada }[] = [
  { k: "terkunci", judul: "Belum dibuka" },
  { k: "input", judul: "Perlu diinput", nada: "kuning" },
  { k: "proses", judul: "Sedang diproses", nada: "navy" },
  // Sesudah SK diunggah: pegawai Kanwil ke keuangan Kanwil, pegawai UPT ke keuangan UPT-nya (ADR-009).
  { k: "keuangan", judul: "Keuangan Kanwil", nada: "ungu" },
  { k: "rekam_upt", judul: "Rekam UPT", nada: "ungu" },
  { k: "selesai", judul: "Selesai", nada: "hijau" },
];

const KUNCI_CIUT = "kgb-papan-ciut";
const CIUT_BAWAAN: KolomPapan[] = ["terkunci", "selesai"];
/** Kolom Selesai bisa sangat panjang; sisanya dibuka di Proses KGB. */
const BATAS_SELESAI = 40;

export default function PapanAntrian({
  kartu,
  keterangan,
  onPindah,
  className = "",
}: {
  kartu: KartuPapan[];
  /** Keterangan kecil di kepala kolom, mis. "3 lewat batas". */
  keterangan?: Partial<Record<KolomPapan, string>>;
  onPindah: (id: string, ke: KolomPapan) => void;
  className?: string;
}) {
  const [ciut, setCiut] = useState<Set<KolomPapan>>(new Set(CIUT_BAWAAN));
  const [seret, setSeret] = useState<KartuPapan | null>(null);
  const [atas, setAtas] = useState<KolomPapan | null>(null);

  // Kolom yang diciutkan diingat per peramban; penyimpanan bisa tidak tersedia (mode privat).
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const s = JSON.parse(localStorage.getItem(KUNCI_CIUT) ?? "null") as unknown;
        if (Array.isArray(s)) setCiut(new Set(s.filter((x): x is KolomPapan => KOLOM.some((k) => k.k === x))));
      } catch { /* abaikan */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function alihCiut(k: KolomPapan) {
    setCiut((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      try { localStorage.setItem(KUNCI_CIUT, JSON.stringify([...n])); } catch { /* abaikan */ }
      return n;
    });
  }

  function mulaiSeret(e: DragEvent<HTMLElement>, k: KartuPapan) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", k.id);
    setSeret(k);
  }

  function selesaiSeret() {
    setSeret(null);
    setAtas(null);
  }

  function lepas(e: DragEvent<HTMLElement>, ke: KolomPapan) {
    e.preventDefault();
    const k = seret;
    selesaiSeret();
    if (k && k.kolom !== ke && k.pindah?.[ke]) onPindah(k.id, ke);
  }

  return (
    <div className={`dsb-papan ${className}`} role="list" aria-label="Papan antrian kerja KGB">
      {KOLOM.map(({ k, judul, nada }) => {
        const isi = kartu.filter((x) => x.kolom === k);
        const tampil = k === "selesai" ? isi.slice(0, BATAS_SELESAI) : isi;
        const diciut = ciut.has(k) && !seret;
        const label = seret && seret.kolom !== k ? seret.pindah?.[k] : undefined;
        const target = !seret ? undefined : seret.kolom === k ? "asal" : label ? (atas === k ? "aktif" : "boleh") : "tidak";
        return (
          <section
            key={k}
            role="listitem"
            className="dsb-papan-kolom"
            data-ciut={diciut ? "" : undefined}
            data-target={target}
            aria-label={`${judul}: ${isi.length}`}
            onDragOver={(e) => {
              if (!label) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (atas !== k) setAtas(k);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null) && atas === k) setAtas(null);
            }}
            onDrop={(e) => lepas(e, k)}
          >
            <button type="button" className="dsb-papan-kepala" onClick={() => alihCiut(k)} aria-expanded={!diciut} title={diciut ? `Buka kolom ${judul}` : `Ciutkan kolom ${judul}`}>
              <span className="dsb-titik" data-nada={nada} aria-hidden="true" />
              <span className="dsb-papan-judul">{judul}</span>
              <span className="dsb-papan-jumlah">{isi.length}</span>
              {!diciut && keterangan?.[k] && <span className="dsb-papan-ket">{keterangan[k]}</span>}
            </button>

            {!diciut && (
              <div className="dsb-papan-isi">
                {label && <p className="dsb-papan-lepas">Lepas di sini: {label}</p>}
                {tampil.length === 0 && !label && <p className="dsb-papan-kosong">Tidak ada</p>}
                {tampil.map((x) => (
                  <article
                    key={x.id}
                    className="dsb-kartu-kgb"
                    data-nada={x.nada}
                    data-seret={seret?.id === x.id ? "" : undefined}
                    draggable={!!x.pindah && Object.keys(x.pindah).length > 0}
                    onDragStart={(e) => mulaiSeret(e, x)}
                    onDragEnd={selesaiSeret}
                    aria-label={x.nama}
                  >
                    <p className="dsb-kartu-kepala">
                      <span className="dsb-nama truncate">{x.nama}</span>
                      {x.asal && (
                        <span className="dsb-kartu-asal" data-kanwil={x.asal.kanwil ? "" : undefined}>{x.asal.teks}</span>
                      )}
                    </p>
                    <p className="dsb-kecil truncate" style={{ margin: 0 }} title={x.judulSub}>{x.sub}</p>
                    <p className="dsb-kecil" style={{ margin: "6px 0 0", color: "var(--dt3)" }}>
                      {x.tmt}
                      {x.catatan && <span style={{ color: x.catatanNada === "merah" ? "var(--st-red)" : x.catatanNada === "kuning" ? "var(--st-amber)" : undefined }}> · {x.catatan}</span>}
                    </p>
                    {x.tanda && x.tanda.length > 0 && (
                      <p className="dsb-kartu-tanda">
                        {x.tanda.map((t) => (
                          <span key={t.teks} className="dsb-status" style={{ fontSize: "12px" }}>
                            <span className="dsb-titik" data-nada={t.nada} aria-hidden="true" />{t.teks}
                          </span>
                        ))}
                      </p>
                    )}
                    {x.aksi && <div className="dsb-kartu-aksi">{x.aksi}</div>}
                  </article>
                ))}
                {k === "selesai" && isi.length > tampil.length && (
                  <Link href="/dashboard/kgb?status=selesai" className="dsb-tautan" style={{ padding: "4px 4px 8px" }}>
                    {isi.length - tampil.length} lainnya di Proses KGB →
                  </Link>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
