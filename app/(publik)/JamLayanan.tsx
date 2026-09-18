"use client";

import { useSyncExternalStore } from "react";
import { statusJamLayanan, type StatusJamLayanan } from "@/lib/jamLayanan";

/* Status jam layanan dibaca lewat useSyncExternalStore: server merender kosong, klien menampilkan status
   menurut jam WITA dan menyegarkannya tiap menit, tanpa selisih hidrasi. */
let cache: StatusJamLayanan | null = null;
const pendengar = new Set<() => void>();
let pewaktu: ReturnType<typeof setInterval> | null = null;

function snapshot(): StatusJamLayanan {
  if (!cache) cache = statusJamLayanan();
  return cache;
}

function langganan(cb: () => void) {
  pendengar.add(cb);
  // Setelah pendengar terakhir lepas, pewaktu berhenti dan cache bisa basi; segarkan saat berlangganan lagi.
  cache = statusJamLayanan();
  if (!pewaktu) {
    pewaktu = setInterval(() => {
      const baru = statusJamLayanan();
      if (!cache || baru.buka !== cache.buka || baru.jadwalHariIni !== cache.jadwalHariIni) {
        cache = baru;
        pendengar.forEach((f) => f());
      }
    }, 60_000);
  }
  return () => {
    pendengar.delete(cb);
    if (pendengar.size === 0 && pewaktu) {
      clearInterval(pewaktu);
      pewaktu = null;
    }
  };
}

const snapshotServer = () => null;

function useJamLayanan() {
  return useSyncExternalStore(langganan, snapshot, snapshotServer);
}

/** Baris status layanan (kaki halaman dan bagian bantuan). Ruangnya dipesan agar tidak ada lompatan tata letak. */
export function StatusLayanan() {
  const status = useJamLayanan();
  if (!status) return <span className="jl-baris" aria-hidden="true" />;
  return (
    <span className="jl-baris">
      <span className="jl-titik" data-buka={status.buka ? "1" : "0"} aria-hidden="true" />
      <b>{status.buka ? "Buka sekarang" : "Tutup"}</b>
      {status.jadwalHariIni && <span>{status.jadwalHariIni}</span>}
    </span>
  );
}

