// Klien PostgREST: kolom yang belum dimigrasikan tidak boleh menggagalkan penulisan nilai kosong.
//
// Jalankan: node --import tsx --test lib/db/supabase/rest.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import { rest } from "./rest";

const galatKolom = (kolom: string) =>
  new Response(JSON.stringify({ code: "PGRST204", message: `Could not find the '${kolom}' column of 'riwayat_kgb' in the schema cache` }), { status: 400 });

async function denganFetch(jawaban: Response[], kerja: (badan: unknown[]) => Promise<void>) {
  const asli = globalThis.fetch;
  const env = { url: process.env.SUPABASE_URL, kunci: process.env.SUPABASE_SECRET_KEY };
  process.env.SUPABASE_URL = "https://contoh.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "sb_secret_uji";
  const badan: unknown[] = [];
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    badan.push(init?.body ? JSON.parse(String(init.body)) : undefined);
    return jawaban.shift()!;
  }) as typeof fetch;
  try {
    await kerja(badan);
  } finally {
    globalThis.fetch = asli;
    process.env.SUPABASE_URL = env.url;
    process.env.SUPABASE_SECRET_KEY = env.kunci;
  }
}

test("kolom baru yang belum ada dilewati bila nilainya kosong, lalu penulisan diulang", async () => {
  await denganFetch([galatKolom("draf_nomor_surat"), galatKolom("draf_tanggal_surat"), new Response("[]", { status: 201 })], async (badan) => {
    const res = await rest("riwayat_kgb", { method: "POST", body: { id: "k1", draf_nomor_surat: null, draf_tanggal_surat: null } });
    assert.equal(res.status, 201);
    assert.deepEqual(badan.at(-1), { id: "k1" });
  });
});

test("kolom yang belum ada tetap gagal bila nilainya berisi, supaya data tidak hilang diam-diam", async () => {
  await denganFetch([galatKolom("draf_nomor_surat")], async () => {
    await assert.rejects(
      rest("riwayat_kgb?id=eq.k1", { method: "PATCH", body: { draf_nomor_surat: "WP.19-SA.04.04-1" } }),
      /PGRST204/,
    );
  });
});
