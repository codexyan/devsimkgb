"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import { GOLONGAN_PANGKAT, getGajiPokok } from "@/lib/tabelGaji";
import {
  BATAS_BERKAS_INVENTARIS_BYTE,
  BERKAS_KEADAAN,
  FOLDER_KEADAAN,
  KOLOM_REKAP,
  LABEL_KEADAAN,
  barisRekap,
  namaBerkasInventaris,
  namaFolderPegawai,
  periksaIsianInventaris,
  tanggalUntukBerkas,
  type IsianInventaris,
  type JenisBerkasInventaris,
  type KeadaanKgb,
} from "@/lib/inventarisKgb";

/* Formulir inventarisasi data KGB pegawai Kanwil. Berkas dibaca di peramban menjadi base64 lalu dikirim
   bersama isian ke Google Apps Script (docs/inventarisasi-kgb/Code.gs), yang memeriksa ulang kode akses,
   NIP, nama berkas, dan ukuran sebelum menyimpannya di Drive. */

const KOSONG: IsianInventaris = {
  keadaan: "pernah",
  nip: "",
  nama: "",
  tempatLahir: "",
  tanggalLahir: "",
  jabatan: "",
  bidang: "",
  golonganRuang: "",
  tmtGolongan: "",
  mkgTahun: "",
  mkgBulan: "",
  tmtDasar: "",
  nomorSkDasar: "",
  tanggalSkDasar: "",
  tanggalSkPendukung: "",
  nomorWa: "",
  catatan: "",
};

const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);

