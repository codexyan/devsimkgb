"use client";

import dynamic from "next/dynamic";

// Dirender di peramban saja, sama dengan modul UPT lain: isinya bergantung pada tanggal WITA dan akun yang masuk.
const LaporSkMassal = dynamic(() => import("@/app/dashboard/components/upt/LaporSkMassal"), {
  ssr: false,
  loading: () => (
    <div className="dsb-halaman" role="status" aria-label="Memuat lapor KP/PI/PMK">
      <div className="dsb-kerangka" style={{ height: 90 }} />
      <div className="dsb-kerangka" style={{ height: 320 }} />
    </div>
  ),
});

export default function IsiLaporSk() {
  return <LaporSkMassal />;
}
