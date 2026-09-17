/* ── Status KGB: label, keterangan untuk pegawai, dan kelas badge ─────────
   Satu sumber label status untuk halaman publik (cek status, panduan) dan
   dashboard. Kelas merujuk ke app/(publik)/publik.css (.pub-status-*).     */

export type StatusKgb =
  | "belum_diproses"
  | "sedang_diproses"
  | "menunggu_keuangan"
  | "selesai"
  | "ditolak";

interface InfoStatusKgb {
  label: string;
  keterangan: string;
  kelas: string;
}

export const STATUS_KGB: Record<StatusKgb, InfoStatusKgb> = {
  belum_diproses: {
    label: "Belum Diproses",
    keterangan: "Jadwal KGB sudah tercatat, tetapi belum diinput oleh Tim SDM Kanwil.",
    kelas: "pub-status-belum",
  },
  sedang_diproses: {
    label: "Sedang Diproses",
    keterangan:
      "Tim SDM Kanwil sudah menghitung KGB; SK sedang disiapkan atau menunggu tanda tangan elektronik.",
    kelas: "pub-status-proses",
  },
  menunggu_keuangan: {
    label: "Menunggu Keuangan",
    keterangan: "SK sudah ditandatangani dan diunggah, dan sedang menunggu konfirmasi bagian keuangan.",
    kelas: "pub-status-keuangan",
  },
  selesai: {
    label: "Selesai",
    keterangan: "SK sudah terbit dan KGB sudah tercatat selesai di SIM-KGB.",
    kelas: "pub-status-selesai",
  },
  ditolak: {
    label: "Dibatalkan",
    keterangan: "Proses dibatalkan karena data perlu diperbaiki; KGB akan diinput ulang.",
    kelas: "pub-status-batal",
  },
};

export function isStatusKgb(status: string): status is StatusKgb {
  return Object.prototype.hasOwnProperty.call(STATUS_KGB, status);
}

/** Nilai yang tidak dikenal ditampilkan apa adanya, tidak dianggap Belum Diproses. */
export function infoStatusKgb(status: string): InfoStatusKgb {
  if (isStatusKgb(status)) return STATUS_KGB[status];
  return { label: status, keterangan: "", kelas: "" };
}

/* Warna badge status di dashboard, merujuk token app/globals.css (mode terang dan gelap). */

interface WarnaStatusKgb {
  bg: string;
  color: string;
}

export const WARNA_STATUS_KGB: Record<StatusKgb, WarnaStatusKgb> = {
  belum_diproses: { bg: "var(--tint-amber-bg)", color: "var(--st-amber)" },
  sedang_diproses: { bg: "var(--tint-navy)", color: "var(--dtn)" },
  menunggu_keuangan: { bg: "var(--tint-violet-bg)", color: "var(--st-violet)" },
  selesai: { bg: "var(--tint-green-bg)", color: "var(--st-green)" },
  ditolak: { bg: "var(--tint-red-bg)", color: "var(--st-red)" },
};

const WARNA_STATUS_LAIN: WarnaStatusKgb = { bg: "var(--ln2)", color: "var(--dt3)" };

/** Warna badge dashboard; status yang tidak dikenal memakai warna netral. */
export function warnaStatusKgb(status: string): WarnaStatusKgb {
  return isStatusKgb(status) ? WARNA_STATUS_KGB[status] : WARNA_STATUS_LAIN;
}
