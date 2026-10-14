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
import { isoTanggalKalender } from "./rekapKgb";
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

/** Batas lama penundaan KGB yang diterima pencatatan hukdis, dalam bulan. */
export const BATAS_TUNDA_BULAN = { min: 1, maks: 60 } as const;

/**
 * Dampak final satu hukuman dari isian peninjau: nilai yang diketik menang, yang kosong mengikuti katalog jenis. Satu aturan
 * untuk pencatatan (lib/catatHukdis.ts) dan perkiraan di formulir Kanwil, supaya perkiraan tidak berbeda dari hasil catat.
 */
export function tentukanDampakIsian(
  kode: string,
  jenis: JenisDampak | null | undefined,
  isian: { berdampakKGB?: unknown; durasiTunda?: unknown },
): { ok: true; berdampakKGB: boolean; durasiTunda: number | null } | { ok: false; alasan: string } {
  const berdampakKGB = typeof isian.berdampakKGB === "boolean" ? isian.berdampakKGB : dampakJenisHukdis(kode, jenis).berdampakKGB;
  if (!berdampakKGB) return { ok: true, berdampakKGB, durasiTunda: null };
  const diketik = Number(isian.durasiTunda);
  const durasiTunda = Number.isFinite(diketik) && diketik > 0 ? Math.round(diketik) : (jenis?.durasiTunda ?? DURASI_TUNDA_BAWAAN);
  if (!(Number.isInteger(durasiTunda) && durasiTunda >= BATAS_TUNDA_BULAN.min && durasiTunda <= BATAS_TUNDA_BULAN.maks))
    return { ok: false, alasan: `Lama penundaan KGB harus ${BATAS_TUNDA_BULAN.min} sampai ${BATAS_TUNDA_BULAN.maks} bulan.` };
  return { ok: true, berdampakKGB, durasiTunda };
}

export type ProyeksiHukdis =
  /** Hukumannya tidak menunda KGB, jadi jadwal tidak bergeser. */
  | { aksi: "tidak_menunda" }
  /**
   * Bila dicatat, TMT KGB berikutnya bergeser dari `tmtSebelum` ke `tmtBaru`. `sesudahKgbBerjalan` true bila pegawai punya
   * KGB yang sedang diproses atau menunggu keuangan: KGB itu tidak berubah, yang bergeser siklus sesudahnya.
   * `tmtKgbTerakhir` adalah TMT acuan masa kerja yang akan tersimpan pada pegawai (TMT KGB berjalan bila ada).
   */
  | { aksi: "geser"; tmtSebelum: Date; tmtBaru: Date; bulan: number; sesudahKgbBerjalan: boolean; tmtKgbTerakhir: Date }
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
  return {
    aksi: "geser",
    tmtSebelum: rencana.tmtSebelumTunda,
    tmtBaru: rencana.tmtKgbBerikutnya,
    bulan,
    sesudahKgbBerjalan: rencana.geserKgbAktif,
    tmtKgbTerakhir: rencana.tmtKgbTerakhir,
  };
}

/** Bentuk JSON proyeksi untuk API (tanggal sebagai tanggal kalender WITA), dipakai UPT dan Kanwil. */
export type ProyeksiHukdisJson =
  | { aksi: "tidak_menunda" }
  | { aksi: "geser"; dari: string | null; ke: string | null; bulan: number; sesudahKgbBerjalan: boolean }
  | { aksi: "tolak"; alasan: string };

export function jsonProyeksiHukdis(p: ProyeksiHukdis): ProyeksiHukdisJson {
  if (p.aksi === "geser")
    return {
      aksi: "geser",
      dari: isoTanggalKalender(p.tmtSebelum),
      ke: isoTanggalKalender(p.tmtBaru),
      bulan: p.bulan,
      sesudahKgbBerjalan: p.sesudahKgbBerjalan,
    };
  return p.aksi === "tolak" ? { aksi: "tolak", alasan: p.alasan } : { aksi: "tidak_menunda" };
}
