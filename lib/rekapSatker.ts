// Ringkasan KGB per satuan kerja (Kanwil dan UPT) untuk modul Satker & UPT.
// Murni (tanpa akses data); hitungan memakai definisi bersama lib/rekapKgb.ts sehingga angkanya sama
// dengan dashboard dan Data KGB bila dijumlahkan.

import {
  entriRekapKgb,
  hitungRekapStatus,
  kunciBulanTmt,
  satuPerSiklus,
  tahunTmt,
  type KgbUntukRekap,
  type RekapStatusKgb,
} from "./rekapKgb";
import { SATKER, SATKER_KANWIL, cariSatker, type Satker } from "./satker";
import type { NilaiTanggal } from "./waktu";

/** Kode untuk pegawai yang unit kerjanya tidak ada di daftar satker. */
export const KODE_SATKER_LAIN = "__lain__";

export interface PegawaiUntukSatker {
  id: string;
  aktif: boolean;
  tmtKgbBerikutnya: NilaiTanggal;
  unitKerja: string | null;
  statusHukdis: boolean;
}

/** Kode satker dari isian unit kerja; kosong berarti Kanwil, sama dengan aturan impor pegawai. */
export function kodeSatkerPegawai(unitKerja: string | null | undefined): string {
  const teks = unitKerja?.trim();
  if (!teks) return SATKER_KANWIL.kode;
  return cariSatker(teks)?.kode ?? KODE_SATKER_LAIN;
}

export interface RingkasanSatker {
  satker: Satker;
  /** Pegawai aktif yang tercatat di satker ini. */
  pegawai: number;
  hukdis: number;
  /** KGB dengan TMT tahun berjalan, satu per pegawai per TMT. */
  tahunIni: RekapStatusKgb;
  /** Seluruh siklus: belum diinput padahal batas input sudah lewat. */
  terlambat: number;
  /** Seluruh siklus yang belum selesai dan berpotensi rapelan. */
  berpotensiRapelan: number;
  /** Jumlah pegawai per bulan TMT untuk beberapa bulan ke depan: dasar jadwal surat usulan UPT. */
  mendatang: { bulanTmt: string; jumlah: number }[];
}

function kunciBulan(tanggal: Date, geser: number): string {
  const t = new Date(tanggal.getFullYear(), tanggal.getMonth() + geser, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Ringkasan untuk setiap satker di daftar SATKER (urutan daftar dipertahankan), ditambah jumlah pegawai
 * aktif yang unit kerjanya belum sesuai daftar satker.
 */
export function rekapPerSatker(input: {
  pegawai: readonly PegawaiUntukSatker[];
  kgb: readonly KgbUntukRekap[];
  hariIni: Date;
  /** Banyaknya bulan TMT ke depan untuk jadwal usulan, mulai bulan depan. */
  bulanKeDepan?: number;
}): { satker: RingkasanSatker[]; pegawaiTanpaSatker: number } {
  const { pegawai, kgb, hariIni, bulanKeDepan = 4 } = input;
  const tahun = hariIni.getFullYear();
  const aktif = pegawai.filter((p) => p.aktif);
  const kodePegawai = new Map(pegawai.map((p) => [p.id, kodeSatkerPegawai(p.unitKerja)]));
  const siklus = satuPerSiklus(entriRekapKgb(kgb, pegawai));
  const bulanDepan = Array.from({ length: bulanKeDepan }, (_, i) => kunciBulan(hariIni, i + 1));

  const satker = SATKER.map((s): RingkasanSatker => {
    const pegawaiSatker = aktif.filter((p) => kodePegawai.get(p.id) === s.kode);
    const siklusSatker = siklus.filter((k) => kodePegawai.get(k.pegawaiId) === s.kode);
    const semua = hitungRekapStatus(siklusSatker, hariIni);
    return {
      satker: s,
      pegawai: pegawaiSatker.length,
      hukdis: pegawaiSatker.filter((p) => p.statusHukdis).length,
      tahunIni: hitungRekapStatus(siklusSatker.filter((k) => tahunTmt(k) === tahun), hariIni),
      terlambat: semua.terlambat,
      berpotensiRapelan: semua.berpotensiRapelan,
      mendatang: bulanDepan.map((bulanTmt) => ({
        bulanTmt,
        jumlah: pegawaiSatker.filter((p) => kunciBulanTmt(p.tmtKgbBerikutnya) === bulanTmt).length,
      })),
    };
  });

  return { satker, pegawaiTanpaSatker: aktif.filter((p) => kodePegawai.get(p.id) === KODE_SATKER_LAIN).length };
}
