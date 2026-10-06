// Laporan SK kenaikan pangkat, penyesuaian ijazah, dan PMK oleh Admin UPT (ADR-045, ADR-074).
//
// Dipakai bersama kartu "Laporkan kenaikan pangkat/PMK" per pegawai dan halaman Lapor KP/PI/PMK massal, supaya
// hitungan pratinjau, daftar kekurangan, dan peringatan dampaknya persis sama di keduanya. Hitungannya memakai fungsi
// yang sama dengan yang dijalankan Kanwil saat menyetujui, jadi yang terlihat di sini bukan taksiran.
//
// Murni: tanpa React, tanpa jaringan.

import { hitungKenaikanPangkat } from "./kenaikanPangkat";
import { hitungPmk } from "./pmk";
import { formatTanggalId } from "./waktu";

export type JenisLaporSk = "kp" | "pmk";

/** Isian satu laporan SK; semuanya teks karena berasal dari kolom isian. */
export interface IsianLaporSk {
  jenis: JenisLaporSk;
  /** Hanya kenaikan pangkat. */
  jenisKp: string;
  golonganBaru: string;
  /** Hanya PMK: masa kerja golongan pada TMT PMK, sebagaimana tertulis pada SK. */
  mkgTahunSk: string;
  mkgBulanSk: string;
  nomorSk: string;
  tanggalSk: string;
  tmt: string;
  penetap: string;
}

/** Keadaan pegawai yang dibutuhkan hitungan: golongan, masa kerja, dan TMT KGB terakhir yang tercatat. */
export interface KeadaanTercatat {
  golongan: string;
  mkgTahun: number;
  mkgBulan: number;
  tmtKgbTerakhir: string;
}

/** Pratayang akibat SK: baris siap tampil, atau sebab mengapa belum dapat dihitung. */
export type PratayangLaporSk =
  | { ok: true; baris: [string, string][]; catatan: string }
  | { ok: false; galat: string }
  | null;

