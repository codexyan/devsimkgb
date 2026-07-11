"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRef } from "react";
import Link from "next/link";

interface KGB {
  id: string | null;
  isVirtual?: boolean;
  pegawaiId?: string;
  pegawai: { nama: string; nip: string; unitKerja: string; jabatan: string };
  golonganLama: string;
  gajiPokokLama: number;
  mkgTahunLama: number;
  mkgBulanLama: number;
  golonganBaru: string;
  gajiPokokBaru: number | null;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  tmtKgbBaru: string;
  tmtKgbBerikutnya: string;
  nomorSK: string;
  tanggalSK: string;
  tmtSK: string;
  status: string;
  flagRapelan: boolean;
  unlockDate?: string;
  isLocked?: boolean;
  createdAt: string;
  surat: { id: string; nomorSurat: string; pathFile?: string | null } | null;
}

interface Pegawai {
  id: string;
  nip: string;
  nama: string;
  jabatan: string;
  golonganRuang: string;
  mkgTahun: number;
  mkgBulan: number;
  gajiPokok: number;
  tmtKgbBerikutnya: string;
  statusHukdis: boolean;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  belum_diproses: { label: "Belum Diproses", bg: "var(--tint-amber-bg)", color: "var(--st-amber)" },
  sedang_diproses: { label: "Sedang Diproses", bg: "var(--tint-navy)", color: "var(--dtn)" },
  menunggu_keuangan: { label: "Menunggu Keuangan", bg: "var(--tint-violet-bg)", color: "var(--st-violet)" },
  selesai: { label: "Selesai", bg: "var(--tint-green-bg)", color: "var(--st-green)" },
  ditolak: { label: "Dibatalkan", bg: "var(--tint-red-bg)", color: "var(--st-red)" },
};

