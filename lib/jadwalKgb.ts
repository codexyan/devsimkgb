// Perencana jadwal KGB berikutnya: isi placeholder berstatus belum_diproses dan pergeseran TMT
// karena hukuman disiplin yang menunda KGB. Modul ini murni (tanpa akses data); route yang
// memanggilnya tetap menulis ke penyimpanan. Semua tanggal dibaca sebagai tanggal kalender WITA.

import { penundaanHukdisSelamaKgb } from "./dataPegawai";
import { bulanKeKgbBerikutnya, jendelaProsesKgb, kalkulasiKGB, tambahBulan } from "./tabelGaji";
import { formatTanggalId, tanggalKalender, type NilaiTanggal } from "./waktu";

interface DasarSiklusKgb {
  golonganRuang: string;
  mkgTahun: number;
  mkgBulan: number;
  /** Gaji pokok yang berlaku sebelum KGB yang direncanakan. */
  gajiPokok: number;
  /** TMT KGB yang direncanakan. */
  tmtKgbBerikutnya: NilaiTanggal;
  /** TMT KGB terakhir. Jarak yang lebih panjang dari langkah tabel gaji (penundaan) dihitung penuh. */
  tmtKgbTerakhir?: NilaiTanggal;
  /** Pejabat yang menetapkan SK dasar; null bila belum diketahui. */
  penetapSkDasar?: string | null;
  hariIni?: Date;
}

/** Field placeholder untuk makeRiwayatKGB, di luar pegawaiId dan createdBy. */
export interface RencanaSiklusKgb {
  tanggalSK: Date;
  tmtSK: Date;
  penetapSkDasar: string | null;
  golonganLama: string;
  gajiPokokLama: number;
  mkgTahunLama: number;
  mkgBulanLama: number;
  golonganBaru: string;
  gajiPokokBaru: number;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  tmtKgbBaru: Date;
  tmtKgbBerikutnya: Date;
  status: "belum_diproses";
  flagRapelan: boolean;
}

/**
 * Rencana placeholder KGB berikutnya dari keadaan pegawai sebelum KGB itu.
 * Melempar Error bila golongan tidak dikenal atau TMT berikutnya kosong/tidak valid.
 */
export function rencanaSiklusBerikutnya(input: DasarSiklusKgb): RencanaSiklusKgb {
  const mkgTahun = input.mkgTahun || 0;
  const mkgBulan = input.mkgBulan || 0;
  const hasil = kalkulasiKGB({
    golonganRuang: input.golonganRuang,
    mkgTahun,
    mkgBulan,
    tmtKgbBerikutnya: tanggalKalender(input.tmtKgbBerikutnya),
    tmtKgbTerakhir: tanggalKalender(input.tmtKgbTerakhir),
    hariIni: input.hariIni,
  });
  return {
    tanggalSK: new Date(hasil.tmtKgbBaru),
    tmtSK: new Date(hasil.tmtKgbBaru),
    penetapSkDasar: input.penetapSkDasar ?? null,
    golonganLama: input.golonganRuang,
    gajiPokokLama: input.gajiPokok || 0,
    mkgTahunLama: mkgTahun,
    mkgBulanLama: mkgBulan,
    golonganBaru: input.golonganRuang,
    gajiPokokBaru: hasil.gajiPokokBaru,
    mkgTahunBaru: hasil.mkgTahunBaru,
    mkgBulanBaru: hasil.mkgBulanBaru,
    tmtKgbBaru: hasil.tmtKgbBaru,
    tmtKgbBerikutnya: hasil.tmtKgbBerikutnya,
    status: "belum_diproses",
    flagRapelan: hasil.flagRapelan,
  };
}

/** Tanggal kalender paling akhir dari nilai yang valid; null bila tidak ada yang valid. */
export function tanggalPalingAkhir(...nilai: NilaiTanggal[]): Date | null {
  let hasil: Date | null = null;
  for (const n of nilai) {
    const tanggal = tanggalKalender(n);
    if (tanggal && (!hasil || tanggal > hasil)) hasil = tanggal;
  }
  return hasil;
}

