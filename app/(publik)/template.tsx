import type { ReactNode } from "react";

/* Dipasang ulang setiap pindah halaman publik, sehingga isi halaman baru muncul lembut
   sementara nav dan kaki di layout tetap diam. */
export default function TemplatePublik({ children }: { children: ReactNode }) {
  return <div className="pub-transisi">{children}</div>;
}
