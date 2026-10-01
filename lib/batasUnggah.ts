// Batas ukuran satu berkas yang diunggah ke SIM-KGB (ADR-037).
//
// Satu angka untuk seluruh jalur unggahan: SK KGB, berkas usulan UPT, arsip dokumen pegawai, kiriman
// inventarisasi, dan logo kop, supaya tidak ada satu pun yang tertinggal saat angkanya diubah, dan supaya
// operator tidak perlu mengingat batas yang berbeda-beda per layar.
//
// Alasan angkanya kecil: seluruh unggahan melewati Worker, dan Worker menyalin isi berkas ke memori dua
// kali (sekali saat req.formData(), sekali lagi saat file.arrayBuffer() sebelum ditulis ke R2). Batas 10 MB
// yang lama berarti satu permintaan saja dapat memegang belasan megabyte, dan itulah yang paling mungkin
// memicu "Worker exceeded resource limits" di produksi. Satu lembar SK yang dipindai sebagai dokumen hitam
// putih berukuran ratusan kilobyte, jadi 500 KB masih lapang untuk pemakaian yang benar.

/** Batas ukuran satu berkas unggahan. */
export const BATAS_UNGGAH_BYTE = 500 * 1024;

/** Label yang dipakai pada pesan dan petunjuk layar, supaya angkanya tidak ditulis ulang di mana-mana. */
export const BATAS_UNGGAH_LABEL = "500 KB";

/**
 * Pesan tolak yang seragam. Menyebut cara memperkecilnya, bukan hanya angkanya: berkas yang terlalu besar
 * hampir selalu foto kamera beresolusi penuh yang dibungkus PDF, bukan pindaian dokumen.
 */
export function pesanBerkasTerlaluBesar(apa = "berkas"): string {
  return (
    `Ukuran ${apa} paling besar ${BATAS_UNGGAH_LABEL}. ` +
    "Pindai sebagai dokumen hitam putih, bukan foto kamera, atau perkecil berkasnya lalu unggah kembali."
  );
}
