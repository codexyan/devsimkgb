// Simulasi kenaikan pangkat (KP) dan proyeksi KGB sesudahnya, untuk kalkulator publik di /tabel-gaji.
//
// Urutannya meniru cara SIM-KGB mencatat KP dan menghitung KGB, supaya angka simulasi sama dengan yang
// kelak tercetak di SK:
// - KP menerapkan potongan masa kerja golongan (MKG) pada MKG yang tercatat (hitungKenaikanPangkat):
//   di dalam jenjang yang sama MKG dibawa apa adanya, lintas jenjang I→II dipotong 6 tahun, II→III 5 tahun.
// - KP tidak mengatur ulang siklus KGB. TMT KGB berikutnya tetap dihitung dari TMT KGB terakhir, dan KGB
//   pertama sesudah KP menambah MKG sebesar jarak yang lebih panjang antara langkah tabel golongan baru dan
//   jarak siklus itu (kalkulasiKGB di lib/tabelGaji.ts).
// Murni agar dapat dipakai peramban dan diuji tanpa lapisan data.

import { hitungKenaikanPangkat, peringkatGolongan, URUTAN_GOLONGAN } from "./kenaikanPangkat";
import { bulanKeKgbBerikutnya, getGajiPokok, getMKGOptions, getPangkat, isGolonganDikenal, tambahBulan } from "./tabelGaji";

export interface MasukanSimulasiKp {
  golonganLama: string;
  /** MKG pada SK terakhir (SK KGB atau SK KP terakhir). */
  mkgTahun: number;
  mkgBulan: number;
  golonganBaru: string;
  /** TMT pada SK KGB terakhir; tanpa ini proyeksi KGB tidak bertanggal. */
  tmtKgbTerakhir?: Date | null;
  /** TMT kenaikan pangkat; KGB yang jatuh sebelum tanggal ini masih dihitung di golongan lama. */
  tmtKp?: Date | null;
  /** Banyaknya KGB sesudah KP yang diproyeksikan. */
  jumlahKgb?: number;
}

export interface LangkahKgbSimulasi {
  golongan: string;
  /** TMT KGB; kosong bila TMT KGB terakhir tidak diisi. */
  tmt: Date | null;
  /** Jarak dari KGB (atau SK) sebelumnya, dalam bulan. */
  jarakBulan: number;
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
  /** Kenaikan gaji pokok dibanding keadaan sebelumnya. */
  kenaikan: number;
  /** true untuk KGB yang jatuh sebelum TMT KP, sehingga masih di golongan lama. */
  sebelumKp: boolean;
}

export interface HasilSimulasiKp {
  golonganLama: string;
  pangkatLama: string;
  /** MKG pada saat KP diterapkan (sesudah KGB yang jatuh lebih dulu, bila ada). */
  mkgTahunLama: number;
  mkgBulanLama: number;
  gajiLama: number;
  golonganBaru: string;
  pangkatBaru: string;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  gajiBaru: number;
  selisih: number;
  potonganMkgTahun: number;
  /** true bila KP melewati jenjang golongan (I→II, II→III, III→IV). */
  lintasJenjang: boolean;
  kgb: LangkahKgbSimulasi[];
  peringatan: string[];
}

const jenjang = (golongan: string) => golongan.split("/")[0];

/** Golongan satu ruang di atasnya; null untuk IV/e. */
export function golonganBerikutnya(golongan: string): string | null {
  const i = peringkatGolongan(golongan);
  return i < 0 ? null : (URUTAN_GOLONGAN[i + 1] ?? null);
}

/** MKG terkecil yang punya gaji pokok di golongan itu (mis. II/b mulai MKG 3). */
function mkgAwal(golongan: string): number {
  return getMKGOptions(golongan)[0]?.tahun ?? 0;
}

