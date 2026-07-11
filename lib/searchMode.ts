/* Filter pencarian case-insensitive lintas provider.
   `mode: "insensitive"` hanya dikenal client Postgres; pada SQLite (dev,
   DATABASE_URL "file:") properti itu dihilangkan — LIKE SQLite memang sudah
   case-insensitive untuk ASCII. Spread variabel menghindari excess property
   check TypeScript pada client sqlite. */
export const CI: { mode?: "insensitive" } =
  process.env.DATABASE_URL?.startsWith("file:") ? {} : { mode: "insensitive" };
