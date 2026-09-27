"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TUNDA_JAM, statusCadangan, terbaru, type KeadaanCadangan } from "@/lib/cadangan";
import { formatTanggalId } from "@/lib/waktu";
import { KABAR_CADANGAN, bacaCadanganLokal, bacaTunda, catatTunda } from "./cadanganLokal";

/* Pengingat cadangan data bulanan (ADR-018), dipasang sekali di kerangka dashboard.
   - Hari ke-25 sampai ke-29 sejak cadangan terakhir: spanduk pengingat.
   - Hari ke-30 dan seterusnya: jendela yang menahan dashboard sampai cadangan diunduh. Penundaan 24 jam
     boleh dipakai sekali untuk tiap jatuh tempo. Halaman Cadangkan data sendiri tidak pernah ditahan. */

const HALAMAN_CADANGAN = "/dashboard/cadangan";

interface Keadaan {
  nip: string;
  keadaan: KeadaanCadangan;
  jatuhTempo: string;
}

export default function PengingatCadangan() {
  const pathname = usePathname();
  const [k, setK] = useState<Keadaan | null>(null);
  const [, setDetak] = useState(0);

  const muat = useCallback(async () => {
    try {
      const res = await fetch("/api/cadangan");
      if (!res.ok) return;
      const d = (await res.json()) as { nip: string; keadaan: KeadaanCadangan; jatuhTempo: string; terakhir: string | null };
      const terakhir = terbaru(d.terakhir, bacaCadanganLokal(d.nip));
      if (terakhir) {
        const s = statusCadangan(terakhir, null, new Date());
        setK({ nip: d.nip, keadaan: s.keadaan, jatuhTempo: s.jatuhTempo.toISOString() });
      } else {
        setK({ nip: d.nip, keadaan: d.keadaan, jatuhTempo: d.jatuhTempo });
      }
    } catch {
      // Pengingat bukan hal yang boleh mengganggu pekerjaan bila gagal dimuat.
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    const kabar = () => void muat();
    window.addEventListener(KABAR_CADANGAN, kabar);
    return () => {
      clearTimeout(t);
      window.removeEventListener(KABAR_CADANGAN, kabar);
    };
  }, [muat]);

  if (!k || k.keadaan === "aman") return null;

  const tanggal = formatTanggalId(new Date(k.jatuhTempo), { day: "numeric", month: "long", year: "numeric" });
  const diHalamanCadangan = pathname === HALAMAN_CADANGAN;
  const tunda = bacaTunda(k.nip);
  const sedangDitunda = !!tunda && tunda.jatuhTempo === k.jatuhTempo && new Date(tunda.sampai) > new Date();
  const tundaTerpakai = !!tunda && tunda.jatuhTempo === k.jatuhTempo;

  if (k.keadaan === "ingat" || diHalamanCadangan || sedangDitunda) {
    if (diHalamanCadangan) return null;
    return (
      <div role="status" className="dsb-pesan cdg-spanduk" data-nada={k.keadaan === "wajib" ? "merah" : "kuning"}>
        <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
        <p>
          {k.keadaan === "wajib"
            ? `Cadangan data bulanan sudah lewat batas ${tanggal}. Penundaan berakhir ${formatTanggalId(new Date(tunda!.sampai), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
            : `Cadangan data bulanan jatuh tempo ${tanggal}.`}{" "}
          <Link href={HALAMAN_CADANGAN}>Cadangkan sekarang</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="cdg-tirai" aria-hidden="true" />
      <div className="cdg-wadah">
        <div role="alertdialog" aria-modal="true" aria-labelledby="judul-cadangan-wajib" aria-describedby="isi-cadangan-wajib" className="cdg-jendela">
          <h2 id="judul-cadangan-wajib">Cadangan data bulanan wajib</h2>
          <p id="isi-cadangan-wajib">
            Batas cadangan akun ini {tanggal} sudah lewat. Selama SIM-KGB masih disempurnakan, setiap akun wajib
            menyimpan cadangan datanya ke perangkat ini paling tidak sebulan sekali. Unduhannya memakan waktu satu
            sampai beberapa menit.
          </p>
          <div className="cdg-aksi">
            {!tundaTerpakai && (
              <button
                type="button"
                className="dsb-tombol"
                data-jenis="garis"
                onClick={() => {
                  catatTunda(k.nip, k.jatuhTempo, new Date(Date.now() + TUNDA_JAM * 60 * 60 * 1000));
                  setDetak((n) => n + 1);
                }}
              >
                Tunda {TUNDA_JAM} jam
              </button>
            )}
            <Link href={HALAMAN_CADANGAN} className="dsb-tombol" autoFocus>
              Cadangkan sekarang
            </Link>
          </div>
          {tundaTerpakai && <p className="dsb-kecil" style={{ margin: 0 }}>Penundaan untuk batas ini sudah dipakai.</p>}
        </div>
      </div>
    </>
  );
}
