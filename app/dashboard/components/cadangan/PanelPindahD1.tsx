"use client";

import { useEffect, useState } from "react";

/* Pemindahan basis data Supabase → Cloudflare D1 (ADR-085), khusus Super Admin. Sementara: dihapus setelah Supabase
   dilepas. */

interface Banding {
  tabel: string;
  supabase: number;
  d1: number;
  belumDiD1: number;
  hanyaDiD1: number;
}

/** Hasil Selaraskan perubahan (lib/pindahD1.ts). */
interface Selaras {
  ditimpa: { tabel: string; id: string }[];
  dihapus: { tabel: string; id: string }[];
  ditambah: { tabel: string; id: string }[];
  bentrok: { tabel: string; id: string }[];
}

function kabarSelaras(s: Selaras): { nada: "hijau" | "merah"; teks: string } {
  const bagian = [
    s.ditimpa.length ? `${s.ditimpa.length} baris diperbarui` : "",
    s.dihapus.length ? `${s.dihapus.length} dihapus` : "",
    s.ditambah.length ? `${s.ditambah.length} ditambah` : "",
  ].filter(Boolean);
  const isi = bagian.length ? `${bagian.join(", ")} dari Supabase.` : "Tidak ada perubahan Supabase yang tertinggal.";
  if (s.bentrok.length === 0) return { nada: "hijau", teks: isi };
  return {
    nada: "merah",
    teks: `${isi} ${s.bentrok.length} baris sudah diubah lagi di D1 sehingga dibiarkan; periksa manual: ${s.bentrok.map((b) => `${b.tabel} ${b.id}`).join(", ")}.`,
  };
}

interface Keadaan {
  backend: string;
  banding?: Banding[];
  error?: string;
}

export default function PanelPindahD1() {
  const [data, setData] = useState<Keadaan | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [kabar, setKabar] = useState<{ nada: "hijau" | "merah"; teks: string } | null>(null);

  async function muat() {
    setSibuk("Membandingkan…");
    try {
      const res = await fetch("/api/admin/pindah-d1");
      setData((await res.json().catch(() => ({ backend: "?", error: "Jawaban tidak terbaca" }))) as Keadaan);
    } finally {
      setSibuk(null);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, []);

  async function jalankan(mode: "salin" | "susulan" | "selaras") {
    if (
      mode === "salin" &&
      !window.confirm("Isi D1 akan dikosongkan lalu diisi ulang dengan seluruh data Supabase. Lanjutkan?")
    )
      return;
    setSibuk(mode === "salin" ? "Menyalin seluruh data…" : mode === "selaras" ? "Menyelaraskan perubahan…" : "Menyalin yang tertinggal…");
    setKabar(null);
    try {
      const res = await fetch("/api/admin/pindah-d1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = (await res.json().catch(() => ({}))) as Keadaan & { hasil?: { total: number }; selaras?: Selaras; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Gagal");
      setData(d);
      setKabar(d.selaras ? kabarSelaras(d.selaras) : { nada: "hijau", teks: `${d.hasil?.total.toLocaleString("id-ID") ?? 0} baris ditulis ke D1.` });
    } catch (e) {
      setKabar({ nada: "merah", teks: e instanceof Error ? e.message : "Gagal" });
    } finally {
      setSibuk(null);
    }
  }

  const banding = data?.banding ?? [];
  const selisih = banding.filter((b) => b.belumDiD1 > 0 || b.hanyaDiD1 > 0 || b.supabase !== b.d1);
  const aktifD1 = data?.backend === "d1";

  return (
    <section className="dsb-panel" aria-labelledby="judul-pindah-d1">
      <div className="dsb-panel-kepala">
        <h2 id="judul-pindah-d1" className="dsb-panel-judul">
          Pemindahan basis data ke Cloudflare D1
        </h2>
      </div>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <p className="dsb-kecil" style={{ margin: 0 }}>
          Basis data aktif: <b>{data ? (aktifD1 ? "Cloudflare D1" : "Supabase") : "…"}</b>.{" "}
          {aktifD1
            ? "Supabase disimpan sebagai cadangan. Salin yang tertinggal hanya menambah baris yang belum ada di D1; Selaraskan perubahan menerapkan perubahan dan penghapusan di Supabase sesudah Salin semua terakhir."
            : "Salin semua mengosongkan D1 lalu mengisinya dengan seluruh data Supabase dalam satu transaksi."}
        </p>
        {kabar && (
          <div role={kabar.nada === "merah" ? "alert" : "status"} className="dsb-pesan" data-nada={kabar.nada}>
            <span className="dsb-pesan-ikon" aria-hidden="true">
              {kabar.nada === "merah" ? "!" : "✓"}
            </span>
            <p>{kabar.teks}</p>
          </div>
        )}
        {data?.error && (
          <div role="alert" className="dsb-pesan" data-nada="merah">
            <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
            <p>{data.error}</p>
          </div>
        )}
        {banding.length > 0 && (
          <>
            <p className="dsb-kecil" style={{ margin: 0 }}>
              {selisih.length === 0
                ? `Isi kedua basis data sama: ${banding.reduce((a, b) => a + b.supabase, 0).toLocaleString("id-ID")} baris di ${banding.length} tabel.`
                : `${selisih.length} tabel berbeda isinya.`}
            </p>
            <div className="dsb-gulir-tabel tbl-scroll">
              <table className="dsb-tabel" style={{ minWidth: 520 }}>
                <thead>
                  <tr>
                    <th scope="col">Tabel</th>
                    <th scope="col">Supabase</th>
                    <th scope="col">D1</th>
                    <th scope="col">Belum di D1</th>
                    <th scope="col">Hanya di D1</th>
                  </tr>
                </thead>
                <tbody>
                  {(selisih.length > 0 ? selisih : banding).map((b) => (
                    <tr key={b.tabel}>
                      <td>
                        <code>{b.tabel}</code>
                      </td>
                      <td>{b.supabase.toLocaleString("id-ID")}</td>
                      <td>{b.d1.toLocaleString("id-ID")}</td>
                      <td>{b.belumDiD1 || "–"}</td>
                      <td>{b.hanyaDiD1 || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="dsb-kaki">
        <span>{sibuk ?? "Bandingkan lagi sesudah setiap langkah."}</span>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => void muat()} disabled={!!sibuk}>
            Bandingkan
          </button>
          <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => void jalankan("susulan")} disabled={!!sibuk}>
            Salin yang tertinggal
          </button>
          {/* Perubahan pada baris yang sudah tersalin, di antara Salin semua dan peralihan (lib/pindahD1.ts). */}
          {aktifD1 && (
            <button type="button" className="dsb-tombol" onClick={() => void jalankan("selaras")} disabled={!!sibuk}>
              Selaraskan perubahan
            </button>
          )}
          {!aktifD1 && (
            <button type="button" className="dsb-tombol" onClick={() => void jalankan("salin")} disabled={!!sibuk || !data}>
              Salin semua ke D1
            </button>
          )}
        </span>
      </div>
    </section>
  );
}
