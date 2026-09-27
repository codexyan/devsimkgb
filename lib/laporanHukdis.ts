// Laporan hukuman disiplin dari UPT (ADR-016).
//
// UPT memegang SK hukuman disiplin pegawainya, tetapi yang mencatatnya ke riwayat hukdis dan menggeser
// jadwal KGB tetap SDM Hukdis Kanwil. Dulu laporannya menumpang pada usulan data dan sampai di meja Tim
// SDM KGB, yang tidak berwenang mencatat hukdis. Modul ini memberinya jalur sendiri ke peninjau yang tepat.
//
// Daur hidupnya meniru laporan mutasi (lib/laporanMutasi.ts): menunggu, lalu diterima (tercatat) atau
// dikembalikan dengan catatan. Laporan yang dikembalikan dibetulkan dengan mengirim ulang, bukan disunting.
//
// Murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

import { tanggalKalender, type NilaiTanggal } from "./waktu";

export type StatusLaporanHukdis = "menunggu" | "diterima" | "dikembalikan";

export const STATUS_LAPORAN_HUKDIS: Record<
  StatusLaporanHukdis,
  { label: string; nada: "kuning" | "hijau" | "ungu" }
> = {
  menunggu: { label: "Menunggu tinjauan", nada: "kuning" },
  diterima: { label: "Sudah dicatat Kanwil", nada: "hijau" },
  dikembalikan: { label: "Dikembalikan untuk diperbaiki", nada: "ungu" },
};

/** Status yang masih dipegang UPT dan karena itu boleh dibatalkan atau dikirim ulang sendiri. */
export const LAPORAN_HUKDIS_DIPEGANG_UPT: readonly string[] = ["menunggu", "dikembalikan"];

/**
 * Satu pegawai hanya boleh punya satu laporan hukdis berjalan. Satu SK yang dilaporkan dua kali membuat
 * Kanwil mencatat hukuman yang sama dua kali, dan KGB pegawainya ikut tergeser dua kali.
 * `kecuali` adalah laporan yang sedang digantikan oleh kiriman ulang.
 */
export function adaLaporanHukdisBerjalan(
  laporan: readonly { id?: string; pegawaiId: string; status: string }[],
  pegawaiId: string,
  kecuali?: string | null,
): boolean {
  return laporan.some(
    (l) => l.pegawaiId === pegawaiId && LAPORAN_HUKDIS_DIPEGANG_UPT.includes(l.status) && (!kecuali || l.id !== kecuali),
  );
}

export interface IsianLaporanHukdis {
  jenisHukdis?: string | null;
  nomorSK?: string | null;
  tanggalSK?: NilaiTanggal;
  tmtMulai?: NilaiTanggal;
  tmtBerakhir?: NilaiTanggal;
  /** Laporan sudah membawa pindaian SK, baik unggahan baru maupun bawaan laporan yang dikirim ulang. */
  adaBerkas?: boolean;
}

/**
 * Apa yang masih kurang sebelum laporan boleh dikirim. TMT berakhir tidak ditagih: sebagian jenis hukuman
 * tidak bermasa, dan untuk yang bermasa peninjau menghitungnya dari katalog jenis saat mencatat. Pindaian
 * SK wajib, sebab peninjau mencocokkan jenis dan tanggalnya dengan SK asli, bukan dengan ketikan.
 */
export function kekuranganLaporanHukdis(isian: IsianLaporanHukdis): string[] {
  const kurang: string[] = [];
  if (!String(isian.jenisHukdis ?? "").trim()) kurang.push("jenis hukuman");
  if (!String(isian.nomorSK ?? "").trim()) kurang.push("nomor SK");
  if (!tanggalKalender(isian.tanggalSK)) kurang.push("tanggal SK");
  if (!tanggalKalender(isian.tmtMulai)) kurang.push("TMT mulai");
  if (!isian.adaBerkas) kurang.push("pindaian SK hukuman disiplin");
  return kurang;
}

/** Urutan tanggal yang tidak masuk akal; null bila tidak ada masalah. */
export function galatTanggalLaporanHukdis(isian: IsianLaporanHukdis): string | null {
  const mulai = tanggalKalender(isian.tmtMulai);
  const berakhir = tanggalKalender(isian.tmtBerakhir);
  if (mulai && berakhir && berakhir < mulai) return "TMT berakhir tidak boleh sebelum TMT mulai.";
  return null;
}
