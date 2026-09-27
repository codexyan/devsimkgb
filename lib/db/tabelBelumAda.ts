// Penanda tabel Supabase yang belum dimigrasikan. Migrasi dijalankan manual di SQL Editor, jadi kode yang
// sudah terpasang bisa mendahului tabelnya; rute yang memakai tabel baru memeriksa galat ini agar tetap
// berjalan dengan perilaku bawaan sampai migrasinya dijalankan.

import { GalatSupabase } from "./supabase/rest";

/** Galat karena tabel belum ada: PGRST205 dari PostgREST (tidak ada di cache skema) atau 42P01 dari Postgres. */
export function tabelBelumAda(e: unknown): boolean {
  return e instanceof GalatSupabase && (e.kode === "PGRST205" || e.kode === "42P01");
}
