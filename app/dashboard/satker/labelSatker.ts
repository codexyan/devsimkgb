import type { Satker } from "@/lib/satker";

export const LABEL_JENIS_SATKER: Record<Satker["jenis"], string> = {
  kanwil: "Kanwil",
  lapas: "Lapas",
  rutan: "Rutan",
  bapas: "Bapas",
  lpka: "LPKA",
};

/** Nama tampil satker; Kanwil disingkat seperti di Data Pegawai. */
export function namaTampilSatker(s: Pick<Satker, "jenis" | "nama">): string {
  return s.jenis === "kanwil" ? "Kanwil Ditjenpas Kalsel" : s.nama;
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

/** Nama pendek untuk kartu: "Lapas Kelas IIA Banjarmasin" → "Lapas IIA Banjarmasin". */
export function namaSingkatSatker(s: Pick<Satker, "jenis" | "nama">): string {
  return s.jenis === "kanwil" ? "Kanwil Ditjenpas Kalsel" : s.nama.replace(/\bKelas\s+/, "");
}
