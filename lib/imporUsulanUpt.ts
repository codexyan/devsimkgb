// Unggahan massal data pegawai oleh UPT.
//
// Mengisi satu satker berisi ratusan pegawai lewat formulir satu per satu tidak akan pernah terjadi,
// dan itulah yang menahan tujuh belas UPT tetap kosong. Modul ini membaca berkas berisi banyak baris
// menjadi banyak draf sekaligus; yang tersisa bagi operator hanyalah melengkapi yang kurang lalu
// mengirimkannya dengan satu surat.
//
// Berkasnya memakai nama kolom yang sama dengan templat impor Kanwil, sehingga satu berkas yang sama
// dapat diunggah UPT sendiri maupun diimpor Kanwil atas namanya, tanpa dua templat yang berbeda.
//
// Baris yang belum lengkap tetap diterima. Draf memang boleh belum lengkap, dan kelengkapannya baru
// ditagih saat diajukan; menolaknya di sini berarti memaksa operator menyempurnakan seluruh berkas di
// Excel lebih dulu, padahal dokumennya sering baru terkumpul belakangan.

import { BIDANG_DIISI, bacaIsianBaris } from "./usulanFormulir";
import { kekuranganUsulan } from "./usulanPegawai";
import { FORMAT_TANGGAL_DITERIMA, bacaTanggal } from "./dataPegawai";
import { ESELON, JENIS_JABATAN, JENIS_KELAMIN, PENDIDIKAN_TERAKHIR } from "./pilihanPegawai";
import type { UsulanPegawaiRow } from "./sheets/tables";

/** Kolom yang harus ada pada baris kepala berkas; isinya boleh kosong kecuali NIP dan nama. */
export const KOLOM_IMPOR_UPT = ["nip", "nama"] as const;

/**
 * "wajib": baris ditolak bila kosong. "diajukan": boleh kosong di draf, tetapi ditagih saat diajukan ke
 * Kanwil (kekuranganUsulan). "opsional": boleh kosong seterusnya.
 */
export type PeranKolomTemplat = "wajib" | "diajukan" | "opsional";

/**
 * Kolom templat unggahan UPT: yang dibaca bacaIsianBaris, tanpa kolom hitungan (pangkat, gaji pokok,
 * TMT KGB berikutnya) yang memang tidak dibaca dari berkas. Satu daftar ini menjadi berkas templat
 * yang diunduh sekaligus panduan kolom di layar, agar keduanya tidak pernah berbeda. Contohnya fiktif.
 */
export const KOLOM_TEMPLAT_UPT: readonly {
  kolom: string;
  peran: PeranKolomTemplat;
  keterangan: string;
  contoh: string;
}[] = [
  {
    kolom: "nip",
    peran: "wajib",
    keterangan:
      "18 digit angka. Di Excel, format kolom ini sebagai Text sebelum mengetik, atau tulis =\"199001012025061001\"; tanpa itu NIP berubah menjadi 1,99E+17 dan barisnya ditolak.",
    contoh: "199001012025061001",
  },
  { kolom: "nama", peran: "wajib", keterangan: "Nama lengkap sesuai SK pengangkatan.", contoh: "NAMA PEGAWAI CONTOH" },
  { kolom: "jabatan", peran: "diajukan", keterangan: "Nama jabatan.", contoh: "Penjaga Tahanan" },
  { kolom: "jenisJabatan", peran: "opsional", keterangan: `Salah satu: ${JENIS_JABATAN.join(" · ")}.`, contoh: JENIS_JABATAN[0] },
  { kolom: "eselon", peran: "opsional", keterangan: `Salah satu: ${ESELON.join(" · ")}.`, contoh: ESELON[0] },
  {
    kolom: "golonganRuang",
    peran: "diajukan",
    keterangan: "Golongan/ruang sekarang, ditulis seperti II/a atau III/b.",
    contoh: "II/a",
  },
  {
    kolom: "tmtGolongan",
    peran: "opsional",
    keterangan: "TMT golongan sekarang. Bagi CPNS sama dengan TMT CPNS.",
    contoh: "2025-06-01",
  },
  {
    kolom: "mkgTahun",
    peran: "opsional",
    keterangan: "Masa kerja golongan (tahun), disalin dari SK KGB terakhir. Isi 0 bila belum pernah KGB; kosong dibaca 0.",
    contoh: "0",
  },
  { kolom: "mkgBulan", peran: "opsional", keterangan: "Sisa bulan masa kerja golongan, 0 sampai 11.", contoh: "0" },
  {
    kolom: "tmtKgbTerakhir",
    peran: "diajukan",
    keterangan: "TMT pada SK KGB terakhir. Bila belum pernah KGB, isi TMT CPNS.",
    contoh: "2025-06-01",
  },
  { kolom: "tempatLahir", peran: "opsional", keterangan: "Kota atau kabupaten tempat lahir.", contoh: "Banjarmasin" },
  { kolom: "tanggalLahir", peran: "opsional", keterangan: "Tanggal lahir.", contoh: "1990-01-01" },
  { kolom: "jenisKelamin", peran: "opsional", keterangan: `Salah satu: ${JENIS_KELAMIN.join(" · ")}.`, contoh: JENIS_KELAMIN[0] },
  {
    kolom: "pendidikanTerakhir",
    peran: "opsional",
    keterangan: `Salah satu: ${PENDIDIKAN_TERAKHIR.join(" · ")}.`,
    contoh: "SMA/SMK",
  },
];

