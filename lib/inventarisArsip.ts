// Salin berkas kiriman formulir inventarisasi ke arsip dokumen pegawai, satu per satu atas perintah Tim SDM
// (ADR-027). Bagian modul inventarisasi: ia memakai API arsip dokumen pegawai (lib/dokumenPegawaiServer.ts), tetapi
// modul pegawai tidak mengenal inventarisasi. Salinannya berkas mandiri milik pegawai, sehingga tetap ada setelah
// modul inventarisasi dihapus.

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { newId } from "./sheets/id";
import { daftarDokumenArsip, simpanDokumenArsip } from "./dokumenPegawaiServer";
import type { JenisDokumen } from "./dokumenPegawai";
import { daftarKegiatan, daftarKiriman, type BerkasTersimpan } from "./inventarisServer";
import { db } from "./db";

/** Jenis dokumen arsip untuk tiap jenis berkas kiriman formulir. */
export const JENIS_ARSIP_BERKAS: Record<string, JenisDokumen> = {
  "SK-KGB-Terakhir": "sk_kgb",
  "SK-KP-Terakhir": "sk_pangkat",
  "SK-PMK": "sk_pmk",
  "SK-CPNS": "sk_cpns",
  "SK-PNS": "sk_pns",
};

/** Kunci berkas kiriman yang sudah tersalin ke arsip pegawai, dikenali dari penanda asal dokumen arsip. */
export async function berkasTersalin(pegawaiId: string): Promise<Set<string>> {
  return new Set((await daftarDokumenArsip(pegawaiId)).map((d) => d.asal).filter((a): a is string => !!a));
}

/**
 * Salin satu berkas kiriman ke arsip dokumen pegawai. "sudah" bila berkas itu pernah disalin, "tidak_ada" bila
 * berkas asalnya tidak terbaca.
 */
export async function salinBerkasKeArsip(
  pegawaiId: string,
  berkas: BerkasTersimpan,
  konteks: { oleh: string; keterangan: string; nomorSK: string },
): Promise<"disalin" | "sudah" | "tidak_ada"> {
  if ((await berkasTersalin(pegawaiId)).has(berkas.kunci)) return "sudah";
  const { env } = await getCloudflareContext({ async: true });
  const obj = await env.SK_BUCKET.get(berkas.kunci).catch(() => null);
  if (!obj) return "tidak_ada";
  await simpanDokumenArsip(
    pegawaiId,
    {
      id: newId(),
      jenis: JENIS_ARSIP_BERKAS[berkas.jenis] ?? "lainnya",
      // Nomor SK kiriman hanya diketahui untuk SK dasarnya; berkas lain dibiarkan kosong agar tidak keliru.
      nomorSK: berkas.jenis === "SK-KGB-Terakhir" || berkas.jenis === "SK-CPNS" ? konteks.nomorSK : "",
      tanggalSK: /_(\d{4}-\d{2}-\d{2})\.pdf$/.exec(berkas.nama)?.[1] ?? "",
      keterangan: konteks.keterangan,
      namaBerkas: berkas.nama,
      ukuran: berkas.ukuran,
      diunggahOleh: konteks.oleh,
      diunggahAt: new Date().toISOString(),
      asal: berkas.kunci,
    },
    await obj.arrayBuffer(),
  );
  return "disalin";
}

export interface HasilSalinSemua {
  disalin: number;
  sudah: number;
  tidakTerbaca: number;
  /** Kiriman yang NIP-nya belum terdaftar di Data Pegawai, sehingga belum punya arsip. */
  tanpaPegawai: { nip: string; nama: string; berkas: number }[];
  /** Pegawai yang menerima salinan baru. */
  pegawai: string[];
}

/**
 * Salin seluruh berkas kiriman yang belum tersalin ke arsip dokumen pegawainya, sekali jalan, sebelum modul
 * inventarisasi dihapus (ADR-098). Memakai salinBerkasKeArsip yang sama dengan tombol per berkas, sehingga berkas yang
 * sudah tersalin dilewati dan menjalankannya ulang aman.
 */
export async function salinSemuaKeArsip(oleh: string): Promise<HasilSalinSemua> {
  const hasil: HasilSalinSemua = { disalin: 0, sudah: 0, tidakTerbaca: 0, tanpaPegawai: [], pegawai: [] };
  for (const kegiatan of await daftarKegiatan()) {
    for (const kiriman of await daftarKiriman(kegiatan.id)) {
      if (kiriman.berkas.length === 0) continue;
      const nip = kiriman.isian.nip;
      const pegawai = /^\d{18}$/.test(nip ?? "") ? await db.pegawai.findUnique({ nip }) : null;
      if (!pegawai) {
        hasil.tanpaPegawai.push({ nip: nip ?? "-", nama: kiriman.isian.nama ?? "-", berkas: kiriman.berkas.length });
        continue;
      }
      let baru = 0;
      for (const berkas of kiriman.berkas) {
        const h = await salinBerkasKeArsip(pegawai.id, berkas, {
          oleh,
          keterangan: `Dari kiriman ${kegiatan.nama}`,
          nomorSK: kiriman.isian.nomorSkDasar ?? "",
        });
        if (h === "disalin") baru++;
        else if (h === "sudah") hasil.sudah++;
        else hasil.tidakTerbaca++;
      }
      hasil.disalin += baru;
      if (baru > 0) hasil.pegawai.push(pegawai.nama);
    }
  }
  return hasil;
}
