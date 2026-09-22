"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RingkasanSatker } from "@/lib/rekapSatker";
import { namaSingkatSatker } from "@/app/dashboard/satker/labelSatker";

/* Pemantauan per satker (Kanwil dan UPT) di kolom pendamping dashboard Super Admin dan SDM KGB. Data dari
   /api/satker, sama dengan modul Satker & UPT. Satu baris per satker yang punya data, diurutkan dari yang
   paling perlu perhatian; satker tanpa data pegawai cukup disebut jumlahnya. Panel mengisi sisa tinggi kolom
   dan daftarnya bergulir di dalam, jadi semua satker berdata ditampilkan. */

/** Makin besar makin perlu perhatian: lewat batas, lalu rapelan, lalu belum diproses. */
function bobot(r: RingkasanSatker): number {
  return r.terlambat * 1000 + r.berpotensiRapelan * 100 + r.tahunIni.belumDiproses * 10 + (r.tahunIni.total - r.tahunIni.selesai);
}

export default function PemantauanSatker({ versi, className = "dsb-penuh" }: { versi?: number; className?: string }) {
  const [daftar, setDaftar] = useState<RingkasanSatker[] | null>(null);
  const [galat, setGalat] = useState(false);

  useEffect(() => {
    fetch("/api/satker")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = (await r.json()) as { satker: RingkasanSatker[] };
        setDaftar(d.satker);
        setGalat(false);
      })
      .catch(() => setGalat(true));
  }, [versi]);

  const berdata = (daftar ?? []).filter((r) => r.pegawai > 0).sort((a, b) => bobot(b) - bobot(a));
  const tanpaData = (daftar ?? []).length - berdata.length;

  return (
    <section className={`dsb-panel ${className}`} aria-labelledby="judul-pemantauan-satker">
      <div className="dsb-panel-kepala">
        <h2 id="judul-pemantauan-satker" className="dsb-panel-judul">
          Satker & UPT {daftar && <small title={`${berdata.length} dari ${daftar.length} satker sudah punya data pegawai`}>{berdata.length}/{daftar.length}</small>}
        </h2>
        <Link href="/dashboard/satker" className="dsb-tautan">Semua →</Link>
      </div>

      {galat ? (
        <p className="dsb-kosong">Ringkasan satker gagal dimuat.</p>
      ) : !daftar ? (
        <div className="dsb-panel-isi flex flex-col gap-2" aria-hidden="true">
          {[1, 2, 3].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 44, borderRadius: 8 }} />)}
        </div>
      ) : (
        <>
          <ul className="dsb-satker-daftar dsb-gulir">
            {berdata.map((r) => {
              const pct = r.tahunIni.total > 0 ? Math.round((r.tahunIni.selesai / r.tahunIni.total) * 100) : 0;
              const berikutnya = r.mendatang.find((m) => m.jumlah > 0);
              return (
                <li key={r.satker.kode}>
                  <Link href={`/dashboard/satker/${r.satker.kode}`} title={r.satker.nama}>
                    <span className="dsb-nama">{namaSingkatSatker(r.satker)}</span>
                    <span className="dsb-satker-angka">
                      <span className="dsb-bar-mini" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                      {r.tahunIni.selesai}/{r.tahunIni.total}
                    </span>
                    <span className="dsb-satker-tanda">
                      {r.terlambat > 0 && <span data-nada="merah">{r.terlambat} lewat batas</span>}
                      {r.berpotensiRapelan > 0 && <span data-nada="kuning">{r.berpotensiRapelan} rapelan</span>}
                      {r.tahunIni.belumDiproses > 0 && <span>{r.tahunIni.belumDiproses} belum diproses</span>}
                      {berikutnya && <span>berikutnya {new Date(`${berikutnya.bulanTmt}-01T00:00:00`).toLocaleDateString("id-ID", { month: "short", year: "numeric" })}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {tanpaData > 0 && (
            <p className="dsb-kaki" style={{ margin: 0 }}>
              <span>{tanpaData} satker belum ada data pegawai.</span>
              <Link href="/dashboard/satker" className="dsb-tautan">Buka</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
