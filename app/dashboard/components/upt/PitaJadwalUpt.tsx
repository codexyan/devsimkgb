"use client";

import { useState, type CSSProperties } from "react";
import AngkaNaik from "@/app/dashboard/components/AngkaNaik";
import { geserBulan, namaBulan } from "@/app/dashboard/satker/labelSatker";
import {
  TAHAP_PITA,
  langkahJendela,
  teksJendela,
  type BulanPita,
  type BulanTmtKalender,
  type LangkahJendela,
  type TahapPita,
} from "@/lib/pitaJadwalUpt";

/* Pita jadwal di kepala Dasbor Admin UPT, ringkas dalam tiga zona sebaris (ADR-103, menggantikan empat kartu ADR-101):

   1. Jendela kirim bulan ini: cincin hitung mundur, TMT yang diusulkan, jumlah per tahap, dan empat langkah bulan ini.
      Tombol Rincian membuka jendela langkah lengkap beserta rekon Gaji Web yang juga berlangsung bulan ini.
   2. KGB per bulan TMT: dua belas batang Januari sampai Desember dengan warna tahap yang sama. Batang dibuka ke jendela
      daftar pegawai yang sudah ada.
   3. KGB tahun ini: cincin kemajuan, dan tombol pegawai yang terlambat.

   Gerak (muncul bergiliran, angka menghitung naik, batang tumbuh, denyut hari ini) mengikuti pilihan Animasi. */

const gaya = (v: Record<string, string | number>) => v as CSSProperties;
const bulanSingkat = (kunci: string) => namaBulan(kunci).split(" ")[0];

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

/** Teks singkat tiap langkah untuk baris langkah di zona jendela kirim. */
export function teksLangkah(l: LangkahJendela, b: BulanPita, batasKirim: number): { judul: string; ket: string } {
  const kirim = bulanSingkat(b.bulanKirim);
  switch (l.kunci) {
    case "surat":
      return { judul: "Surat", ket: `${batasKirim} ${kirim}` };
    case "ajukan":
      return { judul: "Ajukan", ket: `${b.jumlah - b.perTahap.usulkan}/${b.jumlah}` };
    case "input":
      return { judul: "Kanwil", ket: `${b.hariDalamBulan} ${kirim}` };
    case "rekon":
      return { judul: "Rekon", ket: `15 ${bulanSingkat(geserBulan(b.bulanKirim, 1))}` };
  }
}

