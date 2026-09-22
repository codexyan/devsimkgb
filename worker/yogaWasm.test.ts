// Jalankan: node --import tsx --test worker/yogaWasm.test.ts
// worker/yoga.wasm harus sama persis dengan WASM di yoga-layout yang dipakai @react-pdf.
// Bila gagal setelah upgrade dependensi: node scripts/ekstrak-yoga-wasm.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const akarLayout = path.dirname(path.dirname(require.resolve("@react-pdf/layout")));
const loadYoga = require.resolve("yoga-layout/load", { paths: [akarLayout] });
const berkasYoga = path.join(path.dirname(loadYoga), "..", "binaries", "yoga-wasm-base64-esm.js");
const wasmTersalin = readFileSync(path.join(__dirname, "yoga.wasm"));

test("worker/yoga.wasm sama dengan WASM yoga-layout terpasang", () => {
  const base64 = readFileSync(berkasYoga, "utf8").match(/data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)/)?.[1];
  assert.ok(base64, "WASM base64 tidak ditemukan di yoga-layout");
  assert.ok(Buffer.from(base64, "base64").equals(wasmTersalin), "Jalankan ulang: node scripts/ekstrak-yoga-wasm.mjs");
});

test("UKURAN_YOGA_WASM sesuai ukuran worker/yoga.wasm", () => {
  const sumber = readFileSync(path.join(__dirname, "yogaWasm.js"), "utf8");
  const ukuran = Number(sumber.match(/UKURAN_YOGA_WASM = (\d+)/)?.[1]);
  assert.equal(ukuran, wasmTersalin.length);
});
