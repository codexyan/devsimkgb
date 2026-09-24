// Mutasi dan pemberhentian pegawai: jenisnya, akibatnya pada data induk, dan pengaruhnya pada KGB.
//
// Sebelum ini perpindahan dicatat dengan mengubah Unit Kerja begitu saja, tanpa tanggal berlaku dan
// tanpa SK, sedangkan pegawai yang berhenti hanya bisa dihapus, yang justru membuang riwayat KGB-nya.
//
// Dua hal yang membuat modul ini perlu berhati-hati:
//
//  1. BKO berbeda dari mutasi definitif pada hal yang menentukan uang. Pegawai BKO bekerja di satker
//     lain, tetapi gajinya tetap dibayar satker asal, sehingga KGB, SK, dan KPPN tujuannya juga tetap
//     di satker asal. Karena itu BKO hanya mencatat satker tempat bertugas sebagai keterangan, dan
//     tidak pernah mengubah unit kerja yang dipakai perhitungan.
//  2. Pemberhentian punya tanggal berlaku. Pegawai yang pensiun 1 November 2026 tetap berhak KGB yang
//     TMT-nya 1 Oktober 2026. Jadi yang menentukan bukan "sudah berhenti atau belum", melainkan apakah
//     TMT KGB-nya jatuh sebelum tanggal berhenti.

import { tanggalKalender, type NilaiTanggal } from "./waktu";

export type JenisMutasi = "definitif" | "bko" | "selesai_bko" | "pemberhentian";

export const LABEL_JENIS_MUTASI: Record<JenisMutasi, string> = {
  definitif: "Mutasi definitif",
  bko: "Penugasan BKO",
  selesai_bko: "Selesai BKO, kembali ke satker asal",
  pemberhentian: "Pemberhentian",
};

/** Penjelasan singkat tiap jenis, ditampilkan pada formulir agar pilihannya tidak ditebak. */
export const KETERANGAN_JENIS_MUTASI: Record<JenisMutasi, string> = {
  definitif:
    "Pegawai pindah seluruhnya ke satker tujuan. Unit kerja, KGB berikutnya, dan KPPN tujuan SK ikut berpindah.",
  bko:
    "Pegawai bertugas di satker lain, tetapi gajinya tetap dibayar satker asal. KGB, SK, dan KPPN tetap di satker asal; satker tempat bertugas hanya dicatat sebagai keterangan.",
  selesai_bko: "Penugasan BKO berakhir; keterangan satker tempat bertugas dihapus.",
  pemberhentian:
    "Pegawai berhenti sebagai PNS pada satker ini. Datanya tetap tersimpan sebagai riwayat, dan KGB yang TMT-nya sebelum tanggal berhenti tetap sah diproses.",
};

/** Alasan pemberhentian yang lazim; "Lainnya" tetap mungkin lewat isian keterangan. */
export const ALASAN_PEMBERHENTIAN = [
  "Pensiun (batas usia pensiun)",
  "Pensiun dini atas permintaan sendiri",
  "Meninggal dunia",
  "Berhenti atas permintaan sendiri",
  "Pindah instansi",
  "Diberhentikan tidak dengan hormat",
] as const;

export interface IsianMutasi {
  jenis: JenisMutasi;
  /** Kode satker tujuan; wajib untuk mutasi definitif dan BKO. */
  satkerTujuan?: string | null;
  tmt?: NilaiTanggal;
  nomorSk?: string | null;
  tanggalSk?: NilaiTanggal;
  alasan?: string | null;
}

/**
 * Apa yang masih kurang sebelum pencatatan boleh disimpan. Daftar kosong berarti sah. Dipakai rute API
 * sebagai penentu, dan formulir sebagai penuntun, supaya keduanya tidak berbeda pendapat.
 */
export function kekuranganMutasi(isian: IsianMutasi): string[] {
  const kurang: string[] = [];
  if (!tanggalKalender(isian.tmt)) kurang.push("TMT berlaku");
  if ((isian.jenis === "definitif" || isian.jenis === "bko") && !String(isian.satkerTujuan ?? "").trim()) {
    kurang.push("satker tujuan");
  }
  if (isian.jenis === "pemberhentian" && !String(isian.alasan ?? "").trim()) kurang.push("alasan pemberhentian");
  if (!String(isian.nomorSk ?? "").trim()) kurang.push("nomor SK");
  return kurang;
}

/**
 * Perubahan yang diterapkan ke data pegawai. Sengaja sempit: mutasi definitif memindahkan unit kerja,
 * BKO hanya menulis satker tempat bertugas, dan pemberhentian mencatat tanggal berhentinya tanpa
 * menghapus apa pun.
 */
export function perubahanPegawaiMutasi(
  isian: IsianMutasi,
  namaSatkerTujuan: string | null,
): { unitKerja?: string; satkerTugas?: string | null; berhentiTmt?: Date | null; berhentiAlasan?: string | null } {
  const tmt = tanggalKalender(isian.tmt);
  switch (isian.jenis) {
    case "definitif":
      return namaSatkerTujuan ? { unitKerja: namaSatkerTujuan, satkerTugas: null } : {};
    case "bko":
      return { satkerTugas: namaSatkerTujuan };
    case "selesai_bko":
      return { satkerTugas: null };
    case "pemberhentian":
      return { berhentiTmt: tmt, berhentiAlasan: String(isian.alasan ?? "").trim() || null };
  }
}

/**
 * true bila pegawai masih berhak atas KGB dengan TMT tertentu. Pemberhentian tidak membatalkan KGB
 * yang TMT-nya jatuh sebelum tanggal berhenti: haknya sudah timbul sebelum ia berhenti.
 */
export function berhakKgb(
  pegawai: { berhentiTmt?: NilaiTanggal },
  tmtKgb: NilaiTanggal,
): boolean {
  const berhenti = tanggalKalender(pegawai.berhentiTmt);
  if (!berhenti) return true;
  const tmt = tanggalKalender(tmtKgb);
  if (!tmt) return false;
  return tmt < berhenti;
}

/**
 * true bila pegawai sudah berhenti pada tanggal tertentu. Dipakai daftar dan rekap untuk menandainya,
 * bukan untuk menyembunyikannya: riwayatnya tetap perlu terbaca.
 */
export function sudahBerhenti(pegawai: { berhentiTmt?: NilaiTanggal }, hariIni: Date): boolean {
  const berhenti = tanggalKalender(pegawai.berhentiTmt);
  return !!berhenti && berhenti <= hariIni;
}

/** Ringkasan satu baris untuk ditampilkan pada daftar pegawai; null bila tidak ada yang perlu disebut. */
export function ringkasKeadaanPegawai(
  pegawai: { berhentiTmt?: NilaiTanggal; berhentiAlasan?: string | null; satkerTugas?: string | null },
  hariIni: Date,
): { teks: string; nada: "merah" | "kuning" } | null {
  const berhenti = tanggalKalender(pegawai.berhentiTmt);
  if (berhenti) {
    const sudah = berhenti <= hariIni;
    const alasan = pegawai.berhentiAlasan?.trim();
    return {
      teks: `${sudah ? "Berhenti" : "Akan berhenti"}${alasan ? ` (${alasan})` : ""}`,
      nada: sudah ? "merah" : "kuning",
    };
  }
  if (pegawai.satkerTugas?.trim()) return { teks: `BKO di ${pegawai.satkerTugas.trim()}`, nada: "kuning" };
  return null;
}
