"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatTanggalId, hariIniWita } from "@/lib/waktu";
import { useDashUser } from "@/app/dashboard/components/RoleContext";
import { PanelBulanRekon } from "@/app/dashboard/components/DaftarBulanRekon";
import PanelGajiWebUpt from "@/app/dashboard/components/PanelGajiWebUpt";
import { PanelNavy, PanelTindakan, Stat, StripStat, namaSapaan, sapaanWita, tanggalPanjangWita, type Tindakan } from "@/app/dashboard/components/PanelNavy";

interface KGBKeuangan {
  id: string;
  status: string;
  tmtKgbBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  flagRapelan: boolean;
  pegawai: {
    nama: string;
    nip: string;
    jabatan: string;
    golonganRuang?: string;
  } | null;
  surat: { nomorSurat: string; pathFile?: string | null } | null;
}

interface Stats {
  kgbTahunIni: number;
  selesai: number;
  rapelanKonfirmasi: number;
  rapelanBerisiko: number;
}

export default function DashboardKeuangan() {
  const dashUser = useDashUser();
  const [antrian, setAntrian]     = useState<KGBKeuangan[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  function fetchData() {
    setLoading(true);
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json() as Promise<{ stats?: Stats }>),
      fetch("/api/kgb?status=menunggu_keuangan&lingkup=kanwil").then((r) => r.json() as Promise<unknown>),
    ])
      .then(([dash, kgbList]) => {
        if (dash?.stats) setStats(dash.stats);
        setAntrian(Array.isArray(kgbList) ? (kgbList as KGBKeuangan[]) : []);
        setLastRefresh(new Date());
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(fetchData, 0);
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") fetchData();
    }, 60_000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);

  const tahun = hariIniWita().getFullYear();
  const nama = namaSapaan(dashUser.nama, "Keuangan");
  const pctSelesai = stats && stats.kgbTahunIni > 0 ? Math.round((stats.selesai / stats.kgbTahunIni) * 100) : 0;
  const antrianRapelan = antrian.filter((k) => k.flagRapelan).length;
  const tindakan: Tindakan[] = [];
  if (antrian.length > 0)
    tindakan.push({
      id: "antrian",
      nada: "ungu",
      isi: <>
        <strong>{antrian.length} SK</strong> menunggu konfirmasi keuangan
        {antrianRapelan > 0 ? <>, {antrianRapelan} di antaranya berpotensi rapelan</> : null}.
      </>,
      aksi: { label: "Tinjau dan konfirmasi", href: "/dashboard/keuangan" },
    });

  return (
    <div className="dsb-halaman" data-muat-layar="">

      <PanelNavy
        label="Dashboard Keuangan"
        judul={`${sapaanWita()}${nama ? `, ${nama}` : ""}`}
        sub={<>{tanggalPanjangWita()} · Konfirmasi SK KGB dan rekon Gaji Web</>}
        diperbarui={lastRefresh}
        onMuatUlang={fetchData}
        memuat={loading}
      >
        {stats && (
          <StripStat>
            <Stat
              href="/dashboard/keuangan"
              label="Menunggu konfirmasi"
              angka={antrian.length}
              meta={antrian.length === 0 ? "Antrian kosong" : antrianRapelan > 0 ? `${antrianRapelan} berpotensi rapelan` : "Tanpa potensi rapelan"}
              metaNada={antrian.length === 0 ? "hijau" : antrianRapelan > 0 ? "kuning" : "ungu"}
            />
            <Stat
              href="/dashboard/keuangan/riwayat"
              label="Selesai dikonfirmasi"
              angka={stats.selesai}
              satuan={`/ ${stats.kgbTahunIni} · ${pctSelesai}%`}
              progres={pctSelesai}
            />
            <Stat label="Rapelan ditetapkan" angka={stats.rapelanKonfirmasi} satuan={`TMT ${tahun}`} />
            <Stat
              label="Berpotensi rapelan"
              angka={stats.rapelanBerisiko}
              meta={stats.rapelanBerisiko > 0 ? "Belum selesai, lewat batas input SDM" : "Tidak ada potensi rapelan"}
              metaNada={stats.rapelanBerisiko > 0 ? "kuning" : "hijau"}
            />
          </StripStat>
        )}
      </PanelNavy>

      <div className="dsb-dasbor-isi">
      {/* Antrian KGB masuk */}
      <section className="dsb-panel dsb-antrian overflow-hidden dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="judul-antrian">
        <div className="dsb-panel-kepala">
          <h2 id="judul-antrian" className="dsb-panel-judul">KGB menunggu konfirmasi <small>{antrian.length}</small></h2>
          <Link href="/dashboard/keuangan" className="dsb-tautan">Buka halaman Keuangan →</Link>
        </div>

        {loading && antrian.length === 0 ? (
          <div className="flex flex-col gap-2" style={{ padding: "16px" }}>
            {[1, 2, 3].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 72, borderRadius: 8 }} />)}
          </div>
        ) : antrian.length === 0 ? (
          <div className="dsb-kosong" style={{ padding: "44px 16px" }}>
            <span className="dsb-pesan-ikon" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", width: 36, height: 36 }} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <p className="dsb-nama" style={{ margin: 0 }}>Tidak ada antrian KGB</p>
            <p style={{ margin: 0 }}>Semua KGB sudah diproses oleh keuangan</p>
          </div>
        ) : (
          <ul className="dsb-antrian-gulir">
            {antrian.map((k, i) => {
              const selisih = k.gajiPokokBaru - k.gajiPokokLama;
              const namaPegawai = k.pegawai?.nama ?? "-";
              return (
                <li key={k.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  style={{ borderTop: i > 0 ? "1px solid var(--ln2)" : undefined, fontSize: "14px" }}>
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="dsb-avatar" aria-hidden="true">
                      {namaPegawai.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="dsb-nama" style={{ margin: 0 }}>{namaPegawai}</p>
                        {k.pegawai?.golonganRuang && <span className="dsb-tag" data-garis="">{k.pegawai.golonganRuang}</span>}
                        {k.flagRapelan && (
                          <span className="dsb-status" style={{ fontSize: "12.5px", color: "var(--st-amber)" }}>
                            <span className="dsb-titik" data-nada="kuning" aria-hidden="true" />Berpotensi rapelan
                          </span>
                        )}
                      </div>
                      <p className="dsb-kecil" style={{ margin: "3px 0 0" }}>{k.pegawai?.nip ?? "-"} · {k.pegawai?.jabatan ?? "-"}</p>
                      <dl className="flex flex-wrap gap-x-6 gap-y-2 mt-2.5" style={{ fontSize: "13px" }}>
                        <div>
                          <dt className="dsb-kecil">TMT KGB</dt>
                          <dd style={{ margin: 0, color: "var(--dtn)", fontWeight: 500 }}>{formatTanggalId(k.tmtKgbBaru)}</dd>
                        </div>
                        <div>
                          <dt className="dsb-kecil">Gaji pokok baru</dt>
                          <dd style={{ margin: 0, color: "var(--dtn)", fontWeight: 500 }}>
                            Rp {k.gajiPokokBaru.toLocaleString("id-ID")}
                            {selisih > 0 && <span style={{ color: "var(--st-green)", fontWeight: 500 }}> +{selisih.toLocaleString("id-ID")}</span>}
                          </dd>
                        </div>
                        {k.surat && (
                          <div>
                            <dt className="dsb-kecil">Nomor SK</dt>
                            <dd style={{ margin: 0, color: "var(--dtn)", fontWeight: 500 }}>{k.surat.nomorSurat}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  </div>
                  {k.surat?.pathFile && (
                    // Membuka SK yang sudah ditandatangani dan diunggah, bukan SK yang dibuat ulang.
                    <a
                      href={`/api/blob/download?url=${encodeURIComponent(k.surat.pathFile)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Lihat SK yang sudah ditandatangani, ${namaPegawai}`}
                      className="dsb-tombol dsb-tombol-kecil shrink-0 self-start sm:self-center"
                      data-jenis="garis"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                      Lihat SK
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <aside className="dsb-samping dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-label="Ringkasan pendamping">
        <PanelTindakan daftar={loading && !stats ? [] : tindakan} kosong="Tidak ada SK yang menunggu konfirmasi." />
        <PanelBulanRekon versi={lastRefresh?.getTime()} />
        {/* Pegawai UPT bukan antrian keuangan Kanwil (ADR-009); yang tampil hanya pemantauannya. */}
        <PanelGajiWebUpt versi={lastRefresh?.getTime()} />
      </aside>
      </div>
    </div>
  );
}
