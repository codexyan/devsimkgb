"use client";

import { useEffect, useMemo, useState } from "react";
import { zipSync, strToU8 } from "fflate";
import {
  FOLDER_KEADAAN,
  KOLOM_REKAP,
  LABEL_KEADAAN,
  barisRekap,
  namaFolderPegawai,
  type KeadaanKgb,
} from "@/lib/inventarisKgb";
import type { KirimanInventaris, KonfigurasiInventaris } from "@/lib/inventarisServer";
import { keCsv } from "@/lib/cadangan";
import { formatTanggalId } from "@/lib/waktu";

/* Inventarisasi data KGB pegawai Kanwil: kiriman formulir publik /inventarisasi-kgb. Tim SDM mengunduh semuanya
   sebagai satu ZIP yang strukturnya siap diseret ke Google Drive:
     01 Pernah KGB/NIP - Nama/NIP_SK-KGB-Terakhir_Tanggal.pdf ...
     02 Belum Pernah KGB/NIP - Nama/NIP_SK-CPNS_Tanggal.pdf ...
     Rekap Inventarisasi KGB Kanwil.csv
   ZIP disusun di peramban (fflate), sama dengan cadangan data, karena Worker dibatasi CPU per permintaan. */

const NAMA_REKAP = "Rekap Inventarisasi KGB Kanwil";

