// SK yang menjadi "Atas dasar" SK KGB berikutnya (ADR-020, ADR-030).
//
// Aturannya satu kalimat: SK terbaru yang menetapkan gaji pokok. Bagi pegawai yang KGB-nya sudah pernah
// selesai di SIM-KGB, itu SK KGB terakhir; bila sesudahnya terbit SK kenaikan pangkat (termasuk penyesuaian
// ijazah) atau SK peninjauan masa kerja, SK itulah yang menggantikannya.
//
// Modul ini murni supaya dipakai bersama oleh dashboard Admin UPT (yang hanya menampilkannya) dan
// pemeriksaan di sisi Kanwil, dengan aturan yang sama dengan isian Atas dasar pada Input KGB.

import { JENIS_KP, isJenisKp } from "./kenaikanPangkat";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

export type JenisDasarKgb = "kgb" | "kp" | "pmk";

export const LABEL_DASAR_KGB: Record<JenisDasarKgb, string> = {
  kgb: "SK KGB terakhir",
  kp: "SK kenaikan pangkat",
  pmk: "SK peninjauan masa kerja",
};

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
export interface KgbSelesaiUntukDasar {
  status: string;
  isArsip?: boolean | null;
  tmtKgbBaru: NilaiTanggal;
  nomorSK?: string | null;
  tanggalSK?: NilaiTanggal;
  tmtSK?: NilaiTanggal;
  surat?: { nomorSurat?: string | null; tanggalSurat?: NilaiTanggal } | null;
}

export interface SkPenetapGaji {
  nomorSK?: string | null;
  tanggalSK?: NilaiTanggal;
  tmt: NilaiTanggal;
  /** Hanya untuk kenaikan pangkat; dipakai melengkapi labelnya. */
  jenisKp?: string | null;
}

const iso = (nilai: NilaiTanggal): string | null => tanggalKalender(nilai)?.toISOString() ?? null;
const terisi = (nomor: string | null | undefined) => (nomor?.trim() && nomor.trim() !== "-" ? nomor.trim() : null);

/** SK KGB terakhir yang selesai, menurut TMT-nya; null bila pegawai belum pernah KGB di SIM-KGB. */
function dariKgb(riwayat: readonly KgbSelesaiUntukDasar[]): DasarKgbBerikutnya | null {
  let terakhir: KgbSelesaiUntukDasar | null = null;
  let tmtTerakhir: Date | null = null;
  for (const k of riwayat) {
    if (k.status !== "selesai") continue;
    const tmt = tanggalKalender(k.tmtKgbBaru);
    if (tmt && (!tmtTerakhir || tmt > tmtTerakhir)) {
      terakhir = k;
      tmtTerakhir = tmt;
    }
  }
  if (!terakhir || !tmtTerakhir) return null;
  const arsip = terakhir.isArsip === true;
  const nomorSurat = terisi(terakhir.surat?.nomorSurat);
  const nomorSK = nomorSurat ?? (arsip ? terisi(terakhir.nomorSK) : null);
  return {
    jenis: "kgb",
    label: LABEL_DASAR_KGB.kgb,
    nomorSK,
    tanggalSK: nomorSurat ? iso(terakhir.surat?.tanggalSurat) : arsip && nomorSK ? iso(terakhir.tanggalSK) : null,
    tmt: arsip && tanggalKalender(terakhir.tmtSK) ? iso(terakhir.tmtSK) : tmtTerakhir.toISOString(),
  };
}

/**
 * SK yang menjadi dasar KGB berikutnya. SK kenaikan pangkat atau PMK menang bila TMT-nya pada atau sesudah
 * TMT SK KGB terakhir; di antara keduanya, yang TMT-nya paling baru. null bila tidak satu pun diketahui.
 */
export function dasarKgbBerikutnya(input: {
  kgb: readonly KgbSelesaiUntukDasar[];
  pangkat?: readonly SkPenetapGaji[];
  pmk?: readonly SkPenetapGaji[];
}): DasarKgbBerikutnya | null {
  const dasarKgb = dariKgb(input.kgb);
  const batas = tanggalKalender(dasarKgb?.tmt);

  let unggul: DasarKgbBerikutnya | null = null;
  let tmtUnggul: Date | null = null;
  const timbang = (sk: SkPenetapGaji, jenis: "kp" | "pmk") => {
    const tmt = tanggalKalender(sk.tmt);
    if (!tmt) return;
    // SK yang lebih lama daripada SK KGB terakhir sudah terwakili oleh SK KGB itu.
    if (batas && tmt < batas) return;
    if (tmtUnggul && tmt <= tmtUnggul) return;
    const jenisKp = sk.jenisKp?.trim() ?? "";
    unggul = {
      jenis,
      label: jenis === "kp" && isJenisKp(jenisKp) ? `${LABEL_DASAR_KGB.kp} (${JENIS_KP[jenisKp]})` : LABEL_DASAR_KGB[jenis],
      nomorSK: terisi(sk.nomorSK),
      tanggalSK: iso(sk.tanggalSK),
      tmt: tmt.toISOString(),
    };
    tmtUnggul = tmt;
  };
  for (const sk of input.pangkat ?? []) timbang(sk, "kp");
  for (const sk of input.pmk ?? []) timbang(sk, "pmk");

  return unggul ?? dasarKgb;
}
