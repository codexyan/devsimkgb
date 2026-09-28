"use client";

import { useState } from "react";
import { LABEL_TINDAK_LANJUT, type BarisBanding, type StatusTindakLanjut } from "@/lib/pemutakhiranPegawai";
import type { KirimanInventaris } from "@/lib/inventarisServer";
import { LABEL_KEADAAN } from "@/lib/inventarisKgb";
import { formatTanggalId } from "@/lib/waktu";

/* Satu kiriman formulir pemutakhiran data beserta perbandingannya dengan Data Pegawai (ADR-023, ADR-024).
   Dipakai di dua tempat: panel Periksa pada menu Inventarisasi, dan tab Dokumen & Pemutakhiran di halaman pegawai.

   Isian yang dapat diterapkan langsung (nama, tempat dan tanggal lahir, jabatan, SK dasar) dapat disunting di
   tempat sebelum diterapkan, misalnya untuk membetulkan salah ketik pegawai; menyunting sebuah isian otomatis
   mencentangnya. Golongan dan masa kerja tidak diterapkan langsung, melainkan lewat Catat kenaikan pangkat atau
   PMK, supaya riwayat dan jadwal KGB tetap konsisten.

   Perbandingan ditata sebagai baris kisi, bukan tabel: di layar sempit tiap isian menjadi satu blok bertumpuk
   sehingga tidak ada gulir mendatar. Di dalam modal, kaki kartu (status dan tombol terapkan) menempel di bawah
   area gulir supaya tetap terjangkau. */

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

export const NADA_STATUS: Record<StatusTindakLanjut, string> = {
  belum_diperiksa: "kuning",
  sesuai: "hijau",
  perlu_perbaikan: "merah",
  diterapkan: "biru",
};

