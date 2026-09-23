// Kenaikan pangkat (KP) dan dampaknya pada KGB. Modul ini murni agar aturannya dapat diuji.
//
// Rujukan: Buku Saku Kenaikan Pangkat 2026 (Biro SDMA ORTALA Kementerian Imigrasi dan Pemasyarakatan),
// PP 99/2000 jo. PP 12/2002, dan tabel gaji PP 5/2024 (lib/tabelGaji.ts).
//
// Yang menyentuh KGB: saat pangkat naik melewati jenjang golongan, masa kerja golongan (MKG) dipotong
// (I/x → II/a dikurangi 6 tahun, II/x → III/a dikurangi 5 tahun), sehingga gaji pokok pada golongan baru
// dibaca ulang dari tabel gaji. Kenaikan di dalam jenjang yang sama (mis. III/a → III/b) membawa MKG apa
// adanya. TMT KGB berikutnya tidak diatur ulang oleh KP: siklus KGB tetap berjalan dari TMT KGB terakhir.

import {
  GOLONGAN_PANGKAT,
  getGajiPokok,
  getPangkat,
  hitungMKGKenaikanPangkat,
  isGolonganDikenal,
} from "@/lib/tabelGaji";

/** Jenis KP menurut PP 99/2000 jo. PP 12/2002, sesuai Buku Saku KP 2026. */
export const JENIS_KP = {
  reguler: "Reguler",
  struktural: "Pilihan — Struktural",
  fungsional: "Pilihan — Fungsional",
  penyesuaian_ijazah: "Pilihan — Penyesuaian Ijazah",
  tugas_belajar: "Pilihan — Tugas Belajar",
  luar_biasa: "Pilihan — Luar Biasa",
  anumerta: "Anumerta",
  pengabdian: "Pengabdian",
} as const;

export type JenisKp = keyof typeof JENIS_KP;

export function isJenisKp(nilai: string): nilai is JenisKp {
  return Object.prototype.hasOwnProperty.call(JENIS_KP, nilai);
}

/** Urutan golongan I/a sampai IV/e, dipakai untuk memastikan pangkat memang naik. */
export const URUTAN_GOLONGAN: string[] = Object.keys(GOLONGAN_PANGKAT);

export function peringkatGolongan(golongan: string): number {
  return URUTAN_GOLONGAN.indexOf(golongan);
}

export interface HasilKenaikanPangkat {
  golonganBaru: string;
  pangkatBaru: string;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  gajiPokokBaru: number;
  /** Potongan MKG dalam tahun bila pindah jenjang golongan; 0 bila tidak ada. */
  potonganMkgTahun: number;
}

/**
 * Hitung akibat satu kenaikan pangkat pada data gaji pegawai.
 * Mengembalikan pesan galat bila golongan tidak dikenal atau tidak naik.
 */
export function hitungKenaikanPangkat(input: {
  golonganLama: string;
  mkgTahunLama: number;
  mkgBulanLama: number;
  golonganBaru: string;
}): { ok: true; hasil: HasilKenaikanPangkat } | { ok: false; pesan: string } {
  const { golonganLama, mkgTahunLama, mkgBulanLama, golonganBaru } = input;
  if (!isGolonganDikenal(golonganBaru)) return { ok: false, pesan: "Golongan baru tidak dikenal" };
  if (!isGolonganDikenal(golonganLama)) return { ok: false, pesan: "Golongan lama tidak dikenal" };
  if (peringkatGolongan(golonganBaru) <= peringkatGolongan(golonganLama))
    return { ok: false, pesan: "Golongan baru harus lebih tinggi dari golongan saat ini" };

  const potongan = hitungMKGKenaikanPangkat(golonganLama, golonganBaru, mkgTahunLama, mkgBulanLama);
  const mkgTahunBaru = potongan ? potongan.mkgTahun : mkgTahunLama;
  const mkgBulanBaru = potongan ? potongan.mkgBulan : mkgBulanLama;
  return {
    ok: true,
    hasil: {
      golonganBaru,
      pangkatBaru: getPangkat(golonganBaru),
      mkgTahunBaru,
      mkgBulanBaru,
      gajiPokokBaru: getGajiPokok(golonganBaru, mkgTahunBaru, mkgBulanBaru),
      potonganMkgTahun: potongan ? mkgTahunLama - potongan.mkgTahun : 0,
    },
  };
}

/** KGB yang masih berjalan saat KP dicatat, dikelompokkan menurut perlakuannya. */
export interface DampakKgb<T> {
  /** Placeholder "belum diproses": dasar gajinya diselaraskan otomatis. */
  diselaraskan: T[];
  /** Sudah dikerjakan Tim SDM atau keuangan: SK-nya memakai golongan lama, perlu keputusan manusia. */
  perluDitinjau: T[];
}

const STATUS_PERLU_DITINJAU = ["sedang_diproses", "menunggu_keuangan"];

/**
 * Bagi KGB pegawai menurut dampak KP. KGB yang sudah selesai atau dibatalkan tidak ikut: yang selesai
 * sudah dibayarkan dengan dasar lamanya, dan yang dibatalkan akan diinput ulang.
 */
export function dampakKenaikanPangkatPadaKgb<T extends { status: string; isArsip?: boolean | null }>(
  kgb: readonly T[],
): DampakKgb<T> {
  const aktif = kgb.filter((k) => !k.isArsip);
  return {
    diselaraskan: aktif.filter((k) => k.status === "belum_diproses"),
    perluDitinjau: aktif.filter((k) => STATUS_PERLU_DITINJAU.includes(k.status)),
  };
}