function waktuWita(iso: string): string {
  return formatTanggalId(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Baris rekap untuk CSV: kolom mengikuti KOLOM_REKAP, ditambah letak folder dan daftar berkas di dalam ZIP. */
function barisCsv(k: KirimanInventaris): Record<string, string> {
  const nilai = [waktuWita(k.waktu), String(k.kirimanKe), ...barisRekap(k.isian)];
  const baris: Record<string, string> = {};
  KOLOM_REKAP.forEach((kolom, i) => (baris[kolom] = nilai[i] ?? ""));
  baris["Folder"] = `${FOLDER_KEADAAN[k.isian.keadaan]}/${namaFolderPegawai(k.isian.nip, k.isian.nama)}`;
  baris["Berkas"] = k.berkas.map((b) => b.nama).join("; ");
  return baris;
}

export default function HalamanInventarisasi({ superAdmin }: { superAdmin: boolean }) {
  const [kiriman, setKiriman] = useState<KirimanInventaris[] | null>(null);
  const [konfig, setKonfig] = useState<KonfigurasiInventaris | null>(null);
  const [form, setForm] = useState({ terbuka: false, kode: "", batas: "" });
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<"semua" | KeadaanKgb>("semua");
  const [unduh, setUnduh] = useState<{ selesai: number; total: number } | null>(null);

  async function muat() {
    try {
      const res = await fetch("/api/inventarisasi", { cache: "no-store" });
      const d = (await res.json().catch(() => ({}))) as { konfigurasi?: KonfigurasiInventaris; kiriman?: KirimanInventaris[]; error?: string };
      if (!res.ok || !d.kiriman || !d.konfigurasi) throw new Error(d.error ?? "Data inventarisasi gagal dimuat");
      setKiriman(d.kiriman);
      setKonfig(d.konfigurasi);
      setForm({ terbuka: d.konfigurasi.terbuka, kode: d.konfigurasi.kode, batas: d.konfigurasi.batas });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data inventarisasi gagal dimuat");
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, []);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (kiriman ?? []).filter(
      (k) =>
        (saring === "semua" || k.isian.keadaan === saring) &&
        (!q || `${k.isian.nama} ${k.isian.nip} ${k.isian.bidang}`.toLowerCase().includes(q)),
    );
  }, [kiriman, cari, saring]);

  const jumlah = (k: KeadaanKgb) => (kiriman ?? []).filter((x) => x.isian.keadaan === k).length;

  async function simpanKonfig() {
    setMenyimpan(true);
    setGalat(null);
    setPesan(null);
    try {
      const res = await fetch("/api/inventarisasi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Pengaturan gagal disimpan");
      setPesan(form.terbuka ? "Formulir dibuka dengan kode akses yang baru." : "Formulir ditutup.");
      void muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pengaturan gagal disimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(k: KirimanInventaris) {
    if (!window.confirm(`Hapus kiriman ${k.isian.nama} (${k.isian.nip}) beserta berkasnya?`)) return;
    const res = await fetch(`/api/inventarisasi/${k.isian.nip}`, { method: "DELETE" });
    if (res.ok) void muat();
    else setGalat("Kiriman gagal dihapus");
  }

  async function unduhZip(daftar: KirimanInventaris[]) {
    setGalat(null);
    const total = daftar.reduce((n, k) => n + k.berkas.length, 0);
    setUnduh({ selesai: 0, total });
    const isi: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
    const gagal: string[] = [];
    let selesai = 0;
    try {
      for (const k of daftar) {
        const folder = `${FOLDER_KEADAAN[k.isian.keadaan]}/${namaFolderPegawai(k.isian.nip, k.isian.nama)}`;
        for (const b of k.berkas) {
          try {
            const res = await fetch(`/api/inventarisasi/berkas?kunci=${encodeURIComponent(b.kunci)}`);
            if (!res.ok) throw new Error();
            isi[`${folder}/${b.nama}`] = [new Uint8Array(await res.arrayBuffer()), { level: 0 }];
          } catch {
            gagal.push(b.nama);
          }
          setUnduh({ selesai: ++selesai, total });
        }
      }
      isi[`${NAMA_REKAP}.csv`] = strToU8(keCsv(daftar.map(barisCsv)));
      if (gagal.length > 0) isi["BERKAS-GAGAL.txt"] = strToU8(`Berkas yang gagal diunduh:\r\n${gagal.join("\r\n")}`);
      const zip = zipSync(isi, { level: 6 });
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      const hari = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Inventarisasi KGB Kanwil ${hari}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPesan(
        `${daftar.length} pegawai diunduh.${gagal.length > 0 ? ` ${gagal.length} berkas gagal; daftarnya ada di BERKAS-GAGAL.txt.` : ""} Ekstrak ZIP, lalu seret isinya ke folder Google Drive.`,
      );
    } catch {
      setGalat("ZIP gagal disusun. Coba lagi.");
    } finally {
      setUnduh(null);
    }
  }

  const tautanPublik = typeof window !== "undefined" ? `${window.location.origin}/inventarisasi-kgb` : "/inventarisasi-kgb";

  return (
    <div className="dsb-halaman">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Data</p>
          <h1 className="dsb-halaman-judul">Inventarisasi data KGB Kanwil</h1>
          <p className="dsb-sub">
            Kiriman pegawai Kanwil dari formulir <a href="/inventarisasi-kgb" target="_blank" rel="noreferrer">{tautanPublik.replace(/^https?:\/\//, "")}</a>.
            Unduh semuanya sebagai ZIP yang foldernya siap diseret ke Google Drive.
          </p>
        </div>
        <button
          type="button"
          className="dsb-tombol"
          onClick={() => void unduhZip(tampil)}
          disabled={!kiriman || tampil.length === 0 || !!unduh}
        >
          {unduh ? `Mengunduh ${unduh.selesai}/${unduh.total}…` : `Unduh ${tampil.length === (kiriman?.length ?? 0) ? "semua" : tampil.length} (ZIP)`}
        </button>
      </header>

      {galat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>{galat}</p>
        </div>
      )}
      {pesan && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
          <p>{pesan}</p>
        </div>
      )}

      <div className="dsb-angka-kisi dsb-muncul">
        <div className="dsb-angka">
          <span className="dsb-angka-label">Formulir</span>
          <span className="dsb-angka-nilai" style={{ fontSize: 22 }}>{konfig ? (konfig.terbuka ? "Dibuka" : "Ditutup") : "–"}</span>
          <span className="dsb-angka-meta">
            <span className="dsb-titik" data-nada={konfig?.terbuka ? "hijau" : "kuning"} aria-hidden="true" />
            {konfig?.batas ? `Batas ${konfig.batas}` : "Tanpa batas waktu tertulis"}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Pegawai mengirim</span>
          <span className="dsb-angka-nilai">{kiriman ? kiriman.length : "–"}</span>
          <span className="dsb-angka-meta">{kiriman ? `${kiriman.filter((k) => k.kirimanKe > 1).length} mengirim ulang` : ""}</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Pernah KGB</span>
          <span className="dsb-angka-nilai">{kiriman ? jumlah("pernah") : "–"}</span>
          <span className="dsb-angka-meta">Folder {FOLDER_KEADAAN.pernah}</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Belum pernah KGB</span>
          <span className="dsb-angka-nilai">{kiriman ? jumlah("belum") : "–"}</span>
          <span className="dsb-angka-meta">Folder {FOLDER_KEADAAN.belum}</span>
        </div>
      </div>

      {superAdmin && (
        <section className="dsb-panel" aria-labelledby="judul-atur-inv">
          <div className="dsb-panel-kepala">
            <h2 id="judul-atur-inv" className="dsb-panel-judul">Pengaturan formulir</h2>
          </div>
          <div className="inv-atur">
            <label className="inv-cek">
              <input type="checkbox" className="dsb-cek" checked={form.terbuka} onChange={(e) => setForm((f) => ({ ...f, terbuka: e.target.checked }))} />
              Formulir dibuka
            </label>
            <label className="inv-bidang">
              <span>Kode akses (diumumkan di grup WA)</span>
              <input className="dsb-cari" value={form.kode} onChange={(e) => setForm((f) => ({ ...f, kode: e.target.value.toUpperCase().replace(/\s/g, "") }))} placeholder="mis. KANWIL2026" />
            </label>
            <label className="inv-bidang">
              <span>Batas pengisian (tampil di formulir)</span>
              <input className="dsb-cari" value={form.batas} onChange={(e) => setForm((f) => ({ ...f, batas: e.target.value }))} placeholder="mis. Jumat, 10 Oktober 2026" />
            </label>
            <button type="button" className="dsb-tombol" onClick={() => void simpanKonfig()} disabled={menyimpan}>
              {menyimpan ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </section>
      )}

      <section className="dsb-panel" aria-labelledby="judul-daftar-inv">
        <div className="dsb-panel-kepala">
          <h2 id="judul-daftar-inv" className="dsb-panel-judul">
            Kiriman <small>{tampil.length} pegawai</small>
          </h2>
        </div>
        <div className="dsb-alat" style={{ padding: "8px 16px" }}>
          <div className="dsb-segmen" role="group" aria-label="Saring keadaan KGB">
            {(["semua", "pernah", "belum"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={saring === v} onClick={() => setSaring(v)}>
                {v === "semua" ? "Semua" : LABEL_KEADAAN[v]}
              </button>
            ))}
          </div>
          <input type="search" className="dsb-cari" style={{ flex: "1 1 220px" }} placeholder="Cari nama, NIP, bidang" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari kiriman" />
        </div>
        {!kiriman ? (
          <p className="dsb-kosong">Memuat…</p>
        ) : tampil.length === 0 ? (
          <p className="dsb-kosong">{kiriman.length === 0 ? "Belum ada kiriman." : "Tidak ada yang cocok."}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dsb-tabel">
              <thead>
                <tr>
                  <th scope="col">Pegawai</th>
                  <th scope="col">Keadaan</th>
                  <th scope="col">Golongan</th>
                  <th scope="col">TMT KGB terakhir / CPNS</th>
                  <th scope="col">Berkas</th>
                  <th scope="col">Dikirim</th>
                  {superAdmin && <th scope="col" className="kanan">Tindakan</th>}
                </tr>
              </thead>
              <tbody>
                {tampil.map((k) => (
                  <tr key={k.isian.nip}>
                    <td>
                      <p className="dsb-nama" style={{ margin: 0 }}>{k.isian.nama}</p>
                      <p className="dsb-kecil" style={{ margin: 0 }}>{k.isian.nip}{k.isian.bidang ? ` · ${k.isian.bidang}` : ""}</p>
                    </td>
                    <td>
                      <span className="dsb-tag" data-nada={k.isian.keadaan === "pernah" ? "biru" : "hijau"}>{LABEL_KEADAAN[k.isian.keadaan]}</span>
                    </td>
                    <td className="whitespace-nowrap">{k.isian.golonganRuang}{k.isian.keadaan === "pernah" ? ` · MKG ${k.isian.mkgTahun}/${k.isian.mkgBulan || "0"}` : ""}</td>
                    <td className="whitespace-nowrap">{k.isian.tmtDasar ? formatTanggalId(k.isian.tmtDasar) : "-"}</td>
                    <td>
                      <div className="inv-berkas">
                        {k.berkas.map((b) => (
                          <a key={b.kunci} href={`/api/inventarisasi/berkas?kunci=${encodeURIComponent(b.kunci)}`} target="_blank" rel="noreferrer" title={b.nama}>
                            {b.jenis.replace(/-/g, " ")}
                          </a>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap dsb-kecil">
                      {waktuWita(k.waktu)}
                      {k.kirimanKe > 1 && <> · ke-{k.kirimanKe}</>}
                    </td>
                    {superAdmin && (
                      <td className="kanan">
                        <button type="button" className="dsb-ikon-tombol" data-nada="merah" aria-label={`Hapus kiriman ${k.isian.nama}`} onClick={() => void hapus(k)}>
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
