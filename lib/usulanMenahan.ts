// Penahan proses KGB selama ada usulan perbaikan data dari UPT yang belum ditinjau (ADR-014).
//
// Usulan UPT bisa mengubah golongan, masa kerja, gaji pokok, TMT, nama, atau membawa laporan hukuman
// disiplin: semuanya tercetak di SK atau menentukan boleh tidaknya KGB terbit. Memproses KGB dengan data
// lama sementara usulannya menunggu berarti SK harus dibuat ulang, atau lebih buruk, usulannya tidak lagi
// dapat disetujui setelah SK diunggah. Karena itu Input KGB, Arsip KGB, Buat SK, dan Unggah SK TTE ditolak
// sampai usulannya disetujui atau dikembalikan. Membatalkan KGB tetap boleh.

import { db } from "./db";
import { usulanBaruBelumDitinjau } from "./terdatakanPegawaiBaru";
import type { UsulanPegawaiRow } from "./sheets/tables";

/**
 * Usulan yang menahan proses KGB pegawai ini; null bila tidak ada. Dua macam: usulan perbaikan data yang menunggu tinjauan
 * Kanwil, dan usulan pegawai baru tertaut yang belum disetujui (ADR-112). Pada yang kedua pegawainya sudah terdata langsung,
 * tetapi datanya belum pernah ditinjau Kanwil; surat dan tinjauan diperlukan saat KGB diusulkan, jadi proses KGB menunggu
 * usulan pertamanya disetujui, baik yang belum diajukan UPT, yang dikembalikan, maupun yang sedang ditinjau.
 */
export async function usulanMenahan(pegawaiId: string): Promise<UsulanPegawaiRow | null> {
  const usulan = (await db.usulanPegawai.findMany({ where: { pegawaiId } })) as UsulanPegawaiRow[];
  return usulan.find((u) => u.status === "menunggu") ?? usulanBaruBelumDitinjau(usulan, pegawaiId);
}

/** Pesan penolakan; menyesuaikan bila yang menahan adalah usulan pegawai baru (ADR-112). */
export function pesanUsulanMenahan(nama: string, usulan?: Pick<UsulanPegawaiRow, "jenis" | "status"> | null): string {
  if (usulan?.jenis === "baru") {
    const keadaan =
      usulan.status === "draf"
        ? "UPT belum mengajukan usulannya"
        : usulan.status === "revisi"
          ? "usulannya dikembalikan ke UPT untuk diperbaiki"
          : "usulannya menunggu tinjauan Kanwil";
    return `Data ${nama} dari UPT belum ditinjau Kanwil: ${keadaan}. Proses KGB baru dapat dimulai sesudah usulan pegawai barunya disetujui; ${
      usulan.status === "menunggu" ? "tinjau usulannya di Usulan UPT" : "minta UPT mengajukannya dengan surat Srikandi"
    }.`;
  }
  return `Ada usulan perbaikan data ${nama} dari UPT yang belum ditinjau. Tinjau usulan itu lebih dulu (setujui atau kembalikan), lalu lanjutkan proses KGB-nya dengan data yang sudah diperbarui.`;
}
