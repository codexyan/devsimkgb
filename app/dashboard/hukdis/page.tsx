"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { canManageHukdis } from "@/lib/auth";
import { formatTanggalId, hariIniWita, isoTanggalLokal, tanggalKalender } from "@/lib/waktu";
import { useDialogModal } from "@/app/dashboard/components/useDialogModal";
import { tmtBerakhirOtomatis } from "@/lib/hukdisJenis";
import { SATKER } from "@/lib/satker";
import { KODE_SATKER_LAIN, kodeSatkerPegawai } from "@/lib/rekapSatker";
import { namaSingkatSatker } from "@/app/dashboard/satker/labelSatker";

/* ─────────────────────────────────────────────────────────────────────────
   Modul Hukuman Disiplin (mandiri). Daftar SEMUA catatan hukdis lintas
   pegawai + ringkasan + input. Sumber: RiwayatHukdis (via /api/hukdis).
   Yang dipantau: masa berlaku (kapan berakhir) dan dampaknya pada KGB.
   ───────────────────────────────────────────────────────────────────────── */

interface Hukdis {
  id: string;
  pegawai: { id: string; nama: string; nip: string; jabatan: string; golonganRuang: string; unitKerja: string | null; aktif: boolean } | null;
  jenisHukdis: string; jenisLabel: string; kategori: string;
  nomorSK: string; tanggalSK: string | null; tmtMulai: string | null; tmtBerakhir: string | null;
  berdampakKGB: boolean; durasiTunda: number | null; dasarHukum: string | null; keterangan: string | null;
  aktif: boolean;
}
interface Summary { total: number; aktif: number; ringan: number; sedang: number; berat: number; berdampakKGB: number; berakhir30: number; }
interface Jenis { kode: string; label: string; kategori: string; durasiHukdis: number; berdampakKGB: boolean; durasiTunda: number | null; dasarHukum: string | null; aktif: boolean; }
interface PegawaiOpt { id: string; nip: string; nama: string; jabatan: string; golonganRuang: string; statusHukdis: boolean; }
interface RegulasiOpt { id: string; nomor: string; tahun: string; tentang: string; status: string; }
const regText = (r: RegulasiOpt) => `${r.nomor} Tahun ${r.tahun}`;

const KAT: Record<string, { label: string; nada: "hijau" | "kuning" | "merah" }> = {
  ringan: { label: "Ringan", nada: "hijau" },
  sedang: { label: "Sedang", nada: "kuning" },
  berat:  { label: "Berat",  nada: "merah" },
};
const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
// Tanggal tersimpan ditampilkan menurut kalender WITA.
const fmt = (s: string | null) => (s ? formatTanggalId(s, { day: "numeric", month: "short", year: "numeric" }) : "-");
// Tanggal hari ini menurut kalender perangkat (bukan UTC, yang mundur sehari sebelum pukul 08.00 WITA).
const todayIso = () => isoTanggalLokal();

/** Saringan utama: masa berlaku dan dampak KGB. */
type Saringan = "aktif" | "segera" | "tunda" | "berakhir" | "";
const SARINGAN: { v: Saringan; l: string; nada?: "merah" }[] = [
  { v: "aktif", l: "Aktif" },
  { v: "segera", l: "Berakhir ≤ 30 hari" },
  { v: "tunda", l: "Menunda KGB", nada: "merah" },
  { v: "berakhir", l: "Sudah berakhir" },
  { v: "", l: "Semua" },
];

function namaSatker(kode: string): string {
  if (kode === KODE_SATKER_LAIN) return "Unit belum sesuai daftar";
  const s = SATKER.find((x) => x.kode === kode);
  return s ? namaSingkatSatker(s) : kode;
}

