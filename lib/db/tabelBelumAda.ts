// Penanda tabel Supabase yang belum dimigrasikan. Migrasi dijalankan manual di SQL Editor, jadi kode yang
// sudah terpasang bisa mendahului tabelnya; rute yang memakai tabel baru memeriksa galat ini agar tetap
// berjalan dengan perilaku bawaan sampai migrasinya dijalankan.

import { GalatSupabase } from "./supabase/rest";

/**
 * Galat karena tabel belum ada: PGRST205 dari PostgREST (tidak ada di cache skema), 42P01 dari Postgres, atau
 * "no such table" dari D1 (ADR-085).
 */
export function tabelBelumAda(e: unknown): boolean {
  if (e instanceof GalatSupabase) return e.kode === "PGRST205" || e.kode === "42P01";
  return e instanceof Error && /no such table/i.test(e.message);
}
