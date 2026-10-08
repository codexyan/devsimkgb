// Apakah SK KGB sama dengan usulan UPT yang disetujui (ADR-082). Sejak ADR-087 hasilnya hanya keterangan bagi UPT saat
// memeriksa SK; setiap SK pegawai UPT tetap menunggu review.
//
// Admin UPT sudah melihat hitungan SK KGB-nya saat mengajukan (Pratinjau SK, ADR-078), lalu dulu diminta memeriksa SK
// yang sama sekali lagi setelah Kanwil membuatnya (ADR-077). Pemeriksaan kedua itu hanya berguna bila SK yang dibuat
// Kanwil berbeda dari usulan, misalnya karena data pegawai diubah Kanwil sesudah usulannya disetujui. Modul ini
// membandingkan isi SK dengan hitungan dari usulan yang disetujui; murni, supaya dapat diuji.

import { kunciNomorSk } from "./nomorSurat";
import { formatTanggalId, tanggalKalender, type NilaiTanggal } from "./waktu";
import type { RiwayatKGBRow } from "./sheets/tables";

/** Isi SK KGB menurut hitungan usulan UPT yang disetujui. */
export interface HarapanSk {
  golonganLama: string;
  mkgTahunLama: number;
  mkgBulanLama: number;
  gajiPokokLama: number;
  golonganBaru: string;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  gajiPokokBaru: number;
  tmtKgbBaru: NilaiTanggal;
  /** Nomor SK yang menjadi Atas dasar; null bila tidak dapat disusun. */
  nomorSkDasar: string | null;
}

/** Satu isian yang berbeda: nilai menurut usulan dan menurut SK. */
export interface BedaSk {
  label: string;
  usulan: string;
  sk: string;
}

const rupiah = (n: number) => `Rp${Number(n || 0).toLocaleString("id-ID")}`;
const mkg = (t: number, b: number) => `${t || 0} tahun ${b || 0} bulan`;
const tanggal = (v: NilaiTanggal) => {
  const t = tanggalKalender(v);
  return t ? formatTanggalId(t) : "-";
};

/** Isian SK yang berbeda dari hitungan usulan; kosong berarti SK sesuai usulan. */
export function bedaSkDenganUsulan(
  kgb: Pick<
    RiwayatKGBRow,
    | "golonganLama" | "mkgTahunLama" | "mkgBulanLama" | "gajiPokokLama" | "golonganBaru" | "mkgTahunBaru" | "mkgBulanBaru"
    | "gajiPokokBaru" | "tmtKgbBaru" | "nomorSK"
  >,
  harapan: HarapanSk,
): BedaSk[] {
  const beda: BedaSk[] = [];
  const banding = (label: string, usulan: string, sk: string) => {
    if (usulan !== sk) beda.push({ label, usulan, sk });
  };
  banding("Golongan lama", harapan.golonganLama, kgb.golonganLama);
  banding("Masa kerja lama", mkg(harapan.mkgTahunLama, harapan.mkgBulanLama), mkg(kgb.mkgTahunLama, kgb.mkgBulanLama));
  banding("Gaji pokok lama", rupiah(harapan.gajiPokokLama), rupiah(kgb.gajiPokokLama));
  banding("Golongan baru", harapan.golonganBaru, kgb.golonganBaru);
  banding("Masa kerja baru", mkg(harapan.mkgTahunBaru, harapan.mkgBulanBaru), mkg(kgb.mkgTahunBaru, kgb.mkgBulanBaru));
  banding("Gaji pokok baru", rupiah(harapan.gajiPokokBaru), rupiah(kgb.gajiPokokBaru));
  banding("TMT KGB", tanggal(harapan.tmtKgbBaru), tanggal(kgb.tmtKgbBaru));
  const dasarUsulan = harapan.nomorSkDasar?.trim() ?? "";
  const dasarSk = kgb.nomorSK?.trim() ?? "";
  if (!dasarUsulan || kunciNomorSk(dasarUsulan) !== kunciNomorSk(dasarSk))
    beda.push({ label: "Atas dasar SK", usulan: dasarUsulan || "tidak dapat disusun dari usulan", sk: dasarSk || "-" });
  return beda;
}
