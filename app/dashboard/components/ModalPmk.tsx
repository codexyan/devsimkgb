"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BidangPenetap, Catatan, DaftarData, KerangkaModal, PesanGalat } from "@/app/dashboard/components/kgb";
import { hitungPmk } from "@/lib/pmk";
import { formatTanggalId, isoTanggalLokal } from "@/lib/waktu";

/* Catat SK peninjauan masa kerja (PMK) satu pegawai (ADR-021). Hitungannya memakai lib/pmk.ts, sama dengan yang
   dipakai API, sehingga pratinjau di layar sama dengan yang tersimpan: MKG bertambah, gaji pokok dibaca ulang dari
   tabel PP 5/2024, dan TMT KGB berikutnya diusulkan dari MKG yang baru. Usulan itu boleh dikoreksi sesuai SK. */

export interface PegawaiPmk {
  id: string;
  nama: string;
  nip: string;
  golonganRuang: string;
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
  tmtKgbTerakhir: string | null;
  tmtKgbBerikutnya: string | null;
}

interface KgbDitinjau {
  id: string;
  status: string;
  tmtKgbBaru: string | null;
}

const fmtRp = (n: number) => "Rp " + n.toLocaleString("id-ID");
const fmtMkg = (m: { tahun: number; bulan: number }) => `${m.tahun} thn ${m.bulan} bln`;
const LABEL_STATUS: Record<string, string> = {
  sedang_diproses: "sedang diproses",
  menunggu_keuangan: "menunggu keuangan",
};

