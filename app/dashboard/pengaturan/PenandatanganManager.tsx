"use client";

import { useEffect, useMemo, useState } from "react";
import {
  berlakuPada,
  JABATAN_BAWAAN,
  jabatanTercetak,
  JENIS_PENANDATANGAN,
  LABEL_JENIS_PENANDATANGAN,
  rentangBerlaku,
  tentukanPenandatangan,
  type JenisPenandatangan,
  type Penandatangan,
} from "@/lib/penandatangan";
import { isoTanggalLokal, tanggalKalender } from "@/lib/waktu";

/* ─────────────────────────────────────────────────────────────────────────
   Penandatangan surat KGB (seksi Pengaturan). Surat memilih penandatangan
   otomatis menurut tanggal suratnya: Plh bila pimpinan berhalangan sementara,
   Plt bila jabatan kosong, Dirjen bila KGB milik pimpinan Kanwil sendiri.
   ───────────────────────────────────────────────────────────────────────── */

interface PegawaiOpt { id: string; nip: string; nama: string; jabatan: string; }
interface FormState {
  id: string | null; jenis: JenisPenandatangan; nama: string; nip: string;
  jabatan: string; dasarPenunjukan: string; berlakuMulai: string; berlakuSampai: string;
}

// Nilai input date dari tanggal kalender WITA; toISOString bergeser sehari untuk tengah malam WITA.
const keIso = (t: Date | string | null | undefined) => {
  const tanggal = tanggalKalender(t);
  return tanggal ? isoTanggalLokal(tanggal) : "";
};
const formBaru = (): FormState => ({
  id: null, jenis: "definitif", nama: "", nip: "", jabatan: JABATAN_BAWAAN.definitif,
  dasarPenunjukan: "", berlakuMulai: keIso(new Date()), berlakuSampai: "",
});

function Isian({ label, value, onChange, placeholder, type = "text", hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--dt2)" }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="adm-input" />
      {hint && <p className="mt-1" style={{ color: "var(--dt5)", fontSize: "10px" }}>{hint}</p>}
    </div>
  );
}

