"use client";

import { useState } from "react";
import {
  LABEL_TINDAK_LANJUT,
  isoTanggal,
  type BarisBanding,
  type StatusTindakLanjut,
} from "@/lib/pemutakhiranPegawai";
import type { KirimanInventaris } from "@/lib/inventarisServer";
import { LABEL_KEADAAN } from "@/lib/inventarisKgb";
import { formatTanggalId } from "@/lib/waktu";

/* Satu kiriman formulir pemutakhiran data beserta perbandingannya dengan Data Pegawai (ADR-023, ADR-024).
   Dipakai di dua tempat: antrian pemeriksaan pada menu Inventarisasi, dan tab Dokumen & Pemutakhiran di halaman
   pegawai. Golongan dan masa kerja tidak diterapkan langsung, melainkan lewat Catat kenaikan pangkat atau PMK. */

/** Data pegawai yang dikirim ulang saat menerapkan isian; PATCH mengganti seluruh isian Data Pegawai. */
export interface PegawaiLengkap {
  id: string;
  nip: string;
  nama: string;
  golonganRuang: string;
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
  tmtKgbTerakhir: string | null;
  tmtKgbBerikutnya: string | null;
  [kolom: string]: unknown;
}

export interface Pemutakhiran {
  kegiatan: { id: string; nama: string };
  kiriman: KirimanInventaris;
  banding: BarisBanding[];
  peringatan: string[];
}

/** Kolom yang dikirim ulang pada PATCH /api/pegawai/[id], yang mengganti seluruh isian Data Pegawai. */
const KOLOM_PATCH = [
  "nama", "tempatLahir", "tanggalLahir", "jenisKelamin", "pendidikanTerakhir", "jabatan", "pangkat", "golonganRuang",
  "unitKerja", "eselon", "jenisJabatan", "tmtGolongan", "mkgTahun", "mkgBulan", "gajiPokok", "tmtKgbTerakhir",
  "tmtKgbBerikutnya", "nomorSkDasar", "tanggalSkDasar", "penetapSkDasar",
] as const;
const KOLOM_TANGGAL = new Set(["tanggalLahir", "tmtGolongan", "tmtKgbTerakhir", "tmtKgbBerikutnya", "tanggalSkDasar"]);

export const NADA_STATUS: Record<StatusTindakLanjut, string> = {
  belum_diperiksa: "kuning",
  sesuai: "hijau",
  perlu_perbaikan: "merah",
  diterapkan: "biru",
};

const tanggalTeks = (v: string) => (v ? formatTanggalId(v) : "");

