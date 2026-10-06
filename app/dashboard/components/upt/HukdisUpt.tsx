"use client";

import { useCallback, useEffect, useState } from "react";
import { formatTanggalId } from "@/lib/waktu";
import { STATUS_LAPORAN_HUKDIS, type StatusLaporanHukdis } from "@/lib/laporanHukdis";
import { KerangkaModal, ModalPratinjauBerkas, PesanGalat } from "@/app/dashboard/components/kgb";
import ModalLaporHukdis, { type JenisHukdisUpt, type LaporanHukdisAwal, type PegawaiHukdisUpt } from "./ModalLaporHukdis";

/* Modul Hukuman Disiplin Admin UPT (ADR-016).
   UPT melaporkan SK hukuman disiplin pegawainya; SDM Hukdis Kanwil yang mencatat dan, bila hukumannya
   menunda KGB, menggeser jadwalnya. Hukdis yang sudah tercatat tampil terbatas sesuai ADR-004: masih
   berlaku atau tidak, menunda KGB atau tidak, dan sampai kapan. Jenis dan nomor SK-nya hanya di Kanwil. */

interface LaporanApi extends LaporanHukdisAwal {
  nama: string;
  nip: string;
  jenisLabel: string;
  status: string;
  dilaporkanAt: string | null;
  dilaporkanOleh: string | null;
  ditinjauAt: string | null;
}

interface TercatatApi {
  id: string;
  pegawaiId: string;
  nama: string;
  nip: string;
  aktif: boolean;
  menundaKgb: boolean;
  berlakuSampai: string | null;
}

interface DataApi {
  aktif: boolean;
  laporan: LaporanApi[];
  tercatat: TercatatApi[];
  pegawai: PegawaiHukdisUpt[];
  jenis: JenisHukdisUpt[];
}

const tgl = (t: string | null) => (t ? formatTanggalId(t, { day: "numeric", month: "short", year: "numeric" }) : "-");

