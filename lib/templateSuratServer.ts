// Bagian server template surat KGB (ADR-019): memuat versi dari basis data dan menyimpan serta menyajikan
// logo kop di R2. Logika murninya di lib/templateSurat.ts.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { db } from "./db";
import { tabelBelumAda } from "./db/tabelBelumAda";
import { normalisasiTemplate, type VersiTemplate } from "./templateSurat";
import type { TemplateSuratRow } from "./sheets/tables";

export const PESAN_TEMPLATE_BELUM_AKTIF =
  "Template surat belum dapat disimpan: tabel template_surat belum dibuat di basis data. Minta pengelola menjalankan migrasinya. Sampai itu, SK memakai templat bawaan.";

export interface VersiTemplateLengkap extends VersiTemplate {
  catatan: string | null;
  dibuatOleh: string | null;
  dibuatAt: Date | null;
}

/**
 * Semua versi template. Isi yang rusak dilewati (bukan menggagalkan pembuatan SK), dan tabel yang belum
 * dimigrasikan dijawab sebagai daftar kosong dengan penanda belumAktif; SK lalu memakai templat bawaan.
 */
export async function muatVersiTemplate(): Promise<{ belumAktif: boolean; versi: VersiTemplateLengkap[] }> {
  let baris: TemplateSuratRow[];
  try {
    baris = (await db.templateSurat.findMany()) as TemplateSuratRow[];
  } catch (e) {
    if (tabelBelumAda(e)) return { belumAktif: true, versi: [] };
    throw e;
  }
  const versi: VersiTemplateLengkap[] = [];
  for (const b of baris) {
    if (!b.berlakuMulai) continue;
    try {
      versi.push({
        id: b.id,
        versi: Number(b.versi) || 0,
        berlakuMulai: b.berlakuMulai,
        isi: normalisasiTemplate(JSON.parse(b.isi)),
        catatan: b.catatan,
        dibuatOleh: b.dibuatOleh,
        dibuatAt: b.dibuatAt,
      });
    } catch {
      // JSON rusak: versi ini tidak dipakai.
    }
  }
  versi.sort((a, b) => b.versi - a.versi);
  return { belumAktif: false, versi };
}

/* ── Logo kop di R2 ─────────────────────────────────────────────────────────────────────────────── */

export const BATAS_LOGO_BYTE = 500 * 1024;

type BucketLogo = {
  put(key: string, isi: ArrayBuffer, opsi: { httpMetadata: { contentType: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
};

async function bucket(): Promise<BucketLogo | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as { SK_BUCKET?: BucketLogo }).SK_BUCKET) ?? null;
  } catch {
    return null;
  }
}

/** Tanda tangan berkas PNG dan JPEG, agar yang diunggah memang gambar dan bukan berkas lain berganti nama. */
export function jenisGambar(awal: Uint8Array): "png" | "jpg" | null {
  if (awal.length >= 8 && awal[0] === 0x89 && awal[1] === 0x50 && awal[2] === 0x4e && awal[3] === 0x47) return "png";
  if (awal.length >= 3 && awal[0] === 0xff && awal[1] === 0xd8 && awal[2] === 0xff) return "jpg";
  return null;
}

/** Simpan logo; mengembalikan kuncinya ("template/logo_….png"), atau null bila R2 tidak tersedia. */
export async function simpanLogo(isi: ArrayBuffer, jenis: "png" | "jpg"): Promise<string | null> {
  const b = await bucket();
  if (!b) return null;
  const kunci = `template/logo_${Date.now()}.${jenis}`;
  await b.put(kunci, isi, { httpMetadata: { contentType: jenis === "png" ? "image/png" : "image/jpeg" } });
  return kunci;
}

export async function ambilLogo(kunci: string): Promise<{ isi: ArrayBuffer; tipe: string } | null> {
  const b = await bucket();
  const obj = b ? await b.get(kunci) : null;
  if (!obj) return null;
  return { isi: await obj.arrayBuffer(), tipe: obj.httpMetadata?.contentType ?? (kunci.endsWith(".png") ? "image/png" : "image/jpeg") };
}
