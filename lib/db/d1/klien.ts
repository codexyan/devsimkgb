// Akses binding Cloudflare D1 (ADR-085). Di Workers dan `next dev` binding `DB` diambil dari konteks Cloudflare
// (wrangler.jsonc d1_databases). Uji memakai tiruan D1 di atas node:sqlite (lib/db/d1/ujiD1.ts) lewat pasangKlienD1.

import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Bagian API D1 yang dipakai lapisan data; dipenuhi D1Database Cloudflare maupun tiruan uji. */
export interface PernyataanD1 {
  bind(...nilai: unknown[]): PernyataanD1;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; meta?: { changes?: number; rows_read?: number } }>;
  run(): Promise<{ meta: { changes?: number } }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

export interface KlienD1 {
  prepare(sql: string): PernyataanD1;
  /** Pernyataan dijalankan berurutan dalam satu transaksi; satu gagal, semuanya dibatalkan. */
  batch(pernyataan: PernyataanD1[]): Promise<{ meta?: { changes?: number } }[]>;
}

let klienUji: KlienD1 | null = null;

/** Khusus uji: pakai klien ini sebagai pengganti binding. null mengembalikan ke binding asli. */
export function pasangKlienD1(klien: KlienD1 | null): void {
  klienUji = klien;
}

export async function klienD1(): Promise<KlienD1> {
  if (klienUji) return klienUji;
  const { env } = await getCloudflareContext({ async: true });
  const db = (env as unknown as { DB?: KlienD1 }).DB;
  if (!db) throw new Error("Binding D1 (DB) belum dipasang di wrangler.jsonc.");
  return db;
}

/** Batas parameter terikat per pernyataan D1. */
export const BATAS_PARAMETER_D1 = 100;
