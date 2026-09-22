// Jadwal pengusulan KGB untuk beberapa bulan TMT ke depan, dipakai halaman publik /kgb.
// Aturannya sama dengan panduan: surat UPT dikirim pada bulan ketiga sebelum TMT, input di SIM-KGB
// dibuka tanggal 1 bulan kedua sebelum TMT dan berakhir pada tanggal batas input Tim SDM (Pengaturan,
// lib/batasInputSdm.ts), lalu keuangan merekonsiliasi gaji di Gaji Web tanggal 1 sampai 15 bulan
// sebelum TMT. Pemanggil di server memuat batas dari Pengaturan lebih dulu (muatBatasInputSdm).

import { hitungDeadlineSDM, hitungRekonGaji, hitungUnlockDate } from "./tabelGaji";
import { hariIniWita } from "./waktu";

export type KeadaanJadwal = "terbuka" | "berikutnya";

export interface BarisJadwalPengusulan {
  tmt: Date;
  kirimSurat: Date;
  inputDibuka: Date;
  batasInput: Date;
  rekonMulai: Date;
  rekonBatas: Date;
  keadaan: KeadaanJadwal;
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
    baris.push({
      tmt: t,
      kirimSurat: new Date(t.getFullYear(), t.getMonth() - 3, 1),
      inputDibuka,
      batasInput,
      rekonMulai: rekon.mulai,
      rekonBatas: rekon.batas,
      keadaan: hari >= inputDibuka && hari <= batasInput ? "terbuka" : "berikutnya",
    });
  }
  return baris;
}
