import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Kata from "../Kata";
import LatarNavy from "@/app/_bersama/LatarNavy";
import FormInventaris from "./FormInventaris";
import "./inventaris.css";

export const metadata: Metadata = {
  title: "Inventarisasi Data KGB Pegawai Kanwil",
  description: "Formulir pemutakhiran data kenaikan gaji berkala pegawai Kantor Wilayah Ditjenpas Kalimantan Selatan.",
};

// Alamat Apps Script dan batas waktu dibaca dari variabel Worker saat permintaan, jadi halaman tidak statis.
export const dynamic = "force-dynamic";

const POLA_APPS_SCRIPT = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

/** Konfigurasi formulir dari variabel Worker (wrangler.jsonc "vars"), atau process.env saat pengembangan. */
async function konfigurasi(): Promise<{ url: string | null; batas: string | null }> {
  let env: Record<string, unknown> = {};
  try {
    env = (await getCloudflareContext({ async: true })).env as unknown as Record<string, unknown>;
  } catch {
    // Di luar Cloudflare (next dev tanpa binding) cukup process.env.
  }
  const baca = (k: string) => String(env[k] ?? process.env[k] ?? "").trim();
  const url = baca("INVENTARIS_KGB_URL");
  // Saat pengembangan boleh diarahkan ke tiruan Apps Script lokal (docs/inventarisasi-kgb/PANDUAN.md).
  const sah = POLA_APPS_SCRIPT.test(url) || (process.env.NODE_ENV !== "production" && /^http:\/\/127\.0\.0\.1:\d+\//.test(url));
  return { url: sah ? url : null, batas: baca("INVENTARIS_KGB_BATAS") || null };
}

/* Formulir inventarisasi data KGB pegawai Kanwil (lib/inventarisKgb.ts). Isian dan pindaian SK dikirim
   langsung dari peramban ke Google Apps Script milik Tim SDM (docs/inventarisasi-kgb), yang menyimpannya di
   Google Drive. Halaman ini tidak ada di menu publik; tautannya dibagikan lewat grup WA pegawai Kanwil. */
export default async function HalamanInventarisasi() {
  const { url, batas } = await konfigurasi();
  return (
    <>
      <section className="pub-navy pub-hero iv-hero" aria-labelledby="iv-judul">
        <LatarNavy />
        <div className="pub-container">
          <header className="iv-kepala">
            <p className="pub-eyebrow masuk">Khusus pegawai Kanwil Ditjenpas Kalimantan Selatan</p>
            <h1 id="iv-judul" className="pub-h1 iv-judul">
              <Kata teks="Inventarisasi data KGB" />
            </h1>
            <div className="iv-pengantar masuk" style={{ "--d": 180 } as React.CSSProperties}>
              <p className="pub-lead">
                Data ini dipakai Tim SDM untuk memperbarui data kenaikan gaji berkala Anda di SIM-KGB. Siapkan SK
                terakhir dalam bentuk PDF sebelum mengisi.
              </p>
              {batas && <p className="iv-batas">Batas pengisian: {batas}</p>}
            </div>
          </header>
        </div>
      </section>

      <div className="pub-container iv">
        {url ? (
          <FormInventaris url={url} />
        ) : (
          <div className="iv-tutup" role="status">
            <h2>Formulir belum dibuka</h2>
            <p>Tunggu pengumuman dari Tim SDM Kanwil di grup WA pegawai.</p>
          </div>
        )}
      </div>
    </>
  );
}
