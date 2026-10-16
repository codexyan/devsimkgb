// Kontrak lapisan data yang dipakai route. Google Sheets (lib/sheets/table.ts) dan Cloudflare D1
// (lib/db/d1/table.ts) sama-sama memenuhinya, jadi penyimpanan bisa diganti tanpa
// mengubah route.

/** Filter gaya Prisma: kesetaraan, operator (in, notIn, not, contains, lt, ...), serta OR dan AND. */
export type Where = Record<string, unknown>;

export interface OrderBy<T> {
  field: keyof T & string;
  dir?: "asc" | "desc";
}

export interface Repo<T extends object> {
  /** `batas`: paling banyak sekian baris pertama menurut urutannya. */
  findMany(opts?: { where?: Where; orderBy?: OrderBy<T>; batas?: number }): Promise<T[]>;
  /**
   * Hanya kolom yang disebut, dengan urutan yang sama seperti findMany. Jauh lebih ringan untuk tabel besar yang hanya
   * perlu disaring, misalnya id dan unit kerja seluruh pegawai untuk menemukan pegawai satu satker (ADR-079).
   */
  findKolom<K extends keyof T & string>(kolom: readonly K[], opts?: { where?: Where }): Promise<Pick<T, K>[]>;
  /** Record pertama yang cocok, menurut urutan data dimasukkan. */
  findUnique(where: Where): Promise<T | null>;
  count(where?: Where): Promise<number>;
  create(data: T): Promise<T>;
  createMany(rows: T[]): Promise<number>;
  /** Ubah record pertama yang cocok. Kunci yang ada tetapi bernilai undefined mengosongkan kolomnya. */
  update(where: Where, data: Partial<T>): Promise<T | null>;
  updateMany(where: Where, data: Partial<T>): Promise<number>;
  delete(where: Where): Promise<boolean>;
  deleteMany(where: Where): Promise<number>;
}
