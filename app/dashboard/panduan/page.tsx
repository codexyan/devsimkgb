import type { Metadata } from "next";
import { auth } from "@/auth";
import IsiPanduan from "./IsiPanduan";
import { PERAN_UNTUK_ROLE, SEMUA } from "./peran";

export const metadata: Metadata = { title: "Panduan" };

// Batas input Tim SDM dan KPPN mitra diatur di Pengaturan, jadi halaman dirender per permintaan.
export const dynamic = "force-dynamic";

/* Panduan SIM-KGB untuk petugas. Bagian yang tampil lebih dulu mengikuti role akun; pembaca tetap boleh
   membaca peran lain atau seluruhnya. Pegawai tidak memerlukan panduan ini: yang perlu mereka ketahui ada di
   halaman Cek status publik (/kgb#info-pegawai). */
export default async function PanduanDashboardPage() {
  const session = await auth();
  const milik = PERAN_UNTUK_ROLE[session?.user.role ?? ""] ?? null;
  return <IsiPanduan bawaan={milik ?? SEMUA} milik={milik} />;
}
