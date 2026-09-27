// Jadwal pengusulan KGB untuk beberapa bulan TMT ke depan, dipakai halaman publik /kgb.
// Aturannya sama dengan panduan: surat UPT dikirim tanggal 1 sampai 10 bulan kedua sebelum TMT, input di SIM-KGB
// dibuka tanggal 1 bulan kedua sebelum TMT dan berakhir pada tanggal batas input Tim SDM (Pengaturan,
// lib/batasInputSdm.ts), lalu keuangan merekonsiliasi gaji di Gaji Web tanggal 1 sampai 15 bulan
// sebelum TMT. Pemanggil di server memuat batas dari Pengaturan lebih dulu (muatBatasInputSdm).

import { hitungDeadlineSDM, hitungKirimSurat, hitungRekonGaji, hitungUnlockDate } from "./tabelGaji";
import { hariIniWita } from "./waktu";

export type KeadaanJadwal = "terbuka" | "berikutnya";

/** Tiga tahap satu TMT: surat UPT, input Tim SDM di SIM-KGB, dan rekon gaji keuangan di Gaji Web. */
export type TahapJadwal = "surat" | "input" | "rekon";

export const LABEL_TAHAP: Record<TahapJadwal, string> = {
  surat: "Kirim surat",
  input: "Input SIM-KGB",
  rekon: "Rekon Gaji Web",
};

/**
 * Posisi hari ini terhadap satu baris jadwal.
 * - "berjalan": hari ini di dalam jendela `tahap`; `sisaHari` menghitung hari ini dan hari batas (1 = hari terakhir).
 * - "menunggu": hari ini sebelum jendela `tahap` berikutnya dibuka; `sisaHari` adalah jarak hari sampai dibuka.
 * - "selesai": rekon gaji sudah lewat.
 * Jendela surat (1 sampai 10) dan input (1 sampai batas input) dibuka bersamaan; selama surat masih boleh
 * dikirim, tahap yang ditampilkan adalah surat, sebab itulah yang harus dikerjakan UPT lebih dulu.
 */
export interface SekarangJadwal {
  keadaan: "berjalan" | "menunggu" | "selesai";
  tahap: TahapJadwal | null;
  sisaHari: number;
  /** Letak hari ini pada rentang kirim surat sampai akhir rekon (0 sampai 1); null di luar rentang. */
  posisi: number | null;
  /** Kalimat ringkas untuk kartu, mis. "Kirim surat · 4 hari lagi". */
  teks: string;
}

/** Ruas tiap tahap pada garis kemajuan kartu, sebagai pecahan rentang kirim surat sampai akhir rekon. */
export interface RuasTahap {
  tahap: TahapJadwal;
  awal: number;
  akhir: number;
}

export interface BarisJadwalPengusulan {
  tmt: Date;
  kirimSurat: Date;
  kirimSuratBatas: Date;
  inputDibuka: Date;
  batasInput: Date;
  rekonMulai: Date;
  rekonBatas: Date;
  keadaan: KeadaanJadwal;
  sekarang: SekarangJadwal;
  ruas: RuasTahap[];
}

const SEHARI = 24 * 60 * 60 * 1000;
/** Selisih hari kalender antara dua tanggal lokal (tengah malam). */
const selisihHari = (dari: Date, ke: Date) => Math.round((ke.getTime() - dari.getTime()) / SEHARI);

function jendelaBaris(b: Pick<BarisJadwalPengusulan, "kirimSurat" | "kirimSuratBatas" | "inputDibuka" | "batasInput" | "rekonMulai" | "rekonBatas">) {
  return [
    { tahap: "surat" as const, mulai: b.kirimSurat, batas: b.kirimSuratBatas },
    // Input yang terbuka bersamaan dengan surat baru menjadi tahap utama setelah jendela surat tutup.
    { tahap: "input" as const, mulai: b.inputDibuka, batas: b.batasInput },
    { tahap: "rekon" as const, mulai: b.rekonMulai, batas: b.rekonBatas },
  ];
}

const nHari = (n: number) => (n === 1 ? "besok" : `${n} hari lagi`);

