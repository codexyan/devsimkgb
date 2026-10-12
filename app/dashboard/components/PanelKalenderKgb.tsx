"use client";

import type { CSSProperties } from "react";
import { ringkasBulan, type PosisiKartu } from "@/lib/kartuSatkerDasbor";
import { URUTAN_BATANG, type BulanKalender, type KalenderKanwil } from "@/lib/kalenderKanwil";
import { TombolCiut, usePanelCiut } from "@/app/dashboard/components/PanelCiut";
import { namaBulan } from "@/app/dashboard/satker/labelSatker";

/* Kalender KGB per bulan TMT di rail dasbor Kanwil (ADR-107): dua belas batang Januari sampai Desember, tiap batang
   bertumpuk menurut posisi antrian yang sama dengan kolom papan. Menekan satu bulan menyaring papan ke TMT itu; menekan
   bulan yang sama lagi membuka saringannya. Bentuknya mengikuti kalender di dasbor Admin UPT (ADR-103), tetapi tahapnya
   tahap papan Kanwil, bukan tahap UPT. */

const BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] as const;

/** Warna tiap posisi; sama dengan penanda di kartu satker supaya satu warna berarti satu hal di seluruh rail. */
const WARNA: Record<PosisiKartu, string> = {
  lewat: "var(--st-red)",
  siap: "var(--st-amber)",
  diproses: "var(--navy-solid)",
  keuangan: "var(--st-violet)",
  rekam_upt: "var(--st-violet)",
  terkunci: "var(--ln0)",
  selesai: "var(--st-green)",
};

/** Legenda per kelompok warna; keuangan Kanwil dan rekam UPT sama-sama ungu, jadi satu butir. */
const LEGENDA: { posisi: readonly PosisiKartu[]; label: string; warna: string }[] = [
  { posisi: ["lewat"], label: "Lewat batas", warna: WARNA.lewat },
  { posisi: ["siap"], label: "Perlu input", warna: WARNA.siap },
  { posisi: ["diproses"], label: "Diproses", warna: WARNA.diproses },
  { posisi: ["keuangan", "rekam_upt"], label: "Keuangan", warna: WARNA.keuangan },
  { posisi: ["terkunci"], label: "Belum dibuka", warna: WARNA.terkunci },
  { posisi: ["selesai"], label: "Selesai", warna: WARNA.selesai },
];

const TINGGI_MAKS = 56;

/**
 * Di bawah tinggi ini rail tidak cukup menampung semua panelnya sekaligus: yang lebih dulu terjepit Perlu tindakan, lalu
 * Pekerjaan per satker (ADR-050). Panel ini bawaannya ciut di layar sependek itu, tetap terbaca sebagai kepala beserta
 * angkanya, dan sekali dibuka pilihannya diingat. Dibaca di render pertama: dasbor ini baru tampil sesudah datanya
 * dimuat di peramban, jadi tidak ada render di server yang bisa berbeda.
 */
const TINGGI_LAYAR_CUKUP = 820;

