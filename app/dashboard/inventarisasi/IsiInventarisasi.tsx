"use client";

import dynamic from "next/dynamic";

// Dirender di peramban saja: unduhan ZIP disusun di peramban dan waktunya ditampilkan menurut WITA setempat.
const HalamanInventarisasi = dynamic(() => import("@/app/dashboard/components/inventarisasi/HalamanInventarisasi"), {
  ssr: false,
  loading: () => (
    <div className="dsb-halaman" role="status" aria-label="Memuat inventarisasi">
      <div className="dsb-kerangka" style={{ height: 90 }} />
      <div className="dsb-kerangka" style={{ height: 320 }} />
    </div>
  ),
});

export default function IsiInventarisasi({ superAdmin }: { superAdmin: boolean }) {
  return <HalamanInventarisasi superAdmin={superAdmin} />;
}
