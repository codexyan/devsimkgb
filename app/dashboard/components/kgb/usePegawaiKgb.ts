"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ambilPegawaiKgb, type HasilAksi, type PegawaiKgb } from "@/lib/kgbAksi";
import { hitungKgbPegawai, type PerhitunganKgb } from "./format";

interface KeadaanPegawaiKgb {
  memuat: boolean;
  galat: string | null;
  pegawai: PegawaiKgb | null;
  /** Perhitungan KGB dari data pegawai terbaru; null selama memuat atau bila pegawai gagal dimuat. */
  perhitungan: PerhitunganKgb | null;
  muatUlang: () => void;
}

/** Data pegawai terbaru dari GET /api/pegawai/[id] beserta perhitungan KGB-nya. */
export function usePegawaiKgb(pegawaiId: string): KeadaanPegawaiKgb {
  const [putaran, setPutaran] = useState(0);
  const [hasil, setHasil] = useState<{ kunci: string; data: HasilAksi<PegawaiKgb> } | null>(null);
  const kunci = `${pegawaiId}#${putaran}`;

  useEffect(() => {
    let batal = false;
    ambilPegawaiKgb(pegawaiId).then((data) => {
      if (!batal) setHasil({ kunci: `${pegawaiId}#${putaran}`, data });
    });
    return () => {
      batal = true;
    };
  }, [pegawaiId, putaran]);

  const data = hasil?.kunci === kunci ? hasil.data : null;
  const perhitungan = useMemo(() => (data?.ok ? hitungKgbPegawai(data.data) : null), [data]);
  const muatUlang = useCallback(() => setPutaran((n) => n + 1), []);

  return {
    memuat: data === null,
    galat: data && !data.ok ? data.error : null,
    pegawai: data?.ok ? data.data : null,
    perhitungan,
    muatUlang,
  };
}
