import type { Metadata } from "next";
import RiwayatUpt from "@/app/dashboard/components/upt/RiwayatUpt";

export const metadata: Metadata = { title: "Riwayat" };

/** Modul Riwayat Admin UPT: semua usulan dan laporan yang pernah dikirim ke Kanwil. */
export default function HalamanRiwayatUpt() {
  return <RiwayatUpt />;
}
