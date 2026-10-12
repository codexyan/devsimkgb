// Kalender KGB per bulan TMT di dasbor Kanwil (Super Admin dan SDM KGB), ADR-107.
//
// Dua belas bulan TMT tahun berjalan, Januari sampai Desember, dengan jumlah pegawai per posisi antrian di tiap bulan.
// Posisinya sama dengan kolom papan dan kartu satker (lib/kartuSatkerDasbor.ts), sehingga angka di kalender dan isi
// papan tidak dapat berbeda. Murni, tanpa React dan tanpa lapisan data, supaya penyusunannya dapat diuji sendiri.

import type { PosisiKartu } from "./kartuSatkerDasbor";
import { geserKunciBulan } from "./pitaJadwalUpt";

export interface EntriKalender {
  /** Bulan TMT KGB-nya, "yyyy-mm"; null bila TMT-nya belum tercatat. */
  bulanTmt: string | null;
  posisi: PosisiKartu;
}

export interface BulanKalender {
  /** "yyyy-mm". */
  bulanTmt: string;
  jumlah: number;
  perPosisi: Partial<Record<PosisiKartu, number>>;
  /** Posisi paling mendesak di bulan ini ("selesai" bila bulannya kosong). Bentuknya sama dengan BulanKartu, jadi ringkasBulan dapat dipakai. */
  utama: PosisiKartu;
  /** Jendela input bulan ini sedang berjalan: TMT dua bulan sesudah bulan berjalan (surat dikirim dan input dibuka bulan yang sama). */
  jendela: boolean;
  /** Ada yang lewat batas input di bulan ini. */
  terlambat: boolean;
}

export interface KalenderKanwil {
  tahun: number;
  bulan: BulanKalender[];
  /** Pegawai di dalam tahun ini. */
  jumlah: number;
  /** Pegawai yang TMT-nya di luar tahun ini atau belum tercatat; tetap ada di papan, tidak di kalender. */
  luarTahun: number;
}

/**
 * Urutan susunan batang dari atas ke bawah: yang paling perlu dikerjakan di atas, yang selesai menjadi dasarnya.
 * Sama dengan urutan mendesak di kartu satker.
 */
export const URUTAN_BATANG: readonly PosisiKartu[] = ["lewat", "siap", "diproses", "keuangan", "rekam_upt", "terkunci", "selesai"];

const kunciBulan = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/**
 * Susun kalender tahun berjalan. `hariIni` menentukan tahun dan bulan jendela input; cakupannya mengikuti daftar dasbor
 * (TMT sampai akhir tahun berjalan, minimal tiga bulan ke depan), jadi tahun ini selalu utuh dan tahun depan tidak ikut.
 */
export function susunKalenderKanwil(entri: readonly EntriKalender[], hariIni: Date): KalenderKanwil {
  const tahun = hariIni.getFullYear();
  const bulanJendela = geserKunciBulan(kunciBulan(hariIni), 2);
  const bulan: BulanKalender[] = Array.from({ length: 12 }, (_, i) => ({
    bulanTmt: `${tahun}-${String(i + 1).padStart(2, "0")}`,
    jumlah: 0,
    perPosisi: {},
    utama: "selesai",
    jendela: false,
    terlambat: false,
  }));
  const peta = new Map(bulan.map((b) => [b.bulanTmt, b]));

  let luarTahun = 0;
  for (const e of entri) {
    const b = e.bulanTmt ? peta.get(e.bulanTmt) : undefined;
    if (!b) {
      luarTahun += 1;
      continue;
    }
    b.jumlah += 1;
    b.perPosisi[e.posisi] = (b.perPosisi[e.posisi] ?? 0) + 1;
  }

  for (const b of bulan) {
    b.utama = URUTAN_BATANG.find((p) => b.perPosisi[p]) ?? "selesai";
    b.terlambat = (b.perPosisi.lewat ?? 0) > 0;
    b.jendela = b.bulanTmt === bulanJendela;
  }

  return { tahun, bulan, jumlah: bulan.reduce((n, b) => n + b.jumlah, 0), luarTahun };
}
