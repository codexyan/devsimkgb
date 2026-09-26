// Pembacaan isian data pegawai dari formulir dan berkas import: teks, tanggal, masa kerja golongan,
// gaji pokok, dan unit kerja. Modul ini murni (tanpa akses data) sehingga dipakai bersama oleh
// route tambah, ubah, dan import pegawai.

import { cariSatker, SATKER_KANWIL, type Satker } from "./satker";
import { bulanKeKgbBerikutnya, getGajiPokok, getPangkat, isGolonganDikenal, tambahBulan } from "./tabelGaji";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

export const FORMAT_TANGGAL_DITERIMA = "dd/mm/yyyy atau yyyy-mm-dd";

/** Status KGB yang sedang berjalan: jadwal pegawai tidak boleh diubah selama status ini. */
const STATUS_KGB_BERJALAN =["sedang_diproses", "menunggu_keuangan"] as const;

type HasilTanggal =
  | { status: "kosong" }
  | { status: "valid"; tanggal: Date }
  | { status: "tidak_valid" };

/** Teks yang sudah dipangkas; selain string dianggap kosong. */
export function teksIsian(nilai: unknown): string {
  if (typeof nilai === "number" && Number.isFinite(nilai)) return String(nilai);
  return typeof nilai === "string" ? nilai.trim() : "";
}

/** Teks yang sudah dipangkas, atau null bila kosong. */
export function teksAtauNull(nilai: unknown): string | null {
  return teksIsian(nilai) || null;
}

