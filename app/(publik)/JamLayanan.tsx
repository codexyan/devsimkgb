"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { JAM_LAYANAN, statusJamLayanan, type StatusJamLayanan } from "@/lib/jamLayanan";

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

/** Baris status untuk kaki halaman. Ruangnya dipesan agar tidak ada lompatan tata letak. */
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

/** Pil jam layanan di sudut kanan bawah; ditekan untuk membuka jadwal sepekan. */
export function PilJamLayanan() {
  const status = useJamLayanan();
  const [terbuka, setTerbuka] = useState(false);
  const id = useId();
  if (!status) return null;

  const judul = status.buka ? "Buka sekarang" : "Di luar jam layanan";
  return (
    <div className="jl-apung">
      {terbuka && (
        <div className="jl-kartu" id={id}>
          <p className="jl-kartu-judul">
            <span className="jl-titik" data-buka={status.buka ? "1" : "0"} aria-hidden="true" />
            {judul}
          </p>
          {JAM_LAYANAN.map((b) => (
            <div key={b.hari} className="jl-kartu-baris">
              <span>{b.hari}</span>
              <b>{b.jam}</b>
            </div>
          ))}
          <p className="jl-kartu-catatan">Waktu Indonesia Tengah (WITA).</p>
        </div>
      )}
      <button
        type="button"
        className="jl-pil"
        aria-expanded={terbuka}
        aria-controls={id}
        onClick={() => setTerbuka((v) => !v)}
      >
        <span className="jl-titik" data-buka={status.buka ? "1" : "0"} aria-hidden="true" />
        <span className="jl-pil-judul">{judul}</span>
        {status.jadwalHariIni && (
          <span className="jl-pil-jam">
            <span className="pub-visually-hidden">, jam layanan hari ini </span>
            {status.jadwalHariIni}
          </span>
        )}
      </button>
    </div>
  );
}
