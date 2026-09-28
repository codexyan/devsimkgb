// Penyimpanan arsip dokumen pegawai di R2 (SK_BUCKET); aturan dan letaknya di lib/dokumenPegawai.ts.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { newId } from "./sheets/id";
import {
  JENIS_DARI_BERKAS_INVENTARIS,
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

/**
 * Salin berkas kiriman formulir ke arsip dokumen pegawai (ADR-024). Berkas yang sudah pernah disalin dilewati,
 * dikenali dari kunci asalnya, sehingga menandai ulang kiriman tidak menggandakan dokumen. Mengembalikan jumlah
 * dokumen baru. Best effort: berkas yang gagal dibaca dilewati.
 */
export async function salinBerkasKeArsip(
  pegawaiId: string,
  berkas: { jenis: string; nama: string; kunci: string; ukuran: number }[],
  konteks: { oleh: string; keterangan: string; nomorSK: string },
): Promise<number> {
  const b = await bucket();
  const daftar = await daftarDokumenArsip(pegawaiId);
  const sudah = new Set(daftar.map((d) => d.asal).filter(Boolean));
  const baru: DokumenArsip[] = [];
  for (const f of berkas) {
    if (sudah.has(f.kunci)) continue;
    const jenis = JENIS_DARI_BERKAS_INVENTARIS[f.jenis];
    if (!jenis) continue;
    const obj = await b.get(f.kunci).catch(() => null);
    if (!obj) continue;
    const id = newId();
    await b.put(kunciBerkasDokumen(pegawaiId, id), await obj.arrayBuffer(), {
      httpMetadata: { contentType: "application/pdf" },
    });
    baru.push({
      id,
      jenis,
      // Nomor SK kiriman hanya diketahui untuk SK dasarnya; berkas lain dibiarkan kosong agar tidak keliru.
      nomorSK: f.jenis === "SK-KGB-Terakhir" || f.jenis === "SK-CPNS" ? konteks.nomorSK : "",
      tanggalSK: /_(\d{4}-\d{2}-\d{2})\.pdf$/.exec(f.nama)?.[1] ?? "",
      keterangan: konteks.keterangan,
      namaBerkas: f.nama,
      ukuran: f.ukuran,
      diunggahOleh: konteks.oleh,
      diunggahAt: new Date().toISOString(),
      asal: f.kunci,
    });
  }
  if (baru.length > 0) await tulisDaftar(pegawaiId, [...baru, ...daftar]);
  return baru.length;
}
