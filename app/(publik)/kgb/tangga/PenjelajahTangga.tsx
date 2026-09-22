"use client";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import type { BarisTanggaGaji } from "@/lib/tabelGaji";
import { useKurangiGerak } from "../../useKurangiGerak";
import TanggaSvg from "./TanggaSvg";
import { anakBerlaku, kelompokGolongan } from "./tata";

/* Penjelajah tangga gaji di beranda: satu kartu berisi pilihan golongan, gaji pokok yang berlaku, grafik
   anak tangga, dan penggeser masa kerja. Kendali formulir adalah jalur utama untuk keyboard dan pembaca
   layar; grafik hanya ilustrasi yang juga bisa disorot kursor atau diketuk. */

/** Posisi pada tangga gaji: indeks golongan (baris) dan indeks anak tangga di golongan itu. */
export interface PosisiTangga {
  baris: number;
  anak: number;
}

const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(n));
const ROMAWI = ["I", "II", "III", "IV"];

/* Angka gaji yang berpindah halus ke nilai baru, selalu berangkat dari angka yang sedang tampil sehingga
   perpindahan beruntun (kursor disapu cepat) tidak melompat. Komponen sendiri supaya bingkai animasinya
   hanya merender ulang angkanya, bukan grafik di sekitarnya. */
function AngkaGaji({ nilai, kurangiGerak }: { nilai: number; kurangiGerak: boolean }) {
  const [tampil, setTampil] = useState(nilai);
  const tampilRef = useRef(nilai);

  useEffect(() => {
    const dari = tampilRef.current;
    if (kurangiGerak || Math.round(dari) === nilai) {
      const id = requestAnimationFrame(() => {
        tampilRef.current = nilai;
        setTampil(nilai);
      });
      return () => cancelAnimationFrame(id);
    }
    let bingkai = 0;
    const mulai = performance.now();
    const langkah = (t: number) => {
      const p = Math.min(1, (t - mulai) / 420);
      const kini = p < 1 ? dari + (nilai - dari) * (1 - Math.pow(1 - p, 3)) : nilai;
      tampilRef.current = kini;
      setTampil(kini);
      if (p < 1) bingkai = requestAnimationFrame(langkah);
    };
    bingkai = requestAnimationFrame(langkah);
    return () => cancelAnimationFrame(bingkai);
  }, [nilai, kurangiGerak]);

  return <>{rupiah(tampil)}</>;
}

const TanggaSvgHemat = memo(TanggaSvg);

export default function PenjelajahTangga({ baris }: { baris: BarisTanggaGaji[] }) {
  const id = useId();
  const kurangiGerak = useKurangiGerak();

  const [pilihan, setPilihan] = useState<PosisiTangga>(() => {
    const r = Math.max(0, baris.findIndex((b) => b.golongan === "III/a"));
    return { baris: r, anak: Math.max(0, anakBerlaku(baris[r]?.anak ?? [], 10)) };
  });
  // Anak tangga yang sedang disorot kursor di grafik; null bila tidak ada.
  const [arah, setArah] = useState<number | null>(null);

  const b = baris[pilihan.baris];
  const iTampil = arah ?? pilihan.anak;
  const a = b.anak[iTampil];
  const berikut = b.anak[iTampil + 1];
  const anakPilihan = b.anak[pilihan.anak];

  // Golongan yang anak tangganya baru mulai di MKG 3 dijepit ke anak tangga pertamanya.
  const gantiGolongan = (r: number) => {
    setArah(null);
    setPilihan({ baris: r, anak: Math.max(0, anakBerlaku(baris[r].anak, anakPilihan.mkg)) });
  };

  const barisPilihan = pilihan.baris;
  const saatArah = useCallback((i: number | null) => setArah(i), []);
  const saatPilih = useCallback(
    (i: number) => {
      setArah(null);
      setPilihan({ baris: barisPilihan, anak: i });
    },
    [barisPilihan],
  );

  return (
    <div className="tj">
      <div className="tj-atas">
        <p className="tj-label">Tangga gaji pokok</p>
        <label className="tj-pilih">
          <span className="tj-pilih-label">Golongan</span>
          <select value={pilihan.baris} onChange={(e) => gantiGolongan(Number(e.target.value))}>
            {ROMAWI.map((romawi, k) => (
              <optgroup key={romawi} label={`Golongan ${romawi}`}>
                {baris.map((g, r) =>
                  kelompokGolongan(g.golongan) === k ? (
                    <option key={g.golongan} value={r}>
                      {g.golongan} {g.pangkat}
                    </option>
                  ) : null,
                )}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      <div className="tj-baca">
        <p className="tj-gaji">
          <span className="pub-visually-hidden">Gaji pokok </span>
          <AngkaGaji nilai={a.gaji} kurangiGerak={kurangiGerak} />
        </p>
        <p className="tj-ket">
          <b>{b.golongan}</b> {b.pangkat}, masa kerja golongan {a.mkg} tahun
        </p>
      </div>

      <div className="tj-grafik">
        <TanggaSvgHemat anak={b.anak} sorot={iTampil} onArah={saatArah} onPilih={saatPilih} />
      </div>

      <div className="tj-mkg">
        <label htmlFor={`${id}-mkg`}>
          Masa kerja golongan <output htmlFor={`${id}-mkg`}>{anakPilihan.mkg} tahun</output>
        </label>
        <input
          id={`${id}-mkg`}
          type="range"
          min={0}
          max={b.anak.length - 1}
          step={1}
          value={pilihan.anak}
          aria-valuetext={`${anakPilihan.mkg} tahun, gaji pokok ${rupiah(anakPilihan.gaji)}`}
          style={{ "--isi": `${(pilihan.anak / Math.max(1, b.anak.length - 1)) * 100}%` } as React.CSSProperties}
          onChange={(e) => {
            setArah(null);
            setPilihan({ baris: pilihan.baris, anak: Number(e.target.value) });
          }}
        />
      </div>

      <p className="tj-naik">
        {berikut ? (
          <>
            Anak tangga berikutnya di MKG {berikut.mkg}: <b>{rupiah(berikut.gaji)}</b>
            <span className="tj-naik-selisih">+{rupiah(berikut.gaji - a.gaji)}</span>
          </>
        ) : (
          "Anak tangga terakhir untuk golongan ini."
        )}
      </p>

      <p className="tj-sumber">
        <span>Lampiran PP Nomor 5 Tahun 2024, bukan data pribadi.</span>
        <Link href="/tabel-gaji">Tabel gaji lengkap</Link>
      </p>
    </div>
  );
}
