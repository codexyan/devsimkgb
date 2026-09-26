// Pemeriksaan NIP yang diusulkan UPT, baik untuk pegawai baru maupun pembetulan NIP pegawai yang sudah
// tercatat. Satu NIP hanya boleh menunjuk satu orang: di data induk, dan di antara usulan yang belum selesai.

import { db } from "./db";
import { BELUM_SELESAI } from "./usulanPegawai";
import type { UsulanPegawaiRow } from "./sheets/tables";

/**
 * Pesan bila `nip` sudah dipakai pegawai lain atau usulan lain yang belum selesai; null bila bebas.
 * `pegawaiId` dan `usulanId` adalah pemilik sah NIP itu sendiri, yang tidak dihitung bentrok.
 */
export async function bentrokNipUsulan(
  nip: string,
  pemilik: { pegawaiId?: string | null; usulanId?: string | null },
): Promise<string | null> {
  const pegawai = await db.pegawai.findUnique({ nip });
  if (pegawai && pegawai.id !== pemilik.pegawaiId) return `NIP ${nip} sudah tercatat atas nama ${pegawai.nama}.`;
  const usulan = (await db.usulanPegawai.findMany({
    where: { nip, status: { in: BELUM_SELESAI } },
  })) as UsulanPegawaiRow[];
  const lain = usulan.find(
    (u) => u.id !== pemilik.usulanId && !(pemilik.pegawaiId && u.pegawaiId === pemilik.pegawaiId),
  );
  return lain ? `NIP ${nip} sudah dipakai usulan lain yang belum selesai${lain.nama ? ` (${lain.nama})` : ""}.` : null;
}