export function simulasiKenaikanPangkat(
  m: MasukanSimulasiKp,
): { ok: true; hasil: HasilSimulasiKp } | { ok: false; pesan: string } {
  if (!isGolonganDikenal(m.golonganLama)) return { ok: false, pesan: "Pilih golongan sekarang." };
  if (!isGolonganDikenal(m.golonganBaru)) return { ok: false, pesan: "Pilih golongan tujuan." };
  if (peringkatGolongan(m.golonganBaru) <= peringkatGolongan(m.golonganLama))
    return { ok: false, pesan: "Golongan tujuan harus lebih tinggi dari golongan sekarang." };
  const tahun = Math.floor(Number(m.mkgTahun));
  const bulan = Math.floor(Number(m.mkgBulan));
  if (!Number.isFinite(tahun) || tahun < 0 || tahun > 40) return { ok: false, pesan: "Masa kerja golongan diisi 0 sampai 40 tahun." };
  if (!Number.isFinite(bulan) || bulan < 0 || bulan > 11) return { ok: false, pesan: "Bulan masa kerja diisi 0 sampai 11." };

  const jumlah = Math.min(6, Math.max(1, m.jumlahKgb ?? 3));
  const tmtKp = m.tmtKp ?? null;
  let mkg = tahun * 12 + bulan;
  let tmt: Date | null = m.tmtKgbTerakhir ?? null;
  let gaji = getGajiPokok(m.golonganLama, tahun, bulan);
  const kgb: LangkahKgbSimulasi[] = [];

  // KGB yang jatuh sebelum TMT KP masih memakai golongan lama. TMT yang sama dengan TMT KP dihitung
  // sesudah KP, sebab SK KP berlaku pada tanggal itu.
  if (tmt && tmtKp) {
    for (let i = 0; i < 20; i++) {
      const jarak = bulanKeKgbBerikutnya(m.golonganLama, Math.floor(mkg / 12), mkg % 12);
      const berikut = tambahBulan(tmt, jarak);
      if (berikut >= tmtKp) break;
      mkg += jarak;
      const gajiBaru = getGajiPokok(m.golonganLama, Math.floor(mkg / 12), mkg % 12);
      kgb.push({
        golongan: m.golonganLama, tmt: berikut, jarakBulan: jarak,
        mkgTahun: Math.floor(mkg / 12), mkgBulan: mkg % 12, gajiPokok: gajiBaru, kenaikan: gajiBaru - gaji, sebelumKp: true,
      });
      gaji = gajiBaru;
      tmt = berikut;
    }
  }

  const mkgTahunLama = Math.floor(mkg / 12);
  const mkgBulanLama = mkg % 12;
  const kp = hitungKenaikanPangkat({
    golonganLama: m.golonganLama,
    mkgTahunLama,
    mkgBulanLama,
    golonganBaru: m.golonganBaru,
  });
  if (!kp.ok) return { ok: false, pesan: kp.pesan };
  const h = kp.hasil;
  const gajiLama = gaji;
  const peringatan: string[] = [];

  if (peringkatGolongan(m.golonganBaru) - peringkatGolongan(m.golonganLama) > 1)
    peringatan.push("Naik lebih dari satu ruang sekaligus hanya terjadi pada kenaikan pangkat pilihan tertentu. Periksa dasar SK-nya.");
  if (h.gajiPokokBaru === 0)
    peringatan.push(
      `Tabel PP 5/2024 untuk ${m.golonganBaru} baru dimulai pada MKG ${mkgAwal(m.golonganBaru)} tahun, jadi belum ada gaji pokok untuk MKG ${h.mkgTahunBaru} tahun.`,
    );

  // KGB sesudah KP. Siklusnya tidak diatur ulang: jarak ke KGB pertama tetap dari keadaan sebelum KP,
  // dan MKG bertambah sebesar yang lebih panjang antara jarak itu dan langkah tabel golongan baru.
  let mkgBaru = h.mkgTahunBaru * 12 + h.mkgBulanBaru;
  let gajiSebelum = h.gajiPokokBaru;
  const jarakSiklus = bulanKeKgbBerikutnya(m.golonganLama, mkgTahunLama, mkgBulanLama);
  for (let i = 0; i < jumlah; i++) {
    const langkah = bulanKeKgbBerikutnya(m.golonganBaru, Math.floor(mkgBaru / 12), mkgBaru % 12);
    const tambah = i === 0 ? Math.max(langkah, jarakSiklus) : langkah;
    const jarak = i === 0 ? jarakSiklus : langkah;
    mkgBaru += tambah;
    tmt = tmt ? tambahBulan(tmt, jarak) : null;
    const g = getGajiPokok(m.golonganBaru, Math.floor(mkgBaru / 12), mkgBaru % 12);
    kgb.push({
      golongan: m.golonganBaru, tmt, jarakBulan: jarak,
      mkgTahun: Math.floor(mkgBaru / 12), mkgBulan: mkgBaru % 12, gajiPokok: g, kenaikan: g - gajiSebelum, sebelumKp: false,
    });
    gajiSebelum = g;
  }

  return {
    ok: true,
    hasil: {
      golonganLama: m.golonganLama,
      pangkatLama: getPangkat(m.golonganLama),
      mkgTahunLama,
      mkgBulanLama,
      gajiLama,
      golonganBaru: h.golonganBaru,
      pangkatBaru: h.pangkatBaru,
      mkgTahunBaru: h.mkgTahunBaru,
      mkgBulanBaru: h.mkgBulanBaru,
      gajiBaru: h.gajiPokokBaru,
      selisih: h.gajiPokokBaru - gajiLama,
      potonganMkgTahun: h.potonganMkgTahun,
      lintasJenjang: jenjang(m.golonganLama) !== jenjang(m.golonganBaru),
      kgb,
      peringatan,
    },
  };
}
