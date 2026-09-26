// Batas akses peran admin_upt: operator UPT hanya boleh melihat data satkernya sendiri. Modul ini murni
// (tanpa basis data) agar aturannya dapat diuji dan dipakai ulang oleh rute API mana pun. Aturan yang
// disepakati pemilik (docs/adr/ADR-004-admin-upt.md, ADR-009-keuangan-per-satker.md):
//   - pegawai yang terlihat hanya yang unit kerjanya cocok dengan kode satker akun;
//   - hukuman disiplin hanya tampil sebagai "KGB ditunda", tanpa jenis dan keterangan;
//   - berkas SK boleh diunduh begitu SK bertanda tangan diunggah Tim SDM Kanwil (menunggu keuangan),
//     karena keuangan UPT sendiri yang menindaklanjutinya di Gaji Web.

import { ROLES } from "@/lib/auth/roles";
import { SATKER } from "@/lib/satker";
import { kodeSatkerPegawai } from "@/lib/rekapSatker";

/** Satker yang boleh dipegang akun admin_upt: seluruh UPT, bukan Kanwil (Kanwil dikerjakan Tim SDM). */
export const SATKER_UPT = SATKER.filter((s) => s.jenis !== "kanwil");

export function isSatkerUpt(kode: string | null | undefined): boolean {
  return !!kode && SATKER_UPT.some((s) => s.kode === kode);
}

/**
 * Kode satker yang berlaku untuk sebuah akun; null bila akun bukan admin_upt atau satkernya tidak sah.
 * Dipakai rute API: null berarti permintaan ditolak, bukan berarti boleh melihat semua satker.
 */
export function satkerAkunUpt(user: { role: string | null; satker: string | null }): string | null {
  if (user.role !== ROLES.ADMIN_UPT) return null;
  return isSatkerUpt(user.satker) ? user.satker : null;
}

/** Nilai kolom satker yang disimpan untuk sebuah peran; peran Kanwil selalu kosong. */
export function nilaiSatkerUntukPeran(role: string, satker: unknown): { ok: true; satker: string | null } | { ok: false; pesan: string } {
  if (role !== ROLES.ADMIN_UPT) return { ok: true, satker: null };
  const kode = typeof satker === "string" ? satker.trim() : "";
  if (!kode) return { ok: false, pesan: "Satker wajib dipilih untuk peran Admin UPT" };
  if (!isSatkerUpt(kode)) return { ok: false, pesan: "Satker tidak dikenal atau bukan UPT" };
  return { ok: true, satker: kode };
}

/**
 * Apakah KGB pegawai ini ditindaklanjuti keuangan Kanwil. Keuangan Kanwil hanya memegang pegawai Kanwil;
 * pegawai UPT dikonfirmasi dan direkam di Gaji Web oleh keuangan satkernya sendiri, lewat akun Admin UPT.
 * Unit kerja yang tidak dikenali ikut Kanwil agar tidak ada KGB yang tak dipegang siapa pun.
 */
export function dipegangKeuanganKanwil(unitKerja: string | null | undefined): boolean {
  return !isSatkerUpt(kodeSatkerPegawai(unitKerja));
}

/** Pegawai satker itu saja; unit kerja dicocokkan dengan daftar satker baku (lib/rekapSatker.ts). */
export function pegawaiSatker<T extends { unitKerja: string | null }>(daftar: readonly T[], kode: string): T[] {
  return daftar.filter((p) => kodeSatkerPegawai(p.unitKerja) === kode);
}

/**
 * Hukdis untuk mata UPT: hanya "KGB ditunda" dan hanya bila hukdis yang masih berlaku memang menunda KGB.
 * Jenis, nomor SK, dan keterangan hukdis tidak pernah dikirim ke UPT.
 */
export function kgbDitunda(
  riwayatHukdis: readonly { pegawaiId: string; berdampakKGB: boolean; aktif: boolean }[],
  pegawaiId: string,
): boolean {
  return riwayatHukdis.some((h) => h.pegawaiId === pegawaiId && h.aktif && h.berdampakKGB);
}

/**
 * SK boleh diunduh UPT sejak SK bertanda tangan diunggah Tim SDM (menunggu keuangan) sampai selesai, bila
 * berkasnya ada dan pegawainya memang pegawai satker itu. Arsip (SK terbit di luar SIM-KGB) tidak punya
 * berkas, jadi ikut tertolak.
 */
export function bolehUnduhSkUpt(input: {
  kode: string;
  kgb: { status: string; isArsip?: boolean | null } | null;
  pegawai: { unitKerja: string | null } | null;
  pathFile: string | null | undefined;
}): boolean {
  const { kode, kgb, pegawai, pathFile } = input;
  if (!kgb || !pegawai || !pathFile) return false;
  if (!["menunggu_keuangan", "selesai"].includes(kgb.status) || kgb.isArsip) return false;
  return kodeSatkerPegawai(pegawai.unitKerja) === kode;
}

/**
 * Waktu SK bertanda tangan diunggah, dibaca dari key berkasnya ("sk/<nip>_<milidetik>.pdf", lihat
 * app/api/kgb/[id]/upload-sk). Dipakai untuk menghitung sudah berapa lama SK pegawai UPT menunggu
 * direkam di Gaji Web; null bila key-nya tidak berpola itu.
 */
export function waktuUnggahSk(pathFile: string | null | undefined): Date | null {
  const cocok = /_(\d{13})\.pdf$/i.exec(pathFile ?? "");
  if (!cocok) return null;
  const waktu = new Date(Number(cocok[1]));
  return Number.isNaN(waktu.getTime()) ? null : waktu;
}
