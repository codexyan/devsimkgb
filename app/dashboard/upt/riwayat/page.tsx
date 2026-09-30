import type { Metadata } from "next";
import RiwayatKgbUpt from "@/app/dashboard/components/upt/RiwayatKgbUpt";

export const metadata: Metadata = { title: "Riwayat KGB" };

/** Modul Riwayat Admin UPT: riwayat KGB pegawai satker, sebangun dengan panel Keuangan Kanwil. */
export default function HalamanRiwayatUpt() {
  return <RiwayatKgbUpt />;
}
