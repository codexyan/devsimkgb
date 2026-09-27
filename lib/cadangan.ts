// Cadangan data bulanan wajib (ADR-018).
//
// SIM-KGB masih disempurnakan, jadi setiap akun wajib menyimpan salinan data yang boleh dilihatnya ke
// perangkat yang dipakainya, paling tidak sebulan sekali. Bila terjadi kekeliruan data atau gangguan
// layanan, satker dan Kanwil masih memegang salinan terakhirnya sendiri.
//
// Modul ini menentukan kapan cadangan jatuh tempo, data apa yang masuk cadangan tiap peran, dan cara
// menuliskannya sebagai CSV. Murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

import { ROLES } from "./auth/roles";

/** Cadangan wajib diunduh paling lambat sekian hari sejak cadangan terakhir. */
export const BATAS_HARI_CADANGAN = 30;
/** Pengingat mulai muncul sekian hari sejak cadangan terakhir. */
export const MULAI_INGAT_HARI = 25;
/** Akun yang belum pernah mencadangkan dihitung sejak fitur ini berlaku, bukan sejak akunnya dibuat. */
export const CADANGAN_BERLAKU = new Date("2026-09-27T00:00:00+08:00");
/** Penundaan sekali per jatuh tempo, agar pekerjaan yang sedang mendesak tidak terputus. */
export const TUNDA_JAM = 24;

const SEHARI = 24 * 60 * 60 * 1000;

export type KeadaanCadangan = "aman" | "ingat" | "wajib";

export interface StatusCadangan {
  keadaan: KeadaanCadangan;
  /** Hari sejak cadangan terakhir (atau sejak fitur berlaku bila belum pernah). */
  hariSejak: number;
  /** Batas cadangan berikutnya. */
  jatuhTempo: Date;
  terakhir: Date | null;
}

