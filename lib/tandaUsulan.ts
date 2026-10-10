// Tanda pada usulan UPT yang menunggu tinjauan, untuk Setujui yang dicentang (ADR-099).
//
// Usulan tanpa tanda tercentang sejak awal: peninjau cukup memeriksa sampel dan yang bertanda, lalu menyetujui semua yang
// dicentang sekali tekan. Usulan bertanda tidak ikut tercentang sampai peninjau mencentangnya sendiri, dan usulan yang
// pasti ditolak server tidak dapat dicentang sama sekali. Isi berkas (pindaian SK) tetap tidak dapat diperiksa mesin;
// tanda hanya menunjuk yang janggal menurut data.
//
// Murni: tanpa React dan tanpa jaringan, agar dapat diuji, dan dipakai halaman Usulan UPT maupun ringkasan dasbor.

import type { KeadaanSkDilaporkan } from "./dasarSkUsulan";

/** Kolom yang menggeser hitungan KGB; ditandai agar peninjau tahu dampaknya pada uang. */
export const KOLOM_DASAR_GAJI = new Set(["golonganRuang", "mkgTahun", "mkgBulan", "tmtKgbTerakhir", "tmtKgbBerikutnya", "gajiPokok"]);

/** Medan GET /api/usulan yang dibaca tanda. */
export interface UsulanBertanda {
  status: string;
  nipTercatat?: { satkerSama: boolean } | null;
  hukdis: string | null;
  keadaanSk?: KeadaanSkDilaporkan | null;
  kgb?: { status: string; skDibuat: boolean } | null;
  perubahan: { kunci: string }[];
}

export interface TandaUsulan {
  kode: string;
  teks: string;
  /** Penjelasan singkat untuk title tanda. */
  ket: string;
  nada: "merah" | "kuning" | "ungu";
  /** Server menolak persetujuannya; tidak dapat dicentang. */
  blokir: boolean;
}

export function tandaUsulan(u: UsulanBertanda): TandaUsulan[] {
  const tanda: TandaUsulan[] = [];
  if (u.nipTercatat && !u.nipTercatat.satkerSama)
    tanda.push({
      kode: "nip_satker_lain",
      teks: "NIP di satker lain",
      ket: "NIP ini sudah tercatat di satker lain; usulan pegawai baru ini tidak dapat disetujui.",
      nada: "merah",
      blokir: true,
    });
  else if (u.nipTercatat)
    tanda.push({
      kode: "nip_tercatat",
      teks: "NIP sudah tercatat",
      ket: "Diajukan sebagai pegawai baru, diterapkan sebagai perbaikan data pegawai yang sudah tercatat (ADR-091).",
      nada: "kuning",
      blokir: false,
    });

  const menyentuhGaji = u.perubahan.some((p) => KOLOM_DASAR_GAJI.has(p.kunci));
  if (u.kgb?.status === "menunggu_keuangan" && menyentuhGaji)
    tanda.push({
      kode: "sk_sudah_diunggah",
      teks: "SK KGB sudah diunggah",
      ket: "SK KGB-nya sudah ditandatangani dan diunggah; usulan yang mengubah dasar gaji tidak dapat disetujui lagi.",
      nada: "merah",
      blokir: true,
    });
  else if (u.kgb?.status === "sedang_diproses" && u.kgb.skDibuat)
    tanda.push({
      kode: "sk_dibuat_ulang",
      teks: "SK dibuat ulang",
      ket: "KGB-nya sudah dibuat SK; persetujuan melepas SK itu agar dibuat ulang.",
      nada: "ungu",
      blokir: false,
    });
  else if (u.kgb?.status === "sedang_diproses" && menyentuhGaji)
    tanda.push({
      kode: "kgb_dihitung_ulang",
      teks: "KGB dihitung ulang",
      ket: "KGB-nya sedang diproses; persetujuan menghitung ulang dari dasar gaji yang baru.",
      nada: "ungu",
      blokir: false,
    });

  if (u.hukdis)
    tanda.push({
      kode: "hukdis",
      teks: "Laporan hukdis",
      ket: "Persetujuan tidak mencatat hukumannya; catat di modul Hukuman Disiplin.",
      nada: "merah",
      blokir: false,
    });
  if (u.keadaanSk === "beda")
    tanda.push({
      kode: "mkg_beda",
      teks: "Masa kerja SK beda",
      ket: "Masa kerja golongan menurut SK kenaikan pangkat berbeda dengan hitungan sistem.",
      nada: "kuning",
      blokir: false,
    });
  else if (u.keadaanSk === "belum_dicocokkan")
    tanda.push({
      kode: "mkg_belum_dicocokkan",
      teks: "Masa kerja SK kosong",
      ket: "Masa kerja golongan menurut SK kenaikan pangkat tidak diisi UPT, jadi belum dicocokkan.",
      nada: "kuning",
      blokir: false,
    });
  else if (u.keadaanSk === "belum_dihitung")
    tanda.push({
      kode: "sk_belum_dihitung",
      teks: "SK belum terhitung",
      ket: "SK sesudah SK KGB terakhir belum dapat dihitung dari isian UPT.",
      nada: "kuning",
      blokir: false,
    });
  return tanda;
}

/** Ikut tercentang sejak awal: masih menunggu dan tanpa tanda apa pun. */
export function dicentangAwal(u: UsulanBertanda): boolean {
  return u.status === "menunggu" && tandaUsulan(u).length === 0;
}

/** Dapat dicentang: masih menunggu dan tidak pasti ditolak server. */
export function bolehDicentang(u: UsulanBertanda): boolean {
  return u.status === "menunggu" && !tandaUsulan(u).some((t) => t.blokir);
}
