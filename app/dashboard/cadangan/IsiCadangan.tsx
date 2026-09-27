"use client";

import dynamic from "next/dynamic";

// Dirender di peramban saja: isinya bergantung pada penyimpanan peramban dan waktu setempat.
const HalamanCadangan = dynamic(() => import("@/app/dashboard/components/cadangan/HalamanCadangan"), {
  ssr: false,
  loading: () => (
    <div className="dsb-halaman" role="status" aria-label="Memuat halaman cadangan">
      <div className="dsb-kerangka" style={{ height: 90 }} />
      <div className="dsb-kerangka" style={{ height: 260 }} />
    </div>
  ),
});

export default function IsiCadangan() {
  return <HalamanCadangan />;
}
