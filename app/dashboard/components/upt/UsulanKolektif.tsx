"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BATAS_BERKAS_USULAN_BYTE, PESAN_BERKAS_TERLALU_BESAR, berkasUntukKeadaan, hitungUsulan, pernahKgb } from "@/lib/usulanPegawai";
import { BIDANG_DIISI } from "@/lib/usulanFormulir";
import { GOLONGAN_PANGKAT } from "@/lib/tabelGaji";
import { kunciBulanTmt } from "@/lib/rekapKgb";
import { geserBulan, namaBulan } from "@/app/dashboard/satker/labelSatker";
import { formatTanggalId, hariIniWita } from "@/lib/waktu";

/* Usulan kolektif Admin UPT (ADR-015). Satu surat Srikandi lazimnya memuat banyak pegawai: pegawai baru,
   perbaikan data, dan kelengkapan berkas sekaligus. Halaman ini menyiapkan semuanya dalam satu tabel: pilih
   pegawai, ubah yang keliru, lampirkan berkas per baris, simpan sekaligus sebagai draf, lalu ajukan dengan satu
   surat. Tiap baris tetap disimpan lewat rute yang sama dengan formulir perorangan (POST/PATCH
   /api/upt/usulan), sehingga aturan kelengkapan dan pemeriksaannya tidak berbeda. Laporan hukuman disiplin
   tetap lewat formulir perorangan. */

interface PegawaiUpt {
  id: string;
  nama: string;
  nip: string;
  golonganRuang: string;
  tmtKgb: string | null;
  bulanTmt: string | null;
  statusKGB: string | null;
  usulanBerjalan?: string | null;
  dataSekarang: Record<string, string>;
}

interface DrafUpt {
  id: string;
  pegawaiId: string | null;
  jenis: string;
  nama: string;
  nip: string;
  status: string;
  nilai: Record<string, string> | null;
  surat: { nomorSkTerakhir: string; tanggalSkTerakhir: string; catatanUpt: string } | null;
  hukdis: { ada: boolean; jenis: string; nomorSk: string; tmtMulai: string; tmtBerakhir: string; keterangan: string } | null;
  berkas: { medan: string; label: string; nama?: string | null }[];
  kekurangan: string[];
}

type Keadaan = "siap" | "menyimpan" | "tersimpan" | "galat";

interface Baris {
  kunci: string;
  pegawaiId: string | null;
  drafId: string | null;
  jenis: "perubahan" | "baru";
  nama: string;
  nip: string;
  /** Nilai tercatat (data pegawai atau isi draf); pembanding untuk menandai yang berubah. */
  awal: Record<string, string>;
  isian: Record<string, string>;
  pernah: boolean;
  berkas: Record<string, File | null>;
  tersimpan: { medan: string; label: string; nama?: string | null }[];
  hukdis: DrafUpt["hukdis"];
  catatanUpt: string;
  keadaan: Keadaan;
  pesan: string | null;
}

/** Isian yang disunting di tabel; sisanya ikut dari data tercatat apa adanya. */
const KOLOM_TABEL = ["golonganRuang", "mkgTahun", "mkgBulan", "tmtKgbTerakhir", "nomorSkTerakhir", "tanggalSkTerakhir"] as const;

function barisDari(p: PegawaiUpt | null, d: DrafUpt | null): Baris {
  const data = d?.nilai ?? p?.dataSekarang ?? {};
  const awal: Record<string, string> = {
    ...data,
    tmtKgbTerakhir: data.tmtKgbTerakhir || data.tmtGolongan || "",
    nomorSkTerakhir: d?.surat?.nomorSkTerakhir ?? "",
    tanggalSkTerakhir: d?.surat?.tanggalSkTerakhir ?? "",
  };
  return {
    kunci: d ? `draf:${d.id}` : `pegawai:${p!.id}`,
    pegawaiId: p?.id ?? d?.pegawaiId ?? null,
    drafId: d?.id ?? null,
    jenis: d?.jenis === "baru" ? "baru" : "perubahan",
    nama: p?.nama ?? d?.nama ?? "-",
    nip: p?.nip ?? d?.nip ?? "-",
    awal,
    isian: { ...awal },
    pernah: pernahKgb(awal.mkgTahun, awal.mkgBulan),
    berkas: {},
    tersimpan: d?.berkas ?? [],
    hukdis: d?.hukdis ?? null,
    catatanUpt: d?.surat?.catatanUpt ?? "",
    keadaan: "siap",
    pesan: null,
  };
}

