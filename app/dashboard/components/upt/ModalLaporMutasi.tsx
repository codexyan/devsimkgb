"use client";

import { useState } from "react";
import { KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import {
  ALASAN_PEMBERHENTIAN,
  KETERANGAN_JENIS_MUTASI,
  LABEL_JENIS_MUTASI,
  kekuranganMutasi,
  type JenisMutasi,
} from "@/lib/mutasiPegawai";
import { SATKER } from "@/lib/satker";
import { hariIniWita, isoTanggalLokal } from "@/lib/waktu";

/* Laporan mutasi dan pemberhentian dari UPT.
   Satker yang paling dulu tahu pegawainya pindah, pensiun, atau meninggal, tetapi yang menetapkan tetap
   Kanwil. Karena itu jendela ini tidak mengubah apa pun pada data pegawai: yang dikirim adalah laporan,
   dan pegawainya baru berpindah atau berhenti setelah Kanwil menerimanya. */

const JENIS: JenisMutasi[] = ["definitif", "bko", "selesai_bko", "pemberhentian"];

export default function ModalLaporMutasi({
  pegawai,
  onTutup,
  onSelesai,
}: {
  pegawai: { id: string; nama: string; nip: string };
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const [jenis, setJenis] = useState<JenisMutasi>("definitif");
  const [satkerTujuan, setSatkerTujuan] = useState("");
  const [tmt, setTmt] = useState(isoTanggalLokal(hariIniWita()));
  const [nomorSk, setNomorSk] = useState("");
  const [tanggalSk, setTanggalSk] = useState("");
  const [alasan, setAlasan] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const perluSatker = jenis === "definitif" || jenis === "bko";
  const kurang = kekuranganMutasi({ jenis, satkerTujuan, tmt, nomorSk, alasan });

  async function kirim() {
    if (kurang.length > 0) {
      setGalat(`Belum lengkap: ${kurang.join(", ")}.`);
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch("/api/upt/mutasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pegawaiId: pegawai.id,
          jenis,
          satkerTujuan: perluSatker ? satkerTujuan : "",
          tmt, nomorSk, tanggalSk, alasan, keterangan,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setGalat(d.error ?? "Laporan gagal dikirim"); return; }
      onSelesai(`Laporan ${LABEL_JENIS_MUTASI[jenis].toLowerCase()} ${pegawai.nama} terkirim ke Kanwil.`);
    } catch {
      setGalat("Laporan gagal dikirim");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KerangkaModal
      judul="Laporkan mutasi atau pemberhentian"
      subjudul={`${pegawai.nama} · ${pegawai.nip}`}
      ukuran="md"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void kirim()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
            {sibuk ? "Mengirim…" : "Kirim laporan"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />
      <Catatan>
        Laporan ini belum mengubah data pegawai. Kanwil yang menetapkannya setelah mencocokkan dengan SK,
        dan sampai saat itu pegawainya tetap muncul di daftar satker ini.
      </Catatan>

      <label className="kgbm-label">
        Jenis laporan
        <select className="kgbm-input" value={jenis} onChange={(e) => setJenis(e.target.value as JenisMutasi)}>
          {JENIS.map((j) => (
            <option key={j} value={j}>{LABEL_JENIS_MUTASI[j]}</option>
          ))}
        </select>
      </label>
      <Catatan nada={jenis === "pemberhentian" ? "amber" : "netral"}>{KETERANGAN_JENIS_MUTASI[jenis]}</Catatan>

      <div className="kgbm-grid2">
        {perluSatker && (
          <label className="kgbm-label">
            <span className="kgbm-wajib">Satker tujuan</span>
            <select className="kgbm-input" value={satkerTujuan} onChange={(e) => setSatkerTujuan(e.target.value)}>
              <option value="">Pilih satker</option>
              {SATKER.map((s) => (
                <option key={s.kode} value={s.kode}>{s.nama}</option>
              ))}
            </select>
          </label>
        )}
        {jenis === "pemberhentian" && (
          <label className="kgbm-label">
            <span className="kgbm-wajib">Alasan</span>
            <select className="kgbm-input" value={alasan} onChange={(e) => setAlasan(e.target.value)}>
              <option value="">Pilih alasan</option>
              {ALASAN_PEMBERHENTIAN.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
        )}
        <label className="kgbm-label">
          <span className="kgbm-wajib">TMT berlaku</span>
          <input className="kgbm-input" type="date" value={tmt} onChange={(e) => setTmt(e.target.value)} />
          <span className="kgbm-bantuan">
            {jenis === "pemberhentian"
              ? "KGB yang TMT-nya sebelum tanggal ini tetap sah diproses."
              : "Tanggal berlakunya perpindahan menurut SK."}
          </span>
        </label>
        <label className="kgbm-label">
          <span className="kgbm-wajib">Nomor SK</span>
          <input className="kgbm-input" value={nomorSk} onChange={(e) => setNomorSk(e.target.value)} placeholder="Nomor SK yang mendasari" />
        </label>
        <label className="kgbm-label">
          Tanggal SK
          <input className="kgbm-input" type="date" value={tanggalSk} onChange={(e) => setTanggalSk(e.target.value)} />
        </label>
      </div>

      <label className="kgbm-label">
        Keterangan
        <textarea className="kgbm-input" rows={2} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
      </label>
    </KerangkaModal>
  );
}
