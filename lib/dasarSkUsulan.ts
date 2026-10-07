// Nilai dasar gaji yang ditentukan SK kenaikan pangkat atau PMK pada sebuah usulan UPT (ADR-030).
//
// Dipakai dua tempat yang harus selalu sama: penerapan saat Kanwil menyetujui (lib/setujuiUsulan.ts), dan
// daftar "Perubahan yang diusulkan" yang dilihat peninjau sebelum memutuskan (app/api/usulan). Tanpa ini,
// peninjau melihat angka mentah usulan, misalnya gaji pokok tanpa potongan masa kerja golongan dan jadwal KGB
// yang bergeser, padahal yang diterapkan adalah hitungan SK-nya (ADR-052).
//
// Hitungan intinya (hitungSkDilaporkan) juga dipakai formulir UPT untuk pratinjau "Dihitung sistem" dan pratinjau SK
// KGB, sehingga yang dilihat UPT sebelum mengajukan sama dengan yang diterapkan Kanwil (ADR-078).

import { hitungKenaikanPangkat, peringkatGolongan, type HasilKenaikanPangkat } from "./kenaikanPangkat";
import { hitungPmk, type HasilPmk } from "./pmk";
import {
  bulanKeKgbBerikutnya,
  getGajiPokok,
  getPangkat,
  hitungMKGKenaikanPangkat,
  isGolonganDikenal,
  selisihBulan,
  tambahBulan,
} from "./tabelGaji";
import { isJenisDasarBaru } from "./dasarBaruUsulan";
import { formatTanggalId, tanggalKalender, type NilaiTanggal } from "./waktu";
import { kunciNomorSk } from "./nomorSurat";
import type { PegawaiRow, RiwayatPangkatRow, RiwayatPmkRow, UsulanPegawaiRow } from "./sheets/tables";

/** Kolom pegawai yang nilainya ditentukan SK, bukan angka yang diketik UPT. */
export const KOLOM_DITENTUKAN_SK = ["golonganRuang", "pangkat", "mkgTahun", "mkgBulan", "gajiPokok", "tmtGolongan", "tmtKgbBerikutnya"] as const;

/** Masa kerja golongan dalam tahun dan bulan. */
export interface MasaKerja {
  tahun: number;
  bulan: number;
}

const pecahBulan = (bulan: number): MasaKerja => ({ tahun: Math.floor(bulan / 12), bulan: bulan % 12 });

/**
 * Keadaan pegawai sebelum SK yang dilaporkan: golongan dan masa kerja golongan pada TMT KGB terakhir, sebagaimana data
 * pegawai menyimpannya, beserta jadwal KGB berikutnya sebelum SK itu.
 */
export interface KeadaanSebelumSk {
  golonganRuang: string;
  mkgTahun: number | null;
  mkgBulan: number | null;
  tmtKgbTerakhir: NilaiTanggal;
  tmtKgbBerikutnya: NilaiTanggal;
}

/** SK kenaikan pangkat atau PMK yang dilaporkan, sebagaimana tertulis pada SK-nya. */
export interface SkDilaporkan {
  jenis: "kp" | "pmk";
  /** Golongan baru menurut SK kenaikan pangkat; PMK tidak mengubah golongan. */
  golonganBaru: string;
  /** Masa kerja golongan pada TMT SK menurut SK-nya. PMK menghitung darinya; kenaikan pangkat hanya mencocokkannya. */
  mkgTahunSk: number;
  mkgBulanSk: number;
  tmt: Date;
}

export type HasilSkDilaporkan =
  | { ok: false; pesan: string }
  | {
      ok: true;
      jenis: "kp" | "pmk";
      /** Keadaan sesudah SK: yang ditulis ke data pegawai, dengan masa kerja pada TMT KGB terakhir. */
      golonganRuang: string;
      pangkat: string;
      mkgTahun: number;
      mkgBulan: number;
      gajiPokok: number;
      tmtKgbBerikutnya: Date | null;
      /**
       * Masa kerja golongan pada TMT SK menurut hitungan sistem: masa kerja pada TMT KGB terakhir ditambah selang sampai
       * TMT SK, dipotong bila pindah jenjang golongan. Itulah angka yang semestinya tertulis pada SK kenaikan pangkat.
       * null bila TMT KGB terakhir tidak diketahui.
       */
      mkgPadaTmtSk: MasaKerja | null;
      kp: HasilKenaikanPangkat | null;
      pmk: HasilPmk | null;
    };

/**
 * Akibat satu SK kenaikan pangkat atau PMK pada keadaan sebelumnya. Kenaikan pangkat memotong masa kerja golongan
 * menurut lompatan golongan dan tidak menggeser jadwal KGB; PMK mempertahankan golongan dan dapat memajukan jadwal.
 */
