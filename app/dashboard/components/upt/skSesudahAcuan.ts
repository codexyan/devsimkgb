// SK sesudah SK KGB terakhir pada formulir UPT (ADR-065), dipakai bersama formulir perorangan dan Usul KGB Kolektif.
//
// SK KGB terakhir (atau SK CPNS) tetap acuan jadwal KGB. SK kenaikan pangkat, penyesuaian ijazah, atau PMK yang
// terbit sesudahnya dilaporkan lewat satu pertanyaan wajib, dan SK paling baru di antara keduanya menjadi Atas
// dasar SK KGB berikutnya (ADR-020).

import { TANPA_SK_BARU } from "@/lib/dasarBaruUsulan";
import { hitungSkPegawaiBaru } from "@/lib/dasarSkUsulan";
import { hitungUsulan, type HitunganUsulan } from "@/lib/usulanPegawai";
import type { PratinjauAtasDasar } from "@/lib/linimasaDasarSk";
import { formatTanggalId, tanggalKalender } from "@/lib/waktu";

export interface IsianSkBaru {
  jenis: string;
  jenisKp: string;
  nomorSk: string;
  tanggalSk: string;
  tmt: string;
  penetap: string;
}

/**
 * Isian SK setelah UPT menjawab pertanyaannya. Ada: buka isian SK, bawaannya kenaikan pangkat. Tidak ada: isian SK
 * dikosongkan, kecuali sebab koreksi salah ketik yang memang tidak membawa SK.
 */
export function jawabSkBaru<T extends IsianSkBaru>(dasar: T, ada: boolean): T {
  if (ada) return dasar.jenis === "kp" || dasar.jenis === "pmk" ? dasar : { ...dasar, jenis: "kp" };
  if (dasar.jenis === "koreksi") return dasar;
  return { ...dasar, jenis: TANPA_SK_BARU, nomorSk: "", tanggalSk: "", tmt: "", penetap: "" };
}

/**
 * Gaji pokok dan jadwal yang tampil di formulir. Pada pegawai baru yang melaporkan SK, golongan dan masa kerjanya
 * disalin dari SK itu, jadi hitungannya lewat masa kerja pada TMT KGB terakhir, sama dengan yang diterapkan saat
 * Kanwil menyetujui (lib/dasarSkUsulan.ts). Pegawai yang sudah tercatat dihitung ulang Kanwil dari data tercatat.
 */
export function hitungFormulirUsulan(
  isian: { golonganRuang: string; mkgTahun: string; mkgBulan: string; tmtKgbTerakhir: string },
  baru: boolean,
  dasar: Pick<IsianSkBaru, "jenis" | "tmt">,
): HitunganUsulan {
  const biasa = hitungUsulan({
    golonganRuang: isian.golonganRuang,
    mkgTahun: isian.mkgTahun,
    mkgBulan: isian.mkgBulan,
    tmtKgbTerakhir: isian.tmtKgbTerakhir || null,
  });
  if (!baru) return biasa;
  const sk = hitungSkPegawaiBaru({
    golonganRuang: isian.golonganRuang,
    mkgTahun: Number(isian.mkgTahun || 0),
    mkgBulan: Number(isian.mkgBulan || 0),
    tmtKgbTerakhir: tanggalKalender(isian.tmtKgbTerakhir),
    dasarBaruJenis: dasar.jenis,
    dasarBaruTmt: tanggalKalender(dasar.tmt),
  });
  if (!sk.berlaku) return biasa;
  if (!sk.ok) return { ...biasa, gajiPokok: 0, tmtKgbBerikutnya: null, penjelasan: "", peringatan: [`Periksa ${sk.pesan}.`] };
  const n = sk.nilai;
  return {
    ...biasa,
    gajiPokok: n.gajiPokok,
    tmtKgbBerikutnya: n.tmtKgbBerikutnya,
    peringatan: n.gajiPokok > 0 ? [] : biasa.peringatan,
    penjelasan:
      `Masa kerja pada SK yang dilaporkan ${sk.mkgPadaSk.tahun} tahun ${sk.mkgPadaSk.bulan} bulan (TMT ${formatTanggalId(sk.tmtSk)}), ` +
      `dihitung mundur ke TMT KGB terakhir menjadi ${n.mkgTahun} tahun ${n.mkgBulan} bulan. ` +
      `KGB berikutnya ${formatTanggalId(n.tmtKgbBerikutnya)}.`,
  };
}

/** Kalimat asal pratinjau Atas dasar. */
export function asalAtasDasar(p: PratinjauAtasDasar, skAcuan: string): string {
  if (p.asal === "laporan") return "Dari SK yang Anda laporkan; berlaku setelah usulan disetujui Kanwil.";
  if (p.asal === "tercatat") return "Sudah tercatat di SIM-KGB, jadi tidak perlu dilaporkan lagi.";
  return `${skAcuan} pada isian di atas.`;
}

/** Satu baris Atas dasar: label, nomor, dan TMT. */
export function teksAtasDasar(p: PratinjauAtasDasar): string {
  return `${p.label}${p.nomorSK ? ` ${p.nomorSK}` : ""}${p.tmt ? `, TMT ${formatTanggalId(p.tmt)}` : ""}`;
}
