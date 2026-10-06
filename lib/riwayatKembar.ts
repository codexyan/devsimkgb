// Riwayat kenaikan pangkat atau PMK yang tercatat dua kali (ADR-069).
//
// Satu SK hanya dapat menaikkan pangkat atau meninjau masa kerja sekali. Dua riwayat dengan nomor SK yang sama,
// TMT yang sama, dan (untuk kenaikan pangkat) golongan baru yang sama adalah satu kejadian yang tercatat dua kali.
// Salah satunya dapat dihapus tanpa menghitung ulang data pegawai, sebab riwayat yang tersisa mencatat kenaikan yang
// sama. Riwayat yang hanya bernomor sama tetapi berbeda golongan atau TMT bukan duplikat: golongan, masa kerja, dan
// gaji pokok pegawai dihitung dari keduanya, jadi tidak dihapus dari sini.
//
// Modul ini murni agar dipakai bersama tab Pangkat & PMK dan rutenya.

import { kunciNomorSk } from "./nomorSurat";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

export interface RiwayatUntukKembar {
  id: string;
  nomorSK: string | null;
  /** TMT pangkat untuk kenaikan pangkat, TMT PMK untuk PMK. */
  tmt: NilaiTanggal;
  /** Hanya kenaikan pangkat. */
  golonganBaru?: string | null;
}

/** true bila kedua riwayat (sejenis) adalah satu SK yang tercatat dua kali. */
export function riwayatKembar(a: RiwayatUntukKembar, b: RiwayatUntukKembar): boolean {
  if (a.id === b.id) return false;
  const nomor = kunciNomorSk(a.nomorSK);
  if (!nomor || nomor !== kunciNomorSk(b.nomorSK)) return false;
  const ta = tanggalKalender(a.tmt)?.getTime();
  if (ta === undefined || ta !== tanggalKalender(b.tmt)?.getTime()) return false;
  return (a.golonganBaru ?? "").trim() === (b.golonganBaru ?? "").trim();
}

/** Riwayat lain yang kembar dengan `riwayat`, atau null. */
export function cariKembar<T extends RiwayatUntukKembar>(riwayat: RiwayatUntukKembar, semua: readonly T[]): T | null {
  return semua.find((r) => riwayatKembar(riwayat, r)) ?? null;
}
