"use client";

import KerangkaModal from "./KerangkaModal";
import { Catatan, Lencana, Memuat } from "./BidangForm";
import { IkonRiwayat } from "./ikon";
import { bandingkanDasarSk, subjudulPegawai, type RingkasPegawai } from "./format";
import type { DataLinimasa } from "./linimasa";
import type { DataDasarSk } from "@/lib/kgbAksi";
import type { SkGaji } from "@/lib/linimasaDasarSk";
import { formatTanggalId } from "@/lib/waktu";

/**
 * Linimasa SK penetap gaji pokok (ADR-062): seluruh SK KGB, kenaikan pangkat (termasuk penyesuaian ijazah), dan PMK
 * pegawai menurut TMT-nya, dengan SK yang menjadi Atas dasar KGB ini ditandai. Dibuka dari bagian Atas Dasar SK Terakhir
 * di Input KGB dan Buat SK, di atas modal itu, supaya Tim SDM dapat memeriksa mengapa SK itu yang terpilih.
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
  const sebelum = linimasa?.sk.filter((s) => s.peran !== "sesudah") ?? [];
  const sesudah = linimasa?.sk.filter((s) => s.peran === "sesudah") ?? [];

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
        kenaikan pangkat (termasuk penyesuaian ijazah), atau SK PMK. SK yang berlaku sesudah TMT KGB ini belum dihitung.
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
          {linimasa.sk.length === 0 && !data?.tmtKgbBaru ? (
            <Catatan>Belum ada SK penetap gaji pokok yang tercatat untuk pegawai ini.</Catatan>
          ) : (
            <ol className="kgbm-linimasa" aria-label="SK penetap gaji pokok menurut TMT">
              {sebelum.map((s) => (
                <ButirSk key={s.kunci} sk={s} />
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
                <ButirSk key={s.kunci} sk={s} />
              ))}
            </ol>
          )}
          {linimasa.dasar && banding && <Perbandingan banding={banding} dasar={linimasa.dasar} isian={isian} onPakai={onPakai} />}
        </>
      )}
    </KerangkaModal>
  );
}

function ButirSk({ sk }: { sk: SkGaji }) {
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