function ZonaJendela({
  b,
  berikutnya,
  batasKirim,
  onBukaRincian,
}: {
  b: BulanPita;
  /** Bulan kirim berikutnya, untuk hitung mundur sesudah jendela bulan ini ditutup. */
  berikutnya: BulanPita | undefined;
  batasKirim: number;
  onBukaRincian: () => void;
}) {
  const buka = b.jendela.keadaan === "buka";
  const sisa = b.jendela.keadaan === "buka" ? b.jendela.sisaHari : null;
  const mulaiBerikutnya = berikutnya?.jendela.keadaan === "belum" ? berikutnya.jendela.mulaiDalam : null;
  const persen = buka ? Math.round(Math.min(1, (b.hariIni ?? 0) / batasKirim) * 100) : 100;
  const angka = buka ? sisa ?? 0 : mulaiBerikutnya ?? 0;
  const labelAngka = buka ? (sisa === 0 ? "hari terakhir" : "hari lagi") : "hari ke jendela berikut";
  const rincian = rincianTahap(b.perTahap);
  const langkah = langkahJendela(b);
  return (
    <section className="pjd-zona pjd-jendela" data-keadaan={b.jendela.keadaan} style={gaya({ "--i": 0 })} aria-label="Jendela kirim bulan ini">
      <span
        className="pjd-ring"
        role="img"
        aria-label={buka ? `Jendela kirim terbuka, ${teksJendela(b.jendela, batasKirim, bulanSingkat(b.bulanKirim))}` : `Jendela kirim ditutup; jendela berikutnya ${angka} hari lagi`}
      >
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="pjd-ring-jalur" cx="50" cy="50" r="44" />
          <circle className="pjd-ring-isi" cx="50" cy="50" r="44" pathLength={100} style={gaya({ "--persen": persen })} />
        </svg>
        <span>
          <b>
            <AngkaNaik nilai={angka} />
          </b>
          <small>{labelAngka}</small>
        </span>
      </span>
      <div className="pjd-jendela-isi">
        <p className="pjd-jendela-judul">
          <span>Kirim {namaBulan(b.bulanKirim, true)}</span>
          <span className="pjd-pil" data-keadaan={b.jendela.keadaan}>
            {buka ? "Terbuka" : `Ditutup ${batasKirim} ${bulanSingkat(b.bulanKirim)}`}
          </span>
        </p>
        <p className="pjd-jendela-tmt">
          untuk KGB TMT <strong>{namaBulan(b.bulanTmt, true)}</strong>
        </p>
        <div className="pjd-jendela-angka">
          <strong>
            <AngkaNaik nilai={b.jumlah} />
            <small> pegawai</small>
          </strong>
          <BatangTahap perTahap={b.perTahap} />
        </div>
        {(rincian || b.periksaSk > 0) && (
          <p className="pjd-jendela-rincian">
            {TAHAP_PITA.filter((t) => b.perTahap[t.kunci] > 0).map((t) => (
              <span key={t.kunci} data-tahap={t.kunci}>
                <strong>{b.perTahap[t.kunci]}</strong> {t.ringkas}
              </span>
            ))}
            {b.periksaSk > 0 && <span className="pjd-chip">{b.periksaSk} menunggu Periksa SK</span>}
          </p>
        )}
        <ol className="pjd-langkah" aria-label="Langkah bulan ini">
          {langkah.map((l, i) => {
            const t = teksLangkah(l, b, batasKirim);
            return (
              <li key={l.kunci} data-keadaan={l.keadaan}>
                <span aria-hidden="true">{l.keadaan === "selesai" ? "✓" : i + 1}</span>
                {t.judul} <strong>{t.ket}</strong>
              </li>
            );
          })}
        </ol>
      </div>
      <button type="button" className="pjd-rincian-tombol" onClick={onBukaRincian}>
        Rincian
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </button>
    </section>
  );
}

