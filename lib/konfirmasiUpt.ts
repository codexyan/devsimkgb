// Konfirmasi data pegawai oleh admin UPT sebelum KGB diproses Kanwil.
//
// Masukan tim keuangan: masa kerja golongan dan status hukuman disiplin harus dipastikan UPT sebelum SK
// terbit. Salah MKG membuat gaji pokok baru salah hitung; hukdis yang tidak dilaporkan membuat KGB tetap
// terbit padahal seharusnya ditunda. Keduanya berakhir pada kekurangan gaji atau, yang lebih berat,
// kelebihan gaji yang harus disetor kembali ke kas negara.
//
// Konfirmasi berlaku per siklus, bukan sekali untuk selamanya: yang disimpan adalah TMT KGB yang
// dikonfirmasi. Begitu pegawai masuk siklus berikutnya, konfirmasinya kedaluwarsa dan harus diulang.
// Modul ini murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

import { tanggalKalender, type NilaiTanggal } from "./waktu";

export type StatusKonfirmasiUpt = "belum" | "berlaku" | "kedaluwarsa";

export interface PegawaiKonfirmasi {
  konfirmasiUptTmt: NilaiTanggal;
  konfirmasiUptAt?: NilaiTanggal;
  konfirmasiUptOleh?: string | null;
}

/**
 * Status konfirmasi untuk satu TMT KGB:
 * - "belum"        : UPT belum pernah mengonfirmasi apa pun;
 * - "berlaku"      : konfirmasi terakhir memang untuk TMT ini;
 * - "kedaluwarsa"  : UPT pernah mengonfirmasi, tetapi untuk siklus yang lain.
 * TMT kosong tidak dapat dinilai, jadi dianggap belum dikonfirmasi.
 */
export function statusKonfirmasiUpt(pegawai: PegawaiKonfirmasi, tmtKgb: NilaiTanggal): StatusKonfirmasiUpt {
  const dikonfirmasi = tanggalKalender(pegawai.konfirmasiUptTmt);
  if (!dikonfirmasi) return "belum";
  const tmt = tanggalKalender(tmtKgb);
  if (!tmt) return "kedaluwarsa";
  return dikonfirmasi.getTime() === tmt.getTime() ? "berlaku" : "kedaluwarsa";
}

/** true bila konfirmasi UPT untuk TMT ini masih berlaku. */
export function sudahDikonfirmasiUpt(pegawai: PegawaiKonfirmasi, tmtKgb: NilaiTanggal): boolean {
  return statusKonfirmasiUpt(pegawai, tmtKgb) === "berlaku";
}

export const LABEL_KONFIRMASI_UPT: Record<StatusKonfirmasiUpt, string> = {
  belum: "Belum dikonfirmasi UPT",
  berlaku: "Dikonfirmasi UPT",
  kedaluwarsa: "Konfirmasi siklus lalu",
};

/** Butir yang dinyatakan UPT saat mengonfirmasi; dipakai di dialog konfirmasi dan panduan. */
export const BUTIR_KONFIRMASI_UPT = [
  "Nomor, tanggal, dan TMT SK terakhir yang menjadi dasar gaji pokok sekarang sudah sesuai.",
  "Masa kerja golongan dan gaji pokok sama persis dengan SK terakhir itu.",
  "Pegawai tidak sedang menjalani hukuman disiplin yang menunda kenaikan gaji berkala.",
  "Pegawai masih aktif dan tidak dalam proses pensiun, pindah, atau pemberhentian sampai TMT.",
  "Bila ada perubahan sebelum TMT, UPT memberi tahu Kanwil sebelum tanggal itu.",
] as const;