export default function PanelKalenderKgb({
  kalender,
  terpilih,
  cakupan,
  onPilih,
}: {
  kalender: KalenderKanwil;
  /** Bulan TMT yang sedang menyaring papan, "yyyy-mm"; null bila tidak ada. */
  terpilih: string | null;
  /** Keterangan satker yang disaring ("fokus", nama satker, dst.); null bila kalender mencakup semua satker. */
  cakupan: string | null;
  /** Dipanggil dengan bulan yang ditekan, atau null bila bulan yang sedang terpilih ditekan lagi. */
  onPilih: (bulanTmt: string | null) => void;
}) {
  const [ciut, alihCiut] = usePanelCiut("kalender-kgb", typeof window !== "undefined" && window.innerHeight < TINGGI_LAYAR_CUKUP);
  const tertinggi = Math.max(1, ...kalender.bulan.map((b) => b.jumlah));
  const adaJendela = kalender.bulan.some((b) => b.jendela);
  const legenda = LEGENDA.filter((l) => kalender.bulan.some((b) => l.posisi.some((p) => b.perPosisi[p])));

  return (
    <section className="dsb-panel kal" aria-labelledby="judul-kalender-kgb" data-ciut={ciut ? "" : undefined}>
      <div className="dsb-panel-kepala">
        <h2 id="judul-kalender-kgb" className="dsb-panel-judul">
          Kalender KGB {kalender.tahun}{" "}
          <small>
            {kalender.jumlah} KGB{cakupan ? ` · ${cakupan}` : ""}
          </small>
        </h2>
        <TombolCiut ciut={ciut} alih={alihCiut} judul="Kalender KGB" />
      </div>

      <ol className="kal-batang" aria-label={`KGB per bulan TMT ${kalender.tahun}`}>
        {kalender.bulan.map((b, n) => (
          <li key={b.bulanTmt}>
            <BatangBulan b={b} n={n} tertinggi={tertinggi} dipilih={terpilih === b.bulanTmt} onPilih={onPilih} />
          </li>
        ))}
      </ol>

      {(legenda.length > 0 || adaJendela) && (
        <ul className="kal-legenda" aria-label="Arti warna batang">
          {legenda.map((l) => (
            <li key={l.label}>
              <i style={{ "--warna": l.warna } as CSSProperties} aria-hidden="true" />
              {l.label}
            </li>
          ))}
          {adaJendela && (
            <li>
              <i data-jendela="" aria-hidden="true" />
              Jendela input
            </li>
          )}
        </ul>
      )}

      {kalender.luarTahun > 0 && (
        <p className="kal-catatan">
          {kalender.luarTahun} KGB lain bertmt di luar {kalender.tahun}, tampil di papan saja.
        </p>
      )}
    </section>
  );
}

function BatangBulan({
  b,
  n,
  tertinggi,
  dipilih,
  onPilih,
}: {
  b: BulanKalender;
  n: number;
  tertinggi: number;
  dipilih: boolean;
  onPilih: (bulanTmt: string | null) => void;
}) {
  const tinggi = b.jumlah > 0 ? Math.max(4, Math.round((b.jumlah / tertinggi) * TINGGI_MAKS)) : 2;
  const label =
    `TMT ${namaBulan(b.bulanTmt, true)}: ` +
    (b.jumlah > 0 ? `${b.jumlah} pegawai, ${ringkasBulan(b)}` : "tidak ada") +
    (b.jendela ? ". Jendela input sedang berjalan" : "") +
    (b.terlambat ? ". Ada yang lewat batas input" : "") +
    (b.jumlah > 0 ? (dipilih ? ". Tekan untuk membuka saringan bulan ini." : ". Tekan untuk menyaring papan ke bulan ini.") : "");
  return (
    <button
      type="button"
      className="kal-bulan"
      data-jendela={b.jendela ? "" : undefined}
      data-terlambat={b.terlambat ? "" : undefined}
      disabled={b.jumlah === 0}
      aria-pressed={dipilih}
      aria-label={label}
      title={label}
      style={{ "--j": n } as CSSProperties}
      onClick={() => onPilih(dipilih ? null : b.bulanTmt)}
    >
      <span className="kal-angka">{b.jumlah > 0 ? b.jumlah : ""}</span>
      <span className="kal-tiang" style={{ height: `${tinggi}px` }} aria-hidden="true">
        {URUTAN_BATANG.map((p) =>
          b.perPosisi[p] ? <span key={p} style={{ flexGrow: b.perPosisi[p], "--warna": WARNA[p] } as CSSProperties} /> : null,
        )}
      </span>
      <span className="kal-label">
        {BULAN_SINGKAT[n]}
        {b.terlambat && <i aria-hidden="true" />}
      </span>
    </button>
  );
}
