// Penahan proses KGB selama ada usulan perbaikan data dari UPT yang belum ditinjau (ADR-014).
//
// Usulan UPT bisa mengubah golongan, masa kerja, gaji pokok, TMT, nama, atau membawa laporan hukuman
// disiplin: semuanya tercetak di SK atau menentukan boleh tidaknya KGB terbit. Memproses KGB dengan data
// lama sementara usulannya menunggu berarti SK harus dibuat ulang, atau lebih buruk, usulannya tidak lagi
// dapat disetujui setelah SK diunggah. Karena itu Input KGB, Arsip KGB, Buat SK, dan Unggah SK TTE ditolak
// sampai usulannya disetujui atau dikembalikan. Membatalkan KGB tetap boleh.

import { db } from "./db";
import type { UsulanPegawaiRow } from "./sheets/tables";

/** Usulan perbaikan data yang menunggu tinjauan Kanwil untuk pegawai ini; null bila tidak ada. */
export async function usulanMenahan(pegawaiId: string): Promise<UsulanPegawaiRow | null> {
  const usulan = (await db.usulanPegawai.findMany({
    where: { pegawaiId, status: "menunggu" },
  })) as UsulanPegawaiRow[];
  return usulan[0] ?? null;
}

export function pesanUsulanMenahan(nama: string): string {
  return `Ada usulan perbaikan data ${nama} dari UPT yang belum ditinjau. Tinjau usulan itu lebih dulu (setujui atau kembalikan), lalu lanjutkan proses KGB-nya dengan data yang sudah diperbarui.`;
}
