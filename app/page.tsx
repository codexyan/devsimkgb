import { redirect } from "next/navigation";

// Akar aplikasi KGB mengarahkan ke landing publik /kgb (cek status KGB +
// tautan masuk). Pegawai internal login lewat tombol di landing atau /login.
export default function Home() {
  redirect("/kgb");
}