/** Bagian record KGB yang selesai (konfirmasi keuangan atau arsip) yang dipakai untuk jadwal. */
interface KgbSelesaiUntukJadwal {
  golonganBaru: string;
  gajiPokokBaru: number;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  tmtKgbBaru: NilaiTanggal;
  tmtKgbBerikutnya: NilaiTanggal;
}

export interface RencanaSetelahKgbSelesai {
  /** Nilai yang ditulis ke data pegawai. */
  pegawai: {
    golonganRuang: string;
    gajiPokok: number;
    mkgTahun: number;
    mkgBulan: number;
    tmtKgbTerakhir: Date;
    tmtKgbBerikutnya: Date;
  };
  placeholder: RencanaSiklusKgb;
}

/**
 * Data pegawai dan placeholder berikutnya setelah sebuah KGB selesai.
 * TMT berikutnya diambil dari yang paling akhir antara record KGB dan data pegawai, sehingga
 * penundaan hukdis yang dicatat selama KGB berjalan tidak hilang; TMT KGB yang selesai menjadi
 * TMT terakhir, sehingga masa penundaan ikut dihitung dalam MKG.
 */
export function rencanaSetelahKgbSelesai(input: {
  kgb: KgbSelesaiUntukJadwal;
  tmtKgbBerikutnyaPegawai?: NilaiTanggal;
  penetapSkDasar?: string | null;
  hariIni?: Date;
}): RencanaSetelahKgbSelesai {
  const { kgb } = input;
  const tmtKgbTerakhir = tanggalKalender(kgb.tmtKgbBaru);
  if (!tmtKgbTerakhir) throw new Error("TMT KGB yang selesai kosong atau tidak valid");
  const placeholder = rencanaSiklusBerikutnya({
    golonganRuang: kgb.golonganBaru,
    mkgTahun: kgb.mkgTahunBaru,
    mkgBulan: kgb.mkgBulanBaru,
    gajiPokok: kgb.gajiPokokBaru,
    tmtKgbBerikutnya: tanggalPalingAkhir(kgb.tmtKgbBerikutnya, input.tmtKgbBerikutnyaPegawai),
    tmtKgbTerakhir,
    penetapSkDasar: input.penetapSkDasar,
    hariIni: input.hariIni,
  });
  return {
    pegawai: {
      golonganRuang: kgb.golonganBaru,
      gajiPokok: kgb.gajiPokokBaru,
      mkgTahun: kgb.mkgTahunBaru || 0,
      mkgBulan: kgb.mkgBulanBaru || 0,
      tmtKgbTerakhir,
      tmtKgbBerikutnya: placeholder.tmtKgbBaru,
    },
    placeholder,
  };
}

/** KGB pegawai yang berstatus sedang_diproses atau menunggu_keuangan. */
interface KgbAktifUntukJadwal {
  tmtKgbBaru: NilaiTanggal;
  tmtKgbBerikutnya: NilaiTanggal;
  status?: string;
}

export type RencanaPenundaanHukdis =
  | { aksi: "tolak"; alasan: string }
  | {
      aksi: "geser";
      /** TMT sebelum digeser; simpan pada data hukdis bila kolomnya tersedia. */
      tmtSebelumTunda: Date;
      /** TMT KGB berikutnya yang baru, untuk pegawai (dan record KGB aktif bila geserKgbAktif). */
      tmtKgbBerikutnya: Date;
      /** TMT KGB terakhir yang menjadi acuan MKG; tulis ke pegawai bila berbeda atau kosong. */
      tmtKgbTerakhir: Date;
      /** true bila tidak ada KGB aktif: hapus placeholder lama dan buat dari rencanaSiklusBerikutnya. */
      buatPlaceholder: boolean;
      /** true bila ada KGB aktif: geser tmtKgbBerikutnya record itu, jangan buat placeholder. */
      geserKgbAktif: boolean;
    };

