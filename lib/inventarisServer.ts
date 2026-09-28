// Bagian server inventarisasi data KGB pegawai Kanwil: kiriman formulir publik disimpan di R2 (SK_BUCKET),
// tanpa tabel basis data, sehingga tidak ada migrasi yang harus dijalankan.
//
//   inventaris/_konfigurasi.json          { terbuka, kode, batas } — diatur Super Admin di dashboard
//   inventaris/<NIP>/data.json            isian terakhir, urutan kiriman, dan daftar berkasnya
//   inventaris/<NIP>/<NIP>_<Jenis>_<Tanggal>.pdf
//
// Kiriman ulang dari NIP yang sama menggantikan yang lama: berkas lama dihapus, data.json ditimpa, dan urutan
// kirimannya naik. Nama berkas dan kolom rekap mengikuti lib/inventarisKgb.ts.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { IsianInventaris, JenisBerkasInventaris } from "./inventarisKgb";

const AWALAN = "inventaris/";
const KUNCI_KONFIGURASI = `${AWALAN}_konfigurasi.json`;

export interface KonfigurasiInventaris {
  terbuka: boolean;
  /** Kode akses yang diumumkan di grup WA; dibandingkan tanpa peka huruf besar-kecil. */
  kode: string;
  /**
   * Batas pengisian "yyyy-mm-ddTHH:mm" WITA; kosong berarti tanpa batas. Lewat dari itu formulir tertutup sendiri
   * (keadaanFormulir di lib/inventarisKgb.ts) sampai Super Admin menyimpan batas yang baru.
   */
  tutupPada?: string;
  /** Teks batas bebas dari pengaturan lama, sebelum ada tutupPada; hanya ditampilkan, tidak menutup formulir. */
  batas: string;
  diubahOleh?: string;
  diubahAt?: string;
}

export interface BerkasTersimpan {
  jenis: JenisBerkasInventaris;
  nama: string;
  kunci: string;
  ukuran: number;
}

export interface KirimanInventaris {
  isian: IsianInventaris;
  kirimanKe: number;
  /** ISO */
  waktu: string;
  berkas: BerkasTersimpan[];
}

type Bucket = R2Bucket;

async function bucket(): Promise<Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  return env.SK_BUCKET;
}

const KONFIGURASI_AWAL: KonfigurasiInventaris = { terbuka: false, kode: "", batas: "" };

export async function bacaKonfigurasi(): Promise<KonfigurasiInventaris> {
  try {
    const obj = await (await bucket()).get(KUNCI_KONFIGURASI);
    if (!obj) return KONFIGURASI_AWAL;
    return { ...KONFIGURASI_AWAL, ...((await obj.json()) as Partial<KonfigurasiInventaris>) };
  } catch {
    return KONFIGURASI_AWAL;
  }
}

export async function simpanKonfigurasi(k: KonfigurasiInventaris): Promise<void> {
  await (await bucket()).put(KUNCI_KONFIGURASI, JSON.stringify(k), { httpMetadata: { contentType: "application/json" } });
}

export const kunciData = (nip: string) => `${AWALAN}${nip}/data.json`;
export const kunciBerkas = (nip: string, nama: string) => `${AWALAN}${nip}/${nama}`;

/** Kunci berkas inventaris yang sah: inventaris/<NIP>/<NIP>_<Jenis>[_yyyy-mm-dd].pdf. */
export function kunciBerkasSah(kunci: string): boolean {
  return /^inventaris\/(\d{18})\/\1_(SK-KGB-Terakhir|SK-KP-Terakhir|SK-CPNS|SK-PNS)(_\d{4}-\d{2}-\d{2})?\.pdf$/.test(kunci);
}

export async function bacaKiriman(nip: string): Promise<KirimanInventaris | null> {
  const obj = await (await bucket()).get(kunciData(nip));
  return obj ? ((await obj.json()) as KirimanInventaris) : null;
}

/**
 * Simpan satu kiriman. Berkas lama NIP itu dihapus lebih dulu, karena kiriman terbaru yang berlaku dan keadaan
 * KGB-nya bisa berganti (berkas yang diminta pun berganti).
 */
export async function simpanKiriman(
  isian: IsianInventaris,
  berkas: { jenis: JenisBerkasInventaris; nama: string; isi: ArrayBuffer }[],
): Promise<KirimanInventaris> {
  const b = await bucket();
  const lama = await bacaKiriman(isian.nip);
  const daftarLama = await b.list({ prefix: `${AWALAN}${isian.nip}/` });
  const hapus = daftarLama.objects.map((o) => o.key).filter((k) => k !== kunciData(isian.nip));
  if (hapus.length > 0) await b.delete(hapus);

  const tersimpan: BerkasTersimpan[] = [];
  for (const f of berkas) {
    const kunci = kunciBerkas(isian.nip, f.nama);
    await b.put(kunci, f.isi, { httpMetadata: { contentType: "application/pdf" } });
    tersimpan.push({ jenis: f.jenis, nama: f.nama, kunci, ukuran: f.isi.byteLength });
  }
  const kiriman: KirimanInventaris = {
    isian,
    kirimanKe: (lama?.kirimanKe ?? 0) + 1,
    waktu: new Date().toISOString(),
    berkas: tersimpan,
  };
  await b.put(kunciData(isian.nip), JSON.stringify(kiriman), { httpMetadata: { contentType: "application/json" } });
  return kiriman;
}

/** Semua kiriman, terbaru lebih dulu. */
export async function daftarKiriman(): Promise<KirimanInventaris[]> {
  const b = await bucket();
  const kunci: string[] = [];
  let kursor: string | undefined;
  do {
    const hasil = await b.list({ prefix: AWALAN, cursor: kursor });
    for (const o of hasil.objects) if (o.key.endsWith("/data.json")) kunci.push(o.key);
    kursor = hasil.truncated ? hasil.cursor : undefined;
  } while (kursor);
  const semua = await Promise.all(
    kunci.map(async (k) => {
      const obj = await b.get(k);
      return obj ? ((await obj.json()) as KirimanInventaris) : null;
    }),
  );
  return semua.filter((k): k is KirimanInventaris => !!k).sort((a, b2) => b2.waktu.localeCompare(a.waktu));
}

/** Hapus seluruh kiriman satu NIP (data dan berkasnya). */
export async function hapusKiriman(nip: string): Promise<void> {
  const b = await bucket();
  const daftar = await b.list({ prefix: `${AWALAN}${nip}/` });
  const kunci = daftar.objects.map((o) => o.key);
  if (kunci.length > 0) await b.delete(kunci);
}
