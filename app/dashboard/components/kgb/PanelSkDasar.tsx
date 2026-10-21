"use client";

import { useEffect, useState } from "react";
import { Catatan, Memuat } from "./BidangForm";
import { isianDariSkGaji } from "./format";
import type { DataLinimasa } from "./linimasa";
import { unduhUlangSk, type DataDasarSk } from "@/lib/kgbAksi";
import type { SkGaji } from "@/lib/linimasaDasarSk";
import { kunciNomorSk } from "@/lib/nomorSurat";
import { formatTanggalId } from "@/lib/waktu";

/* Panel SK di sisi formulir Input KGB (ADR-121, ADR-122). Linimasa mendatar seluruh SK penetap gaji pokok pegawai (SK KGB
   terakhir, SK sesudahnya, dan KGB yang sedang dibuat); tiap titik membuka dokumen SK-nya dan perbandingannya dengan isian
   formulir. Dari sini operator memakai datanya, membetulkannya, atau mencatat SK yang belum ada, tanpa meninggalkan formulir. */

const KUNCI_KGB_INI = "kgb-ini";

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

/** Nama pendek jenis SK untuk titik linimasa. */
function namaPendek(sk: SkGaji): string {
  if (sk.jenis === "kp") return /penyesuaian ijazah/i.test(sk.label) ? "KP (PI)" : "KP";
  if (sk.jenis === "pmk") return "PMK";
  if (sk.jenis === "cpns") return "SK CPNS";
  return "SK KGB";
}

