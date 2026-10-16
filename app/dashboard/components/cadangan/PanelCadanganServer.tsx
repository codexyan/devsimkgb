"use client";

import { useEffect, useState } from "react";
import { formatTanggalId } from "@/lib/waktu";

/* Cadangan otomatis seluruh basis data di server (ADR-084), khusus Super Admin. Berbeda dengan cadangan bulanan di
   atasnya (CSV per akun), cadangan ini dibuat server sendiri dua kali sehari dan dapat dikembalikan ke D1. */

interface CadanganTersimpan {
  kunci: string;
  dibuat: string;
  ukuran: number;
  total: number | null;
}

interface Keadaan {
  cadangan: CadanganTersimpan[];
  jejak: { aktif: boolean; jumlah24Jam: number | null };
}

const TAMPIL = 10;

function ukuranTerbaca(byte: number): string {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`;
  return `${(byte / 1024 / 1024).toFixed(1)} MB`;
}

const waktu = (iso: string) =>
  `${formatTanggalId(iso, { day: "numeric", month: "short", year: "numeric" })}, ${formatTanggalId(iso, {
    hour: "2-digit",
    minute: "2-digit",
  })} WITA`;

export default function PanelCadanganServer() {
  const [data, setData] = useState<Keadaan | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);
  const [membuat, setMembuat] = useState(false);

  async function muat() {
    try {
      const res = await fetch("/api/cadangan/otomatis");
      const d = (await res.json().catch(() => ({}))) as Keadaan & { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Daftar cadangan otomatis gagal dimuat");
      setData(d);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Daftar cadangan otomatis gagal dimuat");
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, []);

  async function buatSekarang() {
    setMembuat(true);
    setGalat(null);
    setKabar(null);
    try {
      const res = await fetch("/api/cadangan/otomatis", { method: "POST" });
      const d = (await res.json().catch(() => ({}))) as { error?: string; cadangan?: { total: number } };
      if (!res.ok) throw new Error(d.error ?? "Cadangan gagal dibuat");
      setKabar(`Cadangan baru tersimpan di server: ${d.cadangan?.total.toLocaleString("id-ID") ?? "-"} baris.`);
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Cadangan gagal dibuat");
    } finally {
      setMembuat(false);
    }
  }

  const terbaru = data?.cadangan[0] ?? null;

  return (
    <section className="dsb-panel" aria-labelledby="judul-cadangan-server">
      <div className="dsb-panel-kepala">
        <h2 id="judul-cadangan-server" className="dsb-panel-judul">
          Cadangan otomatis basis data
        </h2>
      </div>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <p className="dsb-kecil" style={{ margin: 0 }}>
          Server mencadangkan seluruh basis data setiap hari pukul 08.00 dan 20.00 WITA. Cadangan disimpan 30 hari, lalu
          satu cadangan per bulan selama 12 bulan. Berkas PDF yang dihapus pengguna disimpan 90 hari sebelum benar-benar
          dibuang. Untuk mengembalikan data dari cadangan, pakai <code>scripts/pulihkan-cadangan.ts</code> (lihat ADR-084).
        </p>
        {galat && (
          <div role="alert" className="dsb-pesan" data-nada="merah">
            <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
            <p>{galat}</p>
          </div>
        )}
        {kabar && (
          <div role="status" className="dsb-pesan" data-nada="hijau">
            <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
            <p>{kabar}</p>
          </div>
        )}
        {data && (
          <p className="dsb-kecil" style={{ margin: 0 }}>
            <span className="dsb-titik" data-nada={data.jejak.aktif ? "hijau" : "kuning"} aria-hidden="true" />{" "}
            {data.jejak.aktif ? (
              <>
                <b>Jejak perubahan aktif.</b> Isi lama setiap data yang diubah atau dihapus disimpan 90 hari
                {data.jejak.jumlah24Jam !== null && ` (${data.jejak.jumlah24Jam.toLocaleString("id-ID")} catatan dalam 24 jam terakhir)`}.
              </>
            ) : (
              <>
                <b>Jejak perubahan belum aktif.</b> Terapkan migrasi D1 <code>0002_jejak_data.sql</code> dengan{" "}
                <code>wrangler d1 migrations apply</code>.
              </>
            )}
          </p>
        )}
        {!data ? (
          !galat && <p className="dsb-kosong">Memuat…</p>
        ) : data.cadangan.length === 0 ? (
          <p className="dsb-kosong">Belum ada cadangan otomatis. Cadangan pertama dibuat pada jadwal berikutnya, atau tekan Cadangkan sekarang.</p>
        ) : (
          <div className="dsb-gulir-tabel tbl-scroll">
            <table className="dsb-tabel" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th scope="col">Waktu cadangan</th>
                  <th scope="col">Jumlah baris</th>
                  <th scope="col">Ukuran</th>
                  <th scope="col" className="kanan">
                    Berkas
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.cadangan.slice(0, TAMPIL).map((c) => (
                  <tr key={c.kunci}>
                    <td>{waktu(c.dibuat)}</td>
                    <td>{c.total === null ? "–" : c.total.toLocaleString("id-ID")}</td>
                    <td>{ukuranTerbaca(c.ukuran)}</td>
                    <td className="kanan">
                      <a className="dsb-tautan" href={`/api/cadangan/otomatis?unduh=${encodeURIComponent(c.kunci)}`} download>
                        Unduh
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="dsb-kaki">
        <span>
          {terbaru
            ? `Terakhir ${waktu(terbaru.dibuat)}, ${data?.cadangan.length ?? 0} cadangan tersimpan.`
            : "Cadangkan sekarang sebelum memproses banyak data sekaligus."}
        </span>
        <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => void buatSekarang()} disabled={membuat}>
          {membuat ? "Mencadangkan…" : "Cadangkan sekarang"}
        </button>
      </div>
    </section>
  );
}