export function hitungSkDilaporkan(lama: KeadaanSebelumSk, sk: SkDilaporkan): HasilSkDilaporkan {
  const mkgTahunLama = lama.mkgTahun ?? 0;
  const mkgBulanLama = lama.mkgBulan ?? 0;
  const tmtTerakhir = tanggalKalender(lama.tmtKgbTerakhir);

  if (sk.jenis === "kp") {
    const h = hitungKenaikanPangkat({ golonganLama: lama.golonganRuang, mkgTahunLama, mkgBulanLama, golonganBaru: sk.golonganBaru });
    if (!h.ok) return { ok: false, pesan: h.pesan };
    let mkgPadaTmtSk: MasaKerja | null = null;
    if (tmtTerakhir && sk.tmt >= tmtTerakhir) {
      const padaTmt = pecahBulan(mkgTahunLama * 12 + mkgBulanLama + selisihBulan(tmtTerakhir, sk.tmt));
      const potong = hitungMKGKenaikanPangkat(lama.golonganRuang, sk.golonganBaru, padaTmt.tahun, padaTmt.bulan);
      mkgPadaTmtSk = potong ? { tahun: potong.mkgTahun, bulan: potong.mkgBulan } : padaTmt;
    }
    return {
      ok: true,
      jenis: "kp",
      golonganRuang: h.hasil.golonganBaru,
      pangkat: h.hasil.pangkatBaru,
      mkgTahun: h.hasil.mkgTahunBaru,
      mkgBulan: h.hasil.mkgBulanBaru,
      gajiPokok: h.hasil.gajiPokokBaru,
      // Kenaikan pangkat tidak menggeser jadwal KGB (Buku Saku KP 2026).
      tmtKgbBerikutnya: tanggalKalender(lama.tmtKgbBerikutnya),
      mkgPadaTmtSk,
      kp: h.hasil,
      pmk: null,
    };
  }

  const h = hitungPmk({
    golonganRuang: lama.golonganRuang,
    mkgTahun: mkgTahunLama,
    mkgBulan: mkgBulanLama,
    tmtKgbTerakhir: lama.tmtKgbTerakhir,
    tmtPmk: sk.tmt,
    mkgTahunSk: sk.mkgTahunSk,
    mkgBulanSk: sk.mkgBulanSk,
  });
  if (!h.ok) return { ok: false, pesan: h.pesan };
  return {
    ok: true,
    jenis: "pmk",
    golonganRuang: lama.golonganRuang,
    pangkat: getPangkat(lama.golonganRuang),
    mkgTahun: h.hasil.mkgTahunDasar,
    mkgBulan: h.hasil.mkgBulanDasar,
    gajiPokok: h.hasil.gajiPokokBaru,
    tmtKgbBerikutnya: h.hasil.tmtKgbBerikutnyaUsulan,
    mkgPadaTmtSk: h.hasil.mkgSesudahPadaTmt,
    kp: null,
    pmk: h.hasil,
  };
}

/**
 * Cocokkan masa kerja golongan yang tertulis pada SK kenaikan pangkat dengan hitungan sistem. null bila tidak dapat
 * dicocokkan: hitungannya tidak ada, atau masa kerja menurut SK tidak diisi.
 */
export function cocokMkgSk(
  hitungan: MasaKerja | null,
  menurutSk: { tahun: number | null | undefined; bulan: number | null | undefined },
): { cocok: boolean; hitungan: MasaKerja; menurutSk: MasaKerja } | null {
  if (!hitungan || menurutSk.tahun === null || menurutSk.tahun === undefined || Number.isNaN(Number(menurutSk.tahun))) return null;
  const sk = { tahun: Number(menurutSk.tahun), bulan: Number(menurutSk.bulan ?? 0) || 0 };
  return { cocok: sk.tahun * 12 + sk.bulan === hitungan.tahun * 12 + hitungan.bulan, hitungan, menurutSk: sk };
}

export const teksMasaKerja = (m: MasaKerja) => `${m.tahun} tahun ${m.bulan} bulan`;

export type DasarSkUsulan =
  /** Usulan tanpa SK kenaikan pangkat atau PMK yang lengkap: kolomnya ditulis apa adanya. */
  | { berlaku: false }
  | { berlaku: true; jenis: "kp" | "pmk"; ok: false; pesan: string }
  | {
      berlaku: true;
      jenis: "kp" | "pmk";
      ok: true;
      nilai: Partial<PegawaiRow>;
      /** Masa kerja golongan pada TMT SK menurut hitungan sistem (lihat hitungSkDilaporkan). */
      mkgPadaTmtSk: MasaKerja | null;
    };

/**
 * Hitung nilai dasar gaji menurut SK pada usulan, tanpa menulis apa pun. nilaiBaru: kolom yang diisi UPT
 * (perubahanPegawai). Golongan pada usulan kenaikan pangkat adalah golongan barunya, dan masa kerja pada usulan PMK
 * adalah yang tertulis pada SK PMK; keadaan sebelumnya selalu data pegawai yang tercatat.
 */
