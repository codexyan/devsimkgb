"use client";

import { useState } from "react";
import { KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import { formatTanggalId } from "@/lib/waktu";

/* Tinjauan satu usulan data UPT langsung dari papan atau daftar KGB (ADR-011), tanpa pindah ke menu Usulan UPT.
   Isinya perbandingan data sekarang dengan yang diusulkan, laporan hukdis, SK dasar, dan berkas pendukung.
   Setujui dan Kembalikan memakai rute yang sama dengan menu Usulan UPT (PATCH /api/usulan/[id]); bila KGB
   pegawainya sedang berjalan, server ikut menyesuaikannya (lib/sesuaikanKgbUsulan.ts). */

/** Satu baris GET /api/usulan yang masih menunggu tinjauan. */
export interface UsulanMenunggu {
  id: string;
  pegawaiId: string | null;
  jenis: string;
  nama: string;
  nip: string;
  unitKerja: string;
  nomorSurat: string | null;
  tanggalSurat: string | null;
  berkas: { medan: string; label: string; nama?: string | null }[];
  perubahan: { kunci: string; label: string; sekarang: string; diusulkan: string }[];
  hukdis: string | null;
  hukdisKeterangan: string | null;
  nomorSkTerakhir: string | null;
  tanggalSkTerakhir: string | null;
  catatanUpt: string | null;
  diajukanOleh: string | null;
  diajukanAt: string | null;
}

/** Kolom yang menggeser hitungan KGB; ditandai agar peninjau tahu KGB berjalan akan dihitung ulang. */
const KOLOM_DASAR_GAJI = new Set(["golonganRuang", "mkgTahun", "mkgBulan", "tmtKgbTerakhir", "tmtKgbBerikutnya", "gajiPokok"]);

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
  const menyentuhGaji = usulan.perubahan.some((p) => KOLOM_DASAR_GAJI.has(p.kunci));

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
      subjudul={`${usulan.nip} · ${usulan.unitKerja}${usulan.nomorSurat ? ` · surat ${usulan.nomorSurat}` : ""}`}
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
      {usulan.perubahan.length > 0 ? (
        <div className="kgbm-data">
          <div className="kgbm-data-kepala">
            <span>Perubahan yang diusulkan</span>
            <span>{usulan.perubahan.length}</span>
          </div>
          <dl>
            {usulan.perubahan.map((p) => (
              <div className="kgbm-data-baris" key={p.kunci}>
                <dt>{p.label}</dt>
                <dd>
                  <span style={{ textDecoration: "line-through", color: "var(--dt5)", fontWeight: 400 }}>{p.sekarang}</span>
                  {" → "}
                  <span style={{ color: "var(--st-green)" }}>{p.diusulkan}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <Catatan>Tidak ada kolom data yang berubah; usulan ini berisi laporan atau lampiran saja.</Catatan>
      )}
      {menyentuhGaji && (
        <Catatan nada="amber">
          Usulan ini mengubah dasar hitungan KGB. Bila KGB pegawai ini sedang diproses, hitungannya diperbarui saat
          disetujui, dan SK yang sudah dibuat harus dibuat ulang dengan nomor yang sama (tersimpan sebagai draf). Bila
          SK bertanda tangan sudah diunggah, persetujuan ditolak.
        </Catatan>
      )}
      {(usulan.nomorSkTerakhir || usulan.tanggalSkTerakhir) && (
        <p className="dsb-sub" style={{ margin: 0 }}>
          SK dasar dari UPT: {usulan.nomorSkTerakhir || "-"}
          {usulan.tanggalSkTerakhir ? `, ${formatTanggalId(usulan.tanggalSkTerakhir)}` : ""}
        </p>
      )}
      {usulan.hukdis && <Catatan nada="merah">Laporan hukuman disiplin: {usulan.hukdis}{usulan.hukdisKeterangan ? `. ${usulan.hukdisKeterangan}` : ""}</Catatan>}
      {usulan.catatanUpt && <Catatan>Catatan UPT: {usulan.catatanUpt}</Catatan>}
      {usulan.berkas.length > 0 && (
        <div className="kgbm-baris-tombol">
          {usulan.berkas.map((b) => (
            <a
              key={b.medan}
              className="kgbm-tautan"
              href={`/api/usulan/${encodeURIComponent(usulan.id)}/berkas?berkas=${b.medan}`}
              target="_blank"
              rel="noopener noreferrer"
              title={b.nama ?? undefined}
            >
              {b.label}
            </a>
          ))}
        </div>
      )}
      <p className="dsb-kecil" style={{ margin: 0 }}>
        Diajukan {usulan.diajukanOleh ?? "UPT"}
        {usulan.diajukanAt ? ` pada ${formatTanggalId(usulan.diajukanAt)}` : ""}.
      </p>
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
