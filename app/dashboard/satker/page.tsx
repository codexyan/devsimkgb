"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KepalaKartu } from "@/app/dashboard/components/PanelNavy";
import type { RingkasanSatker } from "@/lib/rekapSatker";
import { hariIniWita } from "@/lib/waktu";
import { namaBulan, namaTampilSatker } from "./labelSatker";

/* Modul Satker & UPT: ringkasan KGB setiap satuan kerja di lingkungan Kanwil (Kanwil dan 18 UPT).
   Satu baris per satker; klik untuk membuka rincian pegawai dan jadwal usulan satker itu. */

interface DataSatker {
  satker: RingkasanSatker[];
  pegawaiTanpaSatker: number;
}

type Saring = "semua" | "tindakan" | "kosong";

/** Nada baris: merah bila ada KGB lewat batas input, kuning bila ada potensi rapelan. */
function nadaBaris(r: RingkasanSatker): "merah" | "kuning" | undefined {
  if (r.terlambat > 0) return "merah";
  if (r.berpotensiRapelan > 0) return "kuning";
  return undefined;
}

/** Bulan TMT terdekat yang punya KGB: dasar surat usulan UPT berikutnya. */
function usulanBerikutnya(r: RingkasanSatker): { bulanTmt: string; jumlah: number } | null {
  return r.mendatang.find((m) => m.jumlah > 0) ?? null;
}

/** Bar bertumpuk selesai, diproses, dan belum diproses untuk KGB tahun berjalan. */
function BarProgres({ selesai, diproses, belum, total }: { selesai: number; diproses: number; belum: number; total: number }) {
  const lebar = (n: number) => `${total > 0 ? (n / total) * 100 : 0}%`;
  return (
    <span
      className="dsb-bar-tumpuk"
      role="img"
      aria-label={`${selesai} selesai, ${diproses} diproses, ${belum} belum diproses dari ${total}`}
    >
      <span data-nada="hijau" style={{ width: lebar(selesai) }} />
      <span data-nada="biru" style={{ width: lebar(diproses) }} />
      <span data-nada="abu" style={{ width: lebar(belum) }} />
    </span>
  );
}

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
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Satker & UPT</p>
          <h1 className="dsb-halaman-judul">Satuan kerja Kantor Wilayah Ditjenpas Kalimantan Selatan</h1>
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

      {/* Panel mengisi sisa layar; yang bergulir hanya tabelnya, dengan kepala kolom tetap terlihat. */}
      <section className="dsb-panel dsb-penuh overflow-hidden dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="judul-daftar-satker">
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
          <div className="dsb-gulir-tabel" style={{ borderTop: "1px solid var(--ln2)" }}>
            <table className="dsb-tabel dsb-tabel-satker" style={{ minWidth: "940px" }}>
              <thead>
                <tr>
                  <th scope="col">Satker</th>
                  <th scope="col" className="kanan">Pegawai</th>
                  <th scope="col" className="kanan">KGB {tahun}</th>
                  <th scope="col">Progres KGB {tahun}</th>
                  <th scope="col">Usulan berikutnya</th>
                  <th scope="col">Perlu perhatian</th>
                  <th scope="col"><span className="sr-only">Buka</span></th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((r) => {
                  const kosong = r.pegawai === 0;
                  const { total: kgb, selesai, diproses, belumDiproses: belum } = r.tahunIni;
                  const pct = kgb > 0 ? Math.round((selesai / kgb) * 100) : 0;
                  const berikut = usulanBerikutnya(r);
                  const href = `/dashboard/satker/${r.satker.kode}`;
                  return (
                    <tr
                      key={r.satker.kode}
                      className={kosong ? "dsb-baris-klik dsb-redup" : "dsb-baris-klik"}
                      data-nada={kosong ? undefined : nadaBaris(r)}
                      onClick={() => router.push(href)}
                    >
                      <td>
                        <Link href={href} className="dsb-nama" style={{ textDecoration: "none", color: kosong ? "var(--dt3)" : undefined }} onClick={(e) => e.stopPropagation()}>
                          {namaTampilSatker(r.satker)}
                        </Link>
                        <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>
                          KPPN {r.satker.kppn}
                        </p>
                      </td>
                      {kosong ? (
                        // Satu keterangan menggantikan deretan tanda strip pada satker yang belum berdata.
                        <td colSpan={5} className="dsb-kecil">
                          Belum ada data pegawai di SIM-KGB
                        </td>
                      ) : (
                        <>
                          <td className="kanan">{r.pegawai}</td>
                          <td className="kanan">{kgb}</td>
                          <td>
                            {kgb === 0 ? (
                              <span className="dsb-kecil">Tidak ada KGB tahun ini</span>
                            ) : (
                              <>
                                <span className="flex items-center gap-2">
                                  <BarProgres selesai={selesai} diproses={diproses} belum={belum} total={kgb} />
                                  <span className="dsb-angka-kecil">{pct}%</span>
                                </span>
                                <p className="dsb-kecil whitespace-nowrap" style={{ margin: "3px 0 0" }}>
                                  {selesai} selesai · {diproses} diproses · {belum} belum
                                </p>
                              </>
                            )}
                          </td>
                          <td>
                            {berikut ? (
                              <>
                                <span className="dsb-angka-kecil">TMT {namaBulan(berikut.bulanTmt)}</span>
                                <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>{berikut.jumlah} pegawai</p>
                              </>
                            ) : (
                              <span className="dsb-kecil whitespace-nowrap">Tidak ada dalam {r.mendatang.length} bulan</span>
                            )}
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1.5">
                              {r.terlambat > 0 && (
                                <span className="dsb-tag" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>
                                  <span className="dsb-titik" data-nada="merah" aria-hidden="true" />
                                  {r.terlambat} lewat batas
                                </span>
                              )}
                              {r.berpotensiRapelan > 0 && (
                                <span className="dsb-tag" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}>
                                  <span className="dsb-titik" data-nada="kuning" aria-hidden="true" />
                                  {r.berpotensiRapelan} rapelan
                                </span>
                              )}
                              {r.hukdis > 0 && (
                                <span className="dsb-tag" data-garis="">{r.hukdis} hukdis</span>
                              )}
                              {r.terlambat === 0 && r.berpotensiRapelan === 0 && r.hukdis === 0 && (
                                <span className="dsb-kecil inline-flex items-center gap-1.5">
                                  <span className="dsb-titik" data-nada="hijau" aria-hidden="true" />
                                  Sesuai jadwal
                                </span>
                              )}
                            </div>
                          </td>
                        </>
                      )}
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
        <div className="dsb-kaki">
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><span className="dsb-bar-legenda" data-nada="hijau" aria-hidden="true" />Selesai</span>
            <span className="inline-flex items-center gap-1.5"><span className="dsb-bar-legenda" data-nada="biru" aria-hidden="true" />Diproses Kanwil atau keuangan</span>
            <span className="inline-flex items-center gap-1.5"><span className="dsb-bar-legenda" data-nada="abu" aria-hidden="true" />Belum diproses</span>
          </span>
          <span>Garis tepi merah: ada KGB lewat batas input · kuning: berpotensi rapelan</span>
        </div>
      </section>
    </div>
  );
}
