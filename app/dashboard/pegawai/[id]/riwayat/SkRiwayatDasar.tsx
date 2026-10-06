"use client";

import { useState } from "react";
import { KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import { JENIS_DOKUMEN, periksaDokumen, type JenisDokumen } from "@/lib/dokumenPegawai";
import type { DokumenSk } from "@/lib/dokumenLinimasa";
import { formatTanggalId, isoTanggalLokal, tanggalKalender } from "@/lib/waktu";

/* Pindaian SK pada baris riwayat kenaikan pangkat dan PMK (ADR-067). Riwayatnya sendiri tidak menyimpan berkas
   (ADR-028); pindaiannya dicari di dokumen pegawai menurut jenis dan nomor SK, sama dengan linimasa SK penetap gaji
   pokok (ADR-066). SK yang belum punya pindaian dapat diunggah dari baris ini, dengan jenis, nomor, dan tanggal
   diambil dari riwayatnya supaya pindaian itu pasti tercocokkan. */

/** SK riwayat yang pindaiannya diunggah. */
export interface SkRiwayat {
  jenis: Extract<JenisDokumen, "sk_pangkat" | "sk_pmk">;
  nomorSK: string;
  tanggalSK: string | null;
  /** Judul baris riwayat, mis. "II/b → III/a · Pilihan: Penyesuaian Ijazah". */
  judul: string;
}

/**
 * Kaki baris riwayat. `dok`: undefined selama dimuat, "gagal" bila daftar dokumen gagal dimuat, null bila belum ada
 * pindaian.
 */
export function KakiSkRiwayat({
  sk,
  dok,
  onLihat,
  onUnggah,
}: {
  sk: SkRiwayat;
  dok: DokumenSk | null | undefined | "gagal";
  onLihat: (dok: Extract<DokumenSk, { jenis: "berkas" }>) => void;
  onUnggah: () => void;
}) {
  return (
    <div
      className="px-4 py-2 flex flex-wrap items-center gap-2"
      style={{ borderTop: "0.5px solid var(--ln2)", fontSize: "12px", color: "var(--dt5)" }}
    >
      {dok === undefined ? (
        <span>Memeriksa pindaian {JENIS_DOKUMEN[sk.jenis]}…</span>
      ) : dok === "gagal" ? (
        <span>Daftar dokumen gagal dimuat; pindaian SK ini belum dapat diperiksa.</span>
      ) : dok?.jenis === "berkas" ? (
        <>
          <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => onLihat(dok)}>
            Lihat SK
          </button>
          <span>{dok.sumber}</span>
        </>
      ) : !sk.nomorSK.trim() ? (
        <span>Nomor SK riwayat ini kosong, jadi pindaiannya tidak dapat dicocokkan. Lengkapi nomornya lebih dulu.</span>
      ) : (
        <>
          <span style={{ color: "var(--st-amber)" }}>Belum ada pindaian SK ini.</span>
          <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={onUnggah}>
            Unggah SK
          </button>
        </>
      )}
    </div>
  );
}

/** Unggah pindaian SK riwayat ke arsip dokumen pegawai, dengan jenis, nomor, dan tanggal dari riwayatnya. */
export function ModalUnggahSkRiwayat({
  pegawaiId,
  sk,
  onTutup,
  onSelesai,
}: {
  pegawaiId: string;
  sk: SkRiwayat;
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const [berkas, setBerkas] = useState<File | null>(null);
  const [keterangan, setKeterangan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const tanggal = tanggalKalender(sk.tanggalSK);
  const tanggalIsian = tanggal ? isoTanggalLokal(tanggal) : "";

  async function unggah() {
    const kurang = periksaDokumen({ jenis: sk.jenis, tanggalSK: tanggalIsian, ukuran: berkas?.size ?? 0 });
    if (berkas && berkas.type !== "application/pdf") kurang.push("Berkas harus PDF.");
    if (kurang.length > 0 || !berkas) {
      setGalat(kurang.join(" ") || "Pilih berkas PDF.");
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      const form = new FormData();
      form.set("jenis", sk.jenis);
      form.set("nomorSK", sk.nomorSK);
      form.set("tanggalSK", tanggalIsian);
      form.set("keterangan", keterangan.trim());
      form.set("berkas", berkas);
      const res = await fetch(`/api/pegawai/${encodeURIComponent(pegawaiId)}/dokumen`, { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Pindaian SK gagal diunggah.");
      onSelesai(`${JENIS_DOKUMEN[sk.jenis]} ${sk.nomorSK} masuk arsip dokumen pegawai, dan kini dapat dibuka dari riwayat maupun linimasa SK.`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pindaian SK gagal diunggah.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KerangkaModal
      judul={`Unggah ${JENIS_DOKUMEN[sk.jenis]}`}
      subjudul={sk.judul}
      ukuran="md"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void unggah()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk || !berkas}>
            {sibuk ? "Mengunggah…" : "Unggah ke arsip"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />
      <Catatan nada="navy">
        Jenis, nomor, dan tanggal diambil dari riwayat ini, jadi pindaiannya langsung tercocokkan dengan SK-nya di riwayat
        dan di linimasa SK penetap gaji pokok. Bila nomor di riwayat salah ketik, betulkan riwayatnya lebih dulu.
      </Catatan>
      <dl className="kgbm-item-data">
        <div>
          <dt>Jenis</dt>
          <dd>{JENIS_DOKUMEN[sk.jenis]}</dd>
        </div>
        <div>
          <dt>Nomor SK</dt>
          <dd>{sk.nomorSK}</dd>
        </div>
        <div>
          <dt>Tanggal SK</dt>
          <dd>{tanggal ? formatTanggalId(tanggal) : "-"}</dd>
        </div>
      </dl>
      <label className="kgbm-label">
        <span className="kgbm-wajib">Pindaian SK (PDF)</span>
        <input
          className="kgbm-input"
          type="file"
          accept="application/pdf"
          data-autofocus
          onChange={(e) => {
            setBerkas(e.target.files?.[0] ?? null);
            setGalat(null);
          }}
        />
        <span className="kgbm-bantuan">Pindai sebagai dokumen, bukan foto, agar ukurannya muat.</span>
      </label>
      <label className="kgbm-label">
        Keterangan
        <input className="kgbm-input" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="opsional" />
      </label>
    </KerangkaModal>
  );
}
