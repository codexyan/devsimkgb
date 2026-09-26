"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { namaTampilSatker } from "@/app/dashboard/satker/labelSatker";

/* Pemantauan Kanwil atas SK pegawai UPT yang belum direkam di Gaji Web satkernya (ADR-009). Sejak SK diunggah
   Tim SDM, keuangan UPT yang menindaklanjutinya; panel ini hanya memperlihatkan satker mana yang punya SK
   menunggu dan sudah berapa lama, agar Kanwil dapat mengingatkan UPT-nya. Tidak ada tombol yang mengubah data. */

interface SkMenunggu {
  kgbId: string;
  nama: string;
  nip: string;
  tmtKgbBaru: string | null;
  diunggahAt: string | null;
  hariMenunggu: number | null;
}

interface SatkerMenunggu {
  satker: { kode: string; nama: string };
  sk: SkMenunggu[];
}

/** SK yang menunggu lebih lama dari ini ditandai merah: gaji barunya belum dibayar setengah bulan. */
const HARI_PERLU_DIINGATKAN = 14;

export default function PanelGajiWebUpt({ versi, className = "dsb-susut" }: { versi?: number; className?: string }) {
  const [daftar, setDaftar] = useState<SatkerMenunggu[] | null>(null);
  const [galat, setGalat] = useState(false);

  useEffect(() => {
    fetch("/api/keuangan/gaji-web-upt")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = (await r.json()) as { satker: SatkerMenunggu[] };
        setDaftar(d.satker);
        setGalat(false);
      })
      .catch(() => setGalat(true));
  }, [versi]);

  const jumlah = (daftar ?? []).reduce((n, r) => n + r.sk.length, 0);

  return (
    <section className={`dsb-panel ${className}`} aria-labelledby="judul-gaji-web-upt">
      <div className="dsb-panel-kepala">
        <h2 id="judul-gaji-web-upt" className="dsb-panel-judul">
          SK UPT belum direkam {daftar && <small>{jumlah}</small>}
        </h2>
      </div>

      {galat ? (
        <p className="dsb-kosong">Pemantauan Gaji Web UPT gagal dimuat.</p>
      ) : !daftar ? (
        <div className="dsb-panel-isi flex flex-col gap-2" aria-hidden="true">
          {[1, 2].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 44, borderRadius: 8 }} />)}
        </div>
      ) : daftar.length === 0 ? (
        <p className="dsb-kosong">Semua SK pegawai UPT sudah direkam di Gaji Web satkernya.</p>
      ) : (
        <>
          <ul className="dsb-satker-daftar dsb-gulir">
            {daftar.map((r) => {
              const terlama = r.sk[0].hariMenunggu;
              const nama = r.sk.slice(0, 3).map((s) => s.nama).join(", ");
              return (
                <li key={r.satker.kode}>
                  <Link href={`/dashboard/satker/${r.satker.kode}`} title={r.sk.map((s) => s.nama).join(", ")}>
                    <span className="dsb-nama">{namaTampilSatker(r.satker)}</span>
                    <span className="dsb-satker-angka">{r.sk.length} SK</span>
                    <span className="dsb-satker-tanda">
                      {terlama !== null && (
                        <span data-nada={terlama > HARI_PERLU_DIINGATKAN ? "merah" : undefined}>terlama {terlama} hari</span>
                      )}
                      <span>{nama}{r.sk.length > 3 ? `, dan ${r.sk.length - 3} lainnya` : ""}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="dsb-kaki" style={{ margin: 0 }}>
            <span>Keuangan UPT merekamnya di Gaji Web satker masing-masing.</span>
          </p>
        </>
      )}
    </section>
  );
}
