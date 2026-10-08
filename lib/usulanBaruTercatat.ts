// Usulan pegawai baru yang NIP-nya ternyata sudah tercatat di data induk (ADR-091).
//
// NIP draf pegawai baru diperiksa saat draf dibuat, tetapi pegawainya bisa tercatat sesudah itu, misalnya oleh persetujuan
// yang terputus di tengah jalan (ADR-079). Usulan seperti itu dulu buntu: menyetujuinya akan menggandakan pegawai, jadi
// Kanwil harus mengembalikannya dan UPT mengetik ulang usulan perbaikan. Kini usulan itu diperlakukan sebagai usulan
// perbaikan data pegawai yang sudah tercatat, selama pegawainya di satker yang sama: saat diajukan UPT, dan saat disetujui
// Kanwil. Pegawai di satker lain tetap ditolak, sebab pemindahan antarsatker dilakukan Kanwil, bukan lewat usulan.

import { kodeSatkerPegawai } from "./rekapSatker";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

export type KeadaanNipTercatat = "satker_sama" | "satker_lain";

/**
 * Keadaan usulan pegawai baru terhadap pegawai ber-NIP sama di data induk. null bila usulannya bukan usulan pegawai
 * baru, atau NIP-nya belum tercatat.
 */
export function nipBaruTercatat(
  usulan: Pick<UsulanPegawaiRow, "jenis" | "satker" | "nip">,
  pegawai: Pick<PegawaiRow, "nip" | "unitKerja"> | null | undefined,
): KeadaanNipTercatat | null {
  const nip = usulan.nip?.trim();
  if (usulan.jenis !== "baru" || !pegawai || !nip || pegawai.nip?.trim() !== nip) return null;
  return kodeSatkerPegawai(pegawai.unitKerja) === usulan.satker ? "satker_sama" : "satker_lain";
}

/**
 * Kolom yang menjadikan usulan pegawai baru usulan perbaikan data pegawai ini. Unit kerja dikosongkan, sebab pada usulan
 * perbaikan ia bukan isian. Isian lain tetap: yang sama dengan data tercatat tidak terbaca sebagai perubahan, dan yang
 * berbeda tampil di daftar perubahan yang ditinjau Kanwil.
 */
export function kolomJadiPerbaikan(pegawai: Pick<PegawaiRow, "id">): Pick<UsulanPegawaiRow, "jenis" | "pegawaiId" | "unitKerja"> {
  return { jenis: "perubahan", pegawaiId: pegawai.id, unitKerja: null };
}

/** Usulan pegawai baru sebagai usulan perbaikan data pegawai yang sudah tercatat. */
export function jadikanPerbaikan<T extends UsulanPegawaiRow>(usulan: T, pegawai: Pick<PegawaiRow, "id">): T {
  return { ...usulan, ...kolomJadiPerbaikan(pegawai) };
}

/** Penolakan untuk Kanwil bila pegawai ber-NIP sama tercatat di satker lain. */
export function pesanSatkerLainKanwil(nip: string, pegawai: Pick<PegawaiRow, "nama" | "unitKerja">): string {
  return (
    `NIP ${nip} sudah tercatat atas nama ${pegawai.nama} di ${pegawai.unitKerja || "satker lain"}. ` +
    "Pemindahan antarsatker dicatat Kanwil, bukan lewat usulan pegawai baru: kembalikan usulan ini dan minta UPT menghapusnya."
  );
}

/** Penolakan untuk UPT saat mengajukan draf pegawai baru yang NIP-nya tercatat di satker lain. */
export function pesanSatkerLainUpt(nip: string): string {
  return `NIP ${nip} sudah tercatat di satker lain. Hapus draf ini; pemindahan pegawai diminta lewat Kanwil`;
}
