// Wrapper worker Cloudflare.
//
// OpenNext menghasilkan `.open-next/worker.js` yang hanya mengekspor handler
// `fetch` (+ Durable Object). Cloudflare Cron Trigger memerlukan handler
// `scheduled`, jadi worker ini membungkus output OpenNext: meneruskan `fetch`
// apa adanya, mengekspor ulang Durable Object, dan menambahkan `scheduled` yang
// memanggil endpoint cron internal (/api/cron/notifikasi) lewat self-reference
// service binding. File .open-next/worker.js dibuat saat `opennextjs-cloudflare
// build`, sebelum wrangler membundel entry ini.
import openNextWorker from "./.open-next/worker.js";

export {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "./.open-next/worker.js";

export default {
  ...openNextWorker,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        try {
          const res = await env.WORKER_SELF_REFERENCE.fetch(
            new Request("https://sim-kgb.internal/api/cron/notifikasi", {
              headers: { authorization: `Bearer ${env.CRON_SECRET ?? ""}` },
            }),
          );
          if (!res.ok) {
            console.error("[cron] notifikasi gagal:", res.status, await res.text());
          }
        } catch (err) {
          console.error("[cron] notifikasi error:", err);
        }
      })(),
    );
  },
};
