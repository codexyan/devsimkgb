// Linimasa perhitungan hukdis untuk formulir Catat Kanwil (ADR-116): dua jalur KGB berdampingan, yang semula (tanpa hukuman)
// dan yang sesudah hukumannya dicatat, lengkap dengan masa kerja golongan (MKG) dan gaji tiap KGB, supaya peninjau dapat
// memeriksa dengan mata bahwa penundaan dihitung penuh sebagai masa kerja dan jadwal kembali ke jalurnya (ADR-080, ADR-115).
//
// Murni, memakai `kalkulasiKGB` yang sama dengan Input KGB, sehingga angka yang terlihat di sini adalah angka yang kelak
// tercetak. Hanya tampilan; tidak menulis apa pun.

import { isoTanggalKalender } from "./rekapKgb";
import { kalkulasiKGB } from "./tabelGaji";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

export interface TitikKgb {
  tmt: Date;
  mkgTahun: number;
  mkgBulan: number;
  /** Gaji pokok sesudah KGB itu. */
  gaji: number;
}

export interface LinimasaHukdis {
  /** Lama penundaan dalam bulan. */
  bulan: number;
  /** true bila acuannya KGB yang sedang berjalan, bukan KGB selesai terakhir. */
  acuanBerjalan: boolean;
  /** Keadaan acuan: SK KGB terakhir, atau KGB berjalan, yang masa kerjanya dihitung maju. */
  acuan: TitikKgb;
  hukuman: { mulai: Date; berakhir: Date | null };
  /** Dua KGB berikutnya seandainya tidak ada hukuman: TMT dan hasil hitungnya. */
  semula: [TitikKgb, TitikKgb];
  /** Dua KGB berikutnya sesudah hukuman dicatat: KGB tertunda lalu KGB yang kembali ke jalur. */
  sesudah: [TitikKgb, TitikKgb];
  /** true bila KGB kedua sesudah dicatat jatuh pada TMT dan masa kerja yang sama dengan jalur semula. */
  sejajar: boolean;
}

export interface MasukanLinimasa {
  /** Keadaan sesudah KGB acuan: golongan, masa kerja, gaji, dan TMT-nya (TMT KGB terakhir, atau TMT KGB berjalan). */
  dasar: { golonganRuang: string; mkgTahun: number; mkgBulan: number; gajiPokok: number; tmtKgbTerakhir: Date };
  acuanBerjalan: boolean;
  /** TMT KGB berikutnya sebelum dan sesudah digeser, dari proyeksi. */
  tmtSebelum: Date;
  tmtBaru: Date;
  bulan: number;
  hukuman: { mulai: NilaiTanggal; berakhir?: NilaiTanggal };
}

const sama = (a: Date, b: Date) => a.getTime() === b.getTime();

/** Dua KGB berturut-turut dari dasar ini, KGB pertama jatuh pada `tmtPertama`. Melempar bila hitungannya tidak mungkin. */
function dua(dasar: MasukanLinimasa["dasar"], tmtPertama: Date): [TitikKgb, TitikKgb] {
  const k1 = kalkulasiKGB({
    golonganRuang: dasar.golonganRuang,
    mkgTahun: dasar.mkgTahun,
    mkgBulan: dasar.mkgBulan,
    tmtKgbBerikutnya: tmtPertama,
    tmtKgbTerakhir: dasar.tmtKgbTerakhir,
  });
  const k2 = kalkulasiKGB({
    golonganRuang: dasar.golonganRuang,
    mkgTahun: k1.mkgTahunBaru,
    mkgBulan: k1.mkgBulanBaru,
    tmtKgbBerikutnya: k1.tmtKgbBerikutnya,
    tmtKgbTerakhir: k1.tmtKgbBaru,
  });
  return [
    { tmt: k1.tmtKgbBaru, mkgTahun: k1.mkgTahunBaru, mkgBulan: k1.mkgBulanBaru, gaji: k1.gajiPokokBaru },
    { tmt: k2.tmtKgbBaru, mkgTahun: k2.mkgTahunBaru, mkgBulan: k2.mkgBulanBaru, gaji: k2.gajiPokokBaru },
  ];
}

/** null bila golongan atau tanggal tidak dapat dihitung; proyeksi teksnya tetap tampil tanpa linimasa. */
export function susunLinimasaHukdis(input: MasukanLinimasa): LinimasaHukdis | null {
  const mulai = tanggalKalender(input.hukuman.mulai);
  if (!mulai) return null;
  try {
    const semula = dua(input.dasar, input.tmtSebelum);
    const sesudah = dua(input.dasar, input.tmtBaru);
    return {
      bulan: input.bulan,
      acuanBerjalan: input.acuanBerjalan,
      acuan: {
        tmt: input.dasar.tmtKgbTerakhir,
        mkgTahun: input.dasar.mkgTahun,
        mkgBulan: input.dasar.mkgBulan,
        gaji: input.dasar.gajiPokok,
      },
      hukuman: { mulai, berakhir: tanggalKalender(input.hukuman.berakhir) },
      semula,
      sesudah,
      sejajar:
        sama(semula[1].tmt, sesudah[1].tmt) &&
        semula[1].mkgTahun === sesudah[1].mkgTahun &&
        semula[1].mkgBulan === sesudah[1].mkgBulan,
    };
  } catch {
    return null;
  }
}

/** Bentuk JSON linimasa untuk API: tanggal sebagai tanggal kalender WITA. */
export interface LinimasaHukdisJson {
  bulan: number;
  acuanBerjalan: boolean;
  acuan: TitikKgbJson;
  hukuman: { mulai: string | null; berakhir: string | null };
  semula: TitikKgbJson[];
  sesudah: TitikKgbJson[];
  sejajar: boolean;
}
export interface TitikKgbJson {
  tmt: string | null;
  mkgTahun: number;
  mkgBulan: number;
  gaji: number;
}

const titik = (t: TitikKgb): TitikKgbJson => ({ tmt: isoTanggalKalender(t.tmt), mkgTahun: t.mkgTahun, mkgBulan: t.mkgBulan, gaji: t.gaji });

export function jsonLinimasaHukdis(l: LinimasaHukdis): LinimasaHukdisJson {
  return {
    bulan: l.bulan,
    acuanBerjalan: l.acuanBerjalan,
    acuan: titik(l.acuan),
    hukuman: { mulai: isoTanggalKalender(l.hukuman.mulai), berakhir: isoTanggalKalender(l.hukuman.berakhir) },
    semula: l.semula.map(titik),
    sesudah: l.sesudah.map(titik),
    sejajar: l.sejajar,
  };
}
