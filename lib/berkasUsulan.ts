// Berkas pendukung usulan UPT di R2: penyimpanan dan penghapusannya. Dipakai bersama oleh rute
// penyimpanan draf, penyuntingan draf, dan pembatalan usulan, agar aturan ukuran dan pemeriksaan
// bentuk PDF-nya satu tempat saja.

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { BATAS_BERKAS_USULAN_BYTE, BERKAS_USULAN, PESAN_BERKAS_TERLALU_BESAR } from "./usulanPegawai";
import { adaPenandaPdf } from "./prosesKgb";

// Batasnya didefinisikan di lib/usulanPegawai.ts agar formulir di peramban memeriksa hal yang sama sebelum mengunggah.
export const BATAS_BERKAS_BYTE = BATAS_BERKAS_USULAN_BYTE;
export const PESAN_TERLALU_BESAR = PESAN_BERKAS_TERLALU_BESAR;

export type KunciBerkasUsulan = (typeof BERKAS_USULAN)[number]["kunci"];
type Bucket = { delete(keys: string | string[]): Promise<void> };

/**
 * Simpan berkas PDF yang disertakan formulir. Hanya berkas yang benar-benar dikirim yang disimpan,
 * sehingga penyuntingan draf tanpa mengunggah ulang tidak menghapus berkas yang sudah ada.
 */
export async function simpanBerkasUsulan(
  form: FormData,
  kode: string,
): Promise<{ jalur: Partial<Record<KunciBerkasUsulan, string>> } | { galat: NextResponse }> {
  const jalur: Partial<Record<KunciBerkasUsulan, string>> = {};
  for (const berkas of BERKAS_USULAN) {
    const isi = form.get(berkas.medan);
    if (!(isi instanceof File) || isi.size === 0) continue;
    if (isi.type !== "application/pdf")
      return { galat: NextResponse.json({ error: `${berkas.label} harus berupa PDF` }, { status: 400 }) };
    if (isi.size > BATAS_BERKAS_BYTE)
      return { galat: NextResponse.json({ error: PESAN_TERLALU_BESAR }, { status: 413 }) };
    if (!adaPenandaPdf(new Uint8Array(await isi.slice(0, 1024).arrayBuffer())))
      return { galat: NextResponse.json({ error: `${berkas.label} bukan PDF yang valid` }, { status: 400 }) };
    const kunciObjek = `usulan/${kode}_${berkas.medan}_${Date.now()}.pdf`;
    try {
      const { env } = await getCloudflareContext({ async: true });
      await env.SK_BUCKET.put(kunciObjek, await isi.arrayBuffer(), { httpMetadata: { contentType: "application/pdf" } });
    } catch {
      return { galat: NextResponse.json({ error: `Gagal menyimpan ${berkas.label}. Coba lagi.` }, { status: 500 }) };
    }
    jalur[berkas.kunci] = kunciObjek;
  }
  return { jalur };
}

/**
 * Hapus objek berkas usulan. Best effort: kegagalannya tidak membatalkan perubahan basis data, karena
 * berkas yatim di R2 tidak terlihat pengguna dan tidak menghalangi apa pun.
 */
export async function hapusBerkasUsulan(jalur: readonly string[]): Promise<void> {
  const daftar = jalur.filter(Boolean);
  if (daftar.length === 0) return;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as unknown as { SK_BUCKET?: Bucket }).SK_BUCKET;
    if (bucket) await bucket.delete([...daftar]);
  } catch {
    // Diabaikan dengan sengaja; lihat keterangan di atas.
  }
}
