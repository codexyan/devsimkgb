// Klien tingkat rendah Data API Supabase (PostgREST) lewat fetch, sehingga berjalan di
// Cloudflare Workers maupun Node tanpa dependensi tambahan. Hanya untuk server: secret key
// melewati RLS dan tidak boleh sampai ke browser.

const MAX_RETRY = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class GalatSupabase extends Error {
  constructor(
    readonly status: number,
    /** Kode galat Postgres/PostgREST, mis. 23505 untuk nilai unik yang sudah ada. */
    readonly kode: string | null,
    pesan: string,
  ) {
    super(pesan);
    this.name = "GalatSupabase";
  }
}

function konfigurasi(): { url: string; kunci: string } {
  const url = process.env.SUPABASE_URL?.trim();
  const kunci = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !kunci) throw new Error("SUPABASE_URL dan SUPABASE_SECRET_KEY belum di-set di environment.");
  return { url: url.replace(/\/+$/, ""), kunci };
}

export interface OpsiRest {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Isi header Prefer, mis. ["return=representation", "count=exact"]. */
  prefer?: string[];
}

/** Request ke `/rest/v1/{path}`; 429 dan 5xx dicoba ulang dengan jeda bertambah. */
export async function rest(path: string, opsi: OpsiRest = {}): Promise<Response> {
  const { url, kunci } = konfigurasi();
  const headers: Record<string, string> = { apikey: kunci, Accept: "application/json" };
  // Kunci lama (JWT service_role) juga dikirim sebagai Bearer; kunci baru sb_secret_ cukup di header apikey.
  if (!kunci.startsWith("sb_")) headers.Authorization = `Bearer ${kunci}`;
  if (opsi.body !== undefined) headers["Content-Type"] = "application/json";
  if (opsi.prefer?.length) headers.Prefer = opsi.prefer.join(", ");
  const body = opsi.body === undefined ? undefined : JSON.stringify(opsi.body);

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${url}/rest/v1/${path}`, { method: opsi.method ?? "GET", headers, body });
    if (res.ok) return res;
    const teks = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRY) {
      await sleep(Math.min(8_000, 500 * 2 ** attempt));
      continue;
    }
    throw buatGalat(res.status, path, teks);
  }
}

function buatGalat(status: number, path: string, teks: string): GalatSupabase {
  let kode: string | null = null;
  let pesan = teks;
  try {
    const isi = JSON.parse(teks) as { code?: string; message?: string; details?: string; hint?: string };
    kode = isi.code ?? null;
    pesan = [isi.message, isi.details, isi.hint].filter(Boolean).join(" · ") || teks;
  } catch {
    // Bukan JSON; pakai teks apa adanya.
  }
  const tabel = path.split("?")[0];
  return new GalatSupabase(status, kode, `Supabase API error (${status}${kode ? ` ${kode}` : ""}) di ${tabel}: ${pesan}`);
}

/** Jumlah total baris dari header Content-Range, mis. "0-24/75" atau "*\/0". */
export function totalDariContentRange(nilai: string | null): number | null {
  const cocok = nilai?.match(/\/(\d+)$/);
  return cocok ? Number(cocok[1]) : null;
}
