"use client";

import { useEffect, useState } from "react";
import { LABEL_TINDAK_LANJUT, type BarisBanding, type StatusTindakLanjut } from "@/lib/pemutakhiranPegawai";
import type { KirimanInventaris } from "@/lib/inventarisServer";
import { LABEL_KEADAAN } from "@/lib/inventarisKgb";
import { formatTanggalId } from "@/lib/waktu";

/* Satu kiriman formulir inventarisasi beserta perbandingannya dengan Data Pegawai (ADR-023, ADR-024, ADR-027).

   Modul inventarisasi hanya pengumpul data sementara: kartu ini bahan rujukan, bukan tempat mengubah data.
   Peremajaan Data Pegawai (per bagian, Catat kenaikan pangkat, PMK) dilakukan di modul Data Pegawai; tombol
   "Buka di Data Pegawai" membukanya di tab baru. Yang dapat dilakukan di sini hanya:
   - mencatat status tindak lanjut kiriman (catatan kerja modul inventarisasi), dan
   - menyalin berkas SK kiriman satu per satu ke arsip dokumen pegawai, supaya berkasnya tetap ada setelah modul
     inventarisasi dihapus.

   Perbandingan ditata sebagai baris kisi, bukan tabel: di layar sempit tiap isian bertumpuk tanpa gulir mendatar. */

export interface Pemutakhiran {
  kegiatan: { id: string; nama: string };
  kiriman: KirimanInventaris;
  banding: BarisBanding[];
  peringatan: string[];
}

export const NADA_STATUS: Record<StatusTindakLanjut, string> = {
  belum_diperiksa: "kuning",
  sesuai: "hijau",
  perlu_perbaikan: "merah",
  diterapkan: "biru",
};

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const tanggalTeks = (v: string) => (v ? formatTanggalId(v) : "");
const nilaiTeks = (v: string) => (TANGGAL.test(v) ? tanggalTeks(v) : v || "–");

