"use client";

import { useState } from "react";
// Impor langsung, bukan lewat indeks kgb: ModalInputKgb memakai berkas ini, dan indeks mengekspor ModalInputKgb.
import KerangkaModal from "@/app/dashboard/components/kgb/KerangkaModal";
import { BidangPenetap, Catatan, PesanGalat } from "@/app/dashboard/components/kgb/BidangForm";
import { BidangTeks } from "@/app/dashboard/components/kgb/BidangForm";
import { JENIS_DOKUMEN, periksaDokumen, type JenisDokumen } from "@/lib/dokumenPegawai";
import { JENIS_KP } from "@/lib/kenaikanPangkat";
import { getGajiPokok } from "@/lib/tabelGaji";
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
  jenis: Extract<JenisDokumen, "sk_pangkat" | "sk_pmk" | "sk_kgb">;
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
  /**
   * Isian lanjutan, hanya diisi untuk Super Admin (ADR-118). Kenaikan pangkat: TMT dan masa kerja golongan baru;
   * PMK: keterangan saja.
   */
  luas?: {
    keterangan: string;
    tmtPangkat?: string | null;
    golonganBaru?: string;
    mkgTahunBaru?: number;
    mkgBulanBaru?: number;
    gajiPokokBaru?: number;
  };
}

/** Riwayat kenaikan pangkat secukupnya untuk jendela Ubah data SK. */
export interface RiwayatKpUntukUbah {
  id: string;
  jenisLabel: string;
  jenisKp?: string;
  golonganLama?: string;
  golonganBaru: string;
  nomorSK: string | null;
  tanggalSK: string | null;
  tmtPangkat: string | null;
  penetapSK: string | null;
  keterangan?: string | null;
  mkgTahunBaru?: number;
  mkgBulanBaru?: number;
  gajiPokokBaru?: number | null;
}

/** Riwayat PMK secukupnya untuk jendela Ubah data SK. */
export interface RiwayatPmkUntukUbah {
  id: string;
  nomorSK: string | null;
  tanggalSK: string | null;
  penetapSK: string | null;
  keterangan?: string | null;
}

/** Data jendela Ubah data SK untuk satu kenaikan pangkat; `luas` (Super Admin) menambah TMT, MKG, dan keterangan (ADR-118). */
export function dataUbahSkKp(p: RiwayatKpUntukUbah, luas: boolean): DataUbahSkRiwayat {
  return {
    jenis: "kp",
    riwayatId: p.id,
    judul: `${p.golonganLama ? `${p.golonganLama} → ${p.golonganBaru}` : p.golonganBaru} · ${p.jenisLabel}`,
    nomorSK: p.nomorSK ?? "",
    tanggalSK: p.tanggalSK,
    penetapSK: p.penetapSK,
    jenisKp: p.jenisKp,
    luas:
      luas && p.mkgTahunBaru !== undefined && p.mkgBulanBaru !== undefined
        ? {
            keterangan: p.keterangan ?? "",
            tmtPangkat: p.tmtPangkat,
            golonganBaru: p.golonganBaru,
            mkgTahunBaru: p.mkgTahunBaru,
            mkgBulanBaru: p.mkgBulanBaru,
            gajiPokokBaru: p.gajiPokokBaru ?? undefined,
          }
        : undefined,
  };
}

