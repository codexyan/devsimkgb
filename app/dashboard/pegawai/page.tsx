"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GOLONGAN_PANGKAT,
  getMKGOptions,
  getGajiPokok,
  getPangkat,
  hitungMKGKenaikanPangkat,
} from "@/lib/tabelGaji";
import { ROLES } from "@/lib/auth";
import { useRole } from "@/app/dashboard/components/RoleContext";

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
  kgbId?: string | null;
}

/* Status KGB terkini per pegawai (integrasi Kepegawaian ⇄ KGB) */
const KGB_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  belum_diproses:   { label: "KGB belum diproses", bg: "var(--tint-amber-bg)",  color: "var(--st-amber)"  },
  sedang_diproses:  { label: "KGB diproses",       bg: "var(--tint-blue-bg)",   color: "var(--st-blue)"   },
  menunggu_keuangan:{ label: "KGB di keuangan",    bg: "var(--tint-violet-bg)", color: "var(--st-violet)" },
  selesai:          { label: "KGB selesai",        bg: "var(--tint-green-bg)",  color: "var(--st-green)"  },
  ditolak:          { label: "KGB dibatalkan",     bg: "var(--tint-red-bg)",    color: "var(--st-red)"    },
};

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
  unitKerja: "Kantor Wilayah Direktorat Jenderal Pemasyarakatan Kalimantan Selatan",
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