const berubah = (b: Baris) =>
  KOLOM_TABEL.some((k) => (b.isian[k] ?? "") !== (b.awal[k] ?? "")) || Object.values(b.berkas).some(Boolean);

export default function UsulanKolektif() {
  const [pegawai, setPegawai] = useState<PegawaiUpt[]>([]);
  const [draf, setDraf] = useState<DrafUpt[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [terpilih, setTerpilih] = useState<Set<string>>(() => new Set());
  const [cari, setCari] = useState("");
  const [baris, setBaris] = useState<Baris[] | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [surat, setSurat] = useState({ nomorSurat: "", tanggalSurat: "" });
  const [berkasSurat, setBerkasSurat] = useState<File | null>(null);
  const [pilihAjukan, setPilihAjukan] = useState<Set<string>>(() => new Set());
  const [mengajukan, setMengajukan] = useState(false);
  const [selesai, setSelesai] = useState<string | null>(null);

  const bulanUsulan = geserBulan(kunciBulanTmt(hariIniWita()) ?? "", 2);

  async function muat() {
    setMemuat(true);
    try {
      const [rp, ru] = await Promise.all([fetch("/api/upt"), fetch("/api/upt/usulan")]);
      const dp = (await rp.json().catch(() => ({}))) as { pegawai?: PegawaiUpt[]; error?: string };
      const du = (await ru.json().catch(() => [])) as DrafUpt[];
      if (!rp.ok) throw new Error(dp.error ?? "Data pegawai gagal dimuat");
      setPegawai(dp.pegawai ?? []);
      setDraf(Array.isArray(du) ? du : []);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Data gagal dimuat");
    } finally {
      setMemuat(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, []);

  /** Usulan yang masih dipegang UPT (draf atau dikembalikan), per pegawai. */
  const drafPerPegawai = useMemo(
    () => new Map(draf.filter((d) => d.pegawaiId && (d.status === "draf" || d.status === "revisi")).map((d) => [d.pegawaiId as string, d])),
    [draf],
  );
  const drafBaru = draf.filter((d) => d.jenis === "baru" && (d.status === "draf" || d.status === "revisi"));
  const dapatDipilih = (p: PegawaiUpt) => p.usulanBerjalan !== "menunggu";

  const q = cari.trim().toLowerCase();
  const daftarPilih = pegawai.filter((p) => !q || `${p.nama} ${p.nip}`.toLowerCase().includes(q));
  const jatuhTempo = pegawai.filter((p) => p.bulanTmt === bulanUsulan && dapatDipilih(p));

  function alih(id: string) {
    setTerpilih((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  }

  function susunTabel() {
    const dariPegawai = pegawai.filter((p) => terpilih.has(p.id)).map((p) => barisDari(p, drafPerPegawai.get(p.id) ?? null));
    setBaris([...dariPegawai, ...drafBaru.map((d) => barisDari(null, d))]);
    setSelesai(null);
  }

  function ubahBaris(kunci: string, ubah: (b: Baris) => Baris) {
    setBaris((lama) => lama?.map((b) => (b.kunci === kunci ? ubah({ ...b, keadaan: b.keadaan === "tersimpan" ? "siap" : b.keadaan }) : b)) ?? null);
  }

  function isi(kunci: string, kolom: string, nilai: string) {
    ubahBaris(kunci, (b) => ({ ...b, isian: { ...b.isian, [kolom]: nilai } }));
  }

  function pilihBerkas(kunci: string, medan: string, file: File | null) {
    if (file && file.size > BATAS_BERKAS_USULAN_BYTE) {
      ubahBaris(kunci, (b) => ({ ...b, keadaan: "galat", pesan: PESAN_BERKAS_TERLALU_BESAR }));
      return;
    }
    ubahBaris(kunci, (b) => ({ ...b, berkas: { ...b.berkas, [medan]: file }, pesan: null }));
  }

  /** Satu baris menjadi FormData yang sama dengan formulir perorangan (FormulirUsulan). */
  function formBaris(b: Baris): FormData {
    const form = new FormData();
    form.set("status", "draf");
    form.set("jenis", b.jenis);
    if (b.pegawaiId && b.jenis === "perubahan") form.set("pegawaiId", b.pegawaiId);
    for (const bidang of BIDANG_DIISI) form.set(bidang.kunci, b.isian[bidang.kunci] ?? "");
    form.set("nomorSkTerakhir", b.isian.nomorSkTerakhir ?? "");
    form.set("tanggalSkTerakhir", b.isian.tanggalSkTerakhir ?? "");
    form.set("catatanUpt", b.catatanUpt);
    // Laporan hukuman disiplin pada draf yang sudah ada dipertahankan; menambahkannya lewat formulir perorangan.
    form.set("hukdisAda", String(!!b.hukdis?.ada));
    if (b.hukdis?.ada) {
      form.set("hukdisJenis", b.hukdis.jenis);
      form.set("hukdisNomorSk", b.hukdis.nomorSk);
      form.set("hukdisTmtMulai", b.hukdis.tmtMulai);
      form.set("hukdisTmtBerakhir", b.hukdis.tmtBerakhir);
      form.set("hukdisKeterangan", b.hukdis.keterangan);
    }
    for (const [medan, file] of Object.entries(b.berkas)) if (file) form.set(medan, file);
    return form;
  }

  async function simpanSemua() {
    if (!baris) return;
    // Draf yang tidak diubah sudah tersimpan; yang disimpan hanya baris yang berubah atau diberi berkas.
    const sasaran = baris.filter((b) => b.keadaan !== "tersimpan" && berubah(b));
    if (sasaran.length === 0) {
      setGalat("Belum ada yang diubah atau dilampiri berkas.");
      return;
    }
    setMenyimpan(true);
    setGalat(null);
    const idTersimpan: string[] = [];
    // Berurutan, bukan serentak: tiap baris membawa berkas, dan antrean kecil lebih ramah bagi koneksi UPT.
    for (const b of sasaran) {
      ubahBaris(b.kunci, (x) => ({ ...x, keadaan: "menyimpan", pesan: null }));
      try {
        const res = b.drafId
          ? await fetch(`/api/upt/usulan/${b.drafId}`, { method: "PATCH", body: formBaris(b) })
          : await fetch("/api/upt/usulan", { method: "POST", body: formBaris(b) });
        const d = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
        if (!res.ok) {
          ubahBaris(b.kunci, (x) => ({ ...x, keadaan: "galat", pesan: d.error ?? "Gagal disimpan" }));
          continue;
        }
        const id = b.drafId ?? d.id ?? null;
        if (id) idTersimpan.push(id);
        ubahBaris(b.kunci, (x) => ({ ...x, drafId: id, awal: { ...x.isian }, berkas: {}, keadaan: "tersimpan", pesan: null }));
      } catch {
        ubahBaris(b.kunci, (x) => ({ ...x, keadaan: "galat", pesan: "Gagal disimpan" }));
      }
    }
    setMenyimpan(false);
    // Kelengkapan tiap draf dihitung server; yang sudah lengkap langsung dicentang untuk diajukan.
    const ru = await fetch("/api/upt/usulan");
    const du = (await ru.json().catch(() => [])) as DrafUpt[];
    if (Array.isArray(du)) {
      setDraf(du);
      const idSesi = new Set([...idTersimpan, ...baris.map((b) => b.drafId).filter((id): id is string => !!id)]);
      setPilihAjukan(new Set(du.filter((d) => idSesi.has(d.id) && d.kekurangan.length === 0).map((d) => d.id)));
    }
  }

  const drafSesiIni = baris ? draf.filter((d) => baris.some((b) => b.drafId === d.id) && (d.status === "draf" || d.status === "revisi")) : [];

  async function ajukan() {
    if (pilihAjukan.size === 0) return;
    if (!surat.nomorSurat.trim() || !surat.tanggalSurat) {
      setGalat("Isi nomor dan tanggal surat usulan Srikandi.");
      return;
    }
    setMengajukan(true);
    setGalat(null);
    try {
      const form = new FormData();
      for (const id of pilihAjukan) form.append("id", id);
      form.set("nomorSurat", surat.nomorSurat.trim());
      form.set("tanggalSurat", surat.tanggalSurat);
      if (berkasSurat) form.set("berkas", berkasSurat);
      const res = await fetch("/api/upt/usulan/ajukan", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string; jumlah?: number };
      if (!res.ok) {
        setGalat(d.error ?? "Usulan gagal dikirim");
        return;
      }
      setSelesai(`${d.jumlah ?? pilihAjukan.size} pegawai diusulkan ke Kanwil dengan surat ${surat.nomorSurat.trim()}.`);
      setBaris(null);
      setTerpilih(new Set());
      setPilihAjukan(new Set());
      setSurat({ nomorSurat: "", tanggalSurat: "" });
      setBerkasSurat(null);
      void muat();
    } catch {
      setGalat("Usulan gagal dikirim");
    } finally {
      setMengajukan(false);
    }
  }

  const jumlahBerubah = baris?.filter((b) => b.keadaan !== "tersimpan" && berubah(b)).length ?? 0;

  return (
    <div className="dsb-halaman">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Data Pegawai</p>
          <h1 className="dsb-halaman-judul">Usulan kolektif</h1>
          <p className="dsb-sub">
            Siapkan banyak pegawai untuk satu surat Srikandi sekaligus: ubah yang keliru, lampirkan berkasnya per
            baris, simpan semuanya, lalu ajukan dengan satu surat.
          </p>
        </div>
        <Link href="/dashboard/upt/pegawai" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">← Data Pegawai</Link>
      </header>

      {selesai && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
          <p>{selesai} Pantau hasilnya di Riwayat.</p>
        </div>
      )}
      {galat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>{galat}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setGalat(null)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* ── 1. Pilih pegawai ─────────────────────────────────────── */}
      <section className="dsb-panel" aria-labelledby="judul-pilih-kolektif">
        <div className="dsb-panel-kepala">
          <h2 id="judul-pilih-kolektif" className="dsb-panel-judul">
            1. Pilih pegawai <small>{terpilih.size} dipilih{drafBaru.length > 0 ? ` · ${drafBaru.length} pegawai baru ikut otomatis` : ""}</small>
          </h2>
          <span className="upt-aksi">
            <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setTerpilih(new Set(jatuhTempo.map((p) => p.id)))} disabled={jatuhTempo.length === 0}>
              KGB {namaBulan(bulanUsulan)} ({jatuhTempo.length})
            </button>
            <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setTerpilih(new Set())} disabled={terpilih.size === 0}>
              Kosongkan
            </button>
          </span>
        </div>
        <div className="dsb-alat" style={{ padding: "8px 16px" }}>
          <input type="search" className="dsb-cari" style={{ flex: "1 1 240px" }} placeholder="Cari nama atau NIP" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari pegawai" />
        </div>
        {memuat ? (
          <p className="dsb-kosong">Memuat pegawai…</p>
        ) : (
          <ul className="kol-pilih">
            {daftarPilih.map((p) => (
              <li key={p.id}>
                <label data-mati={dapatDipilih(p) ? undefined : ""}>
                  <input type="checkbox" className="dsb-cek" checked={terpilih.has(p.id)} disabled={!dapatDipilih(p)} onChange={() => alih(p.id)} />
                  <span className="min-w-0">
                    <span className="dsb-nama">{p.nama}</span>
                    <span className="dsb-kecil">
                      {p.golonganRuang} · TMT {p.tmtKgb ? formatTanggalId(p.tmtKgb, { month: "short", year: "numeric" }) : "-"}
                      {!dapatDipilih(p) ? " · sedang ditinjau Kanwil" : drafPerPegawai.has(p.id) ? " · ada draf" : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="dsb-kaki">
          <span>Pegawai yang usulannya sedang ditinjau Kanwil tidak dapat dipilih.</span>
          <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={susunTabel} disabled={terpilih.size + drafBaru.length === 0}>
            Susun tabel ({terpilih.size + drafBaru.length})
          </button>
        </div>
      </section>

      {/* ── 2. Tabel kolektif ────────────────────────────────────── */}
      {baris && (
        <section className="dsb-panel" aria-labelledby="judul-tabel-kolektif">
          <div className="dsb-panel-kepala">
            <h2 id="judul-tabel-kolektif" className="dsb-panel-judul">
              2. Periksa dan lengkapi <small>{baris.length} pegawai · {jumlahBerubah} berubah</small>
            </h2>
          </div>
          <p className="kol-petunjuk">
            Isian sudah terisi data yang tercatat. Ubah yang keliru saja; isian yang berubah ditandai kuning. Berkas yang
            diminta mengikuti keadaan KGB tiap pegawai. Baris tanpa perubahan dan tanpa berkas tidak disimpan.
          </p>
          <div className="kol-gulir">
            <table className="dsb-tabel kol-tabel">
              <thead>
                <tr>
                  <th scope="col">Pegawai</th>
                  <th scope="col">Keadaan KGB</th>
                  <th scope="col">Golongan</th>
                  <th scope="col">Masa kerja</th>
                  <th scope="col">TMT KGB terakhir / CPNS</th>
                  <th scope="col">SK dasar</th>
                  <th scope="col">Berkas</th>
                  <th scope="col">Gaji pokok</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => {
                  const hitung = hitungUsulan({
                    golonganRuang: b.isian.golonganRuang,
                    mkgTahun: b.isian.mkgTahun ?? "0",
                    mkgBulan: b.isian.mkgBulan ?? "0",
                    tmtKgbTerakhir: b.isian.tmtKgbTerakhir || null,
                  });
                  const beda = (k: string) => ((b.isian[k] ?? "") !== (b.awal[k] ?? "") ? "" : undefined);
                  return (
                    <tr key={b.kunci} data-keadaan={b.keadaan}>
                      <td>
                        <p className="dsb-nama" style={{ margin: 0 }}>{b.nama}</p>
                        <p className="dsb-kecil" style={{ margin: 0 }}>
                          {b.nip}
                          {b.jenis === "baru" && <span className="dsb-tag" data-garis="" data-nada="hijau" style={{ marginLeft: 6 }}>baru</span>}
                        </p>
                      </td>
                      <td>
                        <select
                          className="kol-isi kol-keadaan"
                          value={b.pernah ? "pernah" : "belum"}
                          onChange={(e) => {
                            const pernah = e.target.value === "pernah";
                            ubahBaris(b.kunci, (x) => ({ ...x, pernah, isian: pernah ? x.isian : { ...x.isian, mkgTahun: "0", mkgBulan: "0" } }));
                          }}
                          aria-label={`Keadaan KGB ${b.nama}`}
                        >
                          <option value="pernah">Sudah pernah</option>
                          <option value="belum">Belum pernah</option>
                        </select>
                      </td>
                      <td>
                        <select className="kol-isi" data-beda={beda("golonganRuang")} value={b.isian.golonganRuang ?? ""} onChange={(e) => isi(b.kunci, "golonganRuang", e.target.value)} aria-label={`Golongan ${b.nama}`}>
                          <option value="">-</option>
                          {Object.keys(GOLONGAN_PANGKAT).map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </td>
                      <td>
                        <span className="kol-mkg">
                          <input className="kol-isi" data-beda={beda("mkgTahun")} inputMode="numeric" value={b.isian.mkgTahun ?? ""} disabled={!b.pernah} onChange={(e) => isi(b.kunci, "mkgTahun", e.target.value.replace(/\D/g, ""))} aria-label={`Masa kerja tahun ${b.nama}`} />
                          <span>th</span>
                          <input className="kol-isi" data-beda={beda("mkgBulan")} inputMode="numeric" value={b.isian.mkgBulan ?? ""} disabled={!b.pernah} onChange={(e) => isi(b.kunci, "mkgBulan", e.target.value.replace(/\D/g, ""))} aria-label={`Masa kerja bulan ${b.nama}`} />
                          <span>bl</span>
                        </span>
                      </td>
                      <td>
                        <input className="kol-isi" type="date" data-beda={beda("tmtKgbTerakhir")} value={b.isian.tmtKgbTerakhir ?? ""} onChange={(e) => isi(b.kunci, "tmtKgbTerakhir", e.target.value)} aria-label={`${b.pernah ? "TMT KGB terakhir" : "TMT CPNS"} ${b.nama}`} />
                      </td>
                      <td>
                        <input className="kol-isi" data-beda={beda("nomorSkTerakhir")} placeholder={b.pernah ? "No. SK KGB" : "No. SK CPNS"} value={b.isian.nomorSkTerakhir ?? ""} onChange={(e) => isi(b.kunci, "nomorSkTerakhir", e.target.value)} aria-label={`Nomor SK dasar ${b.nama}`} />
                        <input className="kol-isi" type="date" data-beda={beda("tanggalSkTerakhir")} value={b.isian.tanggalSkTerakhir ?? ""} onChange={(e) => isi(b.kunci, "tanggalSkTerakhir", e.target.value)} aria-label={`Tanggal SK dasar ${b.nama}`} style={{ marginTop: 4 }} />
                      </td>
                      <td>
                        <div className="kol-berkas">
                          {berkasUntukKeadaan(b.pernah).map((jenis) => {
                            const ada = b.tersimpan.find((t) => t.medan === jenis.medan);
                            const dipilih = b.berkas[jenis.medan];
                            return (
                              <label key={jenis.medan} className="kol-berkas-butir" data-isi={dipilih || ada ? "" : undefined} title={dipilih?.name ?? ada?.nama ?? jenis.keterangan}>
                                <span>
                                  {jenis.label}
                                  {jenis.wajib && <span className="kol-wajib" aria-hidden="true" />}
                                </span>
                                <span className="kol-berkas-nama">{dipilih ? dipilih.name : ada ? (ada.nama ?? "tersimpan") : "pilih PDF"}</span>
                                <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => pilihBerkas(b.kunci, jenis.medan, e.target.files?.[0] ?? null)} />
                              </label>
                            );
                          })}
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        {hitung.gajiPokok > 0 ? `Rp${new Intl.NumberFormat("id-ID").format(hitung.gajiPokok)}` : <span className="dsb-kecil">-</span>}
                      </td>
                      <td className="kol-status">
                        {b.keadaan === "menyimpan" ? "Menyimpan…"
                          : b.keadaan === "tersimpan" ? <span style={{ color: "var(--st-green)" }}>Tersimpan</span>
                          : b.keadaan === "galat" ? <span style={{ color: "var(--st-red)" }}>{b.pesan}</span>
                          : berubah(b) ? <span style={{ color: "var(--st-amber)" }}>Berubah</span>
                          : <span className="dsb-kecil">Tetap</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="dsb-kaki">
            <span>Berkas PDF paling besar 1 MB per berkas. Laporan hukuman disiplin diisi lewat formulir perorangan.</span>
            <button type="button" className="dsb-tombol" onClick={() => void simpanSemua()} disabled={menyimpan || jumlahBerubah === 0}>
              {menyimpan ? "Menyimpan…" : `Simpan ${jumlahBerubah} draf`}
            </button>
          </div>
        </section>
      )}

      {/* ── 3. Ajukan dengan satu surat ──────────────────────────── */}
      {baris && drafSesiIni.length > 0 && (
        <section className="dsb-panel" aria-labelledby="judul-ajukan-kolektif">
          <div className="dsb-panel-kepala">
            <h2 id="judul-ajukan-kolektif" className="dsb-panel-judul">
              3. Ajukan dengan satu surat Srikandi <small>{pilihAjukan.size} dipilih</small>
            </h2>
          </div>
          <ul className="kol-pilih">
            {drafSesiIni.map((d) => (
              <li key={d.id}>
                <label data-mati={d.kekurangan.length > 0 ? "" : undefined}>
                  <input
                    type="checkbox"
                    className="dsb-cek"
                    checked={pilihAjukan.has(d.id)}
                    disabled={d.kekurangan.length > 0}
                    onChange={() => setPilihAjukan((lama) => { const n = new Set(lama); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })}
                  />
                  <span className="min-w-0">
                    <span className="dsb-nama">{d.nama}</span>
                    <span className="dsb-kecil" style={{ color: d.kekurangan.length > 0 ? "var(--st-red)" : undefined }}>
                      {d.kekurangan.length > 0 ? `Belum lengkap: ${d.kekurangan.join(", ")}` : "Siap diajukan"}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="kol-surat">
            <label className="kol-label">
              <span className="kol-wajib">Nomor surat</span>
              <input className="kol-isi" value={surat.nomorSurat} onChange={(e) => setSurat((s) => ({ ...s, nomorSurat: e.target.value }))} placeholder="W.19.PAS.7-KP.04.03-1" />
            </label>
            <label className="kol-label">
              <span className="kol-wajib">Tanggal surat</span>
              <input className="kol-isi" type="date" value={surat.tanggalSurat} onChange={(e) => setSurat((s) => ({ ...s, tanggalSurat: e.target.value }))} />
            </label>
            <label className="kol-label">
              Surat usulan Srikandi (PDF, paling besar 1 MB)
              <input className="kol-isi" type="file" accept="application/pdf" onChange={(e) => setBerkasSurat(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="dsb-kaki">
            <span>Yang belum lengkap tetap tersimpan sebagai draf dan dapat diajukan belakangan.</span>
            <button type="button" className="dsb-tombol" onClick={() => void ajukan()} disabled={mengajukan || pilihAjukan.size === 0}>
              {mengajukan ? "Mengirim…" : `Ajukan ${pilihAjukan.size} pegawai`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
