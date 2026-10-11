// Penanda tabel yang belum dimigrasikan. Migrasi D1 diterapkan dengan `wrangler d1 migrations apply` sebelum kode yang
// membutuhkannya di-deploy, tetapi rute yang memakai tabel baru tetap memeriksa galat ini agar berjalan dengan perilaku
// bawaan bila urutan itu terlewat.

/** Galat karena tabel belum ada: "no such table" dari D1 (ADR-085). */
export function tabelBelumAda(e: unknown): boolean {
  return e instanceof Error && /no such table/i.test(e.message);
}
