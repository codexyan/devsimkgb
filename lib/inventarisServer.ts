// Bagian server kegiatan pengumpulan data lewat formulir publik (ADR-022): pengaturan kegiatan dan kiriman disimpan
// di R2 (SK_BUCKET), tanpa tabel basis data, sehingga tidak ada migrasi yang harus dijalankan.
//
//   inventaris/_kegiatan.json                      daftar kegiatan (lib/kegiatanInventaris.ts), diatur Super Admin
//   inventaris/_konfigurasi.json                   pengaturan formulir sebelum ada kegiatan; dibaca bila
//                                                  _kegiatan.json belum ada, sebagai kegiatan "kanwil"
//   inventaris/<NIP>/data.json                     kiriman kegiatan "kanwil" (letak lama, dipertahankan)
//   inventaris/k/<kegiatan>/<NIP>/data.json        kiriman kegiatan lain
//   <folder NIP>/<NIP>_<Jenis>_<Tanggal>.pdf       berkas kiriman
//
// Kiriman ulang dari NIP yang sama dalam satu kegiatan menggantikan yang lama: berkas lama dihapus, data.json
// ditimpa, dan urutan kirimannya naik. Nama berkas dan kolom rekap mengikuti lib/inventarisKgb.ts.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { IsianInventaris, JenisBerkasInventaris } from "./inventarisKgb";
import {
  ID_KEGIATAN_KANWIL,
  awalanKegiatan,
  kegiatanDariKonfigurasiLama,
  kunciBerkasInventarisSah,
  kunciDataKegiatan,
  type Kegiatan,
  type KonfigurasiLama,
} from "./kegiatanInventaris";

const KUNCI_KEGIATAN = "inventaris/_kegiatan.json";
const KUNCI_KONFIGURASI_LAMA = "inventaris/_konfigurasi.json";

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

async function bacaJson<T>(b: Bucket, kunci: string): Promise<T | null> {
  const obj = await b.get(kunci);
  return obj ? ((await obj.json()) as T) : null;
}

/**
 * Semua kegiatan, kegiatan "kanwil" lebih dulu. Selama _kegiatan.json belum ada, kegiatan "kanwil" dibentuk dari
 * pengaturan formulir lama, sehingga formulir yang sedang berjalan tidak berubah sampai Super Admin menyimpan.
 */
export async function daftarKegiatan(): Promise<Kegiatan[]> {
  const b = await bucket();
  const tersimpan = await bacaJson<Kegiatan[]>(b, KUNCI_KEGIATAN).catch(() => null);
  const semua = Array.isArray(tersimpan) ? tersimpan : [];
  if (!semua.some((k) => k.id === ID_KEGIATAN_KANWIL)) {
    const lama = await bacaJson<KonfigurasiLama>(b, KUNCI_KONFIGURASI_LAMA).catch(() => null);
    semua.unshift(kegiatanDariKonfigurasiLama(lama));
  }
  return semua.map((k) => ({ ...k, satker: Array.isArray(k.satker) ? k.satker : [] }));
}

export async function bacaKegiatan(id: string): Promise<Kegiatan | null> {
  return (await daftarKegiatan()).find((k) => k.id === id) ?? null;
}

/** Tambah atau ganti satu kegiatan menurut id-nya. */
export async function simpanKegiatan(kegiatan: Kegiatan): Promise<void> {
  const semua = await daftarKegiatan();
  const i = semua.findIndex((k) => k.id === kegiatan.id);
  if (i >= 0) semua[i] = kegiatan;
  else semua.push(kegiatan);
  await (await bucket()).put(KUNCI_KEGIATAN, JSON.stringify(semua), { httpMetadata: { contentType: "application/json" } });
}

const folderNip = (kegiatan: string, nip: string) => `${awalanKegiatan(kegiatan)}${nip}/`;
export const kunciData = (kegiatan: string, nip: string) => `${folderNip(kegiatan, nip)}data.json`;
export const kunciBerkas = (kegiatan: string, nip: string, nama: string) => `${folderNip(kegiatan, nip)}${nama}`;

/** Kunci berkas inventaris yang sah, pada letak lama maupun letak kegiatan. */
export function kunciBerkasSah(kunci: string): boolean {
  return kunciBerkasInventarisSah(kunci);
}

export async function bacaKiriman(kegiatan: string, nip: string): Promise<KirimanInventaris | null> {
  return bacaJson<KirimanInventaris>(await bucket(), kunciData(kegiatan, nip));
}

/**
 * Simpan satu kiriman. Berkas lama NIP itu di kegiatan yang sama dihapus lebih dulu, karena kiriman terbaru yang
 * berlaku dan keadaan KGB-nya bisa berganti (berkas yang diminta pun berganti).
 */
export async function simpanKiriman(
  kegiatan: string,
  isian: IsianInventaris,
  berkas: { jenis: JenisBerkasInventaris; nama: string; isi: ArrayBuffer }[],
): Promise<KirimanInventaris> {
  const b = await bucket();
  const lama = await bacaKiriman(kegiatan, isian.nip);
  const daftarLama = await b.list({ prefix: folderNip(kegiatan, isian.nip) });
  const hapus = daftarLama.objects.map((o) => o.key).filter((k) => k !== kunciData(kegiatan, isian.nip));
  if (hapus.length > 0) await b.delete(hapus);

  const tersimpan: BerkasTersimpan[] = [];
  for (const f of berkas) {
    const kunci = kunciBerkas(kegiatan, isian.nip, f.nama);
    await b.put(kunci, f.isi, { httpMetadata: { contentType: "application/pdf" } });
    tersimpan.push({ jenis: f.jenis, nama: f.nama, kunci, ukuran: f.isi.byteLength });
  }
  const kiriman: KirimanInventaris = {
    isian,
    kirimanKe: (lama?.kirimanKe ?? 0) + 1,
    waktu: new Date().toISOString(),
    berkas: tersimpan,
  };
  await b.put(kunciData(kegiatan, isian.nip), JSON.stringify(kiriman), { httpMetadata: { contentType: "application/json" } });
  return kiriman;
}

/** Semua kiriman satu kegiatan, terbaru lebih dulu. */
export async function daftarKiriman(kegiatan: string): Promise<KirimanInventaris[]> {
  const b = await bucket();
  const kunci: string[] = [];
  let kursor: string | undefined;
  do {
    const hasil = await b.list({ prefix: awalanKegiatan(kegiatan), cursor: kursor });
    for (const o of hasil.objects) if (kunciDataKegiatan(kegiatan, o.key)) kunci.push(o.key);
    kursor = hasil.truncated ? hasil.cursor : undefined;
  } while (kursor);
  const semua = await Promise.all(kunci.map((k) => bacaJson<KirimanInventaris>(b, k)));
  return semua.filter((k): k is KirimanInventaris => !!k).sort((a, b2) => b2.waktu.localeCompare(a.waktu));
}

/** Hapus seluruh kiriman satu NIP pada satu kegiatan (data dan berkasnya). */
export async function hapusKiriman(kegiatan: string, nip: string): Promise<void> {
  const b = await bucket();
  const daftar = await b.list({ prefix: folderNip(kegiatan, nip) });
  const kunci = daftar.objects.map((o) => o.key);
  if (kunci.length > 0) await b.delete(kunci);
}