function tanggalUtc(tahun: number, bulan: number, hari: number): Date | null {
  if (tahun < 1900 || tahun > 2100 || bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return null;
  const tanggal = new Date(Date.UTC(tahun, bulan - 1, hari));
  // Tanggal yang tidak ada, misalnya 31/02, bergeser ke bulan berikutnya dan ditolak.
  if (tanggal.getUTCMonth() !== bulan - 1 || tanggal.getUTCDate() !== hari) return null;
  return tanggal;
}

function dariKalender(tanggal: Date | null): HasilTanggal {
  if (!tanggal) return { status: "tidak_valid" };
  const hasil = tanggalUtc(tanggal.getFullYear(), tanggal.getMonth() + 1, tanggal.getDate());
  return hasil ? { status: "valid", tanggal: hasil } : { status: "tidak_valid" };
}

/**
 * Tanggal isian sebagai tanggal kalender pada tengah malam UTC (sama dengan new Date("yyyy-mm-dd")),
 * sehingga terbaca sebagai tanggal yang sama menurut WITA.
 * Diterima: yyyy-mm-dd, dd/mm/yyyy (pemisah "/", "-", atau "."), instan ISO lengkap, dan Date.
 * Bentuk lain, termasuk tahun dua digit, yyyy/mm/dd, dan nomor seri Excel, tidak valid karena ambigu.
 */
export function bacaTanggal(nilai: unknown): HasilTanggal {
  if (nilai === null || nilai === undefined) return { status: "kosong" };
  if (nilai instanceof Date) return dariKalender(tanggalKalender(nilai));
  if (typeof nilai !== "string") return { status: "tidak_valid" };
  const teks = nilai.trim();
  if (!teks) return { status: "kosong" };

  let cocok = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(teks);
  if (cocok) {
    const tanggal = tanggalUtc(Number(cocok[1]), Number(cocok[2]), Number(cocok[3]));
    return tanggal ? { status: "valid", tanggal } : { status: "tidak_valid" };
  }
  cocok = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(teks);
  if (cocok) {
    const tanggal = tanggalUtc(Number(cocok[3]), Number(cocok[2]), Number(cocok[1]));
    return tanggal ? { status: "valid", tanggal } : { status: "tidak_valid" };
  }
  // Instan lengkap dari API, misalnya 2026-05-31T16:00:00.000Z, dibaca menurut WITA.
  if (/^\d{4}-\d{2}-\d{2}T/.test(teks)) return dariKalender(tanggalKalender(teks));
  return { status: "tidak_valid" };
}

type HasilUnitKerja = { satker: Satker; galat?: undefined } | { satker?: undefined; galat: string };

/** Satker dari isian unit kerja. Kosong berarti Kanwil; nilai di luar daftar satker ditolak. */
export function bacaUnitKerja(nilai: unknown): HasilUnitKerja {
  if (nilai === null || nilai === undefined) return { satker: SATKER_KANWIL };
  if (typeof nilai !== "string") return { galat: "Unit kerja tidak valid." };
  const teks = nilai.trim();
  if (!teks) return { satker: SATKER_KANWIL };
  const satker = cariSatker(teks);
  if (satker) return { satker };
  return {
    galat: `Unit kerja "${teks}" tidak ada dalam daftar satker Kanwil Ditjenpas Kalimantan Selatan. Pilih salah satu dari 19 satker yang tersedia.`,
  };
}

function bilanganBulat(nilai: unknown): number | null {
  if (nilai === null || nilai === undefined) return 0;
  if (typeof nilai === "number") return Number.isInteger(nilai) && nilai >= 0 ? nilai : null;
  if (typeof nilai !== "string") return null;
  const teks = nilai.trim();
  if (!teks) return 0;
  return /^\d+$/.test(teks) ? Number(teks) : null;
}

/** Masa kerja golongan; kosong berarti 0. Bulan harus 0 sampai 11. */
export function bacaMkg(
  tahun: unknown,
  bulan: unknown,
): { mkgTahun: number; mkgBulan: number; galat?: undefined } | { galat: string } {
  const mkgTahun = bilanganBulat(tahun);
  const mkgBulan = bilanganBulat(bulan);
  if (mkgTahun === null || mkgBulan === null) {
    return { galat: "Masa kerja golongan harus berupa angka bulat tanpa tanda baca." };
  }
  if (mkgBulan > 11) return { galat: `Masa kerja golongan bulan harus 0 sampai 11, bukan ${mkgBulan}.` };
  return { mkgTahun, mkgBulan };
}

/** Gaji pokok isian; bila kosong diambil dari tabel gaji menurut golongan dan masa kerja golongan. */
export function bacaGajiPokok(
  nilai: unknown,
  golonganRuang: string,
  mkgTahun: number,
  mkgBulan: number,
): { gajiPokok: number; galat?: undefined } | { galat: string } {
  const teks = teksIsian(nilai);
  if (teks) {
    if (!/^\d+$/.test(teks) || Number(teks) <= 0) {
      return { galat: "Gaji pokok harus berupa angka bulat tanpa titik atau koma." };
    }
    return { gajiPokok: Number(teks) };
  }
  const gajiPokok = getGajiPokok(golonganRuang, mkgTahun, mkgBulan);
  if (!gajiPokok) {
    return { galat: `Gaji pokok tidak dapat ditentukan dari tabel gaji untuk MKG ${mkgTahun} tahun ${mkgBulan} bulan.` };
  }
  return { gajiPokok };
}

/** Isian pegawai yang sudah diperiksa. tmtKgbTerakhir null bila tidak diisi. */
interface IsianPegawai {
  nip: string;
  nama: string;
  tempatLahir: string | null;
  tanggalLahir: Date | null;
  jenisKelamin: string | null;
  pendidikanTerakhir: string | null;
  jabatan: string;
  pangkat: string;
  golonganRuang: string;
  unitKerja: string;
  eselon: string | null;
  jenisJabatan: string | null;
  tmtGolongan: Date;
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
  tmtKgbTerakhir: Date | null;
  tmtKgbBerikutnya: Date;
  /** SK dasar KGB pertama (SK CPNS); semuanya boleh kosong (ADR-010). */
  nomorSkDasar: string | null;
  tanggalSkDasar: Date | null;
  penetapSkDasar: string | null;
}

const LABEL_TANGGAL = {
  tanggalLahir: "Tanggal Lahir",
  tmtGolongan: "TMT Golongan",
  tmtKgbTerakhir: "TMT KGB Terakhir",
  tmtKgbBerikutnya: "TMT KGB Berikutnya",
  tanggalSkDasar: "Tanggal SK Dasar",
} as const;

/**
 * Periksa isian pegawai dari formulir atau satu baris import. NIP hanya diperiksa bila `denganNip`
 * (tambah dan import); tanda ="..." dari hasil export dibuang. Mengembalikan pesan galat pertama.
 */
export function bacaIsianPegawai(
  isian: Record<string, unknown>,
  opsi: { denganNip: boolean },
): { data: IsianPegawai; galat?: undefined } | { galat: string } {
  const nip = teksIsian(isian.nip).replace(/^="(.*)"$/, "$1").trim();
  if (opsi.denganNip && !/^\d{18}$/.test(nip)) {
    return { galat: `NIP "${nip}" tidak valid. NIP terdiri dari 18 digit angka.` };
  }

  const nama = teksIsian(isian.nama);
  if (!nama) return { galat: "Nama pegawai wajib diisi." };
  const jabatan = teksIsian(isian.jabatan);
  if (!jabatan) return { galat: "Jabatan wajib diisi." };

  const golonganRuang = teksIsian(isian.golonganRuang);
  if (!isGolonganDikenal(golonganRuang)) {
    return { galat: `Golongan "${golonganRuang}" tidak dikenal di tabel gaji PP 5/2024.` };
  }

  const unit = bacaUnitKerja(isian.unitKerja);
  if (unit.galat !== undefined) return { galat: unit.galat };

  const tanggal: Partial<Record<keyof typeof LABEL_TANGGAL, Date | null>> = {};
  for (const kolom of Object.keys(LABEL_TANGGAL) as (keyof typeof LABEL_TANGGAL)[]) {
    const hasil = bacaTanggal(isian[kolom]);
    if (hasil.status === "tidak_valid") {
      return {
        galat: `${LABEL_TANGGAL[kolom]} "${teksIsian(isian[kolom])}" tidak valid. Gunakan format ${FORMAT_TANGGAL_DITERIMA}.`,
      };
    }
    tanggal[kolom] = hasil.status === "valid" ? hasil.tanggal : null;
  }
  if (!tanggal.tmtGolongan) return { galat: "TMT Golongan wajib diisi." };

  const mkg = bacaMkg(isian.mkgTahun, isian.mkgBulan);
  if (mkg.galat !== undefined) return { galat: mkg.galat };
  const gaji = bacaGajiPokok(isian.gajiPokok, golonganRuang, mkg.mkgTahun, mkg.mkgBulan);
  if (gaji.galat !== undefined) return { galat: gaji.galat };

  // Jatuh tempo berikutnya dihitung dari langkah tabel gaji bila tidak diisi, sama seperti yang
  // dilakukan formulir UPT. Selangnya tidak selalu dua tahun: golongan II/a dari masa kerja 0 naik
  // setelah 12 bulan, dan mengetiknya dari ingatan itulah yang membuat KGB pertama CPNS meleset.
  // Nilai yang diisi tetap dihormati, sebab ada kasus yang memang bergeser, misalnya penundaan hukdis.
  const tmtKgbBerikutnya = tanggal.tmtKgbBerikutnya
    ?? (tanggal.tmtKgbTerakhir
      ? tambahBulan(tanggal.tmtKgbTerakhir, bulanKeKgbBerikutnya(golonganRuang, mkg.mkgTahun, mkg.mkgBulan))
      : null);
  if (!tmtKgbBerikutnya)
    return { galat: "TMT KGB Berikutnya wajib diisi, atau isi TMT KGB Terakhir agar dihitungkan sistem." };

  return {
    data: {
      nip,
      nama,
      tempatLahir: teksAtauNull(isian.tempatLahir),
      tanggalLahir: tanggal.tanggalLahir ?? null,
      jenisKelamin: teksAtauNull(isian.jenisKelamin),
      pendidikanTerakhir: teksAtauNull(isian.pendidikanTerakhir),
      jabatan,
      pangkat: teksIsian(isian.pangkat) || getPangkat(golonganRuang),
      golonganRuang,
      unitKerja: unit.satker.nama,
      eselon: teksAtauNull(isian.eselon),
      jenisJabatan: teksAtauNull(isian.jenisJabatan),
      tmtGolongan: tanggal.tmtGolongan,
      mkgTahun: mkg.mkgTahun,
      mkgBulan: mkg.mkgBulan,
      gajiPokok: gaji.gajiPokok,
      tmtKgbTerakhir: tanggal.tmtKgbTerakhir ?? null,
      tmtKgbBerikutnya,
      nomorSkDasar: teksAtauNull(isian.nomorSkDasar),
      tanggalSkDasar: tanggal.tanggalSkDasar ?? null,
      penetapSkDasar: teksAtauNull(isian.penetapSkDasar),
    },
  };
}

/**
 * Jumlah bulan penundaan hukdis yang dicatat selama KGB ini berjalan; 0 bila tidak ada.
 * Pencatatan hukdis dengan KGB berjalan menggeser tmtKgbBerikutnya record KGB itu melewati langkah
 * tabel gaji. Penundaan dianggap ada bila pergeseran itu terlihat dan masih ada hukdis berdampak KGB
 * yang mulai sesudah TMT KGB tersebut; bila hukdisnya sudah dihapus, pergeseran sisa tidak dihitung.
 */
export function penundaanHukdisSelamaKgb(input: {
  kgb: {
    golonganBaru: string;
    mkgTahunBaru: number;
    mkgBulanBaru: number;
    tmtKgbBaru: NilaiTanggal;
    tmtKgbBerikutnya: NilaiTanggal;
  };
  riwayatHukdis: { berdampakKGB: boolean | null; tmtMulai: NilaiTanggal }[];
}): number {
  const { kgb } = input;
  const tmt = tanggalKalender(kgb.tmtKgbBaru);
  const berikutnya = tanggalKalender(kgb.tmtKgbBerikutnya);
  if (!tmt || !berikutnya) return 0;
  const adaHukdisSesudahTmt = input.riwayatHukdis.some((h) => {
    const mulai = tanggalKalender(h.tmtMulai);
    return h.berdampakKGB === true && mulai !== null && mulai > tmt;
  });
  if (!adaHukdisSesudahTmt) return 0;
  const tanpaPenundaan = tambahBulan(tmt, bulanKeKgbBerikutnya(kgb.golonganBaru, kgb.mkgTahunBaru, kgb.mkgBulanBaru));
  if (berikutnya <= tanpaPenundaan) return 0;
  const bulan =
    (berikutnya.getFullYear() - tanpaPenundaan.getFullYear()) * 12 + (berikutnya.getMonth() - tanpaPenundaan.getMonth());
  return Math.max(bulan, 1);
}

/** KGB berjalan (sedang diproses atau menunggu keuangan) yang paling baru dibuat; null bila tidak ada. */
export function kgbBerjalanTerbaru<T extends { status: string; createdAt: Date | null }>(daftar: T[]): T | null {
  let hasil: T | null = null;
  for (const k of daftar) {
    if (!(STATUS_KGB_BERJALAN as readonly string[]).includes(k.status)) continue;
    if (!hasil || (k.createdAt?.getTime() ?? 0) >= (hasil.createdAt?.getTime() ?? 0)) hasil = k;
  }
  return hasil;
}
