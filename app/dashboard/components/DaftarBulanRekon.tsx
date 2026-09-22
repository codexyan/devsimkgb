"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { bulanFokusRekon } from "@/lib/rekonGaji";
import { hariIniWita } from "@/lib/waktu";
import { geserBulan, namaBulan } from "@/app/dashboard/satker/labelSatker";

/* Daftar bulan TMT untuk keuangan: berapa KGB yang sudah dikonfirmasi dari seluruhnya, berapa yang menunggu,
   dan berapa yang belum sampai. Dipakai halaman Keuangan (memilih bulan) dan dashboard Keuangan (membuka
   halaman Keuangan pada bulan itu). Angkanya dari lib/rekapKgb.ts rekapPerBulanTmt. */

export interface RekapBulanRingkas {
  bulanTmt: string;
  total: number;
  dikonfirmasi: number;
  menungguKeuangan: number;
  belumSampaiKeuangan: number;
  rapelanDitetapkan: number;
  berpotensiRapelan: number;
}

/** Empat bulan sebelum bulan fokus rekon sampai sebulan sesudahnya, ditambah bulan lain yang masih punya SK menunggu. */
export function bulanDaftarRekon(rekap: ReadonlyMap<string, RekapBulanRingkas>, bulanFokus: string): string[] {
  const kunci = new Set<string>();
  for (let i = -4; i <= 1; i++) kunci.add(geserBulan(bulanFokus, i));
  for (const r of rekap.values()) if (r.menungguKeuangan > 0) kunci.add(r.bulanTmt);
  return [...kunci].sort().reverse();
}

export function DaftarBulanRekon({
  rekap,
  bulanFokus,
  terpilih,
  onPilih,
  hrefBulan,
}: {
  rekap: ReadonlyMap<string, RekapBulanRingkas>;
  bulanFokus: string;
  terpilih?: string;
  onPilih?: (bulan: string) => void;
  hrefBulan?: (bulan: string) => string;
}) {
  return (
    <ul className="dsb-bulan-daftar dsb-gulir">
      {bulanDaftarRekon(rekap, bulanFokus).map((b) => {
        const r = rekap.get(b);
        const total = r?.total ?? 0;
        const dikonfirmasi = r?.dikonfirmasi ?? 0;
        const lengkap = total > 0 && dikonfirmasi === total;
        const rapelan = (r?.rapelanDitetapkan ?? 0) + (r?.berpotensiRapelan ?? 0);
        const keterangan = total === 0
          ? "tidak ada KGB"
          : lengkap
            ? "lengkap"
            : [r!.menungguKeuangan > 0 && `${r!.menungguKeuangan} menunggu`, r!.belumSampaiKeuangan > 0 && `${r!.belumSampaiKeuangan} belum sampai`].filter(Boolean).join(" · ");
        const isi = (
          <>
            <span className="dsb-bulan-daftar-nama">
              {namaBulan(b, true)}
              {b === bulanFokus && <span className="dsb-tag" data-garis="" style={{ marginLeft: 6 }}>fokus rekon</span>}
            </span>
            <span className="dsb-satker-angka">
              <span className="dsb-bar-mini" aria-hidden="true"><span style={{ width: `${total > 0 ? (dikonfirmasi / total) * 100 : 0}%` }} /></span>
              {dikonfirmasi}/{total}
            </span>
            <span className="dsb-kecil" style={{ color: (r?.menungguKeuangan ?? 0) > 0 ? "var(--st-violet)" : lengkap ? "var(--st-green)" : undefined }}>
              {keterangan}
              {rapelan > 0 && <span style={{ color: "var(--st-amber)" }}> · {rapelan} rapelan</span>}
            </span>
          </>
        );
        return (
          <li key={b}>
            {onPilih ? (
              <button type="button" aria-pressed={terpilih === b} onClick={() => onPilih(b)}>{isi}</button>
            ) : (
              <Link href={hrefBulan ? hrefBulan(b) : `/dashboard/keuangan?bulan=${b}`}>{isi}</Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Panel mandiri untuk dashboard Keuangan: memuat /api/keuangan/rekon sendiri. */
export function PanelBulanRekon({ versi, className = "dsb-penuh" }: { versi?: number; className?: string }) {
  const [rekap, setRekap] = useState<Map<string, RekapBulanRingkas> | null>(null);
  const [galat, setGalat] = useState(false);
  const bulanFokus = bulanFokusRekon(hariIniWita());

  useEffect(() => {
    fetch("/api/keuangan/rekon")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = (await r.json()) as unknown;
        const daftar = Array.isArray(d) ? (d as RekapBulanRingkas[]) : [];
        setRekap(new Map(daftar.map((x) => [x.bulanTmt, x])));
        setGalat(false);
      })
      .catch(() => setGalat(true));
  }, [versi]);

  return (
    <section className={`dsb-panel ${className}`} aria-labelledby="judul-bulan-rekon">
      <div className="dsb-panel-kepala">
        <h2 id="judul-bulan-rekon" className="dsb-panel-judul">Per bulan TMT <small>dasar Gaji Web</small></h2>
        <Link href="/dashboard/keuangan/riwayat?tab=rekap" className="dsb-tautan">Semua →</Link>
      </div>
      {galat ? (
        <p className="dsb-kosong">Rekap per bulan gagal dimuat.</p>
      ) : !rekap ? (
        <div className="dsb-panel-isi flex flex-col gap-2" aria-hidden="true">
          {[1, 2, 3].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 40, borderRadius: 8 }} />)}
        </div>
      ) : (
        <DaftarBulanRekon rekap={rekap} bulanFokus={bulanFokus} />
      )}
    </section>
  );
}
