// Pita jadwal kirim surat usulan di Dasbor Admin UPT (ADR-101).
//
// Pita disusun menurut bulan KIRIM, bukan bulan TMT: yang perlu dikerjakan operator adalah "bulan ini kirim surat",
// dan bulan TMT-nya (dua bulan kemudian) menjadi keterangan. Tiap bulan memuat jumlah pegawai per tahap, dengan empat
// tahap yang sama dengan kolom papan Alur KGB (lib/papanUpt.ts), serta keadaan jendela kirimnya (tanggal 1 sampai
// batas kirim surat) untuk hitung mundur.
//
// Murni: tanpa React dan tanpa jaringan, agar dapat diuji.

/** Empat tahap pita, urut dari yang paling awal. */
export type TahapPita = "usulkan" | "kanwil" | "sk" | "selesai";

export const TAHAP_PITA: readonly { kunci: TahapPita; label: string; ringkas: string }[] = [
  { kunci: "usulkan", label: "Perlu diusulkan", ringkas: "perlu diusulkan" },
  { kunci: "kanwil", label: "Di Kanwil", ringkas: "di Kanwil" },
  { kunci: "sk", label: "SK terbit", ringkas: "SK terbit" },
  { kunci: "selesai", label: "Selesai", ringkas: "selesai" },
];

/** Medan pegawai UPT (GET /api/upt) yang dibaca pita. */
export interface PegawaiPita {
  bulanTmt: string | null;
  statusKGB: string | null;
  /** "draf", "menunggu", atau "revisi" bila ada usulan berjalan. */
  usulanBerjalan?: string | null;
  konfirmasi: string;
  reviewSk?: { status: string | null } | null;
}

/**
 * Tahap satu pegawai, sejalan dengan kolom papan: kartu yang menunggu tindakan UPT (draf atau dikembalikan) di Perlu
 * diusulkan; usulan yang sedang ditinjau, data yang sudah disetujui dan menunggu input KGB, serta KGB yang sedang
 * diproses (termasuk Periksa SK) di Kanwil; SK yang belum direkam di Gaji Web di SK terbit.
 */
export function tahapPita(p: PegawaiPita): TahapPita {
  if (p.statusKGB === "selesai") return "selesai";
  if (p.statusKGB === "menunggu_keuangan") return "sk";
  if (p.statusKGB === "sedang_diproses") return "kanwil";
  if (p.usulanBerjalan === "menunggu") return "kanwil";
  if (p.usulanBerjalan === "draf" || p.usulanBerjalan === "revisi") return "usulkan";
  if (p.konfirmasi === "berlaku") return "kanwil";
  return "usulkan";
}

/** Jumlah pegawai per tahap. */
export function hitungPerTahap(pegawai: readonly PegawaiPita[]): Record<TahapPita, number> {
  const hasil: Record<TahapPita, number> = { usulkan: 0, kanwil: 0, sk: 0, selesai: 0 };
  for (const p of pegawai) hasil[tahapPita(p)] += 1;
  return hasil;
}

/** SK yang sudah dibuat Kanwil dan menunggu review satker ini (ADR-077): masih di Kanwil, tetapi perlu tindakan UPT. */
export const perluPeriksaSk = (p: PegawaiPita) => p.statusKGB === "sedang_diproses" && p.reviewSk?.status === "menunggu";

export type JendelaKirim =
  /** Jendela bulan ini terbuka; `sisaHari` 0 berarti hari terakhir. */
  | { keadaan: "buka"; sisaHari: number }
  /** Jendela bulan ini sudah lewat batas kirim. */
  | { keadaan: "tutup" }
  /** Jendela bulan berikutnya; dibuka `mulaiDalam` hari lagi (tanggal 1 bulan kirim). */
  | { keadaan: "belum"; mulaiDalam: number };

export interface BulanPita {
  /** "yyyy-mm" bulan surat usulan dikirim. */
  bulanKirim: string;
  /** "yyyy-mm" bulan TMT KGB yang diusulkan pada bulan kirim itu (dua bulan sesudahnya). */
  bulanTmt: string;
  jumlah: number;
  perTahap: Record<TahapPita, number>;
  periksaSk: number;
  jendela: JendelaKirim;
  /** Bulan berjalan: posisi hari ini pada linimasa, 1..hariDalamBulan. */
  hariIni: number | null;
  hariDalamBulan: number;
}

