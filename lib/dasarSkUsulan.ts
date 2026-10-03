// Nilai dasar gaji yang ditentukan SK kenaikan pangkat atau PMK pada sebuah usulan UPT (ADR-030).
//
// Dipakai dua tempat yang harus selalu sama: penerapan saat Kanwil menyetujui (lib/setujuiUsulan.ts), dan
// daftar "Perubahan yang diusulkan" yang dilihat peninjau sebelum memutuskan (app/api/usulan). Tanpa ini,
// peninjau melihat angka mentah usulan, misalnya gaji pokok tanpa potongan masa kerja golongan dan jadwal KGB
// yang bergeser, padahal yang diterapkan adalah hitungan SK-nya (ADR-052).

import { hitungKenaikanPangkat } from "./kenaikanPangkat";
import { hitungPmk } from "./pmk";
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
