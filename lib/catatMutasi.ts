// Pencatatan satu mutasi atau pemberhentian ke riwayat dan data pegawai.
//
// Dipisahkan dari rutenya karena dipakai dua tempat: pencatatan langsung oleh Kanwil, dan penerimaan
// laporan dari UPT. Keduanya harus mencatat dengan cara yang persis sama; yang berbeda hanya siapa
// yang mengawali, bukan apa yang terjadi pada data pegawainya.

import { db } from "./db";
import { newId } from "./sheets/id";
import { LABEL_JENIS_MUTASI, perubahanPegawaiMutasi, type JenisMutasi } from "./mutasiPegawai";
import { SATKER, cariSatker } from "./satker";
import type { PegawaiRow, RiwayatMutasiRow } from "./sheets/tables";

export interface IsianMutasi {
  jenis: JenisMutasi;
  /** Kode satker tujuan; hanya untuk mutasi definitif dan BKO. */
  satkerTujuan: string | null;
  tmt: Date | null;
  nomorSk: string | null;
  tanggalSk: Date | null;
  alasan: string | null;
  keterangan: string | null;
}

/**
 * Catat satu mutasi: satu baris riwayat sebagai bukti, dan perubahan seperlunya pada data pegawai.
 *
 * Pegawai tidak pernah dihapus, sehingga riwayat KGB-nya tetap utuh dan KGB yang TMT-nya jatuh sebelum
 * tanggal berhenti tetap sah diproses. BKO sengaja tidak mengubah unit kerja: gaji pegawai BKO tetap
 * dibayar satker asal, jadi KGB, SK, dan KPPN tujuannya juga tetap di sana.
 */
export async function catatMutasi(
  pegawai: PegawaiRow,
  isian: IsianMutasi,
  oleh: string,
  sekarang: Date,
): Promise<{ baris: RiwayatMutasiRow; label: string; satkerTujuan: string | null }> {
  const tujuan = isian.satkerTujuan ? SATKER.find((s) => s.kode === isian.satkerTujuan) ?? null : null;
  const asal = cariSatker(pegawai.unitKerja);
  const perubahan = perubahanPegawaiMutasi(isian, tujuan?.nama ?? null);

  const baris: RiwayatMutasiRow = {
    id: newId(),
    pegawaiId: pegawai.id,
    jenis: isian.jenis,
    satkerAsal: asal?.nama ?? pegawai.unitKerja ?? null,
    satkerTujuan: tujuan?.nama ?? null,
    tmt: isian.tmt,
    nomorSK: isian.nomorSk,
    tanggalSK: isian.tanggalSk,
    alasan: isian.alasan,
    keterangan: isian.keterangan,
    createdAt: sekarang,
    createdBy: oleh,
  };
  await db.riwayatMutasi.create(baris);
  if (Object.keys(perubahan).length > 0) await db.pegawai.update({ id: pegawai.id }, perubahan);

  return { baris, label: LABEL_JENIS_MUTASI[isian.jenis], satkerTujuan: tujuan?.nama ?? null };
}
