// Bagian server pengaman data (ADR-084): cadangan otomatis ke R2, pemangkasan cadangan lama, berkas di terhapus/,
// dan jejak perubahan di D1 (ADR-085). Dipanggil cron (app/api/cron/cadangan) dan halaman Cadangkan data Super Admin.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { backendData } from "./db";
import { tabelBelumAda } from "./db/tabelBelumAda";
import { klienD1 } from "./db/d1/klien";
import {
  AWALAN_CADANGAN,
  buatCadangan,
  daftarObjek,
  pangkasCadangan,
  sumberBawaan,
  type BucketCadangan,
  type RingkasCadangan,
} from "./cadanganOtomatis";
import { pangkasTerhapus } from "./r2Terhapus";

export const LAMA_SIMPAN_JEJAK_HARI = 90;

export async function bucketCadangan(): Promise<(BucketCadangan & R2Bucket) | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as { SK_BUCKET?: R2Bucket }).SK_BUCKET ?? null) as (BucketCadangan & R2Bucket) | null;
  } catch {
    return null;
  }
}

/** Keadaan jejak perubahan: aktif bila migrasinya sudah dijalankan, dengan jumlah catatan 24 jam terakhir. */
export async function keadaanJejakData(sekarang = new Date()): Promise<{ aktif: boolean; jumlah24Jam: number | null }> {
  if (backendData() !== "d1") return { aktif: false, jumlah24Jam: null };
  const sejak = new Date(sekarang.getTime() - 86_400_000).toISOString();
  try {
    const baris = await (await klienD1()).prepare("SELECT count(*) AS n FROM jejak_data WHERE waktu >= ?").bind(sejak).first<{ n: number }>();
    return { aktif: true, jumlah24Jam: Number(baris?.n ?? 0) };
  } catch (e) {
    if (tabelBelumAda(e)) return { aktif: false, jumlah24Jam: null };
    throw e;
  }
}

/** Buang jejak perubahan yang lebih tua dari masa simpannya; null bila tabelnya belum ada atau bukan D1. */
export async function pangkasJejakData(sekarang = new Date()): Promise<number | null> {
  if (backendData() !== "d1") return null;
  const batas = new Date(sekarang.getTime() - LAMA_SIMPAN_JEJAK_HARI * 86_400_000).toISOString();
  try {
    return (await (await klienD1()).prepare("DELETE FROM jejak_data WHERE waktu < ?").bind(batas).run()).meta.changes ?? 0;
  } catch (e) {
    if (tabelBelumAda(e)) return null;
    throw e;
  }
}

export interface HasilCadanganOtomatis {
  cadangan: RingkasCadangan;
  cadanganDibuang: number | null;
  berkasTerhapusDibuang: number | null;
  jejakDibuang: number | null;
  galat: string[];
}

/**
 * Satu putaran cron: buat cadangan, lalu pangkas yang lama. Pemangkasan baru berjalan sesudah cadangan baru
 * tersimpan, dan kegagalan satu pemangkasan tidak menghentikan yang lain.
 */
export async function jalankanCadanganOtomatis(sekarang = new Date()): Promise<HasilCadanganOtomatis> {
  const bucket = await bucketCadangan();
  if (!bucket) throw new Error("Penyimpanan R2 (SK_BUCKET) tidak tersedia");
  const cadangan = await buatCadangan(bucket, sumberBawaan(), sekarang);
  const galat: string[] = [];
  const coba = async <T>(nama: string, kerja: () => Promise<T>): Promise<T | null> => {
    try {
      return await kerja();
    } catch (e) {
      console.error(`[cadangan] ${nama} gagal:`, e);
      galat.push(`${nama}: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  };
  return {
    cadangan,
    cadanganDibuang: await coba("pangkas cadangan", () => pangkasCadangan(bucket, sekarang)),
    berkasTerhapusDibuang: await coba("pangkas berkas terhapus", () => pangkasTerhapus(bucket, sekarang)),
    jejakDibuang: await coba("pangkas jejak data", () => pangkasJejakData(sekarang)),
    galat,
  };
}

export interface CadanganTersimpan {
  kunci: string;
  dibuat: string;
  ukuran: number;
  total: number | null;
}

/** Cadangan otomatis yang tersimpan, terbaru lebih dulu. */
export async function daftarCadanganOtomatis(bucket: BucketCadangan): Promise<CadanganTersimpan[]> {
  const objek = await daftarObjek(bucket, AWALAN_CADANGAN);
  return objek
    .map((o) => ({
      kunci: o.key,
      dibuat: o.uploaded.toISOString(),
      ukuran: o.size,
      total: o.customMetadata?.total ? Number(o.customMetadata.total) : null,
    }))
    .sort((a, b) => b.dibuat.localeCompare(a.dibuat));
}
