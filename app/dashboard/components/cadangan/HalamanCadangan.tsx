"use client";

import { useEffect, useState } from "react";
import { zipSync, strToU8 } from "fflate";
import { BATAS_HARI_CADANGAN, keCsv, namaBerkasCadangan, statusCadangan, terbaru, type KeadaanCadangan } from "@/lib/cadangan";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { formatTanggalId } from "@/lib/waktu";
import { catatCadanganLokal, bacaCadanganLokal, KABAR_CADANGAN } from "./cadanganLokal";

/* Cadangan data bulanan wajib (ADR-018). Data diminta per jenis lalu disusun menjadi CSV dan ZIP di
   peramban, bukan di server: Worker Cloudflare punya batas CPU per permintaan, dan cadangan sebesar ini
   tidak boleh bergantung pada satu permintaan yang panjang. */

interface Ringkas {
  role: string;
  nip: string;
  keadaan: KeadaanCadangan;
  hariSejak: number;
  jatuhTempo: string;
  terakhir: string | null;
  jenis: { id: string; label: string }[];
  sk: { nama: string; url: string }[];
}

type Langkah = { teks: string; selesai: number; total: number } | null;

const NADA: Record<KeadaanCadangan, "hijau" | "kuning" | "merah"> = { aman: "hijau", ingat: "kuning", wajib: "merah" };

