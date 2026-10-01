"use client";

import { useCallback, useEffect, useState } from "react";

/* Panel rail yang dapat diciutkan (ADR-050).
 *
 * Rail kanan dasbor hanya setinggi papan antrian, sedangkan isinya tiga panel yang masing-masing punya
 * tinggi minimum. Begitu seluruh UPT terisi, isinya jauh melampaui ruang yang ada dan railnya berubah
 * menjadi satu gulir panjang; yang mendesak terbenam di dalamnya. Menciutkan panel yang sedang tidak
 * dipakai mengembalikan ruang itu, dan kepalanya tetap terbaca sebagai penanda beserta angkanya.
 *
 * Pilihannya diingat per peramban, sama seperti kolom papan antrian. Disimpan sebagai peta id ke boolean,
 * bukan daftar yang diciutkan, supaya panel yang belum pernah disentuh tetap memakai bawaannya sendiri.
 */

const KUNCI = "kgb-panel-ciut";

function baca(): Record<string, boolean> {
  try {
    const simpan: unknown = JSON.parse(localStorage.getItem(KUNCI) ?? "null");
    return simpan && typeof simpan === "object" ? (simpan as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

/**
 * Keadaan ciut satu panel beserta pengalihnya. `bawaanCiut` dipakai sampai pemakainya pernah mengubahnya
 * sendiri; sesudah itu yang tersimpan yang menang.
 */
export function usePanelCiut(id: string, bawaanCiut = false): [boolean, () => void] {
  const [ciut, setCiut] = useState(bawaanCiut);

  // Dibaca sesudah render pertama: localStorage tidak ada saat render di server, dan bisa juga ditolak
  // peramban pada mode privat.
  useEffect(() => {
    const t = setTimeout(() => {
      const simpan = baca();
      if (typeof simpan[id] === "boolean") setCiut(simpan[id]);
    }, 0);
    return () => clearTimeout(t);
  }, [id]);

  const alih = useCallback(() => {
    setCiut((sebelum) => {
      const sesudah = !sebelum;
      try {
        localStorage.setItem(KUNCI, JSON.stringify({ ...baca(), [id]: sesudah }));
      } catch {
        /* abaikan: pilihannya hanya tidak diingat */
      }
      return sesudah;
    });
  }, [id]);

  return [ciut, alih];
}

/** Tombol ciut di kepala panel; tanda panahnya berputar mengikuti keadaan. */
export function TombolCiut({ ciut, alih, judul }: { ciut: boolean; alih: () => void; judul: string }) {
  const label = ciut ? `Buka ${judul}` : `Ciutkan ${judul}`;
  return (
    <button type="button" className="dsb-ciut-tombol" aria-expanded={!ciut} onClick={alih} title={label} aria-label={label}>
      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}
