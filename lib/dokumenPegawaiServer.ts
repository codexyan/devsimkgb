// Penyimpanan arsip dokumen pegawai di R2 (SK_BUCKET); aturan dan letaknya di lib/dokumenPegawai.ts.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  awalanDokumen,
  kunciBerkasDokumen,
  kunciDaftarDokumen,
  type DokumenArsip,
} from "./dokumenPegawai";

async function bucket(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext({ async: true });
  return env.SK_BUCKET;
}

export async function daftarDokumenArsip(pegawaiId: string): Promise<DokumenArsip[]> {
  try {
    const obj = await (await bucket()).get(kunciDaftarDokumen(pegawaiId));
    const isi = obj ? ((await obj.json()) as DokumenArsip[]) : [];
    return Array.isArray(isi) ? isi : [];
  } catch {
    return [];
  }
}

async function tulisDaftar(pegawaiId: string, daftar: DokumenArsip[]): Promise<void> {
  await (await bucket()).put(kunciDaftarDokumen(pegawaiId), JSON.stringify(daftar), {
    httpMetadata: { contentType: "application/json" },
  });
}

/** Simpan berkas lebih dulu, lalu catat di daftar; berkas tanpa catatan tidak pernah tampil. */
export async function simpanDokumenArsip(pegawaiId: string, dokumen: DokumenArsip, isi: ArrayBuffer): Promise<void> {
  await (await bucket()).put(kunciBerkasDokumen(pegawaiId, dokumen.id), isi, { httpMetadata: { contentType: "application/pdf" } });
  const daftar = await daftarDokumenArsip(pegawaiId);
  await tulisDaftar(pegawaiId, [dokumen, ...daftar.filter((d) => d.id !== dokumen.id)]);
}

/** Hapus satu dokumen arsip; mengembalikan dokumen yang dihapus, atau null bila tidak ada. */
export async function hapusDokumenArsip(pegawaiId: string, id: string): Promise<DokumenArsip | null> {
  const daftar = await daftarDokumenArsip(pegawaiId);
  const dokumen = daftar.find((d) => d.id === id) ?? null;
  if (!dokumen) return null;
  await tulisDaftar(pegawaiId, daftar.filter((d) => d.id !== id));
  await (await bucket()).delete(kunciBerkasDokumen(pegawaiId, id));
  return dokumen;
}

/** Hapus seluruh arsip dokumen pegawai (dipakai saat pegawai dihapus permanen). Best effort. */
export async function hapusSemuaDokumenArsip(pegawaiId: string): Promise<number> {
  const b = await bucket();
  let jumlah = 0;
  let kursor: string | undefined;
  do {
    const hasil = await b.list({ prefix: awalanDokumen(pegawaiId), cursor: kursor });
    const kunci = hasil.objects.map((o) => o.key);
    if (kunci.length > 0) await b.delete(kunci);
    jumlah += kunci.length;
    kursor = hasil.truncated ? hasil.cursor : undefined;
  } while (kursor);
  return jumlah;
}
