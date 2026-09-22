import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { tanggaGaji } from "@/lib/tabelGaji";
import LatarNavy from "@/app/_bersama/LatarNavy";
import TanggaMasuk from "./TanggaMasuk";
import "./login.css";

export const metadata: Metadata = {
  title: "Masuk",
};

// Pengguna yang sudah masuk langsung diarahkan ke dashboard (pengganti
// redirect middleware proxy.ts).
export default async function LoginLayout({ children }: Readonly<{ children: ReactNode }>) {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <section className="pub-navy pub-hero lg">
      <LatarNavy />
      <div className="pub-container lg-kisi">
        <aside className="lg-sisi masuk" aria-label="Tentang SIM-KGB">
          <div className="lg-sisi-atas">
            <Image src="/icons.svg" alt="" width={34} height={27} loading="eager" />
            <span>
              <b>SIM-KGB</b>
              Kanwil Ditjenpas Kalimantan Selatan
            </span>
          </div>
          <TanggaMasuk baris={tanggaGaji()} />
          <p className="lg-sisi-teks">
            Usulan KGB dihitung dari tabel gaji, SK dibuat dan diunggah, lalu dikonfirmasi bagian keuangan. Semua
            tahapnya tercatat di satu tempat.
          </p>
        </aside>
        <div className="lg-utama masuk" style={{ "--d": 120 } as React.CSSProperties}>
          {children}
        </div>
      </div>
    </section>
  );
}
