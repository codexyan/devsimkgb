// Berkas SK bertanda tangan di Cloudflare R2. Key objek = pathFile yang tersimpan di basis data
// (mis. "sk/<nip>_<ts>.pdf"). Hanya key di bawah "sk/" yang dilayani, agar objek lain di bucket tidak
// ikut terbuka. Dipakai /api/blob/download (peran Kanwil) dan /api/upt/sk/[id] (Admin UPT, dibatasi satker).

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
