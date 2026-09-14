"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { canManageHukdis } from "@/lib/auth";
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
  tanggalHukdisBerakhir: string | null;
}

interface RiwayatKGB {
  id: string;
  nomorSK: string;
  tanggalSK: string;
  tmtSK: string;
  golonganLama: string;
  gajiPokokLama: number;
  mkgTahunLama: number;
  mkgBulanLama: number;
  golonganBaru: string;
  gajiPokokBaru: number;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  tmtKgbBaru: string;
  tmtKgbBerikutnya: string;
  status: string;
  flagRapelan: boolean;
  isArsip: boolean;
  createdAt: string;
  surat: { nomorSurat: string; pathFile?: string | null } | null;
  alasanBatal?: string | null;
}

interface RiwayatHukdis {
  id: string;
  jenisHukdis: string;
  nomorSK: string;
  tanggalSK: string;
  tmtMulai: string;
  tmtBerakhir: string;
  berdampakKGB: boolean;
  durasiTunda: number | null;
  keterangan: string | null;
  createdAt: string;
}

interface HukdisJenisKonfig {
  id: string;
  kode: string;
  label: string;
  kategori: string;
  durasiHukdis: number;
  berdampakKGB: boolean;
  durasiTunda: number | null;
  dasarHukum: string | null;
  aktif: boolean;
}

const FALLBACK_LABELS: Record<string, string> = {
  teguran_lisan:               "Teguran Lisan",
  teguran_tertulis:            "Teguran Tertulis",
  pernyataan_tidak_puas:       "Pernyataan Tidak Puas",
  penundaan_kgb:               "Penundaan KGB",
  penurunan_gaji_pokok:        "Penurunan Gaji Pokok",
  penundaan_kenaikan_pangkat:  "Penundaan Kenaikan Pangkat",
  penurunan_pangkat:           "Penurunan Pangkat",
  pembebasan_jabatan:          "Pembebasan Jabatan",
  pemberhentian_dengan_hormat: "Pemberhentian Dengan Hormat",
  pemberhentian_tidak_hormat:  "Pemberhentian Tidak Hormat",
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  belum_diproses: { label: "Belum Diproses", bg: "var(--tint-amber-bg)", color: "var(--st-amber)" },
  sedang_diproses: { label: "Sedang Diproses", bg: "var(--tint-navy)", color: "var(--dtn)" },
  selesai: { label: "Selesai", bg: "var(--tint-green-bg)", color: "var(--st-green)" },
  ditolak: { label: "Ditolak", bg: "var(--tint-red-bg)", color: "var(--st-red)" },
};

const HUKDIS_FORM_INIT = {
  jenisHukdis: "",
  nomorSK: "",
  tanggalSK: "",
  tmtMulai: "",
  tmtBerakhir: "",
  dasarHukum: "",
  keterangan: "",
};