export default function KartuKiriman({
  p,
  pegawaiId,
  bolehUbah,
  tautanPegawai,
  onBerhasil,
  onLihatBerkas,
}: {
  p: Pemutakhiran;
  /** Id pegawai di Data Pegawai; null bila NIP kiriman belum terdaftar. */
  pegawaiId: string | null;
  /** Super Admin dan Tim SDM KGB: mencatat status tindak lanjut dan menyalin berkas ke arsip. */
  bolehUbah: boolean;
  /** Bila diisi, tampil tombol "Buka di Data Pegawai" yang membuka halaman pegawai di tab baru. */
  tautanPegawai?: string;
  /** Dipanggil setelah status tindak lanjut tersimpan. Penyalinan berkas tidak memanggilnya: tandanya di kartu. */
  onBerhasil: (teks: string) => void;
  /** Bila diisi, berkas kiriman ditampilkan dengan tombol Lihat yang membuka pratinjau di halaman. */
  onLihatBerkas?: (berkas: { judul: string; url: string }) => void;
}) {
  const { kiriman, kegiatan, banding, peringatan } = p;
  const isian = kiriman.isian;
  const status: StatusTindakLanjut = kiriman.tindakLanjut?.status ?? "belum_diperiksa";
  const [semua, setSemua] = useState(false);
  const [statusBaru, setStatusBaru] = useState<StatusTindakLanjut>(status === "belum_diperiksa" ? "sesuai" : status);
  const [catatan, setCatatan] = useState(kiriman.tindakLanjut?.catatan ?? "");
  const [sibuk, setSibuk] = useState(false);
  // Berkas yang sudah ada di arsip dokumen pegawai (dikenali dari kunci asalnya); null selama dimuat.
  const [tersalin, setTersalin] = useState<Set<string> | null>(null);
  const [menyalin, setMenyalin] = useState<string | null>(null);
  // Galat ditampilkan di kartu sendiri: di panel Periksa, pesan halaman tertutup modal.
  const [galat, setGalat] = useState<string | null>(null);

  const bisaArsip = bolehUbah && !!pegawaiId && !!onLihatBerkas;
  useEffect(() => {
    if (!bisaArsip) return;
    let batal = false;
    fetch(`/api/inventarisasi/arsip?kegiatan=${encodeURIComponent(kegiatan.id)}&nip=${isian.nip}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { tersalin: string[] }) : { tersalin: [] }))
      .then((d) => !batal && setTersalin(new Set(d.tersalin)))
      .catch(() => !batal && setTersalin(new Set()));
    return () => {
      batal = true;
    };
  }, [bisaArsip, kegiatan.id, isian.nip]);

  const beda = banding.filter((b) => b.beda);
  const tampil = semua ? banding : beda;

  async function simpanStatus() {
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch("/api/inventarisasi/tindak-lanjut", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kegiatan: kegiatan.id, nip: isian.nip, status: statusBaru, catatan }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Status tindak lanjut gagal disimpan.");
      onBerhasil(`Kiriman ${kegiatan.nama} ditandai: ${LABEL_TINDAK_LANJUT[statusBaru]}.`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Status tindak lanjut gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  async function salin(kunci: string) {
    setMenyalin(kunci);
    setGalat(null);
    try {
      const res = await fetch("/api/inventarisasi/arsip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kegiatan: kegiatan.id, nip: isian.nip, kunci }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; sudahAda?: boolean };
      if (!res.ok) throw new Error(d.error ?? "Berkas gagal disalin ke arsip.");
      setTersalin((t) => new Set([...(t ?? []), kunci]));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Berkas gagal disalin ke arsip.");
    } finally {
      setMenyalin(null);
    }
  }

  const lain: [string, React.ReactNode][] = [];
  if (isian.keadaan === "pernah")
    lain.push([
      "Setelah KGB terakhir",
      isian.naikSetelahKgb === "ya" && isian.pmkSetelahKgb === "ya"
        ? "Kenaikan pangkat/PI dan PMK"
        : isian.naikSetelahKgb === "ya"
          ? "Kenaikan pangkat/PI"
          : isian.pmkSetelahKgb === "ya"
            ? `PMK, TMT ${tanggalTeks(isian.tmtPmk)}`
            : isian.naikSetelahKgb === "tidak"
              ? "Tidak ada"
              : "Tidak ditanyakan (kiriman lama)",
    ]);
  lain.push([
    isian.keadaan === "pernah" ? "SK KGB terakhir" : "SK CPNS",
    [isian.nomorSkDasar, tanggalTeks(isian.tanggalSkDasar)].filter(Boolean).join(" · ") || "–",
  ]);
  if (isian.bidang) lain.push(["Bidang/Bagian", isian.bidang]);
  if (isian.nomorWa)
    lain.push([
      "WhatsApp",
      <a key="wa" href={`https://wa.me/${isian.nomorWa.replace(/^0/, "62").replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
        {isian.nomorWa}
      </a>,
    ]);

  return (
    <article className="pmh-kartu">
      <header className="pmh-kepala">
        <div className="min-w-0">
          <p className="pmh-judul">{kegiatan.nama}</p>
          <p className="pmh-meta">
            Dikirim {formatTanggalId(kiriman.waktu, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            {kiriman.kirimanKe > 1 ? ` · kiriman ke-${kiriman.kirimanKe}` : ""} · {LABEL_KEADAAN[isian.keadaan]}
          </p>
        </div>
        <span className="dsb-tag" data-nada={NADA_STATUS[status]}>{LABEL_TINDAK_LANJUT[status]}</span>
      </header>

      {kiriman.tindakLanjut && (
        <p className="pmh-riwayat">
          <strong>{LABEL_TINDAK_LANJUT[kiriman.tindakLanjut.status]}</strong> oleh {kiriman.tindakLanjut.oleh},{" "}
          {formatTanggalId(kiriman.tindakLanjut.at)}
          {kiriman.tindakLanjut.catatan ? `: ${kiriman.tindakLanjut.catatan}` : ""}
        </p>
      )}

      {!pegawaiId && (
        <p className="pmh-peringatan">
          <span className="pmh-peringatan-ikon" aria-hidden="true">!</span>
          NIP {isian.nip} belum terdaftar di Data Pegawai. Tambahkan pegawainya di modul Data Pegawai lebih dulu bila
          memang pegawai aktif; berkasnya baru dapat disalin ke arsip setelah itu.
        </p>
      )}

      {peringatan.map((w) => (
        <p key={w} className="pmh-peringatan">
          <span className="pmh-peringatan-ikon" aria-hidden="true">!</span>
          {w}
        </p>
      ))}

      {isian.catatan && (
        <blockquote className="pmh-catatan-pegawai">
          <span>Catatan pegawai</span>
          {isian.catatan}
        </blockquote>
      )}

      {banding.length > 0 && (
        <>
          <div className="pmh-ringkas">
            <span className="pmh-hitung" data-nada={beda.length > 0 ? "kuning" : "hijau"}>
              {beda.length > 0 ? (
                <>
                  <strong>{beda.length}</strong> isian berbeda dari Data Pegawai
                </>
              ) : (
                "Semua isian sama dengan Data Pegawai"
              )}
            </span>
            <label className="pmh-sakelar">
              <input type="checkbox" role="switch" checked={semua} onChange={(e) => setSemua(e.target.checked)} />
              <span aria-hidden="true" />
              Tampilkan juga yang sama
            </label>
          </div>

          {tampil.length > 0 && (
            <div className="pmh-banding" role="table" aria-label="Perbandingan kiriman dengan Data Pegawai">
              <div className="pmh-baris pmh-baris-kepala" role="row">
                <span role="columnheader">Isian</span>
                <span role="columnheader">Di Data Pegawai</span>
                <span aria-hidden="true" />
                <span role="columnheader">Dari kiriman</span>
                <span role="columnheader">Keterangan</span>
              </div>
              {tampil.map((b) => (
                <div key={b.kunci} className="pmh-baris" role="row" data-beda={b.beda ? "" : undefined}>
                  <span className="pmh-label" role="rowheader">{b.label}</span>
                  <span className="pmh-lama" role="cell">
                    <span className="pmh-mini">Di Data Pegawai</span>
                    {nilaiTeks(b.simKgb)}
                  </span>
                  <span className="pmh-panah" aria-hidden="true">→</span>
                  <span className="pmh-nilai" role="cell">
                    <span className="pmh-mini">Dari kiriman</span>
                    <span className={b.beda ? "pmh-baru" : undefined}>{nilaiTeks(b.kiriman)}</span>
                  </span>
                  <span className="pmh-tindak" role="cell">
                    {!b.beda ? (
                      <span className="pmh-sama">Sama</span>
                    ) : (
                      <span className="pmh-ket">
                        {b.jalur === "langsung" ? "Perbarui di Data Pegawai bila benar" : b.catatan ?? "Periksa di Data Pegawai"}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="pmh-bawah">
        {onLihatBerkas && kiriman.berkas.length > 0 && (
          <div className="pmh-berkas">
            <p className="pmh-subjudul">Berkas kiriman</p>
            <div className="pmh-berkas-daftar">
              {kiriman.berkas.map((b) => {
                const judul = b.jenis.replace(/-/g, " ");
                const diArsip = tersalin?.has(b.kunci) ?? false;
                return (
                  <div key={b.kunci} className="pmh-berkas-item">
                    <span className="dok-ikon" aria-hidden="true">PDF</span>
                    <span className="min-w-0 pmh-berkas-teks">
                      <strong>{judul}</strong>
                      <span>{diArsip ? "Sudah ada di arsip dokumen pegawai" : "Hanya di kiriman formulir"}</span>
                    </span>
                    <span className="pmh-berkas-aksi">
                      <button
                        type="button"
                        className="dok-tombol"
                        onClick={() => onLihatBerkas({ judul, url: `/api/inventarisasi/berkas?kunci=${encodeURIComponent(b.kunci)}` })}
                      >
                        Lihat
                      </button>
                      {bisaArsip &&
                        (diArsip ? (
                          <span className="pmh-diarsip">Di arsip ✓</span>
                        ) : (
                          <button
                            type="button"
                            className="dok-tombol"
                            data-nada="utama"
                            disabled={tersalin === null || menyalin !== null}
                            title="Salin berkas ini menjadi dokumen arsip milik pegawai"
                            onClick={() => void salin(b.kunci)}
                          >
                            {menyalin === b.kunci ? "Menyalin…" : "Simpan ke arsip"}
                          </button>
                        ))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="pmh-lain">
          <p className="pmh-subjudul">Isian lain dari kiriman</p>
          <dl>
            {lain.map(([dt, dd]) => (
              <div key={dt}>
                <dt>{dt}</dt>
                <dd>{dd}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {galat && (
        <p className="pmh-galat" role="alert">
          {galat}
        </p>
      )}

      {bolehUbah && (
        <div className="pmh-kaki">
          <label className="pmh-bidang">
            <span>Status tindak lanjut</span>
            <select className="dsb-cari" value={statusBaru} disabled={sibuk} onChange={(e) => setStatusBaru(e.target.value as StatusTindakLanjut)}>
              {(Object.keys(LABEL_TINDAK_LANJUT) as StatusTindakLanjut[]).map((s) => (
                <option key={s} value={s}>{LABEL_TINDAK_LANJUT[s]}</option>
              ))}
            </select>
          </label>
          <label className="pmh-bidang pmh-bidang-lebar">
            <span>Catatan {statusBaru === "perlu_perbaikan" ? "(wajib)" : "(opsional)"}</span>
            <input
              className="dsb-cari"
              value={catatan}
              disabled={sibuk}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="mis. Jabatan sudah diperbarui di Data Pegawai"
            />
          </label>
          <div className="pmh-kaki-tombol">
            <button type="button" className="dsb-tombol" data-jenis={tautanPegawai && pegawaiId ? "garis" : undefined} disabled={sibuk} onClick={() => void simpanStatus()}>
              {sibuk ? "Menyimpan…" : "Simpan status"}
            </button>
            {tautanPegawai && pegawaiId && (
              <a className="dsb-tombol" href={tautanPegawai} target="_blank" rel="noreferrer">
                Buka di Data Pegawai ↗
              </a>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
