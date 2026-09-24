"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { SARAN_PENETAP_SK } from "@/lib/penetapSk";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatUkuranBerkas } from "./format";

type Nada = "navy" | "amber" | "hijau" | "merah" | "netral";

interface PropsBidangTeks {
  label: string;
  nilai: string;
  onUbah: (nilai: string) => void;
  jenis?: "text" | "date";
  wajib?: boolean;
  petunjuk?: ReactNode;
  placeholder?: string;
  saran?: readonly string[];
  nonaktif?: boolean;
  fokusAwal?: boolean;
}

export function BidangTeks({
  label,
  nilai,
  onUbah,
  jenis = "text",
  wajib,
  petunjuk,
  placeholder,
  saran,
  nonaktif,
  fokusAwal,
}: PropsBidangTeks) {
  const id = useId();
  const idPetunjuk = `${id}-petunjuk`;
  const idSaran = `${id}-saran`;
  return (
    <div>
      <label htmlFor={id} className="kgbm-label">
        {label}
        {wajib && (
          <span className="kgbm-wajib" aria-hidden="true" />
        )}
      </label>
      <input
        id={id}
        type={jenis}
        className="kgbm-input"
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        required={wajib}
        aria-describedby={petunjuk ? idPetunjuk : undefined}
        placeholder={placeholder}
        list={saran ? idSaran : undefined}
        disabled={nonaktif}
        autoComplete="off"
        data-autofocus={fokusAwal ? "" : undefined}
      />
      {saran && (
        <datalist id={idSaran}>
          {saran.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {petunjuk && (
        <p id={idPetunjuk} className="kgbm-petunjuk">
          {petunjuk}
        </p>
      )}
    </div>
  );
}

export function BidangPenetap(props: Omit<PropsBidangTeks, "saran" | "jenis" | "label"> & { label?: string }) {
  return (
    <BidangTeks
      {...props}
      label={props.label ?? "Oleh (pejabat penetap SK terakhir)"}
      saran={SARAN_PENETAP_SK}
      placeholder={props.placeholder ?? "Pilih atau ketik jabatan penetap"}
    />
  );
}

export function BidangAlasan({
  label,
  nilai,
  onUbah,
  wajib,
  petunjuk,
  placeholder,
  nonaktif,
  fokusAwal,
}: Omit<PropsBidangTeks, "jenis" | "saran">) {
  const id = useId();
  const idPetunjuk = `${id}-petunjuk`;
  return (
    <div>
      <label htmlFor={id} className="kgbm-label">
        {label}
        {wajib && (
          <span className="kgbm-wajib" aria-hidden="true" />
        )}
      </label>
      <textarea
        id={id}
        className="kgbm-input"
        rows={3}
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        required={wajib}
        aria-describedby={petunjuk ? idPetunjuk : undefined}
        placeholder={placeholder}
        disabled={nonaktif}
        data-autofocus={fokusAwal ? "" : undefined}
      />
      {petunjuk && (
        <p id={idPetunjuk} className="kgbm-petunjuk">
          {petunjuk}
        </p>
      )}
    </div>
  );
}

interface PropsBidangBerkasPdf {
  label: string;
  berkas: File | null;
  onPilih: (berkas: File | null) => void;
  wajib?: boolean;
  petunjuk?: ReactNode;
  nonaktif?: boolean;
  /** Tinggi pratinjau PDF dalam piksel; 0 untuk tanpa pratinjau. */
  tinggiPratinjau?: number;
}

export function BidangBerkasPdf({
  label,
  berkas,
  onPilih,
  wajib,
  petunjuk,
  nonaktif,
  tinggiPratinjau = 260,
}: PropsBidangBerkasPdf) {
  const id = useId();
  const idLabel = `${id}-label`;
  const idPetunjuk = `${id}-petunjuk`;
  const [pratinjau, setPratinjau] = useState<{ berkas: File; url: string } | null>(null);

  useEffect(() => {
    if (!pratinjau) return;
    return () => URL.revokeObjectURL(pratinjau.url);
  }, [pratinjau]);

  const urlPratinjau = pratinjau && pratinjau.berkas === berkas ? pratinjau.url : null;

  return (
    <div>
      <p id={idLabel} className="kgbm-label">
        {label}
        {wajib && (
          <span className="kgbm-wajib" aria-hidden="true" />
        )}
      </p>
      <label className="kgbm-berkas" data-terisi={berkas ? "true" : "false"} data-nonaktif={nonaktif ? "true" : "false"}>
        <input
          id={id}
          type="file"
          accept="application/pdf"
          className="kgbm-sr"
          disabled={nonaktif}
          required={wajib}
          aria-labelledby={idLabel}
          aria-describedby={petunjuk ? idPetunjuk : undefined}
          onChange={(e) => {
            const pilihan = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (!pilihan) return;
            onPilih(pilihan);
            setPratinjau(pilihan.type === "application/pdf" ? { berkas: pilihan, url: URL.createObjectURL(pilihan) } : null);
          }}
        />
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", fontWeight: berkas ? 600 : 400 }}>
          {berkas ? berkas.name : "Pilih berkas PDF"}
        </span>
        {berkas && <span style={{ fontSize: "11px", whiteSpace: "nowrap" }}>{formatUkuranBerkas(berkas.size)}</span>}
      </label>
      {petunjuk && (
        <p id={idPetunjuk} className="kgbm-petunjuk">
          {petunjuk}
        </p>
      )}
      {urlPratinjau && tinggiPratinjau > 0 && (
        <div style={{ marginTop: "8px" }}>
          <iframe src={urlPratinjau} title="Pratinjau berkas SK" className="kgbm-bingkai" style={{ height: `${tinggiPratinjau}px` }} />
          <a href={urlPratinjau} target="_blank" rel="noopener noreferrer" className="kgbm-tautan" style={{ display: "inline-block", marginTop: "4px" }}>
            Buka berkas di tab baru
          </a>
        </div>
      )}
    </div>
  );
}

export function BagianForm({
  judul,
  keterangan,
  nada = "navy",
  children,
}: {
  judul: string;
  keterangan?: ReactNode;
  nada?: "navy" | "hijau" | "amber";
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="kgbm-bagian" data-nada={nada} aria-labelledby={id}>
      <div className="kgbm-bagian-kepala">
        <h3 id={id} className="kgbm-bagian-judul">
          {judul}
        </h3>
        {keterangan && <p className="kgbm-bagian-ket">{keterangan}</p>}
      </div>
      <div className="kgbm-bagian-isi">{children}</div>
    </section>
  );
}

interface BarisData {
  label: string;
  nilai: ReactNode;
  nada?: "hijau";
}

export function DaftarData({ judul, tambahan, baris }: { judul: string; tambahan?: ReactNode; baris: BarisData[] }) {
  return (
    <div className="kgbm-data">
      <div className="kgbm-data-kepala">
        <span>{judul}</span>
        {tambahan}
      </div>
      <dl>
        {baris.map((b) => (
          <div key={b.label} className="kgbm-data-baris">
            <dt>{b.label}</dt>
            <dd data-nada={b.nada}>{b.nilai}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function Catatan({ nada = "netral", children }: { nada?: Nada; children: ReactNode }) {
  return (
    <div className="kgbm-catatan" data-nada={nada}>
      {children}
    </div>
  );
}

export function PesanGalat({ pesan }: { pesan: string | null }) {
  return (
    <div role="alert" aria-live="assertive">
      {pesan && <p className="kgbm-galat">{pesan}</p>}
    </div>
  );
}

export function Lencana({ nada = "netral", children }: { nada?: Nada; children: ReactNode }) {
  return (
    <span className="kgbm-lencana" data-nada={nada}>
      {children}
    </span>
  );
}

export function LencanaRapelan() {
  return <Lencana nada="amber">Berpotensi rapelan</Lencana>;
}

/** Lencana status KGB dengan label dan warna dari lib/statusKgb.ts. */
export function LencanaStatus({ status }: { status: string }) {
  const warna = warnaStatusKgb(status);
  return (
    <span className="kgbm-lencana" style={{ background: warna.bg, color: warna.color }}>
      {infoStatusKgb(status).label}
    </span>
  );
}

export function Memuat({ teks }: { teks: string }) {
  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--dt4)" }}>
      <span className="kgbm-putar" aria-hidden="true" />
      {teks}
    </div>
  );
}