export default function RiwayatKGBPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = useRole();
  const canHukdis = canManageHukdis(role);

  const [pegawai, setPegawai] = useState<Pegawai | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatKGB[]>([]);
  const [hukdisList, setHukdisList] = useState<RiwayatHukdis[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"kgb" | "hukdis">("kgb");

  // KGB popup state
  const [showKgbPopup, setShowKgbPopup] = useState(false);

  // Hukdis modal state
  const [showHukdisModal, setShowHukdisModal] = useState(false);
  const [hukdisForm, setHukdisForm] = useState(HUKDIS_FORM_INIT);
  const [savingHukdis, setSavingHukdis] = useState(false);
  const [hukdisError, setHukdisError] = useState("");
  const [deletingHukdisId, setDeletingHukdisId] = useState<string | null>(null);
  const [jenisKonfig, setJenisKonfig] = useState<HukdisJenisKonfig[]>([]);

  useEffect(() => {
    if (!canHukdis) return;
    fetch("/api/hukdis/konfigurasi")
      .then((r) => r.json() as any)
      .then((d) => {
        const aktif: HukdisJenisKonfig[] = (d.jenis ?? []).filter((j: HukdisJenisKonfig) => j.aktif);
        setJenisKonfig(aktif);
        setHukdisForm((f) => ({ ...f, jenisHukdis: aktif[0]?.kode ?? "" }));
      })
      .catch(() => {});
  }, [canHukdis]);

  function getJenisLabel(kode: string): string {
    return jenisKonfig.find((j) => j.kode === kode)?.label ?? FALLBACK_LABELS[kode] ?? kode;
  }

  function handleJenisChange(kode: string) {
    const jenis = jenisKonfig.find((j) => j.kode === kode);
    setHukdisForm((f) => {
      let tmtBerakhir = f.tmtBerakhir;
      if (jenis && jenis.durasiHukdis > 0 && f.tmtMulai) {
        const mulai = new Date(f.tmtMulai);
        mulai.setMonth(mulai.getMonth() + jenis.durasiHukdis);
        mulai.setDate(mulai.getDate() - 1);
        tmtBerakhir = mulai.toISOString().split("T")[0];
      }
      // Dasar hukum default dari jenis (PIC bisa mengubah bila regulasi berbeda)
      const dasarHukum = jenis?.dasarHukum ?? f.dasarHukum;
      return { ...f, jenisHukdis: kode, tmtBerakhir, dasarHukum };
    });
  }

  function handleTmtMulaiChange(val: string) {
    const jenis = jenisKonfig.find((j) => j.kode === hukdisForm.jenisHukdis);
    setHukdisForm((f) => {
      let tmtBerakhir = f.tmtBerakhir;
      if (jenis && jenis.durasiHukdis > 0 && val) {
        const mulai = new Date(val);
        mulai.setMonth(mulai.getMonth() + jenis.durasiHukdis);
        mulai.setDate(mulai.getDate() - 1);
        tmtBerakhir = mulai.toISOString().split("T")[0];
      }
      return { ...f, tmtMulai: val, tmtBerakhir };
    });
  }

  const fetchData = () => {
    setLoading(true);
    const hukdisPromise = canHukdis
      ? fetch(`/api/pegawai/${id}/hukdis`).then((r) => {
          if (!r.ok) return [];
          return r.text().then((t) => {
            try { return t ? JSON.parse(t) : []; } catch { return []; }
          });
        })
      : Promise.resolve([]);

    Promise.all([
      fetch(`/api/pegawai/${id}/riwayat-kgb`).then((r) => r.json() as any),
      hukdisPromise,
    ])
      .then(([kgbData, hukdisData]) => {
        setPegawai(kgbData.pegawai);
        setRiwayat(kgbData.riwayat);
        setHukdisList(Array.isArray(hukdisData) ? hukdisData : []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSaveHukdis = async () => {
    setHukdisError("");
    if (!hukdisForm.nomorSK || !hukdisForm.tanggalSK || !hukdisForm.tmtMulai || !hukdisForm.tmtBerakhir) {
      setHukdisError("Nomor SK, Tanggal SK, TMT Mulai, dan TMT Berakhir wajib diisi.");
      return;
    }
    if (!hukdisForm.keterangan.trim()) {
      setHukdisError("Keterangan wajib diisi. Jelaskan jenis dan detail hukuman disiplin.");
      return;
    }
    setSavingHukdis(true);
    try {
      const res = await fetch(`/api/pegawai/${id}/hukdis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hukdisForm),
      });
      if (!res.ok) {
        const d = await res.json() as any;
        setHukdisError(d.error || "Gagal menyimpan.");
        return;
      }
      setShowHukdisModal(false);
      setHukdisForm(HUKDIS_FORM_INIT);
      fetchData();
    } finally {
      setSavingHukdis(false);
    }
  };

  const handleDeleteHukdis = async (hukdisId: string) => {
    if (!confirm("Hapus data hukdis ini? TMT KGB akan dikembalikan jika ini adalah penundaan KGB.")) return;
    setDeletingHukdisId(hukdisId);
    try {
      await fetch(`/api/hukdis/${hukdisId}`, { method: "DELETE" });
      fetchData();
    } finally {
      setDeletingHukdisId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat data...</p>
      </div>
    );
  }

  if (!pegawai) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-xs" style={{ color: "var(--st-red)" }}>Pegawai tidak ditemukan.</p>
      </div>
    );
  }


  return (
    <div>
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs mb-5 transition"
        style={{ color: "var(--dt4)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Kembali
      </button>

      {/* Profil Pegawai */}
      <div
        className="rounded-2xl p-5 mb-6 flex flex-col sm:flex-row gap-4 sm:items-center"
        style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
          style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}
        >
          {pegawai.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>{pegawai.nama}</h1>
            {pegawai.statusHukdis && (
              <span
                className="text-xs px-2 py-0.5 rounded font-bold"
                style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", fontSize: "9px" }}
              >
                HUKDIS AKTIF
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>NIP: {pegawai.nip}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            {[
              { label: "Jabatan", val: pegawai.jabatan },
              { label: "Pangkat / Gol", val: `${pegawai.pangkat} (${pegawai.golonganRuang})` },
              { label: "Gaji Pokok", val: `Rp ${pegawai.gajiPokok.toLocaleString("id-ID")}` },
              { label: "MKG Sekarang", val: `${pegawai.mkgTahun} Thn ${pegawai.mkgBulan} Bln` },
              {
                label: "TMT KGB Berikutnya",
                val: new Date(pegawai.tmtKgbBerikutnya).toLocaleDateString("id-ID", {
                  day: "numeric", month: "long", year: "numeric",
                }),
              },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs" style={{ color: "var(--dt5)" }}>{item.label}</p>
                <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{item.val}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {canHukdis && (
            <button
              onClick={() => { setShowHukdisModal(true); setHukdisError(""); setHukdisForm(HUKDIS_FORM_INIT); }}
              className="text-xs px-4 py-2 rounded-xl font-semibold"
              style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }}
            >
              + Hukdis
            </button>
          )}
          <button
            onClick={() => setShowKgbPopup(true)}
            className="shrink-0 text-xs px-4 py-2 rounded-xl font-semibold"
            style={{ background: "var(--navy-solid)", color: "#fff" }}
          >
            Ke Data KGB
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(["kgb", ...(canHukdis ? ["hukdis"] : [])] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as "kgb" | "hukdis")}
            className="text-xs px-4 py-2 rounded-xl font-semibold transition"
            style={{
              background: activeTab === tab ? "var(--navy-solid)" : "var(--sub)",
              color: activeTab === tab ? "#fff" : "var(--dt4)",
              border: "0.5px solid",
              borderColor: activeTab === tab ? "var(--dtn)" : "var(--ln1)",
            }}
          >
            {tab === "kgb" ? `Riwayat KGB (${riwayat.length})` : `Riwayat Hukdis (${hukdisList.length})`}
          </button>
        ))}
      </div>

      {/* KGB Tab */}
      {activeTab === "kgb" && (
        <div>
          {riwayat.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-16 gap-2"
              style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}
            >
              <p className="text-xs" style={{ color: "var(--dt5)" }}>Belum ada riwayat KGB</p>
            </div>
          ) : (
            <div className="space-y-3">
              {riwayat.map((r, i) => {
                const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.belum_diproses;
                const isPending = r.status === "belum_diproses";
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "var(--card)",
                      border: `0.5px solid ${isPending ? "var(--tint-amber-ln)" : "var(--ln1)"}`,
                    }}
                  >
                    <div
                      className="px-5 py-3 flex items-center justify-between"
                      style={{ background: isPending ? "var(--tint-amber-bg)" : "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: "var(--navy-solid)", color: "#fff" }}
                        >
                          {riwayat.length - i}
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
                            Periode {new Date(r.tmtKgbBaru).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                          </p>
                          <p className="text-xs" style={{ color: "var(--dt4)" }}>
                            Dibuat: {new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.isArsip && (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ background: "var(--tint-amber-bg2)", color: "var(--st-amber)", fontSize: "9px" }}
                          >
                            ARSIP
                          </span>
                        )}
                        {r.flagRapelan && !r.isArsip && (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", fontSize: "9px" }}
                          >
                            RAPELAN
                          </span>
                        )}
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: st.bg, color: st.color }}
                        >
                          {st.label}
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>Golongan</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dt4)" }}>{r.golonganLama}</p>
                        <p className="text-xs font-bold" style={{ color: "var(--dtn)" }}>→ {r.golonganBaru}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>MKG</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dt4)" }}>{r.mkgTahunLama} Thn {r.mkgBulanLama} Bln</p>
                        <p className="text-xs font-bold" style={{ color: "var(--dtn)" }}>→ {r.mkgTahunBaru} Thn {r.mkgBulanBaru} Bln</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>Gaji Pokok</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dt4)" }}>Rp {r.gajiPokokLama.toLocaleString("id-ID")}</p>
                        <p className="text-xs font-bold" style={{ color: "var(--st-green)" }}>→ Rp {r.gajiPokokBaru.toLocaleString("id-ID")}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>TMT Berikutnya</p>
                        <p className="text-xs font-bold" style={{ color: "var(--dtn)" }}>
                          {new Date(r.tmtKgbBerikutnya).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                        {r.nomorSK && (
                          <p className="text-xs mt-1" style={{ color: "var(--dt4)" }}>SK: {r.nomorSK}</p>
                        )}
                      </div>
                    </div>
                    {r.surat && (
                      <div
                        className="px-5 py-2.5 flex items-center justify-between"
                        style={{ borderTop: "0.5px solid var(--ln1)", background: "var(--tint-green-bg)" }}
                      >
                        <p className="text-xs" style={{ color: "#5dcaa5" }}>
                          Surat: {r.surat.nomorSurat}
                        </p>
                        {r.surat.pathFile && (
                          <a
                            href={`/api/blob/download?url=${encodeURIComponent(r.surat.pathFile)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-semibold"
                            style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "0.5px solid var(--tint-green-ln)" }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Unduh SK TTD
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hukdis Tab */}
      {activeTab === "hukdis" && (
        <div>
          {hukdisList.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3"
              style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}
            >
              <p className="text-xs" style={{ color: "var(--dt5)" }}>Tidak ada riwayat hukuman disiplin</p>
              {canHukdis && (
                <button
                  onClick={() => { setShowHukdisModal(true); setHukdisError(""); setHukdisForm(HUKDIS_FORM_INIT); }}
                  className="text-xs px-4 py-2 rounded-xl font-semibold"
                  style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}
                >
                  + Tambah Hukdis
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {hukdisList.map((h) => {
                const isActive = new Date(h.tmtBerakhir) > new Date();
                return (
                  <div
                    key={h.id}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "var(--card)",
                      border: `0.5px solid ${isActive ? "var(--tint-red-ln)" : "var(--ln1)"}`,
                    }}
                  >
                    <div
                      className="px-5 py-3 flex items-center justify-between"
                      style={{ background: isActive ? "var(--tint-red-bg)" : "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "var(--st-red)" }}>
                            {getJenisLabel(h.jenisHukdis)}
                          </p>
                          <p className="text-xs" style={{ color: "var(--dt4)" }}>SK: {h.nomorSK}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.berdampakKGB && (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", fontSize: "9px" }}
                          >
                            TUNDA KGB {h.durasiTunda} BLN
                          </span>
                        )}
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{
                            background: isActive ? "var(--tint-red-bg)" : "var(--sub)",
                            color: isActive ? "var(--st-red)" : "var(--dt4)",
                          }}
                        >
                          {isActive ? "Aktif" : "Selesai"}
                        </span>
                        {canHukdis && (
                          <button
                            onClick={() => handleDeleteHukdis(h.id)}
                            disabled={deletingHukdisId === h.id}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                            style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}
                          >
                            {deletingHukdisId === h.id ? "..." : "Hapus"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>Tanggal SK</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>
                          {new Date(h.tanggalSK).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>Berlaku</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>
                          {new Date(h.tmtMulai).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} s/d{" "}
                          {new Date(h.tmtBerakhir).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      {h.keterangan && (
                        <div>
                          <p className="text-xs" style={{ color: "var(--dt5)" }}>Keterangan</p>
                          <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{h.keterangan}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Popup Data KGB */}
      {showKgbPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowKgbPopup(false); }}
        >
          <div
            className="w-full max-w-lg rounded-2xl flex flex-col"
            style={{ background: "var(--card)", maxHeight: "85dvh", border: "0.5px solid var(--ln1)" }}
          >
            {/* Header */}
            <div
              className="px-5 py-4 flex items-center justify-between rounded-t-2xl"
              style={{ background: "var(--navy-solid)", borderBottom: "0.5px solid #2a4a6c" }}
            >
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "#fff" }}>Data KGB: {pegawai.nama}</h3>
                <p className="text-xs mt-0.5" style={{ color: "#8aacc8" }}>NIP: {pegawai.nip}</p>
              </div>
              <button onClick={() => setShowKgbPopup(false)} className="text-sm" style={{ color: "#8aacc8" }}>✕</button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex flex-col gap-3">
              {riwayat.length === 0 ? (
                <div className="py-12 flex items-center justify-center">
                  <p className="text-xs" style={{ color: "var(--dt5)" }}>Belum ada data KGB</p>
                </div>
              ) : (
                riwayat.map((r, i) => {
                  const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.belum_diproses;
                  const _tmt = new Date(r.tmtKgbBaru);
                  const _deadline = new Date(_tmt.getFullYear(), _tmt.getMonth() - 1, 0);
                  const _now = new Date();
                  const _today = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());
                  const terlambat = r.status !== "selesai" && r.status !== "ditolak" && !r.isArsip && _today > _deadline;
                  const canGenerate = r.status === "belum_diproses" && !r.isArsip;
                  const canUpload = r.status === "sedang_diproses" && !r.isArsip;

                  return (
                    <div
                      key={r.id}
                      className="rounded-xl overflow-hidden"
                      style={{ border: `0.5px solid ${terlambat ? "var(--tint-amber-ln)" : "var(--ln1)"}` }}
                    >
                      {/* Row header */}
                      <div
                        className="px-4 py-2.5 flex items-center justify-between"
                        style={{ background: terlambat ? "var(--tint-amber-bg)" : "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: "var(--navy-solid)", color: "#fff", fontSize: "10px" }}
                          >
                            {riwayat.length - i}
                          </div>
                          <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
                            Periode {new Date(r.tmtKgbBaru).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {r.isArsip && (
                            <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: "var(--tint-amber-bg2)", color: "var(--st-amber)", fontSize: "9px" }}>ARSIP</span>
                          )}
                          {terlambat && (
                            <span className="text-xs px-2 py-0.5 rounded font-bold" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", fontSize: "9px" }}>TERLAMBAT</span>
                          )}
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        </div>
                      </div>

                      {/* Info grid */}
                      <div className="px-4 py-3 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs" style={{ color: "var(--dt5)" }}>Golongan</p>
                          <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{r.golonganLama} → {r.golonganBaru}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: "var(--dt5)" }}>Gaji Pokok Baru</p>
                          <p className="text-xs font-semibold" style={{ color: "var(--st-green)" }}>Rp {r.gajiPokokBaru.toLocaleString("id-ID")}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: "var(--dt5)" }}>Deadline SDM</p>
                          <p className="text-xs font-semibold" style={{ color: terlambat ? "var(--st-amber)" : "var(--dtn)" }}>
                            {_deadline.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: "var(--dt5)" }}>TMT Berikutnya</p>
                          <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
                            {new Date(r.tmtKgbBerikutnya).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      {r.status === "ditolak" && r.alasanBatal && (
                        <p className="px-4 pb-3 text-xs" style={{ color: "var(--st-red)" }}>
                          Alasan pembatalan: {r.alasanBatal}
                        </p>
                      )}

                      {/* Action buttons */}
                      {(canGenerate || canUpload || r.surat?.pathFile) && (
                        <div
                          className="px-4 py-2.5 flex items-center justify-end gap-2"
                          style={{ borderTop: "0.5px solid var(--ln1)", background: "var(--sub)" }}
                        >
                          {r.surat?.pathFile && (
                            <a
                              href={`/api/blob/download?url=${encodeURIComponent(r.surat.pathFile)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1"
                              style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "0.5px solid var(--tint-green-ln)" }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                              Unduh SK
                            </a>
                          )}
                          {canGenerate && (
                            <Link
                              href={`/dashboard/kgb/${r.id}/generate`}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                              style={{ background: "var(--navy-solid)", color: "#fff" }}
                              onClick={() => setShowKgbPopup(false)}
                            >
                              Generate Surat
                            </Link>
                          )}
                          {canUpload && (
                            <Link
                              href={`/dashboard/kgb/${r.id}/upload-sk`}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                              style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid #c8dff0" }}
                              onClick={() => setShowKgbPopup(false)}
                            >
                              Upload SK TTD
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 flex justify-end" style={{ borderTop: "0.5px solid var(--ln1)" }}>
              <button
                onClick={() => setShowKgbPopup(false)}
                className="text-xs px-4 py-2 rounded-xl font-semibold"
                style={{ background: "var(--sub)", color: "var(--dt4)" }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah Hukdis */}
      {showHukdisModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowHukdisModal(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4"
            style={{ background: "var(--card)", maxHeight: "90dvh", overflowY: "auto" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>Tambah Hukuman Disiplin</h3>
              <button onClick={() => setShowHukdisModal(false)} style={{ color: "var(--dt4)" }}>✕</button>
            </div>

            {hukdisError && (
              <p className="text-xs px-3 py-2 rounded-xl" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>
                {hukdisError}
              </p>
            )}

            <div className="flex flex-col gap-3">

              {/* Jenis Hukdis - dari konfigurasi */}
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                  Jenis Hukuman Disiplin <span style={{ color: "var(--st-red)" }}>*</span>
                </label>
                {jenisKonfig.length === 0 ? (
                  <p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat daftar jenis hukdis...</p>
                ) : (
                  <select
                    value={hukdisForm.jenisHukdis}
                    onChange={(e) => handleJenisChange(e.target.value)}
                    className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                    style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  >
                    {["ringan", "sedang", "berat"].map((kat) => {
                      const items = jenisKonfig.filter((j) => j.kategori === kat);
                      if (!items.length) return null;
                      const katLabel = kat === "ringan" ? "Hukdis Ringan" : kat === "sedang" ? "Hukdis Sedang" : "Hukdis Berat";
                      return (
                        <optgroup key={kat} label={katLabel}>
                          {items.map((j) => (
                            <option key={j.kode} value={j.kode}>{j.label}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                )}

                {/* Info dampak KGB jika berdampakKGB */}
                {(() => {
                  const sel = jenisKonfig.find((j) => j.kode === hukdisForm.jenisHukdis);
                  if (!sel) return null;
                  return sel.berdampakKGB ? (
                    <div className="mt-1.5 rounded-lg px-3 py-2" style={{ background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)" }}>
                      <p className="text-xs font-semibold" style={{ color: "var(--st-red)" }}>
                        Memblokir KGB: TMT KGB digeser +{sel.durasiTunda ?? 12} bulan otomatis
                      </p>
                    </div>
                  ) : sel.durasiHukdis > 0 ? (
                    <div className="mt-1.5 rounded-lg px-3 py-2" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
                      <p className="text-xs" style={{ color: "var(--st-amber2)" }}>
                        Masa berlaku default: {sel.durasiHukdis} bulan. TMT Berakhir diisi otomatis.
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                    Nomor SK <span style={{ color: "var(--st-red)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={hukdisForm.nomorSK}
                    onChange={(e) => setHukdisForm((f) => ({ ...f, nomorSK: e.target.value }))}
                    className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                    style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                    placeholder="Nomor SK Hukdis"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                    Tanggal SK <span style={{ color: "var(--st-red)" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={hukdisForm.tanggalSK}
                    onChange={(e) => setHukdisForm((f) => ({ ...f, tanggalSK: e.target.value }))}
                    className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                    style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>Dasar Hukum / Peraturan</label>
                <input
                  type="text"
                  value={hukdisForm.dasarHukum}
                  onChange={(e) => setHukdisForm((f) => ({ ...f, dasarHukum: e.target.value }))}
                  className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                  style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  placeholder="mis. PP 94 Tahun 2021"
                />
                <p className="text-xs mt-1" style={{ color: "var(--dt5)", fontSize: "10px" }}>Dikunci pada catatan ini (patokan: tanggal SK Hukdis).</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                    TMT Mulai <span style={{ color: "var(--st-red)" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={hukdisForm.tmtMulai}
                    onChange={(e) => handleTmtMulaiChange(e.target.value)}
                    className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                    style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                    TMT Berakhir <span style={{ color: "var(--st-red)" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={hukdisForm.tmtBerakhir}
                    onChange={(e) => setHukdisForm((f) => ({ ...f, tmtBerakhir: e.target.value }))}
                    className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                    style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                  Keterangan <span style={{ color: "var(--st-red)" }}>*</span>
                </label>
                <textarea
                  value={hukdisForm.keterangan}
                  onChange={(e) => setHukdisForm((f) => ({ ...f, keterangan: e.target.value }))}
                  rows={3}
                  className="w-full text-xs rounded-xl px-3 py-2 outline-none resize-none"
                  style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  placeholder="Nomor dan isi SK, dasar pelanggaran, keterangan tambahan..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowHukdisModal(false)}
                className="flex-1 text-xs py-2.5 rounded-xl font-semibold"
                style={{ background: "var(--sub)", color: "var(--dt4)" }}
              >
                Batal
              </button>
              <button
                onClick={handleSaveHukdis}
                disabled={savingHukdis}
                className="flex-1 text-xs py-2.5 rounded-xl font-semibold"
                style={{ background: "var(--red-solid)", color: "#fff" }}
              >
                {savingHukdis ? "Menyimpan..." : "Simpan Hukdis"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
