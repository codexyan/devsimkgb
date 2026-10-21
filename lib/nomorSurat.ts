// Penomoran surat keluar Kantor Wilayah.
//
// SK kenaikan gaji berkala yang diterbitkan Kanwil bernomor WP.19-SA.04.04-<nomor surat>, dengan nomor
// suratnya diminta kepada arsiparis. Awalannya tetap, jadi yang diketik operator cukup nomornya saja;
// aplikasi yang menyusunnya menjadi nomor lengkap agar tidak ada SK yang berbeda bentuk penulisannya.
//
// Nomor lama yang tidak memakai awalan ini tetap diterima apa adanya: SK yang sudah terbit tidak boleh
// berubah nomornya hanya karena formulirnya dibuka kembali.

/** Awalan nomor surat keluar Kanwil untuk SK kenaikan gaji berkala. */
export const AWALAN_NOMOR_SK = "WP.19-SA.04.04-";

/** Nomor lengkap dari bagian yang diketik operator; kosong bila nomornya belum diisi. */
export function nomorSkLengkap(nomor: string): string {
  const inti = nomor.trim();
  if (!inti) return "";
  return inti.toUpperCase().startsWith(AWALAN_NOMOR_SK.toUpperCase()) ? inti : AWALAN_NOMOR_SK + inti;
}

/**
 * Pecah nomor tersimpan menjadi bagian yang perlu diketik. `berawalan` false berarti nomornya tidak
 * mengikuti pola Kanwil, misalnya SK lama atau SK yang diarsipkan dari luar aplikasi; isian penuh yang
 * ditampilkan untuk nomor semacam itu, bukan isian bernomor saja.
 */
export function bagianNomorSk(lengkap: string | null | undefined): { berawalan: boolean; nomor: string } {
  const teks = (lengkap ?? "").trim();
  if (!teks) return { berawalan: true, nomor: "" };
  if (teks.toUpperCase().startsWith(AWALAN_NOMOR_SK.toUpperCase())) {
    return { berawalan: true, nomor: teks.slice(AWALAN_NOMOR_SK.length) };
  }
  return { berawalan: false, nomor: teks };
}

/**
 * Bentuk pembanding nomor SK: tanpa spasi dan berhuruf besar. Satu nomor dari arsiparis hanya boleh
 * dipakai satu SK, dan "wp.19-SA.04.04- 1234" tetaplah nomor yang sama dengan "WP.19-SA.04.04-1234".
 */
export function kunciNomorSk(nomor: string | null | undefined): string {
  return (nomor ?? "").replace(/\s+/g, "").toUpperCase();
}

/**
 * Inti nomor SK untuk mengenali satu SK yang tertulis berbeda: tanpa awalan "NOMOR" dan akhiran "TAHUN xxxx", sebab
 * "NOMOR WP.19-79.SA.12 TAHUN 2025" dan "WP.19-79.SA.12" adalah nomor yang sama (ADR-118). Hanya untuk mendeteksi
 * duplikat; pencocokan pindaian dan Atas dasar tetap memakai `kunciNomorSk`.
 */
export function kunciIntiNomorSk(nomor: string | null | undefined): string {
  return (nomor ?? "")
    .replace(/^\s*NOMOR\s*[:.]?\s*/i, "")
    .replace(/\s*TAHUN\s*\d{4}\s*$/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** Tahun pada akhiran "TAHUN xxxx" sebuah nomor SK, atau null bila tidak ada. */
function tahunNomorSk(nomor: string | null | undefined): string | null {
  return /TAHUN\s*(\d{4})\s*$/i.exec(nomor ?? "")?.[1] ?? null;
}

/**
 * true bila dua nomor adalah satu SK yang tertulis berbeda: intinya sama, dan tahunnya sama atau salah satunya tidak
 * menyebut tahun. "12 TAHUN 2025" dan "12 TAHUN 2026" adalah dua SK, sebab urutan nomor berulang tiap tahun.
 */
export function nomorSkSama(a: string | null | undefined, b: string | null | undefined): boolean {
  const inti = kunciIntiNomorSk(a);
  if (!inti || inti !== kunciIntiNomorSk(b)) return false;
  const ta = tahunNomorSk(a);
  const tb = tahunNomorSk(b);
  return !ta || !tb || ta === tb;
}
