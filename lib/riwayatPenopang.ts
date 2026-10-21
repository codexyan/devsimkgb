// Riwayat kenaikan pangkat yang menopang data pegawai, dan syarat menghapus riwayat mana pun oleh Super Admin
// (ADR-118).
//
// Golongan, TMT golongan, masa kerja, dan gaji pokok pada data pegawai berasal dari kenaikan pangkat terakhir: TMT
// paling akhir, dan bila TMT-nya sama, yang dicatat paling akhir. Riwayat lain tidak ikut menentukan angka itu, jadi
// menghapusnya tidak mengubah data pegawai. Riwayat penopang baru boleh dihapus bila ada riwayat lain dengan angka
// yang sama persis.
//
// Modul ini murni agar dipakai bersama tab Pangkat & PMK dan servernya.

import { tanggalKalender, type NilaiTanggal } from "./waktu";

export interface RiwayatKpUntukPenopang {
  id: string;
  tmtPangkat: NilaiTanggal;
  golonganBaru: string;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  gajiPokokBaru: number;
  createdAt?: NilaiTanggal;
}

// Saat dicatat, dengan jam: dua riwayat sehari yang sama tetap terurut. Berbeda dengan TMT yang tanggal kalender.
const waktu = (n: NilaiTanggal) => (n instanceof Date ? n.getTime() : typeof n === "string" ? Date.parse(n) || 0 : 0);

/** Riwayat kenaikan pangkat yang menopang data pegawai, atau null bila belum ada riwayat. */
export function riwayatPenopang<T extends RiwayatKpUntukPenopang>(semua: readonly T[]): T | null {
  let terbaik: T | null = null;
  for (const r of semua) {
    if (!terbaik) {
      terbaik = r;
      continue;
    }
    const dt = (tanggalKalender(r.tmtPangkat)?.getTime() ?? 0) - (tanggalKalender(terbaik.tmtPangkat)?.getTime() ?? 0);
    if (dt > 0 || (dt === 0 && waktu(r.createdAt) > waktu(terbaik.createdAt))) terbaik = r;
  }
  return terbaik;
}

const samaAngka = (a: RiwayatKpUntukPenopang, b: RiwayatKpUntukPenopang) =>
  (tanggalKalender(a.tmtPangkat)?.getTime() ?? null) === (tanggalKalender(b.tmtPangkat)?.getTime() ?? null) &&
  a.golonganBaru === b.golonganBaru &&
  a.mkgTahunBaru === b.mkgTahunBaru &&
  a.mkgBulanBaru === b.mkgBulanBaru &&
  a.gajiPokokBaru === b.gajiPokokBaru;

export type BolehHapus = { boleh: true } | { boleh: false; alasan: string };

/** Boleh tidaknya satu riwayat kenaikan pangkat dihapus Super Admin tanpa mengubah data pegawai. */
export function bolehHapusRiwayatKp(id: string, semua: readonly RiwayatKpUntukPenopang[]): BolehHapus {
  const riwayat = semua.find((r) => r.id === id);
  if (!riwayat) return { boleh: false, alasan: "Riwayat tidak ditemukan" };
  if (riwayatPenopang(semua)?.id !== id) return { boleh: true };
  if (semua.some((r) => r.id !== id && samaAngka(r, riwayat))) return { boleh: true };
  return {
    boleh: false,
    alasan:
      "Riwayat ini yang menopang golongan, masa kerja, dan gaji pokok pegawai saat ini, jadi tidak dapat dihapus. " +
      "Betulkan angkanya lewat Ubah data SK, atau hapus riwayat lain yang keliru.",
  };
}