/** Angka dari isian teks; kosong dibaca nol, sebab masa kerja 0 tahun adalah nilai yang sah. */
export function angkaLapor(teks: string | null | undefined): number {
  const n = Number((teks ?? "").replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);

/**
 * Gaji pokok hasil hitungan. Nol berarti golongan itu tidak punya langkah pada masa kerja tersebut di tabel PP 5/2024,
 * dan itu tanda data yang tidak cocok (golongan baru atau masa kerja tercatat keliru), bukan gaji sebesar nol.
 */
const tampilGaji = (n: number) => (n > 0 ? rupiah(n) : "Tidak ada di tabel");
const peringatanGaji = (golongan: string, n: number) =>
  n > 0
    ? ""
    : `Perhatian: masa kerja hasil hitungan belum ada di tabel gaji PP 5/2024 untuk golongan ${golongan}, jadi gaji pokoknya tidak dapat ditentukan. Periksa golongan baru dan masa kerja yang tercatat. `;
export const teksMasaKerja = (tahun: number, bulan: number) => `${tahun} thn ${bulan} bln`;

/** Pratayang akibat SK ini; null selama isiannya belum cukup untuk dihitung. */
export function pratayangLaporSk(sekarang: KeadaanTercatat, isian: IsianLaporSk): PratayangLaporSk {
  if (isian.jenis === "kp") {
    if (!isian.golonganBaru) return null;
    const h = hitungKenaikanPangkat({
      golonganLama: sekarang.golongan,
      mkgTahunLama: sekarang.mkgTahun,
      mkgBulanLama: sekarang.mkgBulan,
      golonganBaru: isian.golonganBaru,
    });
    if (!h.ok) return { ok: false, galat: h.pesan };
    return {
      ok: true,
      baris: [
        ["Pangkat", `${h.hasil.pangkatBaru} (${h.hasil.golonganBaru})`],
        [
          "Masa kerja golongan",
          `${teksMasaKerja(sekarang.mkgTahun, sekarang.mkgBulan)} → ${teksMasaKerja(h.hasil.mkgTahunBaru, h.hasil.mkgBulanBaru)}`,
        ],
        ["Gaji pokok", tampilGaji(h.hasil.gajiPokokBaru)],
      ],
      catatan:
        peringatanGaji(h.hasil.golonganBaru, h.hasil.gajiPokokBaru) +
        (h.hasil.potonganMkgTahun > 0
          ? `Masa kerja golongan dipotong ${h.hasil.potonganMkgTahun} tahun karena pindah jenjang golongan. Jadwal KGB berikutnya tidak bergeser oleh kenaikan pangkat.`
          : "Jadwal KGB berikutnya tidak bergeser oleh kenaikan pangkat."),
    };
  }
  if (!isian.mkgTahunSk && !isian.mkgBulanSk) return null;
  const h = hitungPmk({
    golonganRuang: sekarang.golongan,
    mkgTahun: sekarang.mkgTahun,
    mkgBulan: sekarang.mkgBulan,
    tmtKgbTerakhir: sekarang.tmtKgbTerakhir,
    tmtPmk: isian.tmt,
    mkgTahunSk: angkaLapor(isian.mkgTahunSk),
    mkgBulanSk: angkaLapor(isian.mkgBulanSk),
  });
  if (!h.ok) return { ok: false, galat: h.pesan };
  return {
    ok: true,
    baris: [
      [
        "Masa kerja golongan",
        `${teksMasaKerja(sekarang.mkgTahun, sekarang.mkgBulan)} → ${teksMasaKerja(h.hasil.mkgTahunDasar, h.hasil.mkgBulanDasar)}`,
      ],
      ["Gaji pokok", tampilGaji(h.hasil.gajiPokokBaru)],
      ["KGB berikutnya", formatTanggalId(h.hasil.tmtKgbBerikutnyaUsulan)],
    ],
    catatan:
      peringatanGaji(sekarang.golongan, h.hasil.gajiPokokBaru) +
      `Tambahan masa kerja ${h.hasil.tambahBulan} bulan. Kanwil dapat mengoreksi TMT KGB berikutnya sesuai SK.`,
  };
}

/** Isian yang masih kurang sebelum laporan boleh disimpan atau dikirim; kosong berarti lengkap. */
export function kekuranganLaporSk(isian: IsianLaporSk): string[] {
  const label = isian.jenis === "kp" ? "SK kenaikan pangkat" : "SK peninjauan masa kerja";
  const perlu: string[] = [];
  if (isian.jenis === "kp" && !isian.golonganBaru) perlu.push("golongan baru menurut SK");
  if (isian.jenis === "pmk" && !isian.mkgTahunSk && !isian.mkgBulanSk) perlu.push("masa kerja golongan menurut SK PMK");
  if (!isian.nomorSk.trim()) perlu.push(`nomor ${label}`);
  if (!isian.tanggalSk) perlu.push("tanggal SK");
  if (!isian.tmt) perlu.push(isian.jenis === "kp" ? "TMT pangkat" : "TMT PMK");
  return perlu;
}

export interface PeringatanDampak {
  /** merah: laporan tertahan sampai Kanwil bertindak; kuning: laporan diterapkan, ada pekerjaan ulang di Kanwil. */
  nada: "merah" | "kuning";
  teks: string;
}

/**
 * Dampak laporan SK terhadap KGB pegawai yang sedang berjalan di Kanwil (lib/sesuaikanKgbUsulan.ts). Laporan ini
 * mengubah golongan atau masa kerja, jadi:
 * - KGB yang sedang diproses dihitung ulang saat disetujui, dan SK yang sudah dibuat dibuat ulang oleh Tim SDM;
 * - KGB yang SK-nya sudah ditandatangani dan diunggah tidak dapat diubah, jadi persetujuannya ditolak sampai Kanwil
 *   membatalkan KGB itu atau mengembalikan laporannya.
 * UPT tidak dapat membatalkan KGB itu sendiri; yang dapat dilakukannya hanya mengabari Tim SDM lebih dulu.
 */
export function peringatanDampakKgb(
  statusKgb: string | null | undefined,
  tmtKgb: string | null | undefined,
): PeringatanDampak | null {
  const tmt = tmtKgb ? ` TMT ${formatTanggalId(tmtKgb)}` : "";
  if (statusKgb === "sedang_diproses")
    return {
      nada: "kuning",
      teks:
        `KGB${tmt} sedang diproses Kanwil. Bila laporan ini disetujui, hitungannya diperbarui dan SK yang sudah dibuat ` +
        "perlu dibuat ulang oleh Tim SDM.",
    };
  if (statusKgb === "menunggu_keuangan")
    return {
      nada: "merah",
      teks:
        `SK KGB${tmt} sudah ditandatangani dan diunggah, sehingga golongan dan masa kerjanya tidak dapat diubah lagi. ` +
        "Laporan ini baru dapat diterapkan setelah Tim SDM Kanwil membatalkan KGB itu; hubungi mereka lebih dulu agar tidak tertahan.",
    };
  return null;
}
