import { redirect } from "next/navigation";

/**
 * Lapor KP/PI/PMK dihapus (ADR-081): SK kenaikan pangkat, penyesuaian ijazah, atau PMK dilaporkan di langkah SK sesudah SK
 * KGB terakhir, lewat Perbarui data (satu pegawai) atau Usul KGB Kolektif (banyak pegawai). Tautan lama diarahkan ke
 * Usul KGB Kolektif.
 */
export default function HalamanLaporSk() {
  redirect("/dashboard/upt/kolektif");
}
