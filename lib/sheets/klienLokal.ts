// Penyimpanan lokal pengganti Google Sheets untuk pengembangan (DATA_BACKEND=lokal).
//
// Meniru operasi mentah di lib/sheets/client.ts atas satu berkas JSON berisi tab dan sel, sehingga
// lib/sheets/table.ts berjalan tanpa perubahan dan tanpa kredensial apa pun. Hanya untuk `npm run dev`
// di komputer sendiri: berkasnya ada di .data-lokal/ (tidak ikut git) dan diisi oleh
// scripts/seed-lokal.ts. Tidak pernah dipakai di Cloudflare Workers (produksi memakai Supabase).

interface Berkas {
  tabs: Record<string, string[][]>;
}

function lokasiBerkas(): string {
  return process.env.DATA_LOKAL_BERKAS?.trim() || ".data-lokal/sim-kgb.json";
}

/** Operasi dijalankan berurutan agar baca-ubah-tulis dari request yang bersamaan tidak saling timpa. */
function berurutan<T>(kerja: () => Promise<T>): Promise<T> {
  const g = globalThis as { __antrianDataLokal?: Promise<unknown> };
  const hasil = (g.__antrianDataLokal ?? Promise.resolve()).then(kerja, kerja);
  g.__antrianDataLokal = hasil.catch(() => undefined);
  return hasil;
}

async function baca(): Promise<Berkas> {
  const fs = await import("node:fs/promises");
  try {
    const isi = JSON.parse(await fs.readFile(lokasiBerkas(), "utf8")) as Partial<Berkas>;
    return { tabs: isi.tabs ?? {} };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { tabs: {} };
    throw e;
  }
}

async function tulis(data: Berkas): Promise<void> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const berkas = lokasiBerkas();
  await fs.mkdir(path.dirname(berkas), { recursive: true });
  const sementara = `${berkas}.${process.pid}.tmp`;
  await fs.writeFile(sementara, JSON.stringify(data));
  await fs.rename(sementara, berkas);
}

/**
 * Uraikan range A1 yang dipakai lib/sheets: "Tab!A1:Z" (seluruh tab), "Tab!1:1" (baris 1),
 * "Tab!A5:Z5" (baris 5), "Tab!A1" (mulai baris 1). Baris 1-based; akhir null = sampai baris terakhir.
 */
export function uraiRange(range: string): { tab: string; awal: number; akhir: number | null } {
  const pisah = range.lastIndexOf("!");
  const tab = (pisah >= 0 ? range.slice(0, pisah) : range).replace(/^'(.*)'$/, "$1");
  const sel = pisah >= 0 ? range.slice(pisah + 1) : "";
  const [kiri, kanan] = sel.split(":");
  const baris = (s: string | undefined) => {
    const m = /^[A-Za-z]*(\d+)$/.exec(s ?? "");
    return m ? Number(m[1]) : null;
  };
  const awal = baris(kiri) ?? 1;
  const akhir = kanan === undefined ? (baris(kiri) !== null && /^\d+$/.test(kiri) ? awal : null) : baris(kanan);
  return { tab, awal, akhir };
}

export async function getValues(range: string): Promise<string[][]> {
  const { tab, awal, akhir } = uraiRange(range);
  const data = await baca();
  const semua = data.tabs[tab] ?? [];
  const potong = semua.slice(awal - 1, akhir === null ? undefined : akhir);
  // Seperti Sheets API: baris kosong di ujung tidak dikembalikan.
  let ujung = potong.length;
  while (ujung > 0 && (potong[ujung - 1] ?? []).every((c) => c === "" || c == null)) ujung--;
  return potong.slice(0, ujung).map((r) => [...r]);
}

export async function batchGetValues(ranges: string[]): Promise<Record<string, string[][]>> {
  const out: Record<string, string[][]> = {};
  for (const r of ranges) out[r] = await getValues(r);
  return out;
}

export function appendRows(range: string, rows: string[][]): Promise<void> {
  return berurutan(async () => {
    const { tab } = uraiRange(range);
    const data = await baca();
    const semua = (data.tabs[tab] ??= []);
    // Sheets menambah sesudah baris terakhir yang berisi; baris kosong bekas hapus di tengah tetap.
    let ujung = semua.length;
    while (ujung > 0 && (semua[ujung - 1] ?? []).every((c) => c === "" || c == null)) ujung--;
    semua.splice(ujung, semua.length - ujung, ...rows.map((r) => [...r]));
    await tulis(data);
  });
}

export function updateValues(range: string, rows: string[][]): Promise<void> {
  return berurutan(async () => {
    const { tab, awal } = uraiRange(range);
    const data = await baca();
    const semua = (data.tabs[tab] ??= []);
    rows.forEach((r, i) => {
      while (semua.length < awal + i) semua.push([]);
      semua[awal - 1 + i] = [...r];
    });
    await tulis(data);
  });
}

export function clearValues(range: string): Promise<void> {
  return berurutan(async () => {
    const { tab, awal, akhir } = uraiRange(range);
    const data = await baca();
    const semua = data.tabs[tab];
    if (!semua) return;
    const batas = Math.min(akhir ?? semua.length, semua.length);
    for (let i = awal - 1; i < batas; i++) semua[i] = (semua[i] ?? []).map(() => "");
    await tulis(data);
  });
}

export async function listSheetTitles(): Promise<string[]> {
  return Object.keys((await baca()).tabs);
}

export function addSheetTab(title: string): Promise<void> {
  return berurutan(async () => {
    const data = await baca();
    data.tabs[title] ??= [];
    await tulis(data);
  });
}