const kunciBulan = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function geserKunciBulan(kunci: string, n: number): string {
  const [y, m] = kunci.split("-").map(Number);
  return kunciBulan(new Date(y, m - 1 + n, 1));
}

const SEHARI = 86_400_000;

/**
 * Bulan-bulan pita mulai bulan kirim yang sedang berjalan. Surat usulan dikirim tanggal 1 sampai batas kirim bulan kedua
 * sebelum TMT (ADR-094), jadi bulan kirim ini mengusulkan TMT dua bulan ke depan.
 */
export function susunPitaUpt(
  pegawai: readonly PegawaiPita[],
  hariIni: Date,
  batasKirim: number,
  jumlahBulan = 4,
): BulanPita[] {
  const awalHariIni = new Date(hariIni.getFullYear(), hariIni.getMonth(), hariIni.getDate()).getTime();
  const bulanIni = kunciBulan(hariIni);
  return Array.from({ length: jumlahBulan }, (_, i) => {
    const bulanKirim = geserKunciBulan(bulanIni, i);
    const bulanTmt = geserKunciBulan(bulanKirim, 2);
    const isi = pegawai.filter((p) => p.bulanTmt === bulanTmt);
    const perTahap = hitungPerTahap(isi);
    const [y, m] = bulanKirim.split("-").map(Number);
    const hariDalamBulan = new Date(y, m, 0).getDate();
    const tanggal = hariIni.getDate();
    const jendela: JendelaKirim =
      i > 0
        ? { keadaan: "belum", mulaiDalam: Math.round((new Date(y, m - 1, 1).getTime() - awalHariIni) / SEHARI) }
        : tanggal <= batasKirim
          ? { keadaan: "buka", sisaHari: batasKirim - tanggal }
          : { keadaan: "tutup" };
    return {
      bulanKirim,
      bulanTmt,
      jumlah: isi.length,
      perTahap,
      periksaSk: isi.filter(perluPeriksaSk).length,
      jendela,
      hariIni: i === 0 ? tanggal : null,
      hariDalamBulan,
    };
  });
}

/** Kalimat hitung mundur satu bulan pita. */
export function teksJendela(j: JendelaKirim, batasKirim: number, namaBulanKirim: string): string {
  if (j.keadaan === "buka") return j.sisaHari === 0 ? `hari terakhir kirim, ${batasKirim} ${namaBulanKirim}` : `sisa ${j.sisaHari} hari`;
  if (j.keadaan === "tutup") return `ditutup ${batasKirim} ${namaBulanKirim}`;
  return j.mulaiDalam <= 1 ? "dibuka besok" : `dibuka ${j.mulaiDalam} hari lagi`;
}

/* ── Pita ringkas tiga zona (ADR-103) ─────────────────────────────────────── */

/**
 * Keadaan satu bulan TMT di kalender tahunan:
 * - "jendela": TMT yang surat usulannya dikirim bulan ini;
 * - "terlambat": jendela kirimnya sudah lewat dan masih ada yang perlu diusulkan;
 * - "berjalan": semua sudah diusulkan, sebagian masih di Kanwil atau menunggu direkam;
 * - "selesai": semua sudah direkam di Gaji Web;
 * - "belum": jendela kirimnya belum dibuka;
 * - "kosong": tidak ada pegawai dengan TMT bulan itu.
 */
export type KeadaanBulanTmt = "jendela" | "terlambat" | "berjalan" | "selesai" | "belum" | "kosong";

export interface BulanTmtKalender {
  /** "yyyy-mm". */
  bulanTmt: string;
  jumlah: number;
  perTahap: Record<TahapPita, number>;
  keadaan: KeadaanBulanTmt;
}

/**
 * Dua belas bulan TMT satu tahun kalender, Januari sampai Desember, dengan jumlah per tahap yang sama dengan pita dan
 * papan. Sumbernya daftar pegawai dasbor: pegawai yang KGB-nya selesai tahun ini tetap tercatat di bulan TMT itu sampai
 * masa usul siklus berikutnya dibuka (pilihKgbSiklus), jadi tahun berjalan dan tahun depan terbaca utuh.
 */
