// Berkas R2 yang dihapus tidak langsung lenyap (ADR-084). Objeknya dipindahkan ke awalan terhapus/ dengan kunci asli
// di belakangnya, lalu dibuang cron cadangan sesudah LAMA_SIMPAN_TERHAPUS_HARI. Selama itu berkas usulan, SK, dan
// arsip dokumen yang terhapus karena salah klik masih dapat dikembalikan: salin terhapus/<kunci> ke <kunci>.

export const AWALAN_TERHAPUS = "terhapus/";
export const LAMA_SIMPAN_TERHAPUS_HARI = 90;

/** Bagian R2Bucket yang dipakai di sini, agar dapat diuji dengan tiruan. */
export interface BucketPindah {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: R2HTTPMetadata } | null>;
  put(key: string, value: ArrayBuffer, opsi?: R2PutOptions): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

export function kunciTerhapus(kunci: string): string {
  return `${AWALAN_TERHAPUS}${kunci}`;
}

/**
 * Pindahkan objek ke terhapus/ lalu hapus aslinya. Objek yang gagal disalin tidak dihapus: berkas yatim tidak
 * mengganggu apa pun, sedangkan berkas yang hilang tanpa salinan tidak dapat dikembalikan. Objek yang memang sudah
 * tidak ada dilewati.
 */
export async function pindahkanKeTerhapus(
  bucket: BucketPindah,
  kunci: readonly string[],
  sekarang = new Date(),
): Promise<{ dipindah: number; gagal: string[] }> {
  const gagal: string[] = [];
  const hapus: string[] = [];
  for (const k of new Set(kunci.filter(Boolean))) {
    if (k.startsWith(AWALAN_TERHAPUS)) continue;
    try {
      const objek = await bucket.get(k);
      if (!objek) continue;
      await bucket.put(kunciTerhapus(k), await objek.arrayBuffer(), {
        httpMetadata: objek.httpMetadata,
        customMetadata: { kunciAsal: k, dihapusAt: sekarang.toISOString() },
      });
      hapus.push(k);
    } catch (e) {
      console.error(`[r2] ${k} gagal dipindahkan ke ${AWALAN_TERHAPUS}, tidak dihapus:`, e);
      gagal.push(k);
    }
  }
  for (let i = 0; i < hapus.length; i += 1000) await bucket.delete(hapus.slice(i, i + 1000));
  return { dipindah: hapus.length, gagal };
}

interface BucketDaftar {
  list(opsi: R2ListOptions): Promise<{ objects: { key: string; uploaded: Date }[]; truncated: boolean; cursor?: string }>;
  delete(keys: string | string[]): Promise<void>;
}

/** Buang berkas di terhapus/ yang sudah melewati masa simpan; mengembalikan jumlah yang dibuang. */
export async function pangkasTerhapus(bucket: BucketDaftar, sekarang = new Date()): Promise<number> {
  const batas = sekarang.getTime() - LAMA_SIMPAN_TERHAPUS_HARI * 86_400_000;
  const buang: string[] = [];
  let cursor: string | undefined;
  do {
    const hasil = await bucket.list({ prefix: AWALAN_TERHAPUS, cursor });
    for (const o of hasil.objects) if (o.uploaded.getTime() < batas) buang.push(o.key);
    cursor = hasil.truncated ? hasil.cursor : undefined;
  } while (cursor);
  for (let i = 0; i < buang.length; i += 1000) await bucket.delete(buang.slice(i, i + 1000));
  return buang.length;
}
