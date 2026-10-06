"use client";

import { useState } from "react";
import KerangkaModal from "./KerangkaModal";
import ModalPratinjauBerkas from "./ModalPratinjauBerkas";
import { Catatan, Lencana, Memuat } from "./BidangForm";
import { IkonRiwayat } from "./ikon";
import { bandingkanDasarSk, subjudulPegawai, type RingkasPegawai } from "./format";
import type { DataLinimasa } from "./linimasa";
import { unduhUlangSk, type DataDasarSk } from "@/lib/kgbAksi";
import type { SkGaji } from "@/lib/linimasaDasarSk";
import type { DokumenSk } from "@/lib/dokumenLinimasa";
import { formatTanggalId } from "@/lib/waktu";

/**
 * Linimasa SK penetap gaji pokok (ADR-062): seluruh SK KGB, kenaikan pangkat (termasuk penyesuaian ijazah), dan PMK
 * pegawai menurut TMT-nya, dari yang terlama ke yang terbaru, dengan SK yang menjadi Atas dasar KGB ini ditandai dan
 * diringkas di atas. Dibuka dari bagian Atas Dasar SK Terakhir di Input KGB dan Buat SK, di atas modal itu, supaya Tim
 * SDM dapat memeriksa mengapa SK itu yang terpilih. Tiap SK dapat dibuka dokumennya dalam jendela pratinjau (ADR-066).
 */
