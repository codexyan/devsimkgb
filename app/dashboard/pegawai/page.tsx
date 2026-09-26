"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  GOLONGAN_PANGKAT,
  bulanKeKgbBerikutnya,
  getMKGOptions,
  getGajiPokok,
  getPangkat,
  hitungMKGKenaikanPangkat,
  jendelaProsesKgb,
  tambahBulan,
} from "@/lib/tabelGaji";
import { ROLES } from "@/lib/auth";
import { ESELON, JENIS_JABATAN, JENIS_KELAMIN, PENDIDIKAN_TERAKHIR, denganNilaiSaatIni } from "@/lib/pilihanPegawai";
import { SATKER, SATKER_KANWIL, cariSatker } from "@/lib/satker";
import ModalKenaikanPangkat from "@/app/dashboard/components/ModalKenaikanPangkat";
import ModalMutasiPegawai from "@/app/dashboard/components/ModalMutasiPegawai";
import { ringkasKeadaanPegawai } from "@/lib/mutasiPegawai";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, hariIniWita, isoTanggalLokal, tanggalKalender } from "@/lib/waktu";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { useDialogModal } from "@/app/dashboard/components/useDialogModal";

interface Pegawai {
  id: string;
  nip: string;
  nama: string;
  jabatan: string;
  pangkat: string;
  golonganRuang: string;
  unitKerja: string;
  gajiPokok: number;
  mkgTahun: number;
  mkgBulan: number;
  tmtKgbBerikutnya: string;
  statusHukdis: boolean;
  tanggalHukdisBerakhir?: string | null;
  jenisHukdis?: string | null;
  aktif: boolean;
  statusKGB?: string | null;
  /** Keadaan mutasi yang berlaku (lib/mutasiPegawai.ts); kosong berarti pegawai biasa di satkernya. */
  satkerTugas?: string | null;
  berhentiTmt?: string | null;
  berhentiAlasan?: string | null;
}

/* Data lengkap dari GET /api/pegawai/[id] untuk mengisi form */
interface PegawaiDetail {
  nama?: string | null; nip?: string | null; tempatLahir?: string | null; tanggalLahir?: string | null;
  jenisKelamin?: string | null; pendidikanTerakhir?: string | null; jabatan?: string | null;
  pangkat?: string | null; golonganRuang?: string | null; unitKerja?: string | null; eselon?: string | null;
  jenisJabatan?: string | null; tmtGolongan?: string | null; mkgTahun?: number | null; mkgBulan?: number | null;
  gajiPokok?: number | null; tmtKgbTerakhir?: string | null; tmtKgbBerikutnya?: string | null;
  statusHukdis?: boolean | null; keteranganHukdis?: string | null; tanggalHukdisBerakhir?: string | null;
  jenisHukdis?: string | null; aktif?: boolean | null;
}

const FORMAT_TANGGAL_PENDEK: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/* Nilai input date dari tanggal tersimpan, dibaca sebagai tanggal kalender WITA. */
function keIsianTanggal(val: string | null | undefined): string {
  const tanggal = tanggalKalender(val);
  return tanggal ? isoTanggalLokal(tanggal) : "";
}

/* Label unit kerja untuk daftar; nama satker ditulis lengkap. Unit kerja kosong berarti Kanwil, sama dengan SK KGB. */
function labelUnitKerja(unitKerja: string | null | undefined): { teks: string; dikenal: boolean } {
  const satker = unitKerja?.trim() ? cariSatker(unitKerja) : SATKER_KANWIL;
  if (!satker) return { teks: unitKerja?.trim() || "-", dikenal: false };
  return { teks: satker.nama, dikenal: true };
}

const inputClass =
  "w-full rounded-lg px-3 py-2 text-xs outline-none transition";
const inputStyle = {
  border: "1px solid var(--ln0)",
  background: "var(--sub)",
  color: "var(--dtn)",
};
const dateInputStyle = {
  border: "1px solid var(--ln0)",
  background: "var(--sub)",
  color: "var(--dtn)",
  fontSize: "16px",
};
const readonlyStyle = {
  border: "1px solid var(--ln1)",
  background: "var(--ln2)",
  color: "var(--dt4)",
};
const labelClass = "block text-xs font-medium mb-1";

const formInit = {
  nama: "",
  nip: "",
  tempatLahir: "",
  tanggalLahir: "",
  jenisKelamin: "",
  pendidikanTerakhir: "",
  jabatan: "",
  pangkat: "",
  golonganRuang: "",
  unitKerja: SATKER_KANWIL.nama,
  eselon: "",
  jenisJabatan: "",
  tmtGolongan: "",
  mkgTahun: "",
  mkgBulan: "",
  gajiPokok: "",
  tmtKgbTerakhir: "",
  tmtKgbBerikutnya: "",
  statusHukdis: false,
  keteranganHukdis: "",
  tanggalHukdisBerakhir: "",
  jenisHukdis: "",
  aktif: true,
};



