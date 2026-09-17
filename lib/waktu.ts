// Tanggal kalender Kanwil Ditjenpas Kalimantan Selatan menurut WITA (Asia/Makassar, UTC+8).
// Server Cloudflare Workers berjalan dalam UTC dan server lokal bisa berjalan dalam zona lain,
// sehingga "hari ini" dan tanggal yang tersimpan selalu dibaca menurut WITA, bukan zona proses.

const ZONA_WITA = "Asia/Makassar";

export type NilaiTanggal = Date | string | number | null | undefined;

interface TanggalWita {
  tahun: number;
  /** 0 = Januari, sama dengan Date.getMonth(). */
  bulan: number;
  hari: number;
}

const formatBagianWita = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_WITA,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const FORMAT_TANGGAL_BAKU: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

function keDate(value: NilaiTanggal): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const tanggal = value instanceof Date ? value : new Date(typeof value === "string" ? value.trim() : value);
  return Number.isNaN(tanggal.getTime()) ? null : tanggal;
}

/** Tahun, bulan (0-based), dan hari dari sebuah instan menurut WITA. */
export function tanggalWita(sekarang: Date = new Date()): TanggalWita {
  const bagian = formatBagianWita.formatToParts(sekarang);
  const ambil = (jenis: Intl.DateTimeFormatPartTypes) => Number(bagian.find((b) => b.type === jenis)?.value);
  return { tahun: ambil("year"), bulan: ambil("month") - 1, hari: ambil("day") };
}

/** Tanggal hari ini menurut WITA sebagai tengah malam waktu lokal proses, setara new Date(y, m, d). */
export function hariIniWita(sekarang: Date = new Date()): Date {
  const { tahun, bulan, hari } = tanggalWita(sekarang);
  return new Date(tahun, bulan, hari);
}

/**
 * Tanggal kalender WITA dari nilai tanggal yang tersimpan, sebagai new Date(y, m, d).
 * TMT 1 Juni 2026 bisa tersimpan sebagai 2026-06-01T00:00:00Z (ditulis dari proses UTC) atau
 * 2026-05-31T16:00:00Z (tengah malam WITA); keduanya menjadi 1 Juni 2026.
 * Mengembalikan null untuk nilai kosong atau tidak valid.
 */
export function tanggalKalender(value: NilaiTanggal): Date | null {
  const tanggal = keDate(value);
  if (!tanggal) return null;
  const { tahun, bulan, hari } = tanggalWita(tanggal);
  return new Date(tahun, bulan, hari);
}

/**
 * true bila kedua nilai jatuh pada tanggal kalender WITA yang sama.
 * Nilai kosong atau tidak valid tidak sama dengan tanggal mana pun. Dua nilai yang sama-sama kosong
 * (atau tidak valid) hanya dianggap sama bila `keduanyaKosongSama` true, yaitu saat memeriksa apakah
 * isian tanggal opsional berubah.
 */
export function samaTanggalKalender(
  a: NilaiTanggal,
  b: NilaiTanggal,
  opsi: { keduanyaKosongSama?: boolean } = {},
): boolean {
  const ta = tanggalKalender(a);
  const tb = tanggalKalender(b);
  if (!ta || !tb) return opsi.keduanyaKosongSama === true && !ta && !tb;
  return ta.getTime() === tb.getTime();
}

/**
 * Format tanggal untuk tampilan dalam bahasa Indonesia menurut WITA, misalnya "1 Juni 2026".
 * Bila `options` diberikan, opsi itu menggantikan format baku; zona waktu tetap WITA.
 * Mengembalikan "-" untuk nilai kosong atau tidak valid.
 */
export function formatTanggalId(value: NilaiTanggal, options?: Intl.DateTimeFormatOptions): string {
  const tanggal = keDate(value);
  if (!tanggal) return "-";
  return new Intl.DateTimeFormat("id-ID", { ...(options ?? FORMAT_TANGGAL_BAKU), timeZone: ZONA_WITA }).format(tanggal);
}

/**
 * "yyyy-mm-dd" dari tanggal kalender lokal proses, untuk nilai input date di peramban.
 * Tidak memakai toISOString, yang bergeser sehari di zona timur UTC. Tanggal tidak valid menjadi "".
 */
export function isoTanggalLokal(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) return "";
  const bulan = String(date.getMonth() + 1).padStart(2, "0");
  const hari = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${bulan}-${hari}`;
}
