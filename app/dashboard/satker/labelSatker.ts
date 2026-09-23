import { cariSatker, type Satker } from "@/lib/satker";

/* Nama satuan kerja ditulis lengkap di seluruh aplikasi: "Lembaga Pemasyarakatan", bukan "Lapas".
   Tidak ada bentuk singkat, sehingga tampilan, ekspor, dan surat memakai nama yang sama. */

export const LABEL_JENIS_SATKER: Record<Satker["jenis"], string> = {
  kanwil: "Kantor Wilayah",
  lapas: "Lembaga Pemasyarakatan",
  rutan: "Rumah Tahanan Negara",
  bapas: "Balai Pemasyarakatan",
  lpka: "Lembaga Pembinaan Khusus Anak",
};

/** Nama tampil satker: nama resmi lengkap, tanpa singkatan. */
export function namaTampilSatker(s: Pick<Satker, "nama">): string {
  return s.nama;
}

/**
 * Nama unit kerja pegawai dalam bentuk resmi lengkap. Nilai lama yang masih tersingkat
 * ("Rutan Kelas IIB Rantau") tetap dikenali dan ditampilkan lengkap; teks yang tidak cocok
 * dengan daftar satker ditampilkan apa adanya.
 */
export function namaUnitKerja(unitKerja: string | null | undefined): string {
  const teks = unitKerja?.trim() ?? "";
  const s = cariSatker(teks);
  return s ? s.nama : teks || "-";
}

/** "yyyy-mm" → "Des 2026" (atau bulan panjang). */
export function namaBulan(kunci: string, panjang = false): string {
  const [y, m] = kunci.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: panjang ? "long" : "short", year: "numeric" });
}

/** Geser kunci bulan "yyyy-mm" sejumlah bulan. */
export function geserBulan(kunci: string, bulan: number): string {
  const [y, m] = kunci.split("-").map(Number);
  const t = new Date(y, m - 1 + bulan, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}