/** Posisi hari ini terhadap satu baris jadwal; lihat SekarangJadwal. */
export function sekarangJadwal(
  b: Pick<BarisJadwalPengusulan, "kirimSurat" | "kirimSuratBatas" | "inputDibuka" | "batasInput" | "rekonMulai" | "rekonBatas">,
  hari: Date,
): SekarangJadwal {
  const awal = b.kirimSurat;
  const total = selisihHari(awal, b.rekonBatas) + 1;
  const dalamRentang = hari >= awal && hari <= b.rekonBatas;
  const posisi = dalamRentang ? (selisihHari(awal, hari) + 0.5) / total : null;

  for (const j of jendelaBaris(b)) {
    if (hari < j.mulai) {
      const sisa = selisihHari(hari, j.mulai);
      // Input dibuka bersamaan dengan surat, jadi yang dapat ditunggu hanya pembukaan surat atau rekon.
      const teks = j.tahap === "surat" ? `Dibuka ${nHari(sisa)}` : `Menunggu rekon · ${nHari(sisa)}`;
      return { keadaan: "menunggu", tahap: j.tahap, sisaHari: sisa, posisi, teks };
    }
    if (hari <= j.batas) {
      const sisa = selisihHari(hari, j.batas) + 1;
      const teks = `${LABEL_TAHAP[j.tahap]} · ${sisa === 1 ? "hari terakhir" : `${sisa} hari lagi`}`;
      return { keadaan: "berjalan", tahap: j.tahap, sisaHari: sisa, posisi, teks };
    }
  }
  return { keadaan: "selesai", tahap: null, sisaHari: 0, posisi, teks: "Rekon gaji selesai" };
}

/** Ruas tiap tahap pada garis kemajuan kartu. */
export function ruasTahap(
  b: Pick<BarisJadwalPengusulan, "kirimSurat" | "kirimSuratBatas" | "inputDibuka" | "batasInput" | "rekonMulai" | "rekonBatas">,
): RuasTahap[] {
  const awal = b.kirimSurat;
  const total = selisihHari(awal, b.rekonBatas) + 1;
  return jendelaBaris(b).map((j) => ({
    tahap: j.tahap,
    awal: selisihHari(awal, j.mulai) / total,
    akhir: (selisihHari(awal, j.batas) + 1) / total,
  }));
}

/**
 * Baris jadwal mulai dari TMT yang jendela inputnya belum lewat. Hari ini dibaca menurut WITA; baris
 * pertama berstatus "terbuka" bila jendela inputnya sedang berjalan.
 */
export function jadwalPengusulan(jumlah = 6, hariIni: Date = hariIniWita()): BarisJadwalPengusulan[] {
  const hari = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate());
  // TMT dengan jendela input di bulan ini adalah TMT dua bulan ke depan; bila batasnya sudah lewat, mulai dari bulan berikutnya.
  let tmt = new Date(hari.getFullYear(), hari.getMonth() + 2, 1);
  if (hitungDeadlineSDM(tmt) < hari) tmt = new Date(tmt.getFullYear(), tmt.getMonth() + 1, 1);

  const baris: BarisJadwalPengusulan[] = [];
  for (let i = 0; i < Math.max(0, jumlah); i++) {
    const t = new Date(tmt.getFullYear(), tmt.getMonth() + i, 1);
    const inputDibuka = hitungUnlockDate(t);
    const batasInput = hitungDeadlineSDM(t);
    const rekon = hitungRekonGaji(t);
    const surat = hitungKirimSurat(t);
    const jendela = {
      kirimSurat: surat.mulai,
      kirimSuratBatas: surat.batas,
      inputDibuka,
      batasInput,
      rekonMulai: rekon.mulai,
      rekonBatas: rekon.batas,
    };
    baris.push({
      tmt: t,
      ...jendela,
      keadaan: hari >= inputDibuka && hari <= batasInput ? "terbuka" : "berikutnya",
      sekarang: sekarangJadwal(jendela, hari),
      ruas: ruasTahap(jendela),
    });
  }
  return baris;
}