export default function HukdisUpt() {
  const [data, setData] = useState<DataApi | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  // Tautan dari Pegawai Satker dapat membawa ?pegawai=<id> agar formulirnya langsung terbuka setelah data termuat.
  const [formulir, setFormulir] = useState<{ awal: LaporanApi | null; pegawaiAwal: string | null } | null>(() => {
    const pegawaiAwal = new URLSearchParams(window.location.search).get("pegawai");
    return pegawaiAwal ? { awal: null, pegawaiAwal } : null;
  });
  const [batal, setBatal] = useState<LaporanApi | null>(null);
  const [sibukBatal, setSibukBatal] = useState(false);
  const [galatBatal, setGalatBatal] = useState<string | null>(null);
  const [pratinjau, setPratinjau] = useState<LaporanApi | null>(null);
  const [hanyaBerlaku, setHanyaBerlaku] = useState(true);

  const muat = useCallback(async () => {
    try {
      const res = await fetch("/api/upt/hukdis");
      const d = (await res.json()) as DataApi | { error?: string };
      if (!res.ok || !("laporan" in d)) throw new Error(("error" in d && d.error) || "Data hukuman disiplin gagal dimuat");
      setData(d);
      setGalat(null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data hukuman disiplin gagal dimuat");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  function selesai(teks: string) {
    setFormulir(null);
    setPesan(teks);
    void muat();
  }

  async function batalkan() {
    if (!batal) return;
    setSibukBatal(true);
    setGalatBatal(null);
    try {
      const res = await fetch(`/api/upt/hukdis/${batal.id}`, { method: "DELETE" });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalatBatal(d.error ?? "Laporan gagal dibatalkan");
        return;
      }
      setBatal(null);
      setPesan(`Laporan hukuman disiplin ${batal.nama} dibatalkan.`);
      void muat();
    } catch {
      setGalatBatal("Laporan gagal dibatalkan");
    } finally {
      setSibukBatal(false);
    }
  }

  if (galat && !data)
    return (
      <div className="dsb-halaman">
        <div className="dsb-kartu dsb-kosong" role="alert" style={{ padding: "56px 20px" }}>
          <p className="dsb-judul" style={{ marginTop: 0 }}>Modul hukuman disiplin tidak dapat dibuka</p>
          <p>{galat}</p>
        </div>
      </div>
    );

  const laporan = data?.laporan ?? [];
  const tercatat = data?.tercatat ?? [];
  const hitung = (s: StatusLaporanHukdis) => laporan.filter((l) => l.status === s).length;
  const berlaku = tercatat.filter((h) => h.aktif);
  const tercatatTampil = hanyaBerlaku ? berlaku : tercatat;
  const bisaLapor = !!data?.aktif;

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Lapor Hukdis</p>
          <h1 className="dsb-halaman-judul">Laporan hukuman disiplin</h1>
          <p className="dsb-sub">
            Laporkan SK hukuman disiplin pegawai satker ini ke SDM Hukdis Kanwil. Wewenang Anda berhenti pada
            melaporkan: yang menetapkan hukuman, mencatatnya, dan menggeser jadwal KGB karenanya adalah Kanwil.
          </p>
        </div>
        <button
          type="button"
          className="dsb-tombol"
          disabled={!bisaLapor}
          onClick={() => setFormulir({ awal: null, pegawaiAwal: null })}
        >
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Laporkan hukuman disiplin
        </button>
      </header>

      {data && !data.aktif && (
        <div role="status" className="dsb-pesan" data-nada="kuning">
          <p>
            Modul ini belum aktif karena tabel laporannya belum dibuat di basis data. Hubungi pengelola SIM-KGB; hukdis
            yang sudah tercatat di Kanwil tetap tampil di bawah.
          </p>
        </div>
      )}
      {pesan && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <p>{pesan}</p>
        </div>
      )}

      {/* Batas wewenang dinyatakan menetap di layar, bukan hanya di jendela lapor: operator yang membuka
          halaman ini untuk memeriksa status tidak selalu melewati jendela itu (ADR-016, ADR-039). */}
      <div className="dsb-pesan" data-nada="biru">
        <span className="dsb-pesan-ikon" aria-hidden="true">i</span>
        <p>
          <strong>Satker melaporkan, Kanwil yang menetapkan.</strong> Hukuman disiplin dijatuhkan lewat SK pejabat
          berwenang, dan yang mencatatnya di SIM-KGB serta menggeser jadwal KGB karenanya hanya SDM Hukdis Kanwil.
          Laporan di halaman ini tidak mengubah data pegawai maupun jadwal KGB sebelum Kanwil mencatatnya.
        </p>
      </div>

      <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Menunggu tinjauan</span>
          <span className="dsb-angka-nilai">{data ? hitung("menunggu") : "–"}</span>
          <span className="dsb-angka-meta"><span className="dsb-titik" data-nada="kuning" aria-hidden="true" />Di meja SDM Hukdis</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Dikembalikan</span>
          <span className="dsb-angka-nilai">{data ? hitung("dikembalikan") : "–"}</span>
          <span className="dsb-angka-meta"><span className="dsb-titik" data-nada="ungu" aria-hidden="true" />Perlu diperbaiki lalu dikirim ulang</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Hukdis berlaku</span>
          <span className="dsb-angka-nilai">{data ? berlaku.length : "–"}</span>
          <span className="dsb-angka-meta">Tercatat di Kanwil</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Menunda KGB</span>
          <span className="dsb-angka-nilai" style={{ color: berlaku.some((h) => h.menundaKgb) ? "var(--st-red)" : undefined }}>
            {data ? berlaku.filter((h) => h.menundaKgb).length : "–"}
          </span>
          <span className="dsb-angka-meta">KGB pegawainya digeser Kanwil</span>
        </div>
      </div>

      <section className="dsb-panel dsb-muncul hkd-panel" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="judul-laporan-hukdis">
        <div className="dsb-panel-kepala">
          <h2 id="judul-laporan-hukdis" className="dsb-panel-judul">
            Laporan yang dikirim <small>{laporan.length}</small>
          </h2>
        </div>
        {!data ? (
          <div className="flex flex-col gap-2" style={{ padding: 16 }} role="status" aria-label="Memuat laporan">
            {[1, 2, 3].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 44, borderRadius: 8 }} />)}
          </div>
        ) : laporan.length === 0 ? (
          <p className="dsb-kosong" style={{ padding: "36px 16px" }}>Belum ada laporan hukuman disiplin dari satker ini.</p>
        ) : (
          <div className="dsb-gulir-tabel">
            <table className="dsb-tabel" style={{ minWidth: "860px" }}>
              <thead>
                <tr>
                  <th scope="col">Dilaporkan</th>
                  <th scope="col">Pegawai</th>
                  <th scope="col">Jenis dan SK</th>
                  <th scope="col">Masa hukuman</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {laporan.map((l) => {
                  const cfg = STATUS_LAPORAN_HUKDIS[l.status as StatusLaporanHukdis] ?? { label: l.status, nada: "kuning" as const };
                  const dipegang = l.status === "menunggu" || l.status === "dikembalikan";
                  return (
                    <tr key={l.id} data-nada={l.status === "dikembalikan" ? "kuning" : undefined}>
                      <td className="whitespace-nowrap">{tgl(l.dilaporkanAt)}</td>
                      <td style={{ maxWidth: 240 }}>
                        <p className="dsb-nama truncate" style={{ margin: 0 }}>{l.nama}</p>
                        <p className="dsb-kecil" style={{ margin: 0 }}>{l.nip}</p>
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <p className="truncate" style={{ margin: 0, color: "var(--dtn)" }} title={l.jenisLabel}>{l.jenisLabel}</p>
                        <p className="dsb-kecil" style={{ margin: 0 }}>SK {l.nomorSK ?? "-"} · {tgl(l.tanggalSK)}</p>
                      </td>
                      <td className="whitespace-nowrap">{tgl(l.tmtMulai)} – {l.tmtBerakhir ? tgl(l.tmtBerakhir) : "tanpa masa"}</td>
                      <td style={{ maxWidth: 280 }}>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span className="dsb-titik" data-nada={cfg.nada} aria-hidden="true" />
                          {cfg.label}
                        </span>
                        {l.ditinjauAt && <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>ditinjau {tgl(l.ditinjauAt)}</p>}
                        {l.status === "dikembalikan" && l.catatanKanwil && (
                          <p className="dsb-kecil" style={{ margin: "2px 0 0", color: "var(--st-violet)" }}>Catatan Kanwil: {l.catatanKanwil}</p>
                        )}
                      </td>
                      <td className="kanan">
                        <span className="hkd-aksi">
                          {l.berkas && (
                            <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setPratinjau(l)}>
                              SK
                            </button>
                          )}
                          {l.status === "dikembalikan" && (
                            <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={() => setFormulir({ awal: l, pegawaiAwal: null })}>
                              Perbaiki dan kirim ulang
                            </button>
                          )}
                          {dipegang && (
                            <button
                              type="button"
                              className="dsb-tombol dsb-tombol-kecil"
                              data-jenis="garis"
                              data-nada="merah"
                              onClick={() => { setGalatBatal(null); setBatal(l); }}
                            >
                              Batalkan
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="dsb-panel dsb-muncul hkd-panel" style={{ "--i": 3 } as React.CSSProperties} aria-labelledby="judul-tercatat-hukdis">
        <div className="dsb-panel-kepala">
          <h2 id="judul-tercatat-hukdis" className="dsb-panel-judul">
            Tercatat di Kanwil <small>{tercatatTampil.length}</small>
          </h2>
          <div className="dsb-segmen" role="group" aria-label="Saring masa berlaku">
            <button type="button" aria-pressed={hanyaBerlaku} onClick={() => setHanyaBerlaku(true)}>Masih berlaku</button>
            <button type="button" aria-pressed={!hanyaBerlaku} onClick={() => setHanyaBerlaku(false)}>Semua</button>
          </div>
        </div>
        {!data ? (
          <div className="dsb-kerangka" style={{ height: 80, margin: 16 }} role="status" aria-label="Memuat hukdis tercatat" />
        ) : tercatatTampil.length === 0 ? (
          <p className="dsb-kosong" style={{ padding: "32px 16px" }}>
            {tercatat.length === 0 ? "Belum ada hukuman disiplin tercatat untuk pegawai satker ini." : "Tidak ada hukuman disiplin yang masih berlaku."}
          </p>
        ) : (
          <div className="dsb-gulir-tabel">
            <table className="dsb-tabel" style={{ minWidth: "620px" }}>
              <thead>
                <tr>
                  <th scope="col">Pegawai</th>
                  <th scope="col">Status</th>
                  <th scope="col">Dampak pada KGB</th>
                  <th scope="col">Berlaku sampai</th>
                </tr>
              </thead>
              <tbody>
                {tercatatTampil.map((h) => (
                  <tr key={h.id}>
                    <td style={{ maxWidth: 260 }}>
                      <p className="dsb-nama truncate" style={{ margin: 0 }}>{h.nama}</p>
                      <p className="dsb-kecil" style={{ margin: 0 }}>{h.nip}</p>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="dsb-titik" data-nada={h.aktif ? "merah" : undefined} aria-hidden="true" />
                        {h.aktif ? "Masih berlaku" : "Sudah berakhir"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      {h.menundaKgb ? <span style={{ color: h.aktif ? "var(--st-red)" : "var(--dt3)" }}>Menunda KGB</span> : <span className="dsb-kecil">Tidak menunda</span>}
                    </td>
                    <td className="whitespace-nowrap">{h.berlakuSampai ? tgl(h.berlakuSampai) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="dsb-kaki">
          <span>Jenis dan nomor SK hukuman yang sudah tercatat hanya terlihat di Kanwil</span>
          <span>Tanggal berakhir ikut dihitung sebagai masa hukuman</span>
        </div>
      </section>

      {formulir && data && (
        <ModalLaporHukdis
          pegawai={data.pegawai}
          jenis={data.jenis}
          awal={formulir.awal}
          pegawaiAwal={formulir.pegawaiAwal}
          onTutup={() => setFormulir(null)}
          onSelesai={selesai}
        />
      )}

      {batal && (
        <KerangkaModal
          judul="Batalkan laporan hukuman disiplin?"
          subjudul={`${batal.nama} · ${batal.nip}`}
          ukuran="sm"
          nada="merah"
          sibuk={sibukBatal}
          onTutup={() => setBatal(null)}
          onKirim={() => void batalkan()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setBatal(null)} disabled={sibukBatal}>
                Kembali
              </button>
              <button type="submit" className="kgbm-tombol kgbm-bahaya" disabled={sibukBatal}>
                {sibukBatal ? "Membatalkan…" : "Ya, batalkan"}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galatBatal} />
          <p style={{ margin: 0, fontSize: 13, color: "var(--dt3)", lineHeight: 1.5 }}>
            Laporan {batal.jenisLabel.toLowerCase()} beserta pindaian SK-nya dihapus dan ditarik dari antrian SDM Hukdis.
          </p>
        </KerangkaModal>
      )}

      {pratinjau && (
        <ModalPratinjauBerkas
          judul="SK hukuman disiplin"
          subjudul={pratinjau.berkas?.nama ?? `${pratinjau.nama} · ${pratinjau.nip}`}
          url={`/api/hukdis/laporan/${pratinjau.id}/berkas`}
          onTutup={() => setPratinjau(null)}
        />
      )}
    </div>
  );
}
