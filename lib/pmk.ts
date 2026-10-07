// Peninjauan masa kerja (PMK): SK yang menambah masa kerja golongan pegawai, misalnya dengan memperhitungkan
// masa kerja sebelum CPNS, dan karena itu menetapkan gaji pokok baru (ADR-021).
//
// Data pegawai menyimpan MKG pada TMT KGB terakhir. PMK menambah MKG itu sebesar tambahannya, dan gaji pokok mengikuti
// masa kerja menurut SK PMK sejak TMT-nya. Seperti kenaikan pangkat, PMK tidak menggeser periode KGB sedikit pun: KGB
// berikutnya tetap pada jadwalnya, dan jarak antar-KGB tetap 24 bulan (ADR-080). Dulu KGB berikutnya dihitung ulang dari
// TMT PMK sampai langkah tabel berikutnya. Modul ini murni; route yang memanggilnya menulis ke penyimpanan.

import { bulanKeKgbBerikutnya, getGajiPokok, isGolonganDikenal, selisihBulan, tambahBulan } from "./tabelGaji";
import { formatTanggalId, tanggalKalender, type NilaiTanggal } from "./waktu";

export interface HasilPmk {
  /** Tambahan masa kerja dari PMK, dalam bulan. */
  tambahBulan: number;
  /** MKG pegawai pada TMT PMK sebelum dan sesudah PMK (sesudahnya = MKG pada SK PMK). */
  mkgSebelumPadaTmt: { tahun: number; bulan: number };
  mkgSesudahPadaTmt: { tahun: number; bulan: number };
  /** MKG yang disimpan pada data pegawai: MKG pada TMT KGB terakhir ditambah tambahan PMK. */
  mkgTahunDasar: number;
  mkgBulanDasar: number;
  gajiPokokBaru: number;
  /** Usulan TMT KGB berikutnya: jadwal sebelum PMK, sebab PMK tidak menggeser periode KGB (ADR-080). */
  tmtKgbBerikutnyaUsulan: Date;
}

export type HitungPmk = { ok: true; hasil: HasilPmk } | { ok: false; pesan: string };

const pecah = (bulan: number) => ({ tahun: Math.floor(bulan / 12), bulan: bulan % 12 });

/**
 * Akibat satu SK PMK pada data gaji pegawai. `mkgTahunSk`/`mkgBulanSk` adalah masa kerja golongan pada TMT PMK
 * menurut SK PMK. Mengembalikan pesan galat bila data pegawai atau isian tidak memungkinkan hitungan.
 */
export function hitungPmk(input: {
  golonganRuang: string;
  /** MKG pada data pegawai, yaitu pada TMT KGB terakhir. */
  mkgTahun: number;
  mkgBulan: number;
  tmtKgbTerakhir: NilaiTanggal;
  /** Jadwal KGB berikutnya sebelum PMK; tanpa nilai ini dihitung dari TMT KGB terakhir. */
  tmtKgbBerikutnya?: NilaiTanggal;
  tmtPmk: NilaiTanggal;
  mkgTahunSk: number;
  mkgBulanSk: number;
}): HitungPmk {
  if (!isGolonganDikenal(input.golonganRuang))
    return { ok: false, pesan: `Golongan "${input.golonganRuang}" tidak dikenal di tabel gaji PP 5/2024` };
  const tmtTerakhir = tanggalKalender(input.tmtKgbTerakhir);
  if (!tmtTerakhir) return { ok: false, pesan: "TMT KGB terakhir pegawai belum diisi. Lengkapi Data Pegawai lebih dulu." };
  const tmtPmk = tanggalKalender(input.tmtPmk);
  if (!tmtPmk) return { ok: false, pesan: "TMT PMK wajib diisi" };
  if (tmtPmk < tmtTerakhir)
    return {
      ok: false,
      pesan:
        `TMT PMK lebih awal dari TMT KGB terakhir (${formatTanggalId(tmtTerakhir)}). KGB itu sudah dihitung tanpa PMK; ` +
        "koreksi KGB tersebut lebih dulu, atau catat KGB yang terbit sesudah PMK lewat Arsip KGB.",
    };
  const mkgBulanSk = input.mkgBulanSk || 0;
  if (!Number.isInteger(input.mkgTahunSk) || input.mkgTahunSk < 0 || !Number.isInteger(mkgBulanSk) || mkgBulanSk < 0 || mkgBulanSk > 11)
    return { ok: false, pesan: "Masa kerja golongan pada SK PMK tidak valid (bulan 0 sampai 11)" };

  const dasar = (input.mkgTahun || 0) * 12 + (input.mkgBulan || 0);
  const sebelum = dasar + selisihBulan(tmtTerakhir, tmtPmk);
  const sesudah = input.mkgTahunSk * 12 + mkgBulanSk;
  const tambah = sesudah - sebelum;
  if (tambah <= 0) {
    const s = pecah(sebelum);
    return {
      ok: false,
      pesan: `Masa kerja golongan pada SK PMK harus lebih besar dari masa kerja pegawai pada TMT PMK (${s.tahun} tahun ${s.bulan} bulan).`,
    };
  }
  const baru = pecah(sesudah);
  return {
    ok: true,
    hasil: {
      tambahBulan: tambah,
      mkgSebelumPadaTmt: pecah(sebelum),
      mkgSesudahPadaTmt: baru,
      mkgTahunDasar: Math.floor((dasar + tambah) / 12),
      mkgBulanDasar: (dasar + tambah) % 12,
      gajiPokokBaru: getGajiPokok(input.golonganRuang, baru.tahun, baru.bulan),
      tmtKgbBerikutnyaUsulan:
        tanggalKalender(input.tmtKgbBerikutnya) ??
        tambahBulan(tmtTerakhir, bulanKeKgbBerikutnya(input.golonganRuang, input.mkgTahun || 0, input.mkgBulan || 0)),
    },
  };
}