export function hitungDasarSkUsulan(
  pegawaiLama: PegawaiRow,
  usulan: Partial<UsulanPegawaiRow>,
  nilaiBaru: Partial<PegawaiRow>,
): DasarSkUsulan {
  const jenisSk = usulan.dasarBaruJenis?.trim() ?? "";
  const tanggalSk = tanggalKalender(usulan.dasarBaruTanggalSk);
  const tmtSk = tanggalKalender(usulan.dasarBaruTmt);
  if (!isJenisDasarBaru(jenisSk) || jenisSk === "koreksi" || !tanggalSk || !tmtSk) return { berlaku: false };

  const h = hitungSkDilaporkan(pegawaiLama, {
    jenis: jenisSk,
    golonganBaru: String(nilaiBaru.golonganRuang ?? pegawaiLama.golonganRuang),
    mkgTahunSk: Number(nilaiBaru.mkgTahun ?? pegawaiLama.mkgTahun ?? 0),
    mkgBulanSk: Number(nilaiBaru.mkgBulan ?? pegawaiLama.mkgBulan ?? 0),
    tmt: tmtSk,
  });
  if (!h.ok) return { berlaku: true, jenis: jenisSk, ok: false, pesan: h.pesan };
  if (jenisSk === "kp")
    return {
      berlaku: true, jenis: "kp", ok: true,
      nilai: {
        golonganRuang: h.golonganRuang,
        pangkat: h.pangkat,
        mkgTahun: h.mkgTahun,
        mkgBulan: h.mkgBulan,
        gajiPokok: h.gajiPokok,
        tmtGolongan: tmtSk,
        tmtKgbBerikutnya: pegawaiLama.tmtKgbBerikutnya,
      },
      mkgPadaTmtSk: h.mkgPadaTmtSk,
    };
  return {
    berlaku: true, jenis: "pmk", ok: true,
    nilai: {
      golonganRuang: pegawaiLama.golonganRuang,
      mkgTahun: h.mkgTahun,
      mkgBulan: h.mkgBulan,
      gajiPokok: h.gajiPokok,
      tmtKgbBerikutnya: h.tmtKgbBerikutnya,
    },
    mkgPadaTmtSk: h.mkgPadaTmtSk,
  };
}

/**
 * Usulan sebagaimana akan diterapkan: kolom yang ditentukan SK diganti hitungannya. Bila SK-nya tidak dapat
 * dihitung, usulan dikembalikan apa adanya (persetujuannya sendiri akan ditolak dengan pesan hitungan itu).
 */
export function usulanMenurutSk(
  pegawaiLama: PegawaiRow,
  usulan: UsulanPegawaiRow,
  nilaiBaru: Partial<PegawaiRow>,
  /** SK yang dilaporkan dan sudah tercatat pada riwayat pegawai (cariSkTercatat); null bila belum. */
  tercatat: SkTercatat | null = null,
): UsulanPegawaiRow {
  const rencana = rencanaSkUsulan(pegawaiLama, usulan, nilaiBaru, tercatat);
  const hasil: Record<string, unknown> = { ...usulan };
  // SK yang sudah diterapkan: kolom yang ditentukan SK tidak berubah lagi oleh usulan ini.
  if (rencana.jenis === "sudah") {
    for (const kolom of KOLOM_DITENTUKAN_SK) hasil[kolom] = null;
    return hasil as unknown as UsulanPegawaiRow;
  }
  if (rencana.jenis !== "hitung") return usulan;
  const nilai: Record<string, unknown> = { ...rencana.sk.nilai };
  // Keadaan sebelum SK yang dibetulkan UPT ikut berubah: TMT golongan (PMK) dan jadwal KGB (kenaikan pangkat).
  if (rencana.koreksi) {
    nilai.tmtGolongan ??= rencana.dasar.tmtGolongan;
    nilai.tmtKgbBerikutnya ??= rencana.dasar.tmtKgbBerikutnya;
  }
  for (const kolom of KOLOM_DITENTUKAN_SK) hasil[kolom] = nilai[kolom] ?? null;
  return hasil as unknown as UsulanPegawaiRow;
}

/** Koreksi keadaan sebelum SK yang diajukan UPT bersama SK sesudahnya (ADR-079): [tercatat, dibetulkan]. */
export interface KoreksiDasar {
  golongan: [string, string] | null;
  mkg: [MasaKerja, MasaKerja] | null;
  tmtKgbTerakhir: [Date | null, Date | null] | null;
  tmtGolongan: [Date | null, Date | null] | null;
}

const samaTanggal = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

/**
 * Keadaan sebelum SK yang dipakai menghitung usulan pegawai tercatat (ADR-079). Bawaannya data tercatat. Bila UPT
 * membetulkan golongan, masa kerja golongan, TMT golongan, atau TMT KGB terakhir di bagian atas formulir bersama SK yang
 * dilaporkan, keadaan yang dibetulkan itulah dasarnya; jadwal KGB-nya dihitung ulang dari isian itu bila golongan, masa
 * kerja, atau TMT KGB terakhirnya berubah.
 */