export default function KGBPage() {
  const searchParams = useSearchParams();
  const kgbIdFromUrl = searchParams.get("kgbId");
  const pegawaiIdFromUrl = searchParams.get("pegawaiId");
  const lastAutoOpenedId = useRef<string | null>(null);

  const [kgbList, setKgbList] = useState<KGB[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [summary, setSummary] = useState<{
    total: number;
    belum_diproses: number;
    sedang_diproses: number;
    menunggu_keuangan: number;
    selesai: number;
    ditolak: number;
    rapelan: number;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()));
  const [filterRapelan, setFilterRapelan] = useState("");
  const [filterDeadlineBulan, setFilterDeadlineBulan] = useState("");
  const [filterGolongan, setFilterGolongan] = useState("");
  const [sortBy, setSortBy] = useState("tmt_desc");
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<KGB | null>(null);
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [pegawaiSearch, setPegawaiSearch] = useState("");
  const [selectedPegawai, setSelectedPegawai] = useState<Pegawai | null>(null);
  const [form, setForm] = useState({ nomorSK: "", tanggalSK: "", tmtSK: "" });
  const [preview, setPreview] = useState<{
    mkgTahunBaru: number;
    mkgBulanBaru: number;
    gajiPokokBaru: number;
    tmtKgbBaru: string;
    tmtKgbBerikutnya: string;
    flagRapelan: boolean;
  } | null>(null);
  const [isArsip, setIsArsip] = useState(false);
  const [arsipStep, setArsipStep] = useState<"form" | "konfirmasi">("form");
  const [arsipFile, setArsipFile] = useState<File | null>(null);
  const [arsipFileUrl, setArsipFileUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showTolak, setShowTolak] = useState<KGB | null>(null);
  const [alasanTolak, setAlasanTolak] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [confirmUpload, setConfirmUpload] = useState<{ kgbId: string; file: File; nama: string } | null>(null);

  async function handleUploadSK() {
    if (!confirmUpload) return;
    setUploadingFile(true);
    const fd = new FormData();
    fd.append("file", confirmUpload.file);
    const res = await fetch(`/api/kgb/${confirmUpload.kgbId}/upload-sk`, {
      method: "POST",
      body: fd,
    });
    setUploadingFile(false);
    setConfirmUpload(null);
    if (res.ok) {
      setSuccess("SK tertandatangani berhasil diupload. Menunggu konfirmasi keuangan.");
      setShowDetail(null);
      fetchKGB(); fetchSummary();
      setTimeout(() => setSuccess(""), 4000);
    } else {
      const data = await res.json() as any;
      setError(data.error || "Gagal upload file.");
    }
  }


  async function handleTolak() {
    if (!showTolak || !showTolak.id) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/kgb/${showTolak.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ditolak", alasanTolak }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as any;
        setError(data.error || "Gagal membatalkan entri KGB.");
        return;
      }
      setSuccess(`Entri KGB ${showTolak.pegawai.nama} dibatalkan, dapat diinput ulang.`);
      setShowTolak(null);
      setShowDetail(null);
      setAlasanTolak("");
      fetchKGB(); fetchSummary();
      setTimeout(() => setSuccess(""), 3000);
    } finally {
      setSubmittingAction(false);
    }
  }

  async function fetchSummary() {
    try {
      const res = await fetch("/api/kgb/summary");
      if (res.ok) setSummary(await res.json() as any);
    } catch { /* silent */ }
  }

  async function fetchKGB() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterBulan) params.set("bulan", filterBulan);
      if (filterTahun) params.set("tahun", filterTahun);
      if (filterRapelan) params.set("rapelan", filterRapelan);
      if (filterDeadlineBulan) params.set("deadlineBulan", filterDeadlineBulan);
      const res = await fetch(`/api/kgb?${params}`);
      const data = await res.json() as any;
      setKgbList(Array.isArray(data) ? data : []);
      setLastSynced(new Date());
    } catch {
      setKgbList([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSinkronkan() {
    setSyncing(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterStatus) params.set("status", filterStatus);
      if (filterBulan) params.set("bulan", filterBulan);
      if (filterTahun) params.set("tahun", filterTahun);
      if (filterRapelan) params.set("rapelan", filterRapelan);
      if (filterDeadlineBulan) params.set("deadlineBulan", filterDeadlineBulan);
      const [res] = await Promise.all([
        fetch(`/api/kgb?${params}`),
        fetchSummary(),
      ]);
      const data = await res.json() as any;
      setKgbList(Array.isArray(data) ? data : []);
      setLastSynced(new Date());
    } catch {
      // silent
    } finally {
      setSyncing(false);
    }
  }

  async function fetchPegawai(q = "") {
    const res = await fetch(`/api/pegawai?search=${q}`);
    const data = await res.json() as any;
    setPegawaiList(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    fetchKGB();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterBulan, filterTahun, filterRapelan, filterDeadlineBulan]);

  useEffect(() => {
    const t = setTimeout(() => fetchKGB(), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Fetch summary counts on mount
  useEffect(() => { fetchSummary(); }, []);

  // Baca filter dari URL params saat pertama kali mount (dari dashboard)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rapelan = params.get("rapelan");
    const deadlineBulan = params.get("deadlineBulan");
    if (rapelan) setFilterRapelan(rapelan);
    if (deadlineBulan) setFilterDeadlineBulan(deadlineBulan);
  }, []);

  // Auto-buka detail jika ada ?kgbId= atau ?pegawaiId= di URL (dari dashboard)
  useEffect(() => {
    if (kgbList.length === 0) return;
    if (!kgbIdFromUrl && !pegawaiIdFromUrl) return;
    const paramKey = kgbIdFromUrl ?? pegawaiIdFromUrl;
    if (lastAutoOpenedId.current === paramKey) return;
    let found: KGB | undefined;
    if (kgbIdFromUrl) found = kgbList.find((k) => k.id === kgbIdFromUrl);
    if (!found && pegawaiIdFromUrl) found = kgbList.find((k) => k.pegawaiId === pegawaiIdFromUrl);
    if (found) {
      lastAutoOpenedId.current = paramKey!;
      setShowDetail(found);
    }
  }, [kgbIdFromUrl, pegawaiIdFromUrl, kgbList]);

  // Preview kalkulasi otomatis saat pilih pegawai
  async function pilihPegawai(p: Pegawai) {
    setSelectedPegawai(p);
    setPegawaiSearch(p.nama);

    // Kalkulasi di client
    const mkgBulanTotal = p.mkgTahun * 12 + p.mkgBulan + 24;
    const mkgTahunBaru = Math.floor(mkgBulanTotal / 12);
    const mkgBulanBaru = mkgBulanTotal % 12;

    // Fetch gaji dari tabel
    const { getGajiPokok } = await import("@/lib/tabelGaji");
    const gajiPokokBaru = getGajiPokok(
      p.golonganRuang,
      mkgTahunBaru,
      mkgBulanBaru,
    );

    const tmtKgbBaru = new Date(p.tmtKgbBerikutnya);
    const tmtKgbBerikutnya = new Date(tmtKgbBaru);
    tmtKgbBerikutnya.setFullYear(tmtKgbBerikutnya.getFullYear() + 2);

    const today = new Date();
    const tmt = new Date(p.tmtKgbBerikutnya);
    const deadlineSDM = new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const flagRapelan = todayDate > deadlineSDM;

    setPreview({
      mkgTahunBaru,
      mkgBulanBaru,
      gajiPokokBaru,
      tmtKgbBaru: tmtKgbBaru.toISOString().split("T")[0],
      tmtKgbBerikutnya: tmtKgbBerikutnya.toISOString().split("T")[0],
      flagRapelan,
    });
  }

  // Buka modal dalam mode Arsip : isArsip pre-set true, tidak bisa diubah
  async function handleArsipkan(k: KGB) {
    resetModal();
    const pegawaiId = k.pegawaiId ?? k.id ?? "";
    try {
      const res = await fetch(`/api/pegawai/${pegawaiId}`);
      if (res.ok) {
        const fresh = await res.json() as any;
        await pilihPegawai(fresh);
      } else {
        const p: Pegawai = {
          id: pegawaiId,
          nip: k.pegawai.nip,
          nama: k.pegawai.nama,
          jabatan: k.pegawai.jabatan,
          golonganRuang: k.golonganLama,
          mkgTahun: k.mkgTahunLama,
          mkgBulan: k.mkgBulanLama,
          gajiPokok: k.gajiPokokLama,
          tmtKgbBerikutnya: k.tmtKgbBaru,
          statusHukdis: false,
        };
        await pilihPegawai(p);
      }
    } catch {
      const p: Pegawai = {
        id: pegawaiId,
        nip: k.pegawai.nip,
        nama: k.pegawai.nama,
        jabatan: k.pegawai.jabatan,
        golonganRuang: k.golonganLama,
        mkgTahun: k.mkgTahunLama,
        mkgBulan: k.mkgBulanLama,
        gajiPokok: k.gajiPokokLama,
        tmtKgbBerikutnya: k.tmtKgbBaru,
        statusHukdis: false,
      };
      await pilihPegawai(p);
    }
    setIsArsip(true);
    setShowModal(true);
  }

  // Buka modal input KGB langsung dari baris virtual (pegawai belum diproses)
  async function handleInputVirtual(k: KGB) {
    resetModal();
    const p: Pegawai = {
      id: k.pegawaiId!,
      nip: k.pegawai.nip,
      nama: k.pegawai.nama,
      jabatan: k.pegawai.jabatan,
      golonganRuang: k.golonganLama,
      mkgTahun: k.mkgTahunLama,
      mkgBulan: k.mkgBulanLama,
      gajiPokok: k.gajiPokokLama,
      tmtKgbBerikutnya: k.tmtKgbBaru,
      statusHukdis: false,
    };
    await pilihPegawai(p);
    setShowModal(true);
  }

  // Input ulang dari KGB yang ditolak : langsung pre-populate tanpa perlu cari lagi
  async function handleInputUlang(k: KGB) {
    resetModal();
    // Ambil data pegawai terbaru dari server supaya MKG/gaji akurat
    try {
      const res = await fetch(`/api/pegawai/${k.pegawaiId}`);
      if (res.ok) {
        const fresh = await res.json() as any;
        await pilihPegawai(fresh);
      } else {
        // Fallback ke data dari KGB jika fetch gagal
        const p: Pegawai = {
          id: k.pegawaiId!,
          nip: k.pegawai.nip,
          nama: k.pegawai.nama,
          jabatan: k.pegawai.jabatan,
          golonganRuang: k.golonganLama,
          mkgTahun: k.mkgTahunLama,
          mkgBulan: k.mkgBulanLama,
          gajiPokok: k.gajiPokokLama,
          tmtKgbBerikutnya: k.tmtKgbBaru,
          statusHukdis: false,
        };
        await pilihPegawai(p);
      }
    } catch {
      const p: Pegawai = {
        id: k.pegawaiId!,
        nip: k.pegawai.nip,
        nama: k.pegawai.nama,
        jabatan: k.pegawai.jabatan,
        golonganRuang: k.golonganLama,
        mkgTahun: k.mkgTahunLama,
        mkgBulan: k.mkgBulanLama,
        gajiPokok: k.gajiPokokLama,
        tmtKgbBerikutnya: k.tmtKgbBaru,
        statusHukdis: false,
      };
      await pilihPegawai(p);
    }
    setShowModal(true);
  }

  async function handleSubmit() {
    if (!selectedPegawai) {
      setError("Pilih pegawai terlebih dahulu");
      return;
    }
    if (!form.nomorSK || !form.tanggalSK || !form.tmtSK) {
      setError("Nomor SK, Tanggal SK, dan TMT SK wajib diisi");
      return;
    }
    setError("");

    // Mode arsip → tampilkan konfirmasi + upload dulu, jangan simpan langsung
    if (isArsip) {
      setArsipStep("konfirmasi");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/kgb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pegawaiId: selectedPegawai.id, ...form }),
    });
    const data = await res.json() as any;
    setSubmitting(false);

    if (!res.ok) { setError(data.error); return; }

    setSuccess(`KGB ${data.pegawai.nama} berhasil ditambahkan!`);
    setShowModal(false);
    resetModal();
    fetchKGB(); fetchSummary();
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleKonfirmasiArsip() {
    if (!selectedPegawai) return;
    if (!arsipFile) { setError("File SK wajib diupload untuk arsip KGB"); return; }
    setError("");
    setSubmitting(true);

    // 1. Simpan KGB arsip → langsung selesai
    const res = await fetch("/api/kgb", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pegawaiId: selectedPegawai.id, ...form, isArsip: true }),
    });
    const data = await res.json() as any;

    if (!res.ok) {
      setSubmitting(false);
      setError(data.error);
      return;
    }

    // 2. Upload file SK jika ada
    if (arsipFile && data.id) {
      const fd = new FormData();
      fd.append("file", arsipFile);
      await fetch(`/api/kgb/${data.id}/upload-sk`, { method: "POST", body: fd });
    }

    setSubmitting(false);
    setSuccess(`Arsip KGB ${data.pegawai?.nama ?? selectedPegawai.nama} berhasil disimpan.`);
    setShowModal(false);
    resetModal();
    fetchKGB(); fetchSummary();
    setTimeout(() => setSuccess(""), 3000);
  }


  function resetModal() {
    setSelectedPegawai(null);
    setPegawaiSearch("");
    setPegawaiList([]);
    setPreview(null);
    setForm({ nomorSK: "", tanggalSK: "", tmtSK: "" });
    setIsArsip(false);
    setArsipStep("form");
    setArsipFile(null);
    setArsipFileUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setError("");
  }

  // Buat / cabut object URL saat arsipFile berubah
  useEffect(() => {
    if (!arsipFile) { setArsipFileUrl(null); return; }
    const url = URL.createObjectURL(arsipFile);
    setArsipFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [arsipFile]);

  const overlayStyle = {
    position: "fixed" as const,
    inset: 0,
    zIndex: 40,
    background: "rgba(10,25,45,0.45)",
    backdropFilter: "blur(4px)",
    animation: "kgbOverlayIn 0.28s ease both",
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
  const golonganList = [
    "", "I/a", "I/b", "I/c", "I/d",
    "II/a", "II/b", "II/c", "II/d",
    "III/a", "III/b", "III/c", "III/d",
    "IV/a", "IV/b", "IV/c", "IV/d", "IV/e",
  ];

  const thisYear    = new Date().getFullYear();
  const defaultTahun = String(thisYear);
  const tahunList   = Array.from({ length: 7 }, (_, i) => thisYear - 3 + i);

  const displayList = kgbList
    .filter((k) => !filterGolongan || k.golonganLama === filterGolongan)
    .sort((a, b) => {
      switch (sortBy) {
        case "nama_asc": return a.pegawai.nama.localeCompare(b.pegawai.nama, "id");
        case "nama_desc": return b.pegawai.nama.localeCompare(a.pegawai.nama, "id");
        case "tmt_asc": return new Date(a.tmtKgbBaru).getTime() - new Date(b.tmtKgbBaru).getTime();
        case "tmt_desc": return new Date(b.tmtKgbBaru).getTime() - new Date(a.tmtKgbBaru).getTime();
        case "status": return a.status.localeCompare(b.status);
        default: return 0;
      }
    });

  // filterTahun == defaultTahun adalah state normal, bukan filter aktif
  const hasActiveFilter = !!(filterGolongan || filterRapelan || filterDeadlineBulan || filterStatus || filterBulan || (filterTahun && filterTahun !== defaultTahun) || search);

  const bulanList = [
    { value: "1", label: "Januari" }, { value: "2", label: "Februari" },
    { value: "3", label: "Maret" }, { value: "4", label: "April" },
    { value: "5", label: "Mei" }, { value: "6", label: "Juni" },
    { value: "7", label: "Juli" }, { value: "8", label: "Agustus" },
    { value: "9", label: "September" }, { value: "10", label: "Oktober" },
    { value: "11", label: "November" }, { value: "12", label: "Desember" },
  ];

  return (
    <>
    <div style={{ animation: "kgbPageIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
      <style>{`
        @keyframes kgbPageIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes kgbOverlayIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes kgbModalIn {
          from { opacity: 0; transform: translateY(32px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-amber)", marginBottom: "3px" }}>
            Data
          </p>
          <h1 className="text-base font-semibold" style={{ color: "var(--dtn)" }}>Proses KGB</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
            Kelola dan proses Kenaikan Gaji Berkala pegawai
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            onClick={handleSinkronkan}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium transition"
            style={{
              background: syncing ? "var(--ln2)" : "var(--tint-navy)",
              color: syncing ? "var(--dt5)" : "var(--dtn)",
              border: "1px solid var(--ln0)",
              cursor: syncing ? "wait" : "pointer",
            }}
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ animation: syncing ? "spin 1s linear infinite" : "none" }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {syncing ? "Menyinkronkan..." : "Sinkronkan Data"}
          </button>
          {lastSynced && (
            <span className="text-xs" style={{ color: "#b0c4d8" }}>
              Diperbarui {lastSynced.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

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

      {/* -- Tab chips quick-filter status -- */}
      {(() => {
        const tabs = [
          { value: "", label: "Semua", count: summary?.total ?? null, bg: "var(--sub)", color: "var(--dtn)", activeBg: "var(--navy-solid)", activeColor: "#fff" },
          {
            value: "sedang_diproses", label: "Sedang Diproses",
            count: summary?.sedang_diproses ?? null,
            bg: "var(--tint-navy)", color: "var(--dtn)",
            activeBg: "var(--navy-solid)", activeColor: "#fff",
            dot: summary?.sedang_diproses ? "#3b82f6" : null,
          },
          {
            value: "menunggu_keuangan", label: "Menunggu Keuangan",
            count: summary?.menunggu_keuangan ?? null,
            bg: "var(--tint-violet-bg)", color: "var(--st-violet)",
            activeBg: "var(--tint-violet-bg)", activeColor: "var(--st-violet)",
            dot: summary?.menunggu_keuangan ? "var(--st-violet)" : null,
          },
          {
            value: "belum_diproses", label: "Belum Diproses",
            count: summary?.belum_diproses ?? null,
            bg: "var(--sub)", color: "var(--st-amber)",
            activeBg: "var(--tint-amber-bg)", activeColor: "var(--st-amber)",
          },
          {
            value: "selesai", label: "Selesai",
            count: summary?.selesai ?? null,
            bg: "#f0faf6", color: "var(--st-green)",
            activeBg: "var(--tint-green-bg)", activeColor: "var(--st-green)",
          },
        ];
        return (
          <div className="flex flex-wrap gap-2 mb-4">
            {tabs.map((tab) => {
              const isActive = filterStatus === tab.value && !filterRapelan && !filterDeadlineBulan;
              return (
                <button
                  key={tab.value}
                  onClick={() => {
                    setFilterStatus(tab.value);
                    setFilterRapelan("");
                    setFilterDeadlineBulan("");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition"
                  style={{
                    background: isActive ? tab.activeBg : tab.bg,
                    color: isActive ? tab.activeColor : tab.color,
                    border: `1px solid ${isActive ? "transparent" : "var(--ln1)"}`,
                    boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                  }}
                >
                  {tab.dot && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tab.dot }} />
                  )}
                  {tab.label}
                  {tab.count !== null && (
                    <span
                      className="px-1.5 py-0.5 rounded-md text-xs font-bold min-w-5 text-center"
                      style={{
                        background: isActive ? "rgba(255,255,255,0.25)" : "var(--ln1)",
                        color: isActive ? tab.activeColor : "#6a8aaa",
                        fontSize: "10px",
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
            {summary?.rapelan ? (
              <button
                onClick={() => { setFilterRapelan("1"); setFilterDeadlineBulan(""); setFilterStatus(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition"
                style={{
                  background: filterRapelan ? "var(--tint-amber-bg)" : "var(--sub)",
                  color: "var(--st-amber)",
                  border: `1px solid ${filterRapelan ? "var(--tint-amber-ln)" : "var(--tint-amber-bg2)"}`,
                  boxShadow: filterRapelan ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
                Terlambat
                <span className="px-1.5 py-0.5 rounded-md font-bold" style={{ background: "var(--tint-amber-ln)", color: "var(--st-amber)", fontSize: "10px" }}>
                  {summary.rapelan}
                </span>
              </button>
            ) : null}
            {filterDeadlineBulan && (
              <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "1px solid var(--ln0)" }}>
                Jatuh tempo ≤{filterDeadlineBulan} bln
                <button onClick={() => setFilterDeadlineBulan("")} className="opacity-50 hover:opacity-100 leading-none">×</button>
              </span>
            )}
          </div>
        );
      })()}


      {/* Filter */}
      <div className="bg-white rounded-2xl p-4 mb-4 space-y-3" style={{ border: "0.5px solid var(--ln1)" }}>
        {/* Baris 1: Search + Reset */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a0b4c8" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Cari nama atau NIP pegawai..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs outline-none"
              style={{ border: "1px solid var(--ln0)", background: "var(--sub)", color: "var(--dtn)" }}
            />
          </div>
          {hasActiveFilter && (
            <button
              onClick={() => { setSearch(""); setFilterStatus(""); setFilterBulan(""); setFilterTahun(defaultTahun); setFilterGolongan(""); setFilterRapelan(""); setFilterDeadlineBulan(""); setSortBy("tmt_desc"); }}
              className="text-xs px-3 py-2 rounded-xl transition whitespace-nowrap"
              style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "1px solid var(--tint-red-ln)" }}
            >
              × Reset
            </button>
          )}
        </div>

        {/* Baris 2: Golongan + Tahun + Bulan + Sort */}
        <div className="flex flex-wrap gap-2">
          <select
            value={filterGolongan}
            onChange={(e) => setFilterGolongan(e.target.value)}
            className="rounded-xl px-3 py-2 text-xs outline-none"
            style={{ border: "1px solid var(--ln0)", background: filterGolongan ? "var(--tint-navy)" : "var(--sub)", color: "var(--dtn)", minWidth: "120px" }}
          >
            <option value="">Semua Golongan</option>
            {golonganList.filter(Boolean).map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            value={filterTahun}
            onChange={(e) => { setFilterTahun(e.target.value); if (!e.target.value) setFilterBulan(""); }}
            className="rounded-xl px-3 py-2 text-xs outline-none"
            style={{ border: "1px solid var(--ln0)", background: filterTahun ? "var(--tint-navy)" : "var(--sub)", color: "var(--dtn)", minWidth: "115px" }}
          >
            <option value="">Semua Tahun</option>
            {tahunList.map((y) => (
              <option key={y} value={y.toString()}>{y}</option>
            ))}
          </select>

          <select
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className="rounded-xl px-3 py-2 text-xs outline-none"
            style={{ border: "1px solid var(--ln0)", background: filterBulan ? "var(--tint-navy)" : "var(--sub)", color: "var(--dtn)", minWidth: "130px" }}
          >
            <option value="">Semua Bulan</option>
            {bulanList.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl px-3 py-2 text-xs outline-none"
            style={{ border: "1px solid var(--ln0)", background: "var(--sub)", color: "var(--dtn)", minWidth: "155px" }}
          >
            <option value="tmt_asc">TMT Terlama → Terbaru</option>
            <option value="tmt_desc">TMT Terbaru → Terlama</option>
            <option value="nama_asc">Nama A → Z</option>
            <option value="nama_desc">Nama Z → A</option>
            <option value="status">Berdasarkan Status</option>
          </select>

        </div>

        {/* Info hasil filter */}
        {hasActiveFilter && (
          <p className="text-xs" style={{ color: "var(--dt5)" }}>
            Menampilkan <strong style={{ color: "var(--dtn)" }}>{displayList.length}</strong> dari <strong style={{ color: "var(--dtn)" }}>{kgbList.length}</strong> data KGB
            {kgbList.filter(k => k.isVirtual).length > 0 && (
              <span style={{ color: "#c0a030" }}> · {kgbList.filter(k => k.isVirtual).length} belum diproses</span>
            )}
          </p>
        )}
      </div>

      {/* Tabel */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "0.5px solid var(--ln1)" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-xs" style={{ color: "var(--dt4)" }}>
              Memuat data...
            </p>
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d0dce8"
              strokeWidth="1.5"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>
              {kgbList.length === 0 ? "Belum ada data KGB" : "Tidak ada data yang sesuai filter"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  style={{
                    background: "var(--sub)",
                    borderBottom: "0.5px solid var(--ln1)",
                  }}
                >
                  {[
                    "No",
                    "Pegawai",
                    "Golongan",
                    "Gaji Lama → Baru",
                    "MKG Baru",
                    "TMT KGB",
                    "Status",
                    "Aksi",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold whitespace-nowrap"
                      style={{ color: "var(--dt4)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayList.map((k, i) => {
                  const st =
                    STATUS_CONFIG[k.status] || STATUS_CONFIG.belum_diproses;
                  const _tmt = new Date(k.tmtKgbBaru);
                  const _deadlineSDM = new Date(_tmt.getFullYear(), _tmt.getMonth() - 1, 0);
                  const _today = new Date();
                  const _todayDate = new Date(_today.getFullYear(), _today.getMonth(), _today.getDate());
                  const terlambat = k.status !== "selesai" && k.status !== "ditolak" && k.status !== "menunggu_keuangan" && _todayDate > _deadlineSDM;
                  const isPeriodeBerikutnya =
                    !k.isVirtual &&
                    k.status === "belum_diproses" &&
                    new Date(k.tmtKgbBaru).getFullYear() > new Date().getFullYear();
                  return (
                    <tr
                      key={k.id ?? `virtual-${k.pegawaiId}`}
                      style={{
                        borderBottom:
                          i < displayList.length - 1
                            ? "0.5px solid var(--ln2)"
                            : "none",
                        background: k.isVirtual ? "var(--sub)" : isPeriodeBerikutnya ? "var(--sub)" : "var(--card)",
                        borderLeft: k.isVirtual ? "3px solid var(--tint-amber-ln)" : isPeriodeBerikutnya ? "3px solid var(--ln0)" : "3px solid transparent",
                        opacity: isPeriodeBerikutnya ? 0.82 : 1,
                      }}
                    >
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--dt5)" }}>{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}
                          >
                            {k.pegawai.nama
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p
                                className="text-xs font-medium"
                                style={{ color: "var(--dtn)" }}
                              >
                                {k.pegawai.nama}
                              </p>
                              {terlambat && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded font-bold"
                                  style={{
                                    background: "var(--tint-amber-bg)",
                                    color: "var(--st-amber)",
                                    fontSize: "9px",
                                  }}
                                >
                                  TERLAMBAT
                                </span>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: "var(--dt4)" }}>
                              {k.pegawai.nip}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        style={{ color: "var(--dtn)" }}
                      >
                        {k.golonganLama}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs" style={{ color: "var(--dt4)" }}>
                          Rp {k.gajiPokokLama.toLocaleString("id-ID")}
                        </p>
                        {k.isVirtual ? (
                          <p className="text-xs italic" style={{ color: "#c0a030" }}>belum diproses</p>
                        ) : (
                          <p className="text-xs font-semibold" style={{ color: "var(--st-green)" }}>
                            Rp {k.gajiPokokBaru!.toLocaleString("id-ID")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--dt3)" }}>
                        {k.isVirtual ? (
                          <span className="italic" style={{ color: "var(--dt6)" }}>-</span>
                        ) : (
                          `${k.mkgTahunBaru} Thn ${k.mkgBulanBaru} Bln`
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        style={{ color: "var(--dt3)" }}
                      >
                        {new Date(k.tmtKgbBaru).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{ background: st.bg, color: st.color }}
                          >
                            {st.label}
                          </span>
                          {k.isVirtual && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: "#fffbea", color: "#c0a030", fontSize: "10px", border: "1px solid var(--tint-amber-ln)" }}
                            >
                              Dari Pegawai
                            </span>
                          )}
                          {!k.isVirtual && k.status === "belum_diproses" && k.nomorSK === "" && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: "var(--ln2)", color: "var(--dt4)", fontSize: "10px" }}
                            >
                              Antrean Otomatis
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {/* Entri virtual: tombol Input KGB langsung */}
                          {k.isVirtual ? (
                            k.isLocked ? (
                              <span
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium cursor-not-allowed"
                                style={{ background: "var(--ln2)", color: "var(--dt5)", border: "0.5px solid var(--ln0)" }}
                                title={`Jendela proses dibuka ${k.unlockDate ? new Date(k.unlockDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : ""}`}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                Terkunci
                              </span>
                            ) : terlambat ? (
                              <>
                                <button
                                  onClick={() => handleArsipkan(k)}
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                                  style={{ background: "var(--amber-solid)", color: "#fff" }}
                                  title="SK sudah terbit, catat sebagai arsip historis"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
                                  </svg>
                                  Arsip KGB
                                </button>
                                <button
                                  onClick={() => handleInputVirtual(k)}
                                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                                  style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "1px solid var(--tint-amber-ln)" }}
                                  title="Proses KGB sekarang, akan dicatat sebagai rapelan"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                  </svg>
                                  Proses Rapelan
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleInputVirtual(k)}
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                                style={{ background: "var(--navy-solid)", color: "#fff" }}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                Input KGB
                              </button>
                            )
                          ) : (
                            <>
                              <button
                                onClick={() => setShowDetail(k)}
                                className="text-xs px-3 py-1.5 rounded-lg transition"
                                style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}
                              >
                                Detail
                              </button>

                              {k.status === "belum_diproses" && (() => {
                                const terkunci = k.isLocked ?? false;
                                const unlockLabel = k.unlockDate
                                  ? new Date(k.unlockDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                                  : "";

                                // TMT masa lalu + terlambat → tawarkan arsip ATAU proses rapelan
                                if (terlambat && !terkunci) {
                                  return (
                                    <>
                                      <button
                                        onClick={() => handleArsipkan(k)}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                                        style={{ background: "var(--amber-solid)", color: "#fff" }}
                                        title="SK sudah terbit, catat sebagai arsip historis"
                                      >
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
                                        </svg>
                                        Arsip KGB
                                      </button>
                                      <Link
                                        href={`/dashboard/kgb/${k.id}/generate`}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                                        style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "1px solid var(--tint-amber-ln)" }}
                                        title="Proses KGB sekarang, akan dicatat sebagai rapelan"
                                      >
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        </svg>
                                        Proses Rapelan
                                      </Link>
                                    </>
                                  );
                                }

                                return terkunci ? (
                                  <span
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium cursor-not-allowed"
                                    style={{ background: "var(--ln2)", color: "var(--dt5)", border: "0.5px solid var(--ln0)" }}
                                    title={`Jendela proses dibuka ${unlockLabel}`}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    Terkunci
                                  </span>
                                ) : (
                                  <Link
                                    href={`/dashboard/kgb/${k.id}/generate`}
                                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
                                    style={{ background: "var(--navy-solid)", color: "#fff" }}
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                      <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    Generate
                                  </Link>
                                );
                              })()}

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
        )}
      </div>

    </div>

      {/* -- MODAL INPUT KGB -- */}
      {showModal && (
        <>
          <div
            style={overlayStyle}
            onClick={() => {
              setShowModal(false);
              resetModal();
            }}
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
              className="bg-white rounded-2xl w-full overflow-hidden flex flex-col"
              style={{ maxWidth: "680px", maxHeight: "92vh", zIndex: 51, animation: "kgbModalIn 0.38s cubic-bezier(0.34, 1.4, 0.64, 1) both" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between px-6 py-4 shrink-0"
                style={{ borderBottom: `1px solid ${isArsip ? "var(--tint-amber-ln)" : "var(--ln2)"}`, background: isArsip ? "var(--tint-amber-bg)" : "var(--card)" }}
              >
                <div>
                  <h2 className="text-sm font-semibold" style={{ color: isArsip ? "var(--st-amber2)" : "var(--dtn)" }}>
                    {isArsip
                      ? arsipStep === "konfirmasi"
                        ? "Konfirmasi Arsip KGB"
                        : "Arsip KGB Historis"
                      : "Input KGB Baru"}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: isArsip ? "var(--st-amber)" : "var(--dt4)" }}>
                    {isArsip
                      ? selectedPegawai
                        ? `${selectedPegawai.nama} · ${selectedPegawai.nip}`
                        : "Input SK lama untuk mencatat riwayat historis"
                      : "Kalkulasi otomatis dari data pegawai"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetModal();
                  }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
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

              {/* Cari Pegawai : sticky, tidak ikut scroll; disembunyikan di mode arsip (sudah terpilih dari tabel) */}
              <div className="shrink-0 px-6 py-4" style={{ borderBottom: "1px solid var(--ln2)", display: isArsip ? "none" : undefined }}>
                <label
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--dt2)" }}
                >
                  Cari & Pilih Pegawai
                </label>
                <input
                  type="text"
                  placeholder="Ketik nama atau NIP..."
                  value={pegawaiSearch}
                  onChange={(e) => {
                    setPegawaiSearch(e.target.value);
                    setSelectedPegawai(null);
                    setPreview(null);
                    fetchPegawai(e.target.value);
                  }}
                  className={inputClass}
                  style={inputStyle}
                />
                {pegawaiList.length > 0 && !selectedPegawai && (
                  <div
                    className="mt-1 bg-white rounded-xl overflow-y-auto"
                    style={{
                      border: "1px solid var(--ln1)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      maxHeight: "240px",
                    }}
                  >
                    {pegawaiList.slice(0, 10).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => pilihPegawai(p)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 transition hover:bg-gray-50"
                        style={{ borderBottom: "1px solid var(--ln2)" }}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                          style={{
                            background: p.statusHukdis ? "var(--tint-red-bg)" : "var(--tint-navy)",
                            color: p.statusHukdis ? "var(--st-red)" : "var(--dtn)",
                          }}
                        >
                          {p.nama
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: "var(--dtn)" }}
                          >
                            {p.nama}
                          </p>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "var(--dt4)" }}
                          >
                            NIP: {p.nip} · {p.golonganRuang}
                            {p.statusHukdis && (
                              <span style={{ color: "var(--st-red)" }}>
                                {" "}· Hukdis
                              </span>
                            )}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Form step : disembunyikan saat konfirmasi aktif */}
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4" style={{ display: arsipStep === "konfirmasi" ? "none" : undefined }}>

                {/* Info pegawai terpilih : full di mode normal, strip ringkas di mode arsip */}
                {selectedPegawai && !isArsip && (
                  <div
                    className="rounded-xl p-3 space-y-2"
                    style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}
                  >
                    <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
                      {selectedPegawai.nama}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "NIP", val: selectedPegawai.nip },
                        { label: "Jabatan", val: selectedPegawai.jabatan },
                        { label: "Golongan", val: selectedPegawai.golonganRuang },
                        { label: "MKG Saat Ini", val: `${selectedPegawai.mkgTahun} Thn ${selectedPegawai.mkgBulan} Bln` },
                        { label: "Gaji Pokok Lama", val: `Rp ${selectedPegawai.gajiPokok.toLocaleString("id-ID")}` },
                        { label: "TMT KGB", val: new Date(selectedPegawai.tmtKgbBerikutnya).toLocaleDateString("id-ID") },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-xs" style={{ color: "var(--dt4)" }}>{item.label}</p>
                          <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{item.val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview kalkulasi : hanya di mode normal */}
                {preview && !isArsip && (
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid var(--tint-green-ln)" }}
                  >
                    <div
                      className="px-4 py-2.5 flex items-center gap-2"
                      style={{ background: "var(--tint-green-bg)" }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0f6e56"
                        strokeWidth="2"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <p
                        className="text-xs font-semibold"
                        style={{ color: "var(--st-green)" }}
                      >
                        Hasil Kalkulasi KGB Engine
                      </p>
                      {preview.flagRapelan && (
                        <span
                          className="ml-auto text-xs px-2 py-0.5 rounded font-bold"
                          style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}
                        >
                          ⚠ RAPELAN
                        </span>
                      )}
                    </div>
                    <div
                      className="px-4 py-3 grid grid-cols-2 gap-3"
                      style={{ background: "var(--tint-green-bg)" }}
                    >
                      {[
                        {
                          label: "MKG Baru",
                          val: `${preview.mkgTahunBaru} Tahun ${preview.mkgBulanBaru} Bulan`,
                        },
                        {
                          label: "Gaji Pokok Baru",
                          val: `Rp ${preview.gajiPokokBaru.toLocaleString("id-ID")}`,
                        },
                        {
                          label: "TMT KGB Baru",
                          val: new Date(preview.tmtKgbBaru).toLocaleDateString(
                            "id-ID",
                            { day: "numeric", month: "long", year: "numeric" },
                          ),
                        },
                        {
                          label: "TMT KGB Berikutnya",
                          val: new Date(
                            preview.tmtKgbBerikutnya,
                          ).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }),
                        },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-xs" style={{ color: "#5dcaa5" }}>
                            {item.label}
                          </p>
                          <p
                            className="text-xs font-semibold"
                            style={{ color: "#085041" }}
                          >
                            {item.val}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Form SK */}
                {selectedPegawai && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-3">
                      <span
                        className="text-xs font-semibold"
                        style={{ color: isArsip ? "var(--st-amber2)" : "var(--dt5)", letterSpacing: "0.07em" }}
                      >
                        {isArsip ? "Data SK Arsip (historis)" : "Data SK"}
                      </span>
                      <div className="flex-1 h-px" style={{ background: isArsip ? "var(--tint-amber-ln)" : "var(--ln2)" }} />
                      {isArsip && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--tint-amber-bg2)", color: "var(--st-amber)", fontSize: "10px" }}>
                          dari dokumen SK lama
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--dt2)" }}>
                        Nomor SK {isArsip ? "Lama" : "Terakhir"}
                      </label>
                      <input
                        className={inputClass}
                        style={inputStyle}
                        placeholder={isArsip ? "Nomor SK dari dokumen fisik arsip" : "misal: W.19-229.KP.04.05 TAHUN 2024"}
                        value={form.nomorSK}
                        onChange={(e) => setForm((p) => ({ ...p, nomorSK: e.target.value }))}
                      />
                    </div>
                    {isArsip && (
                      <p className="text-xs px-3 py-2 rounded-lg" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "1px solid var(--tint-amber-ln)" }}>
                        Isi tanggal sesuai dokumen SK fisik yang lama
                      </p>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "var(--dt2)" }}>
                          Tanggal SK
                        </label>
                        <input
                          type="date"
                          className={inputClass}
                          style={dateInputStyle}
                          value={form.tanggalSK}
                          onChange={(e) => setForm((p) => ({ ...p, tanggalSK: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "var(--dt2)" }}>
                          Mulai Berlaku (TMT)
                        </label>
                        <input
                          type="date"
                          className={inputClass}
                          style={dateInputStyle}
                          value={form.tmtSK}
                          onChange={(e) => setForm((p) => ({ ...p, tmtSK: e.target.value }))}
                        />
                        <p className="text-xs mt-1" style={{ color: "var(--dt5)" }}>Tanggal gaji baru mulai berlaku</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* -- Toggle Arsip Historis : hanya di mode normal -- */}
                {selectedPegawai && !isArsip && (() => {
                  return (
                    <button
                      type="button"
                      onClick={() => setIsArsip(true)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
                      style={{ background: "var(--sub)", border: "1px solid var(--ln2)", cursor: "pointer" }}
                    >
                      <div className="flex items-center gap-2 text-left">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8a9eb5" strokeWidth="2">
                          <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
                        </svg>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "#6a8aaa" }}>Mode Arsip</p>
                          <p className="text-xs" style={{ color: "var(--dt5)", fontSize: "10px" }}>Untuk KGB yang sudah diproses sebelum sistem ini ada</p>
                        </div>
                      </div>
                      <div className="relative shrink-0 rounded-full" style={{ width: "32px", height: "18px", background: "var(--ln0)" }}>
                        <div className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm" style={{ transform: "translateX(2px)" }} />
                      </div>
                    </button>
                  );
                })()}

                {/* -- Hasil kalkulasi ringkas : hanya di mode arsip -- */}
                {isArsip && preview && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "var(--tint-green-bg)", border: "1px solid var(--tint-green-ln)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs" style={{ color: "#5dcaa5", fontSize: "10px" }}>Gaji Baru</p>
                        <p className="text-xs font-semibold" style={{ color: "#085041" }}>Rp {preview.gajiPokokBaru.toLocaleString("id-ID")}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "#5dcaa5", fontSize: "10px" }}>MKG Baru</p>
                        <p className="text-xs font-semibold" style={{ color: "#085041" }}>{preview.mkgTahunBaru} Thn {preview.mkgBulanBaru} Bln</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "#5dcaa5", fontSize: "10px" }}>KGB Berikutnya</p>
                        <p className="text-xs font-semibold" style={{ color: "#085041" }}>{new Date(preview.tmtKgbBerikutnya).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div
                    className="rounded-lg px-3 py-2.5 text-xs"
                    style={{
                      background: "var(--tint-red-bg)",
                      color: "var(--st-red)",
                      border: "1px solid var(--tint-red-ln)",
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>

              {/* -- Step Konfirmasi Arsip : scrollable, menggantikan form step -- */}
              {arsipStep === "konfirmasi" && preview && selectedPegawai && (
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-3">
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--tint-amber-ln)" }}>
                    {/* Header konfirmasi */}
                    <div className="px-4 py-3 flex items-center gap-2" style={{ background: "var(--tint-amber-bg)" }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92600a" strokeWidth="2">
                        <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
                      </svg>
                      <p className="text-xs font-bold" style={{ color: "var(--st-amber2)" }}>Konfirmasi Arsip KGB</p>
                    </div>

                    {/* Ringkasan kalkulasi */}
                    <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-2.5" style={{ borderBottom: "1px solid var(--tint-amber-bg2)" }}>
                      {[
                        { label: "Pegawai", val: selectedPegawai.nama },
                        { label: "NIP", val: selectedPegawai.nip },
                        { label: "Nomor SK", val: form.nomorSK },
                        { label: "TMT SK", val: form.tmtSK ? new Date(form.tmtSK).toLocaleDateString("id-ID") : "-" },
                        { label: "Gaji Lama", val: `Rp ${selectedPegawai.gajiPokok.toLocaleString("id-ID")}` },
                        { label: "Gaji Baru", val: `Rp ${preview.gajiPokokBaru.toLocaleString("id-ID")}` },
                        { label: "MKG Baru", val: `${preview.mkgTahunBaru} Thn ${preview.mkgBulanBaru} Bln` },
                        { label: "KGB Berikutnya", val: new Date(preview.tmtKgbBerikutnya).toLocaleDateString("id-ID") },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-xs" style={{ color: "#a0855a", fontSize: "10px" }}>{item.label}</p>
                          <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{item.val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Upload SK fisik */}
                    <div className="px-4 py-3">
                      <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--st-amber2)" }}>
                        Upload SK Fisik <span style={{ color: "var(--st-amber)", fontWeight: 400 }}>(opsional tapi disarankan)</span>
                      </p>
                      <label
                        className="flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition"
                        style={{
                          background: arsipFile ? "var(--tint-amber-bg)" : "var(--sub)",
                          border: `1px dashed ${arsipFile ? "#f59e0b" : "var(--ln0)"}`,
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={arsipFile ? "var(--st-amber2)" : "var(--dt4)"} strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <span className="text-xs flex-1 truncate" style={{ color: arsipFile ? "var(--st-amber2)" : "var(--dt4)" }}>
                          {arsipFile ? arsipFile.name : "Pilih file SK PDF..."}
                        </span>
                        {arsipFile && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); setArsipFile(null); }}
                            className="text-xs shrink-0"
                            style={{ color: "var(--st-amber)" }}
                          >✕</button>
                        )}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) setArsipFile(f); e.target.value = ""; }}
                        />
                      </label>

                      {/* Preview PDF */}
                      {arsipFileUrl && (
                        <div className="mt-2 rounded-lg overflow-hidden" style={{ border: "1px solid var(--tint-amber-ln)" }}>
                          <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "var(--tint-amber-bg)", borderBottom: "1px solid var(--tint-amber-ln)" }}>
                            <span className="text-xs font-medium" style={{ color: "var(--st-amber2)" }}>
                              Preview SK: {arsipFile?.name}
                            </span>
                            <a
                              href={arsipFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline"
                              style={{ color: "var(--st-amber)" }}
                            >
                              Buka tab baru
                            </a>
                          </div>
                          <iframe
                            src={arsipFileUrl}
                            className="w-full"
                            style={{ height: "240px", border: "none" }}
                            title="Preview SK"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div
                className="flex gap-2 px-6 py-4 shrink-0"
                style={{ borderTop: "1px solid var(--ln2)" }}
              >
                <button
                  onClick={() => {
                    if (arsipStep === "konfirmasi") {
                      setArsipStep("form");
                    } else {
                      setShowModal(false);
                      resetModal();
                    }
                  }}
                  className="flex-1 text-xs py-2.5 rounded-xl"
                  style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
                >
                  {arsipStep === "konfirmasi" ? "← Kembali" : "Batal"}
                </button>
                <button
                  onClick={arsipStep === "konfirmasi" ? handleKonfirmasiArsip : handleSubmit}
                  disabled={submitting || !selectedPegawai}
                  className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{ background: isArsip ? "var(--amber-solid)" : "var(--navy-solid)" }}
                >
                  {submitting
                    ? "Menyimpan..."
                    : arsipStep === "konfirmasi"
                    ? `Konfirmasi & Arsipkan${arsipFile ? " + Upload SK" : ""}`
                    : isArsip
                    ? "Review & Konfirmasi →"
                    : "Simpan KGB"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* -- MODAL DETAIL KGB -- */}
      {showDetail && (
        <>
          <div style={overlayStyle} onClick={() => setShowDetail(null)} />
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
              className="bg-white rounded-2xl w-full overflow-hidden flex flex-col"
              style={{ maxWidth: "480px", maxHeight: "92vh", zIndex: 51, animation: "kgbModalIn 0.38s cubic-bezier(0.34, 1.4, 0.64, 1) both" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="flex items-center justify-between px-6 py-4 shrink-0"
                style={{ borderBottom: "1px solid var(--ln2)" }}
              >
                <div>
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: "var(--dtn)" }}
                  >
                    Detail KGB
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
                    {showDetail.pegawai.nama}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {showDetail.flagRapelan && showDetail.status !== "selesai" && showDetail.status !== "ditolak" && (
                    <span
                      className="text-xs px-2 py-1 rounded-full font-bold"
                      style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)" }}
                    >
                      RAPELAN
                    </span>
                  )}
                  <button
                    onClick={() => setShowDetail(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
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
              </div>

              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                {/* Status badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const st = STATUS_CONFIG[showDetail.status] || STATUS_CONFIG.belum_diproses;
                    return (
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    );
                  })()}
                  {showDetail.status === "belum_diproses" && showDetail.nomorSK === "" && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "var(--ln2)", color: "var(--dt4)", fontSize: "10px" }}>
                      Antrean Otomatis
                    </span>
                  )}
                  {showDetail.createdAt && (
                    <span className="text-xs ml-auto" style={{ color: "var(--dt5)" }}>
                      Dibuat {new Date(showDetail.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>

                {/* Info Pegawai */}
                <div
                  className="grid grid-cols-2 gap-3 p-3 rounded-xl"
                  style={{ background: "var(--sub)" }}
                >
                  {[
                    { label: "NIP", val: showDetail.pegawai.nip },
                    { label: "Jabatan", val: showDetail.pegawai.jabatan },
                    { label: "Unit Kerja", val: showDetail.pegawai.unitKerja },
                    { label: "Nomor SK", val: showDetail.nomorSK || "-" },
                    {
                      label: "Tanggal SK",
                      val: showDetail.tanggalSK
                        ? new Date(showDetail.tanggalSK).toLocaleDateString("id-ID")
                        : "-",
                    },
                    {
                      label: "Mulai Berlaku Gaji",
                      val: showDetail.tmtSK
                        ? new Date(showDetail.tmtSK).toLocaleDateString("id-ID")
                        : "-",
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xs" style={{ color: "var(--dt4)" }}>
                        {item.label}
                      </p>
                      <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>
                        {item.val}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Perbandingan Gaji */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
                    <p className="text-xs mb-2 font-semibold" style={{ color: "var(--st-amber)" }}>Sebelum KGB</p>
                    <p className="text-xs" style={{ color: "var(--dt4)" }}>Golongan: {showDetail.golonganLama}</p>
                    <p className="text-xs" style={{ color: "var(--dt4)" }}>MKG: {showDetail.mkgTahunLama} Thn {showDetail.mkgBulanLama} Bln</p>
                    <p className="text-xs font-semibold mt-1" style={{ color: "var(--st-amber)" }}>
                      Rp {showDetail.gajiPokokLama.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: "var(--tint-green-bg)", border: "1px solid var(--tint-green-ln)" }}>
                    <p className="text-xs mb-2 font-semibold" style={{ color: "var(--st-green)" }}>Setelah KGB</p>
                    <p className="text-xs" style={{ color: "var(--dt4)" }}>Golongan: {showDetail.golonganBaru}</p>
                    <p className="text-xs" style={{ color: "var(--dt4)" }}>MKG: {showDetail.mkgTahunBaru ?? "-"} Thn {showDetail.mkgBulanBaru ?? "-"} Bln</p>
                    <p className="text-xs font-semibold mt-1" style={{ color: "var(--st-green)" }}>
                      {showDetail.gajiPokokBaru != null ? `Rp ${showDetail.gajiPokokBaru.toLocaleString("id-ID")}` : "-"}
                    </p>
                  </div>
                </div>

                {/* Selisih kenaikan */}
                {(() => {
                  const selisih = (showDetail.gajiPokokBaru ?? 0) - showDetail.gajiPokokLama;
                  return (
                    <div
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: selisih > 0 ? "var(--tint-green-bg)" : "var(--sub)", border: `0.5px solid ${selisih > 0 ? "var(--tint-green-ln)" : "var(--ln1)"}` }}
                    >
                      <p className="text-xs" style={{ color: "var(--dt4)" }}>Kenaikan Gaji Pokok</p>
                      <p className="text-xs font-bold" style={{ color: selisih > 0 ? "var(--st-green)" : "var(--dt4)" }}>
                        {selisih > 0 ? `+ Rp ${selisih.toLocaleString("id-ID")}` : "Tidak ada kenaikan"}
                      </p>
                    </div>
                  );
                })()}

                {/* TMT */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs" style={{ color: "var(--dt4)" }}>
                      TMT KGB Baru
                    </p>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--dtn)" }}
                    >
                      {new Date(showDetail.tmtKgbBaru).toLocaleDateString(
                        "id-ID",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: "var(--dt4)" }}>
                      TMT KGB Berikutnya
                    </p>
                    <p
                      className="text-xs font-medium"
                      style={{ color: "var(--dtn)" }}
                    >
                      {new Date(showDetail.tmtKgbBerikutnya).toLocaleDateString(
                        "id-ID",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}
                    </p>
                  </div>
                </div>

                {/* Aksi : Tolak */}
                {showDetail.status !== "selesai" && showDetail.status !== "ditolak" && (
                  <div className="space-y-2">
                    {/* Belum generate surat */}
                    {showDetail.status === "belum_diproses" && (() => {
                      const tahunTmt = new Date(showDetail.tmtKgbBaru).getFullYear();
                      const terkunci = showDetail.isLocked ?? false;
                      const unlockLabel = showDetail.unlockDate
                        ? new Date(showDetail.unlockDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                        : "";
                      const deadlineLabel = (() => {
                        const tmt = new Date(showDetail.tmtKgbBaru);
                        const d = new Date(tmt.getFullYear(), tmt.getMonth() - 1, 0);
                        return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
                      })();

                      // TMT masa lalu + rapelan → tampilkan panel Arsipkan, bukan Generate
                      if (showDetail.flagRapelan && !terkunci) {
                        return (
                          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--tint-amber-ln)" }}>
                            <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: "var(--tint-amber-bg)" }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92600a" strokeWidth="2">
                                <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
                              </svg>
                              <p className="text-xs font-semibold" style={{ color: "var(--st-amber2)" }}>KGB Arsip: TMT {tahunTmt}</p>
                            </div>
                            <div className="px-3 py-2.5" style={{ background: "var(--card)" }}>
                              <p className="text-xs mb-2.5" style={{ color: "var(--dt4)" }}>
                                KGB ini belum diproses dan TMT-nya sudah lewat. Masukkan data SK lama untuk mengarsipkan dan melanjutkan ke KGB berikutnya.
                              </p>
                              <button
                                onClick={() => {
                                  setShowDetail(null);
                                  handleArsipkan(showDetail);
                                }}
                                className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg font-semibold transition"
                                style={{ background: "var(--amber-solid)", color: "#fff" }}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
                                </svg>
                                Input & Arsipkan KGB {tahunTmt}
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <>
                          {terkunci ? (
                            <div
                              className="rounded-lg px-3 py-2.5 space-y-1 text-xs"
                              style={{ background: "var(--ln2)", border: "0.5px solid var(--ln0)", color: "var(--dt4)" }}
                            >
                              <div className="flex items-center gap-2">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <span>Jendela proses belum dibuka</span>
                              </div>
                              {unlockLabel && (
                                <p className="pl-5">Dibuka: <strong style={{ color: "var(--dtn)" }}>{unlockLabel}</strong></p>
                              )}
                              <p className="pl-5">Deadline: <strong style={{ color: "var(--dtn)" }}>{deadlineLabel}</strong></p>
                            </div>
                          ) : (
                            <Link
                              href={`/dashboard/kgb/${showDetail.id!}/generate`}
                              onClick={() => setShowDetail(null)}
                              className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg font-semibold text-white transition"
                              style={{ background: "var(--navy-solid)" }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              Generate Surat SK
                            </Link>
                          )}
                        </>
                      );
                    })()}

                    {/* Sedang diproses : upload SK langsung dari modal */}
                    {showDetail.status === "sedang_diproses" && (
                      <label
                        className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg font-semibold cursor-pointer transition"
                        style={{
                          background: uploadingFile && confirmUpload?.kgbId === showDetail.id! ? "var(--ln1)" : "var(--navy-solid)",
                          color: "#fff",
                          opacity: uploadingFile && confirmUpload?.kgbId === showDetail.id! ? 0.7 : 1,
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        {uploadingFile && confirmUpload?.kgbId === showDetail.id! ? "Mengupload..." : "Upload SK Tertandatangani"}
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={uploadingFile}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setConfirmUpload({ kgbId: showDetail.id!, file, nama: showDetail.pegawai.nama });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}

                    {/* Menunggu keuangan : info banner */}
                    {showDetail.status === "menunggu_keuangan" && (
                      <div className="space-y-2">
                        <div
                          className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                          style={{ background: "var(--tint-violet-bg)", border: "1px solid var(--tint-violet-ln)" }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6d28d9" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                          <p className="text-xs font-semibold" style={{ color: "var(--st-violet)" }}>
                            Menunggu Konfirmasi Keuangan
                          </p>
                        </div>
                        {showDetail.surat?.pathFile && (
                          <a
                            href={`/api/blob/download?url=${encodeURIComponent(showDetail.surat.pathFile)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg font-medium transition hover:opacity-80"
                            style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "1px solid var(--ln0)" }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            Lihat SK Tertandatangani
                          </a>
                        )}
                      </div>
                    )}

                    {/* Toggle Rapelan */}
                    <button
                      onClick={async () => {
                        const newFlag = !showDetail.flagRapelan;
                        await fetch(`/api/kgb/${showDetail.id!}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ flagRapelan: newFlag }),
                        });
                        setShowDetail((prev) => prev ? { ...prev, flagRapelan: newFlag } : prev);
                        setKgbList((prev) => prev.map((k) => k.id === showDetail.id ? { ...k, flagRapelan: newFlag } : k));
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition"
                      style={{
                        background: showDetail.flagRapelan ? "var(--tint-amber-bg)" : "var(--sub)",
                        border: `1px solid ${showDetail.flagRapelan ? "var(--tint-amber-ln)" : "var(--ln2)"}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: showDetail.flagRapelan ? "#f59e0b" : "var(--ln0)" }} />
                        <span className="text-xs" style={{ color: showDetail.flagRapelan ? "var(--st-amber2)" : "var(--dt4)" }}>
                          Tandai Rapelan
                        </span>
                        {showDetail.flagRapelan && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--tint-amber-bg2)", color: "var(--st-amber)", fontSize: "9px" }}>AKTIF</span>
                        )}
                      </div>
                      {/* Switch visual */}
                      <div className="relative w-8 h-4.5 rounded-full shrink-0 transition-colors" style={{ background: showDetail.flagRapelan ? "#f59e0b" : "var(--ln0)", width: "32px", height: "18px" }}>
                        <div className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform" style={{ transform: showDetail.flagRapelan ? "translateX(15px)" : "translateX(2px)" }} />
                      </div>
                    </button>

                    {/* Batalkan & Koreksi : danger link */}
                    <button
                      onClick={() => setShowTolak(showDetail)}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs transition hover:opacity-80"
                      style={{ color: "var(--st-red)", border: "1px dashed var(--tint-red-ln)", background: "transparent" }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Batalkan &amp; Koreksi
                    </button>
                  </div>
                )}

                {/* Status selesai */}
                {showDetail.status === "selesai" && (
                  <div className="space-y-2">
                    <div
                      className="rounded-xl px-3 py-2.5 flex items-center gap-2"
                      style={{ background: "var(--tint-green-bg)", border: "1px solid var(--tint-green-ln)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <p className="text-xs font-semibold" style={{ color: "var(--st-green)" }}>
                        KGB Selesai
                      </p>
                    </div>
                    {/* Tombol koreksi arsip : muncul hanya jika flagRapelan masih true */}
                    {showDetail.flagRapelan && showDetail.id && (
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/kgb/${showDetail.id}/fix-arsip`, { method: "PATCH" });
                          if (res.ok) {
                            setShowDetail((prev) => prev ? { ...prev, flagRapelan: false } : prev);
                            setKgbList((prev) => prev.map((k) => k.id === showDetail.id ? { ...k, flagRapelan: false } : k));
                            fetchSummary();
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-xl font-semibold transition hover:brightness-95"
                        style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", border: "1px solid var(--tint-amber-ln)" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
                        </svg>
                        Koreksi sebagai Arsip Historis
                      </button>
                    )}
                  </div>
                )}

                {/* Status dibatalkan */}
                {showDetail.status === "ditolak" && (
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--tint-red-ln)" }}>
                    <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: "var(--tint-red-bg)" }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      <p className="text-xs font-semibold flex-1" style={{ color: "var(--st-red)" }}>Entri Dibatalkan</p>
                    </div>
                    <div className="px-3 py-2.5" style={{ background: "var(--card)" }}>
                      <p className="text-xs mb-2.5" style={{ color: "var(--dt4)" }}>
                        Entri ini dibatalkan untuk koreksi data. Klik tombol di bawah untuk input ulang, data pegawai sudah terisi otomatis.
                      </p>
                      <button
                        onClick={() => {
                          setShowDetail(null);
                          handleInputUlang(showDetail);
                        }}
                        className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg font-semibold transition"
                        style={{ background: "var(--navy-solid)", color: "#fff" }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Input KGB Ulang untuk {showDetail.pegawai.nama.split(" ")[0]}
                      </button>
                    </div>
                  </div>
                )}

                {/* Surat */}
                {showDetail.surat ? (
                  <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid var(--tint-green-ln)" }}
                  >
                    <div
                      className="px-3 py-2.5 flex items-center gap-2"
                      style={{ background: "var(--tint-green-bg)" }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#0f6e56"
                        strokeWidth="2"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <div className="flex-1">
                        <p
                          className="text-xs font-semibold"
                          style={{ color: "var(--st-green)" }}
                        >
                          Surat sudah digenerate
                        </p>
                        <p className="text-xs" style={{ color: "#5dcaa5" }}>
                          No. {showDetail.surat.nomorSurat}
                        </p>
                      </div>
                    </div>
                    {showDetail.surat?.pathFile && (
                      <div
                        className="px-3 py-2.5 flex items-center gap-2"
                        style={{ background: "var(--tint-green-bg)", borderTop: "0.5px solid var(--tint-green-ln)" }}
                      >
                        <a
                          href={`/api/blob/download?url=${encodeURIComponent(showDetail.surat.pathFile)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition"
                          style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "0.5px solid var(--tint-green-ln)" }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Unduh Draft Surat
                        </a>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}

      {/* -- MODAL KONFIRMASI UPLOAD SK -- */}
      {confirmUpload && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 58,
              background: "rgba(10,25,45,0.55)",
              backdropFilter: "blur(8px)",
            }}
            onClick={() => setConfirmUpload(null)}
          />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div
              className="bg-white rounded-2xl p-6 w-full"
              style={{ maxWidth: "380px", zIndex: 61 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
                style={{ background: "var(--tint-green-bg)" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>
                Konfirmasi Upload SK
              </h2>
              <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--dt4)" }}>
                Upload SK tertandatangani untuk KGB{" "}
                <strong style={{ color: "var(--dtn)" }}>{confirmUpload.nama}</strong>?
                Status KGB akan berubah ke <strong style={{ color: "var(--st-violet)" }}>Menunggu Keuangan</strong>. Tim keuangan akan mengkonfirmasi untuk menyelesaikannya.
              </p>
              <div
                className="rounded-lg px-3 py-2 mb-4 flex items-center gap-2"
                style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8a9eb5" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="text-xs truncate" style={{ color: "var(--dt4)" }}>
                  {confirmUpload.file.name}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmUpload(null)}
                  className="flex-1 text-xs py-2.5 rounded-xl"
                  style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleUploadSK}
                  disabled={uploadingFile}
                  className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--green-solid)" }}
                >
                  {uploadingFile ? "Mengupload..." : "Ya, Upload SK"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* -- MODAL BATALKAN & KOREKSI -- */}
      {showTolak && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 58,
              background: "rgba(10,25,45,0.55)",
              backdropFilter: "blur(8px)",
            }}
            onClick={() => setShowTolak(null)}
          />
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1rem",
            }}
          >
            <div
              className="bg-white rounded-2xl p-6 w-full"
              style={{ maxWidth: "380px", zIndex: 61 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>

              <h2
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--dtn)" }}
              >
                Batalkan &amp; Koreksi Data?
              </h2>
              <p className="text-xs mb-4" style={{ color: "var(--dt4)" }}>
                Entri KGB{" "}
                <strong style={{ color: "var(--dtn)" }}>
                  {showTolak.pegawai.nama}
                </strong>{" "}
                akan dibatalkan. Setelah ini gunakan <strong style={{ color: "var(--dtn)" }}>Input Ulang</strong> untuk memasukkan data yang benar.
              </p>

              <div className="mb-4">
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--dt2)" }}
                >
                  Alasan Pembatalan
                </label>
                <textarea
                  className="w-full rounded-lg px-3 py-2 text-xs outline-none"
                  style={{
                    border: "1px solid var(--tint-red-ln)",
                    background: "var(--tint-red-bg)",
                    color: "var(--dtn)",
                    resize: "none",
                  }}
                  rows={2}
                  placeholder="misal: Salah input golongan / TMT / NIP"
                  value={alasanTolak}
                  onChange={(e) => setAlasanTolak(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowTolak(null)}
                  className="flex-1 text-xs py-2.5 rounded-xl"
                  style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
                >
                  Kembali
                </button>
                <button
                  onClick={handleTolak}
                  disabled={submittingAction}
                  className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--red-solid)" }}
                >
                  {submittingAction ? "Memproses..." : "Batalkan Entri"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
