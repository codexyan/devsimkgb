"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ModalPratinjauBerkas } from "@/app/dashboard/components/kgb";
import type { BagianUbah, PegawaiUbah } from "@/app/dashboard/components/pegawai/ModalUbahPegawai";
import { DOKUMEN_TINDAKAN, LABEL_SUMBER_DOKUMEN, type DokumenPegawai, type TindakanDokumen } from "@/lib/dokumenPegawai";
import { GOLONGAN_PANGKAT } from "@/lib/tabelGaji";
import { formatTanggalId } from "@/lib/waktu";

/* Tab "Data pegawai" (ADR-028): seluruh data induk pegawai dalam empat kartu, yaitu Identitas, Kepegawaian, Dasar KGB,
   dan Status & mutasi. Tiap kartu punya tombol ubah ke modal tindakannya dan menampilkan dokumen arsip yang
   terkait, supaya data dan SK-nya terlihat berdampingan tanpa membuka modal. Dokumen hanya untuk Super Admin dan
   Tim SDM KGB. */

export type TindakanPegawai = BagianUbah | "kp" | "pmk" | "mutasi";

interface RiwayatMutasi {
  id: string;
  label: string;
  satkerTujuan: string | null;
  tmt: string | null;
  nomorSK: string | null;
  alasan: string | null;
}

const tgl = (v: string | null | undefined) => (v ? formatTanggalId(v) : "–");
const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children || "–"}</dd>
    </div>
  );
}