/**
 * Keputusan saat hukdis yang menunda KGB dicatat.
 * - Ada KGB aktif dan hukdis mulai pada atau sebelum TMT KGB itu: ditolak, karena penundaan
 *   berlaku untuk KGB yang sedang berjalan. Alasannya mengikuti status KGB: Sedang Diproses dapat
 *   dibatalkan, Menunggu Keuangan tidak.
 * - Ada KGB aktif dan hukdis mulai sesudahnya: yang digeser siklus sesudah KGB itu, tanpa placeholder.
 * - Tanpa KGB aktif dan hukdis mulai sesudah TMT KGB berikutnya: ditolak, karena KGB itu jatuh tempo
 *   sebelum hukdis berlaku dan harus diinput lebih dulu (sama dengan cabang KGB aktif).
 * - Tanpa KGB aktif lainnya: TMT pegawai digeser dan placeholder dibuat ulang. Bila TMT terakhir
 *   kosong, acuannya satu langkah tabel gaji sebelum TMT lama agar masa penundaan tetap dihitung.
 */
export function rencanaPenundaanHukdis(input: {
  pegawai: {
    golonganRuang: string;
    mkgTahun: number;
    mkgBulan: number;
    tmtKgbBerikutnya: NilaiTanggal;
    tmtKgbTerakhir?: NilaiTanggal;
  };
  kgbAktif?: KgbAktifUntukJadwal | null;
  tmtMulaiHukdis: NilaiTanggal;
  durasiTunda: number;
  /** Untuk menyebut tanggal dibukanya Input KGB pada alasan penolakan. */
  hariIni?: Date;
}): RencanaPenundaanHukdis {
  const durasi = Math.round(Number(input.durasiTunda));
  if (!Number.isFinite(durasi) || durasi <= 0) {
    return { aksi: "tolak", alasan: "Lama penundaan KGB harus lebih dari 0 bulan." };
  }
  const { pegawai, kgbAktif } = input;

  if (kgbAktif) {
    const tmtAktif = tanggalKalender(kgbAktif.tmtKgbBaru);
    const tmtMulai = tanggalKalender(input.tmtMulaiHukdis);
    if (!tmtAktif) return { aksi: "tolak", alasan: "TMT KGB yang sedang diproses tidak valid." };
    if (!tmtMulai) return { aksi: "tolak", alasan: "Tanggal mulai hukuman disiplin tidak valid." };
    if (tmtMulai <= tmtAktif) {
      return {
        aksi: "tolak",
        alasan:
          kgbAktif.status === "menunggu_keuangan"
            ? "Hukuman disiplin mulai berlaku pada atau sebelum TMT KGB yang sedang menunggu konfirmasi keuangan, sehingga penundaan berlaku untuk KGB tersebut. SK KGB itu sudah ditandatangani dan diunggah, jadi KGB tersebut tidak dapat dibatalkan dari SIM-KGB. Minta Tim Keuangan menahan konfirmasi KGB tersebut dan sampaikan kepada Super Admin untuk ditindaklanjuti."
            : "Hukuman disiplin mulai berlaku pada atau sebelum TMT KGB yang sedang diproses, sehingga penundaan berlaku untuk KGB tersebut. Batalkan KGB tersebut terlebih dahulu, lalu catat hukuman disiplin.",
      };
    }
    const dasar = tanggalPalingAkhir(kgbAktif.tmtKgbBerikutnya, pegawai.tmtKgbBerikutnya);
    if (!dasar) return { aksi: "tolak", alasan: "TMT KGB berikutnya belum tercatat." };
    return {
      aksi: "geser",
      tmtSebelumTunda: dasar,
      tmtKgbBerikutnya: tambahBulan(dasar, durasi),
      tmtKgbTerakhir: tmtAktif,
      buatPlaceholder: false,
      geserKgbAktif: true,
    };
  }

  const dasar = tanggalKalender(pegawai.tmtKgbBerikutnya);
  if (!dasar) {
    return {
      aksi: "tolak",
      alasan: "TMT KGB berikutnya pegawai belum diisi. Lengkapi data pegawai sebelum mencatat hukuman disiplin yang menunda KGB.",
    };
  }
  const tmtMulai = tanggalKalender(input.tmtMulaiHukdis);
  if (!tmtMulai) return { aksi: "tolak", alasan: "Tanggal mulai hukuman disiplin tidak valid." };
  if (tmtMulai > dasar) {
    const labelTmt = formatTanggalId(dasar);
    const jendela = jendelaProsesKgb(dasar, input.hariIni);
    const saran =
      jendela && jendela.isLocked
        ? `Input KGB TMT ${labelTmt} dapat dilakukan mulai ${formatTanggalId(jendela.unlockDate)}; catat hukuman disiplin setelah KGB tersebut diinput.`
        : `Input KGB TMT ${labelTmt} terlebih dahulu, lalu catat hukuman disiplin.`;
    return {
      aksi: "tolak",
      alasan: `Hukuman disiplin mulai berlaku sesudah TMT KGB ${labelTmt} yang belum diinput, sehingga penundaan berlaku untuk KGB sesudahnya. ${saran}`,
    };
  }
  const tmtKgbTerakhir =
    tanggalKalender(pegawai.tmtKgbTerakhir) ??
    tambahBulan(dasar, -bulanKeKgbBerikutnya(pegawai.golonganRuang, pegawai.mkgTahun, pegawai.mkgBulan));
  return {
    aksi: "geser",
    tmtSebelumTunda: dasar,
    tmtKgbBerikutnya: tambahBulan(dasar, durasi),
    tmtKgbTerakhir,
    buatPlaceholder: true,
    geserKgbAktif: false,
  };
}

