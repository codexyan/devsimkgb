import type { Metadata } from "next";
import Link from "next/link";
import CekStatus from "./CekStatus";
import "./kgb.css";

export const metadata: Metadata = {
  title: "Cek Status KGB",
  description:
    "Periksa status dan jadwal kenaikan gaji berkala pegawai Kanwil Ditjenpas Kalimantan Selatan dan UPT di wilayahnya berdasarkan NIP.",
};

export default function HalamanCekStatus() {
  return (
    <div className="pub-container">
      <h1 className="pub-h1">Cek status kenaikan gaji berkala</h1>
      <p className="pub-lead">
        Masukkan NIP untuk melihat status dan jadwal kenaikan gaji berkala (KGB). Data dikelola oleh Tim SDM
        Kanwil Ditjenpas Kalimantan Selatan.
      </p>

      <div className="ck-tata">
        <div className="ck-utama">
          <CekStatus />
        </div>

        <section className="ck-samping" aria-labelledby="ck-pengelola">
          <h2 id="ck-pengelola" className="pub-h2">
            Untuk pengelola kepegawaian
          </h2>
          <ul className="ck-daftar-tautan">
            <li>
              <Link href="/panduan#untuk-upt">Admin UPT: cara mengusulkan KGB</Link>
            </li>
            <li>
              <Link href="/panduan#ringkasan">Alur lengkap dari surat permohonan sampai SK terbit</Link>
            </li>
            <li>
              <Link href="/login">Tim SDM dan keuangan Kanwil: masuk ke SIM-KGB</Link>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
