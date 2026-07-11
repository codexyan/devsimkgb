"use client";

import { useEffect, useState, useCallback } from "react";

/* -------------------------------------------
   Interfaces
   ------------------------------------------- */

interface AuditLogItem {
  id: string;
  waktu: string;
  user: string;
  aksi: string;
  detail: string;
  ipAddress?: string;
  targetNama?: string;
}

interface AuditLogResponse {
  data: AuditLogItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/* -------------------------------------------
   Constants
   ------------------------------------------- */

const AKSI_OPTIONS = [
  { value: "", label: "Semua Aksi" },
  { value: "input_kgb", label: "Input KGB" },
  { value: "generate_surat", label: "Generate Surat" },
  { value: "approve_kgb", label: "Approve KGB" },
  { value: "reject_kgb", label: "Tolak KGB" },
  { value: "serah_terima", label: "Serah Terima" },
  { value: "login", label: "Login" },
  { value: "edit_pegawai", label: "Edit Pegawai" },
  { value: "tambah_pegawai", label: "Tambah Pegawai" },
  { value: "hapus_pegawai", label: "Hapus Pegawai" },
  { value: "import_pegawai", label: "Import Pegawai" },
  { value: "edit_konfigurasi", label: "Edit Konfigurasi" },
];

const AKSI_BADGE_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; icon: React.ReactNode }
> = {
  input_kgb: {
    label: "Input KGB",
    bg: "var(--tint-navy)",
    color: "var(--dtn)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  generate_surat: {
    label: "Generate Surat",
    bg: "var(--tint-green-bg)",
    color: "var(--st-green)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  approve_kgb: {
    label: "Approve KGB",
    bg: "var(--tint-green-bg)",
    color: "var(--st-green)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  reject_kgb: {
    label: "Tolak KGB",
    bg: "var(--tint-red-bg)",
    color: "var(--st-red)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
  serah_terima: {
    label: "Serah Terima",
    bg: "var(--tint-green-bg)",
    color: "var(--st-green)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  login: {
    label: "Login",
    bg: "var(--sub)",
    color: "var(--dt3)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
        <polyline points="10 17 15 12 10 7" />
        <line x1="15" y1="12" x2="3" y2="12" />
      </svg>
    ),
  },
  edit_pegawai: {
    label: "Edit Pegawai",
    bg: "var(--tint-amber-bg)",
    color: "var(--st-amber)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  tambah_pegawai: {
    label: "Tambah Pegawai",
    bg: "var(--tint-navy)",
    color: "var(--dtn)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
  },
  hapus_pegawai: {
    label: "Hapus Pegawai",
    bg: "var(--tint-red-bg)",
    color: "var(--st-red)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
  import_pegawai: {
    label: "Import Pegawai",
    bg: "var(--tint-navy)",
    color: "var(--dtn)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  edit_konfigurasi: {
    label: "Edit Konfigurasi",
    bg: "var(--sub)",
    color: "var(--dt3)",
    icon: (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
};

const PER_PAGE = 15;

/* -------------------------------------------
   Helpers
   ------------------------------------------- */

function formatTanggal(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatWaktu(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAksiBadge(aksi: string) {
  return (
    AKSI_BADGE_CONFIG[aksi] || {
      label: aksi,
      bg: "var(--sub)",
      color: "var(--dt3)",
      icon: (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    }
  );
}

/* -------------------------------------------
   Filter Select Component
   ------------------------------------------- */

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs rounded-xl px-3 py-2 outline-none transition"
      style={{
        border: "1px solid var(--ln1)",
        color: value ? "var(--dtn)" : "var(--dt4)",
        background: "var(--card)",
        minWidth: "140px",
      }}
    >
      {placeholder && (
        <option value="" style={{ color: "var(--dt4)" }}>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/* -------------------------------------------
   Main Page
   ------------------------------------------- */

export default function RiwayatAktivitasPage() {
  const [data, setData] = useState<AuditLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  // Filters
  const [filterAksi, setFilterAksi] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterTanggalDari, setFilterTanggalDari] = useState("");
  const [filterTanggalSampai, setFilterTanggalSampai] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);

  // User list for filter
  const [userList, setUserList] = useState<string[]>([]);

  // Delete state (super admin only)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  const isSuperAdmin = userRole === "superAdminCore";

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("perPage", String(PER_PAGE));
    if (filterAksi) params.set("aksi", filterAksi);
    if (filterUser) params.set("user", filterUser);
    if (filterTanggalDari) params.set("dari", filterTanggalDari);
    if (filterTanggalSampai) params.set("sampai", filterTanggalSampai);
    if (searchQuery) params.set("q", searchQuery);

    fetch(`/api/audit-log?${params.toString()}`)
      .then((r) => r.json() as any)
      .then((d: AuditLogResponse) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [
    page,
    filterAksi,
    filterUser,
    filterTanggalDari,
    filterTanggalSampai,
    searchQuery,
  ]);

  // Fetch user list + session role once
  useEffect(() => {
    fetch("/api/audit-log/users")
      .then((r) => r.json() as any)
      .then((users: string[]) => setUserList(users))
      .catch(() => {});
    fetch("/api/auth/session")
      .then((r) => r.json() as any)
      .then((s) => setUserRole(s?.user?.role || ""))
      .catch(() => {});
  }, []);

  useEffect(() => { const t = setTimeout(fetchData, 0); return () => clearTimeout(t); }, [fetchData]);

  // Reset page when filter changes
  useEffect(() => {
    const t = setTimeout(() => setPage(1), 0);
    return () => clearTimeout(t);
  }, [
    filterAksi,
    filterUser,
    filterTanggalDari,
    filterTanggalSampai,
    searchQuery,
  ]);

  const totalPages = data?.totalPages || 1;
  const items = data?.data || [];
  const total = data?.total || 0;

  function resetFilters() {
    setFilterAksi("");
    setFilterUser("");
    setFilterTanggalDari("");
    setFilterTanggalSampai("");
    setSearchQuery("");
    setPage(1);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const ids = Array.from(selected);
    const res = await fetch("/api/audit-log", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setDeleting(false);
    setConfirmDelete(false);
    setSelected(new Set());
    if (res.ok) {
      const d = await res.json() as any;
      setDeleteMsg(`${d.deleted} entri riwayat berhasil dihapus.`);
      fetchData();
      setTimeout(() => setDeleteMsg(""), 3000);
    }
  }

  const hasFilters =
    filterAksi ||
    filterUser ||
    filterTanggalDari ||
    filterTanggalSampai ||
    searchQuery;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold" style={{ color: "var(--dtn)" }}>
          Riwayat Aktivitas
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
          Log seluruh aktivitas pengguna di sistem SIM-KGB
        </p>
      </div>

      {/* Filters Card */}
      <div
        className="bg-white rounded-2xl p-4"
        style={{ border: "0.5px solid var(--ln1)" }}
      >
        <div className="flex flex-wrap items-end gap-3">
          {/* Search */}
          <div className="flex-1 min-w-50">
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--dt4)" }}
            >
              Cari
            </label>
            <div className="relative">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#8a9eb5"
                strokeWidth="2"
                className="absolute left-3 top-1/2 -translate-y-1/2"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Cari nama pegawai, detail aktivitas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs rounded-xl pl-9 pr-3 py-2 outline-none transition"
                style={{
                  border: "1px solid var(--ln1)",
                  color: "var(--dtn)",
                }}
              />
            </div>
          </div>

          {/* Jenis Aksi */}
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--dt4)" }}
            >
              Jenis Aksi
            </label>
            <FilterSelect
              value={filterAksi}
              onChange={setFilterAksi}
              options={AKSI_OPTIONS}
              placeholder="Semua Aksi"
            />
          </div>

          {/* User */}
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--dt4)" }}
            >
              User
            </label>
            <FilterSelect
              value={filterUser}
              onChange={setFilterUser}
              options={[
                { value: "", label: "Semua User" },
                ...userList.map((u) => ({ value: u, label: u })),
              ]}
              placeholder="Semua User"
            />
          </div>

          {/* Tanggal Dari */}
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--dt4)" }}
            >
              Dari Tanggal
            </label>
            <input
              type="date"
              value={filterTanggalDari}
              onChange={(e) => setFilterTanggalDari(e.target.value)}
              className="text-xs rounded-xl px-3 py-2 outline-none transition"
              style={{
                border: "1px solid var(--ln1)",
                color: filterTanggalDari ? "var(--dtn)" : "var(--dt4)",
                background: "var(--card)",
              }}
            />
          </div>

          {/* Tanggal Sampai */}
          <div>
            <label
              className="text-xs font-medium mb-1.5 block"
              style={{ color: "var(--dt4)" }}
            >
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={filterTanggalSampai}
              onChange={(e) => setFilterTanggalSampai(e.target.value)}
              className="text-xs rounded-xl px-3 py-2 outline-none transition"
              style={{
                border: "1px solid var(--ln1)",
                color: filterTanggalSampai ? "var(--dtn)" : "var(--dt4)",
                background: "var(--card)",
              }}
            />
          </div>

          {/* Reset */}
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-xs px-3 py-2 rounded-xl transition hover:opacity-80"
              style={{ color: "var(--st-red)", background: "var(--tint-red-bg)" }}
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "0.5px solid var(--ln1)" }}
      >
        {/* Table header info */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "0.5px solid var(--ln2)" }}
        >
          <p className="text-xs" style={{ color: "var(--dt4)" }}>
            {loading
              ? "Memuat..."
              : `Menampilkan ${items.length} dari ${total} aktivitas`}
          </p>
          {isSuperAdmin && selected.size > 0 && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
              style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "1px solid var(--tint-red-ln)" }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Hapus {selected.size} Entri
            </button>
          )}
        </div>
        {deleteMsg && (
          <div className="mx-5 mt-3 px-4 py-2.5 rounded-xl text-xs font-medium" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "1px solid var(--tint-green-ln)" }}>
            {deleteMsg}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-xs" style={{ color: "var(--dt4)" }}>
              Memuat riwayat aktivitas...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d0dce8"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>
              Tidak ada aktivitas ditemukan
            </p>
            {hasFilters && (
              <button
                onClick={resetFilters}
                className="text-xs underline"
                style={{ color: "var(--dtn)" }}
              >
                Reset filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}>
                  {isSuperAdmin && (
                    <th className="px-4 py-3 w-9">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded"
                        checked={selected.size === items.length && items.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
                  {["No", "Waktu", "User", "Jenis Aksi", "Detail"].map((h) => (
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
                {items.map((item, i) => {
                  const badge = getAksiBadge(item.aksi);
                  const rowNum = (page - 1) * PER_PAGE + i + 1;
                  const isSelected = selected.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: i < items.length - 1 ? "0.5px solid var(--ln2)" : "none",
                        background: isSelected ? "var(--tint-red-bg)" : undefined,
                      }}
                    >
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.id)}
                          />
                        </td>
                      )}
                      <td
                        className="px-4 py-3 text-xs font-medium"
                        style={{ color: "var(--dt4)" }}
                      >
                        {rowNum}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <p
                          className="text-xs font-medium"
                          style={{ color: "var(--dtn)" }}
                        >
                          {formatTanggal(item.waktu)}
                        </p>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>
                          {formatWaktu(item.waktu)}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{
                              background: "var(--tint-navy)",
                              color: "var(--dtn)",
                            }}
                          >
                            {item.user
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <p
                            className="text-xs font-medium"
                            style={{ color: "var(--dtn)" }}
                          >
                            {item.user}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          <span style={{ color: badge.color }}>
                            {badge.icon}
                          </span>
                          {badge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <p
                          className="text-xs leading-relaxed"
                          style={{ color: "var(--dtn)", maxWidth: "360px" }}
                        >
                          {item.detail}
                        </p>
                        {item.targetNama && (
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: "var(--dt5)" }}
                          >
                            Target: {item.targetNama}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: "0.5px solid var(--ln2)" }}
          >
            <p className="text-xs" style={{ color: "var(--dt4)" }}>
              Halaman {page} dari {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                style={{
                  border: "1px solid var(--ln1)",
                  color: page <= 1 ? "var(--ln0)" : "var(--dtn)",
                  background: "var(--card)",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (totalPages <= 7) return true;
                  if (p === 1 || p === totalPages) return true;
                  if (Math.abs(p - page) <= 1) return true;
                  return false;
                })
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="w-8 h-8 flex items-center justify-center text-xs"
                      style={{ color: "var(--dt4)" }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition"
                      style={{
                        background: page === p ? "var(--navy-solid)" : "var(--card)",
                        color: page === p ? "#fff" : "var(--dt3)",
                        border:
                          page === p
                            ? "1px solid var(--dtn)"
                            : "1px solid var(--ln1)",
                      }}
                    >
                      {p}
                    </button>
                  ),
                )}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                style={{
                  border: "1px solid var(--ln1)",
                  color: page >= totalPages ? "var(--ln0)" : "var(--dtn)",
                  background: "var(--card)",
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Modal konfirmasi hapus : super admin only */}
      {confirmDelete && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 58, background: "rgba(10,25,45,0.5)", backdropFilter: "blur(6px)" }}
            onClick={() => setConfirmDelete(false)}
          />
          <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
            <div className="bg-white rounded-2xl p-6 w-full" style={{ maxWidth: "380px" }} onClick={(e) => e.stopPropagation()}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--tint-red-bg)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>Hapus Riwayat Aktivitas?</h2>
              <p className="text-xs mb-5" style={{ color: "var(--dt4)" }}>
                <strong style={{ color: "var(--st-red)" }}>{selected.size} entri</strong> riwayat akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 text-xs py-2.5 rounded-xl"
                  style={{ border: "0.5px solid var(--ln1)", color: "var(--dt4)" }}
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 text-xs py-2.5 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--red-solid)" }}
                >
                  {deleting ? "Menghapus..." : "Hapus Permanen"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
