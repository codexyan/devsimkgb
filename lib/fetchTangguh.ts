// Pembungkus fetch peramban untuk API SIM-KGB (/api/*).
//
// Cloudflare kadang menolak permintaan dengan halaman HTML 503 (Worker melewati batas sumber daya).
// Tanpa pembungkus ini, pemanggil yang membaca res.json() gagal dengan pesan teknis
// "Unexpected token '<'". Pembungkus ini:
//   - mengulang permintaan GET dan HEAD yang ditolak 502, 503, atau 504, dengan jeda yang makin panjang;
//     permintaan yang mengubah data tidak diulang, agar tidak tercatat dua kali;
//   - mengganti galat 5xx berbadan non-JSON menjadi JSON { error } berpesan jelas, bentuk yang sudah
//     dibaca setiap pemanggil.

export const PESAN_SERVER_SIBUK = "Server sedang sibuk. Tunggu sebentar, lalu coba lagi.";
export const PESAN_GALAT_SERVER = "Terjadi galat di server. Coba lagi beberapa saat lagi.";

const STATUS_SIBUK = new Set([502, 503, 504]);

type Fetch = typeof fetch;

interface OpsiTangguh {
  /** Jeda sebelum tiap pengulangan, dalam milidetik. */
  jeda?: number[];
  /** Asal (origin) halaman; hanya permintaan ke asal ini yang dibungkus. */
  asal: string;
  tunggu?: (ms: number) => Promise<void>;
}

function alamat(input: RequestInfo | URL, asal: string): URL | null {
  try {
    const teks = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return new URL(teks, asal);
  } catch {
    return null;
  }
}

function metode(input: RequestInfo | URL, init?: RequestInit): string {
  const dariRequest = typeof Request !== "undefined" && input instanceof Request ? input.method : "GET";
  return (init?.method ?? dariRequest).toUpperCase();
}

function berbadanJson(res: Response): boolean {
  return (res.headers.get("content-type") ?? "").toLowerCase().includes("json");
}

/** fetch yang dibungkus; dipisah dari pemasangannya agar dapat diuji tanpa peramban. */
export function bungkusFetch(asli: Fetch, opsi: OpsiTangguh): Fetch {
  const jeda = opsi.jeda ?? [1000, 3000];
  const tunggu = opsi.tunggu ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const asal = new URL(opsi.asal).origin;

  return async (input, init) => {
    const url = alamat(input, asal);
    if (!url || url.origin !== asal || !url.pathname.startsWith("/api/")) return asli(input, init);

    const bolehUlang = ["GET", "HEAD"].includes(metode(input, init));
    let res = await asli(input, init);
    if (bolehUlang) {
      for (const ms of jeda) {
        if (!STATUS_SIBUK.has(res.status)) break;
        await tunggu(ms);
        res = await asli(input, init);
      }
    }

    if (res.status >= 500 && !berbadanJson(res)) {
      const error = STATUS_SIBUK.has(res.status) ? PESAN_SERVER_SIBUK : PESAN_GALAT_SERVER;
      return new Response(JSON.stringify({ error }), {
        status: res.status,
        statusText: res.statusText,
        headers: { "Content-Type": "application/json" },
      });
    }
    return res;
  };
}

let terpasang = false;

/** Pasang sekali di peramban; tidak berbuat apa pun saat dirender di server. */
export function pasangFetchTangguh(): void {
  if (terpasang || typeof window === "undefined") return;
  terpasang = true;
  window.fetch = bungkusFetch(window.fetch.bind(window), { asal: window.location.origin });
}
