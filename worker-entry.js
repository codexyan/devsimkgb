// Wrapper worker Cloudflare.
//
// OpenNext menghasilkan `.open-next/worker.js` yang hanya mengekspor handler
// `fetch` (+ Durable Object). Cloudflare Cron Trigger memerlukan handler
// `scheduled`, jadi worker ini membungkus output OpenNext: meneruskan `fetch`
// apa adanya, mengekspor ulang Durable Object, dan menambahkan `scheduled` yang
// memanggil endpoint cron internal (/api/cron/notifikasi) lewat self-reference
// service binding. File .open-next/worker.js dibuat saat `opennextjs-cloudflare
// build`, sebelum wrangler membundel entry ini.
//
// Wrapper ini juga membatasi permintaan cek status KGB publik (/api/public/cek-kgb)
// per alamat IP, karena endpoint itu tanpa login dan dapat dipakai menebak NIP.
//
// Selain itu wrapper memasang WASM yoga-layout hasil deploy untuk @react-pdf (surat KGB),
// karena Workers melarang kompilasi WASM dari bytes saat berjalan (lihat worker/yogaWasm.js).
import openNextWorker from "./.open-next/worker.js";
import { pasangYogaWasm } from "./worker/yogaWasm.js";

pasangYogaWasm();

export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "./.open-next/worker.js";

const PATH_CEK_KGB = "/api/public/cek-kgb";
// Semua permintaan per IP dibatasi longgar, karena pegawai satu kantor (satu alamat IP) dapat
// mengecek status bersamaan. Batas ketat hanya untuk NIP yang tidak ditemukan (jawaban 404),
// yaitu pola menebak NIP.
const BATAS_CEK_KGB_PER_MENIT = 60;
const BATAS_CEK_KGB_TIDAK_DITEMUKAN_PER_MENIT = 10;
const JENDELA_CEK_KGB_MS = 60_000;
const hitunganCekKgb = new Map();
const hitunganTidakDitemukan = new Map();

function alamatIp(request) {
  return request.headers.get("cf-connecting-ip") || "tanpa-ip";
}

/** Entri hitungan IP dalam jendela yang sedang berjalan, atau null. */
function entriBerjalan(peta, ip, sekarang) {
  const entri = peta.get(ip);
  return entri && sekarang - entri.mulai < JENDELA_CEK_KGB_MS ? entri : null;
}

/** Menambah hitungan IP dan mengembalikan jumlah dalam jendela yang sedang berjalan. */
function tambahHitungan(peta, ip, sekarang) {
  if (peta.size > 10_000) {
    for (const [kunci, entri] of peta) {
      if (sekarang - entri.mulai >= JENDELA_CEK_KGB_MS) peta.delete(kunci);
    }
    if (peta.size > 10_000) peta.clear();
  }
  const entri = entriBerjalan(peta, ip, sekarang);
  if (!entri) {
    peta.set(ip, { mulai: sekarang, jumlah: 1 });
    return 1;
  }
  entri.jumlah += 1;
  return entri.jumlah;
}

// Batas semua permintaan memakai binding Workers Rate Limiting CEK_KGB_RATE_LIMITER bila dikonfigurasi
// di wrangler.jsonc (disarankan 60 permintaan per 60 detik). Tanpa binding, dan untuk batas NIP yang
// tidak ditemukan, dipakai hitungan per isolate, yang hanya membatasi sebagian karena permintaan dapat
// dilayani isolate yang berbeda. Galat pembatas tidak menghalangi permintaan.
async function melebihiBatasCekKgb(ip, env, sekarang) {
  if ((entriBerjalan(hitunganTidakDitemukan, ip, sekarang)?.jumlah ?? 0) >= BATAS_CEK_KGB_TIDAK_DITEMUKAN_PER_MENIT) {
    return true;
  }
  try {
    if (env.CEK_KGB_RATE_LIMITER) {
      const { success } = await env.CEK_KGB_RATE_LIMITER.limit({ key: ip });
      return !success;
    }
  } catch (err) {
    console.error("[cek-kgb] pembatas permintaan gagal:", err);
    return false;
  }
  return tambahHitungan(hitunganCekKgb, ip, sekarang) > BATAS_CEK_KGB_PER_MENIT;
}

export default {
  ...openNextWorker,
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname.replace(/\/+$/, "") !== PATH_CEK_KGB) return openNextWorker.fetch(request, env, ctx);

    const ip = alamatIp(request);
    if (await melebihiBatasCekKgb(ip, env, Date.now())) {
      return new Response(
        JSON.stringify({ error: "Terlalu banyak permintaan cek status. Coba lagi dalam satu menit." }),
        { status: 429, headers: { "content-type": "application/json; charset=utf-8", "retry-after": "60" } },
      );
    }
    const res = await openNextWorker.fetch(request, env, ctx);
    if (res.status === 404) tambahHitungan(hitunganTidakDitemukan, ip, Date.now());
    return res;
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        try {
          if (!env.CRON_SECRET) {
            console.error("[cron] CRON_SECRET belum diset; endpoint cron akan menolak panggilan. Set dengan: wrangler secret put CRON_SECRET");
          }
          const res = await env.WORKER_SELF_REFERENCE.fetch(
            new Request("https://sim-kgb.internal/api/cron/notifikasi", {
              headers: { authorization: `Bearer ${env.CRON_SECRET ?? ""}` },
            }),
          );
          if (!res.ok) {
            const keterangan =
              res.status === 401
                ? " (CRON_SECRET tidak cocok)"
                : res.status === 503
                  ? " (CRON_SECRET belum dikonfigurasi)"
                  : "";
            console.error(`[cron] notifikasi gagal: HTTP ${res.status}${keterangan}:`, await res.text());
          }
        } catch (err) {
          console.error("[cron] notifikasi error:", err);
        }
      })(),
    );
  },
};
