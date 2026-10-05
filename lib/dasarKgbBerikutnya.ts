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
// Modul ini murni supaya dipakai bersama oleh dashboard Admin UPT (yang hanya menampilkannya) dan
// pemeriksaan di sisi Kanwil, dengan aturan yang sama dengan isian Atas dasar pada Input KGB.

import { JENIS_KP, isJenisKp } from "./kenaikanPangkat";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

export type JenisDasarKgb = "kgb" | "cpns" | "kp" | "pmk";

export const LABEL_DASAR_KGB: Record<JenisDasarKgb, string> = {
  kgb: "SK KGB terakhir",
  cpns: "SK CPNS",
  kp: "SK kenaikan pangkat",
  pmk: "SK peninjauan masa kerja",
};

/** SK dasar pada Data Pegawai beserta keterangan yang menentukan jenis dan TMT-nya. */
export interface SkDasarPegawaiUntukDasar {
  nomorSkDasar?: string | null;
  tanggalSkDasar?: NilaiTanggal;
  /** TMT KGB terakhir, atau TMT CPNS bagi yang belum pernah KGB: TMT SK dasar itu. */
  tmtKgbTerakhir?: NilaiTanggal;
  mkgTahun?: number | null;
  mkgBulan?: number | null;
}

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

/** SK dasar pada Data Pegawai; null bila nomor maupun tanggalnya belum diisi. */
function dariPegawai(p: SkDasarPegawaiUntukDasar): DasarKgbBerikutnya | null {
  const nomorSK = terisi(p.nomorSkDasar);
  const tanggalSK = iso(p.tanggalSkDasar);
  if (!nomorSK && !tanggalSK) return null;
  // Masa kerja golongan 0 tahun 0 bulan berarti belum pernah KGB: SK dasarnya SK CPNS (lib/usulanPegawai.ts).
  const jenis: JenisDasarKgb = (p.mkgTahun ?? 0) === 0 && (p.mkgBulan ?? 0) === 0 ? "cpns" : "kgb";
  return { jenis, label: LABEL_DASAR_KGB[jenis], nomorSK, tanggalSK, tmt: iso(p.tmtKgbTerakhir) };
}

/**
 * SK yang menjadi dasar KGB berikutnya. SK kenaikan pangkat atau PMK menang bila TMT-nya pada atau sesudah
 * TMT SK KGB terakhir; di antara keduanya, yang TMT-nya paling baru. null bila tidak satu pun diketahui.
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
}): DasarKgbBerikutnya | null {
  const dariRiwayat = dariKgb(input.kgb);
  const dariData = input.pegawai ? dariPegawai(input.pegawai) : null;
  const dataLebihBaru =
    !!dariRiwayat && !!dariData?.tanggalSK && !!dariRiwayat.tanggalSK && dariData.tanggalSK > dariRiwayat.tanggalSK;
  const dasarKgb = !dariRiwayat || dataLebihBaru ? dariData ?? dariRiwayat : dariRiwayat;
  const batasDasar = tanggalKalender(dasarKgb?.tmt);
  const batasPegawai = tanggalKalender(input.pegawai?.tmtKgbTerakhir);
  const batas = batasDasar && batasPegawai ? (batasDasar > batasPegawai ? batasDasar : batasPegawai) : batasDasar ?? batasPegawai;

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
