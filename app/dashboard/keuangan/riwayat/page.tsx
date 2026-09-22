"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, hariIniWita, isoTanggalLokal, tanggalKalender } from "@/lib/waktu";
import { kunciTanggal, tahunTmt } from "@/lib/rekapKgb";
import { bulanFokusRekon, jendelaRekonGaji, statusRekonGaji, type StatusRekon } from "@/lib/rekonGaji";
import { cariSatker } from "@/lib/satker";
import { namaBulan, namaSingkatSatker } from "@/app/dashboard/satker/labelSatker";

/* Riwayat Aktivitas Keuangan: jejak konfirmasi (siapa, kapan, rapelan atau tidak), rekap dasar Gaji Web per
   bulan TMT, dan riwayat KGB per pegawai. Rekap memakai /api/keuangan/rekon (lib/rekapKgb.ts), jadi angkanya
   sama dengan halaman Keuangan dan Laporan. */

interface LogEntry {
  id: string;
  waktu: string;
  aksi: string;
  detail: string;
  targetNama?: string | null;
  user: { nama: string; nip: string } | null;
}

/** Rekap per bulan TMT dari GET /api/keuangan/rekon (lib/rekapKgb.ts rekapPerBulanTmt). */
interface RekapBulan {
  bulanTmt: string;
  total: number;
  dikonfirmasi: number;
  menungguKeuangan: number;
  belumSampaiKeuangan: number;
  dibatalkan: number;
  rapelanDitetapkan: number;
  berpotensiRapelan: number;
  konfirmasiTerakhir: string | null;
}

interface KGBItem {
  id: string;
  status: string;
  nomorSK: string;
  isVirtual?: boolean;
  isArsip?: boolean;
  tmtKgbBaru: string;
  golonganLama: string;
  golonganBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number | null;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  rapelanDitetapkan: boolean | null;
  konfirmasiKeuanganAt?: string | null;
  pegawai: { nama: string; nip: string; jabatan: string; unitKerja: string } | null;
  surat: { nomorSurat: string; tanggalSurat?: string; pathFile?: string | null } | null;
}
type KGBRiwayat = KGBItem & { pegawai: NonNullable<KGBItem["pegawai"]> };

type Tab = "log" | "rekap" | "kgb";
type SaringLog = "semua" | "rapelan" | "cepat";
type SaringKgb = "semua" | "tahunIni" | "rapelan";

/* ─── pembantu ─── */

const fmtTgl = (s: string | null | undefined) => (s ? formatTanggalId(s, { day: "numeric", month: "short", year: "numeric" }) : "-");
const fmtJam = (s: string) => formatTanggalId(s, { hour: "2-digit", minute: "2-digit" });
const fmtRp = (n: number | null | undefined) => (typeof n === "number" ? "Rp " + n.toLocaleString("id-ID") : "-");

function satkerPendek(unitKerja: string | null | undefined): string {
  const s = cariSatker(unitKerja);
  return s ? namaSingkatSatker(s) : unitKerja?.trim() || "-";
}

async function bacaJson<T>(res: Response, bawaan: T): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return bawaan;
  }
}

interface IsiLog {
  nama: string;
  nip: string;
  golongan: string;
  gaji: string;
  rapelan: boolean;
  cepat: boolean;
}

/** Urai detail log konfirmasi dari /api/kgb/[id]/konfirmasi-keuangan; null bila formatnya lain (log lama). */
function uraiLog(detail: string): IsiLog | null {
  const m = /^Konfirmasi KGB (.+) \((\d+)\), Gol\. ([^,]+), Gaji (Rp [\d.]+), Rapelan: (Ya|Tidak)(, melalui Konfirmasi cepat)?/.exec(detail);
  return m ? { nama: m[1], nip: m[2], golongan: m[3], gaji: m[4], rapelan: m[5] === "Ya", cepat: !!m[6] } : null;
}

