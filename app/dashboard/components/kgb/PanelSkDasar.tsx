"use client";

import { useEffect, useState } from "react";
import { Catatan, Lencana, Memuat } from "./BidangForm";
import { isianDariSkGaji } from "./format";
import type { DataLinimasa } from "./linimasa";
import { unduhUlangSk, type DataDasarSk } from "@/lib/kgbAksi";
import type { SkGaji } from "@/lib/linimasaDasarSk";
import { kunciNomorSk } from "@/lib/nomorSurat";
import { formatTanggalId } from "@/lib/waktu";

/* Panel SK di sisi formulir Input KGB (ADR-121). Seluruh SK penetap gaji pokok pegawai (SK KGB, kenaikan pangkat, PMK)
   dalam satu daftar, dengan dokumen SK yang dipilih tampil langsung di bawahnya dan perbandingan isiannya dengan isian
   formulir. Operator memeriksa dokumen, memakai datanya, atau membetulkan data SK-nya tanpa meninggalkan formulir. */

const LABEL_PERAN: Record<SkGaji["peran"], string> = {
  dasar: "Dasar KGB ini",
  tergantikan: "Tergantikan",
  sesudah: "Sesudah TMT KGB ini",
};

const BARIS_BANDING: { label: string; kolom: keyof DataDasarSk }[] = [
  { label: "Nomor", kolom: "nomorSK" },
  { label: "Tanggal", kolom: "tanggalSK" },
  { label: "TMT", kolom: "tmtSK" },
  { label: "Oleh", kolom: "penetapSkDasar" },
];

const tampil = (kolom: keyof DataDasarSk, nilai: string) =>
  !nilai.trim() ? "-" : kolom === "tanggalSK" || kolom === "tmtSK" ? formatTanggalId(nilai) : nilai;

function samaIsian(kolom: keyof DataDasarSk, sk: string, form: string): boolean {
  if (kolom === "nomorSK") return kunciNomorSk(sk) === kunciNomorSk(form);
  return sk.trim() === form.trim();
}

