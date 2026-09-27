import { permanentRedirect } from "next/navigation";

// Panduan kerja petugas pindah ke dalam SIM-KGB (/dashboard/panduan), ditampilkan menurut peran pengguna.
// Yang perlu diketahui pegawai ada di halaman Cek status, bagian Info untuk pegawai.
export default function PanduanPublik() {
  permanentRedirect("/kgb#info-pegawai");
}