export default function KartuKiriman({
  p,
  pegawai,
  bolehUbah,
  onGalat,
  onBerhasil,
  onCatat,
  onLihatBerkas,
}: {
  p: Pemutakhiran;
  pegawai: PegawaiLengkap;
  bolehUbah: boolean;
  onGalat: (g: string | null) => void;
  onBerhasil: (teks: string) => void;
  onCatat: (jenis: "kp" | "pmk") => void;
  /** Bila diisi, berkas kiriman ditampilkan dengan tombol Lihat yang membuka pratinjau di halaman. */
  onLihatBerkas?: (berkas: { judul: string; url: string }) => void;
}) {
  const { kiriman, kegiatan, banding, peringatan } = p;
  const isian = kiriman.isian;
  const status: StatusTindakLanjut = kiriman.tindakLanjut?.status ?? "belum_diperiksa";
  const [semua, setSemua] = useState(false);
  const [pilih, setPilih] = useState<Set<string>>(() => new Set());
  const [statusBaru, setStatusBaru] = useState<StatusTindakLanjut>(status === "belum_diperiksa" ? "sesuai" : status);
  const [catatan, setCatatan] = useState(kiriman.tindakLanjut?.catatan ?? "");
  const [sibuk, setSibuk] = useState(false);

  const beda = banding.filter((b) => b.beda);
  const tampil = semua ? banding : beda;
  const langsung = beda.filter((b) => b.jalur === "langsung" && b.kolom);
  const adaKp = beda.some((b) => b.jalur === "kp");
  const adaPmk = beda.some((b) => b.jalur === "pmk");

  async function catatStatus(s: StatusTindakLanjut, teks: string) {
    const res = await fetch("/api/inventarisasi/tindak-lanjut", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kegiatan: kegiatan.id, nip: isian.nip, status: s, catatan: teks }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(d.error ?? "Status tindak lanjut gagal disimpan.");
  }

  async function simpanStatus() {
    setSibuk(true);
    onGalat(null);
    try {
      await catatStatus(statusBaru, catatan);
      onBerhasil(`Kiriman ${kegiatan.nama} ditandai: ${LABEL_TINDAK_LANJUT[statusBaru]}.`);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Status tindak lanjut gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function terapkan() {
    const dipilih = langsung.filter((b) => pilih.has(b.kunci));
    if (dipilih.length === 0) return;
    if (!window.confirm(`Terapkan ${dipilih.length} isian dari kiriman ke Data Pegawai ${pegawai.nama}?`)) return;
    setSibuk(true);
    onGalat(null);
    try {
      // PATCH mengganti seluruh isian, jadi nilai tersimpan dikirim ulang dan hanya kolom terpilih yang diganti.
      const badan: Record<string, unknown> = {};
      for (const k of KOLOM_PATCH) {
        const v = pegawai[k];
        badan[k] = KOLOM_TANGGAL.has(k) ? isoTanggal(v as string | null) : (v ?? "");
      }
      for (const b of dipilih) badan[b.kolom!] = b.nilaiBaru ?? "";
      const res = await fetch(`/api/pegawai/${pegawai.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Data Pegawai gagal diperbarui.");
      const label = dipilih.map((b) => b.label.toLowerCase()).join(", ");
      const sisa = beda.length - dipilih.length;
      await catatStatus(sisa === 0 ? "diterapkan" : status === "belum_diperiksa" ? "perlu_perbaikan" : status, `Diterapkan: ${label}.${sisa > 0 ? ` ${sisa} isian lain belum.` : ""}`).catch(() => {});
      setPilih(new Set());
      onBerhasil(`Data Pegawai diperbarui dari kiriman: ${label}.`);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Data Pegawai gagal diperbarui.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <article className="pmh-kartu">
      <header className="pmh-kepala">
        <div className="min-w-0">
          <p className="pmh-judul">{kegiatan.nama}</p>
          <p className="dsb-kecil" style={{ margin: 0 }}>
            Dikirim {formatTanggalId(kiriman.waktu, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {kiriman.kirimanKe > 1 ? ` · kiriman ke-${kiriman.kirimanKe}` : ""} · {LABEL_KEADAAN[isian.keadaan]}
          </p>
        </div>
        <span className="dsb-tag" data-nada={NADA_STATUS[status]}>{LABEL_TINDAK_LANJUT[status]}</span>
      </header>

      {kiriman.tindakLanjut && (
        <p className="dsb-kecil pmh-riwayat">
          {LABEL_TINDAK_LANJUT[kiriman.tindakLanjut.status]} oleh {kiriman.tindakLanjut.oleh},{" "}
          {formatTanggalId(kiriman.tindakLanjut.at)}{kiriman.tindakLanjut.catatan ? `: ${kiriman.tindakLanjut.catatan}` : ""}
        </p>
      )}

      {peringatan.map((w) => (
        <p key={w} className="pmh-peringatan">{w}</p>
      ))}

      <div className="pmh-ringkas">
        <span><strong>{beda.length}</strong> isian berbeda dari SIM-KGB</span>
        <label className="inv-cek">
          <input type="checkbox" className="dsb-cek" checked={semua} onChange={(e) => setSemua(e.target.checked)} />
          Tampilkan juga yang sama
        </label>
      </div>

      {tampil.length === 0 ? (
        <p className="dsb-kosong">Semua isian yang dibandingkan sama dengan Data Pegawai.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="dsb-tabel pmh-tabel">
            <thead>
              <tr>
                <th scope="col">Isian</th>
                <th scope="col">SIM-KGB</th>
                <th scope="col">Kiriman</th>
                <th scope="col">Tindak lanjut</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((b) => (
                <tr key={b.kunci} data-beda={b.beda ? "" : undefined}>
                  <th scope="row">{b.label}</th>
                  <td>{/^\d{4}-\d{2}-\d{2}$/.test(b.simKgb) ? tanggalTeks(b.simKgb) : b.simKgb || "-"}</td>
                  <td className={b.beda ? "pmh-baru" : undefined}>
                    {/^\d{4}-\d{2}-\d{2}$/.test(b.kiriman) ? tanggalTeks(b.kiriman) : b.kiriman || "-"}
                  </td>
                  <td className="dsb-kecil">
                    {!b.beda ? (
                      "Sama"
                    ) : b.jalur === "langsung" && bolehUbah ? (
                      <label className="inv-cek">
                        <input
                          type="checkbox"
                          className="dsb-cek"
                          checked={pilih.has(b.kunci)}
                          onChange={(e) =>
                            setPilih((s) => {
                              const baru = new Set(s);
                              if (e.target.checked) baru.add(b.kunci);
                              else baru.delete(b.kunci);
                              return baru;
                            })
                          }
                        />
                        Terapkan
                      </label>
                    ) : (
                      b.catatan ?? "Periksa"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {onLihatBerkas && kiriman.berkas.length > 0 && (
        <div className="pmh-berkas">
          {kiriman.berkas.map((b) => (
            <button
              key={b.kunci}
              type="button"
              className="dsb-tombol"
              data-jenis="garis"
              onClick={() =>
                onLihatBerkas({
                  judul: b.jenis.replace(/-/g, " "),
                  url: `/api/inventarisasi/berkas?kunci=${encodeURIComponent(b.kunci)}`,
                })
              }
            >
              Lihat {b.jenis.replace(/-/g, " ")}
            </button>
          ))}
        </div>
      )}

      <dl className="pmh-lain">
        {isian.keadaan === "pernah" && (
          <div>
            <dt>Setelah KGB terakhir</dt>
            <dd>
              {isian.naikSetelahKgb === "ya" && isian.pmkSetelahKgb === "ya"
                ? "Kenaikan pangkat/PI dan PMK"
                : isian.naikSetelahKgb === "ya"
                  ? "Kenaikan pangkat/PI"
                  : isian.pmkSetelahKgb === "ya"
                    ? `PMK, TMT ${tanggalTeks(isian.tmtPmk)}`
                    : isian.naikSetelahKgb === "tidak"
                      ? "Tidak ada"
                      : "Tidak ditanyakan (kiriman lama)"}
            </dd>
          </div>
        )}
        <div>
          <dt>{isian.keadaan === "pernah" ? "SK KGB terakhir" : "SK CPNS"}</dt>
          <dd>{[isian.nomorSkDasar, tanggalTeks(isian.tanggalSkDasar)].filter(Boolean).join(" · ") || "-"}</dd>
        </div>
        {isian.bidang && (
          <div>
            <dt>Bidang/Bagian</dt>
            <dd>{isian.bidang}</dd>
          </div>
        )}
        {isian.nomorWa && (
          <div>
            <dt>WhatsApp</dt>
            <dd><a href={`https://wa.me/${isian.nomorWa.replace(/^0/, "62").replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{isian.nomorWa}</a></dd>
          </div>
        )}
        {isian.catatan && (
          <div>
            <dt>Catatan pegawai</dt>
            <dd>{isian.catatan}</dd>
          </div>
        )}
      </dl>

      {bolehUbah && (adaKp || adaPmk || langsung.length > 0) && (
        <div className="pmh-aksi">
          {langsung.length > 0 && (
            <button type="button" className="dsb-tombol" disabled={sibuk || pilih.size === 0} onClick={() => void terapkan()}>
              Terapkan {pilih.size > 0 ? pilih.size : ""} isian ke Data Pegawai
            </button>
          )}
          {adaKp && (
            <button type="button" className="dsb-tombol" data-jenis="garis" disabled={sibuk} onClick={() => onCatat("kp")}>
              Catat kenaikan pangkat…
            </button>
          )}
          {adaPmk && (
            <button type="button" className="dsb-tombol" data-jenis="garis" disabled={sibuk} onClick={() => onCatat("pmk")}>
              Catat PMK…
            </button>
          )}
        </div>
      )}

      <div className="pmh-status">
        <label className="inv-bidang">
          <span>Status tindak lanjut</span>
          <select className="dsb-cari" value={statusBaru} onChange={(e) => setStatusBaru(e.target.value as StatusTindakLanjut)}>
            {(Object.keys(LABEL_TINDAK_LANJUT) as StatusTindakLanjut[]).map((s) => (
              <option key={s} value={s}>{LABEL_TINDAK_LANJUT[s]}</option>
            ))}
          </select>
        </label>
        <label className="inv-bidang pmh-catatan">
          <span>Catatan {statusBaru === "perlu_perbaikan" ? "(wajib)" : "(opsional)"}</span>
          <input className="dsb-cari" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. MKG masih golongan II; minta pegawai mengirim ulang" />
        </label>
        <button type="button" className="dsb-tombol" data-jenis="garis" disabled={sibuk} onClick={() => void simpanStatus()}>
          Simpan status
        </button>
      </div>
    </article>
  );
}