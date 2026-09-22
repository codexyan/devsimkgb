"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDashUser } from "@/app/dashboard/components/RoleContext";
import { KepalaKartu, KisiKpi, Kpi, PanelNavy, namaDepan, sapaanWita, tanggalPanjangWita } from "@/app/dashboard/components/PanelNavy";

interface Pegawai {
  id: string;
  nip: string;
  nama: string;
  jabatan: string;
  golonganRuang: string;
  statusHukdis: boolean;
  tanggalHukdisBerakhir: string | null;
}

function daysDiff(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / 86400000);
}

export default function DashboardHukdis() {
  const dashUser = useDashUser();
  const [list, setList] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  function fetchData() {
    setLoading(true);
    fetch("/api/pegawai?search=&status=")
      .then((r) => r.json() as any)
      .then((d) => {
        setList(Array.isArray(d) ? d : []);
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


  const aktif        = list.filter((p) => p.statusHukdis);
  const tanpaHukdis  = list.filter((p) => !p.statusHukdis);
  const hampirBerakhir = aktif.filter(
    (p) => p.tanggalHukdisBerakhir && daysDiff(p.tanggalHukdisBerakhir) <= 30 && daysDiff(p.tanggalHukdisBerakhir) >= 0
  );
  const terlambatBerakhir = aktif.filter(
    (p) => p.tanggalHukdisBerakhir && daysDiff(p.tanggalHukdisBerakhir) < 0
  );

  const sortedAktif = [...aktif].sort((a, b) => {
    if (!a.tanggalHukdisBerakhir) return 1;
    if (!b.tanggalHukdisBerakhir) return -1;
    return new Date(a.tanggalHukdisBerakhir).getTime() - new Date(b.tanggalHukdisBerakhir).getTime();
  });

  const nama = namaDepan(dashUser.nama);
  const siap = !loading || list.length > 0;
  const nadaSisa = (sisa: number | null): { bg: string; color: string } =>
    sisa === null ? { bg: "var(--sub)", color: "var(--dt4)" }
    : sisa <= 7 ? { bg: "var(--tint-red-bg)", color: "var(--st-red)" }
    : sisa <= 30 ? { bg: "var(--tint-amber-bg)", color: "var(--st-amber)" }
    : { bg: "var(--tint-green-bg)", color: "var(--st-green)" };

  return (
    <div className="dsb-halaman">

      <PanelNavy
        label="Dashboard · SDM Hukdis"
        judul={`${sapaanWita()}${nama ? `, ${nama}` : ""}`}
        sub={<>{tanggalPanjangWita()} · Monitoring hukuman disiplin pegawai</>}
        chips={!siap ? [] : [
          ...(terlambatBerakhir.length > 0 ? [{ teks: `${terlambatBerakhir.length} masa hukdis sudah lewat`, nada: "merah" as const }] : []),
          ...(hampirBerakhir.length > 0 ? [{ teks: `${hampirBerakhir.length} berakhir dalam 30 hari`, nada: "kuning" as const }] : []),
          ...(aktif.length === 0 ? [{ teks: "Tidak ada hukdis aktif", nada: "hijau" as const }] : []),
        ]}
        diperbarui={lastRefresh}
        onMuatUlang={fetchData}
        memuat={loading}
      >
        <KisiKpi>
          <Kpi href="/dashboard/pegawai" label="Total pegawai" angka={list.length} meta="Data pegawai aktif" />
          <Kpi
            label="Hukdis aktif"
            angka={aktif.length}
            meta={terlambatBerakhir.length > 0 ? `${terlambatBerakhir.length} sudah lewat` : "Sesuai masa berlaku"}
            metaNada={terlambatBerakhir.length > 0 ? "merah" : aktif.length > 0 ? "kuning" : "hijau"}
          />
          <Kpi label="Berakhir < 30 hari" angka={hampirBerakhir.length} meta="Siapkan pembaruan status" metaNada={hampirBerakhir.length > 0 ? "kuning" : undefined} />
          <Kpi label="Tanpa hukdis" angka={tanpaHukdis.length} meta="KGB berjalan normal" metaNada="hijau" />
        </KisiKpi>
      </PanelNavy>

      {/* Pemberitahuan */}
      {!loading && (terlambatBerakhir.length > 0 || hampirBerakhir.length > 0) && (
        <div className="dsb-pesan-daftar dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
          {terlambatBerakhir.length > 0 && (
            <div className="dsb-pesan" data-nada="merah">
              <span className="dsb-pesan-ikon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </span>
              <p><strong>{terlambatBerakhir.length} pegawai</strong> masa hukdisnya sudah lewat namun belum diperbarui. Segera tinjau dan perbarui status hukdis.</p>
            </div>
          )}
          {hampirBerakhir.length > 0 && (
            <div className="dsb-pesan" data-nada="kuning">
              <span className="dsb-pesan-ikon" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              <p><strong>{hampirBerakhir.length} pegawai</strong> masa hukdisnya berakhir dalam 30 hari ke depan.</p>
            </div>
          )}
        </div>
      )}

      {/* Daftar pegawai ber-hukdis */}
      <section className="dsb-kartu overflow-hidden dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="judul-hukdis-aktif">
        <div className="dsb-kartu-isi">
          <KepalaKartu
            idJudul="judul-hukdis-aktif"
            label="Hukdis aktif"
            judul="Pegawai dengan hukdis aktif"
            sub={`${aktif.length} pegawai, diurutkan menurut tanggal berakhir`}
            aksi={<Link href="/dashboard/pegawai" className="dsb-tombol" data-jenis="garis">Kelola semua pegawai</Link>}
          />
        </div>

        {!siap ? (
          <div className="px-5 pb-5 flex flex-col gap-2">
            {[1, 2, 3].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 56, borderRadius: 14 }} />)}
          </div>
        ) : sortedAktif.length === 0 ? (
          <div className="dsb-kosong" style={{ borderTop: "1px solid var(--ln2)", padding: "44px 16px" }}>
            <span className="dsb-pesan-ikon" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", width: 36, height: 36 }} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <p className="dsb-nama" style={{ margin: 0 }}>Tidak ada pegawai dengan hukdis aktif</p>
            <p style={{ margin: 0 }}>Semua pegawai dalam kondisi normal</p>
          </div>
        ) : (
          <>
            {/* Tabel layar lebar */}
            <div className="hidden md:block overflow-x-auto tbl-scroll" style={{ borderTop: "1px solid var(--ln2)" }}>
              <table className="dsb-tabel">
                <thead>
                  <tr>
                    {["Pegawai", "Jabatan / golongan", "Hukdis berakhir", "Sisa", ""].map((h, i) => (
                      <th key={i} scope="col">{h || <span className="sr-only">Aksi</span>}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedAktif.map((p) => {
                    const sisa = p.tanggalHukdisBerakhir ? daysDiff(p.tanggalHukdisBerakhir) : null;
                    const isLewat = sisa !== null && sisa < 0;
                    const nada = nadaSisa(sisa);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className="dsb-avatar" data-nada="merah" aria-hidden="true">
                              {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                            </span>
                            <div style={{ lineHeight: 1.35 }}>
                              <p className="dsb-nama" style={{ margin: 0 }}>{p.nama}</p>
                              <p className="dsb-kecil" style={{ margin: 0 }}>{p.nip}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p style={{ margin: 0, color: "var(--dtn)" }}>{p.jabatan}</p>
                          <span className="dsb-tag" data-garis="" style={{ marginTop: "4px" }}>{p.golonganRuang}</span>
                        </td>
                        <td className="whitespace-nowrap">
                          {p.tanggalHukdisBerakhir ? (
                            <span style={{ color: isLewat ? "var(--st-red)" : "var(--dtn)", fontWeight: 500 }}>
                              {new Date(p.tanggalHukdisBerakhir).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                            </span>
                          ) : (
                            <span className="dsb-kecil">Tidak ditentukan</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          {sisa !== null ? (
                            <span className="dsb-tag" style={{ background: nada.bg, color: nada.color }}>
                              {isLewat ? `${Math.abs(sisa)} hari lewat` : `${sisa} hari lagi`}
                            </span>
                          ) : (
                            <span className="dsb-kecil">-</span>
                          )}
                        </td>
                        <td className="text-right">
                          <Link href={`/dashboard/pegawai/${p.id}/riwayat`} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">
                            Kelola hukdis
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Kartu layar sempit */}
            <ul className="md:hidden" style={{ borderTop: "1px solid var(--ln2)" }}>
              {sortedAktif.map((p, i) => {
                const sisa = p.tanggalHukdisBerakhir ? daysDiff(p.tanggalHukdisBerakhir) : null;
                const isLewat = sisa !== null && sisa < 0;
                const nada = nadaSisa(sisa);
                return (
                  <li key={p.id} className="px-4 py-3 flex items-center gap-3" style={{ borderTop: i > 0 ? "1px solid var(--ln2)" : undefined }}>
                    <span className="dsb-avatar" data-nada="merah" aria-hidden="true">
                      {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0" style={{ fontSize: "13px" }}>
                      <p className="dsb-nama truncate" style={{ margin: 0 }}>{p.nama}</p>
                      <p className="dsb-kecil" style={{ margin: 0 }}>{p.golonganRuang} · {p.jabatan}</p>
                      {p.tanggalHukdisBerakhir && (
                        <p className="dsb-kecil" style={{ margin: "3px 0 0", color: isLewat ? "var(--st-red)" : undefined }}>
                          Berakhir {new Date(p.tanggalHukdisBerakhir).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          {sisa !== null && (
                            <span style={{ color: nada.color, fontWeight: 600 }}> · {isLewat ? `${Math.abs(sisa)} hari lewat` : `${sisa} hari lagi`}</span>
                          )}
                        </p>
                      )}
                    </div>
                    <Link href={`/dashboard/pegawai/${p.id}/riwayat`} className="dsb-tombol dsb-tombol-kecil shrink-0" data-jenis="garis">
                      Kelola
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
