import type { Metadata } from "next";
import { auth } from "@/auth";
import { requireRole } from "@/lib/authGuard";
import { ROLES } from "@/lib/auth/roles";
import TemplateSuratManager from "../pengaturan/TemplateSuratManager";

export const metadata: Metadata = { title: "Template surat KGB" };

/**
 * Template surat KGB untuk Tim SDM KGB (ADR-019): melihat isi versi dan mempratinjau suratnya. Mengubah template
 * hanya Super Admin, lewat Pengaturan; Super Admin yang membuka halaman ini pun dapat mengubahnya.
 */
export default async function HalamanTemplateSurat() {
  await requireRole([ROLES.SUPER_ADMIN, ROLES.SDM_KGB]);
  const session = await auth();
  return (
    <div className="dsb-halaman">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Data</p>
          <h1 className="dsb-halaman-judul">Template surat KGB</h1>
          <p className="dsb-sub">
            Kop, ukuran kertas, kalimat, dan tembusan SK KGB. SK memakai versi yang berlaku pada tanggal suratnya.
          </p>
        </div>
      </header>
      <section className="dsb-panel" style={{ padding: 16 }}>
        <TemplateSuratManager bolehUbah={session?.user.role === ROLES.SUPER_ADMIN} />
      </section>
    </div>
  );
}