export default function ModalLinimasaDasar({
  pegawai,
  data,
  galat,
  isian,
  onPakai,
  onMuatUlang,
  onTutup,
}: {
  pegawai: RingkasPegawai;
  /** null selama dimuat. */
  data: DataLinimasa | null;
  galat?: string | null;
  /** Isian Atas dasar pada formulir; dibandingkan dengan SK terbaru menurut linimasa. */
  isian?: DataDasarSk;
  /** Mengisi Atas dasar pada formulir. */
  onPakai?: (isian: DataDasarSk) => void;
  onMuatUlang?: () => void;
  onTutup: () => void;
}) {
  const linimasa = data?.linimasa ?? null;
  const banding = linimasa && isian ? bandingkanDasarSk(isian, linimasa) : null;
  // SK yang TMT-nya tidak tercatat tidak dapat diletakkan di garis waktu; dikelompokkan di bawah, kecuali bila justru
  // SK itulah dasarnya.
  const tanpaTmt = linimasa?.sk.filter((s) => !s.tmt && s.peran !== "dasar") ?? [];
  const bertmt = linimasa?.sk.filter((s) => !tanpaTmt.includes(s)) ?? [];
  const sebelum = bertmt.filter((s) => s.peran !== "sesudah");
  const sesudah = bertmt.filter((s) => s.peran === "sesudah");
  const dokumen = data?.dokumen ?? null;

  const [pratinjau, setPratinjau] = useState<{ judul: string; subjudul: string; url: string; lokal: boolean } | null>(null);
  const [memuatDraf, setMemuatDraf] = useState<string | null>(null);
  const [galatDraf, setGalatDraf] = useState<string | null>(null);

  async function lihat(sk: SkGaji, dok: DokumenSk) {
    const judul = `${sk.label}${sk.nomorSK ? ` ${sk.nomorSK}` : ""}`;
    setGalatDraf(null);
    if (dok.jenis === "berkas") {
      setPratinjau({ judul, subjudul: dok.sumber, url: dok.url, lokal: false });
      return;
    }
    // SK yang belum diunggah bertanda tangan dicetak ulang dari data surat yang tersimpan, sama dengan Riwayat KGB.
    setMemuatDraf(sk.kunci);
    const hasil = await unduhUlangSk(dok.kgbId);
    setMemuatDraf(null);
    if (!hasil.ok) {
      setGalatDraf(hasil.error);
      return;
    }
    setPratinjau({ judul, subjudul: dok.sumber, url: URL.createObjectURL(hasil.data), lokal: true });
  }

  function tutupPratinjau() {
    // Blob URL draf cetakan dicabut agar memorinya dilepas.
    if (pratinjau?.lokal) URL.revokeObjectURL(pratinjau.url);
    setPratinjau(null);
  }

  const tombol = (s: SkGaji) => (
    <TombolDokumen
      dok={dokumen ? (dokumen[s.kunci] ?? null) : undefined}
      memuat={memuatDraf === s.kunci}
      onLihat={(dok) => void lihat(s, dok)}
    />
  );

  return (
    <KerangkaModal
      judul="Linimasa SK penetap gaji pokok"
      subjudul={subjudulPegawai(pegawai)}
      ikon={<IkonRiwayat />}
      nada="navy"
      onTutup={onTutup}
      kaki={
        <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} data-autofocus>
          Tutup
        </button>
      }
    >
      <Catatan nada="navy">
        Atas dasar SK KGB adalah <strong>SK terbaru yang menetapkan gaji pokok sebelum TMT KGB ini</strong>: SK KGB, SK
        kenaikan pangkat (termasuk penyesuaian ijazah), atau SK PMK. Linimasa di bawah berurutan dari SK terlama ke yang
        terbaru; SK yang berlaku sesudah TMT KGB ini belum dihitung.
      </Catatan>

      {galat ? (
        <Catatan nada="merah">
          {galat}{" "}
          {onMuatUlang && (
            <button type="button" className="kgbm-tautan" onClick={onMuatUlang}>
              Muat ulang
            </button>
          )}
        </Catatan>
      ) : !linimasa ? (
        <Memuat teks="Menyusun linimasa dari riwayat KGB, kenaikan pangkat, dan PMK..." />
      ) : (
        <>
          {data?.basi && <Catatan nada="merah">{data.basi}</Catatan>}
          {linimasa.kgbTanpaSk && (
            <Catatan nada="amber">
              KGB TMT {formatTanggalId(linimasa.kgbTanpaSk)} sudah tercatat pada data pegawai, tetapi SK-nya belum tercatat
              di SIM-KGB, sehingga dasar di bawah mungkin sudah usang. Rekam SK itu lewat Ubah SK dasar di Data Pegawai,
              atau sebagai Arsip KGB.
            </Catatan>
          )}
          {linimasa.dasar && (
            <div className="kgbm-linimasa-ringkas" role="group" aria-label="Atas dasar SK KGB ini">
              <span>Atas dasar SK KGB ini</span>
              <strong>
                {linimasa.dasar.label}
                {linimasa.dasar.nomorSK ? ` ${linimasa.dasar.nomorSK}` : ""}
              </strong>
              <span>
                {linimasa.dasar.tmt ? `TMT ${formatTanggalId(linimasa.dasar.tmt)}` : "TMT tidak tercatat"}
                {linimasa.dasar.tanggalSK ? ` · ditetapkan ${formatTanggalId(linimasa.dasar.tanggalSK)}` : ""}
              </span>
              {tombol(linimasa.dasar)}
            </div>
          )}
          {dokumen === null && (
            <Catatan>Daftar dokumen pegawai gagal dimuat, jadi dokumen tiap SK belum dapat dibuka. Linimasanya tetap benar.</Catatan>
          )}
          {galatDraf && <Catatan nada="merah">{galatDraf}</Catatan>}
          {linimasa.sk.length === 0 && !data?.tmtKgbBaru ? (
            <Catatan>Belum ada SK penetap gaji pokok yang tercatat untuk pegawai ini.</Catatan>
          ) : (
            <ol className="kgbm-linimasa" aria-label="SK penetap gaji pokok menurut TMT">
              {sebelum.map((s) => (
                <ButirSk key={s.kunci} sk={s} aksi={tombol(s)} />
              ))}
              {data?.tmtKgbBaru && (
                <li className="kgbm-linimasa-kgb">
                  <span className="kgbm-linimasa-titik" aria-hidden="true" />
                  <div className="kgbm-linimasa-isi">
                    <span>KGB yang sedang dibuat · TMT {formatTanggalId(data.tmtKgbBaru)}</span>
                  </div>
                </li>
              )}
              {sesudah.map((s) => (
                <ButirSk key={s.kunci} sk={s} aksi={tombol(s)} />
              ))}
            </ol>
          )}
          {tanpaTmt.length > 0 && (
            <>
              <p className="kgbm-linimasa-kelompok">TMT tidak tercatat · tidak dapat diletakkan di garis waktu</p>
              <ol className="kgbm-linimasa" aria-label="SK penetap gaji pokok tanpa TMT">
                {tanpaTmt.map((s) => (
                  <ButirSk key={s.kunci} sk={s} aksi={tombol(s)} />
                ))}
              </ol>
            </>
          )}
          {linimasa.dasar && banding && <Perbandingan banding={banding} dasar={linimasa.dasar} isian={isian} onPakai={onPakai} />}
        </>
      )}
      {pratinjau && (
        <ModalPratinjauBerkas judul={pratinjau.judul} subjudul={pratinjau.subjudul} url={pratinjau.url} onTutup={tutupPratinjau} />
      )}
    </KerangkaModal>
  );
}

