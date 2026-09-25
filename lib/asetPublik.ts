// Baca berkas dari folder public/ di sisi server.
//
// Cloudflare Workers tidak punya filesystem (fs.readFileSync dari unenv selalu melempar
// "not implemented"), jadi di sana berkas diambil lewat binding ASSETS, yaitu aset statis
// yang sama dengan yang dilayani ke browser. Di Node (next dev, skrip) berkas dibaca dari disk.
// Hasil di-cache per isolate karena berkasnya (font, logo) tidak berubah selama deploy.

import { getCloudflareContext } from "@opennextjs/cloudflare";

const cache = new Map<string, Promise<Uint8Array>>();

function diWorkers(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

async function muat(pathRelatif: string): Promise<Uint8Array> {
  if (diWorkers()) {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.ASSETS) throw new Error("Binding ASSETS tidak tersedia; periksa blok assets di wrangler.jsonc");
    // Host diabaikan binding ASSETS; hanya path yang menentukan berkas.
    const res = await env.ASSETS.fetch(new URL(`/${pathRelatif}`, "https://aset.internal"));
    if (!res.ok) throw new Error(`Aset /${pathRelatif} tidak dapat dibaca (HTTP ${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  const [{ readFile }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
  return new Uint8Array(await readFile(path.join(process.cwd(), "public", pathRelatif)));
}

/** Isi berkas public/<pathRelatif>, mis. "fonts/arial.ttf". */
export function bacaAsetPublik(pathRelatif: string): Promise<Uint8Array> {
  let hasil = cache.get(pathRelatif);
  if (!hasil) {
    hasil = muat(pathRelatif);
    cache.set(pathRelatif, hasil);
    // Kegagalan tidak di-cache, agar permintaan berikutnya mencoba lagi.
    hasil.catch(() => cache.delete(pathRelatif));
  }
  return hasil;
}

/** Berkas public/ sebagai data URL base64, bentuk yang diterima @react-pdf untuk font dan gambar. */
export async function dataUrlAsetPublik(pathRelatif: string, mime: string): Promise<string> {
  const isi = await bacaAsetPublik(pathRelatif);
  return `data:${mime};base64,${Buffer.from(isi).toString("base64")}`;
}
