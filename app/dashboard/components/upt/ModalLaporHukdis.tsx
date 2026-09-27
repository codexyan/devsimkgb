"use client";

import { useState } from "react";
import { KerangkaModal, Catatan, ModalPratinjauBerkas, PesanGalat } from "@/app/dashboard/components/kgb";
import KolomBerkas from "./KolomBerkas";
import { galatTanggalLaporanHukdis, kekuranganLaporanHukdis } from "@/lib/laporanHukdis";
import { tmtBerakhirOtomatis } from "@/lib/hukdisJenis";

/* Laporan hukuman disiplin dari UPT (ADR-016).
   UPT memegang SK hukumannya, tetapi yang mencatat dan menggeser KGB tetap SDM Hukdis Kanwil. Jendela ini
   karena itu tidak mengubah apa pun pada data pegawai: yang dikirim adalah laporan beserta pindaian SK,
   dan hukumannya baru berlaku di SIM-KGB setelah Kanwil mencatatnya. */

export interface PegawaiHukdisUpt {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
}

export interface JenisHukdisUpt {
  kode: string;
  label: string;
  kategori: string;
  durasiHukdis: number;
}

/** Laporan yang dikembalikan Kanwil; isinya menjadi isian awal kiriman ulang. */
export interface LaporanHukdisAwal {
  id: string;
  pegawaiId: string;
  jenisHukdis: string;
  nomorSK: string | null;
  tanggalSK: string | null;
  tmtMulai: string | null;
  tmtBerakhir: string | null;
  keterangan: string | null;
  berkas: { nama: string | null } | null;
  catatanKanwil: string | null;
}

