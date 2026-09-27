// Cek status KGB di halaman publik: verifikasi kedua dan data minimal.
//
// NIP bukan rahasia: tercetak di SK, papan nama, dan surat, dan susunannya (tanggal lahir, TMT CPNS, jenis
// kelamin, nomor urut) dapat ditebak. Karena itu cek publik meminta tempat lahir sebagai kunci kedua (satu-satunya
// data yang tidak terkandung di NIP dan diingat setiap pegawai), dan hanya menampilkan status KGB beserta nama yang
// disamarkan. Jabatan, golongan, unit kerja, dan nomor SK tidak dikirim. Murni agar dapat diuji.

/** Awalan wilayah yang tidak ikut dibandingkan: "Kab. Banjar", "Kabupaten Banjar", dan "Banjar" dianggap sama. */
const AWALAN = /^(kabupaten|kab|kota|kotamadya|kodya|adm)\s+/;

/** Tempat lahir dalam bentuk pembanding: huruf kecil, tanpa tanda baca, spasi tunggal, tanpa awalan wilayah. */
export function normalisasiTempat(teks: string | null | undefined): string {
  let s = String(teks ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  // Awalan dapat bertumpuk ("Kab. Adm. ..."); dibuang berulang.
  for (let i = 0; i < 3 && AWALAN.test(s); i++) s = s.replace(AWALAN, "");
  return s.replace(/\s+/g, " ").trim();
}

/** Tempat lahir isian pegawai cocok dengan yang tercatat. Tempat lahir kosong di data tidak pernah cocok. */
export function cocokTempatLahir(isian: string | null | undefined, tercatat: string | null | undefined): boolean {
  const a = normalisasiTempat(isian);
  const b = normalisasiTempat(tercatat);
  return a.length >= 3 && a === b;
}

/**
 * Nama yang disamarkan: dua huruf pertama tiap kata tetap, sisanya bintang ("Siti Nugroho" → "Si** Nu*****").
 * Gelar setelah koma dibuang, karena gelar sendiri dapat mengungkap siapa orangnya.
 */
export function samarkanNama(nama: string | null | undefined): string {
  const inti = String(nama ?? "").split(",")[0].trim();
  if (!inti) return "-";
  return inti
    .split(/\s+/)
    .map((kata) => {
      const huruf = [...kata];
      const tampak = huruf.length <= 3 ? 1 : 2;
      return huruf.slice(0, tampak).join("") + "*".repeat(Math.max(1, huruf.length - tampak));
    })
    .join(" ");
}

/** Pesan yang sama untuk NIP tak dikenal maupun tempat lahir yang tidak cocok, agar keberadaan NIP tidak terbaca. */
export const PESAN_TIDAK_COCOK =
  "Data tidak ditemukan atau tempat lahir tidak cocok. Periksa NIP dan tempat lahir sesuai data kepegawaian Anda.";
