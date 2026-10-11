// Pintu tunggal lapisan data untuk route. Penyimpanan dipilih lewat environment:
//   DATA_BACKEND=d1 (Cloudflare D1, ADR-085; basis data produksi), DATA_BACKEND=sheets (Google Sheets), atau
//   DATA_BACKEND=lokal (repository Sheets di atas berkas JSON lokal, lib/sheets/klienLokal.ts, khusus pengembangan).
//   Tanpa DATA_BACKEND, pengembangan memakai Google Sheets, sedangkan produksi menolak berjalan: penyimpanan yang
//   salah akan menerima tulisan baru tanpa ada yang tahu (ADR-102).
// Pilihan dibaca setiap kali repository diakses, karena di Cloudflare Workers secret baru
// tersedia di process.env saat request berjalan.

import type { Table } from "../sheets/table";
import { sheets } from "../sheets/tables";
import type { Repo } from "./repo";
import { d1 } from "./d1/tables";

export type { OrderBy, Repo, Where } from "./repo";

export type BackendData = "sheets" | "lokal" | "d1";

export function backendData(): BackendData {
  const pilihan = process.env.DATA_BACKEND?.trim().toLowerCase();
  if (pilihan === "sheets" || pilihan === "lokal" || pilihan === "d1") return pilihan;
  if (pilihan === "supabase") {
    throw new Error('DATA_BACKEND "supabase" sudah dilepas (ADR-102); pakai "d1".');
  }
  if (pilihan) {
    throw new Error(`DATA_BACKEND "${process.env.DATA_BACKEND}" tidak dikenal; pakai "d1", "sheets", atau "lokal".`);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error('DATA_BACKEND belum di-set. Di produksi isi "d1" (npx wrangler secret put DATA_BACKEND).');
  }
  return "sheets";
}

type RepoDari<X> = X extends Table<infer R> ? Repo<R> : never;
export type Db = { readonly [K in keyof typeof sheets]: RepoDari<(typeof sheets)[K]> };

// Memastikan saat kompilasi bahwa kedua penyimpanan punya repository dan tipe baris yang sama.
const lewatSheets: Db = sheets;
const lewatD1: Db = d1;

function pilih<K extends keyof Db>(kunci: K): Db[K] {
  return backendData() === "d1" ? lewatD1[kunci] : lewatSheets[kunci];
}

export const db: Db = {
  get user() { return pilih("user"); },
  get profileChangeRequest() { return pilih("profileChangeRequest"); },
  get pegawai() { return pilih("pegawai"); },
  get riwayatKGB() { return pilih("riwayatKGB"); },
  get suratKGB() { return pilih("suratKGB"); },
  get serahTerima() { return pilih("serahTerima"); },
  get konfigurasiKanwil() { return pilih("konfigurasiKanwil"); },
  get penandatangan() { return pilih("penandatangan"); },
  get notifikasi() { return pilih("notifikasi"); },
  get riwayatHukdis() { return pilih("riwayatHukdis"); },
  get riwayatPangkat() { return pilih("riwayatPangkat"); },
  get riwayatPmk() { return pilih("riwayatPmk"); },
  get riwayatMutasi() { return pilih("riwayatMutasi"); },
  get laporanMutasi() { return pilih("laporanMutasi"); },
  get laporanHukdis() { return pilih("laporanHukdis"); },
  get templateSurat() { return pilih("templateSurat"); },
  get usulanPegawai() { return pilih("usulanPegawai"); },
  get hukdisJenis() { return pilih("hukdisJenis"); },
  get hukdisKonfigurasi() { return pilih("hukdisKonfigurasi"); },
  get regulasi() { return pilih("regulasi"); },
  get auditLog() { return pilih("auditLog"); },
  get pengumumanDilihat() { return pilih("pengumumanDilihat"); },
  get reviewSkUpt() { return pilih("reviewSkUpt"); },
  get rekonBulanan() { return pilih("rekonBulanan"); },
};