export function susunKalenderTmt(
  pegawai: readonly PegawaiPita[],
  tahun: number,
  /** Bulan TMT yang suratnya dikirim bulan ini, "yyyy-mm". */
  bulanUsulan: string,
): BulanTmtKalender[] {
  return Array.from({ length: 12 }, (_, i) => {
    const bulanTmt = `${tahun}-${String(i + 1).padStart(2, "0")}`;
    const isi = pegawai.filter((p) => p.bulanTmt === bulanTmt);
    const perTahap = hitungPerTahap(isi);
    const jumlah = isi.length;
    let keadaan: KeadaanBulanTmt;
    if (bulanTmt === bulanUsulan) keadaan = "jendela";
    else if (bulanTmt > bulanUsulan) keadaan = jumlah > 0 ? "belum" : "kosong";
    else if (perTahap.usulkan > 0) keadaan = "terlambat";
    else if (perTahap.kanwil + perTahap.sk > 0) keadaan = "berjalan";
    else keadaan = perTahap.selesai > 0 ? "selesai" : "kosong";
    return { bulanTmt, jumlah, perTahap, keadaan };
  });
}

/** Tahun yang dapat dipilih di kalender: tahun ini dan tahun depan, ditambah tahun lalu bila masih ada yang tertinggal. */
export function tahunKalenderTmt(pegawai: readonly PegawaiPita[], tahunIni: number): number[] {
  const tahun = new Set([tahunIni, tahunIni + 1]);
  for (const p of pegawai) {
    const t = p.bulanTmt ? Number(p.bulanTmt.slice(0, 4)) : NaN;
    if (t === tahunIni - 1) tahun.add(t);
  }
  return [...tahun].sort((a, b) => a - b);
}

export type KeadaanLangkah = "selesai" | "aktif" | "belum";

export interface LangkahJendela {
  kunci: "surat" | "ajukan" | "input" | "rekon";
  keadaan: KeadaanLangkah;
}

/**
 * Empat langkah satu jendela kirim, dari kacamata UPT: kirim surat lewat Srikandi dan ajukan di SIM-KGB (keduanya
 * selesai bila tidak ada lagi yang perlu diusulkan), input Kanwil sepanjang bulan kirim, lalu rekon Gaji Web tanggal
 * 1–15 bulan sesudahnya. Surat dan pengajuan tidak dapat dipisahkan dari data: pengajuan selalu membawa nomor surat.
 */
export function langkahJendela(b: Pick<BulanPita, "jumlah" | "perTahap">): LangkahJendela[] {
  const ada = b.jumlah > 0;
  const sudahDiusulkan = ada && b.perTahap.usulkan === 0;
  const lewatKanwil = sudahDiusulkan && b.perTahap.kanwil === 0;
  const semuaSelesai = ada && b.perTahap.selesai === b.jumlah;
  return [
    { kunci: "surat", keadaan: sudahDiusulkan ? "selesai" : ada ? "aktif" : "belum" },
    { kunci: "ajukan", keadaan: sudahDiusulkan ? "selesai" : ada ? "aktif" : "belum" },
    { kunci: "input", keadaan: lewatKanwil ? "selesai" : sudahDiusulkan ? "aktif" : "belum" },
    { kunci: "rekon", keadaan: semuaSelesai ? "selesai" : "belum" },
  ];
}

/**
 * Rekon Gaji Web yang berlangsung bulan ini: TMT bulan depan, yang suratnya dikirim bulan lalu. Ditampilkan sebagai
 * "Juga bulan ini" agar jendela kirim yang sedang dibuka tidak menutupi pekerjaan siklus sebelumnya.
 */
export function rekonBulanIni(
  pegawai: readonly PegawaiPita[],
  bulanUsulan: string,
): { bulanTmt: string; jumlah: number; selesai: number } {
  const bulanTmt = geserKunciBulan(bulanUsulan, -1);
  const isi = pegawai.filter((p) => p.bulanTmt === bulanTmt);
  return { bulanTmt, jumlah: isi.length, selesai: hitungPerTahap(isi).selesai };
}