const LABEL_KATEGORI: Record<string, string> = { ringan: "Ringan", sedang: "Sedang", berat: "Berat" };
const tanggalIsian = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export default function ModalLaporHukdis({
  pegawai,
  jenis,
  awal,
  pegawaiAwal,
  onTutup,
  onSelesai,
}: {
  pegawai: PegawaiHukdisUpt[];
  jenis: JenisHukdisUpt[];
  /** Diisi saat mengirim ulang laporan yang dikembalikan. */
  awal: LaporanHukdisAwal | null;
  /** Pegawai yang langsung terpilih, mis. dari tautan di Data Pegawai. */
  pegawaiAwal?: string | null;
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const [pegawaiId, setPegawaiId] = useState(awal?.pegawaiId ?? pegawaiAwal ?? "");
  const [cari, setCari] = useState("");
  const [jenisHukdis, setJenisHukdis] = useState(awal?.jenisHukdis ?? "");
  const [nomorSK, setNomorSK] = useState(awal?.nomorSK ?? "");
  const [tanggalSK, setTanggalSK] = useState(tanggalIsian(awal?.tanggalSK ?? null));
  const [tmtMulai, setTmtMulai] = useState(tanggalIsian(awal?.tmtMulai ?? null));
  const [tmtBerakhir, setTmtBerakhir] = useState(tanggalIsian(awal?.tmtBerakhir ?? null));
  // TMT berakhir diisi otomatis dari masa hukuman jenisnya sampai operator mengetiknya sendiri.
  const [berakhirDiketik, setBerakhirDiketik] = useState(!!awal?.tmtBerakhir);
  const [keterangan, setKeterangan] = useState(awal?.keterangan ?? "");
  const [berkas, setBerkas] = useState<File | null>(null);
  const [hapusBawaan, setHapusBawaan] = useState(false);
  const [pratinjau, setPratinjau] = useState<{ judul: string; url: string; lokal: boolean } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const dipilih = pegawai.find((p) => p.id === pegawaiId) ?? null;
  const q = cari.trim().toLowerCase();
  const pilihanPegawai = q ? pegawai.filter((p) => p.nama.toLowerCase().includes(q) || p.nip.includes(q)) : pegawai;
  const bawaan = awal?.berkas && !hapusBawaan ? awal.berkas : null;

  function isiBerakhir(kode: string, mulai: string) {
    if (berakhirDiketik) return;
    const j = jenis.find((x) => x.kode === kode);
    setTmtBerakhir(j && j.durasiHukdis > 0 && mulai ? tmtBerakhirOtomatis(mulai, j.durasiHukdis) : "");
  }

  function tutupPratinjau() {
    if (pratinjau?.lokal) URL.revokeObjectURL(pratinjau.url);
    setPratinjau(null);
  }

  async function kirim() {
    if (!dipilih) {
      setGalat("Pilih pegawai yang dilaporkan.");
      return;
    }
    const isian = { jenisHukdis, nomorSK, tanggalSK, tmtMulai, tmtBerakhir, adaBerkas: !!berkas || !!bawaan };
    const kurang = kekuranganLaporanHukdis(isian);
    if (kurang.length > 0) {
      setGalat(`Belum lengkap: ${kurang.join(", ")}.`);
      return;
    }
    const galatTanggal = galatTanggalLaporanHukdis(isian);
    if (galatTanggal) {
      setGalat(galatTanggal);
      return;
    }
    setSibuk(true);
    setGalat(null);
    const form = new FormData();
    form.set("pegawaiId", dipilih.id);
    form.set("jenisHukdis", jenisHukdis);
    form.set("nomorSK", nomorSK);
    form.set("tanggalSK", tanggalSK);
    form.set("tmtMulai", tmtMulai);
    form.set("tmtBerakhir", tmtBerakhir);
    form.set("keterangan", keterangan);
    if (berkas) form.set("skHukdis", berkas);
    if (awal) form.set("gantikan", awal.id);
    try {
      const res = await fetch("/api/upt/hukdis", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Laporan gagal dikirim");
        return;
      }
      onSelesai(`Laporan hukuman disiplin ${dipilih.nama} ${awal ? "dikirim ulang" : "terkirim"} ke SDM Hukdis Kanwil.`);
    } catch {
      setGalat("Laporan gagal dikirim. Periksa sambungan lalu coba lagi.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KerangkaModal
      judul={awal ? "Kirim ulang laporan hukuman disiplin" : "Laporkan hukuman disiplin"}
      subjudul={dipilih ? `${dipilih.nama} · ${dipilih.nip}` : "Ditinjau dan dicatat SDM Hukdis Kanwil"}
      ukuran="md"
      nada="amber"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void kirim()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
            {sibuk ? "Mengirim…" : awal ? "Kirim ulang" : "Kirim laporan"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />
      {awal?.catatanKanwil ? (
        <Catatan nada="amber">
          <strong>Catatan Kanwil:</strong> {awal.catatanKanwil}
        </Catatan>
      ) : (
        <Catatan>
          Laporan ini belum mengubah data pegawai maupun jadwal KGB-nya. SDM Hukdis Kanwil mencocokkannya dengan
          pindaian SK lalu mencatatnya; hukuman yang menunda KGB baru menggeser jadwal setelah dicatat.
        </Catatan>
      )}

      {awal ? null : (
        <div className="kgbm-label">
          <span className="kgbm-wajib">Pegawai</span>
          {!dipilih && (
            <input
              className="kgbm-input"
              type="search"
              placeholder="Cari nama atau NIP"
              aria-label="Cari pegawai"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              data-autofocus=""
            />
          )}
          <select
            className="kgbm-input"
            aria-label="Pegawai yang dilaporkan"
            value={pegawaiId}
            onChange={(e) => setPegawaiId(e.target.value)}
          >
            <option value="">{pilihanPegawai.length === 0 ? "Tidak ada yang cocok" : `Pilih pegawai (${pilihanPegawai.length})`}</option>
            {(dipilih && !pilihanPegawai.includes(dipilih) ? [dipilih, ...pilihanPegawai] : pilihanPegawai).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama} · {p.nip}
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="kgbm-label">
        <span className="kgbm-wajib">Jenis hukuman</span>
        <select
          className="kgbm-input"
          value={jenisHukdis}
          onChange={(e) => {
            setJenisHukdis(e.target.value);
            isiBerakhir(e.target.value, tmtMulai);
          }}
        >
          <option value="">Pilih jenis sesuai SK</option>
          {["ringan", "sedang", "berat"].map((kat) => {
            const grup = jenis.filter((j) => j.kategori === kat);
            return grup.length === 0 ? null : (
              <optgroup key={kat} label={LABEL_KATEGORI[kat]}>
                {grup.map((j) => (
                  <option key={j.kode} value={j.kode}>{j.label}</option>
                ))}
              </optgroup>
            );
          })}
          {jenis.filter((j) => !LABEL_KATEGORI[j.kategori]).map((j) => (
            <option key={j.kode} value={j.kode}>{j.label}</option>
          ))}
        </select>
      </label>

      <div className="kgbm-grid2">
        <label className="kgbm-label">
          <span className="kgbm-wajib">Nomor SK</span>
          <input className="kgbm-input" value={nomorSK} onChange={(e) => setNomorSK(e.target.value)} placeholder="Nomor SK hukuman disiplin" />
        </label>
        <label className="kgbm-label">
          <span className="kgbm-wajib">Tanggal SK</span>
          <input className="kgbm-input" type="date" value={tanggalSK} onChange={(e) => setTanggalSK(e.target.value)} />
        </label>
        <label className="kgbm-label">
          <span className="kgbm-wajib">TMT mulai</span>
          <input
            className="kgbm-input"
            type="date"
            value={tmtMulai}
            onChange={(e) => {
              setTmtMulai(e.target.value);
              isiBerakhir(jenisHukdis, e.target.value);
            }}
          />
        </label>
        <label className="kgbm-label">
          TMT berakhir
          <input
            className="kgbm-input"
            type="date"
            value={tmtBerakhir}
            onChange={(e) => {
              setBerakhirDiketik(true);
              setTmtBerakhir(e.target.value);
            }}
          />
          <span className="kgbm-bantuan">Terisi dari masa hukuman jenisnya; sesuaikan dengan SK bila berbeda.</span>
        </label>
      </div>

      <KolomBerkas
        label="Pindaian SK hukuman disiplin"
        wajib
        bantuan="SK yang ditandatangani pejabat berwenang. Kanwil mencocokkan jenis dan tanggalnya dengan berkas ini."
        dipilih={berkas}
        urlTersimpan={bawaan && awal ? `/api/hukdis/laporan/${awal.id}/berkas` : null}
        namaTersimpan={bawaan?.nama ?? null}
        ditandaiHapus={false}
        onPilih={setBerkas}
        onHapusTersimpan={() => setHapusBawaan(true)}
        onBatalHapus={() => setHapusBawaan(false)}
        onPratinjau={(judul, url, lokal) => setPratinjau({ judul, url, lokal })}
      />

      <label className="kgbm-label">
        Keterangan
        <textarea
          className="kgbm-input"
          rows={2}
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          placeholder="Mis. pelanggaran yang mendasari, atau hal yang perlu diketahui peninjau"
        />
      </label>

      {pratinjau && (
        <ModalPratinjauBerkas
          judul={pratinjau.judul}
          subjudul={dipilih ? `${dipilih.nama} · ${dipilih.nip}` : undefined}
          url={pratinjau.url}
          onTutup={tutupPratinjau}
        />
      )}
    </KerangkaModal>
  );
}