function labelHari(kunci: string, hariIni: Date): string {
  const t = tanggalKalender(kunci);
  if (!t) return kunci;
  const selisih = Math.round((hariIni.getTime() - t.getTime()) / 86_400_000);
  const tanggal = formatTanggalId(t, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return selisih === 0 ? `Hari ini, ${tanggal}` : selisih === 1 ? `Kemarin, ${tanggal}` : tanggal;
}

function selCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function unduhCsv(namaBerkas: string, kepala: string[], baris: (string | number | null | undefined)[][]) {
  const isi = [kepala, ...baris].map((b) => b.map(selCsv).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + isi], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const LABEL_STATUS_REKON: Record<StatusRekon, string> = {
  akan_datang: "belum dimulai",
  berjalan: "sedang berjalan",
  lewat: "sudah lewat",
};

function StatusKgb({ status }: { status: string }) {
  return (
    <span className="dsb-status">
      <span className="dsb-titik" style={{ background: warnaStatusKgb(status).color }} aria-hidden="true" />
      {status === "selesai" ? "Dikonfirmasi" : infoStatusKgb(status).label}
    </span>
  );
}

/* ─── halaman ─── */

export default function RiwayatKeuanganPage() {
  const params = useSearchParams();
  const [hariIni] = useState(() => hariIniWita());
  const tahun = hariIni.getFullYear();
  const bulanFokus = bulanFokusRekon(hariIni);

  const [tab, setTab] = useState<Tab>(() => {
    const t = params.get("tab");
    return t === "rekap" || t === "kgb" ? t : "log";
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [rekap, setRekap] = useState<RekapBulan[]>([]);
  const [kgbList, setKgbList] = useState<KGBRiwayat[]>([]);
  const [loading, setLoading] = useState(true);
  const [galat, setGalat] = useState(false);

  const [cariLog, setCariLog] = useState("");
  const [saringLog, setSaringLog] = useState<SaringLog>("semua");
  const [cariKgb, setCariKgb] = useState("");
  const [saringKgb, setSaringKgb] = useState<SaringKgb>("semua");
  const [terbuka, setTerbuka] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    setGalat(false);
    try {
      const [r1, r2, r3] = await Promise.all([fetch("/api/keuangan/log"), fetch("/api/keuangan/rekon"), fetch("/api/kgb")]);
      if (!r1.ok || !r2.ok || !r3.ok) setGalat(true);
      if (r1.ok) { const d = await bacaJson<unknown>(r1, []); setLogs(Array.isArray(d) ? (d as LogEntry[]) : []); }
      if (r2.ok) { const d = await bacaJson<unknown>(r2, []); setRekap(Array.isArray(d) ? (d as RekapBulan[]) : []); }
      if (r3.ok) {
        const d = await bacaJson<unknown>(r3, []);
        // Entri virtual (belum punya record KGB) bukan riwayat.
        const daftar = Array.isArray(d) ? (d as KGBItem[]) : [];
        setKgbList(daftar.filter((k): k is KGBRiwayat => !k.isVirtual && !!k.id && !!k.pegawai));
      }
    } catch {
      setGalat(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  /* ── Log konfirmasi ── */
  const logDiurai = useMemo(() => logs.map((l) => ({ ...l, isi: l.aksi === "konfirmasi_keuangan" ? uraiLog(l.detail) : null })), [logs]);
  const qLog = cariLog.trim().toLowerCase();
  const logTampil = logDiurai.filter((l) => {
    if (saringLog === "rapelan" && !l.isi?.rapelan) return false;
    if (saringLog === "cepat" && !l.isi?.cepat) return false;
    if (!qLog) return true;
    return l.detail.toLowerCase().includes(qLog) || (l.user?.nama ?? "").toLowerCase().includes(qLog);
  });
  const logPerHari = useMemo(() => {
    const peta = new Map<string, typeof logTampil>();
    for (const l of logTampil) {
      const k = kunciTanggal(l.waktu) ?? "";
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k)!.push(l);
    }
    return [...peta.entries()];
  }, [logTampil]);
  const batas30 = hariIni.getTime() - 30 * 86_400_000;
  const log30 = logDiurai.filter((l) => l.aksi === "konfirmasi_keuangan" && new Date(l.waktu).getTime() >= batas30);

  function unduhLog() {
    unduhCsv(
      `log-konfirmasi-keuangan_${isoTanggalLokal(hariIni)}.csv`,
      ["Waktu", "Aksi", "Nama", "NIP", "Golongan", "Gaji pokok baru", "Rapelan", "Konfirmasi cepat", "Oleh", "Detail"],
      logTampil.map((l) => [
        formatTanggalId(l.waktu, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        l.aksi === "konfirmasi_keuangan" ? "Konfirmasi KGB" : "Rekon keuangan (lama)",
        l.isi?.nama ?? l.targetNama ?? "", l.isi?.nip ?? "", l.isi?.golongan ?? "", l.isi?.gaji ?? "",
        l.isi ? (l.isi.rapelan ? "Ya" : "Tidak") : "", l.isi ? (l.isi.cepat ? "Ya" : "Tidak") : "",
        l.user?.nama ?? "", l.detail,
      ]),
    );
  }

  /* ── Riwayat KGB per pegawai ── */
  const pegawaiList = useMemo(() => {
    const peta = new Map<string, KGBRiwayat[]>();
    for (const k of kgbList) {
      if (!peta.has(k.pegawai.nip)) peta.set(k.pegawai.nip, []);
      peta.get(k.pegawai.nip)!.push(k);
    }
    return [...peta.entries()]
      .map(([nip, daftar]) => {
        const urut = [...daftar].sort((a, b) => (tanggalKalender(b.tmtKgbBaru)?.getTime() ?? 0) - (tanggalKalender(a.tmtKgbBaru)?.getTime() ?? 0));
        return {
          nip,
          pegawai: urut[0].pegawai,
          kgbs: urut,
          adaTahunIni: urut.some((k) => tahunTmt(k) === tahun),
          adaRapelan: urut.some((k) => k.rapelanDitetapkan === true),
        };
      })
      .sort((a, b) => Number(b.adaTahunIni) - Number(a.adaTahunIni) || a.pegawai.nama.localeCompare(b.pegawai.nama, "id"));
  }, [kgbList, tahun]);
  const qKgb = cariKgb.trim().toLowerCase();
  const pegawaiTampil = pegawaiList.filter((e) => {
    if (saringKgb === "tahunIni" && !e.adaTahunIni) return false;
    if (saringKgb === "rapelan" && !e.adaRapelan) return false;
    if (!qKgb) return true;
    return (
      e.pegawai.nama.toLowerCase().includes(qKgb) ||
      e.nip.includes(qKgb) ||
      e.kgbs.some((k) => (k.nomorSK ?? "").toLowerCase().includes(qKgb) || (k.surat?.nomorSurat ?? "").toLowerCase().includes(qKgb))
    );
  });

  const TAB: { v: Tab; l: string; n: number }[] = [
    { v: "log", l: "Log konfirmasi", n: logs.length },
    { v: "rekap", l: "Rekap Gaji Web", n: rekap.length },
    { v: "kgb", l: "Riwayat KGB pegawai", n: pegawaiList.length },
  ];

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Keuangan</p>
          <h1 className="dsb-halaman-judul">Riwayat aktivitas</h1>
          <p className="dsb-sub">Jejak konfirmasi SK, rekap dasar input Gaji Web per bulan TMT, dan riwayat KGB setiap pegawai.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="dsb-ikon-tombol" onClick={() => void muat()} title="Muat ulang" aria-label="Muat ulang data">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? "dsb-putar" : undefined}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
          </button>
          <Link href="/dashboard/keuangan" className="dsb-tombol" data-jenis="garis">Ke halaman Keuangan</Link>
        </div>
      </header>

      <div className="dsb-segmen dsb-muncul" role="group" aria-label="Bagian riwayat" style={{ alignSelf: "flex-start", "--i": 1 } as React.CSSProperties}>
        {TAB.map((t) => (
          <button key={t.v} type="button" aria-pressed={tab === t.v} onClick={() => setTab(t.v)}>
            {t.l} {!loading && <span style={{ color: "var(--dt5)" }}>{t.n}</span>}
          </button>
        ))}
      </div>

      {galat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>Sebagian data gagal dimuat. <button type="button" className="dsb-tautan" onClick={() => void muat()}>Muat ulang</button></p>
        </div>
      )}

      {loading && logs.length === 0 && rekap.length === 0 ? (
        <div className="dsb-penuh flex flex-col gap-2" role="status" aria-label="Memuat riwayat">
          {[1, 2, 3, 4].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 52 }} />)}
        </div>
      ) : tab === "log" ? (
        /* ════ Log konfirmasi ════ */
        <section className="dsb-panel dsb-penuh overflow-hidden dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="judul-log">
          <div className="dsb-panel-kepala">
            <h2 id="judul-log" className="dsb-panel-judul">
              Log konfirmasi <small>{log30.length} dalam 30 hari terakhir · {log30.filter((l) => l.isi?.rapelan).length} rapelan</small>
            </h2>
            <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" disabled={logTampil.length === 0} onClick={unduhLog}>
              Unduh CSV ({logTampil.length})
            </button>
          </div>
          <div className="dsb-alat" style={{ padding: "12px 16px", borderBottom: "1px solid var(--ln2)" }}>
            <div className="dsb-segmen" role="group" aria-label="Saring jenis konfirmasi">
              {([["semua", "Semua"], ["rapelan", "Rapelan"], ["cepat", "Konfirmasi cepat"]] as [SaringLog, string][]).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={saringLog === v} onClick={() => setSaringLog(v)}>{l}</button>
              ))}
            </div>
            <input type="search" className="dsb-cari" aria-label="Cari di log" placeholder="Cari nama, NIP, atau petugas" value={cariLog} onChange={(e) => setCariLog(e.target.value)} />
          </div>

          {logTampil.length === 0 ? (
            <p className="dsb-kosong" style={{ padding: "44px 16px" }}>{logs.length === 0 ? "Belum ada konfirmasi yang tercatat." : "Tidak ada log yang cocok dengan saringan."}</p>
          ) : (
            <div className="dsb-gulir-tabel">
              <ol className="dsb-log">
                {logPerHari.map(([hari, isi]) => (
                  <li key={hari}>
                    <p className="dsb-log-hari">
                      <span>{labelHari(hari, hariIni)}</span>
                      <span>{isi.length} aktivitas</span>
                    </p>
                    <ol>
                      {isi.map((l) => (
                        <li key={l.id} className="dsb-log-baris">
                          <span className="dsb-log-jam">{fmtJam(l.waktu)}</span>
                          <span className="dsb-titik" data-nada={l.isi?.rapelan ? "merah" : l.isi ? "hijau" : undefined} aria-hidden="true" />
                          {l.isi ? (
                            <span className="min-w-0">
                              <span className="dsb-nama">{l.isi.nama}</span>
                              <span className="dsb-kecil" style={{ display: "block" }}>
                                {l.isi.nip} · Gol. {l.isi.golongan} · {l.isi.gaji}
                              </span>
                            </span>
                          ) : (
                            <span className="min-w-0">
                              <span className="dsb-nama">{l.aksi === "rekon_keuangan" ? "Rekon keuangan (fitur lama)" : l.aksi}</span>
                              <span className="dsb-kecil" style={{ display: "block" }}>{l.detail}</span>
                            </span>
                          )}
                          <span className="dsb-log-tanda">
                            {l.isi && (
                              <span style={{ color: l.isi.rapelan ? "var(--st-red)" : "var(--dt5)", fontWeight: l.isi.rapelan ? 600 : 400 }}>{l.isi.rapelan ? "Rapelan" : "Tidak rapelan"}</span>
                            )}
                            {l.isi?.cepat && <span className="dsb-tag" data-garis="">Konfirmasi cepat</span>}
                          </span>
                          <span className="dsb-kecil dsb-log-oleh">{l.user?.nama ?? "-"}</span>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {logs.length >= 500 && <p className="dsb-kaki" style={{ margin: 0 }}>Menampilkan 500 aktivitas terakhir.</p>}
        </section>
      ) : tab === "rekap" ? (
        /* ════ Rekap Gaji Web ════ */
        <section className="dsb-panel dsb-penuh overflow-hidden dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="judul-rekap">
          <div className="dsb-panel-kepala">
            <h2 id="judul-rekap" className="dsb-panel-judul">Rekap dasar Gaji Web per bulan TMT <small>{rekap.length} bulan</small></h2>
          </div>
          <p className="dsb-kecil" style={{ margin: 0, padding: "10px 16px", borderBottom: "1px solid var(--ln2)", fontSize: "12.5px", color: "var(--dt4)" }}>
            SK bulan TMT harus dikonfirmasi sebelum rekon Gaji Web tanggal 1–15 bulan sebelumnya. Dihitung dari data KGB saat dibuka; arsip tidak dihitung dan KGB yang dibatalkan lalu diinput ulang dihitung sekali.
          </p>
          {rekap.length === 0 ? (
            <p className="dsb-kosong" style={{ padding: "44px 16px" }}>Belum ada KGB untuk direkap.</p>
          ) : (
            <div className="dsb-gulir-tabel tbl-scroll">
              <table className="dsb-tabel" style={{ minWidth: "940px" }}>
                <thead>
                  <tr>
                    <th scope="col">Bulan TMT</th>
                    <th scope="col">Dikonfirmasi</th>
                    <th scope="col" className="kanan">Menunggu</th>
                    <th scope="col" className="kanan">Belum sampai</th>
                    <th scope="col">Rapelan</th>
                    <th scope="col">Rekon Gaji Web</th>
                    <th scope="col">Konfirmasi terakhir</th>
                    <th scope="col" className="kanan"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rekap.map((r) => {
                    const lengkap = r.total > 0 && r.dikonfirmasi === r.total;
                    const pct = r.total > 0 ? (r.dikonfirmasi / r.total) * 100 : 0;
                    const status = statusRekonGaji(r.bulanTmt, hariIni);
                    const { mulai, batas } = jendelaRekonGaji(r.bulanTmt);
                    const tertinggal = status === "lewat" && !lengkap;
                    return (
                      <tr key={r.bulanTmt} style={{ background: r.bulanTmt === bulanFokus ? "var(--tint-navy)" : undefined }}>
                        <td className="whitespace-nowrap">
                          <span className="dsb-nama">{namaBulan(r.bulanTmt, true)}</span>
                          {r.bulanTmt === bulanFokus && <span className="dsb-tag" data-garis="" style={{ marginLeft: 8 }}>fokus rekon</span>}
                        </td>
                        <td className="whitespace-nowrap">
                          <span className="dsb-bar-mini" style={{ width: 88, marginRight: 10 }} aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                          <span style={{ fontVariantNumeric: "tabular-nums", color: lengkap ? "var(--st-green)" : "var(--dtn)", fontWeight: 500 }}>{r.dikonfirmasi}/{r.total}</span>
                          {lengkap && <span className="dsb-kecil" style={{ marginLeft: 6, color: "var(--st-green)" }}>lengkap</span>}
                        </td>
                        <td className="kanan" style={{ color: r.menungguKeuangan > 0 ? "var(--st-violet)" : undefined }}>{r.menungguKeuangan}</td>
                        <td className="kanan" style={{ color: r.belumSampaiKeuangan > 0 ? "var(--st-amber)" : undefined }}>
                          {r.belumSampaiKeuangan}
                          {r.dibatalkan > 0 && <span className="dsb-kecil" style={{ display: "block" }}>{r.dibatalkan} dibatalkan</span>}
                        </td>
                        <td className="whitespace-nowrap">
                          {r.rapelanDitetapkan + r.berpotensiRapelan === 0 ? (
                            <span className="dsb-kecil">-</span>
                          ) : (
                            <>
                              {r.rapelanDitetapkan > 0 && <span style={{ color: "var(--st-red)" }}>{r.rapelanDitetapkan} ditetapkan</span>}
                              {r.berpotensiRapelan > 0 && <span className="dsb-kecil" style={{ display: "block", color: "var(--st-amber)" }}>{r.berpotensiRapelan} berpotensi</span>}
                            </>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {mulai.getDate()}–{formatTanggalId(batas, { day: "numeric", month: "short", year: "numeric" })}
                          <span className="dsb-kecil" style={{ display: "block", color: tertinggal ? "var(--st-red)" : status === "berjalan" ? "var(--st-violet)" : undefined }}>
                            {LABEL_STATUS_REKON[status]}{tertinggal ? `, ${r.total - r.dikonfirmasi} belum dikonfirmasi` : ""}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">{r.konfirmasiTerakhir ? fmtTgl(r.konfirmasiTerakhir) : <span className="dsb-kecil">-</span>}</td>
                        <td className="kanan">
                          <Link href={`/dashboard/keuangan?bulan=${r.bulanTmt}`} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">Buka</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        /* ════ Riwayat KGB per pegawai ════ */
        <section className="dsb-panel dsb-penuh overflow-hidden dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="judul-riwayat-kgb">
          <div className="dsb-panel-kepala">
            <h2 id="judul-riwayat-kgb" className="dsb-panel-judul">Riwayat KGB pegawai <small>{pegawaiTampil.length} pegawai</small></h2>
          </div>
          <div className="dsb-alat" style={{ padding: "12px 16px", borderBottom: "1px solid var(--ln2)" }}>
            <div className="dsb-segmen" role="group" aria-label="Saring pegawai">
              {([["semua", "Semua"], ["tahunIni", `Ada KGB ${tahun}`], ["rapelan", "Pernah rapelan"]] as [SaringKgb, string][]).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={saringKgb === v} onClick={() => setSaringKgb(v)}>{l}</button>
              ))}
            </div>
            <input type="search" className="dsb-cari" aria-label="Cari pegawai" placeholder="Cari nama, NIP, atau nomor SK" value={cariKgb} onChange={(e) => setCariKgb(e.target.value)} />
          </div>

          {pegawaiTampil.length === 0 ? (
            <p className="dsb-kosong" style={{ padding: "44px 16px" }}>{pegawaiList.length === 0 ? "Belum ada riwayat KGB." : "Tidak ada pegawai yang cocok."}</p>
          ) : (
            <div className="dsb-gulir-tabel tbl-scroll">
              <table className="dsb-tabel" style={{ minWidth: "860px" }}>
                <thead>
                  <tr>
                    <th scope="col">Pegawai</th>
                    <th scope="col">KGB terakhir</th>
                    <th scope="col">Gaji pokok</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="kanan">Siklus</th>
                  </tr>
                </thead>
                <tbody>
                  {pegawaiTampil.map((e) => {
                    const akhir = e.kgbs[0];
                    const buka = terbuka === e.nip;
                    const alih = () => setTerbuka(buka ? null : e.nip);
                    return (
                      <Fragment key={e.nip}>
                        <tr
                          className="dsb-baris-klik"
                          tabIndex={0}
                          aria-expanded={buka}
                          onClick={alih}
                          onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); alih(); } }}
                          style={{ background: buka ? "var(--sub)" : undefined }}
                        >
                          <td style={{ maxWidth: "280px" }}>
                            <p className="dsb-nama truncate" style={{ margin: 0 }} title={e.pegawai.jabatan}>{e.pegawai.nama}</p>
                            <p className="dsb-kecil truncate" style={{ margin: 0 }} title={e.pegawai.unitKerja}>{e.nip} · {satkerPendek(e.pegawai.unitKerja)}</p>
                          </td>
                          <td className="whitespace-nowrap">
                            TMT {fmtTgl(akhir.tmtKgbBaru)}
                            <p className="dsb-kecil" style={{ margin: 0 }}>{akhir.golonganLama !== akhir.golonganBaru ? `${akhir.golonganLama} → ${akhir.golonganBaru}` : akhir.golonganBaru}</p>
                          </td>
                          <td className="whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: "var(--dtn)", fontWeight: 500 }}>{fmtRp(akhir.gajiPokokBaru)}</span>
                            <p className="dsb-kecil" style={{ margin: 0 }}>lama {fmtRp(akhir.gajiPokokLama)}</p>
                          </td>
                          <td>
                            <StatusKgb status={akhir.status} />
                            {akhir.rapelanDitetapkan && <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-red)" }}>Rapelan ditetapkan</p>}
                          </td>
                          <td className="kanan whitespace-nowrap">
                            <span className="dsb-kecil" style={{ marginRight: 8 }}>{e.kgbs.length} siklus</span>
                            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: "inline-block", color: "var(--dt5)", transform: buka ? "rotate(180deg)" : "none", transition: "transform 0.2s", verticalAlign: "middle" }}><polyline points="6 9 12 15 18 9" /></svg>
                          </td>
                        </tr>
                        {buka && (
                          <tr>
                            <td colSpan={5} style={{ padding: "0 16px 14px", background: "var(--sub)" }}>
                              <table className="dsb-tabel dsb-tabel-sisip">
                                <thead>
                                  <tr>
                                    <th scope="col">TMT KGB</th>
                                    <th scope="col">Golongan dan MKG</th>
                                    <th scope="col">Gaji pokok</th>
                                    <th scope="col">Nomor SK</th>
                                    <th scope="col">Status</th>
                                    <th scope="col" className="kanan"><span className="sr-only">SK</span></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {e.kgbs.map((k) => (
                                    <tr key={k.id}>
                                      <td className="whitespace-nowrap">{fmtTgl(k.tmtKgbBaru)}</td>
                                      <td className="whitespace-nowrap">
                                        {k.golonganLama !== k.golonganBaru ? `${k.golonganLama} → ${k.golonganBaru}` : k.golonganBaru}
                                        <span className="dsb-kecil"> · {k.mkgTahunBaru === null ? "-" : `${k.mkgTahunBaru} thn ${k.mkgBulanBaru ?? 0} bln`}</span>
                                      </td>
                                      <td className="whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {fmtRp(k.gajiPokokLama)} → <span style={{ color: "var(--dtn)", fontWeight: 500 }}>{fmtRp(k.gajiPokokBaru)}</span>
                                      </td>
                                      <td className="whitespace-nowrap">{k.surat?.nomorSurat || k.nomorSK || "-"}</td>
                                      <td>
                                        <StatusKgb status={k.status} />
                                        {k.rapelanDitetapkan && <span className="dsb-kecil" style={{ display: "block", color: "var(--st-red)" }}>Rapelan ditetapkan</span>}
                                        {k.status === "selesai" && k.konfirmasiKeuanganAt && <span className="dsb-kecil" style={{ display: "block" }}>{fmtTgl(k.konfirmasiKeuanganAt)}</span>}
                                      </td>
                                      <td className="kanan">
                                        {k.surat?.pathFile ? (
                                          <a href={`/api/blob/download?url=${encodeURIComponent(k.surat.pathFile)}`} target="_blank" rel="noopener noreferrer" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">SK</a>
                                        ) : (
                                          <span className="dsb-kecil">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
