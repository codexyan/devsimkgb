// Fokus papan antrian Kanwil per satker dan per periode TMT (ADR-088). Hanya tampilan: kartu di luar fokus disembunyikan,
// tidak ada pekerjaan yang ditahan. Pilihan disimpan per akun di peramban.
//
// Aturan: satker yang dikunci menampilkan seluruh periodenya. Periode dapat dikunci satu-satu; mengunci periode di satker
// yang sedang dikunci utuh mempersempit satker itu ke periode tersebut. Tanpa kunci apa pun, papan menampilkan semuanya.

export interface FokusPapan {
  /** Kode satker yang dikunci utuh. */
  satker: string[];
  /** Periode yang dikunci, berbentuk "kode|YYYY-MM". */
  periode: string[];
}

export const FOKUS_KOSONG: FokusPapan = { satker: [], periode: [] };

export const kunciPeriode = (kode: string, bulanTmt: string) => `${kode}|${bulanTmt}`;
const kodeDariPeriode = (k: string) => k.slice(0, k.indexOf("|"));

export function fokusKosong(f: FokusPapan): boolean {
  return f.satker.length === 0 && f.periode.length === 0;
}

/** Kunci atau buka satu satker utuh; kunci periode di dalamnya ikut dilepas. */
export function alihSatker(f: FokusPapan, kode: string): FokusPapan {
  const periode = f.periode.filter((p) => kodeDariPeriode(p) !== kode);
  return f.satker.includes(kode)
    ? { satker: f.satker.filter((s) => s !== kode), periode }
    : { satker: [...f.satker, kode], periode };
}

/** Kunci atau buka satu periode. Di satker yang dikunci utuh, fokus satker itu dipersempit ke periode ini. */
export function alihPeriode(f: FokusPapan, kode: string, bulanTmt: string): FokusPapan {
  const k = kunciPeriode(kode, bulanTmt);
  if (f.satker.includes(kode)) return { satker: f.satker.filter((s) => s !== kode), periode: [...f.periode, k] };
  return f.periode.includes(k) ? { ...f, periode: f.periode.filter((p) => p !== k) } : { ...f, periode: [...f.periode, k] };
}

export function satkerTerkunci(f: FokusPapan, kode: string): boolean {
  return f.satker.includes(kode);
}

export function periodeTerkunci(f: FokusPapan, kode: string, bulanTmt: string): boolean {
  return f.satker.includes(kode) || f.periode.includes(kunciPeriode(kode, bulanTmt));
}

/** Satker yang tersentuh fokus: dikunci utuh, atau salah satu periodenya dikunci. */
export function satkerDalamFokus(f: FokusPapan): Set<string> {
  return new Set([...f.satker, ...f.periode.map(kodeDariPeriode)]);
}

/**
 * Fokus yang masih berlaku: kunci satker atau periode yang sudah tidak punya pekerjaan dibuang, supaya kunci lama tidak
 * mengosongkan papan diam-diam.
 */
export function fokusBerlaku(f: FokusPapan, tersedia: readonly { kode: string; bulan: readonly string[] }[]): FokusPapan {
  const satker = new Set(tersedia.map((t) => t.kode));
  const periode = new Set(tersedia.flatMap((t) => t.bulan.map((b) => kunciPeriode(t.kode, b))));
  return { satker: f.satker.filter((s) => satker.has(s)), periode: f.periode.filter((p) => periode.has(p)) };
}

/** Kartu (satker dan bulan TMT-nya) tampil pada fokus ini. */
export function cocokFokus(f: FokusPapan, kode: string, bulanTmt: string): boolean {
  if (fokusKosong(f)) return true;
  return f.satker.includes(kode) || f.periode.includes(kunciPeriode(kode, bulanTmt));
}

/** Fokus tersimpan → FokusPapan; isian yang rusak diabaikan. */
export function bacaFokus(teks: string | null | undefined): FokusPapan {
  try {
    const isi = JSON.parse(teks ?? "") as Partial<FokusPapan>;
    const daftar = (x: unknown) => (Array.isArray(x) ? [...new Set(x.filter((v): v is string => typeof v === "string" && !!v))] : []);
    return { satker: daftar(isi.satker), periode: daftar(isi.periode).filter((p) => p.includes("|")) };
  } catch {
    return FOKUS_KOSONG;
  }
}

/** Kunci penyimpanan fokus per akun. */
export const kunciSimpanFokus = (nip: string) => `kgb-fokus-papan:${nip || "-"}`;
