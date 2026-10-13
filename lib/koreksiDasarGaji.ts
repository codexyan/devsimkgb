// Hitungan di balik Koreksi dasar gaji pada modal Ubah dasar KGB (ADR-040).
//
// Koreksi ini membetulkan angka yang salah ketik tanpa mencatat riwayat kenaikan pangkat atau PMK, jadi
// yang berubah langsung adalah gaji pokok dan jadwal KGB berikutnya. Karena itu ketiganya dihitung di
// sini, bukan diketik operator, dan diuji terpisah dari tampilannya.
//
// Yang diperbaiki modul ini, selain dapat diuji: dulu mengganti golongan memanggil `ubah("mkg")("0_0")`,
// sehingga membetulkan salah ketik golongan diam-diam menjatuhkan masa kerja ke nol dan gaji pokok ke
// angka terendah golongan itu, tanpa pesan apa pun.

import { bulanKeKgbBerikutnya, getGajiPokok, getMKGOptions, tambahBulan } from "./tabelGaji";
import { tanggalKalender, type NilaiTanggal } from "./waktu";

export interface LangkahMkg {
  tahun: number;
  bulan: number;
  gaji: number;
}

/** Hasil penyesuaian masa kerja golongan setelah golongan diganti. */
export interface MkgSetelahGanti {
  tahun: number;
  bulan: number;
  /** true bila langkah lama tidak ada pada golongan baru sehingga terpaksa digeser ke yang terdekat. */
  disesuaikan: boolean;
}

/**
 * Rentang masa kerja golongan yang dapat dicatat pada golongan itu, dalam bulan (ADR-106): dari langkah pertama tabel
 * gaji sampai sebelum satu siklus KGB (24 bulan) sesudah langkah terakhir. Masa kerja di antara dua langkah, termasuk
 * sisa bulannya, dicatat sesuai SK; gaji pokoknya tetap langkah tabel di bawahnya. Null bila golongannya tidak dikenal.
 */
export function rentangMkg(golongan: string): { awal: number; akhir: number } | null {
  const pilihan = getMKGOptions(golongan);
  if (pilihan.length === 0) return null;
  const pertama = pilihan[0];
  const terakhir = pilihan[pilihan.length - 1];
  return { awal: pertama.tahun * 12 + pertama.bulan, akhir: terakhir.tahun * 12 + terakhir.bulan + 23 };
}

/** true bila masa kerja golongan itu berada dalam rentang tabel gaji golongannya (lihat rentangMkg). */
export function mkgDalamRentang(golongan: string, tahun: number, bulan: number): boolean {
  const rentang = rentangMkg(golongan);
  const total = tahun * 12 + bulan;
  return !!rentang && bulan >= 0 && bulan <= 11 && total >= rentang.awal && total <= rentang.akhir;
}

/** Pilihan tahun masa kerja golongan pada golongan itu, untuk isian tahun dan bulan yang terpisah. */
export function pilihanTahunMkg(golongan: string): number[] {
  const rentang = rentangMkg(golongan);
  if (!rentang) return [];
  const hasil: number[] = [];
  for (let tahun = Math.floor(rentang.awal / 12); tahun <= Math.floor(rentang.akhir / 12); tahun++) hasil.push(tahun);
  return hasil;
}

/** Langkah masa kerja golongan terdekat pada golongan itu; null bila golongannya tidak dikenal. */
export function mkgTerdekat(golongan: string, tahun: number, bulan: number): LangkahMkg | null {
  const pilihan = getMKGOptions(golongan);
  if (pilihan.length === 0) return null;
  const target = tahun * 12 + bulan;
  return pilihan.reduce((a, b) =>
    Math.abs(a.tahun * 12 + a.bulan - target) <= Math.abs(b.tahun * 12 + b.bulan - target) ? a : b,
  );
}

/**
 * Masa kerja golongan yang dipakai setelah golongan diganti.
 *
 * Masa kerja yang sedang dipakai, termasuk sisa bulannya, dipertahankan bila masih dalam rentang tabel
 * golongan baru; itu keadaan yang paling lazim. Bila tidak, diambil langkah terdekat dan ditandai
 * `disesuaikan` supaya layar dapat mengatakannya, bukan mengubahnya diam-diam. Null hanya bila golongan
 * barunya tidak dikenal tabel gaji.
 */
export function mkgSetelahGantiGolongan(golonganBaru: string, tahun: number, bulan: number): MkgSetelahGanti | null {
  if (!rentangMkg(golonganBaru)) return null;
  if (mkgDalamRentang(golonganBaru, tahun, bulan)) return { tahun, bulan, disesuaikan: false };
  const dekat = mkgTerdekat(golonganBaru, tahun, bulan)!;
  return { tahun: dekat.tahun, bulan: dekat.bulan, disesuaikan: true };
}

/**
 * Gaji pokok menurut tabel PP 5/2024: langkah tertinggi yang tidak melebihi masa kerja golongan, sehingga
 * 8 tahun 4 bulan bergaji sama dengan 8 tahun 0 bulan (ADR-106). Null bila masa kerjanya di luar rentang
 * tabel golongan itu.
 */
