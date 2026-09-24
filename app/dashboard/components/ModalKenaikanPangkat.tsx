"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Catatan, DaftarData, KerangkaModal, PesanGalat } from "@/app/dashboard/components/kgb";
import { JENIS_KP, URUTAN_GOLONGAN, hitungKenaikanPangkat, peringkatGolongan, type JenisKp } from "@/lib/kenaikanPangkat";
import { GOLONGAN_PANGKAT } from "@/lib/tabelGaji";
import { formatTanggalId, isoTanggalLokal } from "@/lib/waktu";

/* Catat SK kenaikan pangkat satu pegawai. Hitungannya memakai lib/kenaikanPangkat.ts, sama dengan yang dipakai
   API, sehingga pratinjau di layar sama dengan yang tersimpan: MKG dipotong bila pindah jenjang golongan, lalu
   gaji pokok dibaca ulang dari tabel PP 5/2024. TMT KGB tidak diubah oleh kenaikan pangkat. */

export interface PegawaiPangkat {
  id: string;
  nama: string;
  nip: string;
  golonganRuang: string;
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
}

interface KgbDitinjau {
  id: string;
  status: string;
  tmtKgbBaru: string | null;
}

const fmtRp = (n: number) => "Rp " + n.toLocaleString("id-ID");
const LABEL_STATUS: Record<string, string> = {
  sedang_diproses: "sedang diproses",
  menunggu_keuangan: "menunggu keuangan",
};