/**
 * Tombol dokumen satu SK. `dok` undefined: daftar dokumen gagal dimuat; null: belum ada pindaiannya.
 */
function TombolDokumen({
  dok,
  memuat,
  onLihat,
}: {
  dok: DokumenSk | null | undefined;
  memuat: boolean;
  onLihat: (dok: DokumenSk) => void;
}) {
  if (dok === undefined) return null;
  if (dok === null) return <span className="kgbm-linimasa-dok">Belum ada pindaian SK ini di SIM-KGB</span>;
  return (
    <span className="kgbm-linimasa-dok">
      <button type="button" className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil" disabled={memuat} onClick={() => onLihat(dok)}>
        {memuat ? "Mencetak draf…" : dok.jenis === "draf" ? "Lihat draf SK" : "Lihat dokumen"}
      </button>
      <span>{dok.sumber}</span>
    </span>
  );
}

function ButirSk({ sk, aksi }: { sk: SkGaji; aksi?: React.ReactNode }) {
  return (
    <li data-peran={sk.peran}>
      <span className="kgbm-linimasa-titik" aria-hidden="true" />
      <div className="kgbm-linimasa-isi">
        <div className="kgbm-linimasa-kepala">
          <strong>{sk.label}</strong>
          {sk.peran === "dasar" && <Lencana nada="navy">Dasar KGB ini</Lencana>}
          {sk.peran === "tergantikan" && <Lencana>Tergantikan</Lencana>}
          {sk.peran === "sesudah" && <Lencana>Sesudah TMT KGB ini</Lencana>}
          {sk.dataPegawai && <Lencana>Data Pegawai</Lencana>}
        </div>
        <dl className="kgbm-item-data">
          <div>
            <dt>TMT</dt>
            <dd>{sk.tmt ? formatTanggalId(sk.tmt) : "tidak tercatat"}</dd>
          </div>
          <div>
            <dt>Nomor</dt>
            <dd>{sk.nomorSK ?? "belum tercatat"}</dd>
          </div>
          <div>
            <dt>Tanggal</dt>
            <dd>{sk.tanggalSK ? formatTanggalId(sk.tanggalSK) : "-"}</dd>
          </div>
          <div>
            <dt>Oleh</dt>
            <dd>{sk.penetap ?? "belum tercatat"}</dd>
          </div>
          {sk.rincian && (
            <div>
              <dt>Isi</dt>
              <dd>{sk.rincian}</dd>
            </div>
          )}
        </dl>
        {aksi}
      </div>
    </li>
  );
}

/** Isian pada formulir dibandingkan dengan SK yang menjadi dasar menurut linimasa. */
function Perbandingan({
  banding,
  dasar,
  isian,
  onPakai,
}: {
  banding: ReturnType<typeof bandingkanDasarSk>;
  dasar: SkGaji;
  isian?: DataDasarSk;
  onPakai?: (isian: DataDasarSk) => void;
}) {
  if (banding.jenis === "sama") return <Catatan nada="hijau">Isian Atas dasar pada formulir sudah menyebut SK ini.</Catatan>;
  if (banding.jenis === "tetap")
    return (
      <Catatan>
        Isian pada formulir menyebut {isian?.nomorSK ? `SK ${isian.nomorSK}` : "SK lain"}
        {isian?.tmtSK ? ` (TMT ${formatTanggalId(isian.tmtSK)})` : ""}, yang belum tercatat di linimasa ini atau sama
        barunya. Isian itu dibiarkan; pastikan sesuai dokumen SK-nya.
      </Catatan>
    );
  return (
    <Catatan nada="amber">
      {banding.jenis === "lebih-baru"
        ? `Isian pada formulir ${isian?.nomorSK ? `menyebut SK ${isian.nomorSK}` : "masih kosong"}, padahal SK terbaru yang menetapkan gaji pokok adalah ${dasar.label}${dasar.nomorSK ? ` ${dasar.nomorSK}` : ""}.`
        : `Isian pada formulir menyebut SK ini dengan isian berbeda: ${banding.beda.map((b) => `${b.label} “${b.baru}”`).join(", ")}.`}{" "}
      {onPakai && (
        <button type="button" className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil" onClick={() => onPakai(banding.isian)}>
          Pakai SK ini
        </button>
      )}
    </Catatan>
  );
}
