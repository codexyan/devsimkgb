// Arsip dokumen pegawai (ADR-023): PDF yang diunggah Super Admin atau Tim SDM KGB dari tab "Dokumen & Pemutakhiran",
// misalnya SK CPNS, SK PNS, SK pangkat, SK KGB lama, atau SK PMK. Modul ini murni; penyimpanannya di
// lib/dokumenPegawaiServer.ts (R2, tanpa tabel basis data):
//
//   dokumen/<id pegawai>/_daftar.json     daftar dokumen beserta jenis, nomor, dan tanggal SK-nya
//   dokumen/<id pegawai>/<id dokumen>.pdf berkasnya
//
// Kuncinya memakai id pegawai, bukan NIP, supaya berkas tidak tercecer bila NIP dikoreksi.

export const JENIS_DOKUMEN = {
  sk_cpns: "SK CPNS",
  sk_pns: "SK PNS",
  sk_pangkat: "SK kenaikan pangkat",
  sk_kgb: "SK KGB",
  sk_pmk: "SK peninjauan masa kerja",
  sk_jabatan: "SK jabatan",
  ijazah: "Ijazah",
  lainnya: "Dokumen lain",
} as const;

export type JenisDokumen = keyof typeof JENIS_DOKUMEN;

export function isJenisDokumen(nilai: unknown): nilai is JenisDokumen {
  return typeof nilai === "string" && Object.prototype.hasOwnProperty.call(JENIS_DOKUMEN, nilai);
}

export interface DokumenArsip {
  id: string;
  jenis: JenisDokumen;
  nomorSK: string;
  /** yyyy-mm-dd; kosong bila tidak diisi. */
  tanggalSK: string;
  keterangan: string;
  namaBerkas: string;
  ukuran: number;
  diunggahOleh: string;
  /** ISO */
  diunggahAt: string;
  /**
   * Kunci R2 berkas asal bila dokumen ini disalin otomatis dari kiriman formulir (ADR-024); kosong bila diunggah
   * Tim SDM. Dipakai agar kiriman yang sama tidak tersalin dua kali.
   */
  asal?: string;
}

/** Batas ukuran satu dokumen arsip. */
export const BATAS_DOKUMEN_BYTE = 5 * 1024 * 1024;

export const awalanDokumen = (pegawaiId: string) => `dokumen/${pegawaiId}/`;
export const kunciDaftarDokumen = (pegawaiId: string) => `${awalanDokumen(pegawaiId)}_daftar.json`;
export const kunciBerkasDokumen = (pegawaiId: string, id: string) => `${awalanDokumen(pegawaiId)}${id}.pdf`;

/** true bila teks aman dipakai sebagai bagian kunci R2 (id pegawai atau id dokumen). */
export function idAman(id: string): boolean {
  return /^[A-Za-z0-9-]{8,64}$/.test(id);
}

/** Kekurangan isian unggahan dokumen; kosong berarti siap. */
export function periksaDokumen(isian: { jenis: unknown; tanggalSK: string; ukuran: number }): string[] {
  const kurang: string[] = [];
  if (!isJenisDokumen(isian.jenis)) kurang.push("Pilih jenis dokumen.");
  if (isian.tanggalSK && !/^\d{4}-\d{2}-\d{2}$/.test(isian.tanggalSK)) kurang.push("Tanggal SK tidak valid.");
  if (isian.ukuran <= 0) kurang.push("Pilih berkas PDF.");
  if (isian.ukuran > BATAS_DOKUMEN_BYTE) kurang.push("Ukuran dokumen paling besar 5 MB.");
  return kurang;
}

/** Sumber dokumen pada daftar gabungan di tab pegawai. */
export type SumberDokumen = "arsip" | "sk_kgb" | "usulan" | "inventaris";

export const LABEL_SUMBER_DOKUMEN: Record<SumberDokumen, string> = {
  arsip: "Arsip dokumen",
  sk_kgb: "SK KGB SIM-KGB",
  usulan: "Usulan UPT",
  inventaris: "Formulir inventarisasi",
};

/** Satu baris daftar dokumen gabungan (GET /api/pegawai/[id]/dokumen). */
export interface DokumenPegawai {
  id: string;
  sumber: SumberDokumen;
  judul: string;
  nomorSK: string;
  /** yyyy-mm-dd atau ISO; kosong bila tidak diketahui. */
  tanggal: string;
  keterangan: string;
  ukuran: number | null;
  url: string;
  /** Hanya dokumen arsip yang dapat dihapus dari tab ini. */
  bisaHapus: boolean;
}

/**
 * Jenis dokumen arsip untuk tiap berkas kiriman formulir (ADR-024): berkas kiriman yang sudah diperiksa Tim SDM
 * disalin ke arsip dokumen pegawai, sehingga SIM-KGB menjadi rujukan dan ZIP ke Google Drive hanya cadangan.
 */
export const JENIS_DARI_BERKAS_INVENTARIS: Record<string, JenisDokumen> = {
  "SK-KGB-Terakhir": "sk_kgb",
  "SK-KP-Terakhir": "sk_pangkat",
  "SK-PMK": "sk_pmk",
  "SK-CPNS": "sk_cpns",
  "SK-PNS": "sk_pns",
};

/** Status tindak lanjut kiriman yang membuat berkasnya disalin ke arsip dokumen pegawai. */
export const STATUS_SALIN_ARSIP = ["sesuai", "diterapkan"] as const;
