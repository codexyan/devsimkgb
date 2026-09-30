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
import { bandingkanUsulan, kekuranganUsulan, type PerubahanUsulan } from "./usulanPegawai";
import { FORMAT_TANGGAL_DITERIMA, bacaTanggal } from "./dataPegawai";
import { ESELON, JENIS_JABATAN, JENIS_KELAMIN, PENDIDIKAN_TERAKHIR } from "./pilihanPegawai";
import { periksaNip } from "./nipPns";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

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
      "18 digit angka, susunannya tanggal lahir + TMT CPNS + jenis kelamin + nomor urut. Di Excel, setel kolom ini sebagai Text sebelum mengetik, atau tulis =\"199001012025061001\"; tanpa itu NIP berubah menjadi 1,99E+17 dan barisnya ditolak.",
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

/**
 * Hasil penilaian satu baris berkas.
 *
 * - "baru"      : NIP belum tercatat; barisnya menjadi draf usulan pegawai baru.
 * - "perubahan" : NIP sudah tercatat di satker ini dan ada kolom yang berbeda; barisnya menjadi draf
 *                 usulan perbaikan data atas pegawai itu.
 * - "sama"      : NIP sudah tercatat dan tidak ada satu kolom pun yang berbeda; tidak ada yang perlu
 *                 diusulkan, jadi barisnya dilewati. Ini keadaan yang paling sering terjadi ketika UPT
 *                 mengunggah daftar pegawainya secara utuh berulang kali.
 * - "ditolak"   : barisnya tidak dapat dipakai; sebabnya di `galat`.
 */
export type HasilImpor = "baru" | "perubahan" | "sama" | "ditolak";

export interface HasilBarisImpor {
  /** Nomor baris pada berkas, tidak menghitung baris kepala; dipakai menunjuk baris yang salah. */
  baris: number;
  nip: string;
  nama: string;
  hasil: HasilImpor;
  /** Sebab baris ini tidak dapat dipakai; hanya terisi bila `hasil` === "ditolak". */
  galat: string | null;
  /** Yang masih kurang sebelum draf ini boleh diajukan; baris tetap diterima. */
  kurang: string[];
  isian: Partial<UsulanPegawaiRow> | null;
  /** Pegawai yang NIP-nya cocok; terisi untuk "perubahan" dan "sama". */
  pegawaiId: string | null;
  /** Nama yang tercatat pada data induk, supaya operator tahu baris ini mengubah siapa. */
  namaTercatat: string | null;
  /** Kolom yang berbeda dari data tercatat, lama berdampingan dengan baru; hanya untuk "perubahan". */
  beda: PerubahanUsulan[];
}

function teks(baris: Record<string, unknown>, kunci: string): string {
  const nilai = baris[kunci];
  if (nilai === null || nilai === undefined) return "";
  // Excel gemar menyimpan NIP sebagai rumus teks ="1990..." agar angka depannya tidak hilang.
  return String(nilai).replace(/^="(.*)"$/, "$1").trim();
}

/**
 * Yang sudah ada di basis data, dibaca pemanggil agar modul ini tetap murni dan dapat diuji tanpa
 * lapisan data.
 */
export interface KonteksImpor {
  /** Pegawai satker ini, dikunci NIP. Baris yang cocok menjadi usulan perbaikan, bukan ditolak. */
  pegawaiSatker: ReadonlyMap<string, PegawaiRow>;
  /**
   * NIP yang tercatat di satker lain, dipetakan ke nama satker itu. UPT tidak boleh mengusulkan
   * perbaikan atas pegawai satker lain, jadi barisnya ditolak; menyebut satkernya membuat operator
   * tahu harus menghubungi siapa, alih-alih mengira NIP-nya salah ketik.
   */
  satkerLain: ReadonlyMap<string, string>;
  /** NIP pada usulan pegawai baru yang belum selesai. */
  nipUsulan: ReadonlySet<string>;
  /**
   * Pegawai yang sedang punya usulan belum selesai. Diperiksa terpisah dari `nipUsulan` karena usulan
   * perbaikan menyimpan pegawaiId dan mengosongkan NIP, sehingga tidak terjaring pemeriksaan NIP.
   */
  pegawaiIdUsulan: ReadonlySet<string>;
}

/**
 * Periksa seluruh baris berkas. Tiap baris dinilai sendiri: satu baris yang salah tidak menggagalkan
 * yang lain, sebab berkas berisi ratusan nama hampir selalu punya satu dua baris bermasalah dan
 * menolak seluruhnya berarti operator mengulang dari awal tanpa tahu mana yang keliru.
 *
 * NIP yang sudah tercatat tidak lagi ditolak. Dulu barisnya dibuang dengan alasan "NIP sudah tercatat
 * sebagai pegawai", padahal justru itu keadaan yang paling lazim: UPT mengunggah daftar pegawainya
 * secara utuh, dan yang sudah tercatat terhitung gagal semua. Sekarang barisnya dibandingkan dengan
 * data induk, dan hanya yang benar-benar berbeda yang menjadi usulan perbaikan.
 */