/** Data jendela Ubah data SK untuk satu PMK. */
export function dataUbahSkPmk(p: RiwayatPmkUntukUbah, luas: boolean): DataUbahSkRiwayat {
  return {
    jenis: "pmk",
    riwayatId: p.id,
    judul: "Peninjauan masa kerja",
    nomorSK: p.nomorSK ?? "",
    tanggalSK: p.tanggalSK,
    penetapSK: p.penetapSK,
    luas: luas ? { keterangan: p.keterangan ?? "" } : undefined,
  };
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
  const luas = data.luas;
  const tmtAwal = tanggalKalender(luas?.tmtPangkat);
  const [tmtPangkat, setTmtPangkat] = useState(tmtAwal ? isoTanggalLokal(tmtAwal) : "");
  const [mkgTahun, setMkgTahun] = useState(String(luas?.mkgTahunBaru ?? 0));
  const [mkgBulan, setMkgBulan] = useState(String(luas?.mkgBulanBaru ?? 0));
  const [keterangan, setKeterangan] = useState(luas?.keterangan ?? "");
  const gajiBaru =
    luas?.golonganBaru && mkgTahun !== "" && mkgBulan !== "" ? getGajiPokok(luas.golonganBaru, Number(mkgTahun), Number(mkgBulan)) : null;
  const mkgDiubah = luas?.mkgTahunBaru !== undefined && (Number(mkgTahun) !== luas.mkgTahunBaru || Number(mkgBulan) !== luas.mkgBulanBaru);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function simpan() {
    if (!nomorSK.trim()) return setGalat(`Nomor ${label} wajib diisi.`);
    if (!tanggalSK) return setGalat(`Tanggal ${label} wajib diisi.`);
    if (luas && data.jenis === "kp") {
      if (!tmtPangkat) return setGalat("TMT pangkat wajib diisi.");
      if (!gajiBaru)
        return setGalat(`Gaji pokok golongan ${luas.golonganBaru} untuk masa kerja ${mkgTahun} tahun ${mkgBulan} bulan tidak ada di tabel gaji.`);
    }
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/pegawai/${encodeURIComponent(pegawaiId)}/${data.jenis === "kp" ? "pangkat" : "pmk"}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riwayatId: data.riwayatId,
          nomorSK,
          tanggalSK,
          penetapSK,
          ...(data.jenis === "kp" ? { jenisKp } : {}),
          ...(luas
            ? { keterangan, ...(data.jenis === "kp" ? { tmtPangkat, mkgTahunBaru: Number(mkgTahun), mkgBulanBaru: Number(mkgBulan) } : {}) }
            : {}),
        }),
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
        {luas
          ? data.jenis === "kp"
            ? "Selain data SK, TMT dan MKG pada TMT KGB terakhir dapat dibetulkan; gaji pokok dihitung ulang dari tabel gaji. Golongan tidak berubah. Bila ini kenaikan pangkat terbaru, Data Pegawai dan jadwal KGB yang belum diproses ikut dihitung ulang. "
            : "Selain data SK, keterangan dapat dibetulkan. TMT dan masa kerja PMK tidak dapat diubah karena sudah dihitung terhadap data pegawai. "
          : "Yang dibetulkan hanya data SK-nya; golongan, masa kerja, gaji pokok, dan TMT tidak berubah. "}
        KGB yang Atas dasarnya SK ini dan belum ditandatangani, SK dasar di Data Pegawai, dan pindaian di arsip dokumen ikut
        memakai data baru. SK KGB yang sudah ditandatangani tidak diubah.
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
      {luas && data.jenis === "kp" && (
        <>
          <BidangTeks label="TMT pangkat" jenis="date" wajib nilai={tmtPangkat} onUbah={setTmtPangkat} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="kgbm-label">
              <span className="kgbm-wajib">MKG pada TMT KGB terakhir (tahun)</span>
              <input className="kgbm-input" type="number" min={0} max={40} value={mkgTahun} onChange={(e) => setMkgTahun(e.target.value)} />
            </label>
            <label className="kgbm-label">
              <span className="kgbm-wajib">Bulan</span>
              <input className="kgbm-input" type="number" min={0} max={11} value={mkgBulan} onChange={(e) => setMkgBulan(e.target.value)} />
            </label>
          </div>
          <Catatan nada={mkgDiubah ? "amber" : "navy"}>
            Ini <strong>bukan</strong> masa kerja yang tertulis di SK. SK menulis masa kerja pada TMT pangkat, sedangkan
            sistem menyimpan masa kerja pada TMT KGB terakhir pegawai, yang menjadi dasar KGB berikutnya. Angka di SK
            bisa berbeda: masa kerja pada TMT pangkat sama dengan angka ini ditambah selang TMT KGB terakhir sampai TMT
            pangkat. Ubah hanya bila angka tersimpan memang keliru; bila ragu, biarkan.
            {mkgDiubah ? " Angka ini sedang Anda ubah dan akan ditulis ke Data Pegawai bila ini kenaikan pangkat terbaru." : ""}
          </Catatan>
          <p className="kgbm-petunjuk">
            Gaji pokok golongan {luas.golonganBaru}:{" "}
            {gajiBaru ? `Rp ${gajiBaru.toLocaleString("id-ID")}` : "tidak ditemukan di tabel gaji"}
            {gajiBaru !== null && gajiBaru !== luas.gajiPokokBaru ? ` (sebelumnya Rp ${(luas.gajiPokokBaru ?? 0).toLocaleString("id-ID")})` : ""}
          </p>
        </>
      )}
      {luas && (
        <label className="kgbm-label">
          <span>Keterangan</span>
          <textarea className="kgbm-input" rows={2} value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
        </label>
      )}
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

/** Ringkasan satu riwayat untuk jendela hapus duplikat. */
export interface RingkasRiwayat {
  jenisLabel: string;
  nomorSK: string;
  tanggalSK: string | null;
  penetapSK: string | null;
}

/**
 * Hapus satu riwayat yang tercatat dua kali (ADR-069). Riwayat yang tersisa mencatat SK dan kenaikan yang sama, jadi
 * golongan, masa kerja, gaji pokok, dan KGB tidak berubah. Kedua riwayat ditampilkan berdampingan supaya yang dihapus
 * adalah yang data SK-nya keliru.
 */