function bacaBase64(berkas: File): Promise<string> {
  return new Promise((selesai, gagal) => {
    const r = new FileReader();
    r.onload = () => selesai(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => gagal(r.error);
    r.readAsDataURL(berkas);
  });
}

type Keadaan = { tahap: "isi" } | { tahap: "kirim" } | { tahap: "selesai"; kirimanKe: number; nama: string };

export default function FormInventaris({ url }: { url: string }) {
  const id = useId();
  const [kode, setKode] = useState("");
  const [isian, setIsian] = useState<IsianInventaris>(KOSONG);
  const [berkas, setBerkas] = useState<Partial<Record<JenisBerkasInventaris, File>>>({});
  const [setuju, setSetuju] = useState(false);
  const [galat, setGalat] = useState<string[]>([]);
  const [keadaan, setKeadaan] = useState<Keadaan>({ tahap: "isi" });

  const ubah = <K extends keyof IsianInventaris>(k: K, v: IsianInventaris[K]) => setIsian((s) => ({ ...s, [k]: v }));
  const pernah = isian.keadaan === "pernah";
  const daftarBerkas = BERKAS_KEADAAN[isian.keadaan];

  const gaji = useMemo(() => {
    if (!isian.golonganRuang) return 0;
    const th = pernah ? Number(isian.mkgTahun || "0") : 0;
    const bl = pernah ? Number(isian.mkgBulan || "0") : 0;
    return getGajiPokok(isian.golonganRuang, th, bl);
  }, [isian.golonganRuang, isian.mkgTahun, isian.mkgBulan, pernah]);

  function pilihBerkas(jenis: JenisBerkasInventaris, f: File | null) {
    setBerkas((b) => {
      const baru = { ...b };
      if (f) baru[jenis] = f;
      else delete baru[jenis];
      return baru;
    });
  }

  function gantiKeadaan(k: KeadaanKgb) {
    setIsian((s) => ({ ...s, keadaan: k }));
    setBerkas({});
  }

  async function kirim(e: FormEvent) {
    e.preventDefault();
    const kurang = periksaIsianInventaris(isian);
    if (!kode.trim()) kurang.unshift("kode akses dari grup WA");
    for (const b of daftarBerkas) {
      const f = berkas[b.jenis];
      if (!f && b.wajib) kurang.push(`berkas ${b.label}`);
      if (f && f.type !== "application/pdf") kurang.push(`${b.label} harus berupa PDF`);
      if (f && f.size > BATAS_BERKAS_INVENTARIS_BYTE) kurang.push(`${b.label} lebih dari 1 MB`);
    }
    if (!setuju) kurang.push("pernyataan kebenaran data");
    setGalat(kurang);
    if (kurang.length > 0) {
      document.getElementById(`${id}-galat`)?.scrollIntoView({ block: "center" });
      return;
    }

    setKeadaan({ tahap: "kirim" });
    try {
      const lampiran = [];
      for (const b of daftarBerkas) {
        const f = berkas[b.jenis];
        if (!f) continue;
        const base64 = await bacaBase64(f);
        if (!base64.startsWith("JVBERi")) throw new Error(`${b.label} bukan berkas PDF yang sah.`);
        lampiran.push({
          jenis: b.jenis,
          nama: namaBerkasInventaris(isian.nip, b.jenis, tanggalUntukBerkas(isian, b.jenis)),
          base64,
        });
      }
      const muatan = {
        kode: kode.trim(),
        keadaan: isian.keadaan,
        nip: isian.nip,
        namaFolder: namaFolderPegawai(isian.nip, isian.nama),
        folderKeadaan: FOLDER_KEADAAN[isian.keadaan],
        kolom: KOLOM_REKAP,
        baris: barisRekap(isian),
        berkas: lampiran,
      };
      // text/plain agar tidak memicu preflight CORS; Apps Script membaca isinya sebagai teks JSON.
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(muatan),
        redirect: "follow",
      });
      const hasil = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; kirimanKe?: number } | null;
      if (!hasil?.ok) {
        setGalat([hasil?.error ?? "Kiriman gagal. Periksa koneksi, lalu coba lagi."]);
        setKeadaan({ tahap: "isi" });
        return;
      }
      setKeadaan({ tahap: "selesai", kirimanKe: hasil.kirimanKe ?? 1, nama: isian.nama.trim() });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setGalat([err instanceof Error && err.message ? err.message : "Kiriman gagal. Periksa koneksi, lalu coba lagi."]);
      setKeadaan({ tahap: "isi" });
    }
  }

  if (keadaan.tahap === "selesai") {
    return (
      <div className="iv-selesai" role="status">
        <span className="iv-selesai-ikon" aria-hidden="true">✓</span>
        <h2>Terima kasih, data {keadaan.nama} sudah terkirim</h2>
        <p>
          {keadaan.kirimanKe > 1
            ? `Ini kiriman ke-${keadaan.kirimanKe}; kiriman sebelumnya sudah digantikan.`
            : "Tim SDM Kanwil akan memperbarui data KGB Anda di SIM-KGB."}{" "}
          Bila ada yang keliru, isi ulang formulir ini; kiriman terakhir yang dipakai.
        </p>
        <div className="iv-selesai-aksi">
          <a href="/kgb" className="iv-tombol">Cek status KGB</a>
          <button
            type="button"
            className="iv-tombol"
            data-jenis="garis"
            onClick={() => {
              setIsian(KOSONG);
              setBerkas({});
              setSetuju(false);
              setKeadaan({ tahap: "isi" });
            }}
          >
            Isi untuk pegawai lain
          </button>
        </div>
      </div>
    );
  }

  const mengirim = keadaan.tahap === "kirim";
  const tanggal = (k: keyof IsianInventaris, label: string, wajib = true, bantuan?: string) => (
    <label className="iv-bidang">
      <span className="iv-label" data-wajib={wajib ? "" : undefined}>{label}</span>
      <input type="date" className="iv-isian" value={String(isian[k])} onChange={(e) => ubah(k, e.target.value as never)} />
      {bantuan && <span className="iv-bantu">{bantuan}</span>}
    </label>
  );
  const teks = (k: keyof IsianInventaris, label: string, opsi: { wajib?: boolean; placeholder?: string; bantuan?: string; mode?: "numeric" | "tel" } = {}) => (
    <label className="iv-bidang">
      <span className="iv-label" data-wajib={opsi.wajib === false ? undefined : ""}>{label}</span>
      <input
        className="iv-isian"
        inputMode={opsi.mode}
        placeholder={opsi.placeholder}
        value={String(isian[k])}
        onChange={(e) => ubah(k, (opsi.mode === "numeric" ? e.target.value.replace(/\D/g, "") : e.target.value) as never)}
      />
      {opsi.bantuan && <span className="iv-bantu">{opsi.bantuan}</span>}
    </label>
  );

  return (
    <form className="iv-form" onSubmit={kirim} noValidate aria-busy={mengirim}>
      <fieldset className="iv-kelompok" disabled={mengirim}>
        <legend>1. Kode akses</legend>
        <label className="iv-bidang">
          <span className="iv-label" data-wajib="">Kode dari pengumuman grup WA pegawai Kanwil</span>
          <input
            className="iv-isian iv-kode"
            autoComplete="off"
            spellCheck={false}
            value={kode}
            onChange={(e) => setKode(e.target.value.toUpperCase())}
          />
        </label>
      </fieldset>

      <fieldset className="iv-kelompok" disabled={mengirim}>
        <legend>2. Keadaan KGB Anda</legend>
        <div className="iv-pilihan" role="radiogroup" aria-label="Keadaan KGB">
          {(["pernah", "belum"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={isian.keadaan === k} className="iv-opsi" onClick={() => gantiKeadaan(k)}>
              <strong>{LABEL_KEADAAN[k]}</strong>
              <span>
                {k === "pernah"
                  ? "Sudah menerima SK kenaikan gaji berkala setidaknya sekali."
                  : "CPNS atau PNS baru yang belum pernah menerima SK KGB."}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="iv-kelompok" disabled={mengirim}>
        <legend>3. Identitas</legend>
        <div className="iv-kisi">
          {teks("nip", "NIP", { placeholder: "18 angka", mode: "numeric" })}
          {teks("nama", "Nama lengkap dengan gelar", { placeholder: "Sesuai SK terakhir" })}
          {teks("tempatLahir", "Tempat lahir", { placeholder: "mis. Banjarmasin", bantuan: "Dipakai untuk cek status KGB di situs ini." })}
          {tanggal("tanggalLahir", "Tanggal lahir")}
          {teks("jabatan", "Jabatan")}
          {teks("bidang", "Bidang/Bagian", { wajib: false, placeholder: "mis. Bagian Tata Usaha dan Umum" })}
          {teks("nomorWa", "Nomor WhatsApp", { wajib: false, mode: "tel", placeholder: "08…", bantuan: "Untuk dihubungi bila ada data yang perlu dicocokkan." })}
        </div>
      </fieldset>

      <fieldset className="iv-kelompok" disabled={mengirim}>
        <legend>4. Pangkat dan {pernah ? "KGB terakhir" : "pengangkatan"}</legend>
        <div className="iv-kisi">
          <label className="iv-bidang">
            <span className="iv-label" data-wajib="">Golongan ruang</span>
            <select className="iv-isian" value={isian.golonganRuang} onChange={(e) => ubah("golonganRuang", e.target.value)}>
              <option value="">Pilih golongan</option>
              {Object.entries(GOLONGAN_PANGKAT).map(([g, p]) => (
                <option key={g} value={g}>{g} · {p}</option>
              ))}
            </select>
          </label>
          {tanggal("tmtGolongan", "TMT golongan", true, "Dari SK pangkat yang berlaku sekarang.")}
          {pernah ? (
            <>
              {tanggal("tmtDasar", "TMT KGB terakhir")}
              <div className="iv-bidang">
                <span className="iv-label" data-wajib="">Masa kerja golongan pada SK KGB terakhir</span>
                <div className="iv-mkg">
                  <input className="iv-isian" inputMode="numeric" aria-label="Tahun" placeholder="0" value={isian.mkgTahun} onChange={(e) => ubah("mkgTahun", e.target.value.replace(/\D/g, ""))} />
                  <span>tahun</span>
                  <input className="iv-isian" inputMode="numeric" aria-label="Bulan" placeholder="0" value={isian.mkgBulan} onChange={(e) => ubah("mkgBulan", e.target.value.replace(/\D/g, ""))} />
                  <span>bulan</span>
                </div>
              </div>
              {teks("nomorSkDasar", "Nomor SK KGB terakhir")}
              {tanggal("tanggalSkDasar", "Tanggal SK KGB terakhir")}
              {tanggal("tanggalSkPendukung", "Tanggal SK kenaikan pangkat terakhir", true, "Belum pernah naik pangkat? Isi tanggal SK CPNS.")}
            </>
          ) : (
            <>
              {tanggal("tmtDasar", "TMT CPNS")}
              {teks("nomorSkDasar", "Nomor SK CPNS")}
              {tanggal("tanggalSkDasar", "Tanggal SK CPNS")}
              {tanggal("tanggalSkPendukung", "Tanggal SK PNS", false, "Kosongkan bila SK PNS belum terbit.")}
            </>
          )}
        </div>
        {gaji > 0 && (
          <p className="iv-gaji">
            Gaji pokok menurut PP 5/2024 untuk isian ini: <strong>{rupiah(gaji)}</strong>. Bila berbeda dengan SK Anda,
            periksa kembali golongan dan masa kerja golongan.
          </p>
        )}
      </fieldset>

      <fieldset className="iv-kelompok" disabled={mengirim}>
        <legend>5. Berkas SK</legend>
        <p className="iv-bantu" style={{ margin: 0 }}>PDF hasil pindai, paling besar 1 MB per berkas.</p>
        <div className="iv-berkas">
          {daftarBerkas.map((b) => {
            const f = berkas[b.jenis];
            const namaSimpan = /^\d{18}$/.test(isian.nip)
              ? namaBerkasInventaris(isian.nip, b.jenis, tanggalUntukBerkas(isian, b.jenis))
              : null;
            return (
              <label key={b.jenis} className="iv-unggah" data-isi={f ? "" : undefined}>
                <span className="iv-label" data-wajib={b.wajib ? "" : undefined}>{b.label}</span>
                <span className="iv-bantu">{b.keterangan}</span>
                <span className="iv-unggah-kotak">
                  <span className="iv-unggah-nama">{f ? f.name : "Pilih berkas PDF"}</span>
                  <span className="iv-unggah-tombol">{f ? "Ganti" : "Pilih"}</span>
                </span>
                {namaSimpan && <span className="iv-bantu">Disimpan sebagai {namaSimpan}</span>}
                <input type="file" accept="application/pdf" className="pub-visually-hidden" onChange={(e) => pilihBerkas(b.jenis, e.target.files?.[0] ?? null)} />
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="iv-kelompok" disabled={mengirim}>
        <legend>6. Catatan dan pernyataan</legend>
        <label className="iv-bidang">
          <span className="iv-label">Catatan untuk Tim SDM</span>
          <textarea className="iv-isian" rows={3} value={isian.catatan} onChange={(e) => ubah("catatan", e.target.value)} placeholder="mis. SK kenaikan pangkat terbaru masih dalam proses" />
        </label>
        <label className="iv-setuju">
          <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />
          <span>Data dan berkas yang saya kirim benar dan sesuai dengan SK asli.</span>
        </label>
      </fieldset>

      {galat.length > 0 && (
        <div className="iv-galat" id={`${id}-galat`} role="alert">
          <strong>Periksa kembali:</strong>
          <ul>{galat.map((g) => <li key={g}>{g}</li>)}</ul>
        </div>
      )}

      <div className="iv-kirim">
        <p className="iv-bantu">
          Data dan berkas disimpan di Google Drive Tim SDM Kanwil dan hanya dipakai untuk memperbarui data KGB Anda.
        </p>
        <button type="submit" className="iv-tombol" disabled={mengirim}>
          {mengirim ? "Mengirim…" : "Kirim data"}
        </button>
      </div>
    </form>
  );
}