/** Tampilan dokumen SK yang dipilih; draf SK dicetak ulang dari data surat yang tersimpan. */
function PratinjauSk({ sk, dokumen }: { sk: SkGaji; dokumen: DataLinimasa["dokumen"] }) {
  const dok = dokumen ? (dokumen[sk.kunci] ?? null) : undefined;
  const [hasil, setHasil] = useState<{ kunci: string; url: string | null; galat: string | null } | null>(null);

  const kunciDok = dok ? (dok.jenis === "berkas" ? `berkas:${dok.url}` : `draf:${dok.kgbId}`) : "";
  useEffect(() => {
    if (!dok) return;
    if (dok.jenis === "berkas") return;
    let batal = false;
    let blobUrl: string | null = null;
    void unduhUlangSk(dok.kgbId).then((h) => {
      if (batal) return;
      if (!h.ok) return setHasil({ kunci: kunciDok, url: null, galat: h.error });
      blobUrl = URL.createObjectURL(h.data);
      setHasil({ kunci: kunciDok, url: blobUrl, galat: null });
    });
    return () => {
      batal = true;
      // Blob URL draf cetakan dicabut agar memorinya dilepas.
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // dok berganti hanya bersama kunciDok.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciDok]);

  if (dok === undefined)
    return <div className="kgbm-skp-kosong">Daftar dokumen pegawai gagal dimuat, jadi dokumen SK belum dapat dibuka.</div>;
  if (dok === null)
    return <div className="kgbm-skp-kosong">Belum ada pindaian SK ini di SIM-KGB. Unggah lewat tab Dokumen di Data Pegawai.</div>;
  if (dok.jenis === "berkas")
    return (
      <>
        <div className="kgbm-skp-viewer">
          <iframe src={dok.url} title={`Dokumen ${sk.label}`} />
        </div>
        <a className="kgbm-tautan" href={dok.url} target="_blank" rel="noopener noreferrer">
          Buka di tab baru · {dok.sumber}
        </a>
      </>
    );
  const siap = hasil?.kunci === kunciDok ? hasil : null;
  if (!siap) return <Memuat teks="Mencetak draf SK..." />;
  if (siap.galat) return <div className="kgbm-skp-kosong">{siap.galat}</div>;
  return (
    <>
      <div className="kgbm-skp-viewer">
        <iframe src={siap.url ?? undefined} title={`Draf ${sk.label}`} />
      </div>
      <span className="kgbm-skp-sumber">{dok.sumber}</span>
    </>
  );
}

export default function PanelSkDasar({
  data,
  galat,
  isian,
  catatan,
  bolehBetulkan,
  onPakai,
  onBetulkan,
  onMuatUlang,
}: {
  /** null selama dimuat. */
  data: DataLinimasa | null;
  galat: string | null;
  /** Isian Atas dasar pada formulir. */
  isian: DataDasarSk;
  /** Pesan hasil pembetulan terakhir. */
  catatan?: string | null;
  /** SK mana yang datanya dapat dibetulkan dari panel ini (kenaikan pangkat dan PMK). */
  bolehBetulkan: (sk: SkGaji) => boolean;
  onPakai: (isian: DataDasarSk) => void;
  onBetulkan: (sk: SkGaji) => void;
  onMuatUlang: () => void;
}) {
  const linimasa = data?.linimasa ?? null;
  const [dipilih, setDipilih] = useState<string | null>(null);
  const daftar = linimasa ? [...linimasa.sk].reverse() : [];
  // Tanpa pilihan, yang tampil SK yang menjadi dasar KGB ini; bila pilihan lama sudah tidak ada (sesudah pembetulan),
  // kembali ke dasar.
  const sk = daftar.find((s) => s.kunci === dipilih) ?? linimasa?.dasar ?? daftar[0] ?? null;

  if (galat)
    return (
      <Catatan nada="merah">
        {galat}{" "}
        <button type="button" className="kgbm-tautan" onClick={onMuatUlang}>
          Muat ulang
        </button>
      </Catatan>
    );
  if (!linimasa) return <Memuat teks="Menyusun SK penetap gaji pokok..." />;
  if (daftar.length === 0) return <Catatan>Belum ada SK penetap gaji pokok yang tercatat untuk pegawai ini.</Catatan>;

  const target = sk ? isianDariSkGaji(sk) : null;
  const semuaSama = !!target && BARIS_BANDING.every((b) => !target[b.kolom].trim() || samaIsian(b.kolom, target[b.kolom], isian[b.kolom]));

  return (
    <>
      <div className="kgbm-skp-kepala">
        <strong>SK penetap gaji pokok</strong>
        <button type="button" className="kgbm-tautan" onClick={onMuatUlang}>
          Muat ulang
        </button>
      </div>
      {catatan && <Catatan nada="hijau">{catatan}</Catatan>}
      {data?.basi && <Catatan nada="merah">{data.basi}</Catatan>}
      {linimasa.kgbTanpaSk && (
        <Catatan nada="amber">
          KGB TMT {formatTanggalId(linimasa.kgbTanpaSk)} sudah tercatat pada data pegawai, tetapi SK-nya belum tercatat di SIM-KGB,
          sehingga dasar di bawah mungkin sudah usang.
        </Catatan>
      )}
      <ul className="kgbm-skp-daftar" aria-label="SK penetap gaji pokok, terbaru di atas">
        {daftar.map((s) => (
          <li key={s.kunci}>
            <button type="button" className="kgbm-skp-butir" aria-pressed={sk?.kunci === s.kunci} onClick={() => setDipilih(s.kunci)}>
              <span className="kgbm-skp-judul">
                {s.label}
                {s.nomorSK ? ` ${s.nomorSK}` : ""}
                <Lencana nada={s.peran === "dasar" ? "navy" : "netral"}>{LABEL_PERAN[s.peran]}</Lencana>
              </span>
              <span className="kgbm-skp-meta">
                {s.tmt ? `TMT ${formatTanggalId(s.tmt)}` : "TMT tidak tercatat"}
                {s.tanggalSK ? ` · SK ${formatTanggalId(s.tanggalSK)}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {sk && target && (
        <>
          <PratinjauSk key={sk.kunci} sk={sk} dokumen={data?.dokumen ?? null} />
          <table className="kgbm-skp-banding">
            <thead>
              <tr>
                <th />
                <th>SK ini</th>
                <th>Isian formulir</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {BARIS_BANDING.map((b) => {
                const sama = !target[b.kolom].trim() || samaIsian(b.kolom, target[b.kolom], isian[b.kolom]);
                return (
                  <tr key={b.kolom}>
                    <th scope="row">{b.label}</th>
                    <td>{tampil(b.kolom, target[b.kolom])}</td>
                    <td>{tampil(b.kolom, isian[b.kolom])}</td>
                    <td data-sama={sama ? "ya" : "tidak"} aria-label={sama ? "sama" : "berbeda"}>
                      {sama ? "✓" : "≠"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="kgbm-baris-tombol">
            <button type="button" className="kgbm-tombol kgbm-utama kgbm-tombol-kecil" disabled={semuaSama} onClick={() => onPakai(target)}>
              {semuaSama ? "Isian sudah sama" : "Pakai data SK ini"}
            </button>
            {bolehBetulkan(sk) && (
              <button type="button" className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil" onClick={() => onBetulkan(sk)}>
                Betulkan data SK
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}
