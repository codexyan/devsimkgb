// Pintu tunggal lapisan data untuk route. Penyimpanan dipilih lewat environment:
//   DATA_BACKEND=supabase atau DATA_BACKEND=sheets. Tanpa DATA_BACKEND, Supabase dipakai bila
//   SUPABASE_URL di-set, selain itu Google Sheets. DATA_BACKEND=lokal memakai repository Sheets di atas
//   berkas JSON lokal (lib/sheets/klienLokal.ts), khusus pengembangan di komputer sendiri.
// Pilihan dibaca setiap kali repository diakses, karena di Cloudflare Workers secret baru
// tersedia di process.env saat request berjalan.

import type { Table } from "../sheets/table";
import { sheets } from "../sheets/tables";
import type { Repo } from "./repo";
import { supabase } from "./supabase/tables";

export type { OrderBy, Repo, Where } from "./repo";

export type BackendData = "sheets" | "supabase" | "lokal";

export function backendData(): BackendData {
  const pilihan = process.env.DATA_BACKEND?.trim().toLowerCase();
  if (pilihan === "sheets" || pilihan === "supabase" || pilihan === "lokal") return pilihan;
  if (pilihan) {
    throw new Error(`DATA_BACKEND "${process.env.DATA_BACKEND}" tidak dikenal; pakai "sheets", "supabase", atau "lokal".`);
  }
  return process.env.SUPABASE_URL?.trim() ? "supabase" : "sheets";
}

type RepoDari<X> = X extends Table<infer R> ? Repo<R> : never;
export type Db = { readonly [K in keyof typeof sheets]: RepoDari<(typeof sheets)[K]> };

// Memastikan saat kompilasi bahwa kedua penyimpanan punya repository dan tipe baris yang sama.
const lewatSheets: Db = sheets;
const lewatSupabase: Db = supabase;

function pilih<K extends keyof Db>(kunci: K): Db[K] {
  return backendData() === "supabase" ? lewatSupabase[kunci] : lewatSheets[kunci];
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
  get riwayatMutasi() { return pilih("riwayatMutasi"); },
  get laporanMutasi() { return pilih("laporanMutasi"); },
  get usulanPegawai() { return pilih("usulanPegawai"); },
  get hukdisJenis() { return pilih("hukdisJenis"); },
  get hukdisKonfigurasi() { return pilih("hukdisKonfigurasi"); },
  get regulasi() { return pilih("regulasi"); },
  get auditLog() { return pilih("auditLog"); },
  get rekonBulanan() { return pilih("rekonBulanan"); },
};
