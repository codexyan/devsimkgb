// Pembacaan ringan dari Supabase (ADR-079): kolom tertentu saja, batas baris, dan daftar id yang dipotong.
//
// Jalankan: node --import tsx --test lib/db/supabase/table.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { supabase } from "./tables";
import { cariDalam } from "../../dataSatker";

/** Jalankan `kerja` dengan fetch tiruan; tiap URL yang diminta dicatat, jawabannya dari `jawab`. */
async function denganFetch(jawab: (url: URL) => { baris: object[]; total?: number }, kerja: (url: URL[]) => Promise<void>) {
  const asli = globalThis.fetch;
  const env = { url: process.env.SUPABASE_URL, kunci: process.env.SUPABASE_SECRET_KEY };
  process.env.SUPABASE_URL = "https://contoh.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_uji";
  const diminta: URL[] = [];
  globalThis.fetch = (async (masukan: unknown) => {
    const url = new URL(String(masukan));
    diminta.push(url);
    const { baris, total } = jawab(url);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    return new Response(JSON.stringify(baris), {
      status: 200,
      headers: { "content-range": `${offset}-${offset + baris.length - 1}/${total ?? baris.length}` },
    });
  }) as typeof fetch;
  try {
    await kerja(diminta);
  } finally {
    globalThis.fetch = asli;
    process.env.SUPABASE_URL = env.url;
    process.env.SUPABASE_SECRET_KEY = env.kunci;
  }
}

test("findKolom hanya meminta kolom yang disebut dan mengubahnya ke nama aplikasi", async () => {
  await denganFetch(
    () => ({ baris: [{ id: "p1", unit_kerja: "Rutan Kelas IIB Rantau" }] }),
    async (diminta) => {
      const hasil = await supabase.pegawai.findKolom(["id", "unitKerja"]);
      assert.deepEqual(hasil, [{ id: "p1", unitKerja: "Rutan Kelas IIB Rantau" }]);
      assert.equal(diminta[0].searchParams.get("select"), "id,unit_kerja");
    },
  );
});

test("findMany dengan batas meminta paling banyak sekian baris dan berhenti di situ", async () => {
  await denganFetch(
    (url) => ({ baris: Array.from({ length: Number(url.searchParams.get("limit")) }, (_, i) => ({ id: `n${i}` })), total: 5000 }),
    async (diminta) => {
      const hasil = await supabase.notifikasi.findMany({ orderBy: { field: "createdAt", dir: "desc" }, batas: 50 });
      assert.equal(hasil.length, 50);
      assert.equal(diminta.length, 1);
      assert.equal(diminta[0].searchParams.get("limit"), "50");
      assert.match(diminta[0].searchParams.get("order") ?? "", /^created_at\.desc/);
    },
  );
});

test("findMany tanpa batas tetap membaca seluruh halaman", async () => {
  await denganFetch(
    (url) => {
      const offset = Number(url.searchParams.get("offset"));
      return { baris: Array.from({ length: Math.min(1000, 1300 - offset) }, (_, i) => ({ id: `p${offset + i}` })), total: 1300 };
    },
    async (diminta) => {
      const hasil = await supabase.pegawai.findMany();
      assert.equal(hasil.length, 1300);
      assert.deepEqual(diminta.map((u) => u.searchParams.get("offset")), ["0", "1000"]);
    },
  );
});

test("cariDalam memotong daftar id per 150, menggabungkan saringan lain, dan tidak memanggil apa pun untuk daftar kosong", async () => {
  const dipanggil: Record<string, unknown>[] = [];
  const ambil = async (where: Record<string, unknown>) => {
    dipanggil.push(where);
    return (where.pegawaiId as { in: string[] }).in.map((id) => ({ id }));
  };
  const ids = Array.from({ length: 320 }, (_, i) => `p${i}`);
  const hasil = await cariDalam(ambil, "pegawaiId", [...ids, "p0", null, ""], { status: "disetujui" });
  assert.equal(hasil.length, 320, "id ganda dan kosong dibuang");
  assert.deepEqual(dipanggil.map((w) => (w.pegawaiId as { in: string[] }).in.length), [150, 150, 20]);
  assert.ok(dipanggil.every((w) => w.status === "disetujui"));
  dipanggil.length = 0;
  assert.deepEqual(await cariDalam(ambil, "pegawaiId", []), []);
  assert.equal(dipanggil.length, 0);
});
