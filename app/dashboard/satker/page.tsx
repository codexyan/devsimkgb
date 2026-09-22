"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KepalaKartu } from "@/app/dashboard/components/PanelNavy";
import type { RingkasanSatker } from "@/lib/rekapSatker";
import { hariIniWita } from "@/lib/waktu";
import { LABEL_JENIS_SATKER, namaTampilSatker } from "./labelSatker";

/* Modul Satker & UPT: ringkasan KGB setiap satuan kerja di lingkungan Kanwil (Kanwil dan 18 UPT).
   Satu baris per satker; klik untuk membuka rincian pegawai dan jadwal usulan satker itu. */

interface DataSatker {
  satker: RingkasanSatker[];
  pegawaiTanpaSatker: number;
}

type Saring = "semua" | "tindakan" | "kosong";

export default function HalamanSatker() {
  const router = useRouter();
  const [data, setData] = useState<DataSatker | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [saring, setSaring] = useState<Saring>("semua");
  const [cari, setCari] = useState("");
  const tahun = hariIniWita().getFullYear();

  useEffect(() => {
    fetch("/api/satker")
      .then(async (r) => {
        const d = (await r.json()) as DataSatker & { error?: string };
        if (!r.ok) throw new Error(d.error ?? "Ringkasan satker gagal dimuat");
        setData(d);
      })
      .catch((e: Error) => setGalat(e.message));
  }, []);

  if (galat)
    return (
      <div className="dsb-halaman">
        <div className="dsb-kartu dsb-kosong" role="alert" style={{ padding: "56px 20px" }}>
          <p className="dsb-judul" style={{ marginTop: 0 }}>Gagal memuat satker</p>
          <p>{galat}</p>
        </div>
      </div>
    );

  if (!data)
    return (
      <div className="dsb-halaman" role="status" aria-label="Memuat satker">
        <div className="dsb-kerangka" style={{ height: 90 }} />
        <div className="dsb-kerangka" style={{ height: 110 }} />
        <div className="dsb-kerangka" style={{ height: 480 }} />
      </div>
    );

  const semua = data.satker;
  const jumlah = (f: (r: RingkasanSatker) => number) => semua.reduce((n, r) => n + f(r), 0);
  const total = {
    berdata: semua.filter((r) => r.pegawai > 0).length,
    pegawai: jumlah((r) => r.pegawai),
    kgb: jumlah((r) => r.tahunIni.total),
    belum: jumlah((r) => r.tahunIni.belumDiproses),
    selesai: jumlah((r) => r.tahunIni.selesai),
    terlambat: jumlah((r) => r.terlambat),
    rapelan: jumlah((r) => r.berpotensiRapelan),
  };
  const perluTindakan = (r: RingkasanSatker) => r.terlambat > 0 || r.berpotensiRapelan > 0;
  const q = cari.trim().toLowerCase();
  const tampil = semua.filter((r) => {
    if (saring === "tindakan" && !perluTindakan(r)) return false;
    if (saring === "kosong" && r.pegawai > 0) return false;
    return !q || r.satker.nama.toLowerCase().includes(q) || r.satker.kppn.toLowerCase().includes(q);
  });
  const pilihan: { nilai: Saring; label: string; jumlah: number }[] = [
    { nilai: "semua", label: "Semua", jumlah: semua.length },
    { nilai: "tindakan", label: "Perlu tindakan", jumlah: semua.filter(perluTindakan).length },
    { nilai: "kosong", label: "Belum ada data", jumlah: semua.length - total.berdata },
  ];

  return (
    <div className="dsb-halaman">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Satker & UPT</p>
          <h1 className="dsb-halaman-judul">Satuan kerja Kanwil Ditjenpas Kalsel</h1>
          <p className="dsb-sub">
            {semua.length} satker: Kanwil, 8 Lapas, 6 Rutan, 3 Bapas, dan 1 LPKA, masing-masing dengan KPPN mitra.
            Angka KGB dihitung untuk TMT tahun {tahun}; lewat batas dan rapelan mencakup semua siklus yang belum selesai.
          </p>
        </div>
      </header>

      <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Satker dengan data pegawai</span>
          <span className="dsb-angka-nilai">{total.berdata}<small>dari {semua.length}</small></span>
          <span className="dsb-angka-meta">{total.pegawai} pegawai aktif terdata</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">KGB tahun {tahun}</span>
          <span className="dsb-angka-nilai">{total.kgb}</span>
          <span className="dsb-angka-meta">
            <span className="dsb-titik" data-nada="hijau" aria-hidden="true" />
            {total.selesai} selesai · {total.belum} belum diproses
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Lewat batas input</span>
          <span className="dsb-angka-nilai">{total.terlambat}</span>
          <span className="dsb-angka-meta">
            <span className="dsb-titik" data-nada={total.terlambat > 0 ? "merah" : "hijau"} aria-hidden="true" />
            {total.terlambat > 0 ? "Belum diinput Tim SDM" : "Semua masih dalam jadwal"}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Berpotensi rapelan</span>
          <span className="dsb-angka-nilai">{total.rapelan}</span>
          <span className="dsb-angka-meta">
            <span className="dsb-titik" data-nada={total.rapelan > 0 ? "kuning" : "hijau"} aria-hidden="true" />
            {total.rapelan > 0 ? "Tinjau di Proses KGB" : "Tidak ada potensi rapelan"}
          </span>
        </div>
      </div>

      {data.pegawaiTanpaSatker > 0 && (
        <div className="dsb-pesan dsb-muncul" data-nada="kuning" style={{ "--i": 2 } as React.CSSProperties}>
          <span className="dsb-pesan-ikon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </span>
          <p>
            <strong>{data.pegawaiTanpaSatker} pegawai</strong> unit kerjanya belum sesuai daftar satker, sehingga tidak masuk hitungan satker mana pun.{" "}
            <Link href="/dashboard/pegawai?satker=__lain__">Perbaiki di Data Pegawai</Link>
          </p>
        </div>
      )}

      <section className="dsb-kartu overflow-hidden dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="judul-daftar-satker">
        <div className="dsb-kartu-isi">
          <KepalaKartu
            idJudul="judul-daftar-satker"
            label="Daftar satker"
            judul="Ringkasan KGB per satker"
            sub="Pilih satker untuk melihat pegawainya dan jadwal surat usulan UPT."
            aksi={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  className="dsb-cari"
                  placeholder="Cari satker atau KPPN"
                  aria-label="Cari satker atau KPPN"
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
                <div className="dsb-segmen" role="group" aria-label="Saring satker">
                  {pilihan.map((p) => (
                    <button key={p.nilai} type="button" aria-pressed={saring === p.nilai} onClick={() => setSaring(p.nilai)}>
                      {p.label} <span style={{ color: "var(--dt5)" }}>{p.jumlah}</span>
                    </button>
                  ))}
                </div>
              </div>
            }
          />
        </div>

        {tampil.length === 0 ? (
          <p className="dsb-kosong" style={{ borderTop: "1px solid var(--ln2)" }}>Tidak ada satker untuk saringan ini.</p>
        ) : (
          <div className="overflow-x-auto" style={{ borderTop: "1px solid var(--ln2)" }}>
            <table className="dsb-tabel" style={{ minWidth: "860px" }}>
              <thead>
                <tr>
                  <th scope="col">Satker</th>
                  <th scope="col" className="kanan">Pegawai</th>
                  <th scope="col" className="kanan">KGB {tahun}</th>
                  <th scope="col" className="kanan">Belum diproses</th>
                  <th scope="col" className="kanan">Dalam proses</th>
                  <th scope="col">Selesai</th>
                  <th scope="col">Perlu perhatian</th>
                  <th scope="col"><span className="sr-only">Buka</span></th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((r) => {
                  const kosong = r.pegawai === 0;
                  const pct = r.tahunIni.total > 0 ? Math.round((r.tahunIni.selesai / r.tahunIni.total) * 100) : 0;
                  const href = `/dashboard/satker/${r.satker.kode}`;
                  return (
                    <tr key={r.satker.kode} className={kosong ? "dsb-baris-klik dsb-redup" : "dsb-baris-klik"} onClick={() => router.push(href)}>
                      <td>
                        <Link href={href} className="dsb-nama" style={{ textDecoration: "none", color: kosong ? "var(--dt3)" : undefined }} onClick={(e) => e.stopPropagation()}>
                          {namaTampilSatker(r.satker)}
                        </Link>
                        <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>
                          {LABEL_JENIS_SATKER[r.satker.jenis]} · KPPN {r.satker.kppn}
                        </p>
                      </td>
                      <td className="kanan">{kosong ? "–" : r.pegawai}</td>
                      <td className="kanan">{kosong ? "–" : r.tahunIni.total}</td>
                      <td className="kanan">{kosong ? "–" : r.tahunIni.belumDiproses}</td>
                      <td className="kanan">{kosong ? "–" : r.tahunIni.diproses}</td>
                      <td>
                        {kosong ? (
                          <span className="dsb-kecil">–</span>
                        ) : (
                          <span className="inline-flex items-center gap-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                            <span className="dsb-bar-mini" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                            {r.tahunIni.selesai}/{r.tahunIni.total}
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1.5">
                          {kosong && <span className="dsb-tag" data-garis="">Belum ada data pegawai</span>}
                          {r.terlambat > 0 && (
                            <span className="dsb-tag" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>{r.terlambat} lewat batas</span>
                          )}
                          {r.berpotensiRapelan > 0 && (
                            <span className="dsb-tag" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}>{r.berpotensiRapelan} rapelan</span>
                          )}
                          {r.hukdis > 0 && (
                            <span className="dsb-tag" data-garis="">{r.hukdis} hukdis</span>
                          )}
                          {!kosong && r.terlambat === 0 && r.berpotensiRapelan === 0 && r.hukdis === 0 && (
                            <span className="dsb-kecil">Sesuai jadwal</span>
                          )}
                        </div>
                      </td>
                      <td className="kanan" aria-hidden="true" style={{ color: "var(--dt5)" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
