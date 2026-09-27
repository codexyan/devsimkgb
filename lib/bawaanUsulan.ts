// Bawaan usulan perbaikan: SK dasar dan berkas yang sudah pernah disetujui Kanwil untuk seorang pegawai.
//
// Berkas usulan menempel pada baris usulannya, bukan pada data pegawai. Tanpa aturan ini, pegawai yang
// didaftarkan UPT lewat "Tambah pegawai" lengkap dengan SK CPNS-nya tampil kosong lagi begitu UPT
// mengusulkan perbaikan: berkas dan nomor SK-nya harus diunggah dan diketik ulang, padahal Kanwil sudah
// menyetujuinya. Usulan baru karena itu membawa berkas terakhir yang disetujui untuk tiap jenis berkas,
// dan SK dasar diambil dari data pegawai (ADR-010) atau, untuk pegawai yang disetujui sebelum kolom itu
// ada, dari usulan disetujui terakhir yang memuatnya (ADR-017).
//
// Murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";
import { BERKAS_USULAN, berkasUntukKeadaan } from "./usulanPegawai";

type BerkasUsulan = (typeof BERKAS_USULAN)[number];
export type KunciBerkasPegawai = Exclude<BerkasUsulan["kunci"], "pathBerkas">;

export interface BerkasBawaan {
  jalur: string;
  /** Usulan asal berkasnya; dipakai untuk membukanya lewat /api/usulan/{id}/berkas. */
  usulanId: string;
}

export interface BawaanUsulan {
  nomorSkTerakhir: string | null;
  tanggalSkTerakhir: Date | null;
  berkas: Partial<Record<KunciBerkasPegawai, BerkasBawaan>>;
}

const waktu = (u: Pick<UsulanPegawaiRow, "ditinjauAt" | "diajukanAt">) =>
  new Date(u.ditinjauAt ?? u.diajukanAt ?? 0).getTime() || 0;

/**
 * Bawaan untuk satu pegawai dari usulan-usulannya yang sudah disetujui. Surat usulan Srikandi tidak ikut:
 * surat itu milik satu pengajuan, bukan milik pegawainya.
 */
export function bawaanPegawai(
  pegawai: Pick<PegawaiRow, "id"> & Partial<Pick<PegawaiRow, "nomorSkDasar" | "tanggalSkDasar">>,
  usulan: readonly UsulanPegawaiRow[],
): BawaanUsulan {
  const disetujui = usulan
    .filter((u) => u.pegawaiId === pegawai.id && u.status === "disetujui")
    .sort((a, b) => waktu(b) - waktu(a));

  const berkas: BawaanUsulan["berkas"] = {};
  for (const b of BERKAS_USULAN) {
    if (b.kunci === "pathBerkas") continue;
    const asal = disetujui.find((u) => u[b.kunci]);
    if (asal) berkas[b.kunci] = { jalur: asal[b.kunci] as string, usulanId: asal.id };
  }

  const nomorPegawai = pegawai.nomorSkDasar?.trim();
  if (nomorPegawai)
    return { nomorSkTerakhir: nomorPegawai, tanggalSkTerakhir: pegawai.tanggalSkDasar ?? null, berkas };
  const asalSk = disetujui.find((u) => u.nomorSkTerakhir?.trim());
  return {
    nomorSkTerakhir: asalSk?.nomorSkTerakhir?.trim() ?? null,
    tanggalSkTerakhir: asalSk?.tanggalSkTerakhir ?? null,
    berkas,
  };
}

/**
 * Berkas bawaan yang harus disalin ke sebuah usulan: yang diminta keadaan pegawainya, belum ada pada
 * usulan itu, dan tidak sengaja dihapus operator pada penyimpanan ini.
 */
export function berkasPerluDisalin(
  usulan: Partial<Pick<UsulanPegawaiRow, KunciBerkasPegawai>>,
  bawaan: BawaanUsulan,
  pernah: boolean,
  dihapus: ReadonlySet<string> = new Set(),
): { kunci: KunciBerkasPegawai; medan: string; jalur: string }[] {
  const hasil: { kunci: KunciBerkasPegawai; medan: string; jalur: string }[] = [];
  for (const b of berkasUntukKeadaan(pernah)) {
    const kunci = b.kunci as KunciBerkasPegawai;
    const asal = bawaan.berkas[kunci];
    if (!asal || usulan[kunci] || dihapus.has(b.medan)) continue;
    hasil.push({ kunci, medan: b.medan, jalur: asal.jalur });
  }
  return hasil;
}

/** Usulan dengan berkas bawaan diisikan ke kolom yang masih kosong; untuk menilai kelengkapannya. */
export function denganBerkasBawaan<T extends Partial<UsulanPegawaiRow>>(usulan: T, bawaan: BawaanUsulan): T {
  const hasil: Record<string, unknown> = { ...usulan };
  for (const [kunci, asal] of Object.entries(bawaan.berkas)) {
    if (!hasil[kunci] && asal) hasil[kunci] = asal.jalur;
  }
  return hasil as T;
}
