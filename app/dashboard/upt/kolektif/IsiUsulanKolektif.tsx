"use client";

import dynamic from "next/dynamic";

// Dirender di peramban saja, sama dengan modul UPT lain: isinya bergantung pada tanggal WITA dan akun yang masuk.
const UsulanKolektif = dynamic(() => import("@/app/dashboard/components/upt/UsulanKolektif"), {
  ssr: false,
  loading: () => (
    <div className="dsb-halaman" role="status" aria-label="Memuat usul KGB kolektif">
      <div className="dsb-kerangka" style={{ height: 90 }} />
      <div className="dsb-kerangka" style={{ height: 420 }} />
    </div>
  ),
});

export default function IsiUsulanKolektif() {
  return <UsulanKolektif />;
}
