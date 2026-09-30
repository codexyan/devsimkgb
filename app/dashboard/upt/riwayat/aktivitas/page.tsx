import type { Metadata } from "next";
import RiwayatUpt from "@/app/dashboard/components/upt/RiwayatUpt";

export const metadata: Metadata = { title: "Riwayat usulan dan laporan" };

/**
 * Riwayat aktivitas Admin UPT: usulan data dan laporan mutasi atau pemberhentian yang pernah dikirim
 * satker ini ke Kanwil. Dipisahkan dari Riwayat KGB karena keduanya menjawab pertanyaan yang berbeda —
 * yang ini "kiriman saya sudah ditinjau atau belum", yang itu "gaji pegawai ini sudah naik kapan saja".
 */
export default function HalamanRiwayatAktivitasUpt() {
  return <RiwayatUpt />;
}
