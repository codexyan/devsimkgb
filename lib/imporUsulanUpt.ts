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

import { bacaIsianBaris } from "./usulanFormulir";
import { kekuranganUsulan } from "./usulanPegawai";
import type { UsulanPegawaiRow } from "./sheets/tables";

/** Kolom yang harus ada pada baris kepala berkas; isinya boleh kosong kecuali NIP dan nama. */
export const KOLOM_IMPOR_UPT = ["nip", "nama"] as const;

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

    const dibaca = bacaIsianBaris(row);
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