const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const KOLOM_TANGGAL = new Set(["tanggalLahir", "tanggalSkDasar"]);
const tanggalTeks = (v: string) => (v ? formatTanggalId(v) : "");
const nilaiTeks = (v: string) => (TANGGAL.test(v) ? tanggalTeks(v) : v || "–");

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
  // Nilai yang akan diterapkan per isian; bermula dari isian kiriman dan dapat disunting Tim SDM.
  const [nilai, setNilai] = useState<Record<string, string>>(() =>
    Object.fromEntries(banding.filter((b) => b.kolom).map((b) => [b.kunci, b.nilaiBaru || b.simKgb])),
  );
  const [statusBaru, setStatusBaru] = useState<StatusTindakLanjut>(status === "belum_diperiksa" ? "sesuai" : status);
  const [catatan, setCatatan] = useState(kiriman.tindakLanjut?.catatan ?? "");
  const [sibuk, setSibuk] = useState(false);

  const beda = banding.filter((b) => b.beda);
  const tampil = semua ? banding : beda;
  const bisaLangsung = (b: BarisBanding) => bolehUbah && b.jalur === "langsung" && !!b.kolom;
  const adaLangsung = tampil.some(bisaLangsung);
  // Tombol Catat KP/PMK cukup tampil sekali, pada baris pertama jalurnya.
  const pertamaJalur = new Map<string, string>();
  for (const b of tampil) if ((b.jalur === "kp" || b.jalur === "pmk") && b.beda && !pertamaJalur.has(b.jalur)) pertamaJalur.set(b.jalur, b.kunci);

  function centang(kunci: string, aktif: boolean) {
    setPilih((s) => {
      const baru = new Set(s);
      if (aktif) baru.add(kunci);
      else baru.delete(kunci);
      return baru;
    });
  }

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
    const dipilih = banding.filter((b) => bisaLangsung(b) && pilih.has(b.kunci));
    if (dipilih.length === 0) return;
    const kosong = dipilih.filter((b) => !(nilai[b.kunci] ?? "").trim());
    if (kosong.length > 0) {
      onGalat(`Isian ${kosong.map((b) => b.label.toLowerCase()).join(", ")} kosong. Isi dulu atau hapus centangnya.`);
      return;
    }
    if (!window.confirm(`Terapkan ${dipilih.length} isian ke Data Pegawai ${pegawai.nama}?`)) return;
    setSibuk(true);
    onGalat(null);
    try {
      // PATCH menerima perubahan sebagian (ADR-025): hanya kolom terpilih yang dikirim.
      const badan: Record<string, unknown> = {};
      for (const b of dipilih) badan[b.kolom!] = nilai[b.kunci].trim();
      const res = await fetch(`/api/pegawai/${pegawai.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Data Pegawai gagal diperbarui.");
      const disunting = dipilih.filter((b) => nilai[b.kunci].trim() !== b.nilaiBaru);
      const label = dipilih.map((b) => b.label.toLowerCase()).join(", ");
      const sisa = beda.filter((b) => !dipilih.includes(b)).length;
      const teks = `Diterapkan: ${label}${disunting.length > 0 ? ` (disunting: ${disunting.map((b) => b.label.toLowerCase()).join(", ")})` : ""}.${sisa > 0 ? ` ${sisa} isian lain belum.` : ""}`;
      await catatStatus(sisa === 0 ? "diterapkan" : status === "belum_diperiksa" ? "perlu_perbaikan" : status, teks).catch(() => {});
      setPilih(new Set());
      onBerhasil(`Data Pegawai diperbarui dari kiriman: ${label}.`);
    } catch (e) {
      onGalat(e instanceof Error ? e.message : "Data Pegawai gagal diperbarui.");
    } finally {
      setSibuk(false);
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

      <div className="pmh-ringkas">
        <span className="pmh-hitung" data-nada={beda.length > 0 ? "kuning" : "hijau"}>
          {beda.length > 0 ? (
            <>
              <strong>{beda.length}</strong> isian berbeda dari SIM-KGB
            </>
          ) : (
            "Semua isian sama dengan SIM-KGB"
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
            <span role="columnheader">Di SIM-KGB</span>
            <span aria-hidden="true" />
            <span role="columnheader">{bolehUbah ? "Dari kiriman (dapat disunting)" : "Dari kiriman"}</span>
            <span role="columnheader">Tindak lanjut</span>
          </div>
          {tampil.map((b) => {
            const sunting = bisaLangsung(b);
            const dipilih = pilih.has(b.kunci);
            return (
              <div key={b.kunci} className="pmh-baris" role="row" data-beda={b.beda ? "" : undefined} data-pilih={dipilih ? "" : undefined}>
                <span className="pmh-label" role="rowheader">{b.label}</span>
                <span className="pmh-lama" role="cell">
                  <span className="pmh-mini">Di SIM-KGB</span>
                  {nilaiTeks(b.simKgb)}
                </span>
                <span className="pmh-panah" aria-hidden="true">→</span>
                <span className="pmh-nilai" role="cell">
                  <span className="pmh-mini">Dari kiriman</span>
                  {sunting ? (
                    <input
                      className="pmh-isian"
                      type={KOLOM_TANGGAL.has(b.kolom!) ? "date" : "text"}
                      value={nilai[b.kunci] ?? ""}
                      aria-label={`${b.label} yang akan diterapkan`}
                      disabled={sibuk}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNilai((n) => ({ ...n, [b.kunci]: v }));
                        centang(b.kunci, true);
                      }}
                    />
                  ) : (
                    <span className={b.beda ? "pmh-baru" : undefined}>{nilaiTeks(b.kiriman)}</span>
                  )}
                </span>
                <span className="pmh-tindak" role="cell">
                  {sunting ? (
                    <label className="pmh-terapkan">
                      <input type="checkbox" className="dsb-cek" checked={dipilih} disabled={sibuk} onChange={(e) => centang(b.kunci, e.target.checked)} />
                      Terapkan
                    </label>
                  ) : !b.beda ? (
                    <span className="pmh-sama">Sama</span>
                  ) : (
                    <>
                      {b.catatan && <span className="pmh-ket">{b.catatan}</span>}
                      {bolehUbah && (b.jalur === "kp" || b.jalur === "pmk") && pertamaJalur.get(b.jalur) === b.kunci && (
                        <button type="button" className="pmh-catat" disabled={sibuk} onClick={() => onCatat(b.jalur as "kp" | "pmk")}>
                          {b.jalur === "kp" ? "Catat kenaikan pangkat…" : "Catat PMK…"}
                        </button>
                      )}
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="pmh-bawah">
        {onLihatBerkas && kiriman.berkas.length > 0 && (
          <div className="pmh-berkas">
            <p className="pmh-subjudul">Berkas kiriman</p>
            <div className="pmh-berkas-daftar">
              {kiriman.berkas.map((b) => (
                <button
                  key={b.kunci}
                  type="button"
                  className="pmh-berkas-item"
                  onClick={() =>
                    onLihatBerkas({ judul: b.jenis.replace(/-/g, " "), url: `/api/inventarisasi/berkas?kunci=${encodeURIComponent(b.kunci)}` })
                  }
                >
                  <span className="dok-ikon" aria-hidden="true">PDF</span>
                  <span className="min-w-0">
                    <strong>{b.jenis.replace(/-/g, " ")}</strong>
                    <span>Lihat berkas</span>
                  </span>
                </button>
              ))}
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
            placeholder="mis. MKG masih golongan II; minta pegawai mengirim ulang"
          />
        </label>
        <div className="pmh-kaki-tombol">
          <button type="button" className="dsb-tombol" data-jenis="garis" disabled={sibuk} onClick={() => void simpanStatus()}>
            Simpan status
          </button>
          {adaLangsung && (
            <button type="button" className="dsb-tombol" disabled={sibuk || pilih.size === 0} onClick={() => void terapkan()}>
              {sibuk ? "Menyimpan…" : pilih.size > 0 ? `Terapkan ${pilih.size} isian ke Data Pegawai` : "Centang isian untuk diterapkan"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
