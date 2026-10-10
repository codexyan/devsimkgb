// Wrapper worker Cloudflare.
//
// OpenNext menghasilkan `.open-next/worker.js` yang hanya mengekspor handler
// `fetch` (+ Durable Object). Cloudflare Cron Trigger memerlukan handler
// `scheduled`, jadi worker ini membungkus output OpenNext: meneruskan `fetch`
// apa adanya, mengekspor ulang Durable Object, dan menambahkan `scheduled` yang
// memanggil endpoint cron internal (/api/cron/cadangan dan /api/cron/notifikasi)
// lewat self-reference service binding. File .open-next/worker.js dibuat saat `opennextjs-cloudflare
// build`, sebelum wrangler membundel entry ini.
//
// Wrapper ini juga membatasi permintaan cek status KGB publik (/api/public/cek-kgb) per alamat IP dan
// per NIP lewat Durable Object PembatasCekKgb, karena endpoint itu tanpa login dan dapat dipakai menebak
// NIP atau tempat lahir seseorang.
import { DurableObject } from "cloudflare:workers";
import openNextWorker from "./.open-next/worker.js";
import { AturanPembatasCek, pesanDitahan } from "./lib/pembatasCekKgb.ts";

export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "./.open-next/worker.js";

const PATH_CEK_KGB = "/api/public/cek-kgb";
// Semua permintaan per IP dibatasi longgar, karena pegawai satu kantor (satu alamat IP) dapat
// mengecek status bersamaan. Batas ketat hanya untuk NIP yang tidak ditemukan (jawaban 404),
// yaitu pola menebak NIP.
// Batas cadangan per isolate bila Durable Object dan binding ratelimits sama-sama tidak dapat dipakai.
const BATAS_CEK_KGB_PER_MENIT = 30;
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

/**
 * Penghitung tunggal cek status KGB publik untuk semua pusat data (lib/pembatasCekKgb.ts). Satu instance
 * bernama "global"; hitungan di memori sudah cukup, karena jendelanya hanya menit dan instance tetap hidup
 * selama ada permintaan. Dipanggil lewat RPC dari fetch di bawah.
 */
export class PembatasCekKgb extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.aturan = new AturanPembatasCek();
  }

  periksa(ip, nip) {
    return this.aturan.periksa(ip, nip, Date.now());
  }

  catatGagal(ip, nip) {
    this.aturan.catatGagal(ip, nip, Date.now());
  }
}

/** Stub Durable Object pembatas cek KGB, atau null bila binding-nya tidak ada. */
function pembatas(env) {
  try {
    return env.PEMBATAS_CEK_KGB ? env.PEMBATAS_CEK_KGB.get(env.PEMBATAS_CEK_KGB.idFromName("global")) : null;
  } catch {
    return null;
  }
}

/** NIP dari isi permintaan POST, tanpa menghabiskan isi aslinya. */
async function nipDari(request) {
  try {
    const isi = await request.clone().json();
    return typeof isi?.nip === "string" ? isi.nip.replace(/\s+/g, "") : "";
  } catch {
    return "";
  }
}

function jawabDitahan(pesan, detik) {
  return new Response(JSON.stringify({ error: pesan }), {
    status: 429,
    headers: { "content-type": "application/json; charset=utf-8", "retry-after": String(detik) },
  });
}

// Cadangan bila Durable Object tidak dapat dihubungi: binding Workers Rate Limiting CEK_KGB_RATE_LIMITER,
// lalu hitungan per isolate. Keduanya hanya membatasi sebagian (Cloudflare menyebut binding itu longgar,
// dan permintaan dapat dilayani isolate berbeda). Galat pembatas tidak menghalangi permintaan.
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

/* Halaman publik yang isinya sama untuk semua orang dan hanya berubah harian. */
const HALAMAN_PUBLIK = new Set(["/kgb", "/tabel-gaji"]);
/** Berapa lama jawaban halaman publik disimpan di cache tepi. */
const UMUR_CACHE_PUBLIK_DETIK = 300;

/** true bila permintaan ini boleh dilayani dari cache bersama: GET halaman publik, tanpa sesi. */
function bolehDariCache(request, pathname) {
  if (request.method !== "GET") return false;
  if (!HALAMAN_PUBLIK.has(pathname.replace(/\/+$/, ""))) return false;
  // Permintaan RSC membawa jawaban berbeda untuk URL yang sama, jadi dibiarkan lewat.
  if (new URL(request.url).searchParams.has("_rsc")) return false;
  // Pengguna yang sudah masuk mendapat navigasi yang berbeda; jangan sampai tercampur.
  const cookie = request.headers.get("cookie") ?? "";
  return !cookie.includes("authjs.session-token") && !cookie.includes("next-auth.session-token");
}

