"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDashUser } from "@/app/dashboard/components/RoleContext";
import { PanelNavy, PanelTindakan, Stat, StripStat, namaSapaan, sapaanWita, tanggalPanjangWita, type Tindakan } from "@/app/dashboard/components/PanelNavy";
import { formatTanggalId, hariIniWita, tanggalKalender } from "@/lib/waktu";
import { SATKER } from "@/lib/satker";
import { KODE_SATKER_LAIN, kodeSatkerPegawai } from "@/lib/rekapSatker";
import { namaTampilSatker } from "@/app/dashboard/satker/labelSatker";

/* Dashboard SDM Hukdis. Sumber sama dengan modul Hukuman Disiplin (/api/hukdis), jadi status aktif dihitung dari
   tanggal berakhir (kalender WITA) dan tidak ada status yang "lupa diperbarui". Yang dipantau: hukdis yang segera
   berakhir dan hukdis yang menunda KGB. */

interface HukdisAktif {
  id: string;
  pegawai: { id: string; nama: string; nip: string; jabatan: string; golonganRuang: string; unitKerja: string | null } | null;
  jenisLabel: string;
  kategori: string;
  tmtBerakhir: string | null;
  berdampakKGB: boolean;
  durasiTunda: number | null;
  aktif: boolean;
}
interface Ringkasan { total: number; aktif: number; ringan: number; sedang: number; berat: number; berdampakKGB: number; berakhir30: number; }

const NADA_KATEGORI: Record<string, "hijau" | "kuning" | "merah"> = { ringan: "hijau", sedang: "kuning", berat: "merah" };
const LABEL_KATEGORI: Record<string, string> = { ringan: "Ringan", sedang: "Sedang", berat: "Berat" };

function namaSatker(kode: string): string {
  if (kode === KODE_SATKER_LAIN) return "Unit belum sesuai daftar";
  const s = SATKER.find((x) => x.kode === kode);
  return s ? namaTampilSatker(s) : kode;
}

