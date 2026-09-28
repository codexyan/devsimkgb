"use client";

import { useEffect, useMemo, useState } from "react";
import { zipSync, strToU8 } from "fflate";
import {
  FOLDER_KEADAAN,
  KOLOM_REKAP,
  LABEL_KEADAAN,
  barisRekap,
  folderKiriman,
  keadaanFormulir,
  teksBatas,
  type KeadaanKgb,
} from "@/lib/inventarisKgb";
import {
  TEMPLATE_KEGIATAN,
  namaSatker,
  satkerPilihan,
  tautanKegiatan,
  templateTersedia,
  type Kegiatan,
  type TemplateKegiatan,
} from "@/lib/kegiatanInventaris";
import type { KirimanInventaris } from "@/lib/inventarisServer";
import { KerangkaModal, ModalPratinjauBerkas } from "@/app/dashboard/components/kgb";
import KartuKiriman, { NADA_STATUS, type Pemutakhiran } from "./KartuKiriman";
import { LABEL_TINDAK_LANJUT, type StatusTindakLanjut } from "@/lib/pemutakhiranPegawai";
import { SATKER } from "@/lib/satker";
import { keCsv } from "@/lib/cadangan";
import { formatTanggalId } from "@/lib/waktu";

/* Kegiatan pengumpulan data lewat formulir publik (ADR-022): Super Admin membuat kegiatan dari template (mis.
   inventarisasi KGB pegawai Kanwil atau pegawai UPT), mengatur kode akses dan waktu tutupnya, dan Tim SDM mengunduh
   kiriman tiap kegiatan sebagai satu ZIP yang strukturnya siap diseret ke Google Drive:
     [Satker/]01 Pernah KGB/NIP - Nama/NIP_SK-KGB-Terakhir_Tanggal.pdf ...
     [Satker/]02 Belum Pernah KGB/NIP - Nama/NIP_SK-CPNS_Tanggal.pdf ...
     Rekap <nama kegiatan>.csv
   ZIP disusun di peramban (fflate), sama dengan cadangan data, karena Worker dibatasi CPU per permintaan. */

const SATKER_UPT = SATKER.filter((s) => s.jenis !== "kanwil");