export default function TabDataPegawai({
  pegawai,
  bolehUbah,
  bolehDokumen,
  versi,
  onTindakan,
  onSemuaDokumen,
}: {
  pegawai: PegawaiUbah;
  bolehUbah: boolean;
  bolehDokumen: boolean;
  /** Naik setiap data pegawai berubah, supaya dokumen dan riwayat mutasi dimuat ulang. */
  versi: number;
  onTindakan: (t: TindakanPegawai) => void;
  onSemuaDokumen: () => void;
}) {
  const [dokumen, setDokumen] = useState<DokumenPegawai[] | null>(null);
  const [mutasi, setMutasi] = useState<RiwayatMutasi[] | null>(null);
  const [pratinjau, setPratinjau] = useState<DokumenPegawai | null>(null);

  useEffect(() => {
    let batal = false;
    if (bolehDokumen)
      fetch(`/api/pegawai/${pegawai.id}/dokumen`, { cache: "no-store" })
        .then(async (r) => (r.ok ? ((await r.json()) as DokumenPegawai[]) : []))
        .catch(() => [])
        .then((d) => !batal && setDokumen(d));
    fetch(`/api/pegawai/${pegawai.id}/mutasi`, { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as RiwayatMutasi[]) : []))
      .catch(() => [])
      .then((d) => !batal && setMutasi(Array.isArray(d) ? d : []));
    return () => {
      batal = true;
    };
  }, [pegawai.id, bolehDokumen, versi]);

  /** Dokumen arsip yang terkait satu kartu, terbaru lebih dulu. */
  const dokumenUntuk = (t: TindakanDokumen) =>
    (dokumen ?? [])
      .filter((d) => d.jenis && DOKUMEN_TINDAKAN[t].rujukan.includes(d.jenis))
      .sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""));

  const berhenti = !!pegawai.berhentiTmt;
  const status = berhenti
    ? `Berhenti TMT ${tgl(pegawai.berhentiTmt)}${pegawai.berhentiAlasan ? ` (${pegawai.berhentiAlasan})` : ""}`
    : pegawai.aktif === false
      ? "Nonaktif"
      : "Aktif";

  const kartu = (opsi: {
    judul: string;
    keterangan?: string;
    tindakan: TindakanDokumen;
    tombol?: { label: string; t: TindakanPegawai; utama?: boolean }[];
    children: ReactNode;
  }) => {
    const terkait = dokumenUntuk(opsi.tindakan);
    return (
      <section className="pgw-kartu" aria-label={opsi.judul}>
        <header className="pgw-kartu-kepala">
          <div className="min-w-0">
            <h2>{opsi.judul}</h2>
            {opsi.keterangan && <p>{opsi.keterangan}</p>}
          </div>
          {bolehUbah && opsi.tombol && (
            <div className="pgw-kartu-tombol">
              {opsi.tombol.map((b) => (
                <button key={b.t} type="button" className="dsb-tombol" data-jenis={b.utama ? undefined : "garis"} onClick={() => opsi.tombol && onTindakan(b.t)}>
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </header>
        <dl className="pgw-kartu-data">{opsi.children}</dl>
        {bolehDokumen && (
          <div className="pgw-kartu-dok">
            <span className="pgw-kartu-dok-judul">Dokumen</span>
            {!dokumen ? (
              <span className="pgw-kartu-dok-kosong">Memuat…</span>
            ) : terkait.length === 0 ? (
              <span className="pgw-kartu-dok-kosong">Belum ada di arsip</span>
            ) : (
              terkait.slice(0, 4).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="pgw-dok-chip"
                  title={`${d.judul}${d.nomorSK ? ` · ${d.nomorSK}` : ""} · ${LABEL_SUMBER_DOKUMEN[d.sumber]}`}
                  onClick={() => setPratinjau(d)}
                >
                  <span aria-hidden="true">PDF</span>
                  {d.judul}
                  {d.tanggal ? ` · ${formatTanggalId(d.tanggal, { day: "numeric", month: "short", year: "numeric" })}` : ""}
                </button>
              ))
            )}
            {terkait.length > 4 && (
              <button type="button" className="pgw-tautan" onClick={onSemuaDokumen}>
                +{terkait.length - 4} lainnya
              </button>
            )}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="pgw-data">
      <div className="pgw-data-kisi">
        {kartu({
          judul: "Identitas",
          tindakan: "identitas",
          tombol: [{ label: "Ubah", t: "identitas" }],
          children: (
            <>
              <Baris label="Nama lengkap">{pegawai.nama}</Baris>
              <Baris label="NIP">{pegawai.nip}</Baris>
              <Baris label="Tempat, tanggal lahir">
                {[pegawai.tempatLahir, pegawai.tanggalLahir ? formatTanggalId(pegawai.tanggalLahir) : ""].filter(Boolean).join(", ")}
              </Baris>
              <Baris label="Jenis kelamin">{pegawai.jenisKelamin}</Baris>
              <Baris label="Pendidikan terakhir">{pegawai.pendidikanTerakhir}</Baris>
            </>
          ),
        })}

        {kartu({
          judul: "Kepegawaian",
          tindakan: "kepegawaian",
          tombol: [{ label: "Ubah", t: "kepegawaian" }],
          children: (
            <>
              <Baris label="Jabatan">{pegawai.jabatan}</Baris>
              <Baris label="Jenis jabatan">{pegawai.jenisJabatan}</Baris>
              <Baris label="Eselon">{pegawai.eselon || "Non Eselon"}</Baris>
              <Baris label="Unit kerja">{pegawai.unitKerja}</Baris>
              {pegawai.satkerTugas && <Baris label="Bertugas (BKO) di">{pegawai.satkerTugas}</Baris>}
            </>
          ),
        })}

        {kartu({
          judul: "Dasar KGB",
          keterangan: "Golongan dan masa kerja berubah lewat Catat kenaikan pangkat atau PMK.",
          tindakan: "dasar",
          tombol: [
            { label: "Ubah SK dasar", t: "dasar" },
            { label: "Catat kenaikan pangkat", t: "kp" },
            { label: "Catat PMK", t: "pmk" },
          ],
          children: (
            <>
              <Baris label="Golongan">
                {pegawai.golonganRuang} · {GOLONGAN_PANGKAT[pegawai.golonganRuang as keyof typeof GOLONGAN_PANGKAT] ?? pegawai.pangkat ?? ""}
              </Baris>
              <Baris label="TMT golongan">{tgl(pegawai.tmtGolongan)}</Baris>
              <Baris label="Masa kerja golongan">{`${pegawai.mkgTahun} thn ${pegawai.mkgBulan} bln`}</Baris>
              <Baris label="Gaji pokok">{rupiah(pegawai.gajiPokok)}</Baris>
              <Baris label="TMT KGB terakhir">{tgl(pegawai.tmtKgbTerakhir)}</Baris>
              <Baris label="TMT KGB berikutnya">{tgl(pegawai.tmtKgbBerikutnya)}</Baris>
              <Baris label="SK dasar">
                {[pegawai.nomorSkDasar, pegawai.tanggalSkDasar ? formatTanggalId(pegawai.tanggalSkDasar) : ""].filter(Boolean).join(" · ")}
              </Baris>
              <Baris label="Ditetapkan oleh">{pegawai.penetapSkDasar}</Baris>
            </>
          ),
        })}

        {kartu({
          judul: "Status & mutasi",
          tindakan: berhenti ? "pemberhentian" : "mutasi",
          tombol: [{ label: "Mutasi atau pemberhentian", t: "mutasi" }],
          children: (
            <>
              <Baris label="Status">
                <span className="dsb-tag" data-nada={berhenti || pegawai.aktif === false ? "merah" : "hijau"}>{status}</span>
              </Baris>
              <Baris label="Satker">{pegawai.unitKerja}</Baris>
              <div className="pgw-kartu-lebar">
                <dt>Riwayat mutasi dan pemberhentian</dt>
                <dd>
                  {!mutasi ? (
                    "Memuat…"
                  ) : mutasi.length === 0 ? (
                    "Belum ada yang tercatat."
                  ) : (
                    <ul className="pgw-mutasi">
                      {mutasi.slice(0, 4).map((m) => (
                        <li key={m.id}>
                          <strong>{m.label}</strong> · TMT {tgl(m.tmt)}
                          <span>
                            {[m.satkerTujuan ? `ke ${m.satkerTujuan}` : "", m.alasan ?? "", m.nomorSK ? `SK ${m.nomorSK}` : ""].filter(Boolean).join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </dd>
              </div>
            </>
          ),
        })}
      </div>

      {pratinjau && (
        <ModalPratinjauBerkas
          judul={pratinjau.judul}
          subjudul={[pratinjau.nomorSK, pratinjau.tanggal ? formatTanggalId(pratinjau.tanggal) : "", LABEL_SUMBER_DOKUMEN[pratinjau.sumber]].filter(Boolean).join(" · ")}
          url={pratinjau.url}
          onTutup={() => setPratinjau(null)}
        />
      )}
    </div>
  );
}
