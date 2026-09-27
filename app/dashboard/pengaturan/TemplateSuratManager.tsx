"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DataSuratKGB } from "@/lib/generateSuratKGB";
import {
  PENANDA_TEMPLATE,
  TEMPLATE_BAWAAN,
  UKURAN_KERTAS,
  periksaTemplate,
  type BarisKop,
  type IsiTemplateSurat,
} from "@/lib/templateSurat";
import { formatTanggalId, hariIniWita, isoTanggalLokal } from "@/lib/waktu";

/* ─────────────────────────────────────────────────────────────────────────
   Template surat KGB (ADR-019). Super Admin menyusun versi baru: kertas dan
   tata letak, kop, kepala dan tujuan, kalimat isi, dan tembusan, dengan
   pratinjau PDF langsung. Setiap versi berlaku mulai tanggalnya sendiri; SK
   memakai versi yang berlaku pada tanggal suratnya. Tim SDM KGB hanya melihat
   dan mempratinjau (bolehUbah false).
   ───────────────────────────────────────────────────────────────────────── */

type KeadaanVersi = "aktif" | "terjadwal" | "riwayat";

interface VersiTampil {
  id: string;
  versi: number;
  berlakuMulai: string;
  catatan: string | null;
  dibuatOleh: string | null;
  dibuatAt: string | null;
  keadaan: KeadaanVersi;
  isi: IsiTemplateSurat;
}

const NADA_KEADAAN: Record<KeadaanVersi, [string, string]> = {
  aktif: ["hijau", "Berlaku sekarang"],
  terjadwal: ["biru", "Terjadwal"],
  riwayat: ["navy", "Riwayat"],
};

type Contoh = "upt" | "kanwil" | "dirjen";

/** Data contoh untuk pratinjau: pegawai UPT, pegawai Kanwil, atau pimpinan Kanwil yang SK-nya ditandatangani Dirjen. */
function dataContoh(contoh: Contoh, template: IsiTemplateSurat): DataSuratKGB {
  const kanwil = contoh !== "upt";
  return {
    nomorSurat: "W.17-KP.04.03-1234",
    tanggalSurat: hariIniWita(),
    kppn: "Banjarmasin",
    satker: kanwil ? { nama: "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan", kanwil: true } : { nama: "Rumah Tahanan Negara Kelas IIB Rantau", kanwil: false },
    pegawai: { nama: "NAMA PEGAWAI CONTOH, S.H.", nip: "198804012023011027", pangkat: "Penata Muda Tingkat I", golonganRuang: "III/b" },
    kgb: {
      gajiPokokLama: 2995000,
      nomorSK: "W.17-KP.04.03-777",
      tanggalSK: new Date(2024, 9, 1),
      tmtSK: new Date(2024, 10, 1),
      penetapSkDasar: "Kepala Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan",
      mkgTahunLama: 2,
      mkgBulanLama: 0,
      gajiPokokBaru: 3089300,
      mkgTahunBaru: 4,
      mkgBulanBaru: 0,
      pangkatGolonganBaru: "Penata Muda Tingkat I (III/b)",
      tmtKgbBaru: new Date(2026, 10, 1),
      tmtKgbBerikutnya: new Date(2028, 10, 1),
    },
    penandatangan:
      contoh === "dirjen"
        ? { jenis: "dirjen", jabatan: "Direktur Jenderal Pemasyarakatan", nama: "NAMA DIREKTUR JENDERAL" }
        : { jenis: "definitif", jabatan: "Kepala Kantor Wilayah", nama: "NAMA KEPALA KANTOR WILAYAH" },
    dasarHukum: "Nomor 5 Tahun 2024",
    template,
  };
}

const salin = (t: IsiTemplateSurat): IsiTemplateSurat => JSON.parse(JSON.stringify(t)) as IsiTemplateSurat;