function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass} style={{ color: "var(--dt2)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * TMT KGB berikutnya menurut langkah tabel gaji PP 5/2024; kosong bila TMT KGB terakhir belum diisi.
 * Selangnya tidak selalu dua tahun: golongan II/a dari masa kerja 0 naik setelah 12 bulan.
 */
function tmtBerikutnyaOtomatis(golongan: string, mkgTahun: number, mkgBulan: number, tmtTerakhir: string): string {
  const bagian = /^(d{4})-(d{2})-(d{2})$/.exec(tmtTerakhir);
  if (!golongan || !bagian) return "";
  const awal = new Date(Number(bagian[1]), Number(bagian[2]) - 1, Number(bagian[3]));
  return isoTanggalLokal(tambahBulan(awal, bulanKeKgbBerikutnya(golongan, mkgTahun, mkgBulan)));
}

export default function PegawaiPage() {
  const role = useRole();
  const canEdit      = role !== ROLES.SDM_HUKDIS && role !== ROLES.KEUANGAN;
  const isHukdisOnly = role === ROLES.SDM_HUKDIS;

  const [aktifList,    setAktifList]    = useState<Pegawai[]>([]);
  const [nonaktifList, setNonaktifList] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAktif, setFilterAktif] = useState(true);
  const [filterGolongan, setFilterGolongan] = useState("");
  const [filterHukdis, setFilterHukdis] = useState("");
  const [filterLewat, setFilterLewat] = useState(false);
  // ?satker= dari modul Satker & UPT membuka daftar yang sudah tersaring.
  const searchParams = useSearchParams();
  const [filterSatker, setFilterSatker] = useState(() => searchParams.get("satker") ?? "");
  const [sortBy, setSortBy] = useState("nama_asc");
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<Pegawai | null>(null);
  const [showHapus, setShowHapus] = useState<Pegawai | null>(null);
  // Catat SK kenaikan pangkat: mengubah golongan, MKG, dan gaji pokok sebagai dasar KGB berikutnya.
  const [showPangkat, setShowPangkat] = useState<Pegawai | null>(null);
  const [showHapusPermanent, setShowHapusPermanent] = useState<Pegawai | null>(
    null,
  );
  const [form, setForm] = useState(formInit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [peringatan, setPeringatan] = useState("");

  // Checkbox selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkNonaktif, setShowBulkNonaktif] = useState(false);
  const [showBulkHapus, setShowBulkHapus] = useState(false);
  /** Pencatatan mutasi atau pemberhentian; pegawainya tidak dihapus, hanya dicatat peristiwanya. */
  const [showMutasi, setShowMutasi] = useState<Pegawai | null>(null);

  const refModalPegawai = useDialogModal(showModal, () => setShowModal(false), submitting);
  const refModalNonaktif = useDialogModal(!!showHapus, () => setShowHapus(null), submitting);
  const refModalBulkNonaktif = useDialogModal(showBulkNonaktif, () => setShowBulkNonaktif(false), submitting);
  const refModalBulkHapus = useDialogModal(showBulkHapus, () => setShowBulkHapus(false), submitting);
  const refModalHapusPermanen = useDialogModal(!!showHapusPermanent, () => setShowHapusPermanent(null), submitting);

  async function fetchAll() {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/pegawai?search=&status="),
        fetch("/api/pegawai?search=&status=nonaktif"),
      ]);
      const a: unknown = await r1.json();
      const n: unknown = await r2.json();
      setAktifList(Array.isArray(a) ? (a as Pegawai[]) : []);
      setNonaktifList(Array.isArray(n) ? (n as Pegawai[]) : []);
    } catch {
      setAktifList([]);
      setNonaktifList([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * KPPN mitra yang berlaku menurut Pengaturan. Daftar satker di bundel peramban hanya memuat KPPN
   * bawaan, sedangkan penyesuaiannya tersimpan di server.
   */
  const [kppnSatker, setKppnSatker] = useState<Record<string, string>>({});

  useEffect(() => {
    let batal = false;
    fetch("/api/satker/kppn")
      .then((r) => (r.ok ? (r.json() as Promise<{ kode: string; kppn: string }[]>) : []))
      .catch(() => [])
      .then((daftar) => {
        if (!batal && Array.isArray(daftar)) setKppnSatker(Object.fromEntries(daftar.map((s) => [s.kode, s.kppn])));
      });
    return () => { batal = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchAll();
      // Diarahkan dari halaman impor oleh guard peran (app/dashboard/pegawai/import/layout.tsx).
      if (new URLSearchParams(window.location.search).get("impor") === "ditolak") {
        setPeringatan("Impor data pegawai hanya dapat dilakukan oleh Super Admin dan SDM KGB.");
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function openTambah() {
    setEditData(null);
    setForm(formInit);
    setError("");
    setShowModal(true);
  }

  async function openEdit(p: Pegawai) {
    setEditData(p);
    setError("");
    const res = await fetch(`/api/pegawai/${p.id}`);
    const full = (await res.json()) as PegawaiDetail;
    setForm({
      nama: full.nama || "",
      nip: full.nip || "",
      tempatLahir: full.tempatLahir || "",
      tanggalLahir: keIsianTanggal(full.tanggalLahir),
      jenisKelamin: full.jenisKelamin || "",
      pendidikanTerakhir: full.pendidikanTerakhir || "",
      jabatan: full.jabatan || "",
      pangkat: full.pangkat || "",
      golonganRuang: full.golonganRuang || "",
      // Ejaan lain dari nama satker diseragamkan; nilai di luar daftar dibiarkan agar terlihat dan dipilih ulang.
      // Unit kerja kosong berarti Kanwil.
      unitKerja: full.unitKerja?.trim() ? (cariSatker(full.unitKerja)?.nama ?? full.unitKerja) : SATKER_KANWIL.nama,
      eselon: full.eselon || "",
      jenisJabatan: full.jenisJabatan || "",
      tmtGolongan: keIsianTanggal(full.tmtGolongan),
      mkgTahun: full.mkgTahun?.toString() || "0",
      mkgBulan: full.mkgBulan?.toString() || "0",
      gajiPokok: full.gajiPokok?.toString() || "",
      tmtKgbTerakhir: keIsianTanggal(full.tmtKgbTerakhir),
      tmtKgbBerikutnya: keIsianTanggal(full.tmtKgbBerikutnya),
      statusHukdis: full.statusHukdis || false,
      keteranganHukdis: full.keteranganHukdis || "",
      tanggalHukdisBerakhir: keIsianTanggal(full.tanggalHukdisBerakhir),
      jenisHukdis: full.jenisHukdis || "",
      aktif: full.aktif ?? true,
    });
    setShowModal(true);
  }

  async function handleSubmit() {
    setError("");

    // Validasi wajib
    const required: [string, string][] = [
      [form.nip, "NIP"],
      [form.nama.trim(), "Nama Lengkap"],
      [form.jenisKelamin, "Jenis Kelamin"],
      [form.pendidikanTerakhir, "Pendidikan Terakhir"],
      [form.jabatan, "Jabatan"],
      [form.jenisJabatan, "Jenis Jabatan"],
      [form.golonganRuang, "Golongan Ruang"],
      [form.mkgTahun !== "" && form.mkgBulan !== "" ? "ok" : "", "Masa Kerja Golongan (MKG)"],
      [form.tmtGolongan, "TMT Golongan"],
      [form.tmtKgbBerikutnya, "TMT KGB Berikutnya"],
    ];
    for (const [val, label] of required) {
      if (!val) { setError(`${label} wajib diisi`); return; }
    }
    const satker = cariSatker(form.unitKerja);
    if (!satker) { setError("Pilih Unit Kerja dari daftar satker"); return; }

    setSubmitting(true);
    const url = editData ? `/api/pegawai/${editData.id}` : "/api/pegawai";
    const method = editData ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, unitKerja: satker.nama }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "Terjadi kesalahan");
      return;
    }
    setSuccess(
      editData
        ? "Data pegawai berhasil diperbarui."
        : "Pegawai berhasil ditambahkan.",
    );
    setShowModal(false);
    fetchAll();
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleNonaktif() {
    if (!showHapus) return;
    setSubmitting(true);
    await fetch(`/api/pegawai/${showHapus.id}`, { method: "DELETE" });
    setSubmitting(false);
    setSuccess(`${showHapus.nama} berhasil dinonaktifkan.`);
    setShowHapus(null);
    fetchAll();
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleHapusPermanent() {
    if (!showHapusPermanent) return;
    setSubmitting(true);
    await fetch(`/api/pegawai/${showHapusPermanent.id}?permanent=true`, {
      method: "DELETE",
    });
    setSubmitting(false);
    setSuccess(`${showHapusPermanent.nama} berhasil dihapus permanen.`);
    setShowHapusPermanent(null);
    fetchAll();
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleAktifkan(p: Pegawai) {
    const res = await fetch(`/api/pegawai/${p.id}`);
    const full = (await res.json()) as PegawaiDetail;
    const hasil = await fetch(`/api/pegawai/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...full,
        aktif: true,
        tanggalLahir: keIsianTanggal(full.tanggalLahir),
        tmtGolongan: keIsianTanggal(full.tmtGolongan),
        tmtKgbTerakhir: keIsianTanggal(full.tmtKgbTerakhir),
        tmtKgbBerikutnya: keIsianTanggal(full.tmtKgbBerikutnya),
        gajiPokok: full.gajiPokok?.toString(),
        mkgTahun: full.mkgTahun?.toString() || "0",
        mkgBulan: full.mkgBulan?.toString() || "0",
      }),
    });
    // Aktivasi dapat ditolak, misalnya bila unit kerja tersimpan tidak ada di daftar satker.
    if (!hasil.ok) {
      const galat = (await hasil.json().catch(() => ({}))) as { error?: string };
      setPeringatan(`${p.nama} gagal diaktifkan kembali: ${galat.error ?? "terjadi kesalahan"}`);
      return;
    }
    setSuccess(`${p.nama} berhasil diaktifkan kembali.`);
    fetchAll();
    setTimeout(() => setSuccess(""), 3000);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === displayList.length && displayList.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayList.map((p) => p.id)));
    }
  }

  function handleExport() {
    const a = document.createElement("a");
    a.href = "/api/pegawai/export";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleBulkNonaktif() {
    setSubmitting(true);
    for (const id of selected) {
      await fetch(`/api/pegawai/${id}`, { method: "DELETE" });
    }
    setSubmitting(false);
    setSuccess(`${selected.size} pegawai berhasil dinonaktifkan.`);
    setSelected(new Set());
    setShowBulkNonaktif(false);
    fetchAll();
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleBulkHapusPermanent() {
    setSubmitting(true);
    for (const id of selected) {
      await fetch(`/api/pegawai/${id}?permanent=true`, { method: "DELETE" });
    }
    setSubmitting(false);
    setSuccess(`${selected.size} pegawai berhasil dihapus permanen.`);
    setSelected(new Set());
    setShowBulkHapus(false);
    fetchAll();
    setTimeout(() => setSuccess(""), 3000);
  }

  // Computed list berdasarkan tab : tab switch instant tanpa API call
  const pegawaiList = filterAktif ? aktifList : nonaktifList;

  // Stat global (dari aktifList, tidak terpengaruh filter). Batas SDM dihitung menurut hari ini WITA.
  const hukdisCount   = aktifList.filter((p) => p.statusHukdis).length;
  // Lewat batas input: KGB berikutnya belum diinput (tidak sedang diproses atau menunggu keuangan) padahal batas
  // input Tim SDM sudah lewat. Definisinya sama dengan dashboard (rapelanSiklus di lib/rekapKgb.ts).
  const lewatBatas = (p: Pegawai) =>
    !!jendelaProsesKgb(p.tmtKgbBerikutnya)?.flagRapelan && p.statusKGB !== "sedang_diproses" && p.statusKGB !== "menunggu_keuangan";
  const lewatBatasCount = aktifList.filter(lewatBatas).length;

  /** Status KGB berikutnya untuk kolom Status: proses berjalan, lewat batas, siap diinput, atau terjadwal. */
  function statusKgbBerikutnya(p: Pegawai): { label: string; gaya: React.CSSProperties; nada?: "merah"; batas: string | null } {
    const jendela = jendelaProsesKgb(p.tmtKgbBerikutnya);
    const batas = jendela ? jendela.deadlineSDM.toLocaleDateString("id-ID", FORMAT_TANGGAL_PENDEK) : null;
    if (p.statusKGB === "sedang_diproses" || p.statusKGB === "menunggu_keuangan") {
      const warna = warnaStatusKgb(p.statusKGB);
      return { label: infoStatusKgb(p.statusKGB).label, gaya: { background: warna.bg, color: warna.color }, batas };
    }
    if (jendela?.flagRapelan)
      return { label: "Lewat batas input", gaya: { background: "var(--tint-red-bg)", color: "var(--st-red)" }, nada: "merah", batas };
    if (jendela && !jendela.isLocked)
      return { label: "Siap diinput", gaya: { background: "var(--tint-amber-bg)", color: "var(--st-amber)" }, batas };
    return {
      label: jendela ? `Dibuka ${formatTanggalId(jendela.unlockDate, { day: "numeric", month: "short", year: "numeric" })}` : "Belum terjadwal",
      gaya: { background: "var(--sub)", color: "var(--dt4)" },
      batas,
    };
  }

  // Golongan unik dari data yang sudah di-load
  const golonganOptions = Array.from(
    new Set(pegawaiList.map((p) => p.golonganRuang))
  ).sort((a, b) => a.localeCompare(b));

  // Client-side filter + sort (termasuk search)
  const displayList = pegawaiList
    .filter((p) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !p.nama.toLowerCase().includes(q) &&
          !p.nip.includes(q) &&
          !p.jabatan.toLowerCase().includes(q) &&
          !(p.unitKerja ?? "").toLowerCase().includes(q)
        ) return false;
      }
      if (filterGolongan && p.golonganRuang !== filterGolongan) return false;
      if (filterHukdis === "hukdis" && !p.statusHukdis) return false;
      if (filterHukdis === "normal" && p.statusHukdis) return false;
      if (filterLewat && !lewatBatas(p)) return false;
      if (filterSatker) {
        const kode = (p.unitKerja?.trim() ? cariSatker(p.unitKerja)?.kode : SATKER_KANWIL.kode) ?? "__lain__";
        if (kode !== filterSatker) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "nama_asc": return a.nama.localeCompare(b.nama);
        case "nama_desc": return b.nama.localeCompare(a.nama);
        case "tmt_asc": return new Date(a.tmtKgbBerikutnya).getTime() - new Date(b.tmtKgbBerikutnya).getTime();
        case "tmt_desc": return new Date(b.tmtKgbBerikutnya).getTime() - new Date(a.tmtKgbBerikutnya).getTime();
        case "golongan_asc": return a.golonganRuang.localeCompare(b.golonganRuang);
        case "golongan_desc": return b.golonganRuang.localeCompare(a.golonganRuang);
        default: return 0;
      }
    });

  const f = (key: string, val: string | boolean) =>
    setForm((p) => ({ ...p, [key]: val }));
  const satkerTerpilih = cariSatker(form.unitKerja);
  const adaFilter = !!(filterGolongan || filterHukdis || filterSatker || filterLewat);

  const overlayStyle = {
    position: "fixed" as const,
    inset: 0,
    zIndex: 40,
    background: "rgba(10,25,45,0.45)",
    backdropFilter: "blur(4px)",
  };

  return (
    <div className="dsb-halaman">
      {/* Kepala halaman */}
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">{isHukdisOnly ? "Hukuman disiplin" : "Data"}</p>
          <h1 className="dsb-halaman-judul">{isHukdisOnly ? "Hukuman disiplin pegawai" : "Data pegawai"}</h1>
          <p className="dsb-sub">
            {loading
              ? "Memuat…"
              : isHukdisOnly
                ? `${hukdisCount} hukdis aktif dari ${aktifList.length} pegawai aktif`
                : `${aktifList.length} pegawai aktif · ${nonaktifList.length} nonaktif`}
          </p>
        </div>
        {filterAktif && canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleExport} className="dsb-tombol" data-jenis="garis">
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Ekspor CSV
            </button>
            <Link href="/dashboard/pegawai/import" className="dsb-tombol" data-jenis="garis">
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Impor CSV
            </Link>
            <button type="button" onClick={openTambah} className="dsb-tombol">
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Tambah pegawai
            </button>
          </div>
        )}
      </header>

      {success && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
          <p>{success}</p>
        </div>
      )}

      {peringatan && (
        <div role="status" className="dsb-pesan" data-nada="kuning">
          <span className="dsb-pesan-ikon" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </span>
          <p>{peringatan}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup peringatan" onClick={() => setPeringatan("")}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      <section className="dsb-kartu overflow-hidden dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-label="Daftar pegawai">
        <div className="dsb-kartu-isi flex flex-col gap-3" style={{ paddingBottom: "14px" }}>
          {/* Saringan cepat: aktif/nonaktif, lalu keadaan yang perlu perhatian */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="dsb-segmen" role="group" aria-label="Status pegawai">
              <button type="button" aria-pressed={filterAktif} onClick={() => { setFilterAktif(true); setSelected(new Set()); }}>
                Aktif {!loading && <span style={{ color: "var(--dt5)" }}>{aktifList.length}</span>}
              </button>
              <button type="button" aria-pressed={!filterAktif} onClick={() => { setFilterAktif(false); setSelected(new Set()); }}>
                Nonaktif {!loading && <span style={{ color: "var(--dt5)" }}>{nonaktifList.length}</span>}
              </button>
            </div>
            {filterAktif && !loading && (
              <div className="dsb-segmen" role="group" aria-label="Saringan cepat">
                <button type="button" aria-pressed={!filterLewat && !filterHukdis} onClick={() => { setFilterLewat(false); setFilterHukdis(""); }}>
                  Semua
                </button>
                {!isHukdisOnly && (
                  <button type="button" data-nada="merah" aria-pressed={filterLewat} onClick={() => { setFilterLewat(true); setFilterHukdis(""); }}>
                    Lewat batas input <span style={{ color: "var(--dt5)" }}>{lewatBatasCount}</span>
                  </button>
                )}
                <button type="button" data-nada="merah" aria-pressed={filterHukdis === "hukdis"} onClick={() => { setFilterLewat(false); setFilterHukdis("hukdis"); }}>
                  Hukdis aktif <span style={{ color: "var(--dt5)" }}>{hukdisCount}</span>
                </button>
                {isHukdisOnly && (
                  <button type="button" aria-pressed={filterHukdis === "normal"} onClick={() => { setFilterLewat(false); setFilterHukdis("normal"); }}>
                    Tanpa hukdis <span style={{ color: "var(--dt5)" }}>{aktifList.length - hukdisCount}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pencarian, saringan, dan urutan */}
          <div className="dsb-alat">
            <input
              type="search"
              className="dsb-cari"
              aria-label="Cari pegawai"
              placeholder="Cari nama, NIP, jabatan, atau unit kerja"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select aria-label="Saring golongan" className="dsb-pilih" data-aktif={filterGolongan ? "" : undefined} value={filterGolongan} onChange={(e) => setFilterGolongan(e.target.value)}>
              <option value="">Semua golongan</option>
              {golonganOptions.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select aria-label="Saring unit kerja" className="dsb-pilih" data-aktif={filterSatker ? "" : undefined} value={filterSatker} onChange={(e) => setFilterSatker(e.target.value)}>
              <option value="">Semua unit kerja</option>
              {SATKER.map((s) => (
                <option key={s.kode} value={s.kode}>{labelUnitKerja(s.nama).teks}</option>
              ))}
              <option value="__lain__">Belum sesuai daftar satker</option>
            </select>
            <select aria-label="Urutkan" className="dsb-pilih" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="nama_asc">Nama A–Z</option>
              <option value="nama_desc">Nama Z–A</option>
              <option value="tmt_asc">TMT KGB terdekat</option>
              <option value="tmt_desc">TMT KGB terjauh</option>
              <option value="golongan_asc">Golongan I–IV</option>
              <option value="golongan_desc">Golongan IV–I</option>
            </select>
            {(adaFilter || sortBy !== "nama_asc" || search) && (
              <button
                type="button"
                className="dsb-tombol dsb-tombol-kecil"
                data-jenis="garis"
                onClick={() => { setSearch(""); setFilterGolongan(""); setFilterHukdis(""); setFilterSatker(""); setFilterLewat(false); setSortBy("nama_asc"); }}
              >
                Atur ulang
              </button>
            )}
          </div>

          {(adaFilter || search) && !loading && (
            <p className="dsb-hasil" style={{ margin: 0 }}>
              Menampilkan <strong>{displayList.length}</strong> dari {pegawaiList.length} pegawai
            </p>
          )}

          {/* Aksi massal */}
          {selected.size > 0 && canEdit && (
            <div className="dsb-catatan">
              <span><strong style={{ fontSize: "inherit" }}>{selected.size} pegawai</strong> dipilih</span>
              <span className="flex items-center gap-2">
                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setSelected(new Set())}>Batal</button>
                {filterAktif ? (
                  <button type="button" className="dsb-tombol dsb-tombol-kecil" data-nada="merah" onClick={() => setShowBulkNonaktif(true)}>Nonaktifkan terpilih</button>
                ) : (
                  <button type="button" className="dsb-tombol dsb-tombol-kecil" data-nada="merah" onClick={() => setShowBulkHapus(true)}>Hapus permanen terpilih</button>
                )}
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="px-5 pb-5 flex flex-col gap-2" role="status" aria-label="Memuat data pegawai">
            {[1, 2, 3, 4].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 56, borderRadius: 12 }} />)}
          </div>
        ) : displayList.length === 0 ? (
          <div className="dsb-kosong" style={{ borderTop: "1px solid var(--ln2)", padding: "48px 16px" }}>
            <p style={{ margin: 0 }}>
              {adaFilter || search
                ? "Tidak ada pegawai yang cocok dengan saringan."
                : filterAktif
                  ? isHukdisOnly ? "Tidak ada pegawai dengan hukdis aktif." : "Belum ada data pegawai aktif."
                  : "Tidak ada pegawai nonaktif."}
            </p>
            {filterAktif && canEdit && !adaFilter && !search && (
              <button type="button" onClick={openTambah} className="dsb-tombol dsb-tombol-kecil" style={{ marginTop: "6px" }}>Tambah pegawai pertama</button>
            )}
          </div>
        ) : (
          <>
          {/* ── Tabel layar lebar ── */}
          <div className="hidden md:block overflow-x-auto tbl-scroll" style={{ borderTop: "1px solid var(--ln2)" }}>
            <table className="dsb-tabel">
              <thead>
                <tr>
                  <th scope="col" style={{ width: "36px" }}>
                    <input
                      type="checkbox"
                      className="dsb-cek"
                      aria-label="Pilih semua pegawai yang tampil"
                      checked={selected.size === displayList.length && displayList.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th scope="col">Pegawai</th>
                  <th scope="col">Jabatan dan unit kerja</th>
                  <th scope="col">Gaji pokok</th>
                  <th scope="col">{isHukdisOnly ? "Hukdis" : "KGB berikutnya"}</th>
                  <th scope="col"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((p) => {
                  const kgb = statusKgbBerikutnya(p);
                  const uk = labelUnitKerja(p.unitKerja);
                  return (
                    <tr key={p.id} className={[selected.has(p.id) ? "dsb-baris-pilih" : "", !filterAktif ? "dsb-redup" : ""].join(" ").trim() || undefined}>
                      <td>
                        <input type="checkbox" className="dsb-cek" aria-label={`Pilih ${p.nama}`} checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="dsb-avatar" data-nada={p.statusHukdis ? "merah" : undefined} aria-hidden="true">
                            {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                          <div className="min-w-0" style={{ lineHeight: 1.35 }}>
                            <p className="dsb-nama" style={{ margin: 0 }}>{p.nama}</p>
                            <p className="dsb-kecil" style={{ margin: 0 }}>{p.nip}</p>
                            {(() => {
                              const keadaan = ringkasKeadaanPegawai(p, hariIniWita());
                              return keadaan ? (
                                <p className="dsb-kecil" style={{ margin: "2px 0 0", color: keadaan.nada === "merah" ? "var(--st-red)" : "var(--st-amber)" }}>
                                  {keadaan.teks}
                                </p>
                              ) : null;
                            })()}
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: "280px" }}>
                        <p style={{ margin: 0, color: "var(--dtn)" }}>{p.jabatan}</p>
                        <p className="dsb-kecil" style={{ margin: "2px 0 0" }} title={p.unitKerja || undefined}>
                          {p.golonganRuang} {p.pangkat} · {uk.teks}
                        </p>
                        {!uk.dikenal && <p className="dsb-kecil" style={{ margin: "2px 0 0", color: "var(--st-amber)" }}>Unit kerja belum sesuai daftar satker</p>}
                      </td>
                      <td className="whitespace-nowrap">
                        <p style={{ margin: 0, color: "var(--dtn)", fontVariantNumeric: "tabular-nums" }}>Rp {p.gajiPokok.toLocaleString("id-ID")}</p>
                        <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>MKG {p.mkgTahun} thn{p.mkgBulan > 0 ? ` ${p.mkgBulan} bln` : ""}</p>
                      </td>
                      <td className="whitespace-nowrap">
                        {!filterAktif ? (
                          <span className="dsb-tag" data-garis="">Nonaktif</span>
                        ) : isHukdisOnly ? (
                          p.statusHukdis
                            ? <span className="dsb-tag" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>Hukdis aktif</span>
                            : <span className="dsb-kecil">Tanpa hukdis</span>
                        ) : (
                          <>
                            <p style={{ margin: 0, color: "var(--dtn)" }}>{formatTanggalId(p.tmtKgbBerikutnya, FORMAT_TANGGAL_PENDEK)}</p>
                            <div className="flex flex-wrap gap-1" style={{ marginTop: "4px" }}>
                              <span className="dsb-tag" style={kgb.gaya}>{kgb.label}</span>
                              {p.statusHukdis && <span className="dsb-tag" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>Hukdis</span>}
                            </div>
                            {kgb.batas && !kgb.label.startsWith("Dibuka") && (
                              <p className="dsb-kecil" style={{ margin: "3px 0 0", color: kgb.nada === "merah" ? "var(--st-red)" : undefined }}>
                                Batas input {kgb.batas}
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="kanan whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {filterAktif && !isHukdisOnly && (
                            <Link href={`/dashboard/kgb?pegawaiId=${p.id}`} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" aria-label={`Proses KGB ${p.nama}`}>
                              Proses KGB
                            </Link>
                          )}
                          <Link
                            href={`/dashboard/pegawai/${p.id}/riwayat`}
                            className={isHukdisOnly ? "dsb-tombol dsb-tombol-kecil" : "dsb-ikon-tombol"}
                            data-jenis={isHukdisOnly ? "garis" : undefined}
                            title={isHukdisOnly ? undefined : "Riwayat dan hukdis"}
                            aria-label={isHukdisOnly ? undefined : `Riwayat dan hukdis ${p.nama}`}
                          >
                            {isHukdisOnly ? "Kelola hukdis" : (
                              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                            )}
                          </Link>
                          {canEdit && filterAktif && (
                            <>
                              <button type="button" onClick={() => setShowPangkat(p)} className="dsb-ikon-tombol" title="Catat kenaikan pangkat" aria-label={`Catat kenaikan pangkat ${p.nama}`}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></svg>
                              </button>
                              <button type="button" onClick={() => setShowMutasi(p)} className="dsb-ikon-tombol" title="Mutasi atau pemberhentian" aria-label={`Catat mutasi atau pemberhentian ${p.nama}`}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8" /><line x1="21" y1="3" x2="13" y2="11" /><polyline points="8 21 3 21 3 16" /><line x1="3" y1="21" x2="11" y2="13" /></svg>
                              </button>
                              <button type="button" onClick={() => openEdit(p)} className="dsb-ikon-tombol" title="Ubah data pegawai" aria-label={`Ubah data ${p.nama}`}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                              </button>
                              <button type="button" onClick={() => setShowHapus(p)} className="dsb-ikon-tombol" data-nada="merah" title="Nonaktifkan pegawai" aria-label={`Nonaktifkan ${p.nama}`}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" y1="11" x2="23" y2="11" /></svg>
                              </button>
                            </>
                          )}
                          {canEdit && !filterAktif && (
                            <>
                              <button type="button" onClick={() => handleAktifkan(p)} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" aria-label={`Aktifkan kembali ${p.nama}`}>
                                Aktifkan
                              </button>
                              <button type="button" onClick={() => setShowHapusPermanent(p)} className="dsb-ikon-tombol" data-nada="merah" title="Hapus permanen" aria-label={`Hapus permanen ${p.nama}`}>
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Kartu layar sempit ── */}
          <ul className="md:hidden" style={{ borderTop: "1px solid var(--ln2)" }}>
            {displayList.map((p, i) => {
              const kgb = statusKgbBerikutnya(p);
              const uk = labelUnitKerja(p.unitKerja);
              return (
                <li key={p.id} className="px-4 py-3.5 flex flex-col gap-2.5" style={{ borderTop: i > 0 ? "1px solid var(--ln2)" : undefined, background: selected.has(p.id) ? "var(--tint-navy)" : undefined, fontSize: "13px" }}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="dsb-cek" style={{ marginTop: "8px" }} aria-label={`Pilih ${p.nama}`} checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                    <span className="dsb-avatar" data-nada={p.statusHukdis ? "merah" : undefined} aria-hidden="true">
                      {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="dsb-nama" style={{ margin: 0 }}>{p.nama}</p>
                      <p className="dsb-kecil" style={{ margin: 0 }}>{p.nip}</p>
                      <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>{p.golonganRuang} · {p.jabatan}</p>
                      <p className="dsb-kecil" style={{ margin: "2px 0 0", color: uk.dikenal ? undefined : "var(--st-amber)" }}>
                        {uk.teks}{uk.dikenal ? "" : " (belum sesuai daftar satker)"}
                      </p>
                      {(() => {
                        const keadaan = ringkasKeadaanPegawai(p, hariIniWita());
                        return keadaan ? (
                          <p className="dsb-kecil" style={{ margin: "2px 0 0", color: keadaan.nada === "merah" ? "var(--st-red)" : "var(--st-amber)" }}>
                            {keadaan.teks}
                          </p>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!filterAktif ? (
                      <span className="dsb-tag" data-garis="">Nonaktif</span>
                    ) : (
                      <>
                        {!isHukdisOnly && <span className="dsb-tag" style={kgb.gaya}>{kgb.label}</span>}
                        {p.statusHukdis && <span className="dsb-tag" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>Hukdis</span>}
                      </>
                    )}
                    <span className="dsb-kecil">
                      TMT {formatTanggalId(p.tmtKgbBerikutnya, { day: "numeric", month: "short", year: "numeric" })}
                      {kgb.batas ? ` · batas ${kgb.batas}` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {filterAktif && !isHukdisOnly && (
                      <Link href={`/dashboard/kgb?pegawaiId=${p.id}`} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">Proses KGB</Link>
                    )}
                    <Link href={`/dashboard/pegawai/${p.id}/riwayat`} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">
                      {isHukdisOnly ? "Kelola hukdis" : "Riwayat"}
                    </Link>
                    {canEdit && filterAktif && (
                      <>
                        <button type="button" onClick={() => openEdit(p)} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">Ubah</button>
                        <button type="button" onClick={() => setShowHapus(p)} className="dsb-tombol dsb-tombol-kecil" data-nada="merah" aria-label={`Nonaktifkan ${p.nama}`}>Nonaktifkan</button>
                      </>
                    )}
                    {canEdit && !filterAktif && (
                      <>
                        <button type="button" onClick={() => handleAktifkan(p)} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">Aktifkan kembali</button>
                        <button type="button" onClick={() => setShowHapusPermanent(p)} className="dsb-tombol dsb-tombol-kecil" data-nada="merah" aria-label={`Hapus permanen ${p.nama}`}>Hapus permanen</button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </section>

      {/* ===================== MODAL TAMBAH / EDIT ===================== */}
      {showModal && (
        <>
          <div style={overlayStyle} onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <div
              ref={refModalPegawai}
              role="dialog"
              aria-modal="true"
              aria-labelledby="judul-modal-pegawai"
              tabIndex={-1}
              className="bg-white rounded-t-2xl sm:rounded-2xl w-full overflow-hidden flex flex-col outline-none"
              style={{ maxWidth: "580px", maxHeight: "95dvh", zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0"
                style={{ borderBottom: "1px solid var(--ln2)" }}
              >
                <div>
                  <h2
                    id="judul-modal-pegawai"
                    className="text-sm font-semibold"
                    style={{ color: "var(--dtn)" }}
                  >
                    {editData ? "Ubah Data Pegawai" : "Tambah Pegawai Baru"}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
                    {editData
                      ? `NIP: ${editData.nip}`
                      : "Isi data lengkap pegawai"}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  aria-label="Tutup"
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                  style={{ background: "var(--sub)" }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8a9eb5"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-4 space-y-4">

                {/* ── IDENTITAS PEGAWAI ── */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "var(--sub)", borderBottom: "1px solid var(--ln1)" }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "var(--navy-solid)" }}>1</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Identitas Pegawai</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-hidden">
                    {/* NIP : full width */}
                    <div className="col-span-1 sm:col-span-2 min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>
                        NIP <span style={{ color: "var(--st-red)" }}>*</span>
                      </label>
                      <input
                        className={inputClass}
                        style={inputStyle}
                        placeholder="18 digit NIP"
                        inputMode="numeric"
                        maxLength={18}
                        value={form.nip}
                        onChange={(e) => f("nip", e.target.value.replace(/\D/g, ""))}
                      />
                      {editData && editData.nip !== form.nip && (
                        <p className="mt-1 text-xs" style={{ color: "var(--st-amber)" }}>
                          NIP diubah dari {editData.nip}. Pastikan sesuai SK CPNS; SK yang sudah terbit tetap memuat NIP lama.
                        </p>
                      )}
                    </div>

                    {/* Nama Lengkap : satu field */}
                    <div className="col-span-1 sm:col-span-2 min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>
                        Nama Lengkap <span style={{ color: "var(--st-red)" }}>*</span>
                        <span className="ml-1 font-normal" style={{ color: "var(--dt5)" }}>(gelar akademik jika ada)</span>
                      </label>
                      <input
                        className={inputClass}
                        style={inputStyle}
                        placeholder="misal: Dr. Budi Santoso, S.H., M.M."
                        value={form.nama}
                        onChange={(e) => f("nama", e.target.value)}
                      />
                    </div>

                    <Field label="Tempat Lahir">
                      <input className={inputClass} style={inputStyle} placeholder="Kota" value={form.tempatLahir} onChange={(e) => f("tempatLahir", e.target.value)} />
                    </Field>
                    <Field label="Tanggal Lahir">
                      <input type="date" className={inputClass} style={dateInputStyle} value={form.tanggalLahir} onChange={(e) => f("tanggalLahir", e.target.value)} />
                    </Field>
                    <div>
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Jenis Kelamin <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <select className={inputClass} style={inputStyle} value={form.jenisKelamin} onChange={(e) => f("jenisKelamin", e.target.value)}>
                        <option value="">Pilih</option>
                        {denganNilaiSaatIni(JENIS_KELAMIN, form.jenisKelamin).map((j) => <option key={j} value={j}>{j}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Pendidikan Terakhir <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <select className={inputClass} style={inputStyle} value={form.pendidikanTerakhir} onChange={(e) => f("pendidikanTerakhir", e.target.value)}>
                        <option value="">Pilih</option>
                        {denganNilaiSaatIni(PENDIDIKAN_TERAKHIR, form.pendidikanTerakhir).map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── JABATAN ── */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "var(--sub)", borderBottom: "1px solid var(--ln1)" }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "var(--navy-solid)" }}>2</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Jabatan &amp; Organisasi</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-hidden">
                    <div className="col-span-1 sm:col-span-2 min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Jabatan <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <input className={inputClass} style={inputStyle} placeholder="misal: Analis Kepegawaian" value={form.jabatan} onChange={(e) => f("jabatan", e.target.value)} />
                    </div>
                    <div className="col-span-1 sm:col-span-2 min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Jenis Jabatan <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <select className={inputClass} style={inputStyle} value={form.jenisJabatan} onChange={(e) => f("jenisJabatan", e.target.value)}>
                        <option value="">Pilih</option>
                        {denganNilaiSaatIni(JENIS_JABATAN, form.jenisJabatan).map((j) => <option key={j} value={j}>{j}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1 sm:col-span-2 min-w-0">
                      <label htmlFor="unit-kerja-pegawai" className={labelClass} style={{ color: "var(--dt2)" }}>Unit Kerja <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <select
                        id="unit-kerja-pegawai"
                        className={inputClass}
                        style={inputStyle}
                        value={satkerTerpilih?.nama ?? form.unitKerja}
                        onChange={(e) => f("unitKerja", e.target.value)}
                        aria-describedby="keterangan-unit-kerja"
                      >
                        {!satkerTerpilih && (
                          <option value={form.unitKerja} disabled={!form.unitKerja}>
                            {form.unitKerja ? `${form.unitKerja} (tidak ada di daftar satker)` : "Pilih unit kerja"}
                          </option>
                        )}
                        {SATKER.map((s) => <option key={s.kode} value={s.nama}>{s.nama}</option>)}
                      </select>
                      <p id="keterangan-unit-kerja" className="text-xs mt-1" style={{ color: satkerTerpilih ? "var(--dt5)" : "var(--st-amber)" }}>
                        {satkerTerpilih
                          ? `KPPN mitra: ${kppnSatker[satkerTerpilih.kode] ?? satkerTerpilih.kppn}. SK KGB pegawai ini ditujukan ke KPPN tersebut.`
                          : "Unit kerja tersimpan tidak cocok dengan daftar satker, sehingga SK KGB pegawai ini tidak dapat dibuat atau diunduh. Pilih satker yang benar lalu simpan."}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Eselon</label>
                      <select className={inputClass} style={inputStyle} value={form.eselon} onChange={(e) => f("eselon", e.target.value)}>
                        <option value="">Belum diisi</option>
                        {denganNilaiSaatIni(ESELON, form.eselon).map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── GOLONGAN & GAJI ── */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "var(--sub)", borderBottom: "1px solid var(--ln1)" }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "var(--navy-solid)" }}>3</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Golongan &amp; Gaji <span className="font-normal" style={{ color: "var(--dt5)" }}>(PP No. 5/2024)</span></span>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-hidden">
                    <div className="min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Golongan Berlaku Sejak <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <input type="date" className={inputClass} style={dateInputStyle} value={form.tmtGolongan} onChange={(e) => f("tmtGolongan", e.target.value)} />
                    </div>
                    <div className="min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Golongan Ruang <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <select
                        className={inputClass}
                        style={inputStyle}
                        value={form.golonganRuang}
                        onChange={(e) => {
                          const gol = e.target.value;
                          const pangkat = getPangkat(gol);
                          const mkgOpts = getMKGOptions(gol);
                          setForm((p) => {
                            const kenaikan = hitungMKGKenaikanPangkat(p.golonganRuang, gol, parseInt(p.mkgTahun) || 0, parseInt(p.mkgBulan) || 0);
                            const mkgTahun = kenaikan ? kenaikan.mkgTahun : (mkgOpts[0]?.tahun ?? 0);
                            const mkgBulan = kenaikan ? kenaikan.mkgBulan : (mkgOpts[0]?.bulan ?? 0);
                            return {
                              ...p,
                              golonganRuang: gol,
                              pangkat,
                              mkgTahun: mkgTahun.toString(),
                              mkgBulan: mkgBulan.toString(),
                              gajiPokok: getGajiPokok(gol, mkgTahun, mkgBulan).toString(),
                              tmtKgbBerikutnya: tmtBerikutnyaOtomatis(gol, mkgTahun, mkgBulan, p.tmtKgbTerakhir) || p.tmtKgbBerikutnya,
                            };
                          });
                        }}
                      >
                        <option value="">Pilih Golongan</option>
                        {Object.keys(GOLONGAN_PANGKAT).map((g) => <option key={g} value={g}>{g}: {GOLONGAN_PANGKAT[g]}</option>)}
                      </select>
                    </div>
                    <div className="col-span-1 sm:col-span-2 min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Pangkat</label>
                      <input className={inputClass} style={readonlyStyle} value={form.pangkat} readOnly placeholder="Terisi otomatis setelah golongan dipilih" />
                    </div>
                    <div className="col-span-1 sm:col-span-2 min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Masa Kerja Golongan (MKG) <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <select
                        className={inputClass}
                        style={form.golonganRuang ? inputStyle : readonlyStyle}
                        disabled={!form.golonganRuang}
                        value={form.mkgTahun !== "" ? `${form.mkgTahun}_${form.mkgBulan}` : ""}
                        onChange={(e) => {
                          if (!e.target.value) return;
                          const [tahun, bulan] = e.target.value.split("_").map(Number);
                          setForm((p) => ({
                            ...p,
                            mkgTahun: tahun.toString(),
                            mkgBulan: bulan.toString(),
                            gajiPokok: getGajiPokok(p.golonganRuang, tahun, bulan).toString(),
                            tmtKgbBerikutnya: tmtBerikutnyaOtomatis(p.golonganRuang, tahun, bulan, p.tmtKgbTerakhir) || p.tmtKgbBerikutnya,
                          }));
                        }}
                      >
                        <option value="">Pilih MKG</option>
                        {getMKGOptions(form.golonganRuang).map((opt) => (
                          <option key={`${opt.tahun}_${opt.bulan}`} value={`${opt.tahun}_${opt.bulan}`}>
                            {opt.tahun} Tahun {opt.bulan} Bulan: Rp {opt.gaji.toLocaleString("id-ID")}
                          </option>
                        ))}
                      </select>
                    </div>
                    {form.gajiPokok && (
                      <div className="col-span-1 sm:col-span-2 rounded-lg px-3 py-2 flex items-center gap-2" style={{ background: "var(--tint-navy)", border: "1px solid var(--ln0)" }}>
                        <span className="text-xs font-bold" style={{ color: "var(--dt4)" }}>GAJI POKOK</span>
                        <span className="text-sm font-bold" style={{ color: "var(--dtn)" }}>Rp {parseInt(form.gajiPokok).toLocaleString("id-ID")},-</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── JADWAL KGB ── */}
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: "var(--sub)", borderBottom: "1px solid var(--ln1)" }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: "var(--navy-solid)" }}>4</span>
                    <span className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Jadwal KGB</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-hidden">
                    <Field label="KGB Terakhir Berlaku">
                      <input
                        type="date"
                        className={inputClass}
                        style={dateInputStyle}
                        value={form.tmtKgbTerakhir}
                        onChange={(e) => {
                          const nilai = e.target.value;
                          setForm((p) => ({
                            ...p,
                            tmtKgbTerakhir: nilai,
                            tmtKgbBerikutnya:
                              tmtBerikutnyaOtomatis(p.golonganRuang, parseInt(p.mkgTahun) || 0, parseInt(p.mkgBulan) || 0, nilai)
                              || p.tmtKgbBerikutnya,
                          }));
                        }}
                      />
                    </Field>
                    <div className="min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>KGB Berikutnya Berlaku <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <input type="date" className={inputClass} style={dateInputStyle} value={form.tmtKgbBerikutnya} onChange={(e) => f("tmtKgbBerikutnya", e.target.value)} />
                      <p className="text-xs mt-1" style={{ color: "var(--dt4)" }}>
                        Terisi sendiri dari golongan, masa kerja, dan KGB terakhir. Golongan II/a dari masa kerja 0
                        naik setelah 1 tahun, bukan 2. Ubah hanya bila memang bergeser, misalnya karena penundaan
                        hukuman disiplin.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── STATUS HUKDIS (edit only : display/link saja) ── */}
                {editData && (
                  <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${form.statusHukdis ? "var(--tint-red-ln)" : "var(--ln1)"}` }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: form.statusHukdis ? "var(--tint-red-bg)" : "var(--sub)", borderBottom: `1px solid ${form.statusHukdis ? "var(--tint-red-ln)" : "var(--ln1)"}` }}>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: form.statusHukdis ? "var(--red-solid)" : "var(--navy-solid)" }}>5</span>
                        <span className="text-xs font-semibold" style={{ color: form.statusHukdis ? "var(--st-red)" : "var(--dtn)" }}>Status Hukdis</span>
                      </div>
                      {form.statusHukdis && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--tint-red-ln)", color: "var(--st-red)" }}>Aktif</span>
                      )}
                    </div>
                    <div className="p-4">
                      {form.statusHukdis ? (
                        <div className="space-y-2">
                          <p className="text-xs" style={{ color: "var(--dt3)" }}>
                            Pegawai sedang dalam masa hukuman disiplin. Proses KGB diblokir hingga hukdis berakhir.
                          </p>
                          <Link
                            href={`/dashboard/pegawai/${editData.id}/riwayat`}
                            onClick={() => setShowModal(false)}
                            className="flex items-center justify-center gap-1.5 text-xs w-full py-2 rounded-xl font-semibold transition"
                            style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "1px solid var(--tint-red-ln)" }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            Kelola Riwayat Hukdis
                          </Link>
                        </div>
                      ) : (
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>
                          Tidak ada hukdis aktif. Tambah hukdis melalui halaman riwayat pegawai.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg px-3 py-2.5 text-xs flex items-start gap-2" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "1px solid var(--tint-red-ln)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {error}
                  </div>
                )}

                <p className="text-xs pb-1" style={{ color: "#c0d0e0" }}>
                  <span style={{ color: "var(--st-red)" }}>*</span> wajib diisi
                </p>
              </div>

              {/* Modal Footer */}
              <div
                className="flex gap-2 px-4 sm:px-6 py-4 shrink-0"
                style={{ borderTop: "1px solid var(--ln2)" }}
              >
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 text-xs py-2.5 rounded-xl transition"
                  style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50 transition"
                  style={{ background: "var(--navy-solid)" }}
                >
                  {submitting
                    ? "Menyimpan..."
                    : editData
                      ? "Simpan Perubahan"
                      : "Simpan Pegawai"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===================== MODAL NONAKTIFKAN ===================== */}
      {showMutasi && (
        <ModalMutasiPegawai
          pegawai={{
            id: showMutasi.id,
            nama: showMutasi.nama,
            nip: showMutasi.nip,
            unitKerja: showMutasi.unitKerja ?? null,
            satkerTugas: showMutasi.satkerTugas ?? null,
          }}
          onTutup={() => setShowMutasi(null)}
          onBerhasil={(pesan) => {
            setShowMutasi(null);
            setSuccess(pesan);
            fetchAll();
            setTimeout(() => setSuccess(""), 4000);
          }}
        />
      )}

      {showPangkat && (
        <ModalKenaikanPangkat
          pegawai={{
            id: showPangkat.id,
            nama: showPangkat.nama,
            nip: showPangkat.nip,
            golonganRuang: showPangkat.golonganRuang,
            mkgTahun: showPangkat.mkgTahun,
            mkgBulan: showPangkat.mkgBulan,
            gajiPokok: showPangkat.gajiPokok,
          }}
          onTutup={() => setShowPangkat(null)}
          onBerhasil={(pesan) => {
            setShowPangkat(null);
            setSuccess(pesan);
            setTimeout(() => setSuccess(""), 8000);
            void fetchAll();
          }}
        />
      )}

      {showHapus && (
        <>
          <div style={overlayStyle} onClick={() => setShowHapus(null)} />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div
              ref={refModalNonaktif}
              role="dialog"
              aria-modal="true"
              aria-label="Nonaktifkan pegawai"
              tabIndex={-1}
              className="bg-white rounded-2xl p-6 w-full outline-none"
              style={{ maxWidth: "360px", zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
                style={{ background: "var(--tint-amber-bg)" }}
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#b87c0a"
                  strokeWidth="2"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h2
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--dtn)" }}
              >
                Nonaktifkan Pegawai?
              </h2>
              <p
                className="text-xs leading-relaxed mb-1"
                style={{ color: "var(--dt4)" }}
              >
                Data pegawai berikut akan dinonaktifkan:
              </p>
              <div
                className="rounded-lg px-3 py-2.5 mb-5"
                style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{ color: "var(--dtn)" }}
                >
                  {showHapus.nama}
                </p>
                <p className="text-xs" style={{ color: "var(--dt4)" }}>
                  {showHapus.nip} · {showHapus.golonganRuang}
                </p>
              </div>
              <p className="text-xs mb-5" style={{ color: "var(--dt4)" }}>
                Data tetap tersimpan dan dapat diaktifkan kembali kapan saja.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHapus(null)}
                  className="flex-1 text-xs py-2.5 rounded-xl transition"
                  style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleNonaktif}
                  disabled={submitting}
                  className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50 transition"
                  style={{ background: "var(--amber-solid)" }}
                >
                  {submitting ? "Memproses..." : "Nonaktifkan"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===================== MODAL BULK NONAKTIFKAN ===================== */}
      {showBulkNonaktif && (
        <>
          <div style={overlayStyle} onClick={() => setShowBulkNonaktif(false)} />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div
              ref={refModalBulkNonaktif}
              role="dialog"
              aria-modal="true"
              aria-label="Nonaktifkan pegawai terpilih"
              tabIndex={-1}
              className="bg-white rounded-2xl p-6 w-full outline-none"
              style={{ maxWidth: "360px", zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
                style={{ background: "var(--tint-amber-bg)" }}
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b87c0a" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>
                Nonaktifkan {selected.size} Pegawai?
              </h2>
              <p className="text-xs leading-relaxed mb-5" style={{ color: "var(--dt4)" }}>
                Semua pegawai yang dipilih akan dinonaktifkan. Data tetap tersimpan dan dapat diaktifkan kembali kapan saja.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkNonaktif(false)}
                  className="flex-1 text-xs py-2.5 rounded-xl transition"
                  style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleBulkNonaktif}
                  disabled={submitting}
                  className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50 transition"
                  style={{ background: "var(--amber-solid)" }}
                >
                  {submitting ? "Memproses..." : `Nonaktifkan ${selected.size} Pegawai`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===================== MODAL BULK HAPUS PERMANEN ===================== */}
      {showBulkHapus && (
        <>
          <div style={overlayStyle} onClick={() => setShowBulkHapus(false)} />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div
              ref={refModalBulkHapus}
              role="dialog"
              aria-modal="true"
              aria-label="Hapus permanen pegawai terpilih"
              tabIndex={-1}
              className="bg-white rounded-2xl p-6 w-full outline-none"
              style={{ maxWidth: "360px", zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
                style={{ background: "var(--tint-red-bg)" }}
              >
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" /><path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>
                Hapus Permanen {selected.size} Pegawai?
              </h2>
              <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--dt4)" }}>
                Semua pegawai yang dipilih akan dihapus{" "}
                <strong style={{ color: "var(--st-red)" }}>secara permanen</strong> dan tidak dapat dipulihkan.
              </p>
              <p className="text-xs mb-5" style={{ color: "var(--st-red)" }}>
                Perhatian: semua data KGB dan riwayat pegawai tersebut juga akan ikut terhapus.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkHapus(false)}
                  className="flex-1 text-xs py-2.5 rounded-xl transition"
                  style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleBulkHapusPermanent}
                  disabled={submitting}
                  className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50 transition"
                  style={{ background: "var(--red-solid)" }}
                >
                  {submitting ? "Menghapus..." : `Hapus ${selected.size} Pegawai`}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===================== MODAL HAPUS PERMANEN ===================== */}
      {showHapusPermanent && (
        <>
          <div
            style={overlayStyle}
            onClick={() => setShowHapusPermanent(null)}
          />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div
              ref={refModalHapusPermanen}
              role="dialog"
              aria-modal="true"
              aria-label="Hapus permanen pegawai"
              tabIndex={-1}
              className="bg-white rounded-2xl p-6 w-full outline-none"
              style={{ maxWidth: "360px", zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
                style={{ background: "var(--tint-red-bg)" }}
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </div>
              <h2
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--dtn)" }}
              >
                Hapus Permanen?
              </h2>
              <p
                className="text-xs leading-relaxed mb-3"
                style={{ color: "var(--dt4)" }}
              >
                Data pegawai berikut akan dihapus{" "}
                <strong style={{ color: "var(--st-red)" }}>secara permanen</strong>{" "}
                dan tidak dapat dipulihkan:
              </p>
              <div
                className="rounded-lg px-3 py-2.5 mb-3"
                style={{ background: "var(--tint-red-bg)", border: "0.5px solid var(--tint-red-ln)" }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{ color: "var(--dtn)" }}
                >
                  {showHapusPermanent.nama}
                </p>
                <p className="text-xs" style={{ color: "var(--dt4)" }}>
                  {showHapusPermanent.nip} · {showHapusPermanent.golonganRuang}
                </p>
              </div>
              <p className="text-xs mb-5" style={{ color: "var(--st-red)" }}>
                Perhatian: semua data KGB dan riwayat pegawai ini juga akan ikut
                terhapus.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHapusPermanent(null)}
                  className="flex-1 text-xs py-2.5 rounded-xl transition"
                  style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleHapusPermanent}
                  disabled={submitting}
                  className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50 transition"
                  style={{ background: "var(--red-solid)" }}
                >
                  {submitting ? "Menghapus..." : "Hapus Permanen"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
