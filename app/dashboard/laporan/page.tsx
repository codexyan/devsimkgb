"use client";

import { useEffect, useMemo, useState } from "react";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, hariIniWita, tanggalKalender } from "@/lib/waktu";
import { hitungRekapStatus, rapelanSiklus, satuPerSiklus, type StatusRapelan } from "@/lib/rekapKgb";
import { SATKER } from "@/lib/satker";
import { KODE_SATKER_LAIN, kodeSatkerPegawai } from "@/lib/rekapSatker";
import { namaTampilSatker } from "@/app/dashboard/satker/labelSatker";

/* Laporan dan rekap KGB per tahun TMT. Angkanya memakai definisi yang sama dengan dashboard: KGB yang jatuh
   tempo tetapi belum diinput ikut dihitung sebagai Belum Diproses (baris "belum diinput"). Area bertanda
   #laporan-print-area dicetak dengan kop surat. */

interface KGBLaporan {
  id: string;
  isVirtual?: boolean;
  pegawaiId: string;
  pegawai: { nama: string; nip: string; jabatan: string; golonganRuang: string; unitKerja: string | null } | null;
  golonganLama: string;
  golonganBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number | null;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  tmtKgbBaru: string;
  status: string;
  flagRapelan: boolean;
  rapelanDitetapkan: boolean | null;
  isArsip: boolean | null;
  createdAt: string | null;
  surat: { nomorSurat: string; tanggalSurat: string; pathFile?: string | null } | null;
}

const BULAN_LIST = [
  { value: "", label: "Semua bulan" },
  { value: "1", label: "Januari" }, { value: "2", label: "Februari" },
  { value: "3", label: "Maret" }, { value: "4", label: "April" },
  { value: "5", label: "Mei" }, { value: "6", label: "Juni" },
  { value: "7", label: "Juli" }, { value: "8", label: "Agustus" },
  { value: "9", label: "September" }, { value: "10", label: "Oktober" },
  { value: "11", label: "November" }, { value: "12", label: "Desember" },
];

const STATUS_FILTER = ["belum_diproses", "sedang_diproses", "menunggu_keuangan", "selesai", "ditolak"] as const;

const LABEL_RAPELAN: Record<StatusRapelan, string> = {
  ditetapkan: "Rapelan",
  berpotensi: "Berpotensi rapelan",
};

function fmtRp(n: number | null | undefined) { return typeof n === "number" ? "Rp " + n.toLocaleString("id-ID") : "-"; }
function fmtTgl(s: string) {
  return formatTanggalId(s, { day: "numeric", month: "short", year: "numeric" });
}
function bulanTmt(k: KGBLaporan) {
  const tmt = tanggalKalender(k.tmtKgbBaru);
  return tmt ? tmt.getMonth() + 1 : 0;
}

/** Nama satker pendek dari unit kerja pegawai; unit di luar daftar ditandai. */
function namaSatkerDari(kode: string): string {
  if (kode === KODE_SATKER_LAIN) return "Belum sesuai daftar satker";
  const s = SATKER.find((x) => x.kode === kode);
  return s ? namaTampilSatker(s) : kode;
}

interface RekapBulanLaporan {
  label: string;
  total: number;
  selesai: number;
  menungguKeuangan: number;
  sedangDiproses: number;
  belumDiproses: number;
  ditolak: number;
  rapelanDitetapkan: number;
  berpotensiRapelan: number;
}

