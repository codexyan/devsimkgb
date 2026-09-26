"use client";

import dynamic from "next/dynamic";

// Sama dengan dasbor UPT (app/dashboard/page.tsx): dirender di peramban saja, karena isinya bergantung
// pada tanggal hari ini menurut WITA dan data akun yang sedang masuk.
const DashboardUpt = dynamic(() => import("@/app/dashboard/components/DashboardUpt"), {
  ssr: false,
  loading: () => (
    <div className="dsb-halaman" role="status" aria-label="Memuat data pegawai">
      <div className="dsb-kerangka" style={{ height: 90 }} />
      <div className="dsb-kerangka" style={{ height: 480 }} />
    </div>
  ),
});

export default function IsiPegawaiUpt() {
  return <DashboardUpt halaman="pegawai" />;
}
