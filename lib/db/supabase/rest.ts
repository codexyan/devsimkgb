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

/**
 * Kolom yang ditolak PostgREST karena belum ada di tabel (PGRST204), dari pesan
 * "Could not find the 'nama_kolom' column of 'tabel' in the schema cache".
 */
function kolomBelumAda(teks: string): string | null {
  try {
    const isi = JSON.parse(teks) as { code?: string; message?: string };
    if (isi.code !== "PGRST204") return null;
    return /Could not find the '([^']+)' column/.exec(isi.message ?? "")?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Buang satu kolom dari badan tulis bila nilainya kosong di semua baris; null bila ada yang berisi. */
function tanpaKolomKosong(body: unknown, kolom: string): unknown | null {
  const baris = Array.isArray(body) ? body : [body];
  const kosong = baris.every((b) => b && typeof b === "object" && ((b as Record<string, unknown>)[kolom] ?? null) === null);
  if (!kosong) return null;
  const buang = (b: unknown) => {
    const { [kolom]: _, ...sisa } = b as Record<string, unknown>;
    return sisa;
  };
  return Array.isArray(body) ? body.map(buang) : buang(body);
}

/**
 * Request ke `/rest/v1/{path}`; 429 dan 5xx dicoba ulang dengan jeda bertambah.
 *
 * Kode dapat ter-deploy sebelum migrasinya dijalankan. Agar kolom baru yang belum ada tidak menggagalkan
 * setiap penulisan, kolom yang ditolak PGRST204 dibuang lalu request diulang, asalkan nilainya kosong di
 * semua baris: kolom kosong di tabel sama saja dengan kolom yang tidak ditulis. Nilai yang benar-benar
 * berisi tetap gagal, supaya data tidak hilang diam-diam.
 */
export async function rest(path: string, opsi: OpsiRest = {}): Promise<Response> {
  const { url, kunci } = konfigurasi();
  const headers: Record<string, string> = { apikey: kunci, Accept: "application/json" };
  // Kunci lama (JWT service_role) juga dikirim sebagai Bearer; kunci baru sb_secret_ cukup di header apikey.
  if (!kunci.startsWith("sb_")) headers.Authorization = `Bearer ${kunci}`;
  if (opsi.body !== undefined) headers["Content-Type"] = "application/json";
  if (opsi.prefer?.length) headers.Prefer = opsi.prefer.join(", ");
  let isi = opsi.body;
  let body = isi === undefined ? undefined : JSON.stringify(isi);

  for (let attempt = 0, dibuang = 0; ; attempt++) {
    const res = await fetch(`${url}/rest/v1/${path}`, { method: opsi.method ?? "GET", headers, body });
    if (res.ok) return res;
    const teks = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRY) {
      await sleep(Math.min(8_000, 500 * 2 ** attempt));
      continue;
    }
    const kolom = res.status === 400 && isi !== undefined && dibuang < 8 ? kolomBelumAda(teks) : null;
    const tanpa = kolom ? tanpaKolomKosong(isi, kolom) : null;
    if (kolom && tanpa !== null) {
      console.warn(`[supabase] kolom ${kolom} belum ada di ${path.split("?")[0]}; dilewati karena kosong. Jalankan migrasinya.`);
      isi = tanpa;
      body = JSON.stringify(isi);
      dibuang += 1;
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
