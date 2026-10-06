"use client";

import { useState } from "react";
import { BidangPenetap, KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import { BidangTeks } from "@/app/dashboard/components/kgb/BidangForm";
import { JENIS_DOKUMEN, periksaDokumen, type JenisDokumen } from "@/lib/dokumenPegawai";
import { JENIS_KP } from "@/lib/kenaikanPangkat";
import type { DokumenSk } from "@/lib/dokumenLinimasa";
import { formatTanggalId, isoTanggalLokal, tanggalKalender } from "@/lib/waktu";

/* Pindaian SK pada baris riwayat kenaikan pangkat dan PMK (ADR-067). Riwayatnya sendiri tidak menyimpan berkas
   (ADR-028); pindaiannya dicari di dokumen pegawai menurut jenis dan nomor SK, sama dengan linimasa SK penetap gaji
   pokok (ADR-066). SK yang belum punya pindaian dapat diunggah dari baris ini, dengan jenis, nomor, dan tanggal
   diambil dari riwayatnya supaya pindaian itu pasti tercocokkan.

   Data SK-nya (nomor, tanggal, penetap, jenis kenaikan pangkat) dapat dibetulkan dari baris yang sama; salinannya
   di KGB, Data Pegawai, dan arsip dokumen diselaraskan server (lib/ubahSkRiwayat.ts, ADR-068). */

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
  tampilDokumen = true,
  onLihat,
  onUnggah,
  onUbah,
}: {
  sk: SkRiwayat;
  dok: DokumenSk | null | undefined | "gagal";
  /** Pindaian hanya untuk peran yang memegang arsip dokumen (Super Admin dan Tim SDM KGB). */
  tampilDokumen?: boolean;
  onLihat: (dok: Extract<DokumenSk, { jenis: "berkas" }>) => void;
  onUnggah: () => void;
  /** Bila diisi, tampil tombol Ubah data SK. */
  onUbah?: () => void;
}) {
  return (
    <div
      className="px-4 py-2 flex flex-wrap items-center gap-2"
      style={{ borderTop: "0.5px solid var(--ln2)", fontSize: "12px", color: "var(--dt5)" }}
    >
      {!tampilDokumen ? null : dok === undefined ? (
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
      {onUbah && (
        <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" style={{ marginLeft: "auto" }} onClick={onUbah}>
          Ubah data SK
        </button>
      )}
    </div>
  );
}

/** Data SK satu riwayat yang dibetulkan. */
export interface DataUbahSkRiwayat {
  jenis: "kp" | "pmk";
  riwayatId: string;
  judul: string;
  nomorSK: string;
  /** ISO atau yyyy-mm-dd. */
  tanggalSK: string | null;
  penetapSK: string | null;
  /** Kunci jenis kenaikan pangkat; hanya "kp". */
  jenisKp?: string;
}

/**
 * Betulkan nomor, tanggal, penetap ("Ditetapkan oleh"), dan jenis SK satu riwayat. Golongan, masa kerja, gaji pokok,
 * dan TMT tidak ikut, sebab hitungannya sudah diterapkan ke data pegawai dan KGB.
 */
export function ModalUbahSkRiwayat({
  pegawaiId,
  data,
  onTutup,
  onSelesai,
}: {
  pegawaiId: string;
  data: DataUbahSkRiwayat;
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const label = data.jenis === "kp" ? "SK kenaikan pangkat" : "SK PMK";
  const tanggalAwal = tanggalKalender(data.tanggalSK);
  const [nomorSK, setNomorSK] = useState(data.nomorSK);
  const [tanggalSK, setTanggalSK] = useState(tanggalAwal ? isoTanggalLokal(tanggalAwal) : "");
  const [penetapSK, setPenetapSK] = useState(data.penetapSK ?? "");
  const [jenisKp, setJenisKp] = useState(data.jenisKp && data.jenisKp in JENIS_KP ? data.jenisKp : "reguler");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function simpan() {
    if (!nomorSK.trim()) return setGalat(`Nomor ${label} wajib diisi.`);
    if (!tanggalSK) return setGalat(`Tanggal ${label} wajib diisi.`);
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/pegawai/${encodeURIComponent(pegawaiId)}/${data.jenis === "kp" ? "pangkat" : "pmk"}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riwayatId: data.riwayatId, nomorSK, tanggalSK, penetapSK, ...(data.jenis === "kp" ? { jenisKp } : {}) }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; berubah?: boolean; selaras?: string[] };
      if (!res.ok) throw new Error(d.error ?? "Data SK gagal disimpan.");
      onSelesai(
        d.berubah
          ? [`Data ${label} ${nomorSK.trim()} dibetulkan.`, ...(d.selaras ?? []).map((s) => `${s}.`)].join(" ")
          : "Tidak ada data SK yang berubah.",
      );
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data SK gagal disimpan.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KerangkaModal
      judul={`Ubah data ${label}`}
      subjudul={data.judul}
      ukuran="md"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void simpan()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />
      <Catatan nada="navy">
        Yang dibetulkan hanya data SK-nya; golongan, masa kerja, gaji pokok, dan TMT tidak berubah. KGB yang Atas dasarnya
        SK ini dan belum ditandatangani, SK dasar di Data Pegawai, dan pindaian di arsip dokumen ikut memakai data baru.
        SK KGB yang sudah ditandatangani tidak diubah.
      </Catatan>
      {data.jenis === "kp" && (
        <label className="kgbm-label">
          <span className="kgbm-wajib">Jenis kenaikan pangkat</span>
          <select className="kgbm-input" value={jenisKp} onChange={(e) => setJenisKp(e.target.value)}>
            {Object.entries(JENIS_KP).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </label>
      )}
      <BidangTeks label={`Nomor ${label}`} wajib nilai={nomorSK} onUbah={setNomorSK} fokusAwal />
      <BidangTeks label="Tanggal SK" jenis="date" wajib nilai={tanggalSK} onUbah={setTanggalSK} />
      <BidangPenetap
        label="Ditetapkan oleh"
        nilai={penetapSK}
        onUbah={setPenetapSK}
        petunjuk="Pejabat yang menandatangani SK ini. Tercetak pada baris Oleh di SK KGB berikutnya bila SK ini menjadi Atas dasarnya."
      />
    </KerangkaModal>
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
