// Nilai dasar gaji yang ditentukan SK kenaikan pangkat atau PMK pada sebuah usulan UPT (ADR-030).
//
// Dipakai dua tempat yang harus selalu sama: penerapan saat Kanwil menyetujui (lib/setujuiUsulan.ts), dan
// daftar "Perubahan yang diusulkan" yang dilihat peninjau sebelum memutuskan (app/api/usulan). Tanpa ini,
// peninjau melihat angka mentah usulan, misalnya gaji pokok tanpa potongan masa kerja golongan dan jadwal KGB
// yang bergeser, padahal yang diterapkan adalah hitungan SK-nya (ADR-052).

import { hitungKenaikanPangkat } from "./kenaikanPangkat";
import { hitungPmk } from "./pmk";
import { bulanKeKgbBerikutnya, getGajiPokok, getPangkat, isGolonganDikenal, selisihBulan, tambahBulan } from "./tabelGaji";
import { isJenisDasarBaru } from "./dasarBaruUsulan";
import { tanggalKalender } from "./waktu";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

/** Kolom pegawai yang nilainya ditentukan SK, bukan angka yang diketik UPT. */
export const KOLOM_DITENTUKAN_SK = ["golonganRuang", "pangkat", "mkgTahun", "mkgBulan", "gajiPokok", "tmtGolongan", "tmtKgbBerikutnya"] as const;

export type DasarSkUsulan =
  /** Usulan tanpa SK kenaikan pangkat atau PMK yang lengkap: kolomnya ditulis apa adanya. */
  | { berlaku: false }
  | { berlaku: true; jenis: "kp" | "pmk"; ok: false; pesan: string }
  | { berlaku: true; jenis: "kp" | "pmk"; ok: true; nilai: Partial<PegawaiRow> };

/**
 * Hitung nilai dasar gaji menurut SK pada usulan, tanpa menulis apa pun. nilaiBaru: kolom yang diisi UPT
 * (perubahanPegawai). Kenaikan pangkat memotong masa kerja golongan menurut lompatan golongan dan tidak
 * menggeser jadwal KGB; PMK mempertahankan golongan dan dapat memajukan jadwal.
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

  if (jenisSk === "kp") {
    const h = hitungKenaikanPangkat({
      golonganLama: pegawaiLama.golonganRuang,
      mkgTahunLama: pegawaiLama.mkgTahun ?? 0,
      mkgBulanLama: pegawaiLama.mkgBulan ?? 0,
      golonganBaru: String(nilaiBaru.golonganRuang ?? pegawaiLama.golonganRuang),
    });
    if (!h.ok) return { berlaku: true, jenis: "kp", ok: false, pesan: h.pesan };
    return {
      berlaku: true, jenis: "kp", ok: true,
      nilai: {
        golonganRuang: h.hasil.golonganBaru,
        pangkat: h.hasil.pangkatBaru,
        mkgTahun: h.hasil.mkgTahunBaru,
        mkgBulan: h.hasil.mkgBulanBaru,
        gajiPokok: h.hasil.gajiPokokBaru,
        tmtGolongan: tmtSk,
        // Kenaikan pangkat tidak menggeser jadwal KGB (Buku Saku KP 2026).
        tmtKgbBerikutnya: pegawaiLama.tmtKgbBerikutnya,
      },
    };
  }

  const h = hitungPmk({
    golonganRuang: pegawaiLama.golonganRuang,
    mkgTahun: pegawaiLama.mkgTahun ?? 0,
    mkgBulan: pegawaiLama.mkgBulan ?? 0,
    tmtKgbTerakhir: pegawaiLama.tmtKgbTerakhir,
    tmtPmk: tmtSk,
    mkgTahunSk: Number(nilaiBaru.mkgTahun ?? pegawaiLama.mkgTahun ?? 0),
    mkgBulanSk: Number(nilaiBaru.mkgBulan ?? pegawaiLama.mkgBulan ?? 0),
  });
  if (!h.ok) return { berlaku: true, jenis: "pmk", ok: false, pesan: h.pesan };
  return {
    berlaku: true, jenis: "pmk", ok: true,
    nilai: {
      golonganRuang: pegawaiLama.golonganRuang,
      mkgTahun: h.hasil.mkgTahunDasar,
      mkgBulan: h.hasil.mkgBulanDasar,
      gajiPokok: h.hasil.gajiPokokBaru,
      tmtKgbBerikutnya: h.hasil.tmtKgbBerikutnyaUsulan,
    },
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
): UsulanPegawaiRow {
  const sk = hitungDasarSkUsulan(pegawaiLama, usulan, nilaiBaru);
  if (!sk.berlaku || !sk.ok) return usulan;
  const hasil: Record<string, unknown> = { ...usulan };
  for (const kolom of KOLOM_DITENTUKAN_SK) hasil[kolom] = (sk.nilai as Record<string, unknown>)[kolom] ?? null;
  return hasil as unknown as UsulanPegawaiRow;
}

/** SK kenaikan pangkat atau PMK pada usulan pegawai baru, dihitung ke keadaan pada TMT KGB terakhir (ADR-065). */
export type SkPegawaiBaru =
  /** Tidak ada SK yang dilaporkan, atau isiannya belum cukup untuk dihitung (kekurangannya ditagih terpisah). */
  | { berlaku: false }
  | { berlaku: true; jenis: "kp" | "pmk"; ok: false; pesan: string }
  | {
      berlaku: true;
      jenis: "kp" | "pmk";
      ok: true;
      /** Masa kerja golongan seperti tertulis pada SK itu, yaitu pada TMT-nya. */
      mkgPadaSk: { tahun: number; bulan: number };
      tmtSk: Date;
      /** Nilai yang ditulis ke data pegawai saat usulan disetujui. */
      nilai: { pangkat: string; mkgTahun: number; mkgBulan: number; gajiPokok: number; tmtKgbBerikutnya: Date };
    };

/**
 * Pegawai baru yang sudah naik pangkat, penyesuaian ijazah, atau PMK sesudah SK KGB terakhir (ADR-065).
 *
 * UPT menyalin golongan dan masa kerja golongan dari SK terbaru itu apa adanya, sedangkan TMT KGB terakhir dan
 * nomor SK tetap dari SK KGB terakhir. Data pegawai menyimpan masa kerja pada TMT KGB terakhir, jadi masa kerja
 * pada SK dihitung mundur sebanyak selang TMT KGB terakhir sampai TMT SK. Potongan masa kerja karena naik jenjang
 * golongan sudah termuat pada SK kenaikan pangkat, sehingga tidak dipotong lagi.
 *
 * Gaji pokok dan jadwalnya mengikuti hitungan pegawai lama: kenaikan pangkat tidak menggeser jadwal KGB
 * (hitungDasarSkUsulan), sedangkan PMK menghitung KGB berikutnya dari TMT PMK (lib/pmk.ts).
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
  const selang = selisihBulan(tmtTerakhir, tmtSk);
  const dasar = padaSk - selang;
  if (dasar < 0)
    return {
      berlaku: true,
      jenis,
      ok: false,
      pesan: `masa kerja golongan menurut SK yang dilaporkan (paling sedikit ${Math.floor(selang / 12)} tahun ${selang % 12} bulan, selang sejak TMT KGB terakhir)`,
    };

  const sk = { tahun: Math.floor(padaSk / 12), bulan: padaSk % 12 };
  const d = { tahun: Math.floor(dasar / 12), bulan: dasar % 12 };
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
