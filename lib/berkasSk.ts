// Berkas di Cloudflare R2. Key objek = pathFile yang tersimpan di basis data: "sk/<nip>_<ts>.pdf"
// untuk SK bertanda tangan, dan "usulan/<satker>_<ts>.pdf" untuk surat usulan UPT. Hanya key di bawah
// kedua folder itu yang dilayani, agar objek lain di bucket tidak ikut terbuka. Dipakai
// /api/blob/download (peran Kanwil), /api/upt/sk/[id] (Admin UPT, dibatasi satker), dan
// /api/usulan/[id]/berkas (peninjau Kanwil serta UPT pengusulnya).

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const POLA_KEY_SK = /^sk\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

/** Normalisasi pathFile jadi key R2 yang sah; null bila di luar folder SK atau mengandung "..". */
export function kunciSk(raw: string): string | null {
  let key: string;
  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split("/");
    key = `sk/${decodeURIComponent(parts[parts.length - 1])}`;
  } catch {
    key = raw.replace(/^\/+/, "");
  }
  if (key.includes("..") || !POLA_KEY_SK.test(key)) return null;
  return key;
}

const POLA_KEY_USULAN = /^usulan\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

/** Normalisasi key berkas surat usulan UPT; null bila di luar folder usulan atau mengandung "..". */
export function kunciUsulan(raw: string): string | null {
  const key = raw.replace(/^\/+/, "");
  if (key.includes("..") || !POLA_KEY_USULAN.test(key)) return null;
  return key;
}

/** Isi berkas SK sebagai respons; 404 bila objeknya tidak ada. */
export async function responsBerkasSk(key: string, namaUnduhan?: string): Promise<NextResponse> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const obj = await env.SK_BUCKET.get(key);
    if (!obj)
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });

    return new NextResponse(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType ?? "application/pdf",
        "Content-Disposition": namaUnduhan ? `inline; filename="${namaUnduhan.replace(/["\\]/g, "")}"` : "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }
}
