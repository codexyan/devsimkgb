"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, hariIniWita } from "@/lib/waktu";
import { useDashUser } from "@/app/dashboard/components/RoleContext";
import { KepalaKartu, KisiKpi, Kpi, PanelNavy, namaDepan, sapaanWita, tanggalPanjangWita } from "@/app/dashboard/components/PanelNavy";

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
      fetch("/api/kgb?status=menunggu_keuangan").then((r) => r.json() as Promise<unknown>),
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
  const nama = namaDepan(dashUser.nama);
  const pctSelesai = stats && stats.kgbTahunIni > 0 ? Math.round((stats.selesai / stats.kgbTahunIni) * 100) : 0;

  return (
    <div className="dsb-halaman">

      <PanelNavy
        label="Dashboard · Keuangan"
        judul={`${sapaanWita()}${nama ? `, ${nama}` : ""}`}
        sub={<>{tanggalPanjangWita()} · Konfirmasi SK KGB dan rekon Gaji Web</>}
        chips={loading && !stats ? [] : [
          antrian.length > 0
            ? { teks: `${antrian.length} SK menunggu konfirmasi`, nada: "ungu" }
            : { teks: "Tidak ada SK yang menunggu", nada: "hijau" },
          ...(stats && stats.rapelanKonfirmasi > 0
            ? [{ teks: `${stats.rapelanKonfirmasi} KGB TMT ${tahun} dikonfirmasi rapelan`, nada: "kuning" as const }]
            : []),
        ]}
        diperbarui={lastRefresh}
        onMuatUlang={fetchData}
        memuat={loading}
      >
        {stats && (
          <KisiKpi>
            <Kpi
              href="/dashboard/keuangan"
              label="Antrian masuk"
              angka={antrian.length}
              meta={antrian.length > 0 ? "Menunggu konfirmasi" : "Tidak ada antrian"}
              metaNada={antrian.length > 0 ? "ungu" : "hijau"}
            />
            <Kpi
              label="KGB selesai"
              angka={stats.selesai}
              satuan={tahun}
              progres={pctSelesai}
              meta={`${pctSelesai}% dari KGB tahun ini`}
              metaNada="hijau"
            />
            <Kpi label="KGB tahun ini" angka={stats.kgbTahunIni} satuan={tahun} meta="Semua status" />
            <Kpi
              label="Rapelan"
              angka={stats.rapelanKonfirmasi}
              satuan={tahun}
              meta={stats.rapelanBerisiko > 0 ? `${stats.rapelanBerisiko} berpotensi rapelan` : "Tidak ada potensi rapelan"}
              metaNada={stats.rapelanBerisiko > 0 ? "kuning" : undefined}
            />
          </KisiKpi>
        )}
      </PanelNavy>

      {/* Antrian KGB masuk */}
      <section className="dsb-kartu overflow-hidden dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="judul-antrian">
        <div className="dsb-kartu-isi">
          <KepalaKartu
            idJudul="judul-antrian"
            label="Antrian"
            judul="KGB menunggu konfirmasi keuangan"
            sub={`${antrian.length} KGB masuk, perlu ditindaklanjuti`}
            aksi={antrian.length > 0 && (
              <Link href="/dashboard/keuangan" className="dsb-tombol">
                Tinjau dan konfirmasi
              </Link>
            )}
          />
        </div>

        {loading && antrian.length === 0 ? (
          <div className="px-5 pb-5 flex flex-col gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 72, borderRadius: 14 }} />)}
          </div>
        ) : antrian.length === 0 ? (
          <div className="dsb-kosong" style={{ borderTop: "1px solid var(--ln2)", padding: "44px 16px" }}>
            <span className="dsb-pesan-ikon" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", width: 36, height: 36 }} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <p className="dsb-nama" style={{ margin: 0 }}>Tidak ada antrian KGB</p>
            <p style={{ margin: 0 }}>Semua KGB sudah diproses oleh keuangan</p>
          </div>
        ) : (
          <ul style={{ borderTop: "1px solid var(--ln2)" }}>
            {antrian.map((k, i) => {
              const st = { label: infoStatusKgb(k.status).label, ...warnaStatusKgb(k.status) };
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
                        <span className="dsb-tag" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        {k.flagRapelan && (
                          <span className="dsb-tag" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}>Berpotensi rapelan</span>
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
    </div>
  );
}
