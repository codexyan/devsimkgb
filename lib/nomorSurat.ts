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
