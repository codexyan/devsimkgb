// WASM yoga-layout untuk @react-pdf di Cloudflare Workers.
//
// yoga-layout (Emscripten) menyimpan WASM-nya sebagai base64 dan mengompilasinya saat berjalan
// lewat WebAssembly.instantiate(bytes, imports). Workers melarang kompilasi WASM dari bytes
// ("Wasm code generation disallowed by embedder"); hanya modul yang dikompilasi saat deploy
// yang boleh dipakai. Wrangler membundel yoga.wasm sebagai modul terkompilasi, dan
// pasangYogaWasm() mengalihkan instantiate dari bytes yoga ke modul itu.
//
// yoga.wasm disalin dari yoga-layout terpasang oleh scripts/ekstrak-yoga-wasm.mjs;
// worker/yogaWasm.test.ts memastikan isinya tetap sama dengan versi yang dipakai @react-pdf.

import yogaWasm from "./yoga.wasm";

/** Ukuran biner WASM yoga-layout 3.2.1, untuk mengenali instantiate milik yoga. */
export const UKURAN_YOGA_WASM = 71736;

function ukuranBytes(sumber) {
  if (sumber instanceof ArrayBuffer) return sumber.byteLength;
  if (ArrayBuffer.isView(sumber)) return sumber.byteLength;
  return -1;
}

let terpasang = false;

export function pasangYogaWasm() {
  if (terpasang) return;
  terpasang = true;
  const instantiateAsli = WebAssembly.instantiate.bind(WebAssembly);
  // Kompilasi dari bytes selalu ditolak di Workers, sehingga pengalihan ini tidak mengubah
  // perilaku WASM lain: hanya bytes seukuran yoga yang diganti modul hasil deploy.
  WebAssembly.instantiate = function instantiate(sumber, imports) {
    if (ukuranBytes(sumber) === UKURAN_YOGA_WASM) {
      // instantiate(bytes) menghasilkan { module, instance }; instantiate(Module) hanya Instance.
      return instantiateAsli(yogaWasm, imports).then((instance) => ({ module: yogaWasm, instance }));
    }
    return instantiateAsli(sumber, imports);
  };
}