export default function ModalKenaikanPangkat({
  pegawai,
  onTutup,
  onBerhasil,
}: {
  pegawai: PegawaiPangkat;
  onTutup: () => void;
  /** Dipanggil setelah tersimpan; pesan sudah siap ditampilkan di halaman. */
  onBerhasil: (pesan: string) => void;
}) {
  const [jenisKp, setJenisKp] = useState<JenisKp>("reguler");
  const [golonganBaru, setGolonganBaru] = useState("");
  const [nomorSK, setNomorSK] = useState("");
  const [tanggalSK, setTanggalSK] = useState(isoTanggalLokal());
  const [tmtPangkat, setTmtPangkat] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [ditinjau, setDitinjau] = useState<KgbDitinjau[] | null>(null);

  // Hanya golongan di atas golongan sekarang yang masuk akal sebagai kenaikan pangkat.
  const pilihanGolongan = useMemo(
    () => URUTAN_GOLONGAN.filter((g) => peringkatGolongan(g) > peringkatGolongan(pegawai.golonganRuang)),
    [pegawai.golonganRuang],
  );

  const pratinjau = useMemo(() => {
    if (!golonganBaru) return null;
    const h = hitungKenaikanPangkat({
      golonganLama: pegawai.golonganRuang,
      mkgTahunLama: pegawai.mkgTahun,
      mkgBulanLama: pegawai.mkgBulan,
      golonganBaru,
    });
    return h.ok ? h.hasil : null;
  }, [golonganBaru, pegawai]);

  async function simpan() {
    setGalat("");
    if (!golonganBaru) { setGalat("Pilih golongan baru"); return; }
    if (!nomorSK.trim()) { setGalat("Nomor SK kenaikan pangkat wajib diisi"); return; }
    if (!tanggalSK || !tmtPangkat) { setGalat("Tanggal SK dan TMT pangkat wajib diisi"); return; }
    setSibuk(true);
    try {
      const res = await fetch(`/api/pegawai/${pegawai.id}/pangkat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jenisKp, golonganBaru, nomorSK, tanggalSK, tmtPangkat, keterangan }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        error?: string;
        kgbDiselaraskan?: number;
        kgbPerluDitinjau?: KgbDitinjau[];
      };
      if (!res.ok) { setGalat(d.error ?? "Kenaikan pangkat gagal disimpan"); return; }

      const perlu = d.kgbPerluDitinjau ?? [];
      if (perlu.length > 0) {
        // Jangan tutup modal: Tim SDM perlu tahu KGB mana yang SK-nya memakai golongan lama.
        setDitinjau(perlu);
        return;
      }
      onBerhasil(
        `Kenaikan pangkat ${pegawai.nama} tersimpan: ${pegawai.golonganRuang} → ${golonganBaru}.` +
          (d.kgbDiselaraskan ? " Jadwal KGB berikutnya ikut diselaraskan." : ""),
      );
    } catch {
      setGalat("Gagal menghubungi server");
    } finally {
      setSibuk(false);
    }
  }

  if (ditinjau) {
    return (
      <KerangkaModal
        judul="Kenaikan pangkat tersimpan"
        subjudul={`${pegawai.nama} · ${pegawai.golonganRuang} → ${golonganBaru}`}
        nada="amber"
        ukuran="sm"
        onTutup={() => onBerhasil(`Kenaikan pangkat ${pegawai.nama} tersimpan.`)}
        kaki={
          <>
            <Link href="/dashboard/kgb" className="kgbm-tombol kgbm-kedua">Buka Proses KGB</Link>
            <button type="button" className="kgbm-tombol kgbm-utama" onClick={() => onBerhasil(`Kenaikan pangkat ${pegawai.nama} tersimpan.`)}>
              Mengerti
            </button>
          </>
        }
      >
        <p style={{ fontSize: "13px", lineHeight: 1.55, color: "var(--dt2)", margin: 0 }}>
          Data gaji pegawai sudah mengikuti SK kenaikan pangkat. Namun KGB berikut sudah dikerjakan dengan
          golongan lama, jadi SK-nya perlu Anda tinjau: batalkan lalu input ulang bila SK belum terbit, atau
          lanjutkan bila SK lama sudah telanjur ditandatangani.
        </p>
        <ul className="dsb-daftar-ringkas">
          {ditinjau.map((k) => (
            <li key={k.id}>
              <span>KGB TMT {k.tmtKgbBaru ? formatTanggalId(k.tmtKgbBaru, { month: "long", year: "numeric" }) : "-"}</span>
              <span className="dsb-kecil">{LABEL_STATUS[k.status] ?? k.status}</span>
            </li>
          ))}
        </ul>
      </KerangkaModal>
    );
  }

  return (
    <KerangkaModal
      judul="Catat kenaikan pangkat"
      subjudul={`${pegawai.nama} · ${pegawai.nip} · ${pegawai.golonganRuang}`}
      ukuran="md"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void simpan()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" disabled={sibuk} onClick={onTutup}>Batal</button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan kenaikan pangkat"}
          </button>
        </>
      }
    >
      <div className="kgbm-grid2">
        <div>
          <label htmlFor="kp-jenis" className="kgbm-label">Jenis kenaikan pangkat</label>
          <select id="kp-jenis" className="kgbm-input" value={jenisKp} onChange={(e) => setJenisKp(e.target.value as JenisKp)}>
            {Object.entries(JENIS_KP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="kp-golongan" className="kgbm-label">Golongan baru<span className="kgbm-wajib" aria-hidden="true" /></label>
          <select id="kp-golongan" className="kgbm-input" value={golonganBaru} onChange={(e) => setGolonganBaru(e.target.value)} data-autofocus>
            <option value="">Pilih golongan…</option>
            {pilihanGolongan.map((g) => <option key={g} value={g}>{g} · {GOLONGAN_PANGKAT[g]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="kp-nomor" className="kgbm-label">Nomor SK kenaikan pangkat<span className="kgbm-wajib" aria-hidden="true" /></label>
        <input id="kp-nomor" className="kgbm-input" value={nomorSK} onChange={(e) => setNomorSK(e.target.value)} placeholder="mis. W.17-KP.03.01-125" />
      </div>

      <div className="kgbm-grid2">
        <div>
          <label htmlFor="kp-tanggal" className="kgbm-label">Tanggal SK<span className="kgbm-wajib" aria-hidden="true" /></label>
          <input id="kp-tanggal" type="date" className="kgbm-input" value={tanggalSK} onChange={(e) => setTanggalSK(e.target.value)} />
        </div>
        <div>
          <label htmlFor="kp-tmt" className="kgbm-label">TMT pangkat<span className="kgbm-wajib" aria-hidden="true" /></label>
          <input id="kp-tmt" type="date" className="kgbm-input" value={tmtPangkat} onChange={(e) => setTmtPangkat(e.target.value)} />
        </div>
      </div>

      {pratinjau && (
        <>
          <DaftarData
            judul="Setelah kenaikan pangkat"
            baris={[
              { label: "Pangkat", nilai: `${pegawai.golonganRuang} → ${pratinjau.golonganBaru} (${pratinjau.pangkatBaru})` },
              {
                label: "Masa kerja golongan",
                nilai: `${pegawai.mkgTahun} thn ${pegawai.mkgBulan} bln → ${pratinjau.mkgTahunBaru} thn ${pratinjau.mkgBulanBaru} bln`,
              },
              { label: "Gaji pokok", nilai: `${fmtRp(pegawai.gajiPokok)} → ${fmtRp(pratinjau.gajiPokokBaru)}` },
            ]}
          />
          {pratinjau.potonganMkgTahun > 0 && (
            <Catatan nada="amber">
              Pindah jenjang golongan, jadi masa kerja golongan dipotong <strong>{pratinjau.potonganMkgTahun} tahun</strong> sesuai
              Buku Saku Kenaikan Pangkat. Gaji pokok di atas sudah dibaca ulang dari tabel PP 5/2024.
            </Catatan>
          )}
        </>
      )}

      <div>
        <label htmlFor="kp-keterangan" className="kgbm-label">Keterangan <span style={{ color: "var(--dt5)" }}>(opsional)</span></label>
        <textarea id="kp-keterangan" rows={2} className="kgbm-input" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="mis. hasil ujian dinas atau nomor PAK" />
      </div>

      <Catatan>
        TMT KGB tidak diubah oleh kenaikan pangkat: siklus KGB tetap berjalan dari TMT KGB terakhir. Yang berubah
        hanya golongan, masa kerja golongan, dan gaji pokok sebagai dasar KGB berikutnya.
      </Catatan>

      <PesanGalat pesan={galat || null} />
    </KerangkaModal>
  );
}
