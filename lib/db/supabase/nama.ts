/** camelCase atau PascalCase ke snake_case: tmtKgbBerikutnya → tmt_kgb_berikutnya, RiwayatKGB → riwayat_kgb. */
export function keSnake(nama: string): string {
  return nama
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

/** Nama tabel Postgres untuk satu tab spreadsheet. "user" kata tercadang di Postgres, jadi User menjadi users. */
export function namaTabel(tab: string): string {
  return tab === "User" ? "users" : keSnake(tab);
}

/** Kolom di setiap tabel Supabase yang mencatat urutan baris dimasukkan, pengganti urutan baris spreadsheet. */
export const KOLOM_URUTAN = "urutan_sisip";