function waktuWita(iso: string): string {
  return formatTanggalId(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Nama berkas atau folder yang aman di Windows dan Google Drive. */
const namaAman = (s: string) => s.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();

/** Baris rekap untuk CSV: kolom mengikuti KOLOM_REKAP, ditambah letak folder dan daftar berkas di dalam ZIP. */
function barisCsv(k: KirimanInventaris): Record<string, string> {
  const nilai = [waktuWita(k.waktu), String(k.kirimanKe), ...barisRekap(k.isian)];
  const baris: Record<string, string> = {};
  KOLOM_REKAP.forEach((kolom, i) => (baris[kolom] = nilai[i] ?? ""));
  baris["Folder"] = folderKiriman(k.isian);
  baris["Berkas"] = k.berkas.map((b) => b.nama).join("; ");
  return baris;
}

interface FormKegiatan {
  nama: string;
  terbuka: boolean;
  kode: string;
  tutupPada: string;
  satker: string[];
}

const formDari = (k: Kegiatan): FormKegiatan => ({
  nama: k.nama,
  terbuka: k.terbuka,
  kode: k.kode,
  tutupPada: k.tutupPada ?? "",
  satker: k.satker,
});

/** Kiriman beserta perbandingannya dengan Data Pegawai (GET /api/inventarisasi). */
type KirimanAntrian = KirimanInventaris & Pick<Pemutakhiran, "banding" | "peringatan"> & { pegawaiId: string | null };

/** Ringkasan sel Perbandingan: jumlah isian berbeda, atau keterangan bila pegawainya belum tercatat. */
function selBanding(k: KirimanAntrian): { teks: string; nada?: string } {
  if (!k.pegawaiId) return { teks: "Belum terdaftar di SIM-KGB", nada: "kuning" };
  const beda = k.banding.filter((b) => b.beda).length;
  if (beda === 0) return { teks: k.peringatan.length > 0 ? "Sama, ada peringatan" : "Sama dengan SIM-KGB" };
  return { teks: `${beda} isian berbeda`, nada: "kuning" };
}

export default function HalamanInventarisasi({ superAdmin }: { superAdmin: boolean }) {
  const [daftarKeg, setDaftarKeg] = useState<Kegiatan[]>([]);
  const [aktifId, setAktifId] = useState<string | null>(null);
  const [kiriman, setKiriman] = useState<KirimanAntrian[] | null>(null);
  // Panel Periksa: rujukan satu kiriman (perbandingan, berkas, status tindak lanjut). Data Pegawai diubah di modul
  // Data Pegawai, bukan dari sini (ADR-027).
  const [periksa, setPeriksa] = useState<KirimanAntrian | null>(null);
  const [berkasPratinjau, setBerkasPratinjau] = useState<{ judul: string; url: string } | null>(null);
  const [saringKerja, setSaringKerja] = useState(false);
  const [form, setForm] = useState<FormKegiatan>({ nama: "", terbuka: false, kode: "", tutupPada: "", satker: [] });
  const [baru, setBaru] = useState<{ nama: string; template: TemplateKegiatan }>({ nama: "", template: "kgb-upt" });
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<"semua" | KeadaanKgb>("semua");
  const [unduh, setUnduh] = useState<{ selesai: number; total: number } | null>(null);

  const aktif = daftarKeg.find((k) => k.id === aktifId) ?? null;
  const pakaiSatker = aktif ? TEMPLATE_KEGIATAN[aktif.template].pakaiSatker : false;

  async function muat(id?: string) {
    try {
      const res = await fetch(`/api/inventarisasi${id ? `?kegiatan=${encodeURIComponent(id)}` : ""}`, { cache: "no-store" });
      const d = (await res.json().catch(() => ({}))) as {
        kegiatan?: Kegiatan[];
        aktif?: string;
        kiriman?: KirimanAntrian[];
        error?: string;
      };
      if (!res.ok || !d.kiriman || !d.kegiatan || !d.aktif) throw new Error(d.error ?? "Data inventarisasi gagal dimuat");
      setDaftarKeg(d.kegiatan);
      setAktifId(d.aktif);
      setKiriman(d.kiriman);
      const k = d.kegiatan.find((x) => x.id === d.aktif);
      if (k) setForm(formDari(k));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data inventarisasi gagal dimuat");
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, []);

  function pilihKegiatan(id: string) {
    if (id === aktifId) return;
    setKiriman(null);
    setCari("");
    setSaring("semua");
    setPesan(null);
    setGalat(null);
    void muat(id);
  }

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (kiriman ?? []).filter(
      (k) =>
        (saring === "semua" || k.isian.keadaan === saring) &&
        (!saringKerja || (k.tindakLanjut?.status ?? "belum_diperiksa") === "belum_diperiksa" || k.banding.some((b) => b.beda)) &&
        (!q || `${k.isian.nama} ${k.isian.nip} ${k.isian.bidang} ${namaSatker(k.isian.satker)}`.toLowerCase().includes(q)),
    );
  }, [kiriman, cari, saring, saringKerja]);

  const jumlah = (k: KeadaanKgb) => (kiriman ?? []).filter((x) => x.isian.keadaan === k).length;

  async function simpanKonfig() {
    if (!aktif) return;
    setMenyimpan(true);
    setGalat(null);
    setPesan(null);
    try {
      const res = await fetch("/api/inventarisasi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: aktif.id, ...form }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Pengaturan gagal disimpan");
      const batas = teksBatas(form);
      setPesan(
        form.terbuka
          ? `Formulir "${form.nama}" dibuka${batas ? ` sampai ${batas}, lalu tertutup otomatis` : " tanpa batas waktu"}.`
          : `Formulir "${form.nama}" ditutup.`,
      );
      void muat(aktif.id);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pengaturan gagal disimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  async function buatKegiatan() {
    setMenyimpan(true);
    setGalat(null);
    setPesan(null);
    try {
      const res = await fetch("/api/inventarisasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: baru.nama, template: baru.template, terbuka: false, satker: [] }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
      if (!res.ok || !d.id) throw new Error(d.error ?? "Kegiatan gagal dibuat");
      setBaru({ nama: "", template: baru.template });
      setPesan(`Kegiatan "${baru.nama.trim()}" dibuat dan masih ditutup. Atur kode akses dan waktu tutupnya, lalu centang Formulir dibuka.`);
      setKiriman(null);
      void muat(d.id);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Kegiatan gagal dibuat");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(k: KirimanAntrian) {
    if (!aktif || !window.confirm(`Hapus kiriman ${k.isian.nama} (${k.isian.nip}) beserta berkasnya?`)) return;
    const res = await fetch(`/api/inventarisasi/${k.isian.nip}?kegiatan=${encodeURIComponent(aktif.id)}`, { method: "DELETE" });
    if (res.ok) void muat(aktif.id);
    else setGalat("Kiriman gagal dihapus");
  }

  async function unduhZip(daftar: KirimanAntrian[]) {
    if (!aktif) return;
    setGalat(null);
    const total = daftar.reduce((n, k) => n + k.berkas.length, 0);
    setUnduh({ selesai: 0, total });
    const isi: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
    const gagal: string[] = [];
    let selesai = 0;
    try {
      for (const k of daftar) {
        const folder = folderKiriman(k.isian);
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
      isi[`Rekap ${namaAman(aktif.nama)}.csv`] = strToU8(keCsv(daftar.map(barisCsv)));
      if (gagal.length > 0) isi["BERKAS-GAGAL.txt"] = strToU8(`Berkas yang gagal diunduh:\r\n${gagal.join("\r\n")}`);
      const zip = zipSync(isi, { level: 6 });
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      const hari = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `${namaAman(aktif.nama)} ${hari}.zip`;
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

  const keadaan = aktif ? keadaanFormulir(aktif) : null;
  const batasKini = aktif ? teksBatas(aktif) : "";
  const jalur = aktif ? tautanKegiatan(aktif.id) : "/inventarisasi-kgb";
  const tautanPublik = typeof window !== "undefined" ? `${window.location.origin}${jalur}` : jalur;
  const jumlahSatker = aktif && pakaiSatker ? satkerPilihan(aktif).length : 0;

  function ubahSatker(kode: string, dipilih: boolean) {
    setForm((f) => ({ ...f, satker: dipilih ? [...f.satker, kode] : f.satker.filter((s) => s !== kode) }));
  }

  return (
    <div className="dsb-halaman">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Data</p>
          <h1 className="dsb-halaman-judul">Inventarisasi data KGB</h1>
          <p className="dsb-sub">
            {aktif ? `${aktif.nama}: kiriman dari formulir ` : "Kiriman dari formulir "}
            <a href={jalur} target="_blank" rel="noreferrer">{tautanPublik.replace(/^https?:\/\//, "")}</a>. Unduh semuanya
            sebagai ZIP yang foldernya siap diseret ke Google Drive.
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

      {daftarKeg.length > 1 && (
        <div className="dsb-segmen inv-kegiatan dsb-muncul" role="group" aria-label="Pilih kegiatan">
          {daftarKeg.map((k) => (
            <button key={k.id} type="button" aria-pressed={k.id === aktifId} onClick={() => pilihKegiatan(k.id)}>
              {k.nama}
            </button>
          ))}
        </div>
      )}

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
          <span className="dsb-angka-nilai" style={{ fontSize: 22 }}>
            {keadaan ? (keadaan === "dibuka" ? "Dibuka" : keadaan === "lewat_batas" ? "Lewat batas" : "Ditutup") : "–"}
          </span>
          <span className="dsb-angka-meta">
            <span className="dsb-titik" data-nada={keadaan === "dibuka" ? "hijau" : keadaan === "lewat_batas" ? "merah" : "kuning"} aria-hidden="true" />
            {keadaan === "dibuka"
              ? batasKini ? `Sampai ${batasKini}` : "Tanpa batas waktu"
              : keadaan === "lewat_batas"
                ? `Tertutup otomatis ${batasKini}`
                : "Tidak menerima kiriman"}
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

      {superAdmin && aktif && (
        <section className="dsb-panel" aria-labelledby="judul-atur-inv">
          <div className="dsb-panel-kepala">
            <h2 id="judul-atur-inv" className="dsb-panel-judul">
              Pengaturan formulir <small>{TEMPLATE_KEGIATAN[aktif.template].label}</small>
            </h2>
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
              <span>Ditutup otomatis pada (WITA)</span>
              <input type="datetime-local" className="dsb-cari" value={form.tutupPada} onChange={(e) => setForm((f) => ({ ...f, tutupPada: e.target.value }))} />
            </label>
            <button type="button" className="dsb-tombol" onClick={() => void simpanKonfig()} disabled={menyimpan}>
              {menyimpan ? "Menyimpan…" : "Simpan"}
            </button>
            <label className="inv-bidang inv-lebar">
              <span>Nama kegiatan</span>
              <input className="dsb-cari" value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} />
            </label>
            {pakaiSatker && (
              <details className="inv-lebar inv-satker">
                <summary>
                  Satker sasaran:{" "}
                  {form.satker.length === 0 ? `semua UPT (${SATKER_UPT.length})` : `${form.satker.length} satker dipilih`}
                </summary>
                <p className="inv-bantu">Pengisi hanya bisa memilih satker yang dicentang. Tanpa centang, semua UPT boleh mengisi.</p>
                <div className="inv-satker-daftar">
                  {SATKER_UPT.map((s) => (
                    <label key={s.kode} className="inv-cek">
                      <input
                        type="checkbox"
                        className="dsb-cek"
                        checked={form.satker.includes(s.kode)}
                        onChange={(e) => ubahSatker(s.kode, e.target.checked)}
                      />
                      {s.nama}
                    </label>
                  ))}
                </div>
              </details>
            )}
            <p className="inv-bantu">
              Kosongkan waktu tutup bila tanpa batas. Setelah waktunya lewat, formulir tertutup sendiri; untuk membukanya
              lagi, pilih waktu tutup yang baru lalu Simpan.
              {pakaiSatker && ` Pengisi memilih satu dari ${jumlahSatker} satker; ZIP dan rekap dikelompokkan per satker.`}
            </p>
          </div>
        </section>
      )}

      {superAdmin && (
        <details className="dsb-panel inv-baru">
          <summary className="dsb-panel-kepala">
            <span className="dsb-panel-judul">Kegiatan baru</span>
          </summary>
          <div className="inv-atur">
            <label className="inv-bidang">
              <span>Template</span>
              <select className="dsb-cari" value={baru.template} onChange={(e) => setBaru((b) => ({ ...b, template: e.target.value as TemplateKegiatan }))}>
                {templateTersedia().map((t) => (
                  <option key={t} value={t}>{TEMPLATE_KEGIATAN[t].label}</option>
                ))}
              </select>
            </label>
            <label className="inv-bidang inv-lebar-2">
              <span>Nama kegiatan</span>
              <input className="dsb-cari" value={baru.nama} onChange={(e) => setBaru((b) => ({ ...b, nama: e.target.value }))} placeholder="mis. Inventarisasi KGB UPT Oktober 2026" />
            </label>
            <button type="button" className="dsb-tombol" onClick={() => void buatKegiatan()} disabled={menyimpan || baru.nama.trim().length < 3}>
              Buat kegiatan
            </button>
            <p className="inv-bantu">
              {TEMPLATE_KEGIATAN[baru.template].keterangan} Kegiatan baru mendapat tautannya sendiri dan masih ditutup
              sampai Anda mengatur kode akses dan membukanya.{" "}
              Pemutakhiran data pegawai UPT tidak lewat sini, melainkan lewat Usulan UPT, supaya UPT tidak mengirim data
              yang sama di dua tempat.
            </p>
          </div>
        </details>
      )}

      <section className="dsb-panel" aria-labelledby="judul-daftar-inv">
        <div className="dsb-panel-kepala">
          <h2 id="judul-daftar-inv" className="dsb-panel-judul">
            Kiriman <small>{tampil.length} pegawai</small>
          </h2>
        </div>
        {/* Saringan menempel di atas saat daftar kiriman yang panjang digulir. */}
        <div className="dsb-alat inv-alat">
          <div className="dsb-segmen" role="group" aria-label="Saring keadaan KGB">
            {(["semua", "pernah", "belum"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={saring === v} onClick={() => setSaring(v)}>
                {v === "semua" ? "Semua" : LABEL_KEADAAN[v]}
              </button>
            ))}
          </div>
          <label className="inv-cek">
            <input type="checkbox" className="dsb-cek" checked={saringKerja} onChange={(e) => setSaringKerja(e.target.checked)} />
            Perlu dikerjakan
          </label>
          <input
            type="search"
            className="dsb-cari"
            style={{ flex: "1 1 220px" }}
            placeholder={pakaiSatker ? "Cari nama, NIP, satker" : "Cari nama, NIP, bidang"}
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            aria-label="Cari kiriman"
          />
        </div>
        {!kiriman ? (
          <p className="dsb-kosong">Memuat…</p>
        ) : tampil.length === 0 ? (
          <p className="dsb-kosong">{kiriman.length === 0 ? "Belum ada kiriman." : "Tidak ada yang cocok."}</p>
        ) : (
          // Di layar lebar: tabel yang bergulir mendatar di dalam panelnya dengan kolom Pegawai tetap di kiri.
          // Di ponsel: tiap baris menjadi kartu bertumpuk (inv-tabel di dasbor.css), tanpa gulir mendatar.
          <div className="inv-tabel-gulir">
            <table className="dsb-tabel inv-tabel">
              <thead>
                <tr>
                  <th scope="col">Pegawai</th>
                  {pakaiSatker && <th scope="col">Satker</th>}
                  <th scope="col">Keadaan</th>
                  <th scope="col">Perbandingan</th>
                  <th scope="col">Tindak lanjut</th>
                  <th scope="col">Berkas</th>
                  <th scope="col">Dikirim</th>
                  <th scope="col" className="kanan">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((k) => (
                  <tr key={k.isian.nip}>
                    <td>
                      <p className="dsb-nama" style={{ margin: 0 }}>{k.isian.nama}</p>
                      <p className="dsb-kecil" style={{ margin: 0 }}>{k.isian.nip}{k.isian.bidang ? ` · ${k.isian.bidang}` : ""}</p>
                    </td>
                    {pakaiSatker && <td className="dsb-kecil" data-label="Satker" style={{ minWidth: 200 }}>{namaSatker(k.isian.satker) || "-"}</td>}
                    <td data-label="Keadaan">
                      <span className="dsb-tag" data-nada={k.isian.keadaan === "pernah" ? "biru" : "hijau"}>{LABEL_KEADAAN[k.isian.keadaan]}</span>
                    </td>
                    <td data-label="Perbandingan">
                      {(() => {
                        const sel = selBanding(k);
                        return (
                          <>
                            <span className="dsb-tag" data-nada={sel.nada}>{sel.teks}</span>
                            {k.peringatan.length > 0 && (
                              <p className="dsb-kecil" style={{ margin: "2px 0 0", color: "var(--st-amber)" }}>
                                {k.peringatan.length} peringatan
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td data-label="Tindak lanjut">
                      {(() => {
                        const st: StatusTindakLanjut = k.tindakLanjut?.status ?? "belum_diperiksa";
                        return (
                          <>
                            <span className="dsb-tag" data-nada={NADA_STATUS[st]}>{LABEL_TINDAK_LANJUT[st]}</span>
                            {k.tindakLanjut?.oleh && (
                              <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>{k.tindakLanjut.oleh}</p>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td data-label="Berkas">
                      <div className="inv-berkas">
                        {k.berkas.map((b) => (
                          <a key={b.kunci} href={`/api/inventarisasi/berkas?kunci=${encodeURIComponent(b.kunci)}`} target="_blank" rel="noreferrer" title={b.nama}>
                            {b.jenis.replace(/-/g, " ")}
                          </a>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap dsb-kecil" data-label="Dikirim">
                      {waktuWita(k.waktu)}
                      {k.kirimanKe > 1 && <> · ke-{k.kirimanKe}</>}
                    </td>
                    <td className="kanan whitespace-nowrap inv-tindakan">
                      <button
                        type="button"
                        className="dsb-tombol"
                        data-jenis="garis"
                        onClick={() => setPeriksa(k)}
                      >
                        Periksa
                      </button>
                      {superAdmin && (
                        <button type="button" className="dsb-ikon-tombol" data-nada="merah" aria-label={`Hapus kiriman ${k.isian.nama}`} onClick={() => void hapus(k)} style={{ marginLeft: 6 }}>
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {periksa && (
        <KerangkaModal
          judul="Periksa kiriman"
          subjudul={`${periksa.isian.nama} · ${periksa.isian.nip}`}
          ukuran="lg"
          onTutup={() => setPeriksa(null)}
        >
          <KartuKiriman
            p={{ kegiatan: { id: aktif?.id ?? "", nama: aktif?.nama ?? "" }, kiriman: periksa, banding: periksa.banding, peringatan: periksa.peringatan }}
            pegawaiId={periksa.pegawaiId}
            bolehUbah
            tautanPegawai={periksa.pegawaiId ? `/dashboard/pegawai/${periksa.pegawaiId}/riwayat` : undefined}
            onBerhasil={(teks) => {
              setPesan(teks);
              setPeriksa(null);
              void muat(aktif?.id);
            }}
            onLihatBerkas={setBerkasPratinjau}
          />
        </KerangkaModal>
      )}

      {berkasPratinjau && (
        <ModalPratinjauBerkas
          judul={berkasPratinjau.judul}
          subjudul={periksa ? `${periksa.isian.nama} · ${periksa.isian.nip}` : undefined}
          url={berkasPratinjau.url}
          onTutup={() => setBerkasPratinjau(null)}
        />
      )}

    </div>
  );
}