const waktu = (t: Date | string | null | undefined): Date | null => {
  if (!t) return null;
  const d = t instanceof Date ? t : new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Keadaan cadangan satu akun. `terakhir` diambil yang paling baru dari catatan server dan catatan
 * peramban, supaya cadangan yang gagal dicatat server (mis. kolomnya belum dimigrasikan) tidak
 * membuat pengingat terus menagih.
 */
export function statusCadangan(
  terakhir: Date | string | null | undefined,
  dibuat: Date | string | null | undefined,
  sekarang: Date,
): StatusCadangan {
  const akhir = waktu(terakhir);
  const buat = waktu(dibuat);
  const dasar = akhir ?? (buat && buat > CADANGAN_BERLAKU ? buat : CADANGAN_BERLAKU);
  const hariSejak = Math.max(0, Math.floor((sekarang.getTime() - dasar.getTime()) / SEHARI));
  const jatuhTempo = new Date(dasar.getTime() + BATAS_HARI_CADANGAN * SEHARI);
  const keadaan: KeadaanCadangan =
    hariSejak >= BATAS_HARI_CADANGAN ? "wajib" : hariSejak >= MULAI_INGAT_HARI ? "ingat" : "aman";
  return { keadaan, hariSejak, jatuhTempo, terakhir: akhir };
}

/** Yang lebih baru dari dua catatan waktu; kosong bila keduanya kosong. */
export function terbaru(a: Date | string | null | undefined, b: Date | string | null | undefined): Date | null {
  const x = waktu(a);
  const y = waktu(b);
  if (!x) return y;
  if (!y) return x;
  return x > y ? x : y;
}

/* ── Isi cadangan per peran ─────────────────────────────────────────────────────────────────── */

export type JenisCadangan =
  | "pegawai"
  | "riwayat_kgb"
  | "surat_kgb"
  | "riwayat_pangkat"
  | "riwayat_mutasi"
  | "laporan_mutasi"
  | "usulan_pegawai"
  | "riwayat_hukdis"
  | "laporan_hukdis"
  | "pengguna";

export const LABEL_JENIS_CADANGAN: Record<JenisCadangan, string> = {
  pegawai: "Data pegawai",
  riwayat_kgb: "Riwayat KGB",
  surat_kgb: "Surat keputusan KGB",
  riwayat_pangkat: "Riwayat kenaikan pangkat",
  riwayat_mutasi: "Riwayat mutasi dan pemberhentian",
  laporan_mutasi: "Laporan mutasi dari UPT",
  usulan_pegawai: "Usulan data dari UPT",
  riwayat_hukdis: "Hukuman disiplin",
  laporan_hukdis: "Laporan hukuman disiplin dari UPT",
  pengguna: "Akun pengguna (tanpa sandi)",
};

/**
 * Data yang masuk cadangan tiap peran, sama dengan yang boleh dilihatnya di SIM-KGB. Server yang
 * menyaringnya (lib/cadanganServer.ts); daftar ini juga dipakai halaman cadangan untuk menjelaskan isinya.
 * Admin UPT: hanya satkernya, dan hukdis hanya sebatas yang boleh dilihat UPT (ADR-016).
 * Keuangan: pegawai dan KGB yang ditindaklanjuti keuangan Kanwil (ADR-009).
 */
export const CAKUPAN_PERAN: Record<string, readonly JenisCadangan[]> = {
  [ROLES.SUPER_ADMIN]: [
    "pegawai", "riwayat_kgb", "surat_kgb", "riwayat_pangkat", "riwayat_mutasi", "laporan_mutasi",
    "usulan_pegawai", "riwayat_hukdis", "laporan_hukdis", "pengguna",
  ],
  [ROLES.SDM_KGB]: [
    "pegawai", "riwayat_kgb", "surat_kgb", "riwayat_pangkat", "riwayat_mutasi", "laporan_mutasi", "usulan_pegawai",
  ],
  [ROLES.SDM_HUKDIS]: ["pegawai", "riwayat_hukdis", "laporan_hukdis"],
  [ROLES.KEUANGAN]: ["pegawai", "riwayat_kgb", "surat_kgb"],
  [ROLES.ADMIN_UPT]: [
    "pegawai", "riwayat_kgb", "surat_kgb", "usulan_pegawai", "laporan_mutasi", "riwayat_hukdis", "laporan_hukdis",
  ],
};

export function cakupanPeran(role: string): readonly JenisCadangan[] {
  return CAKUPAN_PERAN[role] ?? [];
}

/** Peran yang cadangannya menyertakan PDF SK KGB yang sudah terbit. SDM Hukdis tidak memegang SK KGB. */
export function denganPdfSk(role: string): boolean {
  return cakupanPeran(role).includes("surat_kgb");
}

/* ── CSV ─────────────────────────────────────────────────────────────────────────────────────── */

type Sel = string | number | boolean | Date | null | undefined;

function selCsv(nilai: Sel): string {
  if (nilai === null || nilai === undefined) return "";
  let s: string;
  if (nilai instanceof Date) s = Number.isNaN(nilai.getTime()) ? "" : nilai.toISOString();
  else s = String(nilai);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Kolom yang berisi NIP ditulis sebagai teks Excel, agar 18 digitnya tidak berubah menjadi notasi ilmiah. */
const KOLOM_NIP = /^nip/i;

/**
 * Baris data menjadi CSV. Diawali BOM agar Excel membaca UTF-8 dengan benar; kolom mengikuti urutan
 * kunci baris pertama ditambah kunci baru dari baris berikutnya.
 */
export function keCsv(baris: readonly Record<string, Sel>[]): string {
  const kolom: string[] = [];
  for (const b of baris) for (const k of Object.keys(b)) if (!kolom.includes(k)) kolom.push(k);
  const isi = baris.map((b) =>
    kolom
      .map((k) => {
        const v = b[k];
        return KOLOM_NIP.test(k) && typeof v === "string" && /^\d{10,}$/.test(v) ? `="${v}"` : selCsv(v);
      })
      .join(","),
  );
  return "﻿" + [kolom.join(","), ...isi].join("\r\n");
}

/** Nama berkas cadangan: peran, NIP akun, dan tanggalnya, agar cadangan bulan-bulan berbeda tidak tertukar. */
export function namaBerkasCadangan(role: string, nip: string, tanggal: Date): string {
  const t = `${tanggal.getFullYear()}-${String(tanggal.getMonth() + 1).padStart(2, "0")}-${String(tanggal.getDate()).padStart(2, "0")}`;
  return `cadangan-simkgb_${role}_${nip}_${t}.zip`;
}
