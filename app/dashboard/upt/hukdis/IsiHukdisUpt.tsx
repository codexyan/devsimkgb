"use client";

import dynamic from "next/dynamic";

// Dirender di peramban saja, sama dengan modul UPT lain: isinya bergantung pada tanggal WITA dan akun yang masuk.
const HukdisUpt = dynamic(() => import("@/app/dashboard/components/upt/HukdisUpt"), {
  ssr: false,
  loading: () => (
    <div className="dsb-halaman" role="status" aria-label="Memuat modul hukuman disiplin">
      <div className="dsb-kerangka" style={{ height: 90 }} />
      <div className="dsb-kerangka" style={{ height: 320 }} />
    </div>
  ),
});

export default function IsiHukdisUpt() {
  return <HukdisUpt />;
}
