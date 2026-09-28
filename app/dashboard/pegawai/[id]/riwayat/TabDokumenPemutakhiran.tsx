"use client";

import { useCallback, useEffect, useState } from "react";
import ModalKenaikanPangkat from "@/app/dashboard/components/ModalKenaikanPangkat";
import ModalPmk from "@/app/dashboard/components/ModalPmk";
import { ModalPratinjauBerkas } from "@/app/dashboard/components/kgb";
import {
  BATAS_DOKUMEN_BYTE,
  JENIS_DOKUMEN,
  LABEL_SUMBER_DOKUMEN,
  type DokumenPegawai,
  type JenisDokumen,
  type SumberDokumen,
} from "@/lib/dokumenPegawai";
import KartuKiriman, { type PegawaiLengkap, type Pemutakhiran } from "@/app/dashboard/components/inventarisasi/KartuKiriman";
import { formatTanggalId } from "@/lib/waktu";

/* Tab "Dokumen & Pemutakhiran" di halaman pegawai (ADR-023): kiriman formulir pemutakhiran data dibandingkan dengan
   Data Pegawai, status tindak lanjutnya, penerapan isian yang berbeda, dan semua dokumen pegawai (arsip unggahan,
   SK KGB, berkas usulan UPT, berkas formulir) yang dapat dipratinjau di halaman. Golongan dan masa kerja diterapkan
   lewat Catat kenaikan pangkat atau PMK, supaya riwayat dan jadwal KGB tetap konsisten. */

const ukuranTeks = (b: number | null) =>
  b === null ? "" : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
const tanggalTeks = (v: string) => (v ? formatTanggalId(v) : "");

