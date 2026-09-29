"use client";

import dynamic from "next/dynamic";

// Dirender di peramban saja, sama dengan modul UPT lain: berkasnya diurai di peramban dan isinya
// bergantung pada akun yang masuk.
const UnggahDaftar = dynamic(() => import("@/app/dashboard/components/upt/UnggahDaftar"), {
  ssr: false,
  loading: () => (
    <div className="dsb-halaman" role="status" aria-label="Memuat unggah daftar">
      <div className="dsb-kerangka" style={{ height: 90 }} />
      <div className="dsb-kerangka" style={{ height: 420 }} />
    </div>
  ),
});

export default function IsiUnggahDaftar() {
  return <UnggahDaftar />;
}