/** Isian angka dengan satuan; kosong atau bukan angka dibiarkan di formulir dan ditolak validasi. */
function Angka({ label, nilai, onUbah, satuan, langkah = 0.1 }: {
  label: string; nilai: number; onUbah: (n: number) => void; satuan: string; langkah?: number;
}) {
  return (
    <label className="tpl-bidang">
      <span className="tpl-label">{label}</span>
      <span className="tpl-isian">
        <input
          type="number"
          step={langkah}
          value={Number.isFinite(nilai) ? nilai : ""}
          onChange={(e) => onUbah(e.target.value === "" ? Number.NaN : Number(e.target.value))}
          className="dsb-cari"
        />
        <span className="tpl-satuan">{satuan}</span>
      </span>
    </label>
  );
}

export default function TemplateSuratManager({ bolehUbah }: { bolehUbah: boolean }) {
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [belumAktif, setBelumAktif] = useState(false);
  const [versi, setVersi] = useState<VersiTampil[]>([]);
  const [isi, setIsi] = useState<IsiTemplateSurat>(() => salin(TEMPLATE_BAWAAN));
  const [dasarLabel, setDasarLabel] = useState("templat bawaan");
  const [tabKop, setTabKop] = useState<"baris" | "barisDitjen">("baris");
  const [berlakuMulai, setBerlakuMulai] = useState(() => isoTanggalLokal(hariIniWita()));
  const [catatan, setCatatan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [mengunggah, setMengunggah] = useState(false);
  const [contoh, setContoh] = useState<Contoh>("upt");
  const [urlPratinjau, setUrlPratinjau] = useState<string | null>(null);
  const [menyusun, setMenyusun] = useState(false);

  // Isian teks yang terakhir disentuh, tempat chip isian otomatis disisipkan.
  const aktif = useRef<{ el: HTMLInputElement | HTMLTextAreaElement; set: (v: string) => void } | null>(null);
  function catatFokus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>, set: (v: string) => void) {
    aktif.current = { el: e.currentTarget, set };
  }

  const muat = useCallback(async (pilihDasar = true) => {
    setMemuat(true);
    try {
      const res = await fetch("/api/template-surat");
      const d = (await res.json()) as { belumAktif?: boolean; versi?: VersiTampil[]; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Template surat gagal dimuat");
      setBelumAktif(!!d.belumAktif);
      const daftar = d.versi ?? [];
      setVersi(daftar);
      if (pilihDasar) {
        const berlaku = daftar.find((v) => v.keadaan === "aktif");
        setIsi(salin(berlaku?.isi ?? TEMPLATE_BAWAAN));
        setDasarLabel(berlaku ? `versi ${berlaku.versi} (berlaku sekarang)` : "templat bawaan");
      }
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Template surat gagal dimuat");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  const kesalahan = periksaTemplate(isi);

  // Pratinjau PDF disusun di peramban dengan jalur yang sama dengan SK sungguhan, ditunda sebentar setelah mengetik.
  useEffect(() => {
    if (kesalahan.length > 0) return;
    let batal = false;
    const t = setTimeout(async () => {
      setMenyusun(true);
      try {
        const { buatPdfSuratKgb } = await import("@/lib/generateSuratKGB");
        const blob = await buatPdfSuratKgb(dataContoh(contoh, isi), false);
        if (batal) return;
        const url = URL.createObjectURL(blob);
        setUrlPratinjau((lama) => {
          if (lama) URL.revokeObjectURL(lama);
          return url;
        });
      } catch {
        if (!batal) setGalat("Pratinjau gagal disusun. Periksa logo dan isian template.");
      } finally {
        if (!batal) setMenyusun(false);
      }
    }, 700);
    return () => {
      batal = true;
      clearTimeout(t);
    };
    // kesalahan dihitung dari isi; cukup isi dan contoh sebagai pemicu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isi, contoh]);

  useEffect(() => () => {
    setUrlPratinjau((lama) => {
      if (lama) URL.revokeObjectURL(lama);
      return null;
    });
  }, []);

  const ubah = (f: (t: IsiTemplateSurat) => void) =>
    setIsi((lama) => {
      const baru = salin(lama);
      f(baru);
      return baru;
    });

  function sisipkan(kunci: string) {
    const a = aktif.current;
    if (!a) return;
    const { el } = a;
    const awal = el.selectionStart ?? el.value.length;
    const akhir = el.selectionEnd ?? el.value.length;
    const sisip = `{${kunci}}`;
    a.set(el.value.slice(0, awal) + sisip + el.value.slice(akhir));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(awal + sisip.length, awal + sisip.length);
    });
  }

  async function unggahLogo(berkas: File) {
    setMengunggah(true);
    setGalat("");
    try {
      const form = new FormData();
      form.set("logo", berkas);
      const res = await fetch("/api/template-surat/logo", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { kunci?: string; error?: string };
      if (!res.ok || !d.kunci) throw new Error(d.error ?? "Logo gagal diunggah");
      ubah((t) => { t.kop.logo = d.kunci!; });
      setPesan("Logo diunggah. Logo baru dipakai SK setelah template disimpan sebagai versi baru.");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Logo gagal diunggah");
    } finally {
      setMengunggah(false);
    }
  }

  async function simpan() {
    if (kesalahan.length > 0) return;
    setMenyimpan(true);
    setGalat("");
    setPesan("");
    try {
      const res = await fetch("/api/template-surat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isi, berlakuMulai, catatan }),
      });
      const d = (await res.json().catch(() => ({}))) as { versi?: number; error?: string };
      if (!res.ok) throw new Error(d.error ?? "Template gagal disimpan");
      setPesan(`Versi ${d.versi} tersimpan, berlaku mulai ${formatTanggalId(new Date(`${berlakuMulai}T00:00:00`))}.`);
      setCatatan("");
      await muat(false);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Template gagal disimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(v: VersiTampil) {
    if (!window.confirm(`Hapus versi ${v.versi} yang terjadwal berlaku ${formatTanggalId(new Date(v.berlakuMulai))}?`)) return;
    setGalat("");
    const res = await fetch(`/api/template-surat/${v.id}`, { method: "DELETE" });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setGalat(d.error ?? "Versi gagal dihapus");
      return;
    }
    setPesan(`Versi ${v.versi} dihapus.`);
    await muat(false);
  }

  function pakai(v: VersiTampil | null) {
    setIsi(salin(v?.isi ?? TEMPLATE_BAWAAN));
    setDasarLabel(v ? `versi ${v.versi}` : "templat bawaan");
    setPesan(v ? `Formulir diisi dari versi ${v.versi}. Ubah lalu simpan sebagai versi baru.` : "Formulir diisi dari templat bawaan.");
  }

  const barisKop = isi.kop[tabKop];
  const ubahKop = (i: number, f: (b: BarisKop) => void) => ubah((t) => f(t.kop[tabKop][i]));
  const pindah = <T,>(daftar: T[], i: number, arah: -1 | 1) => {
    const j = i + arah;
    if (j < 0 || j >= daftar.length) return;
    [daftar[i], daftar[j]] = [daftar[j], daftar[i]];
  };

  if (memuat && versi.length === 0) return <p className="dsb-kosong">Memuat template surat…</p>;

  return (
    <div className="tpl">
      <style href="sim-kgb-template-surat" precedence="default">{GAYA}</style>

      {belumAktif && (
        <div role="status" className="dsb-pesan" data-nada="kuning">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>Tabel template surat belum dibuat di basis data, jadi SK memakai templat bawaan dan versi baru belum dapat disimpan. Jalankan migrasi template_surat.</p>
        </div>
      )}
      {!bolehUbah && (
        <div role="status" className="dsb-pesan" data-nada="biru">
          <span className="dsb-pesan-ikon" aria-hidden="true">i</span>
          <p>Hanya Super Admin yang dapat mengubah template. Anda dapat melihat isinya dan mempratinjau suratnya.</p>
        </div>
      )}
      {galat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>{galat}</p>
        </div>
      )}
      {pesan && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
          <p>{pesan}</p>
        </div>
      )}

      <div className="tpl-kisi">
        <fieldset className="tpl-form" disabled={!bolehUbah}>
          <p className="dsb-kecil" style={{ margin: 0 }}>Formulir berisi {dasarLabel}.</p>

          {/* ── Kertas dan tata letak ─────────────────────────────── */}
          <section className="tpl-kelompok" aria-labelledby="tpl-kertas">
            <h3 id="tpl-kertas">Kertas dan tata letak</h3>
            <div className="tpl-pilihan" role="group" aria-label="Ukuran kertas cepat">
              {UKURAN_KERTAS.map((u) => (
                <button
                  key={u.nama}
                  type="button"
                  className="dsb-tombol dsb-tombol-kecil"
                  data-jenis={isi.kertas.lebarMm === u.lebarMm && isi.kertas.tinggiMm === u.tinggiMm ? undefined : "garis"}
                  onClick={() => ubah((t) => { t.kertas = { lebarMm: u.lebarMm, tinggiMm: u.tinggiMm }; })}
                >
                  {u.nama} · {u.lebarMm}×{u.tinggiMm}
                </button>
              ))}
            </div>
            <div className="tpl-kisi2">
              <Angka label="Lebar kertas" satuan="mm" langkah={1} nilai={isi.kertas.lebarMm} onUbah={(n) => ubah((t) => { t.kertas.lebarMm = n; })} />
              <Angka label="Tinggi kertas" satuan="mm" langkah={1} nilai={isi.kertas.tinggiMm} onUbah={(n) => ubah((t) => { t.kertas.tinggiMm = n; })} />
              <Angka label="Awal isi (di bawah kop)" satuan="mm" nilai={isi.margin.atasMm} onUbah={(n) => ubah((t) => { t.margin.atasMm = n; })} />
              <Angka label="Margin bawah" satuan="mm" nilai={isi.margin.bawahMm} onUbah={(n) => ubah((t) => { t.margin.bawahMm = n; })} />
              <Angka label="Margin kiri" satuan="mm" nilai={isi.margin.kiriMm} onUbah={(n) => ubah((t) => { t.margin.kiriMm = n; })} />
              <Angka label="Margin kanan" satuan="mm" nilai={isi.margin.kananMm} onUbah={(n) => ubah((t) => { t.margin.kananMm = n; })} />
              <Angka label="Ukuran huruf isi" satuan="pt" nilai={isi.huruf.ukuranPt} onUbah={(n) => ubah((t) => { t.huruf.ukuranPt = n; })} />
              <Angka label="Spasi baris" satuan="×" langkah={0.01} nilai={isi.huruf.spasi} onUbah={(n) => ubah((t) => { t.huruf.spasi = n; })} />
            </div>
          </section>

          {/* ── Kop ───────────────────────────────────────────────── */}
          <section className="tpl-kelompok" aria-labelledby="tpl-kop">
            <h3 id="tpl-kop">Kop surat</h3>
            <div className="dsb-segmen" role="group" aria-label="Varian kop">
              <button type="button" aria-pressed={tabKop === "baris"} onClick={() => setTabKop("baris")}>
                Ditandatangani Kanwil
              </button>
              <button type="button" aria-pressed={tabKop === "barisDitjen"} onClick={() => setTabKop("barisDitjen")}>
                Ditandatangani Dirjen
              </button>
            </div>
            <ol className="tpl-daftar">
              {barisKop.map((b, i) => (
                <li key={i} className="tpl-baris-kop">
                  <input
                    className="dsb-cari tpl-teks"
                    value={b.teks}
                    aria-label={`Teks baris kop ${i + 1}`}
                    onFocus={(e) => catatFokus(e, (v) => ubahKop(i, (x) => { x.teks = v; }))}
                    onChange={(e) => ubahKop(i, (x) => { x.teks = e.target.value; })}
                  />
                  <span className="tpl-baris-atur">
                    <label className="tpl-cek"><input type="checkbox" className="dsb-cek" checked={b.tebal} onChange={(e) => ubahKop(i, (x) => { x.tebal = e.target.checked; })} /> Tebal</label>
                    <Angka label="Huruf" satuan="pt" nilai={b.ukuranPt} onUbah={(n) => ubahKop(i, (x) => { x.ukuranPt = n; })} />
                    <Angka label="Geser" satuan="pt" nilai={b.geserPt} onUbah={(n) => ubahKop(i, (x) => { x.geserPt = n; })} />
                    <Angka label="Jarak atas" satuan="pt" nilai={b.jarakAtasPt} onUbah={(n) => ubahKop(i, (x) => { x.jarakAtasPt = n; })} />
                    <span className="tpl-urut">
                      <button type="button" className="dsb-ikon-tombol" aria-label="Naikkan" onClick={() => ubah((t) => pindah(t.kop[tabKop], i, -1))}>↑</button>
                      <button type="button" className="dsb-ikon-tombol" aria-label="Turunkan" onClick={() => ubah((t) => pindah(t.kop[tabKop], i, 1))}>↓</button>
                      <button type="button" className="dsb-ikon-tombol" data-nada="merah" aria-label={`Hapus baris kop ${i + 1}`} onClick={() => ubah((t) => { t.kop[tabKop].splice(i, 1); })}>×</button>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="dsb-tombol dsb-tombol-kecil"
              data-jenis="garis"
              onClick={() => ubah((t) => { t.kop[tabKop].push({ teks: "", tebal: false, ukuranPt: 10, geserPt: 0, jarakAtasPt: 0 }); })}
            >
              + Baris kop
            </button>
            <p className="dsb-kecil" style={{ margin: 0 }}>Alamat surel di baris kop dicetak miring biru. Geser menggeser baris ke kanan (positif) atau kiri (negatif) dari tengah.</p>

            <div className="tpl-kisi2">
              <label className="tpl-bidang">
                <span className="tpl-label">Logo</span>
                <select
                  className="dsb-pilih"
                  value={isi.kop.logo === "bawaan" || isi.kop.logo === "tanpa" ? isi.kop.logo : "unggahan"}
                  onChange={(e) => ubah((t) => { if (e.target.value !== "unggahan") t.kop.logo = e.target.value; })}
                >
                  <option value="bawaan">Logo Kementerian (bawaan)</option>
                  <option value="tanpa">Tanpa logo</option>
                  {isi.kop.logo !== "bawaan" && isi.kop.logo !== "tanpa" && <option value="unggahan">Logo unggahan</option>}
                </select>
              </label>
              {bolehUbah && (
                <label className="tpl-bidang">
                  <span className="tpl-label">Unggah logo (PNG/JPEG, maks. 500 KB)</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="dsb-cari"
                    disabled={mengunggah}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void unggahLogo(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <Angka label="Logo dari kiri" satuan="mm" nilai={isi.kop.logoKiriMm} onUbah={(n) => ubah((t) => { t.kop.logoKiriMm = n; })} />
              <Angka label="Logo dari atas" satuan="mm" nilai={isi.kop.logoAtasMm} onUbah={(n) => ubah((t) => { t.kop.logoAtasMm = n; })} />
              <Angka label="Ukuran logo" satuan="mm" nilai={isi.kop.logoUkuranMm} onUbah={(n) => ubah((t) => { t.kop.logoUkuranMm = n; })} />
              <Angka label="Teks kop dari atas" satuan="mm" nilai={isi.kop.teksAtasMm} onUbah={(n) => ubah((t) => { t.kop.teksAtasMm = n; })} />
              <Angka label="Teks kop dari margin kiri" satuan="mm" nilai={isi.kop.teksIndenMm} onUbah={(n) => ubah((t) => { t.kop.teksIndenMm = n; })} />
              <Angka label="Garis kop dari atas" satuan="mm" nilai={isi.kop.garisAtasMm} onUbah={(n) => ubah((t) => { t.kop.garisAtasMm = n; })} />
            </div>
            <label className="tpl-cek">
              <input type="checkbox" className="dsb-cek" checked={isi.kop.garis} onChange={(e) => ubah((t) => { t.kop.garis = e.target.checked; })} /> Garis di bawah kop
            </label>
          </section>

          {/* ── Kepala dan tujuan ─────────────────────────────────── */}
          <section className="tpl-kelompok" aria-labelledby="tpl-kepala">
            <h3 id="tpl-kepala">Kepala dan tujuan</h3>
            <div className="tpl-kisi2">
              {([
                ["sifat", "Sifat"],
                ["lampiran", "Lampiran"],
                ["hal", "Hal"],
                ["atasNama", "Baris di bawah Hal (kosongkan bila tidak perlu)"],
                ["tanggal", "Tanggal surat (kanan atas)"],
              ] as const).map(([k, label]) => (
                <label key={k} className="tpl-bidang">
                  <span className="tpl-label">{label}</span>
                  <input
                    className="dsb-cari"
                    value={isi.kepala[k]}
                    onFocus={(e) => catatFokus(e, (v) => ubah((t) => { t.kepala[k] = v; }))}
                    onChange={(e) => ubah((t) => { t.kepala[k] = e.target.value; })}
                  />
                </label>
              ))}
            </div>
            <label className="tpl-bidang">
              <span className="tpl-label">Tujuan (tiap baris dicetak sebagai baris sendiri)</span>
              <textarea
                className="dsb-cari tpl-area"
                rows={2}
                value={isi.tujuan}
                onFocus={(e) => catatFokus(e, (v) => ubah((t) => { t.tujuan = v; }))}
                onChange={(e) => ubah((t) => { t.tujuan = e.target.value; })}
              />
            </label>
          </section>

          {/* ── Isi ───────────────────────────────────────────────── */}
          <section className="tpl-kelompok" aria-labelledby="tpl-isi">
            <h3 id="tpl-isi">Kalimat isi</h3>
            <p className="dsb-kecil" style={{ margin: 0 }}>
              Data pegawai, dasar SK, dan hasil KGB dicetak otomatis di antara paragraf. Tulis <b>**teks**</b> untuk huruf tebal.
            </p>
            {([
              ["pembuka", "Paragraf pembuka (sebelum data pegawai)"],
              ["dasarSk", "Paragraf dasar SK (sebelum rincian SK terakhir)"],
              ["hasil", "Paragraf hasil (sebelum gaji pokok baru)"],
              ["penutup", "Paragraf penutup (sebelum tanda tangan)"],
            ] as const).map(([k, label]) => (
              <label key={k} className="tpl-bidang">
                <span className="tpl-label">{label}</span>
                <textarea
                  className="dsb-cari tpl-area"
                  rows={3}
                  value={isi.paragraf[k]}
                  onFocus={(e) => catatFokus(e, (v) => ubah((t) => { t.paragraf[k] = v; }))}
                  onChange={(e) => ubah((t) => { t.paragraf[k] = e.target.value; })}
                />
              </label>
            ))}
          </section>

          {/* ── Tembusan ──────────────────────────────────────────── */}
          <section className="tpl-kelompok" aria-labelledby="tpl-tembusan">
            <h3 id="tpl-tembusan">Tembusan</h3>
            <label className="tpl-bidang">
              <span className="tpl-label">Judul</span>
              <input className="dsb-cari" value={isi.tembusanJudul} onChange={(e) => ubah((t) => { t.tembusanJudul = e.target.value; })} />
            </label>
            <ol className="tpl-daftar">
              {isi.tembusan.map((b, i) => (
                <li key={i} className="tpl-baris-tembusan">
                  <span className="tpl-nomor">{i + 1}.</span>
                  <input
                    className="dsb-cari tpl-teks"
                    value={b.teks}
                    aria-label={`Tembusan ${i + 1}`}
                    onFocus={(e) => catatFokus(e, (v) => ubah((t) => { t.tembusan[i].teks = v; }))}
                    onChange={(e) => ubah((t) => { t.tembusan[i].teks = e.target.value; })}
                  />
                  <label className="tpl-cek" title="Tidak dicetak bila pegawainya pegawai Kanwil">
                    <input type="checkbox" className="dsb-cek" checked={b.kecualiKanwil} onChange={(e) => ubah((t) => { t.tembusan[i].kecualiKanwil = e.target.checked; })} />
                    Kecuali pegawai Kanwil
                  </label>
                  <span className="tpl-urut">
                    <button type="button" className="dsb-ikon-tombol" aria-label="Naikkan" onClick={() => ubah((t) => pindah(t.tembusan, i, -1))}>↑</button>
                    <button type="button" className="dsb-ikon-tombol" aria-label="Turunkan" onClick={() => ubah((t) => pindah(t.tembusan, i, 1))}>↓</button>
                    <button type="button" className="dsb-ikon-tombol" data-nada="merah" aria-label={`Hapus tembusan ${i + 1}`} onClick={() => ubah((t) => { t.tembusan.splice(i, 1); })}>×</button>
                  </span>
                </li>
              ))}
            </ol>
            <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => ubah((t) => { t.tembusan.push({ teks: "", kecualiKanwil: false }); })}>
              + Tembusan
            </button>
          </section>
        </fieldset>

        {/* ── Kolom kanan: isian otomatis, pratinjau, simpan, versi ── */}
        <div className="tpl-samping">
          <section className="tpl-kelompok" aria-labelledby="tpl-penanda">
            <h3 id="tpl-penanda">Isian otomatis</h3>
            <p className="dsb-kecil" style={{ margin: 0 }}>Klik isian teks di formulir, lalu klik chip untuk menyisipkannya.</p>
            <div className="tpl-chip">
              {PENANDA_TEMPLATE.map((p) => (
                <button key={p.kunci} type="button" className="dsb-tag" data-garis="" title={p.label} disabled={!bolehUbah} onMouseDown={(e) => e.preventDefault()} onClick={() => sisipkan(p.kunci)}>
                  {`{${p.kunci}}`}
                </button>
              ))}
            </div>
          </section>

          <section className="tpl-kelompok" aria-labelledby="tpl-pratinjau">
            <div className="tpl-kepala-pratinjau">
              <h3 id="tpl-pratinjau">Pratinjau</h3>
              <select className="dsb-pilih" value={contoh} onChange={(e) => setContoh(e.target.value as Contoh)} aria-label="Contoh pegawai">
                <option value="upt">Pegawai UPT</option>
                <option value="kanwil">Pegawai Kanwil</option>
                <option value="dirjen">Pimpinan Kanwil (kop Dirjen)</option>
              </select>
            </div>
            {kesalahan.length > 0 ? (
              <ul className="tpl-galat" role="alert">
                {kesalahan.map((k) => <li key={k}>{k}</li>)}
              </ul>
            ) : urlPratinjau ? (
              <iframe className="tpl-bingkai" src={`${urlPratinjau}#toolbar=0&view=FitH`} title="Pratinjau surat KGB" />
            ) : (
              <p className="dsb-kosong">Menyusun pratinjau…</p>
            )}
            <p className="dsb-kecil" style={{ margin: 0 }}>{menyusun ? "Memperbarui pratinjau…" : "Data contoh; nomor dan tanggal mengikuti hari ini."}</p>
          </section>

          {bolehUbah && (
            <section className="tpl-kelompok" aria-labelledby="tpl-simpan">
              <h3 id="tpl-simpan">Simpan sebagai versi baru</h3>
              <div className="tpl-kisi2">
                <label className="tpl-bidang">
                  <span className="tpl-label">Berlaku mulai</span>
                  <input type="date" className="dsb-cari" value={berlakuMulai} min={isoTanggalLokal(hariIniWita())} onChange={(e) => setBerlakuMulai(e.target.value)} />
                </label>
                <label className="tpl-bidang">
                  <span className="tpl-label">Catatan</span>
                  <input className="dsb-cari" value={catatan} placeholder="Mis. kop baru sesuai surat edaran" onChange={(e) => setCatatan(e.target.value)} />
                </label>
              </div>
              <p className="dsb-kecil" style={{ margin: 0 }}>
                SK bertanggal sejak hari itu memakai versi ini. SK yang sudah terbit tetap tercetak dengan versi yang berlaku saat itu.
              </p>
              <button type="button" className="dsb-tombol" onClick={() => void simpan()} disabled={menyimpan || kesalahan.length > 0 || belumAktif}>
                {menyimpan ? "Menyimpan…" : "Simpan versi baru"}
              </button>
            </section>
          )}

          <section className="tpl-kelompok" aria-labelledby="tpl-versi">
            <h3 id="tpl-versi">Versi template</h3>
            <ul className="tpl-versi">
              {versi.map((v) => {
                const [nada, label] = NADA_KEADAAN[v.keadaan];
                return (
                  <li key={v.id}>
                    <span className="min-w-0">
                      <span className="dsb-nama">Versi {v.versi}</span>{" "}
                      <span className="dsb-tag" data-garis="" data-nada={nada}>{label}</span>
                      <span className="dsb-kecil" style={{ display: "block" }}>
                        Berlaku {formatTanggalId(new Date(v.berlakuMulai))}
                        {v.dibuatOleh ? ` · ${v.dibuatOleh}` : ""}
                        {v.catatan ? ` · ${v.catatan}` : ""}
                      </span>
                    </span>
                    <span className="tpl-urut">
                      <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => pakai(v)}>
                        {bolehUbah ? "Pakai sebagai dasar" : "Lihat"}
                      </button>
                      {bolehUbah && v.keadaan === "terjadwal" && (
                        <button type="button" className="dsb-ikon-tombol" data-nada="merah" aria-label={`Hapus versi ${v.versi}`} onClick={() => void hapus(v)}>×</button>
                      )}
                    </span>
                  </li>
                );
              })}
              <li>
                <span className="min-w-0">
                  <span className="dsb-nama">Templat bawaan</span>{" "}
                  {!versi.some((v) => v.keadaan === "aktif") && <span className="dsb-tag" data-garis="" data-nada="hijau">Berlaku sekarang</span>}
                  <span className="dsb-kecil" style={{ display: "block" }}>Surat A4 sebelum template dapat diatur; dipakai SK sebelum versi pertama berlaku</span>
                </span>
                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => pakai(null)}>
                  {bolehUbah ? "Pakai sebagai dasar" : "Lihat"}
                </button>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

const GAYA = `
.tpl { display: grid; gap: 14px; container-type: inline-size; }
.tpl-kisi { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
/* Dua kolom hanya bila wadahnya sendiri cukup lebar (panel Pengaturan lebih sempit dari layar). */
@container (min-width: 1060px) { .tpl-kisi { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); } .tpl-samping { position: sticky; top: 0; } }
.tpl-form { display: grid; gap: 14px; min-width: 0; min-inline-size: 0; margin: 0; padding: 0; border: 0; }
.tpl-form:disabled { opacity: .85; }
.tpl-samping { display: grid; gap: 14px; min-width: 0; }
.tpl-kelompok { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--ln1); border-radius: 12px; background: var(--card); }
.tpl-kelompok h3 { margin: 0; font-size: 13px; font-weight: 600; color: var(--dtn); }
.tpl-kisi2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.tpl-bidang { display: grid; gap: 4px; min-width: 0; }
.tpl-label { font-size: 12px; font-weight: 600; color: var(--dt2); }
.tpl-isian { position: relative; display: block; }
.tpl-isian .dsb-cari { width: 100%; min-width: 0; flex: none; padding-right: 36px; }
.tpl-satuan { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--dt5); pointer-events: none; }
.tpl-pilihan { display: flex; flex-wrap: wrap; gap: 6px; }
.tpl-daftar { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.tpl-baris-kop { display: grid; gap: 6px; padding: 8px; border: 1px solid var(--ln2); border-radius: 10px; }
.tpl-baris-atur { display: grid; grid-template-columns: auto repeat(3, minmax(80px, 1fr)) auto; gap: 8px; align-items: end; }
.tpl-baris-tembusan { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; gap: 8px; align-items: center; }
.tpl-nomor { font-size: 12px; color: var(--dt4); width: 18px; }
.tpl-teks { width: 100%; }
.tpl-area { width: 100%; resize: vertical; min-height: 56px; line-height: 1.45; }
.tpl-cek { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dt2); white-space: nowrap; }
.tpl-urut { display: inline-flex; gap: 4px; align-items: center; }
.tpl-chip { display: flex; flex-wrap: wrap; gap: 6px; }
.tpl-chip .dsb-tag { cursor: pointer; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 11px; }
.tpl-kepala-pratinjau { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.tpl-bingkai { width: 100%; height: min(78vh, 900px); border: 1px solid var(--ln1); border-radius: 8px; background: #fff; }
.tpl-galat { margin: 0; padding: 10px 12px 10px 28px; border-radius: 8px; background: var(--tint-red-bg); color: var(--st-red); font-size: 12px; display: grid; gap: 4px; }
.tpl-versi { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.tpl-versi li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--ln2); }
.tpl-versi li:last-child { border-bottom: 0; }
@container (max-width: 560px) {
  .tpl-baris-atur { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tpl-baris-tembusan { grid-template-columns: auto minmax(0, 1fr); }
  .tpl-baris-tembusan .tpl-cek, .tpl-baris-tembusan .tpl-urut { grid-column: 2; }
  .tpl-versi li { flex-wrap: wrap; }
}
`;