type RencanaPencabutanPenundaan =
  | { aksi: "tetap"; alasan: string }
  | {
      aksi: "pulihkan";
      tmtKgbBerikutnya: Date;
      /** true bila tidak ada KGB aktif: hapus placeholder lama dan buat dari rencanaSiklusBerikutnya. */
      buatPlaceholder: boolean;
      /** true bila ada KGB aktif: pulihkan tmtKgbBerikutnya record itu, jangan buat placeholder. */
      geserKgbAktif: boolean;
    };

/** KGB pegawai (selesai, sedang diproses, atau menunggu keuangan) untuk memeriksa pemulihan TMT. */
export interface KgbTercatatUntukPencabutan {
  tmt: NilaiTanggal;
  /**
   * Waktu KGB dicatat selesai: konfirmasi keuangan, atau pembuatan record arsip. Kosong untuk KGB
   * yang masih berjalan dan data lama tanpa waktu konfirmasi; untuk data lama itu dipakai TMT-nya.
   */
  dicatatPada?: NilaiTanggal;
  /**
   * true untuk KGB Sedang Diproses atau Menunggu Keuangan yang tidak memuat penundaan dari hukdis ini.
   * KGB seperti itu diinput sesudah hukdis dicatat (hukdis yang dicatat selama KGB berjalan menggeser
   * TMT berikutnya KGB itu), sehingga dianggap dicatat sesudahnya tanpa melihat TMT.
   */
  berjalan?: boolean;
}

/**
 * KGB tercatat untuk rencanaPencabutanPenundaan dari record KGB pegawai: status selesai, sedang
 * diproses, dan menunggu keuangan. Waktu pencatatan KGB selesai diambil dari konfirmasi keuangan,
 * atau dari waktu pembuatan untuk arsip; KGB berjalan ditandai `berjalan` dan tidak memakai waktu
 * pembuatan, karena Input KGB mengubah placeholder yang dibuat jauh sebelumnya. KGB yang TMT
 * berikutnya sudah memuat seluruh penundaan dari hukdis ini (hukdis dicatat selama KGB itu berjalan)
 * tidak dimasukkan, karena TMT KGB itu ditetapkan sebelum hukdis dicatat.
 */
export function kgbTercatatUntukPencabutan(input: {
  riwayatKgb: {
    status: string;
    isArsip?: boolean | null;
    createdAt?: NilaiTanggal;
    konfirmasiKeuanganAt?: NilaiTanggal;
    golonganBaru: string;
    mkgTahunBaru: number;
    mkgBulanBaru: number;
    tmtKgbBaru: NilaiTanggal;
    tmtKgbBerikutnya: NilaiTanggal;
  }[];
  hukdis: { berdampakKGB: boolean | null; tmtMulai: NilaiTanggal; durasiTunda: number | null };
}): KgbTercatatUntukPencabutan[] {
  const durasi = input.hukdis.durasiTunda ?? 0;
  return input.riwayatKgb
    .filter((k) => k.status === "selesai" || k.status === "sedang_diproses" || k.status === "menunggu_keuangan")
    .filter((k) => {
      const tunda = penundaanHukdisSelamaKgb({ kgb: k, riwayatHukdis: [input.hukdis] });
      return !(tunda > 0 && tunda >= durasi);
    })
    .map((k) =>
      k.status === "selesai"
        ? { tmt: k.tmtKgbBaru, dicatatPada: k.isArsip ? k.createdAt : k.konfirmasiKeuanganAt }
        : { tmt: k.tmtKgbBaru, dicatatPada: null, berjalan: true },
    );
}