export default function ModalPmk({
  pegawai,
  awal,
  onTutup,
  onBerhasil,
}: {
  pegawai: PegawaiPmk;
  /** Isian awal, mis. dari kiriman formulir pemutakhiran data (ADR-023); tetap dapat diubah. */
  awal?: { tanggalSK?: string; tmtPmk?: string; mkgTahunSk?: string; mkgBulanSk?: string };
  onTutup: () => void;
  /** Dipanggil setelah tersimpan; pesan sudah siap ditampilkan di halaman. */
  onBerhasil: (pesan: string) => void;
}) {
  const [nomorSK, setNomorSK] = useState("");
  const [tanggalSK, setTanggalSK] = useState(awal?.tanggalSK || isoTanggalLokal());
  const [tmtPmk, setTmtPmk] = useState(awal?.tmtPmk ?? "");
  const [mkgTahunSk, setMkgTahunSk] = useState(awal?.mkgTahunSk ?? "");
  const [mkgBulanSk, setMkgBulanSk] = useState(awal?.mkgBulanSk ?? "");
  // Kosong berarti memakai usulan hitungan.
  const [tmtKgbKoreksi, setTmtKgbKoreksi] = useState("");
  const [penetapSK, setPenetapSK] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [ditinjau, setDitinjau] = useState<KgbDitinjau[] | null>(null);

  const hitung = useMemo(() => {
    if (!tmtPmk || mkgTahunSk === "") return null;
    return hitungPmk({
      golonganRuang: pegawai.golonganRuang,
      mkgTahun: pegawai.mkgTahun,
      mkgBulan: pegawai.mkgBulan,
      tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
      tmtPmk,
      mkgTahunSk: Number(mkgTahunSk),
      mkgBulanSk: Number(mkgBulanSk || "0"),
    });
  }, [pegawai, tmtPmk, mkgTahunSk, mkgBulanSk]);
  const pratinjau = hitung?.ok ? hitung.hasil : null;
  const tmtKgbUsulan = pratinjau ? isoTanggalLokal(pratinjau.tmtKgbBerikutnyaUsulan) : "";
  const tmtKgbDipakai = tmtKgbKoreksi || tmtKgbUsulan;

  async function simpan() {
    setGalat("");
    if (!nomorSK.trim()) { setGalat("Nomor SK PMK wajib diisi"); return; }
    if (!tanggalSK || !tmtPmk) { setGalat("Tanggal SK dan TMT PMK wajib diisi"); return; }
    if (mkgTahunSk === "") { setGalat("Masa kerja golongan pada SK PMK wajib diisi"); return; }
    if (hitung && !hitung.ok) { setGalat(hitung.pesan); return; }
    setSibuk(true);
    try {
      const res = await fetch(`/api/pegawai/${pegawai.id}/pmk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomorSK,
          tanggalSK,
          tmtPmk,
          mkgTahunSk,
          mkgBulanSk,
          tmtKgbBerikutnya: tmtKgbKoreksi || undefined,
          penetapSK,
          keterangan,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        error?: string;
        hasil?: { tmtKgbBerikutnyaLama: string | null; tmtKgbBerikutnya: string | null };
        kgbDiselaraskan?: number;
        kgbPerluDitinjau?: KgbDitinjau[];
      };
      if (!res.ok) { setGalat(d.error ?? "PMK gagal disimpan"); return; }

      const perlu = d.kgbPerluDitinjau ?? [];
      if (perlu.length > 0) {
        // Jangan tutup modal: Tim SDM perlu tahu KGB mana yang SK-nya memakai masa kerja lama.
        setDitinjau(perlu);
        return;
      }
      const geser =
        d.hasil && d.hasil.tmtKgbBerikutnyaLama !== d.hasil.tmtKgbBerikutnya
          ? ` KGB berikutnya kini ${formatTanggalId(d.hasil.tmtKgbBerikutnya)}.`
          : "";
      onBerhasil(`PMK ${pegawai.nama} tersimpan.${geser}${d.kgbDiselaraskan ? " Jadwal KGB berikutnya ikut disusun ulang." : ""}`);
    } catch {
      setGalat("Gagal menghubungi server");
    } finally {
      setSibuk(false);
    }
  }

  if (ditinjau) {
    return (
      <KerangkaModal
        judul="PMK tersimpan"
        subjudul={`${pegawai.nama} · ${pegawai.nip}`}
        nada="amber"
        ukuran="sm"
        onTutup={() => onBerhasil(`PMK ${pegawai.nama} tersimpan.`)}
        kaki={
          <>
            <Link href="/dashboard/kgb" className="kgbm-tombol kgbm-kedua">Buka Proses KGB</Link>
            <button type="button" className="kgbm-tombol kgbm-utama" onClick={() => onBerhasil(`PMK ${pegawai.nama} tersimpan.`)}>
              Mengerti
            </button>
          </>
        }
      >
        <p style={{ fontSize: "13px", lineHeight: 1.55, color: "var(--dt2)", margin: 0 }}>
          Data gaji dan jadwal KGB pegawai sudah mengikuti SK PMK. Namun KGB berikut sudah dikerjakan dengan masa kerja
          lama, jadi SK-nya perlu Anda tinjau: batalkan lalu input ulang bila SK belum terbit, atau lanjutkan bila SK lama
          sudah telanjur ditandatangani.
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
      judul="Catat peninjauan masa kerja (PMK)"
      subjudul={`${pegawai.nama} · ${pegawai.nip} · ${pegawai.golonganRuang}`}
      ukuran="md"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void simpan()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" disabled={sibuk} onClick={onTutup}>Batal</button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan PMK"}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="pmk-nomor" className="kgbm-label">Nomor SK PMK<span className="kgbm-wajib" aria-hidden="true" /></label>
        <input id="pmk-nomor" className="kgbm-input" value={nomorSK} onChange={(e) => setNomorSK(e.target.value)} data-autofocus />
      </div>

      <div className="kgbm-grid2">
        <div>
          <label htmlFor="pmk-tanggal" className="kgbm-label">Tanggal SK<span className="kgbm-wajib" aria-hidden="true" /></label>
          <input id="pmk-tanggal" type="date" className="kgbm-input" value={tanggalSK} onChange={(e) => setTanggalSK(e.target.value)} />
        </div>
        <div>
          <label htmlFor="pmk-tmt" className="kgbm-label">TMT PMK<span className="kgbm-wajib" aria-hidden="true" /></label>
          <input id="pmk-tmt" type="date" className="kgbm-input" value={tmtPmk} onChange={(e) => setTmtPmk(e.target.value)} />
        </div>
      </div>

      <div>
        <span className="kgbm-label" id="pmk-mkg">
          Masa kerja golongan pada SK PMK<span className="kgbm-wajib" aria-hidden="true" />
        </span>
        <div className="kgbm-grid2" role="group" aria-labelledby="pmk-mkg">
          <input
            className="kgbm-input"
            inputMode="numeric"
            aria-label="Tahun"
            placeholder="Tahun"
            value={mkgTahunSk}
            onChange={(e) => setMkgTahunSk(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
          <input
            className="kgbm-input"
            inputMode="numeric"
            aria-label="Bulan"
            placeholder="Bulan"
            value={mkgBulanSk}
            onChange={(e) => setMkgBulanSk(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
        </div>
        <p className="kgbm-petunjuk">Masa kerja golongan pada TMT PMK, seperti tertulis di SK, sesudah ditambah masa kerja yang diperhitungkan.</p>
      </div>

      <BidangPenetap
        label="Ditetapkan oleh"
        nilai={penetapSK}
        onUbah={setPenetapSK}
        petunjuk="Pejabat yang menandatangani SK PMK. SK KGB berikutnya berdasar SK ini dan mencetak pejabatnya pada baris Oleh."
        nonaktif={sibuk}
      />

      {hitung && !hitung.ok && <Catatan nada="merah">{hitung.pesan}</Catatan>}
      {pratinjau && (
        <>
          <DaftarData
            judul="Setelah PMK"
            baris={[
              {
                label: "Masa kerja pada TMT PMK",
                nilai: `${fmtMkg(pratinjau.mkgSebelumPadaTmt)} → ${fmtMkg(pratinjau.mkgSesudahPadaTmt)} (tambah ${fmtMkg({
                  tahun: Math.floor(pratinjau.tambahBulan / 12),
                  bulan: pratinjau.tambahBulan % 12,
                })})`,
              },
              { label: "Gaji pokok", nilai: `${fmtRp(pegawai.gajiPokok)} → ${fmtRp(pratinjau.gajiPokokBaru)}` },
              {
                label: "KGB berikutnya",
                nilai: `${pegawai.tmtKgbBerikutnya ? formatTanggalId(pegawai.tmtKgbBerikutnya) : "-"} → ${formatTanggalId(tmtKgbDipakai)}`,
              },
            ]}
          />
          <div>
            <label htmlFor="pmk-kgb" className="kgbm-label">TMT KGB berikutnya</label>
            <input
              id="pmk-kgb"
              type="date"
              className="kgbm-input"
              value={tmtKgbDipakai}
              onChange={(e) => setTmtKgbKoreksi(e.target.value === tmtKgbUsulan ? "" : e.target.value)}
            />
            <p className="kgbm-petunjuk">
              {tmtKgbKoreksi
                ? `Dikoreksi dari usulan ${formatTanggalId(tmtKgbUsulan)}.`
                : "Usulan: saat masa kerja yang baru mencapai langkah berikutnya di tabel gaji. Koreksi bila SK PMK menyebut tanggal lain."}
            </p>
          </div>
        </>
      )}

      <div>
        <label htmlFor="pmk-keterangan" className="kgbm-label">Keterangan <span style={{ color: "var(--dt5)" }}>(opsional)</span></label>
        <textarea id="pmk-keterangan" rows={2} className="kgbm-input" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="mis. masa kerja honorer yang diperhitungkan" />
      </div>

      <Catatan>
        Berbeda dengan kenaikan pangkat, PMK dapat menggeser jadwal KGB: masa kerja yang bertambah bisa mencapai langkah
        tabel gaji berikutnya lebih cepat. Golongan pegawai tidak berubah.
      </Catatan>

      <PesanGalat pesan={galat || null} />
    </KerangkaModal>
  );
}
