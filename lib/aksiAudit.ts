// Jenis aksi jejak audit yang ditafsirkan ulang saat dibaca (ADR-105).
//
// Unggahan berkas SK untuk KGB arsip dicatat sebagai "upload_sk_arsip" sejak ADR-105 butir 5. Sebelumnya ia tercatat
// sebagai "upload_sk" dengan keterangan "file SK arsip" di detailnya. Entri lama itu dibaca sebagai "upload_sk_arsip"
// agar label, saringan, dan ringkasan Log Aktivitas sama untuk entri lama dan baru, tanpa mengubah data yang tersimpan.

export const AKSI_UNGGAH_SK = "upload_sk";
export const AKSI_UNGGAH_SK_ARSIP = "upload_sk_arsip";

/**
 * Penanda di detail entri "upload_sk" milik KGB arsip, ditulis oleh POST /api/kgb/[id]/upload-sk. Sebelum ADR-096
 * detailnya berakhir pada "file SK arsip"; sesudahnya disusul "; " dan hasil pemeriksaan TTE.
 */
const PENANDA_ARSIP = /, file SK arsip(;|$)/;

/** Jenis aksi sebuah entri audit sebagaimana ditampilkan dan disaring di Log Aktivitas. */
export function aksiAudit(entri: { aksi: string; detail: string | null }): string {
  if (entri.aksi === AKSI_UNGGAH_SK && PENANDA_ARSIP.test(entri.detail ?? "")) return AKSI_UNGGAH_SK_ARSIP;
  return entri.aksi;
}