/**
 * Isi berkas templat: baris kepala dan satu baris contoh. Diawali BOM agar Excel membacanya sebagai
 * UTF-8; PapaParse membuang BOM itu saat berkasnya diunggah kembali.
 */
export function templatCsvUpt(): string {
  const sel = (nilai: string) => (/[",;\n]/.test(nilai) ? `"${nilai.replace(/"/g, '""')}"` : nilai);
  const baris = [KOLOM_TEMPLAT_UPT.map((k) => k.kolom), KOLOM_TEMPLAT_UPT.map((k) => k.contoh)];
  return "﻿" + baris.map((b) => b.map(sel).join(",")).join("\r\n") + "\r\n";
}

const KOLOM_TANGGAL = BIDANG_DIISI.filter((b) => b.jenis === "tanggal");

/**
 * Tanggal pada baris berkas diseragamkan ke yyyy-mm-dd. Excel berlokal Indonesia menyimpan ulang tanggal
 * sebagai dd/mm/yyyy, jadi berkas yang disunting di Excel harus tetap terbaca, sama seperti impor Kanwil.
 */
function seragamkanTanggal(row: Record<string, unknown>): { row: Record<string, unknown> } | { galat: string } {
  const hasil = { ...row };
  for (const bidang of KOLOM_TANGGAL) {
    const dibaca = bacaTanggal(teks(row, bidang.kunci));
    if (dibaca.status === "tidak_valid")
      return { galat: `${bidang.label} tidak valid ("${teks(row, bidang.kunci)}"). Gunakan format ${FORMAT_TANGGAL_DITERIMA}.` };
    if (dibaca.status === "valid") hasil[bidang.kunci] = dibaca.tanggal.toISOString().slice(0, 10);
  }
  return { row: hasil };
}

/**
 * Batas baris sekali unggah. Satker terbesar di Kalimantan Selatan masih di bawah angka ini, dan
 * batasnya menjaga satu permintaan tidak melampaui waktu jalan Worker.
 */
export const BATAS_BARIS_IMPOR = 500;

export interface HasilBarisImpor {
  /** Nomor baris pada berkas, tidak menghitung baris kepala; dipakai menunjuk baris yang salah. */
  baris: number;
  nip: string;
  nama: string;
  /** Sebab baris ini tidak dapat dipakai; null berarti sah. */
  galat: string | null;
  /** Yang masih kurang sebelum draf ini boleh diajukan; baris tetap diterima. */
  kurang: string[];
  isian: Partial<UsulanPegawaiRow> | null;
}

function teks(baris: Record<string, unknown>, kunci: string): string {
  const nilai = baris[kunci];
  if (nilai === null || nilai === undefined) return "";
  // Excel gemar menyimpan NIP sebagai rumus teks ="1990..." agar angka depannya tidak hilang.
  return String(nilai).replace(/^="(.*)"$/, "$1").trim();
}

/**
 * Periksa seluruh baris berkas. Tiap baris dinilai sendiri: satu baris yang salah tidak menggagalkan
 * yang lain, sebab berkas berisi ratusan nama hampir selalu punya satu dua baris bermasalah dan
 * menolak seluruhnya berarti operator mengulang dari awal tanpa tahu mana yang keliru.
 *
 * `nipPegawai` dan `nipUsulan` adalah NIP yang sudah dipakai di data induk dan di usulan yang belum
 * selesai; keduanya dibaca pemanggil agar modul ini tetap murni.
 */
export function periksaImporUpt(
  baris: readonly Record<string, unknown>[],
  konteks: { nipPegawai: ReadonlySet<string>; nipUsulan: ReadonlySet<string> },
): HasilBarisImpor[] {
  const terlihat = new Set<string>();

  return baris.map((row, i) => {
    const nip = teks(row, "nip");
    const nama = teks(row, "nama");
    const dasar = { baris: i + 1, nip, nama, isian: null, kurang: [] as string[] };

    if (!/^\d{18}$/.test(nip)) return { ...dasar, galat: "NIP harus tepat 18 digit angka" };
    if (!nama) return { ...dasar, galat: "Nama lengkap wajib diisi" };
    if (terlihat.has(nip)) return { ...dasar, galat: "NIP ini muncul lebih dari sekali pada berkas" };
    terlihat.add(nip);
    if (konteks.nipPegawai.has(nip)) return { ...dasar, galat: "NIP sudah tercatat sebagai pegawai" };
    if (konteks.nipUsulan.has(nip)) return { ...dasar, galat: "NIP sudah ada pada usulan yang belum selesai" };

    const seragam = seragamkanTanggal(row);
    if ("galat" in seragam) return { ...dasar, galat: seragam.galat };
    const dibaca = bacaIsianBaris(seragam.row);
    if ("galat" in dibaca) return { ...dasar, galat: dibaca.galat };

    return {
      ...dasar,
      galat: null,
      isian: dibaca.isian,
      kurang: kekuranganUsulan({ ...dibaca.isian, nip, nama }, "baru"),
    };
  });
}

/** Ringkasan hasil pemeriksaan, untuk kalimat yang dibaca operator sebelum menyimpan. */
export function ringkasImpor(hasil: readonly HasilBarisImpor[]): {
  sah: number;
  gagal: number;
  belumLengkap: number;
} {
  const sah = hasil.filter((h) => !h.galat);
  return {
    sah: sah.length,
    gagal: hasil.length - sah.length,
    belumLengkap: sah.filter((h) => h.kurang.length > 0).length,
  };
}
