import type { Metadata } from "next";
import { auth } from "@/auth";
import IsiPanduan from "./IsiPanduan";
import { PERAN_UNTUK_ROLE, SEMUA, bolehPilihPeran, peranBolehUntukRole } from "./peran";

export const metadata: Metadata = { title: "Panduan" };

// Batas input Tim SDM dan KPPN mitra diatur di Pengaturan, jadi halaman dirender per permintaan.
export const dynamic = "force-dynamic";

/* Panduan SIM-KGB untuk petugas. Bagian yang boleh dibaca ditentukan di sini, bukan di peramban: tiap peran
   membaca panduannya sendiri, dan hanya Super Admin membaca seluruh peran. Bagian yang tidak terbuka bagi
   sebuah akun tidak ikut dirender sama sekali, jadi tidak ada isi kerja Kanwil yang terbawa ke halaman Admin
   UPT lalu sekadar disembunyikan CSS. Pegawai tidak memerlukan panduan ini: yang perlu mereka ketahui ada di
   halaman Cek status publik (/kgb#info-pegawai). */
export default async function PanduanDashboardPage() {
  const session = await auth();
  const role = session?.user.role ?? "";
  const boleh = peranBolehUntukRole(role);
  const milik = PERAN_UNTUK_ROLE[role] ?? null;
  // Super Admin membuka pada panduan perannya sendiri, sama seperti peran lain; "semua" tinggal sekali klik.
  const bawaan = milik && boleh.includes(milik) ? milik : bolehPilihPeran(boleh) ? SEMUA : boleh[0];
  return <IsiPanduan bawaan={bawaan} milik={milik} boleh={boleh} />;
}
