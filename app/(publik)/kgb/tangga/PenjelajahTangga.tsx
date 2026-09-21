"use client";

import { memo, useCallback, useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { BarisTanggaGaji } from "@/lib/tabelGaji";
import { useKurangiGerak } from "../../useKurangiGerak";
import type { PosisiTangga } from "./LanskapGaji";
import TanggaSvg from "./TanggaSvg";
import { anakBerlaku, kelompokGolongan } from "./tata";

/* Penjelajah tangga gaji di panggung beranda. Pilihan (golongan dan masa kerja) dipegang di sini dan
   dipakai bersama oleh lanskap 3D, grafik SVG cadangan, kendali formulir, dan pembacaan gaji.
   Kendali formulir adalah jalur utama untuk keyboard dan pembaca layar; lanskap hanya ilustrasi
   yang juga bisa diarahkan dengan kursor atau diketuk. */

const LanskapGaji = dynamic(() => import("./LanskapGaji"), { ssr: false });

const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(Math.round(n));
const ROMAWI = ["I", "II", "III", "IV"];

/* Angka gaji yang berpindah halus ke nilai baru, selalu berangkat dari angka yang sedang tampil sehingga
   perpindahan beruntun (kursor disapu cepat) tidak melompat. Komponen sendiri supaya bingkai animasinya
   hanya merender ulang angkanya, bukan lanskap dan grafik di sekitarnya. */
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
  const [arah, setArah] = useState<PosisiTangga | null>(null);
  const [muat, setMuat] = useState(false);
  const [siap, setSiap] = useState(false);
  const [gagal, setGagal] = useState(false);

  // Lanskap dimuat setelah halaman tenang, dan tidak dimuat bila pengguna menghemat data.
  useEffect(() => {
    const koneksi = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (koneksi?.saveData) return;
    const mulai = () => setMuat(true);
    if (typeof window.requestIdleCallback === "function") {
      const tugas = window.requestIdleCallback(mulai, { timeout: 1500 });
      return () => window.cancelIdleCallback(tugas);
    }
    const pewaktu = setTimeout(mulai, 600);
    return () => clearTimeout(pewaktu);
  }, []);

  const tampil = arah ?? pilihan;
  const b = baris[tampil.baris];
  const a = b.anak[tampil.anak];
  const berikut = b.anak[tampil.anak + 1];

  const barisPilihan = baris[pilihan.baris];
  const anakPilihan = barisPilihan.anak[pilihan.anak];

  // Golongan yang anak tangganya baru mulai di MKG 3 dijepit ke anak tangga pertamanya.
  const gantiGolongan = (r: number) => {
    setArah(null);
    setPilihan({ baris: r, anak: Math.max(0, anakBerlaku(baris[r].anak, anakPilihan.mkg)) });
  };

  const saatArah = useCallback((p: PosisiTangga | null) => setArah(p), []);
  const saatPilih = useCallback((p: PosisiTangga) => {
    setArah(null);
    setPilihan(p);
  }, []);
  const saatSiap = useCallback(() => setSiap(true), []);
  const saatGagal = useCallback(() => setGagal(true), []);

  return (
    <div className="tg-jelajah" data-3d={siap && !gagal ? "1" : "0"}>
      <div className="tg-kanvas">
        <div className="tg-cadangan">
          <TanggaSvgHemat anak={b.anak} sorot={tampil.anak} />
        </div>
        {muat && !gagal && (
          <LanskapGaji
            baris={baris}
            sorot={tampil}
            kurangiGerak={kurangiGerak}
            onArah={saatArah}
            onPilih={saatPilih}
            onSiap={saatSiap}
            onGagal={saatGagal}
          />
        )}
        <p className="tg-petunjuk" aria-hidden="true">
          <span className="tg-petunjuk-kursor">Arahkan kursor ke anak tangga</span>
          <span className="tg-petunjuk-sentuh">Ketuk anak tangga</span>
        </p>
      </div>

      <div className="tg-baca">
        <p className="tg-baca-gol">
          <span className="tg-baca-kode">{b.golongan}</span>
          {b.pangkat}
        </p>
        <p className="tg-baca-gaji">
          <span className="pub-visually-hidden">Gaji pokok </span>
          <AngkaGaji nilai={a.gaji} kurangiGerak={kurangiGerak} />
        </p>
        <p className="tg-baca-mkg">Gaji pokok pada masa kerja golongan {a.mkg} tahun</p>
        <p className="tg-baca-naik">
          {berikut ? (
            <>
              Anak tangga berikutnya di MKG {berikut.mkg}: <b>{rupiah(berikut.gaji)}</b>, naik {rupiah(berikut.gaji - a.gaji)}.
            </>
          ) : (
            "Anak tangga terakhir untuk golongan ini."
          )}
        </p>
      </div>

      <div className="tg-kendali">
        <div className="tg-bidang">
          <label htmlFor={`${id}-gol`}>Golongan</label>
          <div className="tg-pilih">
            <select id={`${id}-gol`} value={pilihan.baris} onChange={(e) => gantiGolongan(Number(e.target.value))}>
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
          </div>
        </div>
        <div className="tg-bidang tg-bidang-mkg">
          <label htmlFor={`${id}-mkg`}>
            Masa kerja golongan <output htmlFor={`${id}-mkg`}>{anakPilihan.mkg} tahun</output>
          </label>
          <input
            id={`${id}-mkg`}
            type="range"
            min={0}
            max={barisPilihan.anak.length - 1}
            step={1}
            value={pilihan.anak}
            aria-valuetext={`${anakPilihan.mkg} tahun, gaji pokok ${rupiah(anakPilihan.gaji)}`}
            style={{ "--isi": `${(pilihan.anak / Math.max(1, barisPilihan.anak.length - 1)) * 100}%` } as React.CSSProperties}
            onChange={(e) => {
              setArah(null);
              setPilihan({ baris: pilihan.baris, anak: Number(e.target.value) });
            }}
          />
        </div>
      </div>

      <p className="tg-sumber">
        Gaji pokok PNS menurut Lampiran PP Nomor 5 Tahun 2024, bukan data pribadi.{" "}
        <Link href="/tabel-gaji">Buka tabel gaji lengkap</Link>
      </p>
    </div>
  );
}