export default function TabDokumenPemutakhiran({
  pegawaiId,
  bolehUbah,
  onDataBerubah,
}: {
  pegawaiId: string;
  /** Peran yang boleh mengubah Data Pegawai dan mencatat kenaikan pangkat atau PMK. */
  bolehUbah: boolean;
  onDataBerubah: () => void;
}) {
  const [pegawai, setPegawai] = useState<PegawaiLengkap | null>(null);
  const [daftar, setDaftar] = useState<Pemutakhiran[] | null>(null);
  const [dokumen, setDokumen] = useState<DokumenPegawai[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [pratinjau, setPratinjau] = useState<DokumenPegawai | null>(null);
  const [modal, setModal] = useState<{ jenis: "kp" | "pmk"; p: Pemutakhiran } | null>(null);

  const muat = useCallback(async () => {
    try {
      const [rp, rm, rd] = await Promise.all([
        fetch(`/api/pegawai/${pegawaiId}`, { cache: "no-store" }),
        fetch(`/api/pegawai/${pegawaiId}/pemutakhiran`, { cache: "no-store" }),
        fetch(`/api/pegawai/${pegawaiId}/dokumen`, { cache: "no-store" }),
      ]);
      if (!rp.ok || !rm.ok || !rd.ok) throw new Error("Dokumen dan pemutakhiran gagal dimuat.");
      setPegawai((await rp.json()) as PegawaiLengkap);
      setDaftar((await rm.json()) as Pemutakhiran[]);
      setDokumen((await rd.json()) as DokumenPegawai[]);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Dokumen dan pemutakhiran gagal dimuat.");
    }
  }, [pegawaiId]);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  function berhasil(teks: string) {
    setGalat(null);
    setPesan(teks);
    onDataBerubah();
    void muat();
  }

  return (
    <div className="flex flex-col gap-4">
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

      <section className="dsb-panel" aria-labelledby="judul-pemutakhiran">
        <div className="dsb-panel-kepala">
          <h2 id="judul-pemutakhiran" className="dsb-panel-judul">
            Pemutakhiran data <small>dari formulir inventarisasi</small>
          </h2>
        </div>
        {!daftar || !pegawai ? (
          <p className="dsb-kosong">Memuat…</p>
        ) : daftar.length === 0 ? (
          <p className="dsb-kosong">
            Pegawai ini belum mengirim formulir pemutakhiran data. Kiriman dari formulir inventarisasi KGB akan tampil di
            sini untuk dicocokkan dengan Data Pegawai.
          </p>
        ) : (
          daftar.map((p) => (
            <KartuKiriman
              // Disusun ulang setiap kiriman atau tindak lanjutnya berubah, supaya isian status mengikuti yang tersimpan.
              key={`${p.kegiatan.id}-${p.kiriman.waktu}-${p.kiriman.tindakLanjut?.at ?? ""}`}
              p={p}
              pegawai={pegawai}
              bolehUbah={bolehUbah}
              onGalat={setGalat}
              onBerhasil={berhasil}
              onCatat={(jenis) => setModal({ jenis, p })}
            />
          ))
        )}
      </section>

      <BagianDokumen
        pegawaiId={pegawaiId}
        dokumen={dokumen}
        onLihat={setPratinjau}
        onGalat={setGalat}
        onBerhasil={berhasil}
      />

      {pratinjau && (
        <ModalPratinjauBerkas
          judul={pratinjau.judul}
          subjudul={[pratinjau.nomorSK, tanggalTeks(pratinjau.tanggal), LABEL_SUMBER_DOKUMEN[pratinjau.sumber]].filter(Boolean).join(" · ")}
          url={pratinjau.url}
          onTutup={() => setPratinjau(null)}
        />
      )}

      {modal && pegawai && modal.jenis === "kp" && (
        <ModalKenaikanPangkat
          pegawai={pegawai}
          awal={{
            golonganBaru: modal.p.kiriman.isian.golonganRuang !== pegawai.golonganRuang ? modal.p.kiriman.isian.golonganRuang : "",
            tanggalSK: modal.p.kiriman.isian.keadaan === "pernah" ? modal.p.kiriman.isian.tanggalSkPendukung : "",
            tmtPangkat: modal.p.kiriman.isian.tmtGolongan,
          }}
          onTutup={() => setModal(null)}
          onBerhasil={(teks) => {
            setModal(null);
            berhasil(teks);
          }}
        />
      )}
      {modal && pegawai && modal.jenis === "pmk" && (
        <ModalPmk
          pegawai={pegawai}
          awal={{
            tanggalSK: modal.p.kiriman.isian.tanggalSkPmk,
            tmtPmk: modal.p.kiriman.isian.tmtPmk,
            mkgTahunSk: modal.p.kiriman.isian.mkgTahun,
            mkgBulanSk: modal.p.kiriman.isian.mkgBulan,
          }}
          onTutup={() => setModal(null)}
          onBerhasil={(teks) => {
            setModal(null);
            berhasil(teks);
          }}
        />
      )}
    </div>
  );
}


const URUTAN_SUMBER: SumberDokumen[] = ["arsip", "sk_kgb", "inventaris", "usulan"];

function BagianDokumen({
  pegawaiId,
  dokumen,
  onLihat,
  onGalat,
  onBerhasil,
}: {
  pegawaiId: string;
  dokumen: DokumenPegawai[] | null;
  onLihat: (d: DokumenPegawai) => void;
  onGalat: (g: string | null) => void;
  onBerhasil: (teks: string) => void;
}) {
  const [jenis, setJenis] = useState<JenisDokumen>("sk_pangkat");
  const [nomorSK, setNomorSK] = useState("");
  const [tanggalSK, setTanggalSK] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [berkas, setBerkas] = useState<File | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [kunciInput, setKunciInput] = useState(0);

  async function unggah() {
    if (!berkas) return;
    if (berkas.size > BATAS_DOKUMEN_BYTE) {
      onGalat("Ukuran dokumen paling besar 5 MB.");
      return;
    }
    setSibuk(true);
    onGalat(null);
    try {
      const form = new FormData();
      form.set("jenis", jenis);
      form.set("nomorSK", nomorSK);
      form.set("tanggalSK", tanggalSK);
      form.set("keterangan", keterangan);
      form.set("berkas", berkas);
      const res = await fetch(`/api/pegawai/${pegawaiId}/dokumen`, { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Dokumen gagal diunggah.");
      setNomorSK("");
      setTanggalSK("");
      setKeterangan("");
      setBerkas(null);
      setKunciInput((k) => k + 1);
      onBerhasil(`${JENIS_DOKUMEN[jenis]} diunggah ke arsip dokumen pegawai.`);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Dokumen gagal diunggah.");
    } finally {
      setSibuk(false);
    }
  }

  async function hapus(d: DokumenPegawai) {
    if (!window.confirm(`Hapus ${d.judul}${d.nomorSK ? ` ${d.nomorSK}` : ""} dari arsip dokumen?`)) return;
    const res = await fetch(`/api/pegawai/${pegawaiId}/dokumen/${encodeURIComponent(d.id.replace(/^arsip-/, ""))}`, { method: "DELETE" });
    if (res.ok) onBerhasil(`${d.judul} dihapus dari arsip dokumen.`);
    else onGalat("Dokumen gagal dihapus.");
  }

  const urut = [...(dokumen ?? [])].sort(
    (a, b) => URUTAN_SUMBER.indexOf(a.sumber) - URUTAN_SUMBER.indexOf(b.sumber) || (b.tanggal || "").localeCompare(a.tanggal || ""),
  );

  return (
    <section className="dsb-panel" aria-labelledby="judul-dokumen">
      <div className="dsb-panel-kepala">
        <h2 id="judul-dokumen" className="dsb-panel-judul">
          Dokumen pegawai <small>{dokumen ? `${dokumen.length} berkas` : ""}</small>
        </h2>
      </div>

      <div className="inv-atur pmh-unggah">
        <label className="inv-bidang">
          <span>Jenis dokumen</span>
          <select className="dsb-cari" value={jenis} onChange={(e) => setJenis(e.target.value as JenisDokumen)}>
            {(Object.keys(JENIS_DOKUMEN) as JenisDokumen[]).map((j) => (
              <option key={j} value={j}>{JENIS_DOKUMEN[j]}</option>
            ))}
          </select>
        </label>
        <label className="inv-bidang">
          <span>Nomor SK</span>
          <input className="dsb-cari" value={nomorSK} onChange={(e) => setNomorSK(e.target.value)} placeholder="Sesuai dokumen" />
        </label>
        <label className="inv-bidang">
          <span>Tanggal SK</span>
          <input type="date" className="dsb-cari" value={tanggalSK} onChange={(e) => setTanggalSK(e.target.value)} />
        </label>
        <span />
        <label className="inv-bidang inv-lebar-2">
          <span>Berkas PDF (paling besar 5 MB)</span>
          <input
            key={kunciInput}
            type="file"
            accept="application/pdf,.pdf"
            className="dsb-cari"
            onChange={(e) => setBerkas(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="inv-bidang">
          <span>Keterangan</span>
          <input className="dsb-cari" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="opsional" />
        </label>
        <button type="button" className="dsb-tombol" disabled={sibuk || !berkas} onClick={() => void unggah()}>
          {sibuk ? "Mengunggah…" : "Unggah"}
        </button>
      </div>

      {!dokumen ? (
        <p className="dsb-kosong">Memuat…</p>
      ) : urut.length === 0 ? (
        <p className="dsb-kosong">Belum ada dokumen. Unggah SK pegawai di atas, atau dokumen akan tampil dari SK KGB, usulan UPT, dan formulir.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="dsb-tabel">
            <thead>
              <tr>
                <th scope="col">Dokumen</th>
                <th scope="col">Nomor dan tanggal</th>
                <th scope="col">Sumber</th>
                <th scope="col" className="kanan">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {urut.map((d) => (
                <tr key={d.id}>
                  <td>
                    <p className="dsb-nama" style={{ margin: 0 }}>{d.judul}</p>
                    {d.keterangan && <p className="dsb-kecil" style={{ margin: 0 }}>{d.keterangan}</p>}
                  </td>
                  <td className="dsb-kecil">
                    {d.nomorSK || "-"}
                    {d.tanggal && <span style={{ display: "block" }}>{tanggalTeks(d.tanggal)}</span>}
                  </td>
                  <td className="dsb-kecil">
                    {LABEL_SUMBER_DOKUMEN[d.sumber]}
                    {d.ukuran !== null && <span style={{ display: "block" }}>{ukuranTeks(d.ukuran)}</span>}
                  </td>
                  <td className="kanan whitespace-nowrap">
                    <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => onLihat(d)}>
                      Lihat
                    </button>
                    {d.bisaHapus && (
                      <button type="button" className="dsb-ikon-tombol" data-nada="merah" aria-label={`Hapus ${d.judul}`} onClick={() => void hapus(d)} style={{ marginLeft: 6 }}>
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
  );
}