const tglPendek = (nilai: string | null) => (nilai ? formatTanggalId(nilai, { day: "numeric", month: "short", year: "numeric" }) : "TMT ?");

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
  bolehCatat,
  onPakai,
  onBetulkan,
  onCatat,
  onMuatUlang,
}: {
  /** null selama dimuat. */
  data: DataLinimasa | null;
  galat: string | null;
  /** Isian Atas dasar pada formulir. */
  isian: DataDasarSk;
  /** Pesan hasil pembetulan terakhir. */
  catatan?: string | null;
  /** SK mana yang datanya dapat dibetulkan dari panel ini (kenaikan pangkat, PMK, dan SK dasar Data Pegawai). */
  bolehBetulkan: (sk: SkGaji) => boolean;
  /** Mencatat SK kenaikan pangkat atau PMK yang belum ada. */
  bolehCatat: boolean;
  onPakai: (isian: DataDasarSk) => void;
  onBetulkan: (sk: SkGaji) => void;
  onCatat: (jenis: "kp" | "pmk") => void;
  onMuatUlang: () => void;
}) {
  const linimasa = data?.linimasa ?? null;
  const [dipilih, setDipilih] = useState<string | null>(null);

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

  const dokumen = data?.dokumen ?? null;
  const tmtKgbIni = data?.tmtKgbBaru ?? null;
  // Urutan garis waktu: SK sebelum TMT KGB ini, titik KGB ini, lalu SK yang berlaku sesudahnya.
  const sebelum = linimasa.sk.filter((s) => s.peran !== "sesudah");
  const sesudah = linimasa.sk.filter((s) => s.peran === "sesudah");
  const skKgbTerakhir = [...sebelum].reverse().find((s) => s.jenis === "kgb") ?? null;
  const sk = linimasa.sk.find((s) => s.kunci === dipilih) ?? linimasa.dasar ?? linimasa.sk[linimasa.sk.length - 1] ?? null;
  const kgbIniDipilih = dipilih === KUNCI_KGB_INI;

  // SK yang datanya belum lengkap atau belum berpindaian ditandai agar terlihat apa yang perlu disesuaikan.
  const kurang = (s: SkGaji): string | null => {
    const masalah: string[] = [];
    if (!s.nomorSK?.trim()) masalah.push("nomor belum tercatat");
    if (!s.tmt) masalah.push("TMT belum tercatat");
    if (!s.penetap?.trim()) masalah.push("penetap belum tercatat");
    if (dokumen && !dokumen[s.kunci]) masalah.push("belum ada pindaian");
    return masalah.length > 0 ? masalah.join(", ") : null;
  };
  const caption = (s: SkGaji) =>
    s.peran === "dasar" ? "Dasar KGB ini" : s.peran === "sesudah" ? "Sesudahnya" : s === skKgbTerakhir ? "SK KGB terakhir" : "Tergantikan";

  const titik = (s: SkGaji) => {
    const k = kurang(s);
    return (
      <li key={s.kunci} data-peran={s.peran}>
        <button
          type="button"
          className="kgbm-gw-node"
          aria-pressed={!kgbIniDipilih && sk?.kunci === s.kunci}
          aria-label={`${s.label}${s.nomorSK ? ` ${s.nomorSK}` : ""}, TMT ${tglPendek(s.tmt)}, ${caption(s)}${k ? `. Perlu disesuaikan: ${k}` : ""}`}
          onClick={() => setDipilih(s.kunci)}
        >
          <span className="kgbm-gw-titik" data-kurang={k ? "" : undefined} aria-hidden="true">
            {k ? "!" : ""}
          </span>
          <span className="kgbm-gw-jenis">{namaPendek(s)}</span>
          <span className="kgbm-gw-tgl">{tglPendek(s.tmt)}</span>
          <span className="kgbm-gw-peran">{caption(s)}</span>
        </button>
      </li>
    );
  };

  const target = sk ? isianDariSkGaji(sk) : null;
  const semuaSama = !!target && BARIS_BANDING.every((b) => !target[b.kolom].trim() || samaIsian(b.kolom, target[b.kolom], isian[b.kolom]));
  const kurangSk = sk ? kurang(sk) : null;
  // SK yang sama dengan yang disebut isian: catatan yang kosong tidak mengosongkan isian operator. SK lain: diganti
  // seluruhnya, sebab penetap SK lama tidak boleh terbawa ke SK baru (kosong lebih aman daripada pejabat yang keliru).
  const samaSk = !!target && !!kunciNomorSk(target.nomorSK) && kunciNomorSk(target.nomorSK) === kunciNomorSk(isian.nomorSK);
  const isianPakai: DataDasarSk | null = !target
    ? null
    : samaSk
      ? {
          nomorSK: target.nomorSK || isian.nomorSK,
          tanggalSK: target.tanggalSK || isian.tanggalSK,
          tmtSK: target.tmtSK || isian.tmtSK,
          penetapSkDasar: target.penetapSkDasar || isian.penetapSkDasar,
        }
      : target;

  return (
    <>
      <div className="kgbm-skp-kepala">
        <strong>Linimasa SK penetap gaji pokok</strong>
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

      <ol className="kgbm-gw" aria-label="SK penetap gaji pokok menurut TMT, dari terlama ke terbaru">
        {sebelum.map(titik)}
        {tmtKgbIni && (
          <li data-peran="kgb-ini">
            <button type="button" className="kgbm-gw-node" aria-pressed={kgbIniDipilih} onClick={() => setDipilih(KUNCI_KGB_INI)}>
              <span className="kgbm-gw-titik" data-bentuk="belah-ketupat" aria-hidden="true" />
              <span className="kgbm-gw-jenis">KGB ini</span>
              <span className="kgbm-gw-tgl">{tglPendek(tmtKgbIni)}</span>
              <span className="kgbm-gw-peran">yang sedang dibuat</span>
            </button>
          </li>
        )}
        {sesudah.map(titik)}
      </ol>

      {linimasa.sk.length === 0 && <Catatan>Belum ada SK penetap gaji pokok yang tercatat untuk pegawai ini.</Catatan>}

      {bolehCatat && (
        <div className="kgbm-gw-catat">
          <span>{sesudah.length === 0 ? "Belum ada SK sesudahnya? " : "SK lain belum tercatat? "}</span>
          <button type="button" className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil" onClick={() => onCatat("kp")}>
            + Catat kenaikan pangkat
          </button>
          <button type="button" className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil" onClick={() => onCatat("pmk")}>
            + Catat PMK
          </button>
        </div>
      )}

      {kgbIniDipilih && (
        <Catatan nada="navy">
          KGB yang sedang dibuat, TMT {tmtKgbIni ? formatTanggalId(tmtKgbIni) : "-"}. SK yang menjadi dasarnya adalah SK terbaru yang
          menetapkan gaji pokok sebelum TMT itu: {linimasa.dasar ? `${linimasa.dasar.label}${linimasa.dasar.nomorSK ? ` ${linimasa.dasar.nomorSK}` : ""}` : "belum ada"}.
        </Catatan>
      )}

      {!kgbIniDipilih && sk && target && (
        <>
          <div className="kgbm-skp-sorot">
            <strong>
              {sk.label}
              {sk.nomorSK ? ` ${sk.nomorSK}` : ""}
            </strong>
            <span>
              {caption(sk)}
              {sk.rincian ? ` · ${sk.rincian}` : ""}
            </span>
          </div>
          {kurangSk && <Catatan nada="amber">Perlu disesuaikan: {kurangSk}.</Catatan>}
          <PratinjauSk key={sk.kunci} sk={sk} dokumen={dokumen} />
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
          {sk.peran !== "dasar" && !semuaSama && (
            <Catatan nada="amber">
              SK ini bukan {sk.peran === "sesudah" ? "yang berlaku sebelum TMT KGB ini" : "SK terbaru yang menetapkan gaji pokok"}. Menjadikannya
              Atas dasar menyimpang dari aturan; saat Buat SK, sistem menawarkan SK terbaru lagi, dan pilih Kembalikan di sana bila
              itu memang disengaja.
            </Catatan>
          )}
          <div className="kgbm-baris-tombol">
            <button type="button" className="kgbm-tombol kgbm-utama kgbm-tombol-kecil" disabled={semuaSama} onClick={() => isianPakai && onPakai(isianPakai)}>
              {semuaSama ? "Isian sudah sama" : sk.peran === "dasar" ? "Pakai data SK ini" : "Jadikan Atas dasar"}
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
