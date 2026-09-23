"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { KepalaKartu } from "@/app/dashboard/components/PanelNavy";
import type { RingkasanSatker } from "@/lib/rekapSatker";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { hitungDeadlineSDM } from "@/lib/tabelGaji";
import { formatTanggalId, hariIniWita } from "@/lib/waktu";
import { geserBulan, namaBulan, namaTampilSatker } from "../labelSatker";

/* Rincian satu satker: angka KGB, pegawai dengan siklus KGB berjalan, dan jadwal surat usulan.
   Halaman ini juga menjadi dasar tampilan admin UPT (lihat saja, satker sendiri) di tahap berikutnya. */

interface PegawaiSatker {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  golonganRuang: string;
  tmtKgb: string | null;
  deadlineSDM: string | null;
  terkunci: boolean;
  statusKGB: string | null;
  kgbId: string | null;
  terlambat: boolean;
  rapelan: "ditetapkan" | "berpotensi" | null;
  statusHukdis: boolean;
}

type Saring = "semua" | "perlu" | "terlambat";

export default function HalamanSatkerDetail() {
  const { kode } = useParams<{ kode: string }>();
  const [data, setData] = useState<{ ringkasan: RingkasanSatker; pegawai: PegawaiSatker[] } | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [saring, setSaring] = useState<Saring>("semua");
  const tahun = hariIniWita().getFullYear();

  useEffect(() => {
    fetch(`/api/satker/${encodeURIComponent(kode)}`)
      .then(async (r) => {
        const d = (await r.json()) as { ringkasan: RingkasanSatker; pegawai: PegawaiSatker[]; error?: string };
        if (!r.ok) throw new Error(d.error ?? "Data satker gagal dimuat");
        setData(d);
      })
      .catch((e: Error) => setGalat(e.message));
  }, [kode]);

  const kembali = (
    <Link href="/dashboard/satker" className="dsb-kembali">
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      Semua satker
    </Link>
  );

  if (galat)
    return (
      <div className="dsb-halaman">
        {kembali}
        <div className="dsb-kartu dsb-kosong" role="alert" style={{ padding: "56px 20px" }}>
          <p className="dsb-judul" style={{ marginTop: 0 }}>Gagal memuat satker</p>
          <p>{galat}</p>
        </div>
      </div>
    );

  if (!data)
    return (
      <div className="dsb-halaman" role="status" aria-label="Memuat satker">
        {kembali}
        <div className="dsb-kerangka" style={{ height: 90 }} />
        <div className="dsb-kerangka" style={{ height: 110 }} />
        <div className="dsb-kerangka" style={{ height: 420 }} />
      </div>
    );

  const { ringkasan: r, pegawai } = data;
  const kanwil = r.satker.jenis === "kanwil";
  const pct = r.tahunIni.total > 0 ? Math.round((r.tahunIni.selesai / r.tahunIni.total) * 100) : 0;
  const perluDiproses = (p: PegawaiSatker) => !p.terkunci && (p.statusKGB === null || p.statusKGB === "ditolak");
  const tampil = pegawai.filter((p) =>
    saring === "perlu" ? perluDiproses(p) : saring === "terlambat" ? p.terlambat : true,
  );
  const jadwal = r.mendatang.filter((m) => m.jumlah > 0);

  return (
    <div className="dsb-halaman">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          {kembali}
          <p className="dsb-label" style={{ marginTop: "14px" }}>
            KPPN {r.satker.kppn}
          </p>
          <h1 className="dsb-halaman-judul">{namaTampilSatker(r.satker)}</h1>
          <p className="dsb-sub">
            {r.pegawai} pegawai aktif{r.hukdis > 0 ? ` · ${r.hukdis} dalam hukdis aktif` : ""}
            {kanwil ? "" : ` · SK KGB dikirim ke UPT, bagian keuangan UPT, dan KPPN ${r.satker.kppn}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/dashboard/pegawai?satker=${r.satker.kode}`} className="dsb-tombol" data-jenis="garis">Data Pegawai</Link>
          <Link href={`/dashboard/kgb?satker=${r.satker.kode}`} className="dsb-tombol">Proses KGB</Link>
        </div>
      </header>

      <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Belum diproses</span>
          <span className="dsb-angka-nilai">{r.tahunIni.belumDiproses}<small>dari {r.tahunIni.total}</small></span>
          <span className="dsb-angka-meta">
            <span className="dsb-titik" data-nada={r.terlambat > 0 ? "merah" : "hijau"} aria-hidden="true" />
            {r.terlambat > 0 ? `${r.terlambat} lewat batas input` : "Semua masih dalam jadwal"}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Dalam proses</span>
          <span className="dsb-angka-nilai">{r.tahunIni.diproses}</span>
          <span className="dsb-angka-meta">
            {r.tahunIni.menungguKeuangan > 0 && <span className="dsb-titik" data-nada="ungu" aria-hidden="true" />}
            {r.tahunIni.menungguKeuangan > 0 ? `${r.tahunIni.menungguKeuangan} menunggu keuangan` : "Tidak ada yang menunggu keuangan"}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Selesai</span>
          <span className="dsb-angka-nilai">{r.tahunIni.selesai}<small>/ {r.tahunIni.total}</small></span>
          <span className="dsb-angka-meta">
            <span className="dsb-bar-mini" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
            {pct}% KGB tahun {tahun}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Berpotensi rapelan</span>
          <span className="dsb-angka-nilai">{r.berpotensiRapelan}</span>
          <span className="dsb-angka-meta">
            <span className="dsb-titik" data-nada={r.berpotensiRapelan > 0 ? "kuning" : "hijau"} aria-hidden="true" />
            {r.tahunIni.rapelanDitetapkan > 0 ? `${r.tahunIni.rapelanDitetapkan} ditetapkan keuangan` : "Belum ada yang ditetapkan"}
          </span>
        </div>
      </div>

      <div className="dsb-kisi-dua dsb-muncul" data-lebar="kiri" style={{ "--i": 2 } as React.CSSProperties}>
        <section className="dsb-kartu overflow-hidden" aria-labelledby="judul-pegawai-satker">
          <div className="dsb-kartu-isi">
            <KepalaKartu
              idJudul="judul-pegawai-satker"
              label="Pegawai"
              judul="Pegawai dan KGB berjalan"
              sub="Diurutkan menurut TMT KGB. Pilih Buka untuk memproses di Proses KGB."
              aksi={
                <div className="dsb-segmen" role="group" aria-label="Saring pegawai">
                  {([
                    ["semua", `Semua ${pegawai.length}`],
                    ["perlu", `Perlu diproses ${pegawai.filter(perluDiproses).length}`],
                    ["terlambat", `Lewat batas ${pegawai.filter((p) => p.terlambat).length}`],
                  ] as [Saring, string][]).map(([nilai, label]) => (
                    <button key={nilai} type="button" aria-pressed={saring === nilai} data-nada={nilai === "terlambat" ? "merah" : undefined} onClick={() => setSaring(nilai)}>
                      {label}
                    </button>
                  ))}
                </div>
              }
            />
          </div>
          {tampil.length === 0 ? (
            <p className="dsb-kosong" style={{ borderTop: "1px solid var(--ln2)" }}>
              {pegawai.length === 0 ? "Belum ada data pegawai untuk satker ini. Impor lewat Data Pegawai." : "Tidak ada pegawai untuk saringan ini."}
            </p>
          ) : (
            <div className="overflow-x-auto" style={{ borderTop: "1px solid var(--ln2)" }}>
              <table className="dsb-tabel" style={{ minWidth: "640px" }}>
                <thead>
                  <tr>
                    <th scope="col">Pegawai</th>
                    <th scope="col">TMT KGB</th>
                    <th scope="col">Batas input</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((p) => {
                    const status = p.statusKGB ?? "belum_diproses";
                    const warna = warnaStatusKgb(status);
                    return (
                      <tr key={p.id} style={{ background: p.terlambat ? "var(--tint-red-bg)" : undefined }}>
                        <td>
                          <p className="dsb-nama" style={{ margin: 0 }}>{p.nama}</p>
                          <p className="dsb-kecil" style={{ margin: 0 }}>{p.golonganRuang} · {p.jabatan}</p>
                        </td>
                        <td className="whitespace-nowrap">{p.tmtKgb ? formatTanggalId(p.tmtKgb, { day: "numeric", month: "short", year: "numeric" }) : "–"}</td>
                        <td className="whitespace-nowrap">
                          {p.deadlineSDM ? formatTanggalId(p.deadlineSDM, { day: "numeric", month: "short", year: "numeric" }) : "–"}
                          {p.terlambat && <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-red)" }}>lewat batas</p>}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {p.terkunci ? (
                              <span className="dsb-tag" data-garis="">Belum dibuka</span>
                            ) : (
                              <span className="dsb-tag" style={{ background: warna.bg, color: warna.color }}>{infoStatusKgb(status).label}</span>
                            )}
                            {p.rapelan === "berpotensi" && !p.terlambat && (
                              <span className="dsb-tag" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}>Berpotensi rapelan</span>
                            )}
                            {p.rapelan === "ditetapkan" && (
                              <span className="dsb-tag" style={{ background: "var(--tint-amber-bg2)", color: "var(--st-amber)" }}>Rapelan</span>
                            )}
                            {p.statusHukdis && (
                              <span className="dsb-tag" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>Hukdis</span>
                            )}
                          </div>
                        </td>
                        <td className="kanan whitespace-nowrap">
                          <Link href={`/dashboard/kgb?pegawaiId=${encodeURIComponent(p.id)}`} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">Buka</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="dsb-kartu dsb-kartu-isi flex flex-col gap-3" aria-labelledby="judul-jadwal-usulan">
          <KepalaKartu
            idJudul="judul-jadwal-usulan"
            label={kanwil ? "Jadwal" : "Jadwal usulan UPT"}
            judul={kanwil ? "KGB enam bulan ke depan" : "Kapan UPT mengirim surat"}
            sub={kanwil
              ? "Jumlah pegawai Kanwil per bulan TMT dan batas input Tim SDM."
              : "Surat permohonan dikirim bulan ketiga sebelum TMT dan diterima Kanwil paling lambat awal bulan kedua."}
          />
          {jadwal.length === 0 ? (
            <p className="dsb-kosong" style={{ padding: "20px 8px" }}>Tidak ada KGB dalam enam bulan ke depan.</p>
          ) : (
            <ul className="dsb-jadwal">
              {jadwal.map((m) => {
                const [y, b] = m.bulanTmt.split("-").map(Number);
                const batasInput = hitungDeadlineSDM(new Date(y, b - 1, 1));
                return (
                  <li key={m.bulanTmt}>
                    <span>KGB berlaku <strong>{namaBulan(m.bulanTmt, true)}</strong></span>
                    <span className="dsb-tag" data-garis="">{m.jumlah} pegawai</span>
                    <span className="dsb-kecil">
                      {kanwil ? "" : `Surat UPT dikirim ${namaBulan(geserBulan(m.bulanTmt, -3), true)}, diterima paling lambat awal ${namaBulan(geserBulan(m.bulanTmt, -2), true)}. `}
                      Batas input Tim SDM {formatTanggalId(batasInput, { day: "numeric", month: "long" })}.
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
