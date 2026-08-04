// Klien tingkat-rendah Google Sheets API v4 (values). Hanya operasi mentah
// atas RANGE sel — pemetaan baris↔objek dilakukan di lib/sheets/table.ts.
//
// Semua request lewat fetch + access token service account, jadi kompatibel
// dengan Cloudflare Workers maupun Node.

import { getAccessToken } from "./auth";

const API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

function sheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID;
  if (!id) throw new Error("GOOGLE_SHEET_ID belum di-set di environment.");
  return id;
}

// Kuota Sheets API ±60 baca & 60 tulis per menit per user; burst panggilan
// (mis. import massal) memicu 429. Coba ulang dengan backoff sebelum menyerah.
const MAX_RETRY = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(path: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const token = await getAccessToken();
    const res = await fetch(`${API_BASE}/${sheetId()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (res.ok) return res;
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRY) {
      await sleep(Math.min(30_000, 2_000 * 2 ** attempt));
      continue;
    }
    throw new Error(`Google Sheets API error (${res.status}) di ${path}: ${text}`);
  }
}

/** Baca seluruh nilai pada sebuah range (mis. "Pegawai!A1:Z"). */
export async function getValues(range: string): Promise<string[][]> {
  const res = await api(`/values/${encodeURIComponent(range)}`);
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

/** Baca beberapa range sekaligus (hemat round-trip untuk join/dashboard). */
export async function batchGetValues(
  ranges: string[],
): Promise<Record<string, string[][]>> {
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const res = await api(`/values:batchGet?${qs}`);
  const data = (await res.json()) as {
    valueRanges?: { range: string; values?: string[][] }[];
  };
  const out: Record<string, string[][]> = {};
  (data.valueRanges ?? []).forEach((vr, i) => {
    out[ranges[i]] = vr.values ?? [];
  });
  return out;
}

/** Tambah satu/lebih baris di akhir tab (atomik per-append). */
export async function appendRows(range: string, rows: string[][]): Promise<void> {
  await api(
    `/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: rows }) },
  );
}

/** Tulis-timpa nilai pada range spesifik (mis. update satu baris). */
export async function updateValues(range: string, rows: string[][]): Promise<void> {
  await api(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: rows }),
  });
}

/** Kosongkan nilai pada range (mis. saat "hapus" baris → dikosongkan). */
export async function clearValues(range: string): Promise<void> {
  await api(`/values/${encodeURIComponent(range)}:clear`, { method: "POST" });
}

/** Metadata spreadsheet: daftar nama tab (dipakai health-check & setup). */
export async function listSheetTitles(): Promise<string[]> {
  const res = await api(`?fields=sheets.properties.title`);
  const data = (await res.json()) as {
    sheets?: { properties: { title: string } }[];
  };
  return (data.sheets ?? []).map((s) => s.properties.title);
}

/** Buat satu tab baru (service account harus punya akses Editor). */
export async function addSheetTab(title: string): Promise<void> {
  await api(`:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title } } }],
    }),
  });
}
