"use client";

import { useEffect, useState } from "react";
import type { Nada } from "@/app/dashboard/components/PanelNavy";

/* Pantau satker di kolom pendamping dashboard Super Admin dan SDM. Satu baris per satker yang punya pekerjaan:
   Kanwil selalu di atas, lalu UPT dari yang paling perlu perhatian. Menggabungkan panel Satker & UPT dan
   SK UPT belum direkam, yang isinya dulu mengulang papan. Klik baris menyaring antrian ke satker itu.

   Angka per tahap dihitung pemanggil dari data antrian yang sama, jadi selalu cocok dengan papan. Lama
   menunggu rekam Gaji Web dibaca dari /api/keuangan/gaji-web-upt (ADR-009). */

export interface BarisPantau {
  kode: string;
  nama: string;
  kanwil: boolean;
  lewat: number;
  perluInput: number;
  diproses: number;
  diKeuangan: number;
  usulan: number;
}

/** Rekam Gaji Web UPT yang menunggu lebih lama dari ini ditandai merah. */
const HARI_PERLU_DIINGATKAN = 14;

function bobot(b: BarisPantau, terlama: number): number {
  return b.lewat * 1000 + (terlama > HARI_PERLU_DIINGATKAN ? 500 : 0) + b.usulan * 100 + b.perluInput * 10 + b.diproses + b.diKeuangan;
}

export default function PanelPantauSatker({
  baris,
  terpilih,
  onPilih,
  versi,
}: {
  baris: readonly BarisPantau[];
  /** Kode satker yang sedang menyaring antrian; null bila semua. */
  terpilih: string | null;
  onPilih: (kode: string | null) => void;
  versi?: number;
}) {
  const [terlama, setTerlama] = useState<Map<string, { jumlah: number; hari: number | null }>>(() => new Map());

  useEffect(() => {
    fetch("/api/keuangan/gaji-web-upt")
      .then(async (r) => {
        if (!r.ok) return;
        const d = (await r.json()) as { satker: { satker: { kode: string }; sk: { hariMenunggu: number | null }[] }[] };
        setTerlama(new Map(d.satker.map((s) => [s.satker.kode, { jumlah: s.sk.length, hari: s.sk[0]?.hariMenunggu ?? null }])));
      })
      .catch(() => {
        // Lama menunggu hanya pelengkap; jumlahnya tetap dari antrian.
      });
  }, [versi]);

  const berisi = baris.filter((b) => b.kanwil || b.lewat + b.perluInput + b.diproses + b.diKeuangan + b.usulan > 0);
  const urut = [...berisi].sort(
    (a, b) =>
      Number(b.kanwil) - Number(a.kanwil) ||
      bobot(b, terlama.get(b.kode)?.hari ?? 0) - bobot(a, terlama.get(a.kode)?.hari ?? 0) ||
      a.nama.localeCompare(b.nama, "id"),
  );
  const tanpaPekerjaan = baris.length - berisi.length;

  return (
    <section className="dsb-panel dsb-penuh" aria-labelledby="judul-pantau-satker">
      <div className="dsb-panel-kepala">
        <h2 id="judul-pantau-satker" className="dsb-panel-judul">
          Pantau satker <small>{berisi.length}</small>
        </h2>
        {terpilih && (
          <button type="button" className="dsb-tautan" onClick={() => onPilih(null)}>
            Semua satker
          </button>
        )}
      </div>
      <ul className="dsb-satker-daftar dsb-gulir">
        {urut.map((b) => {
          const rekam = terlama.get(b.kode);
          const tanda: { teks: string; nada?: Nada }[] = [];
          if (b.lewat > 0) tanda.push({ teks: `${b.lewat} lewat batas`, nada: "merah" });
          if (b.perluInput > 0) tanda.push({ teks: `${b.perluInput} perlu input` });
          if (b.diproses > 0) tanda.push({ teks: `${b.diproses} diproses` });
          if (b.usulan > 0) tanda.push({ teks: `${b.usulan} usulan UPT`, nada: "ungu" });
          if (b.kanwil && b.diKeuangan > 0) tanda.push({ teks: `${b.diKeuangan} di keuangan` });
          if (!b.kanwil && (rekam?.jumlah ?? b.diKeuangan) > 0)
            tanda.push({
              teks: `${rekam?.jumlah ?? b.diKeuangan} belum direkam${rekam?.hari != null ? ` · ${rekam.hari} hari` : ""}`,
              nada: (rekam?.hari ?? 0) > HARI_PERLU_DIINGATKAN ? "merah" : "kuning",
            });
          return (
            <li key={b.kode}>
              <button
                type="button"
                className="dsb-satker-pilih"
                aria-pressed={terpilih === b.kode}
                onClick={() => onPilih(terpilih === b.kode ? null : b.kode)}
                title={b.nama}
              >
                <span className="dsb-nama">{b.nama}</span>
                <span className="dsb-satker-angka">{b.kanwil ? "Kanwil" : "UPT"}</span>
                <span className="dsb-satker-tanda">
                  {tanda.length === 0 ? <span>Tidak ada pekerjaan</span> : tanda.map((t) => <span key={t.teks} data-nada={t.nada}>{t.teks}</span>)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {tanpaPekerjaan > 0 && (
        <p className="dsb-kaki" style={{ margin: 0 }}>
          <span>{tanpaPekerjaan} UPT lain tanpa pekerjaan saat ini.</span>
        </p>
      )}
    </section>
  );
}
