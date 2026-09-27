import { cariSatker, type Satker } from "@/lib/satker";

/* Nama satuan kerja ditulis lengkap di seluruh aplikasi: "Lembaga Pemasyarakatan", bukan "Lapas", sehingga
   formulir, ekspor, dan surat memakai nama yang sama. Satu pengecualian (ADR-013): tampilan padat dashboard
   (tabel antrian, kartu papan, panel pendamping) memakai namaRingkasSatker, dengan nama lengkap di tooltip,
   karena nama lengkap di kolom sempit selalu terpotong sebelum bagian yang membedakannya. */

export const LABEL_JENIS_SATKER: Record<Satker["jenis"], string> = {
  kanwil: "Kantor Wilayah",
  lapas: "Lembaga Pemasyarakatan",
  rutan: "Rumah Tahanan Negara",
  bapas: "Balai Pemasyarakatan",
  lpka: "Lembaga Pembinaan Khusus Anak",
};

const AWALAN_RINGKAS: Record<Satker["jenis"], [string, string]> = {
  kanwil: ["Kantor Wilayah", "Kanwil"],
  lapas: ["Lembaga Pemasyarakatan", "Lapas"],
  rutan: ["Rumah Tahanan Negara", "Rutan"],
  bapas: ["Balai Pemasyarakatan", "Bapas"],
  lpka: ["Lembaga Pembinaan Khusus Anak", "LPKA"],
};

/**
 * Nama ringkas untuk tampilan padat: singkatan jenis dan tempatnya, tanpa kelas, mis. "Rutan Rantau",
 * "Lapas Perempuan Martapura", "Lapas Narkotika Karang Intan". Kanwil cukup "Kanwil". Yang membedakan satker
 * di Kalimantan Selatan adalah jenis dan tempatnya, jadi kelas boleh ditinggalkan di sini.
 */
export function namaRingkasSatker(s: Pick<Satker, "nama" | "jenis">): string {
  if (s.jenis === "kanwil") return "Kanwil";
  const [panjang, singkat] = AWALAN_RINGKAS[s.jenis];
  const sisa = s.nama.startsWith(panjang) ? s.nama.slice(panjang.length) : s.nama;
  const tanpaKelas = sisa.replace(/\bKelas\s+[IVX]+[AB]?\b/g, "").replace(/\bKhusus\s+/g, "").replace(/\s+/g, " ").trim();
  return `${singkat} ${tanpaKelas}`.trim();
}

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