export function dasarSebelumSk(
  pegawaiLama: PegawaiRow,
  usulan: Partial<UsulanPegawaiRow>,
): { pegawai: PegawaiRow; koreksi: KoreksiDasar | null } {
  const jenis = usulan.dasarBaruJenis?.trim();
  const acuan = acuanUsulan(usulan);
  if ((jenis !== "kp" && jenis !== "pmk") || !acuan || acuan.mkgTahun === null || !isGolonganDikenal(acuan.golongan))
    return { pegawai: pegawaiLama, koreksi: null };

  const mkgLama: MasaKerja = { tahun: pegawaiLama.mkgTahun ?? 0, bulan: pegawaiLama.mkgBulan ?? 0 };
  const mkgBaru: MasaKerja = { tahun: acuan.mkgTahun, bulan: acuan.mkgBulan };
  const tmtLama = tanggalKalender(pegawaiLama.tmtKgbTerakhir);
  const tmtBaru = tanggalKalender(usulan.tmtKgbTerakhir) ?? tmtLama;
  const golLama = tanggalKalender(pegawaiLama.tmtGolongan);
  const golBaru = tanggalKalender(usulan.tmtGolongan) ?? golLama;
  const bedaGolongan = acuan.golongan !== pegawaiLama.golonganRuang;
  const bedaMkg = mkgLama.tahun * 12 + mkgLama.bulan !== mkgBaru.tahun * 12 + mkgBaru.bulan;
  const bedaTmt = !samaTanggal(tmtLama, tmtBaru);
  const bedaTmtGolongan = !samaTanggal(golLama, golBaru);
  if (!bedaGolongan && !bedaMkg && !bedaTmt && !bedaTmtGolongan) return { pegawai: pegawaiLama, koreksi: null };

  const jadwalUlang = bedaGolongan || bedaMkg || bedaTmt;
  return {
    pegawai: {
      ...pegawaiLama,
      golonganRuang: acuan.golongan,
      pangkat: getPangkat(acuan.golongan) || pegawaiLama.pangkat,
      mkgTahun: mkgBaru.tahun,
      mkgBulan: mkgBaru.bulan,
      gajiPokok: getGajiPokok(acuan.golongan, mkgBaru.tahun, mkgBaru.bulan),
      tmtKgbTerakhir: tmtBaru,
      tmtGolongan: golBaru,
      tmtKgbBerikutnya:
        jadwalUlang && tmtBaru
          ? tambahBulan(tmtBaru, bulanKeKgbBerikutnya(acuan.golongan, mkgBaru.tahun, mkgBaru.bulan))
          : pegawaiLama.tmtKgbBerikutnya,
    },
    koreksi: {
      golongan: bedaGolongan ? [pegawaiLama.golonganRuang, acuan.golongan] : null,
      mkg: bedaMkg ? [mkgLama, mkgBaru] : null,
      tmtKgbTerakhir: bedaTmt ? [tmtLama, tmtBaru] : null,
      tmtGolongan: bedaTmtGolongan ? [golLama, golBaru] : null,
    },
  };
}