export default function HalamanCadangan() {
  const [data, setData] = useState<Ringkas | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [denganSk, setDenganSk] = useState(true);
  const [langkah, setLangkah] = useState<Langkah>(null);
  const [hasil, setHasil] = useState<{ nama: string; gagal: string[]; tercatat: boolean } | null>(null);

  async function muat() {
    try {
      const res = await fetch("/api/cadangan?lengkap=1");
      const d = (await res.json().catch(() => ({}))) as Ringkas & { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Keadaan cadangan gagal dimuat");
      setData(d);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Keadaan cadangan gagal dimuat");
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, []);

  const status = data ? statusCadangan(terbaru(data.terakhir, bacaCadanganLokal(data.nip)), null, new Date()) : null;
  // Tanpa catatan sama sekali, jatuh temponya dari server (dihitung sejak fitur berlaku atau akun dibuat).
  const jatuhTempo = status?.terakhir ? status.jatuhTempo : data ? new Date(data.jatuhTempo) : null;
  const keadaan: KeadaanCadangan = status?.terakhir ? status.keadaan : (data?.keadaan ?? "aman");

  async function unduh() {
    if (!data) return;
    setGalat(null);
    setHasil(null);
    const berkas: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {};
    const gagal: string[] = [];
    const jumlahBaris: string[] = [];
    try {
      // 1. Data per jenis, satu permintaan per jenis.
      for (const [i, j] of data.jenis.entries()) {
        setLangkah({ teks: `Mengambil ${j.label.toLowerCase()}`, selesai: i, total: data.jenis.length });
        const res = await fetch(`/api/cadangan/${j.id}`);
        const d = (await res.json().catch(() => ({}))) as { baris?: Record<string, never>[]; error?: string };
        if (!res.ok || !Array.isArray(d.baris)) throw new Error(d.error ?? `${j.label} gagal diambil`);
        berkas[`data/${j.id}.csv`] = strToU8(keCsv(d.baris));
        jumlahBaris.push(`- ${j.label}: ${d.baris.length} baris (data/${j.id}.csv)`);
      }

      // 2. PDF SK yang sudah terbit, disimpan tanpa kompresi (PDF sudah terkompresi).
      if (denganSk) {
        for (const [i, sk] of data.sk.entries()) {
          setLangkah({ teks: "Mengunduh PDF SK", selesai: i, total: data.sk.length });
          try {
            const res = await fetch(sk.url);
            if (!res.ok) throw new Error();
            berkas[`sk/${sk.nama}`] = [new Uint8Array(await res.arrayBuffer()), { level: 0 }];
          } catch {
            gagal.push(sk.nama);
          }
        }
      }

      // 3. Keterangan isi, lalu ZIP.
      setLangkah({ teks: "Menyusun berkas ZIP", selesai: 0, total: 1 });
      const sekarang = new Date();
      berkas["BACA-SAYA.txt"] = strToU8(
        [
          "Cadangan data SIM-KGB Kanwil Ditjenpas Kalimantan Selatan",
          `Diunduh: ${sekarang.toLocaleString("id-ID")}`,
          `Akun: ${data.nip} (${ROLE_LABEL[data.role] ?? data.role})`,
          "",
          "Isi:",
          ...jumlahBaris,
          denganSk ? `- PDF SK KGB: ${data.sk.length - gagal.length} berkas (folder sk/)` : "- PDF SK KGB: tidak disertakan",
          ...(gagal.length > 0 ? ["", "PDF SK yang gagal diunduh:", ...gagal.map((g) => `- ${g}`)] : []),
          "",
          "Berkas CSV dapat dibuka dengan Excel atau LibreOffice. Tanggal ditulis dalam format ISO (UTC).",
          "Cadangan ini memuat data pribadi pegawai. Simpan di perangkat atau penyimpanan dinas yang aman,",
          "jangan dibagikan, dan hapus cadangan lama yang tidak diperlukan lagi.",
          `Cadangan berikutnya paling lambat ${BATAS_HARI_CADANGAN} hari lagi.`,
        ].join("\r\n"),
      );
      const zip = zipSync(berkas, { level: 6 });
      const nama = namaBerkasCadangan(data.role, data.nip, sekarang);
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nama;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      // 4. Catat: di peramban lebih dulu (pasti), lalu di server (untuk pemantauan Super Admin).
      catatCadanganLokal(data.nip, sekarang);
      let tercatat = false;
      try {
        const res = await fetch("/api/cadangan", { method: "POST" });
        const d = (await res.json().catch(() => ({}))) as { tercatat?: boolean };
        tercatat = res.ok && d.tercatat !== false;
      } catch {
        // Catatan peramban sudah cukup untuk pengingat di perangkat ini.
      }
      window.dispatchEvent(new Event(KABAR_CADANGAN));
      setHasil({ nama, gagal, tercatat });
      void muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Cadangan gagal disusun");
    } finally {
      setLangkah(null);
    }
  }

  return (
    <div className="dsb-halaman">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Bantuan</p>
          <h1 className="dsb-halaman-judul">Cadangkan data</h1>
          <p className="dsb-sub">
            Selama SIM-KGB masih disempurnakan, setiap akun wajib menyimpan cadangan data sesuai hak aksesnya ke
            perangkat yang dipakai, paling tidak sebulan sekali. Bila terjadi kekeliruan data atau gangguan layanan,
            salinan terakhir tetap ada di tangan Anda.
          </p>
        </div>
      </header>

      {galat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>{galat}</p>
        </div>
      )}
      {hasil && (
        <div role="status" className="dsb-pesan" data-nada={hasil.gagal.length > 0 ? "kuning" : "hijau"}>
          <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
          <p>
            Cadangan <b>{hasil.nama}</b> sudah diunduh. Pindahkan ke folder yang aman.
            {hasil.gagal.length > 0 && ` ${hasil.gagal.length} PDF SK gagal diunduh; daftarnya ada di BACA-SAYA.txt.`}
            {!hasil.tercatat && " Server belum dapat mencatatnya, jadi pengingat hanya mengenalinya di perangkat ini."}
          </p>
        </div>
      )}

      <div className="dsb-angka-kisi dsb-muncul">
        <div className="dsb-angka">
          <span className="dsb-angka-label">Cadangan terakhir</span>
          <span className="dsb-angka-nilai" style={{ fontSize: 22 }}>
            {status?.terakhir ? formatTanggalId(status.terakhir, { day: "numeric", month: "short", year: "numeric" }) : data ? "Belum pernah" : "–"}
          </span>
          <span className="dsb-angka-meta">{status?.terakhir ? `${status.hariSejak} hari lalu` : "Dihitung sejak fitur ini berlaku"}</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Batas cadangan berikutnya</span>
          <span className="dsb-angka-nilai" style={{ fontSize: 22 }}>
            {jatuhTempo ? formatTanggalId(jatuhTempo, { day: "numeric", month: "short", year: "numeric" }) : "–"}
          </span>
          <span className="dsb-angka-meta">
            <span className="dsb-titik" data-nada={NADA[keadaan]} aria-hidden="true" />
            {keadaan === "wajib" ? "Sudah lewat batas, cadangkan sekarang" : keadaan === "ingat" ? "Segera jatuh tempo" : "Masih aman"}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Akun</span>
          <span className="dsb-angka-nilai" style={{ fontSize: 22 }}>{data ? (ROLE_LABEL[data.role] ?? data.role) : "–"}</span>
          <span className="dsb-angka-meta">Isi cadangan mengikuti hak akses akun ini</span>
        </div>
      </div>

      <section className="dsb-panel" aria-labelledby="judul-isi-cadangan">
        <div className="dsb-panel-kepala">
          <h2 id="judul-isi-cadangan" className="dsb-panel-judul">Isi cadangan</h2>
        </div>
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {!data ? (
            <p className="dsb-kosong">Memuat…</p>
          ) : (
            <>
              <ul className="cdg-daftar">
                {data.jenis.map((j) => (
                  <li key={j.id}>{j.label}</li>
                ))}
              </ul>
              {data.sk.length > 0 && (
                <label className="cdg-pilih">
                  <input type="checkbox" className="dsb-cek" checked={denganSk} onChange={(e) => setDenganSk(e.target.checked)} />
                  Sertakan PDF SK KGB yang sudah terbit ({data.sk.length} berkas)
                </label>
              )}
              <p className="dsb-kecil" style={{ margin: 0 }}>
                Hasilnya satu berkas ZIP berisi CSV per jenis data (dapat dibuka di Excel) dan folder PDF SK. Sandi akun tidak
                pernah ikut. Cadangan memuat data pribadi pegawai: simpan di perangkat atau penyimpanan dinas yang aman dan
                jangan dibagikan.
              </p>
            </>
          )}
        </div>
        <div className="dsb-kaki">
          <span>
            {langkah
              ? `${langkah.teks}${langkah.total > 1 ? ` (${langkah.selesai + 1}/${langkah.total})` : "…"}`
              : "Jangan tutup halaman ini sampai unduhan selesai."}
          </span>
          <button type="button" className="dsb-tombol" onClick={() => void unduh()} disabled={!data || !!langkah}>
            {langkah ? "Menyiapkan…" : "Unduh cadangan sekarang"}
          </button>
        </div>
      </section>
    </div>
  );
}
