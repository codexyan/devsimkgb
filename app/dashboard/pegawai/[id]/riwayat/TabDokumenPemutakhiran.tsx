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

/** Label sumber yang ringkas untuk saringan. */
const SUMBER_RINGKAS: Record<SumberDokumen, string> = {
  arsip: "Arsip",
  sk_kgb: "SK KGB",
  inventaris: "Formulir",
  usulan: "Usulan UPT",
};

/* Dokumen pegawai: kartu per berkas yang dapat disaring menurut sumbernya dan dipratinjau di halaman. Panel unggah
   disembunyikan di balik tombol Unggah dokumen supaya daftar berkasnya yang tampil lebih dulu; bila belum ada
   dokumen sama sekali, panel itu langsung terbuka. Daftar tidak diberi gulir sendiri: halaman yang bergulir. */
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
  const [bukaUnggah, setBukaUnggah] = useState<boolean | null>(null);
  const [saring, setSaring] = useState<"semua" | SumberDokumen>("semua");
  const [seret, setSeret] = useState(false);

  // Terbuka sendiri bila belum ada dokumen, sampai pengguna menutup atau membukanya.
  const unggahTerbuka = bukaUnggah ?? (dokumen !== null && dokumen.length === 0);

  function kosongkan() {
    setNomorSK("");
    setTanggalSK("");
    setKeterangan("");
    setBerkas(null);
    setKunciInput((k) => k + 1);
  }

  function pilihBerkas(f: File | null | undefined) {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      onGalat("Dokumen harus berupa PDF.");
      return;
    }
    if (f.size > BATAS_DOKUMEN_BYTE) {
      onGalat("Ukuran dokumen paling besar 5 MB.");
      return;
    }
    onGalat(null);
    setBerkas(f);
  }

  async function unggah() {
    if (!berkas) return;
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
      kosongkan();
      setBukaUnggah(false);
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
  const ada = URUTAN_SUMBER.filter((s) => urut.some((d) => d.sumber === s));
  const tampil = urut.filter((d) => saring === "semua" || d.sumber === saring);

  return (
    <section className="dsb-panel" aria-labelledby="judul-dokumen">
      <div className="dsb-panel-kepala dok-kepala">
        <h2 id="judul-dokumen" className="dsb-panel-judul">
          Dokumen pegawai <small>{dokumen ? `${dokumen.length} berkas` : ""}</small>
        </h2>
        <button
          type="button"
          className="dsb-tombol"
          data-jenis={unggahTerbuka ? "garis" : undefined}
          aria-expanded={unggahTerbuka}
          aria-controls="dok-unggah"
          onClick={() => setBukaUnggah(!unggahTerbuka)}
        >
          {unggahTerbuka ? "Tutup unggah" : "+ Unggah dokumen"}
        </button>
      </div>

      {unggahTerbuka && (
        <div id="dok-unggah" className="dok-unggah">
          <label
            className="dok-lepas"
            data-seret={seret ? "" : undefined}
            data-isi={berkas ? "" : undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setSeret(true);
            }}
            onDragLeave={() => setSeret(false)}
            onDrop={(e) => {
              e.preventDefault();
              setSeret(false);
              pilihBerkas(e.dataTransfer.files?.[0]);
            }}
          >
            <input key={kunciInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pilihBerkas(e.target.files?.[0])} />
            <span className="dok-ikon" aria-hidden="true">PDF</span>
            {berkas ? (
              <span className="dok-lepas-teks">
                <strong>{berkas.name}</strong>
                <span>{ukuranTeks(berkas.size)} · klik untuk mengganti</span>
              </span>
            ) : (
              <span className="dok-lepas-teks">
                <strong>Pilih berkas PDF</strong>
                <span>atau tarik ke sini · paling besar 5 MB</span>
              </span>
            )}
          </label>
          <div className="dok-unggah-isian">
            <label className="pmh-bidang">
              <span>Jenis dokumen</span>
              <select className="dsb-cari" value={jenis} onChange={(e) => setJenis(e.target.value as JenisDokumen)}>
                {(Object.keys(JENIS_DOKUMEN) as JenisDokumen[]).map((j) => (
                  <option key={j} value={j}>{JENIS_DOKUMEN[j]}</option>
                ))}
              </select>
            </label>
            <label className="pmh-bidang">
              <span>Nomor SK</span>
              <input className="dsb-cari" value={nomorSK} onChange={(e) => setNomorSK(e.target.value)} placeholder="Sesuai dokumen" />
            </label>
            <label className="pmh-bidang">
              <span>Tanggal SK</span>
              <input type="date" className="dsb-cari" value={tanggalSK} onChange={(e) => setTanggalSK(e.target.value)} />
            </label>
            <label className="pmh-bidang">
              <span>Keterangan</span>
              <input className="dsb-cari" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="opsional" />
            </label>
          </div>
          <div className="dok-unggah-tombol">
            <button
              type="button"
              className="dsb-tombol"
              data-jenis="garis"
              disabled={sibuk}
              onClick={() => {
                kosongkan();
                setBukaUnggah(false);
              }}
            >
              Batal
            </button>
            <button type="button" className="dsb-tombol" disabled={sibuk || !berkas} onClick={() => void unggah()}>
              {sibuk ? "Mengunggah…" : "Unggah ke arsip"}
            </button>
          </div>
        </div>
      )}

      {ada.length > 1 && (
        <div className="dok-saring">
          <div className="dsb-segmen" role="group" aria-label="Saring sumber dokumen">
            <button type="button" aria-pressed={saring === "semua"} onClick={() => setSaring("semua")}>
              Semua <small>{urut.length}</small>
            </button>
            {ada.map((s) => (
              <button key={s} type="button" aria-pressed={saring === s} onClick={() => setSaring(s)}>
                {SUMBER_RINGKAS[s]} <small>{urut.filter((d) => d.sumber === s).length}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {!dokumen ? (
        <p className="dsb-kosong">Memuat…</p>
      ) : tampil.length === 0 ? (
        <p className="dsb-kosong">
          Belum ada dokumen. Unggah SK pegawai, atau dokumen akan tampil sendiri dari SK KGB, usulan UPT, dan formulir
          inventarisasi.
        </p>
      ) : (
        <ul className="dok-kisi">
          {tampil.map((d) => (
            <li key={d.id} className="dok-kartu" data-sumber={d.sumber}>
              <button type="button" className="dok-buka" onClick={() => onLihat(d)} aria-label={`Lihat ${d.judul}`}>
                <span className="dok-ikon" aria-hidden="true">PDF</span>
                <span className="dok-teks">
                  <strong>{d.judul}</strong>
                  <span className="dok-nomor">{d.nomorSK || "Tanpa nomor SK"}</span>
                  <span className="dok-meta">
                    {[d.tanggal ? tanggalTeks(d.tanggal) : "", ukuranTeks(d.ukuran)].filter(Boolean).join(" · ") || "–"}
                  </span>
                </span>
              </button>
              {d.keterangan && <p className="dok-ket">{d.keterangan}</p>}
              <div className="dok-kaki">
                <span className="dok-sumber" data-sumber={d.sumber}>{LABEL_SUMBER_DOKUMEN[d.sumber]}</span>
                <span className="dok-aksi">
                  <button type="button" className="dok-tombol" onClick={() => onLihat(d)}>Lihat</button>
                  {d.bisaHapus && (
                    <button type="button" className="dok-tombol" data-nada="merah" onClick={() => void hapus(d)} aria-label={`Hapus ${d.judul}`}>
                      Hapus
                    </button>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