export function gajiPokokUntuk(golongan: string, tahun: number, bulan: number): number | null {
  if (!mkgDalamRentang(golongan, tahun, bulan)) return null;
  return getGajiPokok(golongan, tahun, bulan) || null;
}

/**
 * TMT KGB berikutnya menurut langkah tabel gaji, dihitung dari TMT KGB terakhir. Sama dengan yang
 * dipakai impor Data Pegawai dan formulir UPT, sehingga koreksi tidak meninggalkan jadwal yang
 * bertentangan dengan golongan dan masa kerjanya. Null bila TMT KGB terakhir belum terisi.
 */
export function tmtKgbBerikutnyaHitung(
  golongan: string,
  tahun: number,
  bulan: number,
  tmtKgbTerakhir: NilaiTanggal,
): Date | null {
  const awal = tanggalKalender(tmtKgbTerakhir);
  if (!awal) return null;
  return tambahBulan(awal, bulanKeKgbBerikutnya(golongan, tahun, bulan));
}

/* ── Gaji pokok tercatat yang tidak sesuai golongan dan masa kerjanya (ADR-054) ───────────────────────── */

export interface GajiMenyimpang {
  tercatat: number;
  menurutTabel: number;
  golongan: string;
  mkgTahun: number;
  mkgBulan: number;
}

const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

/**
 * Gaji pokok tercatat yang tidak sama dengan tabel PP 5/2024 untuk golongan dan masa kerja golongan yang
 * tercatat; null bila sama, atau bila salah satunya belum terisi.
 *
 * Gaji pokok disimpan sebagai kolom tersendiri, sedangkan KGB dihitung dari golongan dan masa kerja. Bila
 * keduanya tidak sejalan (gaji diketik atau diimpor apa adanya), hitungan KGB tetap benar tetapi angka
 * tercatat itu tercetak sebagai Gaji Pokok Lama di SK, bisa lebih besar dari gaji pokok barunya.
 */
export function gajiTercatatMenyimpang(p: {
  golonganRuang: string;
  mkgTahun: number | null;
  mkgBulan: number | null;
  gajiPokok: number | null;
}): GajiMenyimpang | null {
  const mkgTahun = p.mkgTahun ?? 0;
  const mkgBulan = p.mkgBulan ?? 0;
  const menurutTabel = getGajiPokok(p.golonganRuang, mkgTahun, mkgBulan);
  const tercatat = p.gajiPokok ?? 0;
  if (!menurutTabel || !tercatat || tercatat === menurutTabel) return null;
  return { tercatat, menurutTabel, golongan: p.golonganRuang, mkgTahun, mkgBulan };
}

/** Satu kalimat tentang gaji yang menyimpang, untuk layar Input KGB dan pesan tolak. */
export function kalimatGajiMenyimpang(g: GajiMenyimpang): string {
  return (
    `Gaji pokok tercatat ${rupiah(g.tercatat)} tidak sesuai tabel PP 5/2024 untuk ${g.golongan} masa kerja ` +
    `${g.mkgTahun} tahun ${g.mkgBulan} bulan, yaitu ${rupiah(g.menurutTabel)}.`
  );
}

/** Jalan membetulkannya, sama di layar dan di pesan tolak. */
export const SARAN_GAJI_MENYIMPANG =
  "Cocokkan dengan SK KGB terakhir, lalu betulkan lewat Data Pegawai: Ubah dasar KGB, Koreksi data yang salah ketik. " +
  "Gaji pokok dihitung ulang dari golongan dan masa kerja golongan.";

/**
 * Pesan tolak Input atau Arsip KGB yang gaji pokok barunya lebih kecil dari gaji pokok lama; null bila tidak.
 * KGB tidak pernah menurunkan gaji (di atas langkah terakhir tabel, gajinya tetap), jadi keadaan ini selalu
 * berarti gaji pokok tercatatnya yang keliru, dan SK yang dibuat darinya akan mencetak penurunan gaji.
 */
export function pesanGajiTurun(
  rencana: { gajiPokokLama: number; gajiPokokBaru: number },
  pegawai: { golonganRuang: string; mkgTahun: number | null; mkgBulan: number | null; gajiPokok: number | null },
): string | null {
  if (!rencana.gajiPokokLama || rencana.gajiPokokBaru >= rencana.gajiPokokLama) return null;
  const menyimpang = gajiTercatatMenyimpang(pegawai);
  return (
    `Gaji pokok baru ${rupiah(rencana.gajiPokokBaru)} lebih kecil dari gaji pokok tercatat ${rupiah(rencana.gajiPokokLama)}, ` +
    "sehingga SK akan mencetak penurunan gaji. " +
    (menyimpang ? `${kalimatGajiMenyimpang(menyimpang)} ` : "") +
    SARAN_GAJI_MENYIMPANG
  );
}
