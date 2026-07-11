import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Ambil berkas SK PRIVAT dari Cloudflare R2 (server-side via binding). Key objek
// = pathFile yang tersimpan di DB (mis. "sk/<nip>_<ts>.pdf").
export async function GET(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("url") || searchParams.get("path") || searchParams.get("key");
  if (!raw)
    return NextResponse.json({ error: "Path file wajib diisi" }, { status: 400 });

  // Normalisasi jadi key R2. Dukung format lama berupa URL penuh (ambil nama file).
  let key: string;
  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split("/");
    key = `sk/${parts[parts.length - 1]}`;
  } catch {
    key = raw.replace(/^\/+/, "");
  }

  // Cegah path traversal
  if (key.includes(".."))
    return NextResponse.json({ error: "Path tidak valid" }, { status: 400 });

  try {
    const { env } = await getCloudflareContext({ async: true });
    const obj = await env.SK_BUCKET.get(key);
    if (!obj)
      return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });

    return new NextResponse(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType ?? "application/pdf",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  }
}