export function ModalHapusRiwayatKembar({
  pegawaiId,
  jenis,
  riwayatId,
  dihapus,
  tersisa,
  onTutup,
  onSelesai,
}: {
  pegawaiId: string;
  jenis: "kp" | "pmk";
  riwayatId: string;
  dihapus: RingkasRiwayat;
  tersisa: RingkasRiwayat;
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const label = jenis === "kp" ? "kenaikan pangkat" : "PMK";

  async function hapus() {
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(
        `/api/pegawai/${encodeURIComponent(pegawaiId)}/${jenis === "kp" ? "pangkat" : "pmk"}?riwayatId=${encodeURIComponent(riwayatId)}`,
        { method: "DELETE" },
      );
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Riwayat gagal dihapus.");
      onSelesai(`Riwayat ${label} kembar dihapus. SK ${tersisa.nomorSK} kini tercatat sekali, dengan data yang tersisa.`);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Riwayat gagal dihapus.");
    } finally {
      setSibuk(false);
    }
  }

  const isi = (r: RingkasRiwayat) => (
    <dl className="kgbm-item-data">
      <div>
        <dt>Jenis</dt>
        <dd>{r.jenisLabel}</dd>
      </div>
      <div>
        <dt>Nomor</dt>
        <dd>{r.nomorSK}</dd>
      </div>
      <div>
        <dt>Tanggal</dt>
        <dd>{r.tanggalSK ? formatTanggalId(r.tanggalSK) : "-"}</dd>
      </div>
      <div>
        <dt>Oleh</dt>
        <dd>{r.penetapSK ?? "belum tercatat"}</dd>
      </div>
    </dl>
  );

  return (
    <KerangkaModal
      judul={`Hapus riwayat ${label} kembar`}
      subjudul={`SK ${dihapus.nomorSK} tercatat dua kali`}
      ukuran="md"
      nada="merah"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void hapus()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk} data-autofocus>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-bahaya" disabled={sibuk}>
            {sibuk ? "Menghapus…" : "Hapus riwayat ini"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />
      <Catatan>
        SK dan kenaikan yang sama tercatat dua kali, sehingga linimasa SK menampilkannya dua kali. Menghapus salah satunya
        tidak mengubah golongan, masa kerja, gaji pokok, maupun KGB. Hapus yang data SK-nya keliru; bila keduanya sama-sama
        perlu dibetulkan, betulkan yang tersisa lewat Ubah data SK sesudahnya.
      </Catatan>
      <p className="kgbm-legenda">
        <strong>Dihapus</strong>
      </p>
      {isi(dihapus)}
      <p className="kgbm-legenda">
        <strong>Tetap tercatat</strong>
      </p>
      {isi(tersisa)}
    </KerangkaModal>
  );
}

/**
 * Hapus riwayat kenaikan pangkat mana pun oleh Super Admin (ADR-118). Riwayatnya tidak menopang data pegawai (server
 * memeriksanya), jadi golongan, masa kerja, dan gaji pokok pegawai tidak berubah.
 */
export function ModalHapusRiwayatBebas({
  pegawaiId,
  riwayatId,
  ringkas,
  onTutup,
  onSelesai,
}: {
  pegawaiId: string;
  riwayatId: string;
  ringkas: { judul: string; nomorSK: string; tmt: string | null; mkg: string; gaji: number };
  onTutup: () => void;
  onSelesai: (pesan: string) => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function hapus() {
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/pegawai/${encodeURIComponent(pegawaiId)}/pangkat?riwayatId=${encodeURIComponent(riwayatId)}&mode=bebas`, {
        method: "DELETE",
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; peringatan?: string[] };
      if (!res.ok) throw new Error(d.error ?? "Riwayat gagal dihapus.");
      onSelesai([`Riwayat kenaikan pangkat SK ${ringkas.nomorSK} dihapus.`, ...(d.peringatan ?? []).map((x) => `${x}.`)].join(" "));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Riwayat gagal dihapus.");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KerangkaModal
      judul="Hapus riwayat kenaikan pangkat"
      subjudul={`SK ${ringkas.nomorSK}`}
      ukuran="md"
      nada="merah"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void hapus()}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk} data-autofocus>
            Batal
          </button>
          <button type="submit" className="kgbm-tombol kgbm-bahaya" disabled={sibuk}>
            {sibuk ? "Menghapus…" : "Hapus riwayat ini"}
          </button>
        </>
      }
    >
      <PesanGalat pesan={galat} />
      <Catatan>
        Riwayat ini tidak menopang golongan, masa kerja, dan gaji pokok pegawai saat ini, jadi data pegawai dan KGB tidak
        berubah. Penghapusan tidak dapat dibatalkan dan tercatat di Log Aktivitas. Bila nomor SK ini masih disebut
        sebagai Atas dasar pada KGB, Anda akan diberi tahu.
      </Catatan>
      <dl className="kgbm-item-data">
        <div>
          <dt>Kenaikan</dt>
          <dd>{ringkas.judul}</dd>
        </div>
        <div>
          <dt>TMT</dt>
          <dd>{ringkas.tmt ? formatTanggalId(ringkas.tmt) : "-"}</dd>
        </div>
        <div>
          <dt>Masa kerja</dt>
          <dd>{ringkas.mkg}</dd>
        </div>
        <div>
          <dt>Gaji pokok</dt>
          <dd>Rp {ringkas.gaji.toLocaleString("id-ID")}</dd>
        </div>
      </dl>
    </KerangkaModal>
  );
}