function ZonaKalender({
  kalender,
  tahunAwal,
  onBukaBulan,
}: {
  kalender: Record<number, BulanTmtKalender[]>;
  tahunAwal: number;
  onBukaBulan: (bulanTmt: string) => void;
}) {
  const daftarTahun = Object.keys(kalender).map(Number).sort((a, b) => a - b);
  const [tahun, setTahun] = useState(daftarTahun.includes(tahunAwal) ? tahunAwal : daftarTahun[0]);
  const i = daftarTahun.indexOf(tahun);
  const bulan = kalender[tahun] ?? [];
  const tertinggi = Math.max(1, ...bulan.map((b) => b.jumlah));
  return (
    <section className="pjd-zona pjd-kalender" style={gaya({ "--i": 1 })} aria-label={`KGB per bulan TMT ${tahun}`}>
      <div className="pjd-zona-kepala">
        <p className="pjd-judul">KGB per bulan TMT</p>
        <span className="pjd-tahun-pilih">
          <button type="button" aria-label="Tahun sebelumnya" disabled={i <= 0} onClick={() => setTahun(daftarTahun[i - 1])}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 6 9 12 15 18" />
            </svg>
          </button>
          <b>{tahun}</b>
          <button type="button" aria-label="Tahun berikutnya" disabled={i >= daftarTahun.length - 1} onClick={() => setTahun(daftarTahun[i + 1])}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        </span>
      </div>
      <ol className="pjd-batang">
        {bulan.map((b, n) => {
          const tinggi = b.jumlah > 0 ? Math.max(4, Math.round((b.jumlah / tertinggi) * 62)) : 2;
          const rincian = rincianTahap(b.perTahap);
          return (
            <li key={b.bulanTmt}>
              <button
                type="button"
                className="pjd-batang-bulan"
                data-keadaan={b.keadaan}
                disabled={b.jumlah === 0}
                onClick={() => onBukaBulan(b.bulanTmt)}
                style={gaya({ "--j": n })}
                aria-label={
                  `KGB TMT ${namaBulan(b.bulanTmt, true)}: ` +
                  (b.jumlah > 0 ? `${b.jumlah} pegawai, ${rincian}` : "tidak ada") +
                  (b.keadaan === "jendela" ? ". Jendela kirim terbuka" : b.keadaan === "terlambat" ? ". Terlambat diusulkan" : "") +
                  (b.jumlah > 0 ? ". Buka daftar pegawai." : "")
                }
              >
                <span className="pjd-batang-angka">{b.jumlah > 0 ? b.jumlah : ""}</span>
                <span className="pjd-batang-tiang" style={gaya({ height: `${tinggi}px` })} aria-hidden="true">
                  {TAHAP_PITA.map((t) =>
                    b.perTahap[t.kunci] > 0 ? <span key={t.kunci} data-tahap={t.kunci} style={{ flexGrow: b.perTahap[t.kunci] }} /> : null,
                  )}
                </span>
                <span className="pjd-batang-label">
                  {bulanSingkat(b.bulanTmt)}
                  {b.keadaan === "terlambat" && <i aria-hidden="true" />}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
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
  kalender,
  onBukaBulan,
  onBukaTerlambat,
  onBukaRincian,
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
  /** Dua belas bulan TMT per tahun yang dapat dipilih (lib/pitaJadwalUpt.ts susunKalenderTmt). */
  kalender: Record<number, BulanTmtKalender[]>;
  onBukaBulan: (bulanTmt: string) => void;
  onBukaTerlambat: () => void;
  onBukaRincian: () => void;
}) {
  const total = tahunIni?.total ?? 0;
  const selesai = tahunIni?.selesai ?? 0;
  const persen = total > 0 ? Math.round((selesai / total) * 100) : 0;
  const sekarang = pita[0];
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
      <div className="pjd-zona-baris">
        {sekarang && <ZonaJendela b={sekarang} berikutnya={pita[1]} batasKirim={batasKirim} onBukaRincian={onBukaRincian} />}
        <ZonaKalender kalender={kalender} tahunAwal={tahun} onBukaBulan={onBukaBulan} />
        <section className="pjd-zona pjd-tahun-zona" style={gaya({ "--i": 2 })} aria-label={`KGB ${tahun}`}>
          <p className="pjd-judul">KGB {tahun}</p>
          <span className="pjd-tahun">
            <span className="pjd-cincin" role="img" aria-label={total > 0 ? `${persen} persen KGB ${tahun} selesai` : `Belum ada KGB ${tahun}`}>
              <svg viewBox="0 0 44 44" aria-hidden="true">
                <circle className="pjd-cincin-jalur" cx="22" cy="22" r="18" />
                {total > 0 && <circle className="pjd-cincin-isi" cx="22" cy="22" r="18" pathLength={100} style={gaya({ "--persen": persen })} />}
              </svg>
              <span>{total > 0 ? `${persen}%` : "–"}</span>
            </span>
            <span className="min-w-0">
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
          {tertinggal > 0 ? (
            <button
              type="button"
              className="pjd-terlambat"
              onClick={onBukaTerlambat}
              aria-label={
                `${tertinggal} pegawai dengan TMT yang sudah lewat jadwal kirim dan KGB-nya belum selesai` +
                `${rincianTahap(tertinggalPerTahap) ? `: ${rincianTahap(tertinggalPerTahap)}` : ""}. Buka daftar pegawai.`
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3.5l9 16H3z" />
                <path d="M12 10v4.5M12 17.5v.01" />
              </svg>
              <span className="min-w-0">
                <strong>{tertinggal} terlambat</strong>
                <small>
                  {tertinggalPerTahap.usulkan > 0 ? `${tertinggalPerTahap.usulkan} perlu diusulkan` : "sudah berjalan, belum selesai"}
                </small>
              </span>
            </button>
          ) : (
            <p className="pjd-aman">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12.5l2.7 2.7L16 9.5" />
              </svg>
              Tidak ada yang terlambat
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
