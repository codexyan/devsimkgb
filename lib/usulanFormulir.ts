// Pembacaan isian formulir usulan dari FormData, dipakai bersama oleh rute penyimpanan draf,
// penyuntingan draf, dan pengiriman usulan. Ketiganya harus membaca dan menghitung dengan cara yang
// persis sama, sebab yang membedakan usulan siap kirim dari draf hanyalah statusnya.

import { BIDANG_USULAN, hitungUsulan, type KunciBidangUsulan } from "./usulanPegawai";
import { bacaTanggalInput } from "./prosesKgb";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";
import { isoTanggalLokal, tanggalKalender, type NilaiTanggal } from "./waktu";

/**
 * Kolom yang dihitung sistem dan karena itu tidak dibaca dari formulir. Gaji pokok dan jatuh tempo KGB
 * adalah turunan golongan, masa kerja golongan, dan TMT KGB terakhir; membiarkannya diketik berarti
 * membiarkan salah ketik menggeser uang.
 */
export const KOLOM_HITUNGAN: readonly KunciBidangUsulan[] = ["pangkat", "gajiPokok", "tmtKgbBerikutnya"];

/** Kolom yang benar-benar diisi operator pada formulir. */
export const BIDANG_DIISI = BIDANG_USULAN.filter((b) => !KOLOM_HITUNGAN.includes(b.kunci));

/**
 * Isian pegawai dari formulir. Isian kosong menjadi null: pada usulan perubahan itu berarti kolomnya
 * tidak diusulkan berubah. Angka nol tetap nilai yang sah, misalnya masa kerja golongan 0 tahun bagi
 * pegawai yang belum pernah KGB.
 */
export function bacaIsianUsulan(form: FormData): { isian: Partial<UsulanPegawaiRow> } | { galat: string } {
  return bacaIsian((kunci) => (form.get(kunci) as string | null)?.trim() || "");
}

/**
 * Isian pegawai dari satu baris berkas unggahan massal. Nama kolomnya sama dengan nama isian pada
 * formulir, sehingga berkas yang sama dapat dipakai UPT maupun Kanwil tanpa dua templat yang berbeda.
 */
export function bacaIsianBaris(baris: Record<string, unknown>): { isian: Partial<UsulanPegawaiRow> } | { galat: string } {
  return bacaIsian((kunci) => {
    const nilai = baris[kunci];
    if (nilai === null || nilai === undefined) return "";
    return String(nilai).trim();
  });
}

/** Inti pembacaan isian; sumbernya boleh formulir maupun satu baris berkas. */
function bacaIsian(teks: (kunci: string) => string): { isian: Partial<UsulanPegawaiRow> } | { galat: string } {
  const isian: Record<string, unknown> = {};

  for (const bidang of BIDANG_DIISI) {
    const mentah = teks(bidang.kunci);
    if (!mentah) {
      isian[bidang.kunci] = null;
      continue;
    }
    if (bidang.kunci === "nip") {
      // Excel gemar menyimpan NIP sebagai rumus teks ="..." agar angka depannya tidak hilang.
      const nip = mentah.replace(/^="(.*)"$/, "$1").trim();
      if (!/^\d{18}$/.test(nip)) return { galat: "NIP harus tepat 18 digit angka" };
      isian.nip = nip;
      continue;
    }
    if (bidang.jenis === "tanggal") {
      const tanggal = bacaTanggalInput(mentah);
      if (!tanggal) return { galat: `${bidang.label} tidak valid` };
      isian[bidang.kunci] = tanggal;
      continue;
    }
    if (bidang.jenis === "angka" || bidang.jenis === "rupiah") {
      const angka = Number(mentah.replace(/[^\d]/g, ""));
      if (!Number.isFinite(angka)) return { galat: `${bidang.label} harus berupa angka` };
      isian[bidang.kunci] = angka;
      continue;
    }
    isian[bidang.kunci] = mentah;
  }

  return { isian: isian as Partial<UsulanPegawaiRow> };
}

/**
 * Lengkapi isian dengan kolom hitungan. `dasar` adalah data pegawai yang sudah tercatat, dipakai pada
 * usulan perubahan ketika operator tidak mengusulkan golongan atau masa kerjanya berubah.
 */
export function isiHitungan(
  isian: Partial<UsulanPegawaiRow>,
  dasar?: Partial<PegawaiRow> | null,
): Partial<UsulanPegawaiRow> {
  const ambil = <K extends KunciBidangUsulan>(kunci: K) =>
    (isian[kunci] ?? dasar?.[kunci] ?? null) as UsulanPegawaiRow[K] | null;

  const hitung = hitungUsulan({
    golonganRuang: ambil("golonganRuang") as string | null,
    mkgTahun: ambil("mkgTahun") as number | null,
    mkgBulan: ambil("mkgBulan") as number | null,
    tmtKgbTerakhir: ambil("tmtKgbTerakhir") as Date | null,
  });

  return {
    ...isian,
    pangkat: hitung.pangkat || null,
    gajiPokok: hitung.gajiPokok || null,
    tmtKgbBerikutnya: hitung.tmtKgbBerikutnya,
  };
}

/**
 * Isi draf dalam bentuk yang langsung dapat dipasang ke isian formulir di peramban: semuanya teks,
 * dan tanggalnya dalam bentuk yyyy-mm-dd seperti yang diminta isian date.
 */
export function nilaiFormulir(usulan: Partial<UsulanPegawaiRow>): Record<string, string> {
  const hasil: Record<string, string> = {};
  for (const bidang of BIDANG_DIISI) {
    const nilai = usulan[bidang.kunci];
    if (nilai === null || nilai === undefined || nilai === "") continue;
    if (bidang.jenis === "tanggal") {
      const tanggal = tanggalKalender(nilai as NilaiTanggal);
      if (tanggal) hasil[bidang.kunci] = isoTanggalLokal(tanggal);
      continue;
    }
    hasil[bidang.kunci] = String(nilai);
  }
  return hasil;
}

/** Bentuk teks satu tanggal untuk isian date; string kosong bila tidak ada. */
export function tanggalIsian(nilai: unknown): string {
  const tanggal = tanggalKalender(nilai as NilaiTanggal);
  return tanggal ? isoTanggalLokal(tanggal) : "";
}
