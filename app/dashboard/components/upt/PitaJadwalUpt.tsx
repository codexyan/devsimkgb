"use client";

import type { CSSProperties } from "react";
import AngkaNaik from "@/app/dashboard/components/AngkaNaik";
import { namaBulan } from "@/app/dashboard/satker/labelSatker";
import { TAHAP_PITA, teksJendela, type BulanPita, type TahapPita } from "@/lib/pitaJadwalUpt";

/* Pita jadwal kirim surat usulan di kepala Dasbor Admin UPT (ADR-101).

   Linimasa empat bulan KIRIM: bulan berjalan paling lebar, dengan garis jendela kirim (tanggal 1 sampai batas kirim),
   penanda hari ini, dan hitung mundur. Tiap bulan memuat jumlah pegawai yang TMT-nya diusulkan pada bulan itu beserta
   batang empat tahap (sama dengan kolom papan). Kartu dapat dibuka untuk melihat daftar pegawainya. Gerak (kartu muncul
   bergiliran, angka menghitung naik, batang tumbuh, denyut hari ini) mengikuti pilihan Animasi. */

const gaya = (v: Record<string, string | number>) => v as CSSProperties;

function BatangTahap({ perTahap }: { perTahap: Record<TahapPita, number> }) {
  return (
    <span className="pjd-status" aria-hidden="true">
      {TAHAP_PITA.map((t) =>
        perTahap[t.kunci] > 0 ? <span key={t.kunci} data-tahap={t.kunci} style={{ flexGrow: perTahap[t.kunci] }} /> : null,
      )}
    </span>
  );
}

/** Rincian tahap dalam kalimat; hanya tahap yang berisi. */
function rincianTahap(perTahap: Record<TahapPita, number>): string {
  return TAHAP_PITA.filter((t) => perTahap[t.kunci] > 0)
    .map((t) => `${perTahap[t.kunci]} ${t.ringkas}`)
    .join(" · ");
}

function KartuBulan({
  b,
  aktif,
  urutan,
  batasKirim,
  onBuka,
}: {
  b: BulanPita;
  /** Bulan kirim yang sedang berjalan. */
  aktif: boolean;
  /** Urutan kartu di pita, untuk jeda munculnya. */
  urutan: number;
  batasKirim: number;
  onBuka: () => void;
}) {
  const bulanSingkat = namaBulan(b.bulanKirim).split(" ")[0];
  const mundur = teksJendela(b.jendela, batasKirim, bulanSingkat);
  const rincian = rincianTahap(b.perTahap);
  const lebarJendela = Math.min(1, batasKirim / b.hariDalamBulan);
  return (
    <button
      type="button"
      className="pjd-kartu"
      data-aktif={aktif ? "" : undefined}
      data-kosong={b.jumlah === 0 ? "" : undefined}
      data-jendela={b.jendela.keadaan}
      style={gaya({ "--i": urutan })}
      onClick={onBuka}
      aria-label={
        `Kirim surat usulan ${namaBulan(b.bulanKirim, true)} untuk KGB TMT ${namaBulan(b.bulanTmt, true)}: ` +
        `${b.jumlah} pegawai${rincian ? `, ${rincian}` : ""}${b.periksaSk ? `, ${b.periksaSk} menunggu Periksa SK` : ""}; ${mundur}. ` +
        "Buka daftar pegawai."
      }
    >
      {/* Linimasa: sebulan penuh, jendela kirim 1 sampai batas, dan di bulan berjalan isi sampai hari ini. */}
      <span className="pjd-garis" aria-hidden="true">
        <span className="pjd-garis-jendela" style={gaya({ "--lebar": lebarJendela })} />
        {aktif && b.hariIni !== null && (
          <>
            <span className="pjd-garis-isi" style={gaya({ "--lebar": Math.min(1, b.hariIni / b.hariDalamBulan) })} />
            <span className="pjd-hari-ini" style={gaya({ "--pos": (b.hariIni - 0.5) / b.hariDalamBulan })} />
          </>
        )}
      </span>
      <span className="pjd-kepala">
        <span className="pjd-bulan">Kirim {namaBulan(b.bulanKirim, aktif)}</span>
        {aktif && (
          <span className="pjd-pil" data-keadaan={b.jendela.keadaan}>
            {b.jendela.keadaan === "buka" ? "Terbuka" : "Ditutup"}
          </span>
        )}
      </span>
      {/* Kartu sempit cukup menyebut bulan TMT-nya; kalimat lengkapnya ada di label untuk pembaca layar. */}
      <span className="pjd-tmt">{aktif ? `untuk KGB TMT ${namaBulan(b.bulanTmt, true)}` : `TMT ${namaBulan(b.bulanTmt)}`}</span>
      <span className="pjd-angka">
        <AngkaNaik nilai={b.jumlah} />
        <small> pegawai</small>
      </span>
      <span className="pjd-mundur">
        {mundur}
        {aktif && <span className="pjd-rentang"> · 1–{batasKirim} {bulanSingkat}</span>}
      </span>
      <BatangTahap perTahap={b.perTahap} />
      {aktif && (rincian || b.periksaSk > 0) && (
        <span className="pjd-rincian">
          {rincian}
          {b.periksaSk > 0 && <span className="pjd-chip">{b.periksaSk} menunggu Periksa SK</span>}
        </span>
      )}
      <span className="pjd-panah" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </span>
    </button>
  );
}

