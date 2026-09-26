"use client";

import { useState } from "react";
import Papa from "papaparse";
import { KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import { BATAS_BARIS_IMPOR, KOLOM_IMPOR_UPT, KOLOM_TEMPLAT_UPT, templatCsvUpt, type PeranKolomTemplat } from "@/lib/imporUsulanUpt";
import { FORMAT_TANGGAL_DITERIMA } from "@/lib/dataPegawai";

/* Unggah daftar pegawai sekaligus.
   Berkasnya diuraikan di peramban, tetapi yang menilai isinya tetap server: baris diperiksa lebih dulu
   lewat periksaSaja, hasilnya ditunjukkan, dan penyimpanan baru terjadi setelah operator menekan
   tombol kedua. Dengan begitu aturannya hanya ada satu tempat, dan tidak ada berkas yang telanjur
   tersimpan separuh karena operator salah memilih berkas. */

const LABEL_PERAN: Record<PeranKolomTemplat, string> = {
  wajib: "wajib",
  diajukan: "wajib saat diajukan",
  opsional: "boleh kosong",
};

function unduhTemplat() {
  const url = URL.createObjectURL(new Blob([templatCsvUpt()], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "templat_data_pegawai_upt.csv";
  a.click();
  URL.revokeObjectURL(url);
}

interface Ringkas {
  sah: number;
  gagal: number;
  belumLengkap: number;
  galat: string[];
}

export default function ModalImporUpt({
  onTutup,
  onSelesai,
}: {
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const [baris, setBaris] = useState<Record<string, unknown>[] | null>(null);
  const [namaBerkas, setNamaBerkas] = useState("");
  const [periksa, setPeriksa] = useState<Ringkas | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  function pilihBerkas(file: File | null) {
    setPeriksa(null);
    setBaris(null);
    setGalat(null);
    setNamaBerkas(file?.name ?? "");
    if (!file) return;
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (hasil) => {
        const data = hasil.data.filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
        if (data.length === 0) {
          setGalat("Berkas tidak berisi satu baris data pun.");
          return;
        }
        const kepala = Object.keys(data[0] ?? {});
        const hilang = KOLOM_IMPOR_UPT.filter((k) => !kepala.includes(k));
        if (hilang.length > 0) {
          setGalat(`Baris kepala berkas tidak memuat kolom: ${hilang.join(", ")}. Unduh templatnya dari dialog ini.`);
          return;
        }
        if (data.length > BATAS_BARIS_IMPOR) {
          setGalat(`Sekali unggah paling banyak ${BATAS_BARIS_IMPOR} baris; berkas ini ${data.length} baris.`);
          return;
        }
        setBaris(data);
        void kirim(data, true);
      },
      error: () => setGalat("Berkas tidak dapat dibaca. Pastikan berformat CSV."),
    });
  }

  async function kirim(data: Record<string, unknown>[], periksaSaja: boolean) {
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch("/api/upt/usulan/impor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baris: data, periksaSaja }),
      });
      const d = (await res.json().catch(() => ({}))) as Ringkas & { error?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Berkas gagal diproses");
        return;
      }
      if (periksaSaja) {
        setPeriksa(d);
        return;
      }
      onSelesai(
        `${d.sah} data pegawai masuk ke daftar Perlu dikerjakan` +
          (d.belumLengkap > 0 ? `, ${d.belumLengkap} di antaranya masih perlu dilengkapi` : "") +
          (d.gagal > 0 ? `. ${d.gagal} baris ditolak dan tidak tersimpan` : ".") ,
      );
    } catch {
      setGalat("Berkas gagal diproses");
    } finally {
      setSibuk(false);
    }
  }

  const siap = !!baris && !!periksa && periksa.sah > 0;

  return (
    <KerangkaModal
      judul="Unggah daftar pegawai"
      subjudul="Satu berkas berisi banyak pegawai sekaligus"
      ukuran="md"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => { if (siap && baris) void kirim(baris, false); }}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk || !siap}>
            {sibuk ? "Memproses…" : periksa ? `Simpan ${periksa.sah} data` : "Pilih berkas dulu"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />
      <Catatan>
        Isi templat CSV di bawah, satu baris untuk satu pegawai. Isinya masuk sebagai data yang disiapkan,
        belum terkirim: setelah ini lengkapi yang masih kurang, lalu ajukan bersama satu surat usulan. Kolom
        unit kerja pada berkas diabaikan, sebab satkernya mengikuti akun ini.
      </Catatan>

      <div className="kgbm-data">
        <div className="kgbm-data-kepala">
          <span>Templat CSV</span>
          <button type="button" className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil" onClick={unduhTemplat}>
            Unduh templat
          </button>
        </div>
        <details className="kgbm-panduan">
          <summary>Panduan kolom ({KOLOM_TEMPLAT_UPT.length} kolom)</summary>
          <dl>
            {KOLOM_TEMPLAT_UPT.map((k) => (
              <div className="kgbm-data-baris" key={k.kolom}>
                <dt>
                  <code>{k.kolom}</code>
                  <br />
                  <span data-peran={k.peran}>{LABEL_PERAN[k.peran]}</span>
                </dt>
                <dd>
                  {k.keterangan}
                  {k.contoh && <> Contoh: <code>{k.contoh}</code></>}
                </dd>
              </div>
            ))}
          </dl>
          <p className="kgbm-bantuan">
            Tanggal ditulis {FORMAT_TANGGAL_DITERIMA}. Baris contoh di templat fiktif: hapus sebelum mengunggah.
            Nomor SK dan pindaian berkas tidak lewat CSV; keduanya dilengkapi per pegawai sebelum diajukan.
            Berkas yang disimpan Excel dengan pemisah titik koma tetap terbaca.
          </p>
        </details>
      </div>

      <label className="kgbm-label">
        Berkas CSV
        <input
          className="kgbm-input"
          type="file"
          accept=".csv,text/csv"
          data-autofocus
          onChange={(e) => pilihBerkas(e.target.files?.[0] ?? null)}
        />
        <span className="kgbm-bantuan">
          Paling banyak {BATAS_BARIS_IMPOR} baris sekali unggah. Pangkat, gaji pokok, dan TMT KGB berikutnya tidak
          perlu diisi: ketiganya dihitung sistem dari golongan, masa kerja golongan, dan TMT KGB terakhir.
        </span>
      </label>

      {periksa && (
        <>
          <div className="kgbm-hitungan">
            <p className="kgbm-hitungan-judul">Hasil pemeriksaan {namaBerkas}</p>
            <dl>
              <div><dt>Siap disimpan</dt><dd>{periksa.sah}</dd></div>
              <div><dt>Perlu dilengkapi</dt><dd>{periksa.belumLengkap}</dd></div>
              <div><dt>Ditolak</dt><dd>{periksa.gagal}</dd></div>
            </dl>
            {periksa.belumLengkap > 0 && (
              <p className="kgbm-hitungan-ket">
                Yang belum lengkap tetap disimpan sebagai draf dan muncul di daftar Perlu dikerjakan beserta
                apa yang kurang. Kelengkapannya baru ditagih saat diajukan ke Kanwil.
              </p>
            )}
          </div>
          {periksa.galat.length > 0 && (
            <Catatan nada="amber">
              Baris berikut tidak akan disimpan. Betulkan di berkasnya lalu unggah ulang bagian itu saja.
              <ul className="dsb-jadwal" style={{ margin: "6px 0 0", paddingLeft: 16, listStyle: "disc" }}>
                {periksa.galat.slice(0, 20).map((g) => (
                  <li key={g}><span>{g}</span></li>
                ))}
              </ul>
              {periksa.galat.length > 20 && <p style={{ margin: "6px 0 0" }}>dan {periksa.galat.length - 20} baris lainnya.</p>}
            </Catatan>
          )}
        </>
      )}
    </KerangkaModal>
  );
}