export default function LaporanPage() {
  // Tanggal hari ini (WITA) diambil sekali saat halaman dimuat.
  const [hariIni] = useState(() => hariIniWita());
  const tahunIni = hariIni.getFullYear();
  const [rawList, setRawList] = useState<KGBLaporan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tahun, setTahun]   = useState(tahunIni.toString());
  const [bulan, setBulan]   = useState("");
  const [status, setStatus] = useState("");
  const [satker, setSatker] = useState("");

  const tahunList = Array.from({ length: 5 }, (_, i) => (tahunIni - i).toString());

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/laporan?tahun=${tahun}`)
        .then(r => r.json() as Promise<{ kgbList?: KGBLaporan[] }>)
        .then(d => setRawList(Array.isArray(d.kgbList) ? d.kgbList : []))
        .catch(() => setRawList([]))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, [tahun]);

  // Daftar detail tetap memuat entri yang dibatalkan. Hitungan memakai definisi bersama lib/rekapKgb.ts:
  // satu KGB per pegawai per TMT, jadi KGB yang dibatalkan lalu diinput ulang dihitung satu kali.
  const dalamPeriode = useMemo(
    () => rawList.filter(k =>
      (!bulan || bulanTmt(k) === parseInt(bulan)) &&
      (!satker || kodeSatkerPegawai(k.pegawai?.unitKerja) === satker)),
    [rawList, bulan, satker],
  );
  const kgbList = useMemo(
    () => dalamPeriode.filter(k => !status || k.status === status),
    [dalamPeriode, status],
  );
  const siklus = useMemo(
    () => satuPerSiklus(dalamPeriode).filter(k => !status || k.status === status),
    [dalamPeriode, status],
  );

  // Status rapelan hanya untuk entri yang mewakili siklusnya; entri batal yang sudah diinput ulang tidak.
  const rapelanPerId = useMemo(() => {
    const peta = new Map<string, StatusRapelan | null>();
    for (const k of siklus) peta.set(k.id, rapelanSiklus(k, hariIni).rapelan);
    return peta;
  }, [siklus, hariIni]);

  const stats = useMemo(() => hitungRekapStatus(siklus, hariIni), [siklus, hariIni]);

  const perGolongan = useMemo(() => {
    const map: Record<string, number> = {};
    siklus.forEach(k => { map[k.golonganBaru] = (map[k.golonganBaru] || 0) + 1; });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [siklus]);

  const perBulan = useMemo(() => {
    const map: Record<number, RekapBulanLaporan> = {};
    siklus.forEach(k => {
      const bln = bulanTmt(k);
      if (!bln) return;
      if (!map[bln]) map[bln] = { label: BULAN_LIST.find(b => b.value === String(bln))?.label || String(bln), total: 0, selesai: 0, menungguKeuangan: 0, sedangDiproses: 0, belumDiproses: 0, ditolak: 0, rapelanDitetapkan: 0, berpotensiRapelan: 0 };
      const r = map[bln];
      r.total++;
      if (k.status === "selesai") r.selesai++;
      else if (k.status === "menunggu_keuangan") r.menungguKeuangan++;
      else if (k.status === "sedang_diproses") r.sedangDiproses++;
      else if (k.status === "belum_diproses") r.belumDiproses++;
      else if (k.status === "ditolak") r.ditolak++;
      const rapelan = rapelanPerId.get(k.id);
      if (rapelan === "ditetapkan") r.rapelanDitetapkan++;
      if (rapelan === "berpotensi") r.berpotensiRapelan++;
    });
    return Object.entries(map).sort(([a], [b]) => Number(a) - Number(b)).map(([, v]) => v);
  }, [siklus, rapelanPerId]);

  // Per satker memakai daftar satker baku, sehingga ejaan unit kerja yang berbeda tidak memecah hitungan.
  const perSatker = useMemo(() => {
    const map: Record<string, { selesai: number; total: number; belum: number }> = {};
    siklus.forEach(k => {
      const kode = kodeSatkerPegawai(k.pegawai?.unitKerja);
      if (!map[kode]) map[kode] = { selesai: 0, total: 0, belum: 0 };
      map[kode].total++;
      if (k.status === "selesai") map[kode].selesai++;
      if (k.status === "belum_diproses" || k.status === "ditolak") map[kode].belum++;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [siklus]);

  const maksGolongan = Math.max(1, ...perGolongan.map(([, n]) => n));

  const judulBulan = bulan ? (BULAN_LIST.find(b => b.value === bulan)?.label + " ") : "";
  const judulSatker = satker ? ` · ${namaSatkerDari(satker)}` : "";
  const judulLaporan = `Rekap KGB ${judulBulan}${tahun}${judulSatker}`;
  const selesaiPct = stats.total > 0 ? Math.round((stats.selesai / stats.total) * 100) : 0;
  const tanggalCetak = formatTanggalId(new Date());
  const jumlahBelumDiinput = kgbList.filter(k => k.isVirtual).length;

  const kolomStat: { label: string; value: number; nada?: "hijau" | "ungu" | "kuning" | "merah" | "navy" }[] = [
    { label: "Total KGB", value: stats.total },
    { label: infoStatusKgb("selesai").label, value: stats.selesai, nada: "hijau" },
    { label: infoStatusKgb("menunggu_keuangan").label, value: stats.menungguKeuangan, nada: "ungu" },
    { label: infoStatusKgb("sedang_diproses").label, value: stats.sedangDiproses, nada: "navy" },
    { label: infoStatusKgb("belum_diproses").label, value: stats.belumDiproses, nada: "kuning" },
    { label: infoStatusKgb("ditolak").label, value: stats.ditolak, nada: "merah" },
    { label: "Rapelan ditetapkan", value: stats.rapelanDitetapkan, nada: "merah" },
    { label: "Berpotensi rapelan", value: stats.berpotensiRapelan, nada: "kuning" },
  ];
  const catatanHitungan = "Satu KGB per pegawai per TMT. KGB yang jatuh tempo tetapi belum diinput dihitung sebagai Belum Diproses; KGB yang dibatalkan lalu diinput ulang dihitung sekali, dan Dibatalkan hanya memuat yang belum diinput ulang. Rapelan ditetapkan = keputusan keuangan saat konfirmasi.";

  return (
    <>
      <style>{`
        .no-print-screen { display: none !important; }
        @media print {
          body * { visibility: hidden !important; }
          #laporan-print-area, #laporan-print-area * { visibility: visible !important; }
          #laporan-print-area { position: absolute; top: 0; left: 0; width: 100%; padding: 0; }
          .no-print { display: none !important; }
          .no-print-screen { display: revert !important; }
          @page { margin: 1cm 1.5cm; size: A4 landscape; }
          #laporan-print-area table { border-collapse: collapse; width: 100%; min-width: 0 !important; }
          #laporan-print-area th, #laporan-print-area td { border: 0.5px solid #c0ccd8; padding: 3px 5px; font-size: 8px; }
          #laporan-print-area th { background: #edf1f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; color: #13295a !important; font-weight: 700; }
          #laporan-print-area .tbl-scroll { max-height: none !important; overflow: visible !important; }
          #laporan-print-area .tbl-scroll td *, #laporan-print-area .tbl-scroll th * { font-size: inherit !important; line-height: 1.3 !important; }
          #laporan-print-area .dsb-panel { border: 0 !important; border-radius: 0 !important; overflow: visible !important; }
          #laporan-print-area .dsb-titik { width: 5px; height: 5px; }
          .print-kop-divider { border-top: 2px solid #13295a; border-bottom: 0.5px solid #13295a; margin: 5px 0; }
          .print-meta-table td, .print-meta-table th { border: none !important; padding: 2px 4px !important; background: transparent !important; }
          .print-stat-row td { border: none !important; padding: 2px 8px !important; font-size: 9px !important; }
        }
      `}</style>

      <div className="dsb-halaman">
        {/* ── Kepala halaman dan saringan ── */}
        <header className="no-print dsb-halaman-kepala dsb-muncul">
          <div className="min-w-0">
            <p className="dsb-label">Laporan</p>
            <h1 className="dsb-halaman-judul">Rekap KGB {tahun}</h1>
            <p className="dsb-sub">
              {loading ? "Memuat…" : `${stats.total} KGB · ${selesaiPct}% selesai${judulBulan ? ` · TMT ${judulBulan.trim()}` : ""}${judulSatker}`}
            </p>
          </div>
          <button type="button" onClick={() => window.print()} className="dsb-tombol">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Cetak / PDF
          </button>
        </header>

        <div className="no-print dsb-alat dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
          <select value={tahun} onChange={e => setTahun(e.target.value)} aria-label="Tahun TMT" className="dsb-pilih">
            {tahunList.map(t => <option key={t} value={t}>Tahun {t}</option>)}
          </select>
          <select value={bulan} onChange={e => setBulan(e.target.value)} aria-label="Bulan TMT" className="dsb-pilih" data-aktif={bulan ? "" : undefined}>
            {BULAN_LIST.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status KGB" className="dsb-pilih" data-aktif={status ? "" : undefined}>
            <option value="">Semua status</option>
            {STATUS_FILTER.map(s => <option key={s} value={s}>{infoStatusKgb(s).label}</option>)}
          </select>
          <select value={satker} onChange={e => setSatker(e.target.value)} aria-label="Satker" className="dsb-pilih" data-aktif={satker ? "" : undefined}>
            <option value="">Semua satker</option>
            {SATKER.map(s => <option key={s.kode} value={s.kode}>{namaTampilSatker(s)}</option>)}
            <option value={KODE_SATKER_LAIN}>Belum sesuai daftar satker</option>
          </select>
          {(bulan || status || satker) && (
            <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => { setBulan(""); setStatus(""); setSatker(""); }}>
              Atur ulang
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Memuat laporan">
            <div className="dsb-kerangka" style={{ height: 150 }} />
            <div className="dsb-kerangka" style={{ height: 220 }} />
            <div className="dsb-kerangka" style={{ height: 360 }} />
          </div>
        ) : (
        <div id="laporan-print-area" className="flex flex-col gap-3.5">

          {/* ════ KOP SURAT (cetak saja) ════ */}
          <div className="no-print-screen" style={{ marginBottom: "8px" }}>
            <table className="print-meta-table" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "5px" }}>
              <tbody>
                <tr>
                  <td style={{ width: "70px", textAlign: "center", verticalAlign: "middle", border: "none", padding: "0" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo-imipas.png" alt="Logo Imipas" style={{ width: "58px", height: "58px", objectFit: "contain" }} />
                  </td>
                  <td style={{ textAlign: "center", verticalAlign: "middle", border: "none", padding: "0" }}>
                    <p style={{ fontSize: "8px", fontWeight: 600, color: "#13295a", letterSpacing: "0.5px", margin: 0 }}>
                      KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN REPUBLIK INDONESIA
                    </p>
                    <p style={{ fontSize: "13px", fontWeight: 800, color: "#13295a", margin: "2px 0 0" }}>
                      KANTOR WILAYAH DIREKTORAT JENDERAL PEMASYARAKATAN
                    </p>
                    <p style={{ fontSize: "12px", fontWeight: 700, color: "#13295a", margin: 0 }}>KALIMANTAN SELATAN</p>
                  </td>
                  <td style={{ width: "70px", textAlign: "center", verticalAlign: "middle", border: "none", padding: "0" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo-imipas.png" alt="Logo Imipas" style={{ width: "58px", height: "58px", objectFit: "contain" }} />
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="print-kop-divider" />
            <div style={{ textAlign: "center", margin: "5px 0 3px" }}>
              <p style={{ fontSize: "12px", fontWeight: 800, color: "#13295a", letterSpacing: "0.5px", margin: 0 }}>
                REKAP KENAIKAN GAJI BERKALA (KGB)
              </p>
              <p style={{ fontSize: "8.5px", color: "#4d586f", margin: "2px 0 0" }}>
                {judulLaporan} &nbsp;·&nbsp; Dicetak: {tanggalCetak}
              </p>
            </div>
            <table className="print-stat-row" style={{ width: "100%", borderCollapse: "collapse", marginTop: "4px", marginBottom: "2px" }}>
              <tbody>
                <tr>
                  {[
                    ...kolomStat.map(c => ({ l: c.label, v: c.value as number | string })),
                    { l: "Selesai %", v: `${selesaiPct}%` },
                  ].map(({ l, v }) => (
                    <td key={l} style={{ textAlign: "center", border: "0.5px solid #d3dae5", padding: "3px 8px" }}>
                      <div style={{ fontSize: "7px", color: "#677187" }}>{l}</div>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: "#13295a" }}>{v}</div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p style={{ fontSize: "7px", color: "#677187", margin: "0 0 6px" }}>{catatanHitungan}</p>
          </div>

          {/* ════ ANGKA (layar) ════ */}
          <div className="no-print dsb-angka-kisi dsb-muncul" data-baris="2" style={{ "--i": 2 } as React.CSSProperties}>
            {kolomStat.map((c, i) => (
              <div key={c.label} className="dsb-angka">
                <span className="dsb-angka-label">{c.label}</span>
                <span className="dsb-angka-nilai">
                  {c.value}
                  {i === 0 && <small>{selesaiPct}% selesai</small>}
                </span>
                {i === 0 ? (
                  <span className="dsb-angka-meta">
                    <span className="dsb-bar-mini" style={{ width: "100%" }} aria-hidden="true"><span style={{ width: `${selesaiPct}%` }} /></span>
                  </span>
                ) : c.value > 0 && c.nada ? (
                  <span className="dsb-angka-meta"><span className="dsb-titik" data-nada={c.nada} aria-hidden="true" />{Math.round((c.value / Math.max(stats.total, 1)) * 100)}% dari total</span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="no-print dsb-kecil" style={{ margin: "-4px 2px 0", lineHeight: 1.5 }}>{catatanHitungan}</p>

          {/* ════ RINCIAN: bulan TMT | satker | golongan ════ */}
          <div className="no-print dsb-rincian dsb-muncul" style={{ "--i": 3 } as React.CSSProperties}>
            <section className="dsb-panel" aria-labelledby="judul-per-bulan">
              <div className="dsb-panel-kepala">
                <h2 id="judul-per-bulan" className="dsb-panel-judul">Per bulan TMT <small>{perBulan.length} bulan</small></h2>
              </div>
              <div className="dsb-rincian-isi">
                {perBulan.length === 0 ? (
                  <p className="dsb-kosong" style={{ padding: "16px" }}>Tidak ada data</p>
                ) : (
                  <table className="dsb-tabel">
                    <tbody>
                      {perBulan.map(b => {
                        const pct = b.total > 0 ? (b.selesai / b.total) * 100 : 0;
                        const rapelan = b.rapelanDitetapkan + b.berpotensiRapelan;
                        return (
                          <tr key={b.label}>
                            <td className="dsb-nama" style={{ whiteSpace: "nowrap" }}>{b.label}</td>
                            <td style={{ width: "45%" }}>
                              <span className="dsb-bar-mini" style={{ width: "100%" }} aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                            </td>
                            <td className="kanan whitespace-nowrap">
                              {b.selesai}/{b.total}
                              {rapelan > 0 && <span className="dsb-kecil" style={{ color: "var(--st-red)", marginLeft: "8px" }}>{rapelan} rapelan</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="dsb-panel" aria-labelledby="judul-per-satker">
              <div className="dsb-panel-kepala">
                <h2 id="judul-per-satker" className="dsb-panel-judul">Per satker <small>{perSatker.length} satker</small></h2>
              </div>
              <div className="dsb-rincian-isi">
                {perSatker.length === 0 ? (
                  <p className="dsb-kosong" style={{ padding: "16px" }}>Tidak ada data</p>
                ) : (
                  <table className="dsb-tabel">
                    <tbody>
                      {perSatker.map(([kode, { selesai, total, belum }]) => {
                        const pct = total > 0 ? (selesai / total) * 100 : 0;
                        return (
                          <tr key={kode} className="dsb-baris-klik" onClick={() => setSatker(satker === kode ? "" : kode)} title="Saring laporan ke satker ini">
                            <td style={{ maxWidth: "200px" }}>
                              <p className="dsb-nama truncate" style={{ margin: 0, color: kode === KODE_SATKER_LAIN ? "var(--st-amber)" : undefined }}>{namaSatkerDari(kode)}</p>
                              {belum > 0 && <p className="dsb-kecil" style={{ margin: 0 }}>{belum} belum diproses</p>}
                            </td>
                            <td style={{ width: "34%" }}>
                              <span className="dsb-bar-mini" style={{ width: "100%" }} aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                            </td>
                            <td className="kanan whitespace-nowrap">{selesai}/{total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section className="dsb-panel" aria-labelledby="judul-per-golongan">
              <div className="dsb-panel-kepala">
                <h2 id="judul-per-golongan" className="dsb-panel-judul">Per golongan <small>{perGolongan.length} ruang</small></h2>
              </div>
              <div className="dsb-rincian-isi">
                {perGolongan.length === 0 ? (
                  <p className="dsb-kosong" style={{ padding: "16px" }}>Tidak ada data</p>
                ) : (
                  <table className="dsb-tabel">
                    <tbody>
                      {perGolongan.map(([ruang, jumlah]) => (
                        <tr key={ruang}>
                          <td className="dsb-nama" style={{ whiteSpace: "nowrap" }}>{ruang}</td>
                          <td style={{ width: "55%" }}>
                            <span className="dsb-bar-mini" style={{ width: "100%" }} aria-hidden="true">
                              <span style={{ width: `${(jumlah / maksGolongan) * 100}%`, background: "var(--accent)" }} />
                            </span>
                          </td>
                          <td className="kanan">{jumlah}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>

          {/* ════ REKAP PER BULAN (cetak saja) ════ */}
          {perBulan.length > 0 && (
            <div className="no-print-screen" style={{ marginBottom: "6px" }}>
              <p style={{ fontSize: "9px", fontWeight: 700, color: "#13295a", marginBottom: "3px" }}>REKAP PER BULAN</p>
              <table style={{ width: "100%" }}>
                <thead>
                  <tr>{["Bulan","Total","Selesai","Menunggu Keuangan","Sedang Diproses","Belum Diproses","Dibatalkan","Rapelan","Berpotensi Rapelan"].map(h => <th key={h} style={{ textAlign: "center" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {perBulan.map(b => (
                    <tr key={b.label}>
                      <td style={{ fontWeight: 600 }}>{b.label}</td>
                      <td style={{ textAlign: "center", fontWeight: 700 }}>{b.total}</td>
                      <td style={{ textAlign: "center" }}>{b.selesai}</td>
                      <td style={{ textAlign: "center" }}>{b.menungguKeuangan}</td>
                      <td style={{ textAlign: "center" }}>{b.sedangDiproses}</td>
                      <td style={{ textAlign: "center" }}>{b.belumDiproses}</td>
                      <td style={{ textAlign: "center" }}>{b.ditolak}</td>
                      <td style={{ textAlign: "center", fontWeight: b.rapelanDitetapkan > 0 ? 700 : 400 }}>{b.rapelanDitetapkan}</td>
                      <td style={{ textAlign: "center", fontWeight: b.berpotensiRapelan > 0 ? 700 : 400 }}>{b.berpotensiRapelan}</td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700 }}>
                    <td>Total</td>
                    <td style={{ textAlign: "center" }}>{stats.total}</td>
                    <td style={{ textAlign: "center" }}>{stats.selesai}</td>
                    <td style={{ textAlign: "center" }}>{stats.menungguKeuangan}</td>
                    <td style={{ textAlign: "center" }}>{stats.sedangDiproses}</td>
                    <td style={{ textAlign: "center" }}>{stats.belumDiproses}</td>
                    <td style={{ textAlign: "center" }}>{stats.ditolak}</td>
                    <td style={{ textAlign: "center" }}>{stats.rapelanDitetapkan}</td>
                    <td style={{ textAlign: "center" }}>{stats.berpotensiRapelan}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* ════ TABEL DETAIL ════ */}
          <section className="dsb-panel overflow-hidden dsb-muncul" style={{ "--i": 4 } as React.CSSProperties} aria-labelledby="judul-detail-laporan">
            <div className="no-print dsb-panel-kepala">
              <h2 id="judul-detail-laporan" className="dsb-panel-judul">Daftar KGB <small>{kgbList.length} entri</small></h2>
              {jumlahBelumDiinput > 0 && <span className="dsb-kecil">{jumlahBelumDiinput} belum diinput Tim SDM</span>}
            </div>
            <div className="no-print-screen" style={{ marginBottom: "3px" }}>
              <p style={{ fontSize: "9px", fontWeight: 700, color: "#13295a" }}>DAFTAR PEGAWAI KGB: {judulLaporan.toUpperCase()}</p>
            </div>

            {kgbList.length === 0 ? (
              <p className="dsb-kosong" style={{ padding: "48px 16px" }}>Tidak ada data KGB pada periode ini.</p>
            ) : (
              <div className="dsb-gulir-tabel tbl-scroll">
                <table className="dsb-tabel" style={{ minWidth: "1040px" }}>
                  <thead>
                    <tr>
                      {["No", "Pegawai", "Jabatan dan satker", "Golongan", "Gaji pokok baru", "MKG", "TMT KGB", "Nomor SK", "Status"].map(h => (
                        <th key={h} scope="col">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kgbList.map((k, i) => {
                      const selisih = k.gajiPokokBaru !== null ? k.gajiPokokBaru - k.gajiPokokLama : null;
                      const rapelan = rapelanPerId.get(k.id) ?? null;
                      const warna = warnaStatusKgb(k.status);
                      return (
                        <tr key={k.id} style={{ background: rapelan === "berpotensi" ? "var(--tint-amber-bg)" : undefined }}>
                          <td className="dsb-kecil">{i + 1}</td>
                          <td>
                            <p className="dsb-nama" style={{ margin: 0, whiteSpace: "nowrap" }}>{k.pegawai?.nama ?? "-"}</p>
                            <p className="dsb-kecil" style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>{k.pegawai?.nip ?? "-"}</p>
                          </td>
                          <td style={{ maxWidth: "220px" }}>
                            <p className="truncate" style={{ margin: 0 }}>{k.pegawai?.jabatan ?? "-"}</p>
                            <p className="dsb-kecil truncate" style={{ margin: 0 }} title={k.pegawai?.unitKerja ?? undefined}>
                              {namaSatkerDari(kodeSatkerPegawai(k.pegawai?.unitKerja))}
                            </p>
                          </td>
                          <td className="whitespace-nowrap">
                            {k.golonganLama !== k.golonganBaru ? `${k.golonganLama} → ${k.golonganBaru}` : k.golonganBaru}
                          </td>
                          <td className="whitespace-nowrap">
                            {k.isVirtual ? (
                              <>
                                <p style={{ margin: 0, color: "var(--dt4)" }}>Belum diinput</p>
                                <p className="dsb-kecil" style={{ margin: 0 }}>lama {fmtRp(k.gajiPokokLama)}</p>
                              </>
                            ) : (
                              <>
                                <p style={{ margin: 0, color: "var(--dtn)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{fmtRp(k.gajiPokokBaru)}</p>
                                <p className="dsb-kecil" style={{ margin: 0 }}>
                                  lama {fmtRp(k.gajiPokokLama)}{selisih !== null && selisih > 0 ? ` · +${selisih.toLocaleString("id-ID")}` : ""}
                                </p>
                              </>
                            )}
                          </td>
                          <td className="whitespace-nowrap">
                            {k.mkgTahunBaru === null ? <span className="dsb-kecil">–</span> : `${k.mkgTahunBaru} thn${k.mkgBulanBaru ? ` ${k.mkgBulanBaru} bln` : ""}`}
                          </td>
                          <td className="whitespace-nowrap">{fmtTgl(k.tmtKgbBaru)}</td>
                          <td>
                            {k.surat ? (
                              <>
                                <p style={{ margin: 0, color: "var(--dtn)", whiteSpace: "nowrap" }}>{k.surat.nomorSurat}</p>
                                <p className="dsb-kecil" style={{ margin: 0 }}>{fmtTgl(k.surat.tanggalSurat)}</p>
                              </>
                            ) : (
                              <span className="dsb-kecil">–</span>
                            )}
                          </td>
                          <td>
                            <span className="dsb-status">
                              <span className="dsb-titik" style={{ background: warna.color }} aria-hidden="true" />
                              {infoStatusKgb(k.status).label}
                            </span>
                            {rapelan && (
                              <p className="dsb-kecil" style={{ margin: "2px 0 0", color: rapelan === "ditetapkan" ? "var(--st-red)" : "var(--st-amber)" }}>
                                {LABEL_RAPELAN[rapelan]}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Kaki cetak */}
          <div className="no-print-screen" style={{ marginTop: "10px", borderTop: "0.5px solid #c0ccd8", paddingTop: "4px" }}>
            <table className="print-meta-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ border: "none", fontSize: "7px", color: "#4d586f", padding: 0 }}>SIM-KGB · Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan · Berdasarkan PP No. 5 Tahun 2024</td>
                  <td style={{ border: "none", fontSize: "7px", color: "#4d586f", padding: 0, textAlign: "right" }}>{judulLaporan} · Dicetak {tanggalCetak}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>
        )}
      </div>
    </>
  );
}
