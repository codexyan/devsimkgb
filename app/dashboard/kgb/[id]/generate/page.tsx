"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { SARAN_PENETAP_SK } from "@/lib/penetapSk";

interface KGBDetail {
  id: string;
  nomorSK: string;
  tanggalSK: string;
  tmtSK: string;
  penetapSkDasar: string | null;
  pegawai: {
    nama: string;
    nip: string;
    jabatan: string;
    pangkat: string;
    golonganRuang: string;
    unitKerja: string;
  };
  gajiPokokLama: number;
  gajiPokokBaru: number;
  mkgTahunLama: number;
  mkgBulanLama: number;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  golonganBaru: string;
  tmtKgbBaru: string;
  tmtKgbBerikutnya: string;
  flagRapelan: boolean;
  surat: { nomorSurat: string; tanggalSurat: string } | null;
}

export default function GeneratePDFPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [kgb, setKgb] = useState<KGBDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [nomorSurat, setNomorSurat] = useState("");
  const [tanggalSurat, setTanggalSurat] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [nomorSK, setNomorSK] = useState("");
  const [tanggalSK, setTanggalSK] = useState("");
  const [tmtSK, setTmtSK] = useState("");
  const [penetapSkDasar, setPenetapSkDasar] = useState("");
  const [mode, setMode] = useState<"reguler" | "srikandi">("reguler");
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/kgb/${id}/detail`)
      .then((r) => r.json() as any)
      .then((data) => {
        // Cek lock berdasarkan TMT KGB
        const tmt = new Date(data.tmtKgbBaru);
        const unlockDate = new Date(tmt.getFullYear(), tmt.getMonth() - 2, 1);
        if (new Date() < unlockDate) {
          const label = unlockDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
          setError(`KGB ini belum dapat diproses. Jendela proses baru dibuka mulai ${label}.`);
          setLoading(false);
          return;
        }
        setKgb(data);
        if (data.nomorSK) setNomorSK(data.nomorSK);
        if (data.tanggalSK)
          setTanggalSK(new Date(data.tanggalSK).toISOString().split("T")[0]);
        if (data.tmtSK)
          setTmtSK(new Date(data.tmtSK).toISOString().split("T")[0]);
        if (data.penetapSkDasar) setPenetapSkDasar(data.penetapSkDasar);
        if (data.surat) {
          setNomorSurat(data.surat.nomorSurat);
          setTanggalSurat(
            new Date(data.surat.tanggalSurat).toISOString().split("T")[0],
          );
        }
        setLoading(false);
      });
  }, [id]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function validate() {
    if (!nomorSurat) { setError("Nomor surat wajib diisi"); return false; }
    if (!nomorSK || !tanggalSK || !tmtSK) { setError("Nomor SK, Tanggal SK, dan TMT SK wajib diisi"); return false; }
    if (!penetapSkDasar.trim()) { setError("Isi pejabat yang menetapkan SK terakhir"); return false; }
    setError("");
    return true;
  }

  async function saveSK() {
    await fetch(`/api/kgb/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomorSK, tanggalSK, tmtSK, penetapSkDasar }),
    });
  }

  async function fetchPDF(isPreview: boolean, srikandi: boolean = false) {
    if (!validate()) return null;
    await saveSK();

    const params = new URLSearchParams();
    if (isPreview) params.set("preview", "true");
    if (srikandi) params.set("srikandi", "true");
    const query = params.size ? `?${params.toString()}` : "";

    const res = await fetch(`/api/kgb/${id}/pdf${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nomorSurat, tanggalSurat }),
    });

    if (!res.ok) {
      const data = await res.json() as any;
      setError(data.error || "Gagal generate PDF");
      return null;
    }
    return await res.blob();
  }

  async function handlePreview() {
    setPreviewing(true);
    const blob = await fetchPDF(true, mode === "srikandi");
    setPreviewing(false);
    if (!blob) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(blob));
  }

  async function handleDownload() {
    if (!validate()) return;
    setGenerating(true);
    await saveSK();

    const nama = kgb?.pegawai.nama.replace(/ /g, "_") ?? "";
    const nip = kgb?.pegawai.nip ?? "";
    const body = JSON.stringify({ nomorSurat, tanggalSurat });
    const headers = { "Content-Type": "application/json" };

    // Paralel: reguler (ubah status) + srikandi (preview agar tidak double-write)
    const [regularRes, srikandiRes] = await Promise.all([
      fetch(`/api/kgb/${id}/pdf`, { method: "POST", headers, body }),
      fetch(`/api/kgb/${id}/pdf?preview=true&srikandi=true`, { method: "POST", headers, body }),
    ]);

    setGenerating(false);

    if (!regularRes.ok) {
      const data = await regularRes.json() as any;
      setError(data.error || "Gagal generate PDF");
      return;
    }

    const triggerDownload = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    triggerDownload(await regularRes.blob(), `KGB_${nip}_${nama}.pdf`);
    if (srikandiRes.ok) triggerDownload(await srikandiRes.blob(), `Srikandi_KGB_${nip}_${nama}.pdf`);

    router.push("/dashboard/kgb");
  }

  const inputClass =
    "w-full rounded-lg px-3 py-2.5 text-sm outline-none transition";
  const inputStyle = {
    border: "1px solid var(--ln0)",
    background: "var(--sub)",
    color: "var(--dtn)",
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm" style={{ color: "var(--dt4)" }}>
          Memuat data...
        </p>
      </div>
    );

  if (!kgb)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
        <div
          className="rounded-xl px-5 py-4 max-w-sm"
          style={{ background: "var(--ln2)", border: "1px solid var(--ln0)" }}
        >
          {error ? (
            <>
              <svg className="mx-auto mb-3" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#a0b4c8" strokeWidth="1.8">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--dtn)" }}>KGB Terkunci</p>
              <p className="text-xs" style={{ color: "var(--dt4)" }}>{error}</p>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--st-red)" }}>Data KGB tidak ditemukan</p>
          )}
        </div>
        <button
          onClick={() => router.push("/dashboard/kgb")}
          className="text-xs px-4 py-2 rounded-lg"
          style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "1px solid var(--ln0)" }}
        >
          Kembali ke Data KGB
        </button>
      </div>
    );

  return (
    <div className="flex flex-col lg:flex-row gap-5 lg:h-full">
      {/* Panel Kiri : Form */}
      <div className="w-full lg:w-1/2 lg:shrink-0">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => router.push("/dashboard/kgb")}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--sub)", color: "var(--dt3)" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1
              className="text-base font-semibold"
              style={{ color: "var(--dtn)" }}
            >
              Generate Surat KGB
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
              {kgb.pegawai.nama}
            </p>
          </div>
        </div>

        {/* Info KGB */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{ background: "var(--sub)", border: "0.5px solid var(--ln1)" }}
        >
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Jabatan", val: kgb.pegawai.jabatan },
              { label: "Golongan", val: kgb.pegawai.golonganRuang },
              {
                label: "Gaji Lama",
                val: `Rp ${kgb.gajiPokokLama.toLocaleString("id-ID")}`,
              },
              {
                label: "Gaji Baru",
                val: `Rp ${kgb.gajiPokokBaru.toLocaleString("id-ID")}`,
              },
              {
                label: "MKG Baru",
                val: `${kgb.mkgTahunBaru} Thn ${kgb.mkgBulanBaru} Bln`,
              },
              {
                label: "TMT KGB",
                val: new Date(kgb.tmtKgbBaru).toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
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

          {kgb.flagRapelan && (
            <div
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#b87c0a"
                strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-xs font-medium" style={{ color: "var(--st-amber)" }}>
                KGB ini diproses terlambat (rapelan)
              </p>
            </div>
          )}
        </div>

        {/* Form */}
        <div
          className="bg-white rounded-2xl p-4"
          style={{ border: "0.5px solid var(--ln1)" }}
        >
          <p
            className="text-sm font-semibold mb-4"
            style={{ color: "var(--dtn)" }}
          >
            Data Surat
          </p>

          <div className="space-y-4">
            {/* -- BAGIAN 1: Surat yang digenerate -- */}
            <div>
              <p
                className="text-xs font-semibold mb-2"
                style={{ color: "var(--dt5)", letterSpacing: "0.07em" }}
              >
                SURAT YANG DITERBITKAN
              </p>
              <div className="space-y-3">
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--dt2)" }}
                  >
                    Nomor Surat
                    <span
                      className="ml-1 font-normal"
                      style={{ color: "var(--dt5)" }}
                    >
                      (dari Bagian Umum)
                    </span>
                  </label>
                  <input
                    className={inputClass}
                    style={inputStyle}
                    placeholder="misal: WP.19.SA.04.04-123"
                    value={nomorSurat}
                    onChange={(e) => {
                      setNomorSurat(e.target.value);
                      setPreviewUrl(null);
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--dt2)" }}
                  >
                    Tanggal Surat
                  </label>
                  <input
                    type="date"
                    className={inputClass}
                    style={inputStyle}
                    value={tanggalSurat}
                    onChange={(e) => {
                      setTanggalSurat(e.target.value);
                      setPreviewUrl(null);
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px dashed var(--ln1)" }} />

            {/* -- BAGIAN 2: SK terakhir (dasar pemberian KGB) -- */}
            <div>
              <p
                className="text-xs font-semibold mb-2"
                style={{ color: "var(--dt5)", letterSpacing: "0.07em" }}
              >
                ATAS DASAR SK TERAKHIR
              </p>
              <div className="space-y-3">
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--dt2)" }}
                  >
                    Nomor SK
                  </label>
                  <input
                    className={inputClass}
                    style={inputStyle}
                    placeholder="misal: W.19-229.KP.04.05 TAHUN 2024"
                    value={nomorSK}
                    onChange={(e) => setNomorSK(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: "var(--dt2)" }}
                    >
                      Tanggal SK
                    </label>
                    <input
                      type="date"
                      className={inputClass}
                      style={inputStyle}
                      value={tanggalSK}
                      onChange={(e) => setTanggalSK(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs font-medium mb-1.5"
                      style={{ color: "var(--dt2)" }}
                    >
                      Tanggal Mulai Berlaku
                    </label>
                    <input
                      type="date"
                      className={inputClass}
                      style={inputStyle}
                      value={tmtSK}
                      onChange={(e) => setTmtSK(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--dt2)" }}
                  >
                    Ditetapkan oleh
                  </label>
                  <input
                    className={inputClass}
                    style={inputStyle}
                    list="saran-penetap-sk"
                    placeholder="Pejabat yang menetapkan SK terakhir"
                    value={penetapSkDasar}
                    onChange={(e) => setPenetapSkDasar(e.target.value)}
                  />
                  <datalist id="saran-penetap-sk">
                    {SARAN_PENETAP_SK.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px dashed var(--ln1)" }} />

            {/* -- BAGIAN 3: KGB yang diberikan (auto dari DB) -- */}
            <div>
              <p
                className="text-xs font-semibold mb-2"
                style={{ color: "var(--dt5)", letterSpacing: "0.07em" }}
              >
                DIBERIKAN KENAIKAN GAJI BERKALA
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--dt2)" }}
                  >
                    Mulai Tanggal
                  </label>
                  <input
                    className={inputClass}
                    style={{
                      ...inputStyle,
                      background: "var(--ln2)",
                      color: "var(--dt3)",
                    }}
                    value={
                      kgb
                        ? new Date(kgb.tmtKgbBaru).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : ""
                    }
                    readOnly
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "var(--dt2)" }}
                  >
                    KGB Berikutnya
                  </label>
                  <input
                    className={inputClass}
                    style={{
                      ...inputStyle,
                      background: "var(--ln2)",
                      color: "var(--dt3)",
                    }}
                    value={
                      kgb
                        ? new Date(kgb.tmtKgbBerikutnya).toLocaleDateString(
                            "id-ID",
                            { day: "numeric", month: "long", year: "numeric" },
                          )
                        : ""
                    }
                    readOnly
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Mode toggle : hanya untuk preview */}
          <div className="mt-4">
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--dt5)", letterSpacing: "0.07em" }}>
              PREVIEW FORMAT
            </p>
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
              <button
                onClick={() => { setMode("reguler"); setPreviewUrl(null); }}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium transition"
                style={{
                  background: mode === "reguler" ? "var(--navy-solid)" : "var(--card)",
                  color: mode === "reguler" ? "#fff" : "var(--dt4)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Reguler
              </button>
              <button
                onClick={() => { setMode("srikandi"); setPreviewUrl(null); }}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium transition"
                style={{
                  background: mode === "srikandi" ? "var(--green-solid)" : "var(--card)",
                  color: mode === "srikandi" ? "#fff" : "var(--dt4)",
                  borderLeft: "1px solid var(--ln1)",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Srikandi
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mt-3 rounded-lg px-3 py-2.5 text-xs"
              style={{
                background: "var(--tint-red-bg)",
                color: "var(--st-red)",
                border: "1px solid var(--tint-red-ln)",
              }}
            >
              {error}
            </div>
          )}

          {/* Tombol Preview : ikut mode */}
          <button
            onClick={handlePreview}
            disabled={previewing || !nomorSurat}
            className="w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl font-medium transition mt-4 disabled:opacity-50"
            style={{
              background: mode === "srikandi" ? "var(--tint-green-bg)" : "var(--tint-navy)",
              color: mode === "srikandi" ? "var(--st-green)" : "var(--dtn)",
              border: `1px solid ${mode === "srikandi" ? "var(--tint-green-ln)" : "var(--ln0)"}`,
            }}
          >
            {previewing ? "Memuat preview..." : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                {mode === "srikandi" ? "Preview Srikandi" : "Preview Reguler"}
              </>
            )}
          </button>

          {/* Tombol Download & Generate : selalu unduh 2 file sekaligus */}
          <button
            onClick={handleDownload}
            disabled={generating || !nomorSurat}
            className="w-full flex items-center justify-center gap-2 text-xs py-2.5 rounded-xl font-semibold text-white transition mt-2 disabled:opacity-50"
            style={{ background: "var(--navy-solid)" }}
          >
            {generating ? "Generating..." : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download &amp; Generate
              </>
            )}
          </button>
          <p className="text-center text-xs mt-1.5" style={{ color: "#b0c4d8" }}>
            Mengunduh 2 file: Reguler + Srikandi · Status → Sedang Diproses
          </p>

          <button
            onClick={() => router.push("/dashboard/kgb")}
            className="w-full text-xs py-2 mt-2 rounded-xl transition"
            style={{ color: "var(--dt4)" }}
          >
            Batal
          </button>
        </div>
      </div>

      {/* Panel Kanan : Preview (desktop) */}
      <div
        className="hidden lg:flex flex-1 rounded-2xl overflow-hidden flex-col"
        style={{
          border: "0.5px solid var(--ln1)",
          background: "var(--sub)",
          minHeight: "600px",
        }}
      >
        {previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full flex-1 border-0"
            style={{ minHeight: "600px" }}
            title="Preview Surat KGB"
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d0dce8" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p className="text-xs font-medium" style={{ color: "var(--dt5)" }}>Preview surat belum dimuat</p>
            <p className="text-xs" style={{ color: "#c0d0e0" }}>
              {nomorSurat ? 'Klik "Preview" untuk melihat tampilan' : "Isi nomor surat terlebih dahulu"}
            </p>
          </div>
        )}
      </div>

      {/* Preview mobile : buka di tab baru karena iframe PDF tidak didukung */}
      {previewUrl && (
        <div
          className="lg:hidden rounded-2xl p-4 flex flex-col items-center gap-3 text-center"
          style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)" }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a0b4c8" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>Preview siap</p>
          <p className="text-xs" style={{ color: "var(--dt4)" }}>Browser mobile tidak mendukung tampilan PDF inline.</p>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold"
            style={{ background: "var(--navy-solid)", color: "#fff" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Buka PDF di Tab Baru
          </a>
        </div>
      )}
    </div>
  );
}