export default function DashboardHukdis() {
  const dashUser = useDashUser();
  const [data, setData] = useState<HukdisAktif[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [hanyaTunda, setHanyaTunda] = useState(false);

  function fetchData() {
    setLoading(true);
    fetch("/api/hukdis")
      .then((r) => r.json() as Promise<{ data?: HukdisAktif[]; summary?: Ringkasan }>)
      .then((d) => {
        if (Array.isArray(d.data)) setData(d.data);
        if (d.summary) setRingkasan(d.summary);
        setLastRefresh(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(fetchData, 0);
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") fetchData();
    }, 60_000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);

  const hariIni = hariIniWita();
  const sisaHari = (h: HukdisAktif) => {
    const akhir = tanggalKalender(h.tmtBerakhir);
    return akhir ? Math.round((akhir.getTime() - hariIni.getTime()) / 86_400_000) : null;
  };

  // Hukdis yang masih berjalan, dari yang paling dekat berakhir.
  const aktif = useMemo(
    () => data.filter((h) => h.aktif).sort((a, b) => (sisaHari(a) ?? Infinity) - (sisaHari(b) ?? Infinity)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  const tampil = hanyaTunda ? aktif.filter((h) => h.berdampakKGB) : aktif;
  const segera = aktif.filter((h) => { const s = sisaHari(h); return s !== null && s <= 30; });
  const segeraTunda = segera.filter((h) => h.berdampakKGB);
  const menunda = aktif.filter((h) => h.berdampakKGB);

  const perSatker = useMemo(() => {
    const peta = new Map<string, { jumlah: number; tunda: number }>();
    for (const h of aktif) {
      const kode = kodeSatkerPegawai(h.pegawai?.unitKerja);
      const r = peta.get(kode) ?? { jumlah: 0, tunda: 0 };
      r.jumlah++;
      if (h.berdampakKGB) r.tunda++;
      peta.set(kode, r);
    }
    return [...peta.entries()].sort((a, b) => b[1].jumlah - a[1].jumlah);
  }, [aktif]);

  const nama = namaSapaan(dashUser.nama, "SDM Hukdis");
  const siap = !loading || data.length > 0;

  const keDaftar = (tunda: boolean) => () => {
    setHanyaTunda(tunda);
    document.getElementById("daftar-hukdis")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const tindakan: Tindakan[] = [];
  if (segeraTunda.length > 0)
    tindakan.push({
      id: "segera-tunda",
      nada: "kuning",
      isi: <><strong>{segeraTunda.length} hukdis yang menunda KGB</strong> berakhir dalam 30 hari. Pastikan TMT KGB pegawainya sudah digeser dengan benar.</>,
      aksi: { label: "Lihat di modul Hukdis", href: "/dashboard/hukdis?saringan=segera" },
    });
  if (segera.length - segeraTunda.length > 0)
    tindakan.push({
      id: "segera",
      nada: "kuning",
      isi: <><strong>{segera.length - segeraTunda.length} hukdis</strong> lain berakhir dalam 30 hari.</>,
      aksi: { label: "Lihat daftar", onClick: keDaftar(false) },
    });
  if (menunda.length > 0)
    tindakan.push({
      id: "tunda",
      nada: "merah",
      isi: <><strong>{menunda.length} pegawai</strong> KGB-nya tertunda karena hukdis aktif.</>,
      aksi: { label: "Lihat pegawai", onClick: keDaftar(true) },
    });

  return (
    <div className="dsb-halaman" data-muat-layar="">

      <PanelNavy
        label="Dashboard SDM Hukdis"
        judul={`${sapaanWita()}${nama ? `, ${nama}` : ""}`}
        sub={<>{tanggalPanjangWita()}{ringkasan && <> · {ringkasan.total} catatan hukdis tercatat</>}</>}
        diperbarui={lastRefresh}
        onMuatUlang={fetchData}
        memuat={loading}
      >
        <StripStat kolom={3}>
          <Stat
            href="/dashboard/hukdis"
            label="Hukdis aktif"
            angka={ringkasan?.aktif ?? 0}
            meta={ringkasan && ringkasan.aktif > 0
              ? `Ringan ${ringkasan.ringan} · Sedang ${ringkasan.sedang} · Berat ${ringkasan.berat}`
              : "Tidak ada hukdis yang berjalan"}
            metaNada={ringkasan && ringkasan.aktif > 0 ? undefined : "hijau"}
          />
          <Stat
            onClick={menunda.length > 0 ? keDaftar(true) : undefined}
            label="Menunda KGB"
            angka={ringkasan?.berdampakKGB ?? 0}
            meta={menunda.length > 0 ? "TMT KGB pegawainya digeser" : "Tidak ada KGB yang tertunda"}
            metaNada={menunda.length > 0 ? "merah" : "hijau"}
            sorot={menunda.length > 0}
          />
          <Stat
            onClick={segera.length > 0 ? keDaftar(false) : undefined}
            label="Berakhir ≤ 30 hari"
            angka={ringkasan?.berakhir30 ?? 0}
            meta={segera.length > 0 ? "Periksa KGB setelah berakhir" : "Tidak ada dalam 30 hari"}
            metaNada={segera.length > 0 ? "kuning" : undefined}
          />
        </StripStat>
      </PanelNavy>

      <div className="dsb-dasbor-isi">
        {/* Hukdis yang sedang berjalan */}
        <section id="daftar-hukdis" className="dsb-panel dsb-antrian dsb-tujuan overflow-hidden dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="judul-hukdis-aktif">
          <div className="dsb-panel-kepala">
            <h2 id="judul-hukdis-aktif" className="dsb-panel-judul">Hukdis berjalan <small>{tampil.length}</small></h2>
            <div className="dsb-segmen" role="group" aria-label="Saring hukdis">
              <button type="button" aria-pressed={!hanyaTunda} onClick={() => setHanyaTunda(false)}>
                Semua <span style={{ color: "var(--dt5)" }}>{aktif.length}</span>
              </button>
              <button type="button" data-nada="merah" aria-pressed={hanyaTunda} onClick={() => setHanyaTunda(true)}>
                Menunda KGB <span style={{ color: "var(--dt5)" }}>{menunda.length}</span>
              </button>
            </div>
          </div>

          {!siap ? (
            <div className="flex flex-col gap-2" style={{ padding: "16px" }}>
              {[1, 2, 3].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 48, borderRadius: 8 }} />)}
            </div>
          ) : tampil.length === 0 ? (
            <div className="dsb-kosong" style={{ padding: "44px 16px" }}>
              <span className="dsb-pesan-ikon" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", width: 36, height: 36 }} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <p className="dsb-nama" style={{ margin: 0 }}>{hanyaTunda ? "Tidak ada hukdis yang menunda KGB" : "Tidak ada hukdis yang sedang berjalan"}</p>
            </div>
          ) : (
            <div className="dsb-antrian-gulir">
              <table className="dsb-tabel" style={{ minWidth: "720px" }}>
                <thead>
                  <tr>
                    <th scope="col">Pegawai</th>
                    <th scope="col">Jenis hukdis</th>
                    <th scope="col">Berakhir</th>
                    <th scope="col">Dampak KGB</th>
                    <th scope="col" className="kanan"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((h) => {
                    const sisa = sisaHari(h);
                    const dekat = sisa !== null && sisa <= 30;
                    return (
                      <tr key={h.id}>
                        <td>
                          <p className="dsb-nama" style={{ margin: 0 }} title={h.pegawai?.jabatan}>{h.pegawai?.nama ?? "Pegawai tidak ditemukan"}</p>
                          <p className="dsb-kecil" style={{ margin: 0 }} title={h.pegawai?.unitKerja ?? undefined}>
                            {h.pegawai ? <>{h.pegawai.golonganRuang} · {namaSatker(kodeSatkerPegawai(h.pegawai.unitKerja))}</> : "-"}
                          </p>
                        </td>
                        <td style={{ maxWidth: "240px" }}>
                          <p className="truncate" style={{ margin: 0, color: "var(--dtn)" }} title={h.jenisLabel}>{h.jenisLabel}</p>
                          {LABEL_KATEGORI[h.kategori] && (
                            <p className="dsb-kecil flex items-center gap-1.5" style={{ margin: 0 }}>
                              <span className="dsb-titik" data-nada={NADA_KATEGORI[h.kategori]} aria-hidden="true" />{LABEL_KATEGORI[h.kategori]}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {h.tmtBerakhir ? formatTanggalId(h.tmtBerakhir, { day: "numeric", month: "short", year: "numeric" }) : "-"}
                          {sisa !== null && (
                            <p className="dsb-kecil" style={{ margin: 0, color: dekat ? "var(--st-amber)" : undefined }}>
                              {sisa === 0 ? "berakhir hari ini" : `${sisa} hari lagi`}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {h.berdampakKGB
                            ? <span style={{ color: "var(--st-red)" }}>Tunda {h.durasiTunda ?? "-"} bulan</span>
                            : <span className="dsb-kecil">Tidak menunda</span>}
                        </td>
                        <td className="kanan">
                          {h.pegawai && (
                            <Link href={`/dashboard/pegawai/${h.pegawai.id}/riwayat`} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">
                              Riwayat
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="dsb-kaki">
            <span>Urut dari yang paling dekat berakhir.</span>
            <Link href="/dashboard/hukdis" className="dsb-tautan">Buka modul Hukuman Disiplin →</Link>
          </div>
        </section>

        <aside className="dsb-samping dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-label="Ringkasan pendamping">
          <PanelTindakan daftar={siap ? tindakan : []} kosong="Tidak ada hukdis yang perlu ditindaklanjuti." />

          <section className="dsb-panel dsb-penuh" aria-labelledby="judul-hukdis-satker">
            <div className="dsb-panel-kepala">
              <h2 id="judul-hukdis-satker" className="dsb-panel-judul">Per satker <small>{perSatker.length}</small></h2>
            </div>
            {perSatker.length === 0 ? (
              <p className="dsb-kosong" style={{ padding: "18px 16px" }}>{siap ? "Tidak ada hukdis aktif di satker mana pun." : "Memuat…"}</p>
            ) : (
              <ul className="dsb-satker-daftar dsb-gulir">
                {perSatker.map(([kode, r]) => (
                  <li key={kode}>
                    <Link href={`/dashboard/hukdis?satker=${encodeURIComponent(kode)}`} title={`Hukdis di ${namaSatker(kode)}`}>
                      <span className="dsb-nama">{namaSatker(kode)}</span>
                      <span className="dsb-satker-angka">{r.jumlah} aktif</span>
                      {r.tunda > 0 && (
                        <span className="dsb-satker-tanda"><span data-nada="merah">{r.tunda} menunda KGB</span></span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
