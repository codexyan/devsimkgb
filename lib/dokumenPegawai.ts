// Arsip dokumen pegawai (ADR-023, ADR-028): PDF yang diunggah Super Admin atau Tim SDM KGB dari tab Dokumen atau
// dilampirkan saat mencatat (kenaikan pangkat, PMK, mutasi, ubah data), misalnya SK CPNS, SK PNS, SK pangkat, SK KGB
// lama, SK PMK, atau SK mutasi. Modul ini murni; penyimpanannya di
// lib/dokumenPegawaiServer.ts (R2, tanpa tabel basis data):
//
//   dokumen/<id pegawai>/_daftar.json     daftar dokumen beserta jenis, nomor, dan tanggal SK-nya
//   dokumen/<id pegawai>/<id dokumen>.pdf berkasnya
//
// Kuncinya memakai id pegawai, bukan NIP, supaya berkas tidak tercecer bila NIP dikoreksi.

import { BATAS_UNGGAH_BYTE, pesanBerkasTerlaluBesar } from "./batasUnggah";

export const JENIS_DOKUMEN = {
  sk_cpns: "SK CPNS",
  sk_pns: "SK PNS",
  sk_pangkat: "SK kenaikan pangkat",
  sk_kgb: "SK KGB",
  sk_pmk: "SK peninjauan masa kerja",
  sk_jabatan: "SK jabatan",
  sk_mutasi: "SK mutasi",
  sk_pemberhentian: "SK pemberhentian",
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
   * Penanda asal bila dokumen ini disalin dari tempat lain (mis. kunci R2 berkas kiriman formulir); kosong bila
   * diunggah Tim SDM. Hanya dipakai pemanggil untuk mencegah salinan ganda; modul pegawai tidak menafsirkannya.
   */
  asal?: string;
}

/** Batas ukuran satu dokumen arsip. */
export const BATAS_DOKUMEN_BYTE = BATAS_UNGGAH_BYTE;

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
  if (isian.ukuran > BATAS_DOKUMEN_BYTE) kurang.push(pesanBerkasTerlaluBesar("dokumen"));
  return kurang;
}

/** Sumber dokumen pada daftar gabungan di tab pegawai. */
export type SumberDokumen = "arsip" | "sk_kgb" | "usulan";

export const LABEL_SUMBER_DOKUMEN: Record<SumberDokumen, string> = {
  arsip: "Arsip dokumen",
  sk_kgb: "SK KGB SIM-KGB",
  usulan: "Usulan UPT",
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
  /** Jenis dokumen bila diketahui, untuk memilih dokumen rujukan tiap tindakan; kosong untuk surat pengantar. */
  jenis?: JenisDokumen;
  /** Berkas usulan UPT: status usulannya. Linimasa SK hanya memakai berkas usulan yang disetujui (ADR-066). */
  status?: string;
}

/** Tindakan di halaman pegawai yang menampilkan dokumen rujukan (ADR-028). */
export type TindakanDokumen = "identitas" | "kepegawaian" | "dasar" | "kp" | "pmk" | "mutasi" | "pemberhentian";

/**
 * Dokumen rujukan dan jenis unggahan tiap tindakan: `rujukan` ditampilkan di panel kanan modal untuk dipratinjau,
 * `unggah` adalah jenis SK yang boleh dilampirkan saat mencatat (kosong berarti tanpa unggahan). Jenis pertama
 * pada `unggah` menjadi bawaan.
 */
export const DOKUMEN_TINDAKAN: Record<TindakanDokumen, { rujukan: readonly JenisDokumen[]; unggah: readonly JenisDokumen[] }> = {
  identitas: { rujukan: ["sk_cpns", "sk_pns", "ijazah"], unggah: [] },
  kepegawaian: { rujukan: ["sk_jabatan", "sk_mutasi"], unggah: ["sk_jabatan"] },
  dasar: { rujukan: ["sk_kgb", "sk_cpns", "sk_pangkat", "sk_pmk"], unggah: ["sk_kgb", "sk_cpns"] },
  kp: { rujukan: ["sk_pangkat"], unggah: ["sk_pangkat"] },
  pmk: { rujukan: ["sk_pmk", "sk_pangkat"], unggah: ["sk_pmk"] },
  mutasi: { rujukan: ["sk_mutasi", "sk_jabatan"], unggah: ["sk_mutasi"] },
  pemberhentian: { rujukan: ["sk_pemberhentian", "sk_mutasi"], unggah: ["sk_pemberhentian"] },
};

/** Jenis dokumen berkas usulan UPT menurut medannya (lib/usulanPegawai.ts BERKAS_USULAN). */
export const JENIS_BERKAS_USULAN: Record<string, JenisDokumen> = {
  skTerakhir: "sk_kgb",
  skPangkat: "sk_pangkat",
  skCpns: "sk_cpns",
  skPmk: "sk_pmk",
  syaratCpns: "lainnya",
};
