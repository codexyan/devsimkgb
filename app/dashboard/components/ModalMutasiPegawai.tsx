"use client";

import { useEffect, useState } from "react";
import { KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import {
  ALASAN_PEMBERHENTIAN,
  KETERANGAN_JENIS_MUTASI,
  LABEL_JENIS_MUTASI,
  kekuranganMutasi,
  type JenisMutasi,
} from "@/lib/mutasiPegawai";
import { SATKER } from "@/lib/satker";
import { formatTanggalId, hariIniWita, isoTanggalLokal } from "@/lib/waktu";

/* Pencatatan mutasi dan pemberhentian seorang pegawai.
   Pegawai tidak pernah dihapus di sini: yang dicatat adalah peristiwanya beserta TMT dan SK-nya, dan
   data induk hanya berubah seperlunya. BKO tidak memindahkan unit kerja, sebab gaji pegawai BKO tetap
   dibayar satker asal. */

interface RiwayatMutasi {
  id: string;
  label: string;
  satkerAsal: string | null;
  satkerTujuan: string | null;
  tmt: string | null;
  nomorSK: string | null;
  alasan: string | null;
  createdBy: string | null;
}

const JENIS: JenisMutasi[] = ["definitif", "bko", "selesai_bko", "pemberhentian"];

export default function ModalMutasiPegawai({
  pegawai,
  onTutup,
  onBerhasil,
}: {
  pegawai: { id: string; nama: string; nip: string; unitKerja: string | null; satkerTugas?: string | null };
  onTutup: () => void;
  onBerhasil: (pesan: string) => void;
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
  const [riwayat, setRiwayat] = useState<RiwayatMutasi[]>([]);

  useEffect(() => {
    let batal = false;
    fetch(`/api/pegawai/${pegawai.id}/mutasi`)
      .then((r) => (r.ok ? (r.json() as Promise<RiwayatMutasi[]>) : []))
      .catch(() => [])
      .then((d) => { if (!batal && Array.isArray(d)) setRiwayat(d); });
    return () => { batal = true; };
  }, [pegawai.id]);

  const perluSatker = jenis === "definitif" || jenis === "bko";
  const kurang = kekuranganMutasi({ jenis, satkerTujuan, tmt, nomorSk, alasan });

  async function simpan() {
    if (kurang.length > 0) {
      setGalat(`Belum lengkap: ${kurang.join(", ")}.`);
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/pegawai/${pegawai.id}/mutasi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenis, satkerTujuan: perluSatker ? satkerTujuan : "", tmt, nomorSk, tanggalSk, alasan, keterangan }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; label?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Pencatatan gagal disimpan");
        return;
      }
      onBerhasil(`${d.label ?? LABEL_JENIS_MUTASI[jenis]} ${pegawai.nama} tercatat, berlaku ${formatTanggalId(tmt)}.`);
    } catch {
      setGalat("Pencatatan gagal disimpan");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KerangkaModal
      judul="Mutasi dan pemberhentian"
      subjudul={`${pegawai.nama} · ${pegawai.nip}`}
      ukuran="md"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void simpan()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Catat"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />

      <label className="kgbm-label">
        Jenis pencatatan
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

      <div className="kgbm-bagian">
        <div className="kgbm-bagian-kepala">
          <p className="kgbm-bagian-judul">Riwayat</p>
          <p className="kgbm-bagian-ket">
            Satker sekarang: {pegawai.unitKerja ?? "-"}
            {pegawai.satkerTugas ? ` · BKO di ${pegawai.satkerTugas}` : ""}
          </p>
        </div>
        <div className="kgbm-bagian-isi">
          {riwayat.length === 0 ? (
            <p className="dsb-kecil" style={{ margin: 0 }}>Belum ada mutasi atau pemberhentian yang tercatat.</p>
          ) : (
            <ul className="dsb-log-ringkas">
              {riwayat.map((r) => (
                <li key={r.id}>
                  <span className="dsb-titik" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="dsb-nama">{r.label}</span>
                    <span className="dsb-kecil"> · {r.tmt ? formatTanggalId(r.tmt) : "tanpa TMT"}</span>
                    <p className="dsb-kecil" style={{ margin: 0 }}>
                      {r.satkerTujuan ? `ke ${r.satkerTujuan} · ` : ""}
                      {r.alasan ? `${r.alasan} · ` : ""}
                      SK {r.nomorSK ?? "-"}
                    </p>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </KerangkaModal>
  );
}