export default function PitaJadwalUpt({
  pita,
  batasKirim,
  tertinggal,
  tertinggalPerTahap,
  tahun,
  tahunIni,
  kgbDitunda,
  baruMenunggu,
  onBukaBulan,
  onBukaTerlambat,
}: {
  pita: BulanPita[];
  batasKirim: number;
  /** Pegawai yang TMT-nya sudah lewat jendela kirim dan KGB-nya belum selesai. */
  tertinggal: number;
  /** Tahap pegawai yang terlambat: sebagian bisa sudah diproses Kanwil. */
  tertinggalPerTahap: Record<TahapPita, number>;
  tahun: number;
  tahunIni: { selesai: number; total: number } | null;
  kgbDitunda: number;
  /** Usulan pegawai baru yang sudah dikirim dan menunggu tinjauan Kanwil; belum punya TMT tercatat. */
  baruMenunggu: number;
  onBukaBulan: (bulanTmt: string) => void;
  onBukaTerlambat: () => void;
}) {
  const total = tahunIni?.total ?? 0;
  const selesai = tahunIni?.selesai ?? 0;
  const persen = total > 0 ? Math.round((selesai / total) * 100) : 0;
  const geser = tertinggal > 0 ? 1 : 0;
  return (
    <div className="pjd" aria-label="Jadwal kirim surat usulan">
      <div className="pjd-atas">
        <p className="pjd-judul">Jadwal kirim surat usulan</p>
        <ul className="pjd-legenda" aria-label="Arti warna batang">
          {TAHAP_PITA.map((t) => (
            <li key={t.kunci} data-tahap={t.kunci}>
              {t.label}
            </li>
          ))}
        </ul>
        {baruMenunggu > 0 && (
          <p className="pjd-info">
            {baruMenunggu} pegawai baru menunggu tinjauan Kanwil; masuk jadwal setelah disetujui.
          </p>
        )}
      </div>
      <div className="pjd-rel">
        {tertinggal > 0 && (
          <button
            type="button"
            className="pjd-kartu"
            data-terlambat=""
            style={gaya({ "--i": 0 })}
            onClick={onBukaTerlambat}
            aria-label={
              `${tertinggal} pegawai dengan TMT yang sudah lewat jadwal kirim dan KGB-nya belum selesai` +
              `${rincianTahap(tertinggalPerTahap) ? `: ${rincianTahap(tertinggalPerTahap)}` : ""}. Buka daftar pegawai.`
            }
          >
            <span className="pjd-garis" aria-hidden="true" />
            <span className="pjd-kepala">
              <span className="pjd-bulan">Terlambat</span>
            </span>
            <span className="pjd-tmt">TMT sudah lewat</span>
            <span className="pjd-angka">
              <AngkaNaik nilai={tertinggal} />
              <small> pegawai</small>
            </span>
            {/* Hanya yang belum diusulkan yang perlu dikejar; sisanya sudah berjalan di Kanwil. */}
            <span className="pjd-mundur">
              {tertinggalPerTahap.usulkan > 0 ? `${tertinggalPerTahap.usulkan} perlu diusulkan` : "sudah berjalan, belum selesai"}
            </span>
            <BatangTahap perTahap={tertinggalPerTahap} />
            <span className="pjd-panah" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </span>
          </button>
        )}
        {pita.map((b, i) => (
          <KartuBulan
            key={b.bulanKirim}
            b={b}
            aktif={i === 0}
            urutan={i + geser}
            batasKirim={batasKirim}
            onBuka={() => onBukaBulan(b.bulanTmt)}
          />
        ))}
        <div className="pjd-kartu" data-tahun="" style={gaya({ "--i": pita.length + geser })}>
          <span className="pjd-garis" aria-hidden="true" />
          <span className="pjd-tahun">
            <span className="pjd-cincin" role="img" aria-label={total > 0 ? `${persen} persen KGB ${tahun} selesai` : `Belum ada KGB ${tahun}`}>
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle className="pjd-cincin-jalur" cx="22" cy="22" r="18" />
                {total > 0 && <circle className="pjd-cincin-isi" cx="22" cy="22" r="18" pathLength={100} style={gaya({ "--persen": persen })} />}
              </svg>
              <span>{total > 0 ? `${persen}%` : "–"}</span>
            </span>
            <span className="min-w-0">
              <span className="pjd-bulan">KGB {tahun}</span>
              {total > 0 ? (
                <span className="pjd-angka">
                  <AngkaNaik nilai={selesai} />
                  <small> / {total} selesai</small>
                </span>
              ) : (
                <span className="pjd-tmt">Belum ada KGB {tahun} tercatat</span>
              )}
              {kgbDitunda > 0 && <span className="pjd-mundur">{kgbDitunda} KGB ditunda karena hukdis</span>}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