/** Kalimat koreksi keadaan sebelum SK, untuk tinjauan dan jejak audit. */
export function teksKoreksiDasar(k: KoreksiDasar): string {
  const tgl = (d: Date | null) => (d ? formatTanggalId(d) : "-");
  return [
    k.golongan ? `golongan ${k.golongan[0]} → ${k.golongan[1]}` : null,
    k.mkg ? `masa kerja ${teksMasaKerja(k.mkg[0])} → ${teksMasaKerja(k.mkg[1])}` : null,
    k.tmtKgbTerakhir ? `TMT KGB terakhir ${tgl(k.tmtKgbTerakhir[0])} → ${tgl(k.tmtKgbTerakhir[1])}` : null,
    k.tmtGolongan ? `TMT golongan ${tgl(k.tmtGolongan[0])} → ${tgl(k.tmtGolongan[1])}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * SK yang dilaporkan usulan dan sudah tercatat pada riwayat pegawai, dikenali dari nomornya: tercatat oleh percobaan
 * persetujuan yang terputus di tengah jalan, atau dilaporkan ulang (ADR-079).
 */
export interface SkTercatat {
  jenis: "kp" | "pmk";
  id: string;
  tmt: Date | null;
  /** Kenaikan pangkat: golongan sebelum dan sesudahnya menurut riwayat. */
  golonganLama: string | null;
  golonganBaru: string | null;
  /** PMK: masa kerja pada data pegawai sebelum dan sesudah PMK menurut riwayat. */
  mkgDasarLama: MasaKerja | null;
  mkgDasarBaru: MasaKerja | null;
}

export function cariSkTercatat(
  usulan: Partial<UsulanPegawaiRow>,
  riwayat: { pangkat?: readonly RiwayatPangkatRow[]; pmk?: readonly RiwayatPmkRow[] },
): SkTercatat | null {
  const jenis = usulan.dasarBaruJenis?.trim();
  const kunci = kunciNomorSk(usulan.dasarBaruNomorSk);
  if (!kunci || (jenis !== "kp" && jenis !== "pmk")) return null;
  if (jenis === "kp") {
    const r = (riwayat.pangkat ?? []).find((x) => kunciNomorSk(x.nomorSK) === kunci);
    return r
      ? { jenis, id: r.id, tmt: tanggalKalender(r.tmtPangkat), golonganLama: r.golonganLama || null, golonganBaru: r.golonganBaru || null, mkgDasarLama: null, mkgDasarBaru: null }
      : null;
  }
  const r = (riwayat.pmk ?? []).find((x) => kunciNomorSk(x.nomorSK) === kunci);
  return r
    ? {
        jenis,
        id: r.id,
        tmt: tanggalKalender(r.tmtPmk),
        golonganLama: null,
        golonganBaru: null,
        mkgDasarLama: { tahun: r.mkgTahunDasarLama ?? 0, bulan: r.mkgBulanDasarLama ?? 0 },
        mkgDasarBaru: { tahun: r.mkgTahunDasarBaru ?? 0, bulan: r.mkgBulanDasarBaru ?? 0 },
      }
    : null;
}

/**
 * true bila SK yang tercatat sudah ikut mengubah data pegawai. Kenaikan pangkat: golongan pegawai sudah setinggi golongan
 * barunya. PMK: masa kerja pegawai tidak lagi sama dengan masa kerja sebelum PMK. Yang belum berarti pencatatannya
 * terputus sesudah riwayatnya tersimpan.
 */
export function skSudahDiterapkan(sk: SkTercatat, pegawai: Pick<PegawaiRow, "golonganRuang" | "mkgTahun" | "mkgBulan">): boolean {
  if (sk.jenis === "kp") return !!sk.golonganBaru && peringkatGolongan(pegawai.golonganRuang) >= peringkatGolongan(sk.golonganBaru);
  if (!sk.mkgDasarLama || !sk.mkgDasarBaru) return true;
  const sekarang = (pegawai.mkgTahun ?? 0) * 12 + (pegawai.mkgBulan ?? 0);
  const lama = sk.mkgDasarLama.tahun * 12 + sk.mkgDasarLama.bulan;
  const baru = sk.mkgDasarBaru.tahun * 12 + sk.mkgDasarBaru.bulan;
  return !(sekarang === lama && lama !== baru);
}

/** Apa yang terjadi pada SK usulan pegawai tercatat bila disetujui (ADR-030, ADR-078, ADR-079). */
export type RencanaSkUsulan =
  /** Tidak ada SK kenaikan pangkat atau PMK yang lengkap. */
  | { jenis: "tanpa" }
  /** SK-nya sudah tercatat dan sudah mengubah data pegawai; tidak dicatat dan tidak dihitung lagi. */
  | { jenis: "sudah"; tercatat: SkTercatat }
  | { jenis: "galat"; pesan: string }
  /** Hitung dari `dasar`; `tercatat` terisi bila riwayatnya sudah ada dan cukup dilengkapi, bukan dicatat dua kali. */
  | {
      jenis: "hitung";
      dasar: PegawaiRow;
      koreksi: KoreksiDasar | null;
      tercatat: SkTercatat | null;
      sk: Extract<DasarSkUsulan, { ok: true }>;
    };

export function rencanaSkUsulan(
  pegawaiLama: PegawaiRow,
  usulan: Partial<UsulanPegawaiRow>,
  nilaiBaru: Partial<PegawaiRow>,
  tercatat: SkTercatat | null,
): RencanaSkUsulan {
  const jenis = usulan.dasarBaruJenis?.trim();
  if (jenis !== "kp" && jenis !== "pmk") return { jenis: "tanpa" };
  const { pegawai: dasar, koreksi } = dasarSebelumSk(pegawaiLama, usulan);
  if (tercatat && !koreksi && skSudahDiterapkan(tercatat, pegawaiLama)) return { jenis: "sudah", tercatat };
  // SK yang sudah tercatat dihitung dengan TMT pada riwayatnya, yang mungkin sudah dibetulkan Kanwil.
  const sk = hitungDasarSkUsulan(dasar, tercatat?.tmt ? { ...usulan, dasarBaruTmt: tercatat.tmt } : usulan, nilaiBaru);
  if (!sk.berlaku) return { jenis: "tanpa" };
  if (!sk.ok) return { jenis: "galat", pesan: sk.pesan };
  return { jenis: "hitung", dasar, koreksi, tercatat, sk };
}

/**
 * Golongan dan masa kerja golongan pada SK acuan (SK KGB terakhir atau SK CPNS) yang ditulis UPT bersama SK yang
 * dilaporkan (ADR-078); null pada usulan lama yang hanya menyalin golongan dan masa kerja dari SK yang dilaporkan.
 */
export function acuanUsulan(
  usulan: Partial<UsulanPegawaiRow>,
): { golongan: string; mkgTahun: number | null; mkgBulan: number } | null {
  const golongan = usulan.golonganAcuan?.trim() ?? "";
  if (!golongan) return null;
  const tahun = usulan.mkgTahunAcuan;
  return {
    golongan,
    // Kosong berarti belum diisi pada draf, bukan nol tahun.
    mkgTahun: tahun === null || tahun === undefined || Number.isNaN(Number(tahun)) ? null : Number(tahun),
    mkgBulan: Number(usulan.mkgBulanAcuan ?? 0) || 0,
  };
}

/** SK kenaikan pangkat atau PMK pada usulan pegawai baru, dihitung ke keadaan pada TMT KGB terakhir (ADR-065, ADR-078). */
export type SkPegawaiBaru =
  /** Tidak ada SK yang dilaporkan, atau isiannya belum cukup untuk dihitung (kekurangannya ditagih terpisah). */
  | { berlaku: false }
  | { berlaku: true; jenis: "kp" | "pmk"; ok: false; pesan: string }
  | {
      berlaku: true;
      jenis: "kp" | "pmk";
      ok: true;
      /** Masa kerja golongan seperti tertulis pada SK itu, yaitu pada TMT-nya. */
      mkgPadaSk: MasaKerja;
      tmtSk: Date;
      /** Nilai yang ditulis ke data pegawai saat usulan disetujui. */
      nilai: { pangkat: string; mkgTahun: number; mkgBulan: number; gajiPokok: number; tmtKgbBerikutnya: Date };
      /**
       * Keadaan pada SK acuan beserta rincian hitungannya, bila UPT menuliskannya (ADR-078). Tanpa itu masa kerja pada SK
       * dihitung mundur ke TMT KGB terakhir (ADR-065).
       */
      acuan: {
        golongan: string;
        mkgTahun: number;
        mkgBulan: number;
        gajiPokok: number;
        tmtKgbBerikutnya: Date | null;
        /** Masa kerja pada TMT SK menurut hitungan sistem; pembanding masa kerja yang tertulis pada SK kenaikan pangkat. */
        mkgHitunganPadaSk: MasaKerja | null;
        kp: HasilKenaikanPangkat | null;
        pmk: HasilPmk | null;
      } | null;
    };

/**
 * Pegawai baru yang sudah naik pangkat, penyesuaian ijazah, atau PMK sesudah SK KGB terakhir (ADR-065, ADR-078).
 *
 * Golongan dan masa kerja golongan pada kolom utama usulan adalah yang tertulis pada SK terbaru itu; TMT KGB terakhir
 * dan nomor SK tetap dari SK KGB terakhir.
 *
 * Bila UPT juga menuliskan golongan dan masa kerja pada SK KGB terakhir (`golonganAcuan`), hitungannya sama dengan
 * pegawai yang sudah tercatat: kenaikan pangkat memotong masa kerja menurut lompatan golongan dan tidak menggeser jadwal
 * KGB, PMK menambah masa kerja dan dapat memajukan jadwal. Masa kerja yang tertulis pada SK kenaikan pangkat hanya
 * dicocokkan.
 *
 * Tanpa itu (usulan lama), data pegawai menyimpan masa kerja pada TMT KGB terakhir, jadi masa kerja pada SK dihitung
 * mundur sebanyak selang TMT KGB terakhir sampai TMT SK. Potongan masa kerja karena naik jenjang golongan sudah termuat
 * pada SK kenaikan pangkat, sehingga tidak dipotong lagi.
 */
export function hitungSkPegawaiBaru(usulan: Partial<UsulanPegawaiRow>): SkPegawaiBaru {
  const jenis = usulan.dasarBaruJenis?.trim() ?? "";
  const tmtSk = tanggalKalender(usulan.dasarBaruTmt);
  const tmtTerakhir = tanggalKalender(usulan.tmtKgbTerakhir);
  const golongan = String(usulan.golonganRuang ?? "").trim();
  if ((jenis !== "kp" && jenis !== "pmk") || !tmtSk || !tmtTerakhir || !isGolonganDikenal(golongan)) return { berlaku: false };
  if (tmtSk < tmtTerakhir)
    return { berlaku: true, jenis, ok: false, pesan: "TMT SK yang dilaporkan, yang harus sesudah TMT KGB terakhir" };

  const padaSk = Number(usulan.mkgTahun ?? 0) * 12 + Number(usulan.mkgBulan ?? 0);
  const sk = pecahBulan(padaSk);

  const isiAcuan = acuanUsulan(usulan);
  if (isiAcuan) {
    if (!isGolonganDikenal(isiAcuan.golongan)) return { berlaku: true, jenis, ok: false, pesan: "golongan pada SK KGB terakhir" };
    if (isiAcuan.mkgTahun === null) return { berlaku: true, jenis, ok: false, pesan: "masa kerja golongan pada SK KGB terakhir" };
    const acuan = { ...isiAcuan, mkgTahun: isiAcuan.mkgTahun };
    const gajiAcuan = getGajiPokok(acuan.golongan, acuan.mkgTahun, acuan.mkgBulan);
    const tmtBerikutAcuan = tambahBulan(tmtTerakhir, bulanKeKgbBerikutnya(acuan.golongan, acuan.mkgTahun, acuan.mkgBulan));
    const h = hitungSkDilaporkan(
      { golonganRuang: acuan.golongan, mkgTahun: acuan.mkgTahun, mkgBulan: acuan.mkgBulan, tmtKgbTerakhir: tmtTerakhir, tmtKgbBerikutnya: tmtBerikutAcuan },
      { jenis, golonganBaru: golongan, mkgTahunSk: sk.tahun, mkgBulanSk: sk.bulan, tmt: tmtSk },
    );
    if (!h.ok)
      return {
        berlaku: true,
        jenis,
        ok: false,
        pesan:
          jenis === "kp"
            ? `golongan baru menurut SK kenaikan pangkat (${h.pesan.replace(/\.$/, "").toLowerCase()})`
            : `masa kerja golongan menurut SK PMK (${h.pesan.replace(/\.$/, "")})`,
      };
    return {
      berlaku: true,
      jenis,
      ok: true,
      mkgPadaSk: sk,
      tmtSk,
      nilai: {
        pangkat: h.pangkat,
        mkgTahun: h.mkgTahun,
        mkgBulan: h.mkgBulan,
        gajiPokok: h.gajiPokok,
        tmtKgbBerikutnya: h.tmtKgbBerikutnya ?? tmtBerikutAcuan,
      },
      acuan: {
        golongan: acuan.golongan,
        mkgTahun: acuan.mkgTahun,
        mkgBulan: acuan.mkgBulan,
        gajiPokok: gajiAcuan,
        tmtKgbBerikutnya: tmtBerikutAcuan,
        mkgHitunganPadaSk: h.jenis === "kp" ? h.mkgPadaTmtSk : null,
        kp: h.kp,
        pmk: h.pmk,
      },
    };
  }

  const selang = selisihBulan(tmtTerakhir, tmtSk);
  const dasar = padaSk - selang;
  if (dasar < 0)
    return {
      berlaku: true,
      jenis,
      ok: false,
      pesan: `masa kerja golongan menurut SK yang dilaporkan (paling sedikit ${Math.floor(selang / 12)} tahun ${selang % 12} bulan, selang sejak TMT KGB terakhir)`,
    };

  const d = pecahBulan(dasar);
  return {
    berlaku: true,
    jenis,
    ok: true,
    mkgPadaSk: sk,
    tmtSk,
    nilai:
      jenis === "kp"
        ? {
            pangkat: getPangkat(golongan),
            mkgTahun: d.tahun,
            mkgBulan: d.bulan,
            gajiPokok: getGajiPokok(golongan, d.tahun, d.bulan),
            tmtKgbBerikutnya: tambahBulan(tmtTerakhir, bulanKeKgbBerikutnya(golongan, d.tahun, d.bulan)),
          }
        : {
            pangkat: getPangkat(golongan),
            mkgTahun: d.tahun,
            mkgBulan: d.bulan,
            gajiPokok: getGajiPokok(golongan, sk.tahun, sk.bulan),
            tmtKgbBerikutnya: tambahBulan(tmtSk, bulanKeKgbBerikutnya(golongan, sk.tahun, sk.bulan)),
          },
    acuan: null,
  };
}

/**
 * Usulan pegawai baru sebagaimana akan diterapkan: masa kerja golongan, gaji pokok, dan jadwal KGB menurut hitungan
 * SK sesudah SK KGB terakhir. Tanpa SK, atau bila SK-nya tidak dapat dihitung, usulan dikembalikan apa adanya.
 */
export function usulanBaruMenurutSk<T extends Partial<UsulanPegawaiRow>>(usulan: T): T {
  const sk = hitungSkPegawaiBaru(usulan);
  if (!sk.berlaku || !sk.ok) return usulan;
  return { ...usulan, ...sk.nilai };
}

/**
 * Catatan untuk peninjau Kanwil tentang SK yang dilaporkan: keadaan pada SK acuan, masa kerja yang tertulis pada SK,
 * dan apakah cocok dengan hitungan sistem (ADR-078). null bila tidak ada yang perlu dicatat.
 */
export function catatanSkDilaporkan(
  usulan: UsulanPegawaiRow,
  pegawai: PegawaiRow | null | undefined,
  /** SK yang dilaporkan dan sudah tercatat pada riwayat pegawai (ADR-079). */
  tercatat: SkTercatat | null = null,
): string | null {
  const jenis = usulan.dasarBaruJenis?.trim();
  if (jenis !== "kp" && jenis !== "pmk") return null;
  const acuan = acuanUsulan(usulan);
  const label = jenis === "kp" ? "SK kenaikan pangkat" : "SK PMK";

  if (usulan.jenis === "baru") {
    const sk = hitungSkPegawaiBaru(usulan);
    if (!sk.berlaku) return null;
    if (!sk.ok) return `SK ini belum dapat dihitung: periksa ${sk.pesan}.`;
    const tmt = formatTanggalId(sk.tmtSk);
    if (!sk.acuan)
      return (
        `Masa kerja golongan pada SK ini ${teksMasaKerja(sk.mkgPadaSk)} (TMT ${tmt}), disalin UPT apa adanya. ` +
        `Data di atas sudah dihitung mundur ke TMT KGB terakhir: ${sk.nilai.mkgTahun} tahun ${sk.nilai.mkgBulan} bulan.`
      );
    const awal = `Pada SK KGB terakhir: ${sk.acuan.golongan}, ${sk.acuan.mkgTahun} tahun ${sk.acuan.mkgBulan} bulan. `;
    if (jenis === "pmk") return `${awal}Menurut ${label} TMT ${tmt}: ${teksMasaKerja(sk.mkgPadaSk)}.`;
    const cek = cocokMkgSk(sk.acuan.mkgHitunganPadaSk, sk.mkgPadaSk);
    return awal + teksCocok(label, tmt, cek);
  }

  // Pegawai tercatat: masa kerja menurut SK kenaikan pangkat baru ikut tersimpan sejak ADR-078, ditandai golongan acuan.
  if (!pegawai) return null;
  const rencana = rencanaSkUsulan(pegawai, usulan, perubahanDariUsulan(usulan), tercatat);
  const bagian: string[] = [];
  if (rencana.jenis === "hitung" && rencana.koreksi)
    bagian.push(`UPT juga membetulkan keadaan sebelum SK: ${teksKoreksiDasar(rencana.koreksi)}. SK dihitung dari keadaan yang dibetulkan itu.`);
  if (tercatat)
    bagian.push(
      rencana.jenis === "sudah"
        ? `${label} ini sudah tercatat dan sudah diterapkan pada data pegawai; persetujuan tidak mencatatnya lagi.`
        : rencana.jenis === "hitung" && rencana.koreksi
          ? `${label} ini sudah tercatat pada riwayat; persetujuan menghitung ulang riwayat itu dari keadaan yang dibetulkan, tanpa mencatatnya dua kali.`
          : `${label} ini sudah tercatat pada riwayat, tetapi data pegawainya belum ikut berubah (penerapan sebelumnya terputus). Persetujuan melengkapinya tanpa mencatat dua kali.`,
    );
  if (acuan && jenis === "kp" && rencana.jenis === "hitung") {
    const cek = cocokMkgSk(rencana.sk.mkgPadaTmtSk, { tahun: usulan.mkgTahun, bulan: usulan.mkgBulan });
    bagian.push(teksCocok(label, formatTanggalId(rencana.tercatat?.tmt ?? usulan.dasarBaruTmt), cek));
  }
  return bagian.length > 0 ? bagian.join(" ") : null;
}

function teksCocok(label: string, tmt: string, cek: ReturnType<typeof cocokMkgSk>): string {
  if (!cek) return `Masa kerja golongan menurut ${label} TMT ${tmt} tidak diisi UPT, jadi belum dicocokkan dengan hitungan sistem.`;
  return cek.cocok
    ? `Masa kerja golongan menurut ${label} TMT ${tmt} ${teksMasaKerja(cek.menurutSk)}, sesuai hitungan sistem.`
    : `Perhatian: masa kerja golongan menurut ${label} TMT ${tmt} ${teksMasaKerja(cek.menurutSk)}, sedangkan hitungan sistem ` +
        `${teksMasaKerja(cek.hitungan)}. Cocokkan dengan pindaian SK sebelum menyetujui.`;
}

/** Golongan dan masa kerja yang diisi UPT pada usulan; sisanya tidak dipakai hitungan SK. */
function perubahanDariUsulan(usulan: Partial<UsulanPegawaiRow>): Partial<PegawaiRow> {
  const hasil: Partial<PegawaiRow> = {};
  if (usulan.golonganRuang) hasil.golonganRuang = usulan.golonganRuang;
  if (usulan.mkgTahun !== null && usulan.mkgTahun !== undefined) hasil.mkgTahun = usulan.mkgTahun;
  if (usulan.mkgBulan !== null && usulan.mkgBulan !== undefined) hasil.mkgBulan = usulan.mkgBulan;
  return hasil;
}

/**
 * Masa kerja golongan pada TMT SK kenaikan pangkat atau PMK yang tercatat sesudah KGB terakhir: angka yang tertulis pada
 * SK itu. Data pegawai menyimpan masa kerja pada TMT KGB terakhir (dasar hitungan, sudah dipotong bila pangkatnya pindah
 * jenjang), jadi keduanya berbeda sebanyak selang kedua TMT (ADR-078). null bila dasarnya bukan SK seperti itu.
 */
export function mkgPadaSkTercatat(
  data: { mkgTahun?: string | number | null; mkgBulan?: string | number | null; tmtKgbTerakhir?: NilaiTanggal },
  dasar: { jenis: string; tmt: NilaiTanggal } | null | undefined,
): { mkg: MasaKerja; tmt: Date; jenis: "kp" | "pmk" } | null {
  if (!dasar || (dasar.jenis !== "kp" && dasar.jenis !== "pmk")) return null;
  const tmtSk = tanggalKalender(dasar.tmt);
  const tmtTerakhir = tanggalKalender(data.tmtKgbTerakhir);
  if (!tmtSk || !tmtTerakhir || tmtSk <= tmtTerakhir) return null;
  const angka = (n: string | number | null | undefined) => Math.max(0, Math.floor(Number(n ?? 0) || 0));
  const pada = angka(data.mkgTahun) * 12 + angka(data.mkgBulan) + selisihBulan(tmtTerakhir, tmtSk);
  return { mkg: pecahBulan(pada), tmt: tmtSk, jenis: dasar.jenis };
}
