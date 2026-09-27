"use client";

import { useState } from "react";
import { KerangkaModal, PesanGalat } from "@/app/dashboard/components/kgb";
import DetailUsulan, { type UsulanKanwil } from "@/app/dashboard/components/usulan/DetailUsulan";

/* Tinjauan satu usulan data UPT langsung dari papan atau daftar KGB (ADR-011, ADR-014), tanpa pindah ke menu
   Usulan UPT. Isinya sama dengan panel detail halaman Usulan UPT (DetailUsulan).
   Setujui dan Kembalikan memakai rute yang sama dengan menu Usulan UPT (PATCH /api/usulan/[id]); bila KGB
   pegawainya sedang berjalan, server ikut menyesuaikannya (lib/sesuaikanKgbUsulan.ts). */

/** Satu baris GET /api/usulan yang masih menunggu tinjauan. */
export type UsulanMenunggu = UsulanKanwil;

export default function ModalUsulanUpt({
  usulan,
  onTutup,
  onBerhasil,
}: {
  usulan: UsulanMenunggu;
  onTutup: () => void;
  onBerhasil: (pesan: string) => void;
}) {
  const [mode, setMode] = useState<"lihat" | "kembalikan">("lihat");
  const [catatan, setCatatan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function kirim(aksi: "setujui" | "kembalikan") {
    if (aksi === "kembalikan" && !catatan.trim()) {
      setGalat("Tulis catatan perbaikan untuk UPT.");
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/usulan/${encodeURIComponent(usulan.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aksi === "kembalikan" ? { aksi, catatan: catatan.trim() } : { aksi }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; perluCatatHukdis?: boolean; penyesuaianKgb?: string | null };
      if (!res.ok) {
        setGalat(d.error ?? "Usulan gagal diproses");
        return;
      }
      onBerhasil(
        aksi === "kembalikan"
          ? `Usulan ${usulan.nama} dikembalikan ke UPT dengan catatan.`
          : `Usulan ${usulan.nama} disetujui.` +
              (d.penyesuaianKgb ? ` KGB: ${d.penyesuaianKgb}.` : "") +
              (d.perluCatatHukdis ? " Catat laporan hukuman disiplinnya di modul Hukuman Disiplin." : ""),
      );
    } catch {
      setGalat("Usulan gagal diproses");
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KerangkaModal
      judul={`Usulan UPT: ${usulan.nama}`}
      subjudul={`${usulan.nip} · ${usulan.unitKerja}`}
      ukuran="md"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={() => void kirim(mode === "kembalikan" ? "kembalikan" : "setujui")}
      kaki={
        mode === "lihat" ? (
          <>
            <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setMode("kembalikan")} disabled={sibuk}>
              Kembalikan
            </button>
            <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Setujui"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setMode("lihat")} disabled={sibuk}>
              Kembali
            </button>
            <button type="submit" className="kgbm-tombol kgbm-bahaya" disabled={sibuk}>
              {sibuk ? "Menyimpan…" : "Kembalikan ke UPT"}
            </button>
          </>
        )
      }
    >
      <PesanGalat pesan={galat} />
      <DetailUsulan usulan={usulan} />
      {mode === "kembalikan" && (
        <label className="kgbm-label">
          <span className="kgbm-wajib">Catatan perbaikan untuk UPT</span>
          <textarea
            className="kgbm-input"
            rows={3}
            data-autofocus
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Mis. lampirkan SK kenaikan pangkat terakhir; masa kerja golongan tidak sesuai SK."
          />
        </label>
      )}
    </KerangkaModal>
  );
}