export function periksaImporUpt(
  baris: readonly Record<string, unknown>[],
  konteks: KonteksImpor,
): HasilBarisImpor[] {
  const terlihat = new Set<string>();

  return baris.map((row, i) => {
    const nip = teks(row, "nip");
    const nama = teks(row, "nama");
    const dasar = {
      baris: i + 1,
      nip,
      nama,
      isian: null,
      kurang: [] as string[],
      pegawaiId: null,
      namaTercatat: null,
      beda: [] as PerubahanUsulan[],
    };
    const tolak = (galat: string): HasilBarisImpor => ({ ...dasar, hasil: "ditolak", galat });

    // Susunan NIP diperiksa, bukan hanya panjangnya. NIP yang dirusak Excel tetap 18 digit
    // (197112000000000000), jadi pemeriksaan panjang saja meloloskannya sebagai pegawai baru ber-NIP
    // palsu — kejadian nyata 30 September 2026. Lihat lib/nipPns.ts.
    const periksa = periksaNip(nip);
    if (!periksa.ok) return tolak(periksa.galat.pesan);
    if (!nama) return tolak("Nama lengkap wajib diisi");
    if (terlihat.has(nip)) return tolak("NIP ini muncul lebih dari sekali pada berkas");
    terlihat.add(nip);

    const satkerLain = konteks.satkerLain.get(nip);
    if (satkerLain) return tolak(`NIP ini tercatat di ${satkerLain}. Mintakan pemindahannya lewat Kanwil.`);

    const tercatat = konteks.pegawaiSatker.get(nip) ?? null;
    if (tercatat && konteks.pegawaiIdUsulan.has(tercatat.id))
      return tolak("Pegawai ini sedang punya usulan yang belum selesai di Kanwil");
    if (!tercatat && konteks.nipUsulan.has(nip))
      return tolak("NIP ini sudah ada pada usulan pegawai baru yang belum selesai");

    const seragam = seragamkanTanggal(row);
    if ("galat" in seragam) return tolak(seragam.galat);
    const dibaca = bacaIsianBaris(seragam.row);
    if ("galat" in dibaca) return tolak(dibaca.galat);

    if (!tercatat) {
      return {
        ...dasar,
        hasil: "baru",
        galat: null,
        isian: dibaca.isian,
        kurang: kekuranganUsulan({ ...dibaca.isian, nip, nama }, "baru"),
      };
    }

    // Nama pada berkas ikut dibandingkan lewat isian, sehingga pembetulan ejaan nama pun terbaca sebagai
    // perubahan. NIP-nya sudah pasti sama, sebab pencocokannya memakai NIP.
    const beda = bandingkanUsulan(tercatat, { ...dibaca.isian, nama });
    if (beda.length === 0)
      return { ...dasar, hasil: "sama", galat: null, pegawaiId: tercatat.id, namaTercatat: tercatat.nama };

    return {
      ...dasar,
      hasil: "perubahan",
      galat: null,
      isian: { ...dibaca.isian, nama },
      pegawaiId: tercatat.id,
      namaTercatat: tercatat.nama,
      beda,
      kurang: kekuranganUsulan({ ...dibaca.isian, nama }, "perubahan", tercatat),
    };
  });
}

/** Ringkasan hasil pemeriksaan, untuk kalimat yang dibaca operator sebelum menyimpan. */
export function ringkasImpor(hasil: readonly HasilBarisImpor[]): {
  baru: number;
  perubahan: number;
  sama: number;
  ditolak: number;
  /** Baris yang akan tersimpan namun masih perlu dilengkapi sebelum boleh diajukan. */
  belumLengkap: number;
} {
  const hitung = (h: HasilImpor) => hasil.filter((x) => x.hasil === h).length;
  return {
    baru: hitung("baru"),
    perubahan: hitung("perubahan"),
    sama: hitung("sama"),
    ditolak: hitung("ditolak"),
    belumLengkap: hasil.filter((h) => (h.hasil === "baru" || h.hasil === "perubahan") && h.kurang.length > 0).length,
  };
}

/** Baris yang benar-benar tersimpan bila disetujui operator. */
export function dapatDisimpan(hasil: readonly HasilBarisImpor[]): HasilBarisImpor[] {
  return hasil.filter((h) => h.hasil === "baru" || h.hasil === "perubahan");
}