function waktuInstan(nilai: NilaiTanggal): number | null {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const t = new Date(nilai).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Keputusan saat hukdis yang menunda KGB dihapus. TMT hanya dipulihkan bila jadwal belum berubah
 * sejak hukdis dicatat:
 * - bila TMT hasil penundaan tersimpan (`tmtSetelahTunda`), jadwal sekarang harus sama dengannya;
 * - tanpa nilai itu, pemulihan ditolak bila ada KGB berjalan (`berjalan`), KGB yang dicatat selesai
 *   sesudah hukdis dicatat (menurut `dicatatPada`), atau, bila waktu itu tidak diketahui, KGB dengan
 *   TMT sesudah tanggal hukdis dicatat; juga ditolak bila waktu pencatatan hukdis tidak diketahui.
 * KGB yang TMT berikutnya memuat penundaan dari hukdis ini tidak dimasukkan ke `kgbTercatat`.
 */
export function rencanaPencabutanPenundaan(input: {
  hukdis: {
    berdampakKGB: boolean | null;
    durasiTunda: number | null;
    createdAt: NilaiTanggal;
    tmtSetelahTunda?: NilaiTanggal;
  };
  pegawai: { tmtKgbBerikutnya: NilaiTanggal };
  kgbAktif?: KgbAktifUntukJadwal | null;
  kgbTercatat?: KgbTercatatUntukPencabutan[];
}): RencanaPencabutanPenundaan {
  const { hukdis, kgbAktif } = input;
  const durasi = Math.round(Number(hukdis.durasiTunda));
  if (hukdis.berdampakKGB !== true || !Number.isFinite(durasi) || durasi <= 0) {
    return { aksi: "tetap", alasan: "Hukuman disiplin ini tidak menunda KGB." };
  }
  const sekarang = kgbAktif
    ? tanggalPalingAkhir(kgbAktif.tmtKgbBerikutnya, input.pegawai.tmtKgbBerikutnya)
    : tanggalKalender(input.pegawai.tmtKgbBerikutnya);
  if (!sekarang) return { aksi: "tetap", alasan: "TMT KGB berikutnya pegawai belum tercatat." };

  const setelahTunda = tanggalKalender(hukdis.tmtSetelahTunda);
  if (setelahTunda) {
    if (setelahTunda.getTime() !== sekarang.getTime()) {
      return {
        aksi: "tetap",
        alasan: "Jadwal KGB sudah berubah sejak hukuman disiplin dicatat, sehingga TMT KGB tidak dipulihkan otomatis.",
      };
    }
  } else {
    const dicatat = tanggalKalender(hukdis.createdAt);
    const waktuHukdis = waktuInstan(hukdis.createdAt);
    if (!dicatat || waktuHukdis === null) {
      return {
        aksi: "tetap",
        alasan: "Tanggal pencatatan hukuman disiplin tidak diketahui, sehingga TMT KGB tidak dipulihkan otomatis.",
      };
    }
    // KGB sering dikonfirmasi sebelum TMT-nya, jadi KGB selesai dinilai dari waktu pencatatannya.
    const adaKgbSesudahnya = (input.kgbTercatat ?? []).some((k) => {
      if (k.berjalan) return true;
      const dicatatPada = waktuInstan(k.dicatatPada);
      if (dicatatPada !== null) return dicatatPada > waktuHukdis;
      const tmt = tanggalKalender(k.tmt);
      return tmt !== null && tmt > dicatat;
    });
    if (adaKgbSesudahnya) {
      return {
        aksi: "tetap",
        alasan: "Sudah ada KGB yang dicatat sesudah hukuman disiplin dicatat, sehingga TMT KGB tidak dipulihkan otomatis.",
      };
    }
  }

  return {
    aksi: "pulihkan",
    tmtKgbBerikutnya: tambahBulan(sekarang, -durasi),
    buatPlaceholder: !kgbAktif,
    geserKgbAktif: Boolean(kgbAktif),
  };
}