const pendidikanList = ["SD", "SMP", "SMA/SMK", "D3", "S1", "S2", "S3"];
const eselonList = ["I.a", "I.b", "II.a", "II.b", "III.a", "III.b", "IV.a", "IV.b", "V.a"];
const jenisJabatanList = [
  "Jabatan Fungsional Umum/Pelaksana",
  "Jabatan Fungsional Tertentu",
  "Struktural",
];

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
  const [sortBy, setSortBy] = useState("nama_asc");
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<Pegawai | null>(null);
  const [showHapus, setShowHapus] = useState<Pegawai | null>(null);
  const [showHapusPermanent, setShowHapusPermanent] = useState<Pegawai | null>(
    null,
  );
  const [form, setForm] = useState(formInit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Checkbox selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showBulkNonaktif, setShowBulkNonaktif] = useState(false);
  const [showBulkHapus, setShowBulkHapus] = useState(false);

  async function fetchAll() {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/pegawai?search=&status="),
        fetch("/api/pegawai?search=&status=nonaktif"),
      ]);
      const a = await r1.json() as any;
      const n = await r2.json() as any;
      setAktifList(Array.isArray(a) ? a : []);
      setNonaktifList(Array.isArray(n) ? n : []);
    } catch {
      setAktifList([]);
      setNonaktifList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

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
    const full = await res.json() as any;
    const toDate = (val: string | null) =>
      val ? new Date(val).toISOString().split("T")[0] : "";
    setForm({
      nama: full.nama || "",
      nip: full.nip || "",
      tempatLahir: full.tempatLahir || "",
      tanggalLahir: toDate(full.tanggalLahir),
      jenisKelamin: full.jenisKelamin || "",
      pendidikanTerakhir: full.pendidikanTerakhir || "",
      jabatan: full.jabatan || "",
      pangkat: full.pangkat || "",
      golonganRuang: full.golonganRuang || "",
      unitKerja: full.unitKerja || "",
      eselon: full.eselon || "",
      jenisJabatan: full.jenisJabatan || "",
      tmtGolongan: toDate(full.tmtGolongan),
      mkgTahun: full.mkgTahun?.toString() || "0",
      mkgBulan: full.mkgBulan?.toString() || "0",
      gajiPokok: full.gajiPokok?.toString() || "",
      tmtKgbTerakhir: toDate(full.tmtKgbTerakhir),
      tmtKgbBerikutnya: toDate(full.tmtKgbBerikutnya),
      statusHukdis: full.statusHukdis || false,
      keteranganHukdis: full.keteranganHukdis || "",
      tanggalHukdisBerakhir: toDate(full.tanggalHukdisBerakhir),
      jenisHukdis: full.jenisHukdis || "",
      aktif: full.aktif,
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

    setSubmitting(true);
    const url = editData ? `/api/pegawai/${editData.id}` : "/api/pegawai";
    const method = editData ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json() as any;
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "Terjadi kesalahan");
      return;
    }
    setSuccess(
      editData
        ? "Data pegawai berhasil diupdate!"
        : "Pegawai berhasil ditambahkan!",
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
    const full = await res.json() as any;
    const toDate = (val: string | null) =>
      val ? new Date(val).toISOString().split("T")[0] : "";
    await fetch(`/api/pegawai/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...full,
        aktif: true,
        tanggalLahir: toDate(full.tanggalLahir),
        tmtGolongan: toDate(full.tmtGolongan),
        tmtKgbTerakhir: toDate(full.tmtKgbTerakhir),
        tmtKgbBerikutnya: toDate(full.tmtKgbBerikutnya),
        gajiPokok: full.gajiPokok?.toString(),
        mkgTahun: full.mkgTahun?.toString() || "0",
        mkgBulan: full.mkgBulan?.toString() || "0",
      }),
    });
    setSuccess(`${p.nama} berhasil diaktifkan kembali!`);
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

  // Stat global (dari aktifList, tidak terpengaruh filter)
  const today = new Date();
  const hukdisCount   = aktifList.filter((p) => p.statusHukdis).length;
  const terlambatCount = aktifList.filter((p) => {
    const tmt = new Date(p.tmtKgbBerikutnya);
    const deadline = new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
    return today > deadline;
  }).length;

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
          !p.jabatan.toLowerCase().includes(q)
        ) return false;
      }
      if (filterGolongan && p.golonganRuang !== filterGolongan) return false;
      if (filterHukdis === "hukdis" && !p.statusHukdis) return false;
      if (filterHukdis === "normal" && p.statusHukdis) return false;
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

  const overlayStyle = {
    position: "fixed" as const,
    inset: 0,
    zIndex: 40,
    background: "rgba(10,25,45,0.45)",
    backdropFilter: "blur(4px)",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          {!isHukdisOnly && (
            <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-amber)", marginBottom: "3px" }}>
              Data
            </p>
          )}
          <h1 className="text-base font-semibold" style={{ color: "var(--dtn)" }}>
            {isHukdisOnly ? "Hukuman Disiplin Pegawai" : "Data Pegawai"}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
            {loading
              ? "Memuat…"
              : isHukdisOnly
                ? `${hukdisCount} hukdis aktif · ${aktifList.length} pegawai aktif`
                : `${aktifList.length} aktif · ${nonaktifList.length} nonaktif`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Aktif/Nonaktif dengan count */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
            <button
              onClick={() => { setFilterAktif(true); setSelected(new Set()); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition"
              style={{ background: filterAktif ? "var(--navy-solid)" : "var(--card)", color: filterAktif ? "#fff" : "var(--dt4)" }}
            >
              Aktif
              {!loading && (
                <span className="px-1.5 py-px rounded-md font-bold"
                  style={{ background: filterAktif ? "rgba(255,255,255,0.2)" : "var(--ln1)", color: filterAktif ? "#fff" : "#6a8aaa", fontSize: "10px" }}>
                  {aktifList.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setFilterAktif(false); setSelected(new Set()); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition"
              style={{ background: !filterAktif ? "var(--amber-solid)" : "var(--card)", color: !filterAktif ? "#fff" : "var(--dt4)" }}
            >
              Nonaktif
              {!loading && nonaktifList.length > 0 && (
                <span className="px-1.5 py-px rounded-md font-bold"
                  style={{ background: !filterAktif ? "rgba(255,255,255,0.2)" : "var(--tint-amber-bg2)", color: !filterAktif ? "#fff" : "var(--st-amber)", fontSize: "10px" }}>
                  {nonaktifList.length}
                </span>
              )}
            </button>
          </div>
          {filterAktif && canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition"
                style={{
                  background: "var(--tint-green-bg)",
                  color: "var(--st-green)",
                  border: "1px solid var(--tint-green-ln)",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </button>
              <Link
                href="/dashboard/pegawai/import"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition"
                style={{
                  background: "var(--sub)",
                  color: "var(--dtn)",
                  border: "1px solid var(--ln1)",
                }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import CSV
              </Link>
              <button
                onClick={openTambah}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white transition"
                style={{ background: "var(--navy-solid)" }}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Tambah Pegawai
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stat chips */}
      {!loading && (
        <div className="flex flex-wrap gap-2 mb-4">
          {isHukdisOnly ? (
            <>
              <button
                onClick={() => { setFilterAktif(true); setFilterHukdis("hukdis"); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition"
                style={{ background: hukdisCount > 0 ? "var(--tint-red-bg)" : "var(--sub)", color: hukdisCount > 0 ? "var(--st-red)" : "var(--dt4)", border: `1px solid ${hukdisCount > 0 ? "var(--tint-red-ln)" : "var(--ln1)"}` }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                {hukdisCount} Hukdis Aktif
              </button>
              <button
                onClick={() => { setFilterAktif(true); setFilterHukdis("normal"); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition"
                style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "1px solid var(--tint-green-ln)" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--green-solid)" }} />
                {aktifList.length - hukdisCount} Tanpa Hukdis
              </button>
              <button
                onClick={() => { setFilterAktif(true); setFilterHukdis(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition"
                style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "1px solid var(--ln0)" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#3b82f6" }} />
                {aktifList.length} Total Pegawai
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "1px solid var(--ln0)" }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#3b82f6" }} />
                {aktifList.length} Pegawai Aktif
              </div>
              {hukdisCount > 0 && (
                <button
                  onClick={() => { setFilterAktif(true); setFilterHukdis("hukdis"); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition"
                  style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "1px solid var(--tint-red-ln)" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  {hukdisCount} Hukdis Aktif
                </button>
              )}
              {terlambatCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
                  style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "1px solid var(--tint-amber-ln)" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  </svg>
                  {terlambatCount} KGB Terlambat
                </div>
              )}
              {nonaktifList.length > 0 && (
                <button
                  onClick={() => { setFilterAktif(false); setSelected(new Set()); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition"
                  style={{ background: "var(--sub)", color: "var(--dt4)", border: "1px solid var(--ln1)" }}>
                  {nonaktifList.length} Nonaktif
                </button>
              )}
            </>
          )}
        </div>
      )}

      {success && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-xs font-medium"
          style={{
            background: "var(--tint-green-bg)",
            color: "var(--st-green)",
            border: "1px solid var(--tint-green-ln)",
          }}
        >
          {success}
        </div>
      )}

      {/* Search + Filter + Sort */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a0b4c8" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Cari nama, NIP, jabatan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-xs outline-none"
            style={{ border: "1px solid var(--ln0)", background: "var(--card)", color: "var(--dtn)" }}
          />
        </div>

        {/* Filter Golongan */}
        <select
          value={filterGolongan}
          onChange={(e) => setFilterGolongan(e.target.value)}
          className="rounded-xl px-3 py-2 text-xs outline-none"
          style={{ border: "1px solid var(--ln0)", background: "var(--card)", color: filterGolongan ? "var(--dtn)" : "var(--dt5)", minWidth: "110px" }}
        >
          <option value="">Semua Gol.</option>
          {golonganOptions.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        {/* Filter Hukdis */}
        <select
          value={filterHukdis}
          onChange={(e) => setFilterHukdis(e.target.value)}
          className="rounded-xl px-3 py-2 text-xs outline-none"
          style={{ border: "1px solid var(--ln0)", background: "var(--card)", color: filterHukdis ? "var(--dtn)" : "var(--dt5)", minWidth: "120px" }}
        >
          <option value="">Semua Status</option>
          <option value="normal">Tanpa Hukdis</option>
          <option value="hukdis">Hukdis Aktif</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-xl px-3 py-2 text-xs outline-none"
          style={{ border: "1px solid var(--ln0)", background: "var(--card)", color: "var(--dtn)", minWidth: "150px" }}
        >
          <option value="nama_asc">Nama A → Z</option>
          <option value="nama_desc">Nama Z → A</option>
          <option value="tmt_asc">TMT KGB Terdekat</option>
          <option value="tmt_desc">TMT KGB Terjauh</option>
          <option value="golongan_asc">Golongan I → IV</option>
          <option value="golongan_desc">Golongan IV → I</option>
        </select>

        {/* Reset filter */}
        {(filterGolongan || filterHukdis || sortBy !== "nama_asc") && (
          <button
            onClick={() => { setFilterGolongan(""); setFilterHukdis(""); setSortBy("nama_asc"); }}
            className="px-3 py-2 rounded-xl text-xs transition"
            style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "1px solid var(--tint-red-ln)" }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && canEdit && (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-2.5 mb-3"
          style={{ background: "var(--tint-navy)", border: "1px solid var(--ln0)" }}
        >
          <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>
            {selected.size} pegawai dipilih
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs px-3 py-1.5 rounded-lg transition"
              style={{ color: "var(--dt4)" }}
            >
              Batal
            </button>
            {filterAktif ? (
              <button
                onClick={() => setShowBulkNonaktif(true)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition"
                style={{ background: "var(--amber-solid)" }}
              >
                Nonaktifkan Terpilih
              </button>
            ) : (
              <button
                onClick={() => setShowBulkHapus(true)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white transition"
                style={{ background: "var(--red-solid)" }}
              >
                Hapus Permanen Terpilih
              </button>
            )}
          </div>
        </div>
      )}

      {/* Info jumlah hasil */}
      {(filterGolongan || filterHukdis) && !loading && (
        <p className="text-xs mb-3" style={{ color: "var(--dt4)" }}>
          Menampilkan <span className="font-semibold" style={{ color: "var(--dtn)" }}>{displayList.length}</span> dari {pegawaiList.length} pegawai
        </p>
      )}

      {/* Loading / Empty */}
      {loading ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-2xl" style={{ border: "0.5px solid var(--ln1)" }}>
          <p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat data...</p>
        </div>
      ) : displayList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 bg-white rounded-2xl" style={{ border: "0.5px solid var(--ln1)" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d0dce8" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          </svg>
          <p className="text-xs" style={{ color: "var(--dt5)" }}>
            {filterGolongan || filterHukdis
              ? "Tidak ada pegawai yang cocok dengan filter"
              : filterAktif
                ? isHukdisOnly
                  ? "Tidak ada pegawai dengan hukdis aktif"
                  : "Belum ada data pegawai aktif"
                : "Tidak ada pegawai nonaktif"}
          </p>
          {filterAktif && canEdit && (
            <button onClick={openTambah} className="text-xs underline" style={{ color: "var(--dtn)" }}>Tambah pegawai pertama</button>
          )}
        </div>
      ) : (
        <>
        {/* ── Desktop table ── */}
        <div className="hidden md:block bg-white rounded-2xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
          <div className="overflow-x-auto tbl-scroll">
            <table className="w-full">
              <thead>
                <tr
                  style={{
                    background: "var(--sub)",
                    borderBottom: "0.5px solid var(--ln1)",
                  }}
                >
                  <th className="px-4 py-3 w-9">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded"
                      checked={selected.size === displayList.length && displayList.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {["Pegawai", "Jabatan · Golongan", "Gaji · MKG", "TMT KGB · Deadline", "Status", isHukdisOnly ? "Hukdis" : "Aksi"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: "var(--dt4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayList.map((p, i) => {
                  const _pTmt = new Date(p.tmtKgbBerikutnya);
                  const _pDeadline = new Date(_pTmt.getFullYear(), _pTmt.getMonth() - 1, 0);
                  const _pNow = new Date();
                  const _pToday = new Date(_pNow.getFullYear(), _pNow.getMonth(), _pNow.getDate());
                  const isOverdue = p.aktif && !p.statusHukdis && _pToday > _pDeadline;
                  return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom:
                        i < displayList.length - 1
                          ? "0.5px solid var(--ln2)"
                          : "none",
                      background: selected.has(p.id) ? "var(--sub)" : undefined,
                    }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: filterAktif ? "var(--tint-navy)" : "var(--ln2)", color: filterAktif ? "var(--dtn)" : "var(--dt5)" }}>
                          {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium" style={{ color: filterAktif ? "var(--dtn)" : "var(--dt5)" }}>{p.nama}</p>
                          <p className="text-xs" style={{ color: "var(--dt4)" }}>{p.nip}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium" style={{ color: filterAktif ? "var(--dtn)" : "var(--dt5)" }}>{p.jabatan}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="inline-block text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{p.golonganRuang}</span>
                        <span className="text-xs" style={{ color: "var(--dt5)" }}>{p.pangkat}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-semibold" style={{ color: filterAktif ? "var(--dtn)" : "var(--dt5)" }}>Rp {p.gajiPokok.toLocaleString("id-ID")}</p>
                      <p className="text-xs" style={{ color: "var(--dt5)" }}>{p.mkgTahun} thn {p.mkgBulan > 0 ? `${p.mkgBulan} bln` : ""} MKG</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-medium" style={{ color: "var(--dt3)" }}>
                        {_pTmt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: isOverdue ? "var(--st-red)" : "var(--dt5)" }}>
                        Deadline: {_pDeadline.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        {!filterAktif ? (
                          <span
                            className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{ background: "var(--ln2)", color: "var(--dt5)" }}
                          >
                            Nonaktif
                          </span>
                        ) : p.statusHukdis ? (
                          <span
                            className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}
                          >
                            Hukdis
                          </span>
                        ) : (
                          <span
                            className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{ background: "var(--tint-green-bg)", color: "var(--st-green)" }}
                          >
                            Aktif
                          </span>
                        )}
                        {isOverdue && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "1px solid var(--tint-amber-ln)", fontSize: "10px" }}
                          >
                            Terlambat
                          </span>
                        )}
                        {/* Status KGB terkini (peran KGB, pegawai aktif) */}
                        {filterAktif && !isHukdisOnly && p.statusKGB && KGB_STATUS[p.statusKGB] && (
                          <span
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: KGB_STATUS[p.statusKGB].bg, color: KGB_STATUS[p.statusKGB].color, fontSize: "10px" }}
                          >
                            <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                            {KGB_STATUS[p.statusKGB].label}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {/* Proses KGB langsung (buka detail proses pegawai ini) */}
                        {filterAktif && !isHukdisOnly && (
                          <Link
                            href={`/dashboard/kgb?pegawaiId=${p.id}`}
                            title="Proses KGB pegawai ini"
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                            style={{ background: "var(--tint-amber-bg)", border: "0.5px solid var(--tint-amber-ln)", color: "var(--st-amber)" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>
                          </Link>
                        )}
                        <Link
                          href={`/dashboard/pegawai/${p.id}/riwayat`}
                          title={isHukdisOnly ? "Kelola Hukdis" : "Riwayat & Hukdis"}
                          className={isHukdisOnly ? "flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold transition whitespace-nowrap" : "w-8 h-8 rounded-lg flex items-center justify-center transition"}
                          style={{ background: "var(--tint-green-bg)", border: "0.5px solid var(--tint-green-ln)", color: "var(--st-green)" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                          {isHukdisOnly && <span>Kelola Hukdis</span>}
                        </Link>
                        {canEdit && filterAktif && (
                          <>
                            <button
                              onClick={() => openEdit(p)}
                              title="Edit data pegawai"
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                              style={{ background: "var(--tint-navy)", border: "0.5px solid var(--ln0)", color: "var(--dtn)" }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button
                              onClick={() => setShowHapus(p)}
                              title="Nonaktifkan pegawai"
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                              style={{ background: "var(--tint-red-bg)", border: "0.5px solid var(--tint-red-ln)", color: "var(--st-red)" }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
                            </button>
                          </>
                        )}
                        {canEdit && !filterAktif && (
                          <>
                            <button
                              onClick={() => handleAktifkan(p)}
                              title="Aktifkan kembali"
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                              style={{ background: "var(--tint-green-bg)", border: "0.5px solid var(--tint-green-ln)", color: "var(--st-green)" }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                            </button>
                            <button
                              onClick={() => setShowHapusPermanent(p)}
                              title="Hapus permanen"
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                              style={{ background: "var(--tint-red-bg)", border: "0.5px solid var(--tint-red-ln)", color: "var(--st-red)" }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
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
        </div>

        {/* ── Mobile cards ── */}
        <div className="md:hidden space-y-2">
          {displayList.map((p) => {
            const _mTmt = new Date(p.tmtKgbBerikutnya);
            const _mDeadline = new Date(_mTmt.getFullYear(), _mTmt.getMonth() - 1, 0);
            const _mToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
            const mOverdue = p.aktif && !p.statusHukdis && _mToday > _mDeadline;
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl overflow-hidden"
                style={{ border: `0.5px solid ${selected.has(p.id) ? "#a0c4e0" : "var(--ln1)"}` }}
              >
                {/* Card header */}
                <div className="flex items-start gap-3 p-4">
                  <input type="checkbox" className="w-4 h-4 rounded mt-0.5 shrink-0" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: filterAktif ? "var(--tint-navy)" : "var(--ln2)", color: filterAktif ? "var(--dtn)" : "var(--dt5)" }}>
                    {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold leading-tight" style={{ color: filterAktif ? "var(--dtn)" : "var(--dt5)" }}>{p.nama}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>{p.nip}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>{p.golonganRuang}</span>
                      <span className="text-xs" style={{ color: "var(--dt3)" }}>{p.jabatan}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {!filterAktif
                      ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--ln2)", color: "var(--dt5)" }}>Nonaktif</span>
                      : p.statusHukdis
                      ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>Hukdis</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)" }}>Aktif</span>
                    }
                    {mOverdue && (
                      <span className="rounded-full font-bold" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "1px solid var(--tint-amber-ln)", fontSize: "10px", padding: "1px 6px" }}>Terlambat</span>
                    )}
                    {filterAktif && !isHukdisOnly && p.statusKGB && KGB_STATUS[p.statusKGB] && (
                      <span className="rounded-full font-medium" style={{ background: KGB_STATUS[p.statusKGB].bg, color: KGB_STATUS[p.statusKGB].color, fontSize: "10px", padding: "1px 6px" }}>
                        {KGB_STATUS[p.statusKGB].label}
                      </span>
                    )}
                  </div>
                </div>
                {/* Card stats */}
                <div className="grid grid-cols-3" style={{ borderTop: "0.5px solid var(--ln2)" }}>
                  <div className="px-4 py-2.5" style={{ borderRight: "0.5px solid var(--ln2)" }}>
                    <p className="text-xs font-semibold" style={{ color: filterAktif ? "var(--dtn)" : "var(--dt5)" }}>Rp {(p.gajiPokok / 1000).toFixed(0)}rb</p>
                    <p style={{ fontSize: "10px", color: "var(--dt5)" }}>Gaji Pokok</p>
                  </div>
                  <div className="px-4 py-2.5" style={{ borderRight: "0.5px solid var(--ln2)" }}>
                    <p className="text-xs font-semibold" style={{ color: "var(--dt3)" }}>{_mTmt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })}</p>
                    <p style={{ fontSize: "10px", color: "var(--dt5)" }}>TMT KGB</p>
                  </div>
                  <div className="px-4 py-2.5">
                    <p className="text-xs font-semibold" style={{ color: mOverdue ? "var(--st-red)" : "var(--dt3)" }}>{_mDeadline.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })}</p>
                    <p style={{ fontSize: "10px", color: mOverdue ? "#f87171" : "var(--dt5)" }}>Deadline SDM</p>
                  </div>
                </div>
                {/* Card actions */}
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "0.5px solid var(--ln2)" }}>
                  {filterAktif && !isHukdisOnly && (
                    <Link href={`/dashboard/kgb?pegawaiId=${p.id}`} title="Proses KGB pegawai ini" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "0.5px solid var(--tint-amber-ln)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>
                      Proses KGB
                    </Link>
                  )}
                  <Link href={`/dashboard/pegawai/${p.id}/riwayat`} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "0.5px solid var(--tint-green-ln)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                    {isHukdisOnly ? "Kelola Hukdis" : "Riwayat"}
                  </Link>
                  {canEdit && filterAktif && (
                    <>
                      <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition" style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      <button onClick={() => setShowHapus(p)} title="Nonaktifkan" className="w-9 h-9 flex items-center justify-center rounded-xl transition shrink-0" style={{ background: "var(--tint-red-bg)", border: "0.5px solid var(--tint-red-ln)", color: "var(--st-red)" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="11" x2="23" y2="11"/></svg>
                      </button>
                    </>
                  )}
                  {canEdit && !filterAktif && (
                    <>
                      <button onClick={() => handleAktifkan(p)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "0.5px solid var(--tint-green-ln)" }}>
                        Aktifkan Kembali
                      </button>
                      <button onClick={() => setShowHapusPermanent(p)} title="Hapus permanen" className="w-9 h-9 flex items-center justify-center rounded-xl transition shrink-0" style={{ background: "var(--tint-red-bg)", border: "0.5px solid var(--tint-red-ln)", color: "var(--st-red)" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </>
      )}

      {/* ===================== MODAL TAMBAH / EDIT ===================== */}
      {showModal && (
        <>
          <div style={overlayStyle} onClick={() => setShowModal(false)} />
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <div
              className="bg-white rounded-t-2xl sm:rounded-2xl w-full overflow-hidden flex flex-col"
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
                    className="text-sm font-semibold"
                    style={{ color: "var(--dtn)" }}
                  >
                    {editData ? "Edit Data Pegawai" : "Tambah Pegawai Baru"}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
                    {editData
                      ? `NIP: ${editData.nip}`
                      : "Isi data lengkap pegawai"}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
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
                        style={editData ? readonlyStyle : inputStyle}
                        placeholder="18 digit NIP"
                        inputMode="numeric"
                        maxLength={18}
                        value={form.nip}
                        onChange={(e) => f("nip", e.target.value.replace(/\D/g, ""))}
                        readOnly={!!editData}
                      />
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
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Pendidikan Terakhir <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <select className={inputClass} style={inputStyle} value={form.pendidikanTerakhir} onChange={(e) => f("pendidikanTerakhir", e.target.value)}>
                        <option value="">Pilih</option>
                        {pendidikanList.map((p) => <option key={p} value={p}>{p}</option>)}
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
                        {jenisJabatanList.map((j) => <option key={j} value={j}>{j}</option>)}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Eselon</label>
                      <select className={inputClass} style={inputStyle} value={form.eselon} onChange={(e) => f("eselon", e.target.value)}>
                        <option value="">Tidak Ada</option>
                        {eselonList.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div className="min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>Unit Kerja</label>
                      <input className={`${inputClass} truncate`} style={readonlyStyle} value={form.unitKerja} readOnly title={form.unitKerja} />
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
                            return { ...p, golonganRuang: gol, pangkat, mkgTahun: mkgTahun.toString(), mkgBulan: mkgBulan.toString(), gajiPokok: getGajiPokok(gol, mkgTahun, mkgBulan).toString() };
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
                          setForm((p) => ({ ...p, mkgTahun: tahun.toString(), mkgBulan: bulan.toString(), gajiPokok: getGajiPokok(form.golonganRuang, tahun, bulan).toString() }));
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
                      <input type="date" className={inputClass} style={dateInputStyle} value={form.tmtKgbTerakhir} onChange={(e) => f("tmtKgbTerakhir", e.target.value)} />
                    </Field>
                    <div className="min-w-0">
                      <label className={labelClass} style={{ color: "var(--dt2)" }}>KGB Berikutnya Berlaku <span style={{ color: "var(--st-red)" }}>*</span></label>
                      <input type="date" className={inputClass} style={dateInputStyle} value={form.tmtKgbBerikutnya} onChange={(e) => f("tmtKgbBerikutnya", e.target.value)} />
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
                            Kelola Riwayat Hukdis →
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
                      ? "Update Data"
                      : "Simpan Pegawai"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===================== MODAL NONAKTIFKAN ===================== */}
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
              className="bg-white rounded-2xl p-6 w-full"
              style={{ maxWidth: "360px", zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
                style={{ background: "var(--tint-amber-bg)" }}
              >
                <svg
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
              className="bg-white rounded-2xl p-6 w-full"
              style={{ maxWidth: "360px", zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
                style={{ background: "var(--tint-amber-bg)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b87c0a" strokeWidth="2">
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
              className="bg-white rounded-2xl p-6 w-full"
              style={{ maxWidth: "360px", zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
                style={{ background: "var(--tint-red-bg)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
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
                ⚠ Semua data KGB dan riwayat pegawai tersebut juga akan ikut terhapus.
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
              className="bg-white rounded-2xl p-6 w-full"
              style={{ maxWidth: "360px", zIndex: 51 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
                style={{ background: "var(--tint-red-bg)" }}
              >
                <svg
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
                ⚠ Semua data KGB dan riwayat pegawai ini juga akan ikut
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
