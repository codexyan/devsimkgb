import { test } from "node:test";
import assert from "node:assert/strict";
import { bungkusFetch, PESAN_GALAT_SERVER, PESAN_SERVER_SIBUK } from "./fetchTangguh";

const ASAL = "https://kgb.contoh.test";
const html503 = () => new Response("<!DOCTYPE html><title>Error 1102</title>", { status: 503, headers: { "Content-Type": "text/html" } });
const json200 = () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });

function palsu(jawaban: (() => Response)[]) {
  const panggilan: { url: string; method: string }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    panggilan.push({ url: String(input), method: init?.method ?? "GET" });
    return (jawaban[panggilan.length - 1] ?? jawaban[jawaban.length - 1])();
  }) as typeof fetch;
  return { f, panggilan };
}

const tanpaJeda = { asal: ASAL, tunggu: async () => {} };

test("GET yang ditolak 503 diulang sampai berhasil", async () => {
  const { f, panggilan } = palsu([html503, html503, json200]);
  const res = await bungkusFetch(f, tanpaJeda)("/api/dashboard");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(panggilan.length, 3);
});

test("503 HTML yang tetap gagal menjadi JSON berpesan jelas", async () => {
  const { f, panggilan } = palsu([html503]);
  const res = await bungkusFetch(f, tanpaJeda)("/api/dashboard");
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { error: PESAN_SERVER_SIBUK });
  assert.equal(panggilan.length, 3, "satu permintaan awal dan dua pengulangan");
});

test("POST tidak diulang, tetapi galatnya tetap dibuat terbaca", async () => {
  const { f, panggilan } = palsu([html503]);
  const res = await bungkusFetch(f, tanpaJeda)("/api/kgb/1/pdf", { method: "POST" });
  assert.equal(panggilan.length, 1);
  assert.deepEqual(await res.json(), { error: PESAN_SERVER_SIBUK });
});

test("galat 500 berbadan HTML diberi pesan galat server", async () => {
  const { f } = palsu([() => new Response("<html>", { status: 500, headers: { "Content-Type": "text/html" } })]);
  const res = await bungkusFetch(f, tanpaJeda)("/api/satker");
  assert.deepEqual(await res.json(), { error: PESAN_GALAT_SERVER });
});

test("galat JSON dari aplikasi dan permintaan di luar /api/ diteruskan apa adanya", async () => {
  const galatAplikasi = () => new Response(JSON.stringify({ error: "Data tidak ditemukan" }), { status: 404, headers: { "Content-Type": "application/json" } });
  const { f, panggilan } = palsu([galatAplikasi, html503]);
  const fetchTangguh = bungkusFetch(f, tanpaJeda);
  assert.deepEqual(await (await fetchTangguh("/api/pegawai/x")).json(), { error: "Data tidak ditemukan" });
  const luar = await fetchTangguh("/fonts/arial.ttf");
  assert.equal(luar.status, 503);
  assert.equal(await luar.text(), "<!DOCTYPE html><title>Error 1102</title>");
  const asalLain = await bungkusFetch(palsu([html503]).f, tanpaJeda)("https://lain.test/api/x");
  assert.equal(asalLain.headers.get("content-type"), "text/html");
  assert.equal(panggilan.length, 2);
});
