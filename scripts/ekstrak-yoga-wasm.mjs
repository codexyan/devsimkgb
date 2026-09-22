// Salin biner WASM yoga-layout (dipakai @react-pdf untuk layout) ke worker/yoga.wasm.
//
// yoga-layout menyimpan WASM-nya sebagai base64 di dalam JS dan mengompilasinya saat
// berjalan, yang dilarang Cloudflare Workers. worker/yogaWasm.js memakai berkas hasil
// skrip ini sebagai modul WASM yang dikompilasi saat deploy.
//
// Jalankan ulang setiap kali versi yoga-layout berubah: node scripts/ekstrak-yoga-wasm.mjs
// (worker/yogaWasm.test.ts gagal bila berkasnya tidak cocok dengan yoga-layout terpasang).

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// yoga-layout yang dipakai @react-pdf/layout; subpath binaries tidak diekspor, jadi dicari
// dari lokasi yoga-layout/load (dist/src/load.js → dist/binaries/).
const akarLayout = path.dirname(path.dirname(require.resolve("@react-pdf/layout")));
const loadYoga = require.resolve("yoga-layout/load", { paths: [akarLayout] });
const berkasYoga = path.join(path.dirname(loadYoga), "..", "binaries", "yoga-wasm-base64-esm.js");

const cocok = readFileSync(berkasYoga, "utf8").match(/data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)/);
if (!cocok) throw new Error(`WASM base64 tidak ditemukan di ${berkasYoga}`);

const wasm = Buffer.from(cocok[1], "base64");
const tujuan = path.join(import.meta.dirname, "..", "worker", "yoga.wasm");
writeFileSync(tujuan, wasm);
console.log(`✓ ${path.relative(process.cwd(), tujuan)} ditulis (${wasm.length} byte). Samakan UKURAN_YOGA_WASM di worker/yogaWasm.js.`);