export default function HukdisPage() {
  const role = useRole();
  const allowed = canManageHukdis(role);
  const [hariIni] = useState(() => hariIniWita());
  // Tautan dari dashboard membawa saringan awal: ?satker=<kode> dan ?saringan=segera|tunda|berakhir.
  const params = useSearchParams();

  const [data, setData] = useState<Hukdis[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterKat, setFilterKat] = useState("");
  const [filterSatker, setFilterSatker] = useState(() => params.get("satker") ?? "");
  const [saringan, setSaringan] = useState<Saringan>(() => {
    const awal = params.get("saringan");
    return SARINGAN.some((s) => s.v === awal && awal !== "") ? (awal as Saringan) : "aktif";
  });

  // Input modal
  const [showInput, setShowInput] = useState(false);
  const [jenisList, setJenisList] = useState<Jenis[]>([]);
  const [regulasiList, setRegulasiList] = useState<RegulasiOpt[]>([]);
  const [dasarManual, setDasarManual] = useState(false);
  const [pegawai, setPegawai] = useState<PegawaiOpt[]>([]);
  const [pegSearch, setPegSearch] = useState("");
  const [selPeg, setSelPeg] = useState<PegawaiOpt | null>(null);
  const [form, setForm] = useState({
    jenisHukdis: "", nomorSK: "", tanggalSK: todayIso(), tmtMulai: todayIso(), tmtBerakhir: "",
    berdampakKGB: false, durasiTunda: 12, dasarHukum: "", keterangan: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Delete modal
  const [delTarget, setDelTarget] = useState<Hukdis | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState("");

  const refModalInput = useDialogModal(showInput, () => setShowInput(false), submitting);
  const refModalHapus = useDialogModal(!!delTarget, () => setDelTarget(null), deleting);

  function fetchData() {
    setLoading(true);
    fetch("/api/hukdis").then((r) => r.json() as Promise<{ data?: Hukdis[]; summary?: Summary }>).then((d) => {
      if (d && Array.isArray(d.data)) { setData(d.data); setSummary(d.summary ?? null); }
    }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { if (allowed) fetchData(); else setLoading(false); }, [allowed]);

  function openInput() {
    setShowInput(true); setError(""); setSelPeg(null); setPegSearch(""); setDasarManual(false);
    setForm({ jenisHukdis: "", nomorSK: "", tanggalSK: todayIso(), tmtMulai: todayIso(), tmtBerakhir: "", berdampakKGB: false, durasiTunda: 12, dasarHukum: "", keterangan: "" });
    // Muat jenis + pegawai + regulasi sekali saat modal dibuka
    Promise.all([
      fetch("/api/hukdis/konfigurasi").then((r) => r.json() as any).catch(() => null),
      fetch("/api/pegawai?search=&status=").then((r) => r.json() as any).catch(() => []),
      fetch("/api/hukdis/regulasi").then((r) => r.json() as any).catch(() => []),
    ]).then(([cfg, peg, reg]) => {
      if (cfg?.jenis) setJenisList(cfg.jenis.filter((j: Jenis) => j.aktif));
      if (Array.isArray(peg)) setPegawai(peg);
      // Hanya regulasi yang masih relevan untuk input baru
      if (Array.isArray(reg)) setRegulasiList(reg.filter((r: RegulasiOpt) => r.status === "berlaku" || r.status === "dicabut_sebagian"));
    });
  }

  // Saat jenis dipilih: isi DEFAULT (bukan mengunci) dari config jenis — dasar
  // hukum, dampak KGB, durasi tunda, tmtBerakhir. PIC bebas mengubah semuanya.
  function pickJenis(kode: string) {
    const j = jenisList.find((x) => x.kode === kode);
    setForm((f) => ({
      ...f, jenisHukdis: kode,
      berdampakKGB: j?.berdampakKGB ?? false,
      durasiTunda: j?.durasiTunda ?? 12,
      dasarHukum: j?.dasarHukum ?? f.dasarHukum,
      tmtBerakhir: j && j.durasiHukdis > 0 && f.tmtMulai ? tmtBerakhirOtomatis(f.tmtMulai, j.durasiHukdis) : f.tmtBerakhir,
    }));
  }
  function setTmtMulai(v: string) {
    const j = jenisList.find((x) => x.kode === form.jenisHukdis);
    setForm((f) => ({ ...f, tmtMulai: v, tmtBerakhir: j && j.durasiHukdis > 0 && v ? tmtBerakhirOtomatis(v, j.durasiHukdis) : f.tmtBerakhir }));
  }

  const filteredPeg = useMemo(() => {
    const q = pegSearch.trim().toLowerCase();
    const list = q ? pegawai.filter((p) => p.nama.toLowerCase().includes(q) || p.nip.includes(q)) : pegawai;
    return list.slice(0, 50);
  }, [pegawai, pegSearch]);

  async function handleSubmit() {
    setError("");
    if (!selPeg) { setError("Pilih pegawai terlebih dahulu"); return; }
    if (!form.jenisHukdis) { setError("Pilih jenis hukuman disiplin"); return; }
    if (!form.nomorSK.trim()) { setError("Nomor SK wajib diisi"); return; }
    if (!form.tanggalSK || !form.tmtMulai || !form.tmtBerakhir) { setError("Tanggal SK, TMT mulai, dan TMT berakhir wajib diisi"); return; }
    if (new Date(form.tmtBerakhir) < new Date(form.tmtMulai)) { setError("TMT berakhir tidak boleh sebelum TMT mulai"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pegawai/${selPeg.id}/hukdis`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await res.json() as any;
      if (!res.ok) { setError(d.error || "Gagal menyimpan hukdis"); return; }
      setShowInput(false);
      setSuccess(`Hukdis untuk ${selPeg.nama} tersimpan.`);
      setTimeout(() => setSuccess(""), 4000);
      fetchData();
    } catch { setError("Gagal menghubungi server"); }
    finally { setSubmitting(false); }
  }

  async function handleDelete() {
    if (!delTarget) return;
    setDeleting(true);
    setDelError("");
    try {
      const res = await fetch(`/api/hukdis/${delTarget.id}`, { method: "DELETE" });
      const d = (await res.json().catch(() => ({}))) as { error?: string; pesan?: string };
      if (!res.ok) { setDelError(d.error || "Catatan hukdis gagal dihapus."); return; }
      // Pesan API menyebut apakah TMT KGB dipulihkan atau perlu diperiksa, jadi ditampilkan lebih lama.
      setDelTarget(null);
      setSuccess(d.pesan || "Catatan hukdis dihapus.");
      setTimeout(() => setSuccess(""), 8000);
      fetchData();
    } catch { setDelError("Gagal menghubungi server"); }
    finally { setDeleting(false); }
  }

  /** Sisa hari sampai TMT berakhir (tanggal berakhir ikut dihitung); null bila tanggal tidak terbaca. */
  const sisaHari = (h: Hukdis) => {
    const akhir = tanggalKalender(h.tmtBerakhir);
    return akhir ? Math.round((akhir.getTime() - hariIni.getTime()) / 86_400_000) : null;
  };
  const cocokSaringan = (h: Hukdis, s: Saringan) => {
    if (s === "aktif") return h.aktif;
    if (s === "berakhir") return !h.aktif;
    if (s === "tunda") return h.aktif && h.berdampakKGB;
    if (s === "segera") { const sisa = sisaHari(h); return h.aktif && sisa !== null && sisa <= 30; }
    return true;
  };

  // Saringan kategori, satker, dan pencarian berlaku dulu; jumlah pada tiap segmen dihitung dari hasilnya.
  const dasar = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((h) =>
      (filterKat === "" || h.kategori === filterKat) &&
      (filterSatker === "" || kodeSatkerPegawai(h.pegawai?.unitKerja) === filterSatker) &&
      (!q || (h.pegawai?.nama ?? "").toLowerCase().includes(q) || (h.pegawai?.nip ?? "").includes(q) ||
        h.jenisLabel.toLowerCase().includes(q) || (h.nomorSK ?? "").toLowerCase().includes(q)),
    );
  }, [data, search, filterKat, filterSatker]);

  const filtered = useMemo(() => {
    const hasil = dasar.filter((h) => cocokSaringan(h, saringan));
    // Hukdis yang masih berjalan diurutkan dari yang paling dekat berakhir; riwayat tetap terbaru dulu.
    if (saringan === "aktif" || saringan === "segera" || saringan === "tunda") {
      hasil.sort((a, b) => (sisaHari(a) ?? Infinity) - (sisaHari(b) ?? Infinity));
    }
    return hasil;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dasar, saringan, hariIni]);

  if (!allowed) {
    return (
      <div className="dsb-kosong" style={{ padding: "96px 16px" }}>
        <p className="dsb-nama" style={{ margin: 0 }}>Akses ditolak</p>
        <p style={{ margin: 0 }}>Halaman ini hanya untuk SDM Hukdis dan Super Admin.</p>
      </div>
    );
  }

  const berakhirTotal = (summary?.total ?? 0) - (summary?.aktif ?? 0);
  const adaSaringanLain = !!(filterKat || filterSatker || search);

  return (
    <div className="dsb-halaman" data-muat-layar="">
      {/* Kepala halaman */}
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Hukuman disiplin</p>
          <h1 className="dsb-halaman-judul">Catatan hukuman disiplin</h1>
          <p className="dsb-sub">Masa berlaku hukdis seluruh pegawai dan dampaknya pada KGB</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/hukdis/regulasi" className="dsb-tombol" data-jenis="garis">
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
            Regulasi
          </Link>
          <Link href="/dashboard/hukdis/konfigurasi" className="dsb-tombol" data-jenis="garis">
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            Jenis hukdis
          </Link>
          <button type="button" onClick={openInput} className="dsb-tombol">
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Input hukdis
          </button>
        </div>
      </header>

      {success && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </span>
          <p>{success}</p>
        </div>
      )}

      {/* Ringkasan */}
      {loading && !summary ? (
        <div className="dsb-kerangka" style={{ height: 104 }} role="status" aria-label="Memuat ringkasan" />
      ) : (
        <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="dsb-angka">
            <span className="dsb-angka-label">Hukdis aktif</span>
            <span className="dsb-angka-nilai">{summary?.aktif ?? 0}</span>
            <span className="dsb-angka-meta" style={{ flexWrap: "wrap" }}>
              {(["ringan", "sedang", "berat"] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-1.5">
                  <span className="dsb-titik" data-nada={KAT[k].nada} aria-hidden="true" />
                  {KAT[k].label} {summary?.[k] ?? 0}
                </span>
              ))}
            </span>
          </div>
          <div className="dsb-angka">
            <span className="dsb-angka-label">Menunda KGB</span>
            <span className="dsb-angka-nilai" style={{ color: (summary?.berdampakKGB ?? 0) > 0 ? "var(--st-red)" : undefined }}>{summary?.berdampakKGB ?? 0}</span>
            <span className="dsb-angka-meta">{(summary?.berdampakKGB ?? 0) > 0 ? "TMT KGB pegawainya digeser" : "Tidak ada KGB yang tertunda"}</span>
          </div>
          <div className="dsb-angka">
            <span className="dsb-angka-label">Berakhir ≤ 30 hari</span>
            <span className="dsb-angka-nilai">{summary?.berakhir30 ?? 0}</span>
            <span className="dsb-angka-meta">
              {(summary?.berakhir30 ?? 0) > 0 && <span className="dsb-titik" data-nada="kuning" aria-hidden="true" />}
              {(summary?.berakhir30 ?? 0) > 0 ? "Periksa KGB setelah berakhir" : "Tidak ada dalam 30 hari"}
            </span>
          </div>
          <div className="dsb-angka">
            <span className="dsb-angka-label">Sudah berakhir</span>
            <span className="dsb-angka-nilai">{berakhirTotal}</span>
            <span className="dsb-angka-meta">dari {summary?.total ?? 0} catatan</span>
          </div>
        </div>
      )}

      {/* Daftar */}
      <section className="dsb-panel dsb-penuh overflow-hidden dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-label="Daftar catatan hukdis">
        <div className="flex flex-col gap-3" style={{ padding: "14px 16px", borderBottom: "1px solid var(--ln2)" }}>
          <div className="dsb-segmen" role="group" aria-label="Saring masa berlaku" style={{ alignSelf: "flex-start" }}>
            {SARINGAN.map((s) => (
              <button key={s.l} type="button" data-nada={s.nada} aria-pressed={saringan === s.v} onClick={() => setSaringan(s.v)}>
                {s.l} {!loading && <span style={{ color: "var(--dt5)" }}>{dasar.filter((h) => cocokSaringan(h, s.v)).length}</span>}
              </button>
            ))}
          </div>
          <div className="dsb-alat">
            <input
              type="search"
              className="dsb-cari"
              aria-label="Cari catatan hukdis"
              placeholder="Cari nama, NIP, jenis, atau nomor SK"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select aria-label="Saring kategori" className="dsb-pilih" data-aktif={filterKat ? "" : undefined} value={filterKat} onChange={(e) => setFilterKat(e.target.value)}>
              <option value="">Semua kategori</option>
              {Object.entries(KAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select aria-label="Saring satker" className="dsb-pilih" data-aktif={filterSatker ? "" : undefined} value={filterSatker} onChange={(e) => setFilterSatker(e.target.value)}>
              <option value="">Semua satker</option>
              {SATKER.map((s) => <option key={s.kode} value={s.kode}>{namaSingkatSatker(s)}</option>)}
              <option value={KODE_SATKER_LAIN}>Unit belum sesuai daftar</option>
            </select>
            {adaSaringanLain && (
              <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => { setFilterKat(""); setFilterSatker(""); setSearch(""); }}>
                Atur ulang
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2" style={{ padding: "16px" }} role="status" aria-label="Memuat data hukdis">
            {[0, 1, 2].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 44 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="dsb-kosong" style={{ padding: "48px 16px" }}>
            <p style={{ margin: 0 }}>
              {data.length === 0
                ? "Belum ada catatan hukuman disiplin."
                : saringan === "aktif" && !adaSaringanLain
                  ? "Tidak ada hukdis yang sedang berjalan."
                  : "Tidak ada catatan yang cocok dengan saringan."}
            </p>
            {data.length === 0 && (
              <button type="button" onClick={openInput} className="dsb-tombol dsb-tombol-kecil">Input hukdis pertama</button>
            )}
          </div>
        ) : (
          <div className="dsb-gulir-tabel tbl-scroll">
            <table className="dsb-tabel" style={{ minWidth: "900px" }}>
              <thead>
                <tr>
                  <th scope="col">Pegawai</th>
                  <th scope="col">Jenis hukdis</th>
                  <th scope="col">Nomor SK</th>
                  <th scope="col">Masa berlaku</th>
                  <th scope="col">Dampak KGB</th>
                  <th scope="col"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => {
                  const kat = KAT[h.kategori];
                  const sisa = sisaHari(h);
                  const kodeSatker = kodeSatkerPegawai(h.pegawai?.unitKerja);
                  const segera = h.aktif && sisa !== null && sisa <= 30;
                  return (
                    <tr key={h.id}>
                      <td style={{ maxWidth: "280px" }}>
                        <div className="flex items-center gap-2.5">
                          <span className="dsb-avatar" data-nada={h.aktif ? "merah" : undefined} aria-hidden="true">{initials(h.pegawai?.nama ?? "?")}</span>
                          <div className="min-w-0">
                            <p className="dsb-nama truncate" style={{ margin: 0 }} title={h.pegawai?.jabatan}>{h.pegawai?.nama ?? "Pegawai tidak ditemukan"}</p>
                            <p className="dsb-kecil truncate" style={{ margin: 0 }} title={h.pegawai?.unitKerja ?? undefined}>
                              {h.pegawai ? <>{h.pegawai.nip} · {namaSatker(kodeSatker)}</> : "-"}
                              {h.pegawai && !h.pegawai.aktif && " · nonaktif"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: "260px" }}>
                        <p className="truncate" style={{ margin: 0, color: "var(--dtn)" }} title={h.jenisLabel}>{h.jenisLabel}</p>
                        <p className="dsb-kecil flex items-center gap-1.5 min-w-0" style={{ margin: 0 }}>
                          {kat && <><span className="dsb-titik" data-nada={kat.nada} aria-hidden="true" />{kat.label}</>}
                          {h.dasarHukum && <span className="truncate" title={h.dasarHukum}>· {h.dasarHukum}</span>}
                        </p>
                      </td>
                      <td className="whitespace-nowrap">
                        <p style={{ margin: 0 }}>{h.nomorSK || "-"}</p>
                        {h.tanggalSK && <p className="dsb-kecil" style={{ margin: 0 }}>{fmt(h.tanggalSK)}</p>}
                      </td>
                      <td className="whitespace-nowrap">
                        <p style={{ margin: 0 }}>{fmt(h.tmtMulai)} – {fmt(h.tmtBerakhir)}</p>
                        <p className="dsb-status" style={{ margin: 0, fontSize: "12px", color: segera ? "var(--st-amber)" : "var(--dt4)" }}>
                          <span className="dsb-titik" data-nada={h.aktif ? (segera ? "kuning" : "merah") : undefined} aria-hidden="true" />
                          {!h.aktif ? "Sudah berakhir" : sisa === null ? "Aktif" : sisa === 0 ? "Aktif · berakhir hari ini" : `Aktif · ${sisa} hari lagi`}
                        </p>
                      </td>
                      <td className="whitespace-nowrap">
                        {h.berdampakKGB
                          ? <span style={{ color: h.aktif ? "var(--st-red)" : "var(--dt3)" }}>Tunda {h.durasiTunda ?? "-"} bulan</span>
                          : <span className="dsb-kecil">Tidak menunda</span>}
                      </td>
                      <td className="kanan">
                        <span className="dsb-aksi">
                          {h.pegawai && (
                            <Link href={`/dashboard/pegawai/${h.pegawai.id}/riwayat`} className="dsb-ikon-tombol" title="Lihat riwayat pegawai" aria-label={`Lihat riwayat ${h.pegawai.nama}`}>
                              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </Link>
                          )}
                          <button type="button" onClick={() => { setDelError(""); setDelTarget(h); }} className="dsb-ikon-tombol" data-nada="merah" title="Hapus catatan hukdis" aria-label={`Hapus catatan hukdis ${h.pegawai?.nama ?? ""}`}>
                            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="dsb-kaki">
            <span>{filtered.length} catatan ditampilkan</span>
            <span>Tanggal berakhir ikut dihitung sebagai masa hukdis</span>
          </div>
        )}
      </section>

      {/* Modal Input Hukdis */}
      {showInput && (
        <div className="adm-overlay" onClick={() => !submitting && setShowInput(false)}>
          <div ref={refModalInput} role="dialog" aria-modal="true" aria-labelledby="judul-input-hukdis" tabIndex={-1} className="adm-modal outline-none" style={{ maxWidth: "30rem", maxHeight: "92dvh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-4 shrink-0" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "var(--navy-solid)" }}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div className="flex-1"><h2 id="judul-input-hukdis" className="text-sm font-semibold leading-tight" style={{ color: "var(--dtn)" }}>Input Hukuman Disiplin</h2><p className="text-xs" style={{ color: "var(--dt4)" }}>Pilih pegawai lalu isi detail SK hukdis</p></div>
              <button onClick={() => setShowInput(false)} disabled={submitting} aria-label="Tutup" className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--ln2)", color: "var(--dt3)" }}><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>

            <div className="p-5 space-y-3.5 overflow-y-auto">
              {/* Pilih pegawai */}
              {!selPeg ? (
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Pegawai</label>
                  <input autoFocus value={pegSearch} onChange={(e) => setPegSearch(e.target.value)} placeholder="Cari nama atau NIP…" className="adm-input mb-2" />
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)", maxHeight: "200px", overflowY: "auto" }}>
                    {filteredPeg.length === 0 ? <p className="text-xs text-center py-6" style={{ color: "var(--dt5)" }}>{pegawai.length === 0 ? "Memuat / belum ada pegawai" : "Tidak ada yang cocok"}</p>
                     : filteredPeg.map((p, i) => (
                        <button key={p.id} onClick={() => setSelPeg(p)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left" style={{ borderBottom: i < filteredPeg.length - 1 ? "0.5px solid var(--ln2)" : "none", cursor: "pointer" }}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{initials(p.nama)}</div>
                          <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate" style={{ color: "var(--dtn)" }}>{p.nama}</p><p className="text-xs truncate" style={{ color: "var(--dt4)" }}>{p.nip} · {p.jabatan}</p></div>
                          {p.statusHukdis && <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", fontSize: "9px" }}>hukdis aktif</span>}
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{initials(selPeg.nama)}</div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-semibold truncate" style={{ color: "var(--dtn)" }}>{selPeg.nama}</p><p className="text-xs" style={{ color: "var(--dt4)" }}>{selPeg.nip} · Gol. {selPeg.golonganRuang}</p></div>
                    <button onClick={() => setSelPeg(null)} className="text-xs px-2 py-1 rounded-lg shrink-0" style={{ color: "var(--dt4)", border: "0.5px solid var(--ln1)" }}>Ganti</button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Jenis Hukuman Disiplin</label>
                    <select value={form.jenisHukdis} onChange={(e) => pickJenis(e.target.value)} className="adm-input">
                      <option value="">Pilih jenis…</option>
                      {["ringan", "sedang", "berat"].map((kat) => {
                        const grp = jenisList.filter((j) => j.kategori === kat);
                        if (grp.length === 0) return null;
                        return <optgroup key={kat} label={KAT[kat]?.label ?? kat}>{grp.map((j) => <option key={j.kode} value={j.kode}>{j.label}{j.berdampakKGB ? " · menunda KGB" : ""}</option>)}</optgroup>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Nomor SK</label>
                    <input value={form.nomorSK} onChange={(e) => setForm((f) => ({ ...f, nomorSK: e.target.value }))} placeholder="Nomor SK hukuman disiplin" className="adm-input" />
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Tanggal SK</label><input type="date" value={form.tanggalSK} onChange={(e) => setForm((f) => ({ ...f, tanggalSK: e.target.value }))} className="adm-input" style={{ fontSize: "12px" }} /></div>
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>TMT Mulai</label><input type="date" value={form.tmtMulai} onChange={(e) => setTmtMulai(e.target.value)} className="adm-input" style={{ fontSize: "12px" }} /></div>
                    <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>TMT Berakhir</label><input type="date" value={form.tmtBerakhir} onChange={(e) => setForm((f) => ({ ...f, tmtBerakhir: e.target.value }))} className="adm-input" style={{ fontSize: "12px" }} /></div>
                  </div>

                  {/* Dasar hukum: pilih dari master Regulasi (berlaku/sebagian) atau ketik manual */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-medium" style={{ color: "var(--dt2)" }}>Dasar Hukum / Peraturan</label>
                      <Link href="/dashboard/hukdis/regulasi" className="text-xs" style={{ color: "var(--accent)", fontSize: "10px" }}>Kelola regulasi <span aria-hidden="true">→</span></Link>
                    </div>
                    {!dasarManual && regulasiList.length > 0 ? (
                      <select
                        value={regulasiList.some((r) => regText(r) === form.dasarHukum) ? form.dasarHukum : ""}
                        onChange={(e) => { if (e.target.value === "__manual__") { setDasarManual(true); setForm((f) => ({ ...f, dasarHukum: "" })); } else setForm((f) => ({ ...f, dasarHukum: e.target.value })); }}
                        className="adm-input">
                        <option value="">Pilih regulasi…</option>
                        {regulasiList.map((r) => (
                          <option key={r.id} value={regText(r)}>{regText(r)} — {r.tentang}{r.status === "dicabut_sebagian" ? " (dicabut sebagian)" : ""}</option>
                        ))}
                        <option value="__manual__">— ketik manual —</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input value={form.dasarHukum} onChange={(e) => setForm((f) => ({ ...f, dasarHukum: e.target.value }))} placeholder="mis. PP Nomor 94 Tahun 2021" className="adm-input" />
                        {regulasiList.length > 0 && <button type="button" onClick={() => { setDasarManual(false); setForm((f) => ({ ...f, dasarHukum: "" })); }} className="text-xs px-3 rounded-xl shrink-0" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Daftar</button>}
                      </div>
                    )}
                    <p className="text-xs mt-1" style={{ color: "var(--dt5)", fontSize: "10px" }}>
                      {regulasiList.length === 0 ? "Belum ada regulasi terdaftar — ketik manual, atau daftarkan lewat Kelola regulasi." : "Dikunci pada catatan ini; peraturan baru tidak mengubahnya."}
                    </p>
                  </div>

                  {/* Dampak KGB — ditetapkan PIC */}
                  <div className="rounded-xl p-3" style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Berdampak pada KGB?</p>
                        <p className="text-xs" style={{ color: "var(--dt5)", fontSize: "10px" }}>Jika ya, TMT KGB pegawai digeser sesuai durasi penundaan.</p>
                      </div>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, berdampakKGB: !f.berdampakKGB }))}
                        style={{ width: "40px", height: "22px", borderRadius: "9999px", background: form.berdampakKGB ? "var(--st-amber)" : "var(--ln1)", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background .15s" }}>
                        <span style={{ position: "absolute", top: "2px", left: form.berdampakKGB ? "20px" : "2px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .15s", display: "block" }} />
                      </button>
                    </div>
                    {form.berdampakKGB && (
                      <div className="mt-3">
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Penundaan KGB (bulan)</label>
                        <div className="relative" style={{ maxWidth: "140px" }}>
                          <input type="number" inputMode="numeric" min={1} value={String(form.durasiTunda)}
                            onChange={(e) => setForm((f) => ({ ...f, durasiTunda: Math.max(1, parseInt(e.target.value.replace(/\D/g, "")) || 0) }))}
                            className="adm-input" style={{ paddingRight: "48px" }} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "var(--dt5)" }}>bulan</span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: "var(--st-amber2)", fontSize: "10px" }}>TMT KGB berikutnya akan digeser +{form.durasiTunda || 0} bulan. Nilai ini ditetapkan Anda, bukan otomatis.</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--dt2)" }}>Keterangan <span style={{ color: "var(--dt5)" }}>(opsional)</span></label>
                    <textarea rows={2} value={form.keterangan} onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))} placeholder="Catatan tambahan…" className="adm-input resize-none" />
                  </div>

                  {/* Catatan patokan */}
                  <div className="rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: "var(--tint-blue-bg)", border: "1px solid var(--tint-blue-ln)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--st-blue)" strokeWidth="2" style={{ marginTop: "1px", flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                    <p className="text-xs" style={{ color: "var(--st-blue)", fontSize: "10.5px", lineHeight: 1.5 }}>
                      Patokan: <strong>tanggal SK Hukdis</strong>. Semua nilai di atas dikunci pada catatan ini saat disimpan — perubahan regulasi/konfigurasi berikutnya tidak berlaku surut ke catatan ini.
                    </p>
                  </div>
                </>
              )}
              {error && <div className="rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="var(--st-red)"><path d="M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"/></svg><p className="text-xs" style={{ color: "var(--st-red)" }}>{error}</p></div>}
            </div>

            <div className="flex gap-2 px-5 py-4 shrink-0" style={{ borderTop: "0.5px solid var(--ln2)" }}>
              <button onClick={() => setShowInput(false)} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Batal</button>
              <button onClick={handleSubmit} disabled={submitting || !selPeg} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: "var(--navy-solid)" }}>{submitting ? "Menyimpan…" : "Simpan Hukdis"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus */}
      {delTarget && (
        <div className="adm-overlay" onClick={() => !deleting && setDelTarget(null)}>
          <div ref={refModalHapus} role="alertdialog" aria-modal="true" aria-labelledby="judul-hapus-hukdis" tabIndex={-1} className="adm-modal outline-none" style={{ maxWidth: "24rem" }} onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--tint-red-bg)" }}><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--st-red)" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></div>
              <h2 id="judul-hapus-hukdis" className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>Hapus Catatan Hukdis?</h2>
              <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--dt4)" }}>Hapus hukdis <strong style={{ color: "var(--dtn)" }}>{delTarget.jenisLabel}</strong> milik <strong style={{ color: "var(--dtn)" }}>{delTarget.pegawai?.nama ?? "pegawai ini"}</strong>? Tindakan ini tidak bisa dibatalkan.</p>
              {delError && <p role="alert" className="text-xs rounded-lg px-3 py-2 mb-3" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>{delError}</p>}
              <div className="flex gap-2">
                <button onClick={() => setDelTarget(null)} disabled={deleting} className="flex-1 text-xs py-2.5 rounded-xl" style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}>Batal</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50" style={{ background: "var(--red-solid)" }}>{deleting ? "Menghapus…" : "Ya, Hapus"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
