// Proyeksi sementara jadwal KGB dari laporan hukuman disiplin yang masih menunggu Kanwil (ADR-114).
//
// UPT melaporkan hukdis, tetapi yang mencatat dan menggeser jadwal KGB tetap SDM Hukdis Kanwil (ADR-016). Sebelum dicatat,
// jadwal pegawai belum berubah, sehingga UPT tidak dapat memetakan kapan KGB-nya jatuh tempo bila hukumannya menunda KGB.
// Modul ini menghitung perkiraan itu dengan perencana yang sama dengan pencatatan (`rencanaPenundaanHukdis`): hanya
// tampilan, tidak menulis apa pun, dan hasilnya perkiraan selama Kanwil belum mencatat (Kanwil dapat mengubah jenis, masa
// penundaan, atau tanggalnya setelah mencocokkan dengan SK).
//
// Murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

import { rencanaPenundaanHukdis } from "./jadwalKgb";
import type { NilaiTanggal } from "./waktu";

/** Bagian katalog jenis hukuman yang menentukan dampaknya pada KGB. */
export interface JenisDampak {
  berdampakKGB?: boolean | null;
  durasiTunda?: number | null;
}

/** Masa penundaan bawaan bila katalog tidak menyebutnya, sama dengan pencatatan hukdis (lib/catatHukdis.ts). */
export const DURASI_TUNDA_BAWAAN = 12;

/**
 * Dampak satu jenis hukuman pada KGB menurut katalog: menunda atau tidak, dan berapa bulan. Satu aturan untuk pencatatan
 * (lib/catatHukdis.ts) dan proyeksi, supaya keduanya tidak berbeda: tanpa baris katalog, hanya kode `penundaan_kgb`
 * yang menunda.
 */
export function dampakJenisHukdis(
  kode: string,
  jenis: JenisDampak | null | undefined,
): { berdampakKGB: boolean; durasiTunda: number | null } {
  const berdampakKGB = jenis?.berdampakKGB ?? kode === "penundaan_kgb";
  return { berdampakKGB, durasiTunda: berdampakKGB ? (jenis?.durasiTunda ?? DURASI_TUNDA_BAWAAN) : null };
}

export type ProyeksiHukdis =
  /** Hukumannya tidak menunda KGB, jadi jadwal tidak bergeser. */
  | { aksi: "tidak_menunda" }
  /** Bila dicatat, TMT KGB berikutnya bergeser dari `tmtSebelum` ke `tmtBaru`. */
  | { aksi: "geser"; tmtSebelum: Date; tmtBaru: Date; bulan: number }
  /** Kanwil akan menolak mencatatnya pada keadaan sekarang; `alasan` apa adanya dari perencana. */
  | { aksi: "tolak"; alasan: string };

/**
 * Perkiraan jadwal bila laporan hukdis ini dicatat Kanwil pada keadaan pegawai sekarang. `kgbAktif` adalah KGB yang sedang
 * diproses atau menunggu keuangan, bila ada.
 */
export function proyeksiLaporanHukdis(input: {
  pegawai: {
    golonganRuang: string;
    mkgTahun: number;
    mkgBulan: number;
    tmtKgbBerikutnya: NilaiTanggal;
    tmtKgbTerakhir?: NilaiTanggal;
  };
  kgbAktif?: { tmtKgbBaru: NilaiTanggal; tmtKgbBerikutnya: NilaiTanggal; status?: string } | null;
  laporan: { jenisHukdis: string; tmtMulai: NilaiTanggal };
  jenis: JenisDampak | null | undefined;
  hariIni?: Date;
}): ProyeksiHukdis {
  const dampak = dampakJenisHukdis(input.laporan.jenisHukdis, input.jenis);
  if (!dampak.berdampakKGB) return { aksi: "tidak_menunda" };
  const bulan = dampak.durasiTunda ?? DURASI_TUNDA_BAWAAN;
  const rencana = rencanaPenundaanHukdis({
    pegawai: input.pegawai,
    kgbAktif: input.kgbAktif ?? null,
    tmtMulaiHukdis: input.laporan.tmtMulai,
    durasiTunda: bulan,
    hariIni: input.hariIni,
  });
  if (rencana.aksi === "tolak") return { aksi: "tolak", alasan: rencana.alasan };
  return { aksi: "geser", tmtSebelum: rencana.tmtSebelumTunda, tmtBaru: rencana.tmtKgbBerikutnya, bulan };
}
