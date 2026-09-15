// Kontrak lapisan data yang dipakai route. Google Sheets (lib/sheets/table.ts) dan Supabase
// (lib/db/supabase/table.ts) sama-sama memenuhinya, jadi penyimpanan bisa diganti tanpa
// mengubah route.

/** Filter gaya Prisma: kesetaraan, operator (in, notIn, not, contains, lt, ...), serta OR dan AND. */
export type Where = Record<string, unknown>;

export interface OrderBy<T> {
  field: keyof T & string;
  dir?: "asc" | "desc";
}

export interface Repo<T extends object> {
  findMany(opts?: { where?: Where; orderBy?: OrderBy<T> }): Promise<T[]>;
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