/**
 * Melayani halaman publik dari Cache API. Kunci cache sengaja dibuat dari path saja, tanpa query,
 * supaya tautan bertanda pelacak tidak memecah cache menjadi banyak entri.
 */
async function lewatCachePublik(request, pathname, env, ctx) {
  const kunci = new Request(new URL(pathname.replace(/\/+$/, ""), request.url).toString(), { method: "GET" });
  const cache = caches.default;
  const tersimpan = await cache.match(kunci);
  if (tersimpan) return tersimpan;

  const asli = await openNextWorker.fetch(request, env, ctx);
  if (asli.status !== 200) return asli;

  // Jawaban perlu digandakan: satu untuk pemanggil, satu untuk disimpan.
  const untukCache = new Response(asli.body, asli);
  untukCache.headers.set("cache-control", `public, max-age=${UMUR_CACHE_PUBLIK_DETIK}`);
  untukCache.headers.delete("set-cookie");
  const untukPemanggil = untukCache.clone();
  ctx.waitUntil(cache.put(kunci, untukCache));
  return untukPemanggil;
}

/** Nilai header yang melarang mesin pencari mengindeks, mengikuti tautan, atau menyimpan salinan halaman. */
const LARANG_INDEKS = "noindex, nofollow, noarchive, nosnippet, noimageindex";

/** Salinan jawaban dengan header X-Robots-Tag; header jawaban asli bisa tidak boleh diubah. */
function tanpaIndeks(res) {
  const salinan = new Response(res.body, res);
  salinan.headers.set("x-robots-tag", LARANG_INDEKS);
  return salinan;
}

export default {
  ...openNextWorker,
  async fetch(request, env, ctx) {
    return tanpaIndeks(await layani(request, env, ctx));
  },
  async scheduled(controller, env, ctx) {
    return jadwal(controller, env, ctx);
  },
};

async function layani(request, env, ctx) {
  const { pathname } = new URL(request.url);
  if (bolehDariCache(request, pathname)) return lewatCachePublik(request, pathname, env, ctx);
  if (pathname.replace(/\/+$/, "") !== PATH_CEK_KGB) return openNextWorker.fetch(request, env, ctx);

  // Hanya POST yang memeriksa data; GET lama langsung dijawab rute dengan pesan untuk memuat ulang halaman.
  if (request.method !== "POST") return openNextWorker.fetch(request, env, ctx);

  const ip = alamatIp(request);
  const nip = await nipDari(request);
  const stub = pembatas(env);
  let hasil = null;
  if (stub) {
    try {
      hasil = await stub.periksa(ip, nip);
    } catch (err) {
      console.error("[cek-kgb] Durable Object pembatas gagal:", err);
    }
  }
  if (hasil && !hasil.boleh) return jawabDitahan(pesanDitahan(hasil), hasil.tunggu);
  if (!hasil && (await melebihiBatasCekKgb(ip, env, Date.now())))
    return jawabDitahan("Terlalu banyak permintaan cek status. Coba lagi dalam satu menit.", 60);

  const res = await openNextWorker.fetch(request, env, ctx);
  // 404: NIP tak dikenal atau tempat lahir salah (jawabannya sengaja sama). Dihitung sebagai percobaan gagal.
  if (res.status === 404) {
    tambahHitungan(hitunganTidakDitemukan, ip, Date.now());
    if (stub) ctx.waitUntil(stub.catatGagal(ip, nip).catch((err) => console.error("[cek-kgb] catat gagal:", err)));
  }
  return res;
}

/** Cron Trigger pagi (wrangler.jsonc): cadangan lalu notifikasi harian. Cron lainnya hanya cadangan (ADR-084). */
const CRON_PAGI = "0 0 * * *";

/** Panggil satu endpoint cron internal; galatnya dicatat, tidak dilempar. */
async function panggilCron(env, nama, path) {
  try {
    const res = await env.WORKER_SELF_REFERENCE.fetch(
      new Request(`https://sim-kgb.internal${path}`, {
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
      console.error(`[cron] ${nama} gagal: HTTP ${res.status}${keterangan}:`, await res.text());
    }
  } catch (err) {
    console.error(`[cron] ${nama} error:`, err);
  }
}

async function jadwal(controller, env, ctx) {
  ctx.waitUntil(
    (async () => {
      if (!env.CRON_SECRET) {
        console.error("[cron] CRON_SECRET belum diset; endpoint cron akan menolak panggilan. Set dengan: wrangler secret put CRON_SECRET");
      }
      // Cadangan lebih dulu, supaya yang tersimpan adalah keadaan sebelum perubahan cron hari itu.
      await panggilCron(env, "cadangan", "/api/cron/cadangan");
      if (controller.cron === CRON_PAGI) await panggilCron(env, "notifikasi", "/api/cron/notifikasi");
    })(),
  );
}
