// Pembacaan isian formulir usulan dari FormData, dipakai bersama oleh rute penyimpanan draf,
// penyuntingan draf, dan pengiriman usulan. Ketiganya harus membaca dan menghitung dengan cara yang
// persis sama, sebab yang membedakan usulan siap kirim dari draf hanyalah statusnya.

import { BIDANG_USULAN, hitungUsulan, perubahanPegawai, type KunciBidangUsulan } from "./usulanPegawai";
import { bacaTanggalInput } from "./prosesKgb";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";
import { isoTanggalLokal, tanggalKalender, type NilaiTanggal } from "./waktu";
import { TANPA_SK_BARU, isJenisDasarBaru } from "./dasarBaruUsulan";
import { hitungSkPegawaiBaru, rencanaSkUsulan } from "./dasarSkUsulan";
import { getPangkat, isGolonganDikenal } from "./tabelGaji";

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

/** Keenam kolom SK baru selalu ditulis sekaligus, supaya baris usulan tidak pernah setengah terisi. */
export type DasarBaruUsulan = Pick<
  UsulanPegawaiRow,
  "dasarBaruJenis" | "dasarBaruJenisKp" | "dasarBaruNomorSk" | "dasarBaruTanggalSk" | "dasarBaruTmt" | "dasarBaruPenetap"
>;

const KOSONG_DASAR_BARU: DasarBaruUsulan = {
  dasarBaruJenis: null,
  dasarBaruJenisKp: null,
  dasarBaruNomorSk: null,
  dasarBaruTanggalSk: null,
  dasarBaruTmt: null,
  dasarBaruPenetap: null,
};

/**
 * Isian SK baru yang menetapkan gaji pokok (ADR-030); kolomnya di luar BIDANG_USULAN karena bukan kolom data
 * pegawai, melainkan keterangan sebab perubahannya. Pilihan yang tidak dikenal diperlakukan sebagai kosong,
 * dan pemeriksaan kelengkapannya di lib/dasarBaruUsulan.ts.
 */
export function bacaDasarBaru(teks: (kunci: string) => string): DasarBaruUsulan {
  const jenis = teks("dasarBaruJenis");
  // Jawaban "tidak ada SK" disimpan supaya pertanyaannya tidak ditagih lagi (ADR-065).
  if (jenis === TANPA_SK_BARU) return { ...KOSONG_DASAR_BARU, dasarBaruJenis: TANPA_SK_BARU };
  if (!isJenisDasarBaru(jenis)) return { ...KOSONG_DASAR_BARU };
  // Koreksi salah ketik tidak membawa SK, jadi kolom SK-nya sengaja dikosongkan.
  if (jenis === "koreksi") return { ...KOSONG_DASAR_BARU, dasarBaruJenis: jenis };
  return {
    dasarBaruJenis: jenis,
    dasarBaruJenisKp: jenis === "kp" ? teks("dasarBaruJenisKp") || null : null,
    dasarBaruNomorSk: teks("dasarBaruNomorSk") || null,
    dasarBaruTanggalSk: tanggalKalender(teks("dasarBaruTanggalSk")),
    dasarBaruTmt: tanggalKalender(teks("dasarBaruTmt")),
    dasarBaruPenetap: teks("dasarBaruPenetap") || null,
  };
}

/** Golongan dan masa kerja golongan pada SK acuan (ADR-078); ditulis sekaligus seperti kolom SK baru. */
export type AcuanUsulan = Pick<UsulanPegawaiRow, "golonganAcuan" | "mkgTahunAcuan" | "mkgBulanAcuan">;

export const KOSONG_ACUAN: AcuanUsulan = { golonganAcuan: null, mkgTahunAcuan: null, mkgBulanAcuan: null };

/**
 * Keadaan pada SK KGB terakhir (atau SK CPNS) yang ditulis formulir bersama SK kenaikan pangkat atau PMK sesudahnya
 * (ADR-078). Hanya berlaku bila SK itu memang dilaporkan; jawaban lain mengosongkannya, sehingga golongan dan masa kerja
 * pada kolom utama kembali bermakna keadaan pada SK acuan.
 */
export function bacaAcuan(teks: (kunci: string) => string, dasarBaru: Pick<DasarBaruUsulan, "dasarBaruJenis">): AcuanUsulan {
  const jenis = dasarBaru.dasarBaruJenis;
  const golongan = teks("golonganAcuan");
  if ((jenis !== "kp" && jenis !== "pmk") || !golongan) return { ...KOSONG_ACUAN };
  // Masa kerja yang belum diisi dibiarkan kosong, bukan nol: draf boleh setengah jadi, dan kekurangannya ditagih saat
  // diajukan (lib/dasarSkUsulan.ts hitungSkPegawaiBaru).
  const angka = (kunci: string) => {
    const isi = teks(kunci).replace(/[^\d]/g, "");
    return isi ? Number(isi) : null;
  };
  const mkgTahunAcuan = angka("mkgTahunAcuan");
  return { golonganAcuan: golongan, mkgTahunAcuan, mkgBulanAcuan: angka("mkgBulanAcuan") ?? (mkgTahunAcuan === null ? null : 0) };
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
 *
 * `dasarBaru`: SK sesudah SK KGB terakhir. Pada pegawai baru, golongan dan masa kerjanya disalin dari SK itu, jadi
 * gaji pokok dan jadwalnya dihitung dari masa kerja pada TMT KGB terakhir (lib/dasarSkUsulan.ts, ADR-065).
 */
export function isiHitungan(
  isian: Partial<UsulanPegawaiRow>,
  dasar?: Partial<PegawaiRow> | null,
  dasarBaru?: Partial<DasarBaruUsulan & AcuanUsulan> | null,
): Partial<UsulanPegawaiRow> {
  if (!dasar && dasarBaru) {
    const sk = hitungSkPegawaiBaru({ ...isian, ...dasarBaru });
    if (sk.berlaku && sk.ok)
      return { ...isian, pangkat: sk.nilai.pangkat || null, gajiPokok: sk.nilai.gajiPokok || null, tmtKgbBerikutnya: sk.nilai.tmtKgbBerikutnya };
  }
  // Pegawai tercatat yang melaporkan SK kenaikan pangkat atau PMK: hitungan yang sama dengan persetujuan Kanwil, bukan
  // golongan baru dengan masa kerja yang tertulis di SK (ADR-078).
  if (dasar && dasarBaru && isGolonganDikenal(String(dasar.golonganRuang ?? ""))) {
    // Draf boleh belum mencantumkan tanggal SK; hitungannya cukup dengan TMT-nya. Dasarnya data tercatat, atau keadaan
    // sebelum SK yang dibetulkan UPT (ADR-079).
    const rencana = rencanaSkUsulan(
      dasar as PegawaiRow,
      { ...isian, ...dasarBaru, dasarBaruTanggalSk: dasarBaru.dasarBaruTanggalSk ?? dasarBaru.dasarBaruTmt },
      perubahanPegawai(isian),
      null,
    );
    if (rencana.jenis === "hitung") {
      const nilai = rencana.sk.nilai;
      return {
        ...isian,
        pangkat: (nilai.pangkat as string | undefined) || getPangkat(String(nilai.golonganRuang ?? "")) || null,
        gajiPokok: nilai.gajiPokok || null,
        tmtKgbBerikutnya: (nilai.tmtKgbBerikutnya as Date | null) ?? rencana.dasar.tmtKgbBerikutnya ?? null,
      };
    }
  }
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
