"use client";

import type { DataLinimasa } from "@/app/dashboard/components/kgb/linimasa";
import type { DokumenSk } from "@/lib/dokumenLinimasa";
import type { SkGaji } from "@/lib/linimasaDasarSk";
import { teksSk } from "@/lib/atasDasarKgb";
import { formatTanggalId } from "@/lib/waktu";

export { dokumenAtasDasar, pesanAtasDasarBerbeda, skKgb } from "@/lib/atasDasarKgb";

/* Sinkronisasi Atas dasar KGB di halaman pegawai (ADR-070). Kartu Dasar KGB, tab Riwayat KGB, dan tab Pangkat & PMK
   memakai satu sumber: linimasa SK penetap gaji pokok (ADR-062), dengan dokumen yang dicocokkan lewat aturan yang
   sama (ADR-066). Data Pegawai menyimpan SK KGB terakhir sebagai acuan jadwal; Atas dasar KGB berikutnya bisa SK lain
   yang lebih baru, misalnya SK kenaikan pangkat. */

/** Tombol dokumen satu SK, seragam di ketiga tab. */
export function TombolDokumenSk({
  dok,
  memuat = false,
  onLihat,
  onUnggah,
}: {
  dok: DokumenSk | null | undefined;
  memuat?: boolean;
  onLihat: (dok: DokumenSk) => void;
  onUnggah?: () => void;
}) {
  if (dok === undefined) return null;
  if (!dok)
    return (
      <>
        <span style={{ color: "var(--st-amber)" }}>Belum ada pindaian.</span>
        {onUnggah && (
          <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={onUnggah}>
            Unggah SK
          </button>
        )}
      </>
    );
  return (
    <>
      <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" disabled={memuat} onClick={() => onLihat(dok)}>
        {memuat ? "Mencetak draf…" : dok.jenis === "draf" ? "Lihat draf SK" : "Lihat SK"}
      </button>
      <span>{dok.sumber}</span>
    </>
  );
}


/**
 * Atas dasar KGB yang sedang berjalan atau berikutnya menurut linimasa, untuk kartu Dasar KGB dan tab Riwayat KGB.
 * `data` null selama dimuat, "gagal" bila gagal dimuat.
 */
export function RingkasAtasDasar({
  data,
  memuatDraf,
  onLihat,
  onLinimasa,
}: {
  data: DataLinimasa | null | "gagal";
  memuatDraf?: boolean;
  onLihat: (sk: SkGaji, dok: DokumenSk) => void;
  onLinimasa: () => void;
}) {
  if (data === null) return <span style={{ color: "var(--dt5)" }}>Menyusun linimasa SK…</span>;
  if (data === "gagal") return <span style={{ color: "var(--dt5)" }}>Linimasa SK gagal dimuat.</span>;
  const dasar = data.linimasa.dasar;
  return (
    <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span>
        {dasar ? <strong style={{ fontWeight: 600 }}>{teksSk(dasar)}</strong> : "Belum ada SK penetap gaji pokok yang tercatat."}
        {dasar?.penetap ? <span style={{ color: "var(--dt4)" }}> · oleh {dasar.penetap}</span> : null}
        {data.tmtKgbBaru ? <span style={{ color: "var(--dt5)" }}> · untuk KGB TMT {formatTanggalId(data.tmtKgbBaru)}</span> : null}
      </span>
      <span className="flex flex-wrap items-center gap-2" style={{ fontSize: "12px", color: "var(--dt5)" }}>
        {dasar && (
          <TombolDokumenSk
            dok={data.dokumen ? (data.dokumen[dasar.kunci] ?? null) : undefined}
            memuat={memuatDraf}
            onLihat={(dok) => onLihat(dasar, dok)}
          />
        )}
        <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={onLinimasa}>
          Linimasa SK
        </button>
      </span>
    </span>
  );
}

const LABEL_PERAN: Record<SkGaji["peran"], string> = {
  dasar: "Atas dasar KGB berikutnya",
  tergantikan: "Tergantikan",
  sesudah: "Berlaku sesudah KGB berikutnya",
};

/**
 * Seluruh SK penetap gaji pokok pegawai (SK KGB, kenaikan pangkat, PMK) menurut TMT, yang terbaru di atas, di kartu
 * Dasar KGB (ADR-120). SK kenaikan pangkat dan PMK tidak lenyap dari kartu ketika dasarnya bergeser: tetap tercantum
 * dengan perannya, dan dapat dibetulkan dari barisnya. `onUbah` dipanggil untuk baris yang dapat dibetulkan dari sini.
 */
export function DaftarSkDasar({
  data,
  bolehUbah,
  memuatDraf,
  onLihat,
  onUbah,
}: {
  data: DataLinimasa | null | "gagal";
  bolehUbah: boolean;
  /** Kunci SK yang drafnya sedang dicetak. */
  memuatDraf: string | null;
  onLihat: (sk: SkGaji, dok: DokumenSk) => void;
  onUbah: (sk: SkGaji) => void;
}) {
  if (data === null) return <span style={{ color: "var(--dt5)" }}>Menyusun linimasa SK…</span>;
  if (data === "gagal") return <span style={{ color: "var(--dt5)" }}>Linimasa SK gagal dimuat.</span>;
  const daftar = [...data.linimasa.sk].reverse();
  if (daftar.length === 0) return <span style={{ color: "var(--dt5)" }}>Belum ada SK penetap gaji pokok yang tercatat.</span>;
  return (
    <ul className="pgw-mutasi" data-daftar-sk="">
      {daftar.map((sk) => {
        const bisaDiubah = sk.kunci.startsWith("kp:") || sk.kunci.startsWith("pmk:") || sk.kunci === "data-pegawai";
        return (
          <li key={sk.kunci}>
            <strong>{teksSk(sk)}</strong>{" "}
            <span className="dsb-tag" data-nada={sk.peran === "dasar" ? "hijau" : undefined} data-garis={sk.peran === "dasar" ? undefined : ""}>
              {LABEL_PERAN[sk.peran]}
            </span>
            <span>
              {[sk.tanggalSK ? `tanggal ${formatTanggalId(sk.tanggalSK)}` : "", sk.penetap ? `oleh ${sk.penetap}` : "", sk.rincian ?? ""]
                .filter(Boolean)
                .join(" · ")}
            </span>
            <span className="flex flex-wrap items-center gap-2" style={{ fontSize: "12px", color: "var(--dt5)" }}>
              <TombolDokumenSk
                dok={data.dokumen ? (data.dokumen[sk.kunci] ?? null) : undefined}
                memuat={memuatDraf === sk.kunci}
                onLihat={(dok) => onLihat(sk, dok)}
              />
              {bolehUbah && bisaDiubah && (
                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => onUbah(sk)}>
                  {sk.kunci === "data-pegawai" ? "Ubah SK dasar" : "Ubah data SK"}
                </button>
              )}
              {sk.jenis === "kgb" && sk.kunci !== "data-pegawai" && <span>SK KGB dibetulkan dari tab Riwayat KGB.</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
