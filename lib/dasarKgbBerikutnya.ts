// SK yang menjadi "Atas dasar" SK KGB berikutnya (ADR-020, ADR-030).
//
// Aturannya satu kalimat: SK terbaru yang menetapkan gaji pokok. Bagi pegawai yang KGB-nya sudah pernah
// selesai di SIM-KGB, itu SK KGB terakhir; bila sesudahnya terbit SK kenaikan pangkat (termasuk penyesuaian
// ijazah) atau SK peninjauan masa kerja, SK itulah yang menggantikannya.
//
// Bagi pegawai yang belum pernah KGB di SIM-KGB, SK dasarnya yang tercatat di Data Pegawai (ADR-010): SK KGB
// terakhir yang terbit di luar SIM-KGB, atau SK CPNS bila belum pernah KGB sama sekali. SK itu diisi Kanwil
// lewat Ubah SK dasar (berikut pindaiannya di arsip pegawai), atau ikut tersalin saat usulan UPT disetujui.
// Dulu sumber ini tidak dibaca, sehingga SK yang sudah direkam pun tampil "Belum ada SK tercatat" (ADR-057).
//
// Aturannya kini dipegang lib/linimasaDasarSk.ts, yang juga dipakai Buat SK dan jendela Linimasa SK dasar
// (ADR-062); modul ini meringkasnya untuk dashboard Admin UPT, yang hanya menampilkan dasarnya.

import { LABEL_SK_GAJI, susunLinimasaDasar, type JenisSkGaji, type KgbUntukLinimasa } from "./linimasaDasarSk";
import type { NilaiTanggal } from "./waktu";

export type { SkDasarPegawaiUntukDasar, SkPenetapGaji } from "./linimasaDasarSk";
import type { SkDasarPegawaiUntukDasar, SkPenetapGaji } from "./linimasaDasarSk";

export type JenisDasarKgb = JenisSkGaji;

export const LABEL_DASAR_KGB: Record<JenisDasarKgb, string> = { ...LABEL_SK_GAJI, kgb: "SK KGB terakhir" };

export interface DasarKgbBerikutnya {
  jenis: JenisDasarKgb;
  /** Label siap tampil, mis. "SK kenaikan pangkat (Pilihan: Penyesuaian Ijazah)". */
  label: string;
  nomorSK: string | null;
  /** ISO, atau null bila tidak diketahui. */
  tanggalSK: string | null;
  /** TMT SK itu; dasar pembanding antar-SK. */
  tmt: string | null;
}

/** KGB yang sudah selesai; nomor suratnya diambil dari surat yang terbit, atau kolom SK untuk record arsip. */
export type KgbSelesaiUntukDasar = KgbUntukLinimasa;

/**
 * SK yang menjadi dasar KGB berikutnya. SK kenaikan pangkat atau PMK menang bila TMT-nya pada atau sesudah
 * TMT SK KGB terakhir dan tidak sesudah TMT KGB berikutnya; di antara keduanya, yang TMT-nya paling baru. null bila
 * tidak satu pun diketahui.
 *
 * SK KGB terakhir diambil dari riwayat KGB selesai; SK dasar Data Pegawai dipakai bila riwayatnya kosong, atau
 * bila tanggal SK-nya lebih akhir (Kanwil merekam SK yang terbit di luar SIM-KGB sesudahnya). TMT KGB terakhir
 * pada data pegawai ikut menjadi batas bawah SK kenaikan pangkat dan PMK.
 */
export function dasarKgbBerikutnya(input: {
  kgb: readonly KgbSelesaiUntukDasar[];
  pangkat?: readonly SkPenetapGaji[];
  pmk?: readonly SkPenetapGaji[];
  pegawai?: SkDasarPegawaiUntukDasar | null;
  /**
   * TMT KGB berikutnya (ADR-062): SK yang baru berlaku sesudahnya belum menetapkan gaji yang dinaikkan KGB itu,
   * misalnya SK kenaikan pangkat yang dicatat lebih awal. Tanpa nilai ini tidak ada batas atas.
   */
  tmtKgbBaru?: NilaiTanggal;
}): DasarKgbBerikutnya | null {
  const { dasar } = susunLinimasaDasar({ ...input, tmtKgbSebelumnya: input.pegawai?.tmtKgbTerakhir, hanyaDasar: true });
  if (!dasar) return null;
  return {
    jenis: dasar.jenis,
    label: dasar.jenis === "kgb" ? LABEL_DASAR_KGB.kgb : dasar.label,
    nomorSK: dasar.nomorSK,
    tanggalSK: dasar.tanggalSK,
    tmt: dasar.tmt,
  };
}