export default function PenandatanganManager({ onStatus }: { onStatus?: (adaHariIni: boolean) => void }) {
  const [daftar, setDaftar] = useState<Penandatangan[]>([]);
  const [versi, setVersi] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pegawai, setPegawai] = useState<PegawaiOpt[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [cari, setCari] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/penandatangan")
      .then((r) => r.json())
      .then((d) => setDaftar(Array.isArray(d) ? d : []))
      .catch(() => setError("Gagal memuat data penandatangan"))
      .finally(() => setLoading(false));
  }, [versi]);

  useEffect(() => {
    fetch("/api/pegawai?search=&status=")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setPegawai(d); })
      .catch(() => {});
  }, []);

  const hariIni = tentukanPenandatangan(daftar, new Date(), "");
  const dirjenHariIni = daftar.find((p) => p.jenis === "dirjen" && berlakuPada(p, new Date()));
  useEffect(() => { if (!loading) onStatus?.(hariIni.ok); }, [loading, hariIni.ok, onStatus]);

  const kandidat = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return [];
    return pegawai.filter((p) => p.nama.toLowerCase().includes(q) || p.nip.includes(q)).slice(0, 6);
  }, [pegawai, cari]);

  const ubah = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const perluDasar = form?.jenis === "plh" || form?.jenis === "plt";

  function pilihJenis(jenis: JenisPenandatangan) {
    // Jabatan bawaan ikut berganti, kecuali sudah diketik manual.
    setForm((f) => f && { ...f, jenis, jabatan: f.jabatan === JABATAN_BAWAAN[f.jenis] ? JABATAN_BAWAAN[jenis] : f.jabatan });
  }

  function bukaUbah(p: Penandatangan) {
    setError(""); setCari("");
    setForm({
      id: p.id, jenis: p.jenis, nama: p.nama, nip: p.nip, jabatan: p.jabatan,
      dasarPenunjukan: p.dasarPenunjukan ?? "", berlakuMulai: keIso(p.berlakuMulai), berlakuSampai: keIso(p.berlakuSampai),
    });
  }

  async function simpan() {
    if (!form) return;
    setSaving(true); setError("");
    try {
      const { id, ...isi } = form;
      const res = await fetch(id ? `/api/penandatangan/${id}` : "/api/penandatangan", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isi),
      });
      const d = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(d.error || "Gagal menyimpan penandatangan"); return; }
      setForm(null); setCari(""); setVersi((v) => v + 1);
    } catch { setError("Gagal menghubungi server"); }
    finally { setSaving(false); }
  }

  async function hapus(p: Penandatangan) {
    if (!window.confirm(`Hapus ${LABEL_JENIS_PENANDATANGAN[p.jenis]} ${p.nama}?`)) return;
    setError("");
    const res = await fetch(`/api/penandatangan/${p.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) { setError(d.error || "Gagal menghapus penandatangan"); return; }
    setVersi((v) => v + 1);
  }

  if (loading) return <p className="text-xs" style={{ color: "var(--dt4)" }}>Memuat penandatangan…</p>;

  return (
    <div className="space-y-3">
      {hariIni.ok ? (
        <div className="rounded-xl px-4 py-3" style={{ background: "var(--sub)", border: "1px dashed var(--ln0)" }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--dt2)" }}>Tercetak pada surat bertanggal hari ini</p>
          <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "12px", color: "var(--dt1)", width: "fit-content", marginLeft: "auto" }}>
            <p style={{ margin: 0 }}>{hariIni.jabatan},</p><div style={{ height: "34px" }} />
            <p style={{ margin: 0 }}>{hariIni.penandatangan.nama}</p>
          </div>
        </div>
      ) : (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber2)", lineHeight: 1.5 }}>
          Belum ada penandatangan yang berlaku hari ini. Surat KGB tidak dapat dibuat sampai data ditambahkan.
        </p>
      )}
      <p style={{ fontSize: "10.5px", color: dirjenHariIni ? "var(--dt4)" : "var(--st-amber2)" }}>
        {dirjenHariIni
          ? `KGB milik pimpinan Kanwil ditandatangani ${dirjenHariIni.nama}.`
          : "Data Direktur Jenderal belum diisi, sehingga surat KGB milik pimpinan Kanwil belum dapat dibuat."}
      </p>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
        {daftar.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: "var(--dt5)" }}>Belum ada penandatangan.</p>
        ) : daftar.map((p, i) => (
          <div key={p.id} className="flex items-start gap-2 px-3 py-2.5" style={{ borderBottom: i < daftar.length - 1 ? "0.5px solid var(--ln2)" : "none" }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{p.nama}</span>
                <span className="px-1.5 rounded-full" style={{ fontSize: "10px", background: "var(--tint-navy)", color: "var(--dtn)" }}>{LABEL_JENIS_PENANDATANGAN[p.jenis]}</span>
                {berlakuPada(p, new Date()) && (
                  <span className="px-1.5 rounded-full" style={{ fontSize: "10px", background: "var(--tint-green-bg)", color: "var(--st-green)" }}>Berlaku hari ini</span>
                )}
              </div>
              <p className="text-xs truncate" style={{ color: "var(--dt4)" }}>NIP {p.nip} · {jabatanTercetak(p)}</p>
              <p style={{ fontSize: "10.5px", color: "var(--dt5)" }}>{rentangBerlaku(p)}{p.dasarPenunjukan ? ` · ${p.dasarPenunjukan}` : ""}</p>
            </div>
            <button onClick={() => bukaUbah(p)} className="text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0" style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>Ubah</button>
            <button onClick={() => hapus(p)} className="text-xs px-2.5 py-1 rounded-lg shrink-0" style={{ color: "var(--st-red)", border: "0.5px solid var(--ln1)" }}>Hapus</button>
          </div>
        ))}
      </div>

      {form ? (
        <div className="rounded-xl p-3 space-y-2.5" style={{ background: "var(--sub)", border: "1px solid var(--ln1)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{form.id ? "Ubah penandatangan" : "Tambah penandatangan"}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {JENIS_PENANDATANGAN.map((j) => {
              const aktif = form.jenis === j;
              return (
                <button key={j} type="button" onClick={() => pilihJenis(j)} className="text-xs px-2 py-1.5 rounded-lg"
                  style={{ border: `1px solid ${aktif ? "var(--accent)" : "var(--ln1)"}`, background: aktif ? "var(--accent-bg)" : "var(--card)", color: aktif ? "var(--accent)" : "var(--dt3)", fontWeight: aktif ? 600 : 400 }}>
                  {LABEL_JENIS_PENANDATANGAN[j]}
                </button>
              );
            })}
          </div>

          {form.jenis !== "dirjen" && (
            <div>
              <Isian label="Cari dari data pegawai" value={cari} onChange={setCari} placeholder="Nama atau NIP" />
              {kandidat.length > 0 && (
                <div className="mt-1 rounded-lg overflow-hidden" style={{ border: "1px solid var(--ln1)" }}>
                  {kandidat.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setForm((f) => f && { ...f, nama: p.nama, nip: p.nip }); setCari(""); }}
                      className="w-full text-left px-3 py-2 text-xs truncate" style={{ background: "var(--card)", borderBottom: "0.5px solid var(--ln2)" }}>
                      <span style={{ color: "var(--dtn)", fontWeight: 600 }}>{p.nama}</span>
                      <span style={{ color: "var(--dt4)" }}> · {p.nip} · {p.jabatan}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Isian label="Nama" value={form.nama} onChange={(v) => ubah("nama", v)} />
            <Isian label="NIP" value={form.nip} onChange={(v) => ubah("nip", v.replace(/[^\d]/g, ""))} placeholder="18 digit" />
          </div>
          <Isian label="Jabatan" value={form.jabatan} onChange={(v) => ubah("jabatan", v)} hint={`Tercetak: ${jabatanTercetak(form)}`} />
          <Isian label={perluDasar ? "Dasar penunjukan (wajib)" : "Dasar penunjukan"} value={form.dasarPenunjukan} onChange={(v) => ubah("dasarPenunjukan", v)} placeholder="Nomor surat perintah atau keputusan" />
          <div className="grid grid-cols-2 gap-2">
            <Isian label="Berlaku mulai" type="date" value={form.berlakuMulai} onChange={(v) => ubah("berlakuMulai", v)} />
            <Isian label="Berlaku sampai" type="date" value={form.berlakuSampai} onChange={(v) => ubah("berlakuSampai", v)} hint="Kosongkan bila masih menjabat" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={simpan} disabled={saving} className="text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-50" style={{ background: "var(--accent-solid)", color: "#fff" }}>
              {saving ? "Menyimpan…" : "Simpan penandatangan"}
            </button>
            <button onClick={() => { setForm(null); setCari(""); setError(""); }} className="text-xs px-3 py-2 rounded-lg" style={{ color: "var(--dt4)", border: "0.5px solid var(--ln1)" }}>Batal</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setForm(formBaru()); setError(""); }} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}>
          + Tambah penandatangan
        </button>
      )}

      {error && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>{error}</p>
      )}
    </div>
  );
}
