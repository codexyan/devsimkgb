"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BATAS_DOKUMEN_BYTE,
  DOKUMEN_TINDAKAN,
  JENIS_DOKUMEN,
  LABEL_SUMBER_DOKUMEN,
  type DokumenPegawai,
  type JenisDokumen,
  type TindakanDokumen,
} from "@/lib/dokumenPegawai";
import { formatTanggalId } from "@/lib/waktu";

/* Panel kanan modal tindakan pegawai (ADR-028): dokumen arsip sejenis sebagai rujukan, dapat dipratinjau di tempat,
   ditambah kotak unggah SK untuk pencatatan ini. Berkas yang dipilih baru diunggah setelah pencatatannya tersimpan
   (unggahKeArsip), supaya tidak ada SK di arsip untuk pencatatan yang gagal. Bila SK-nya sudah ada di daftar,
   unggahan dilewati saja. */

export interface LampiranSk {
  berkas: File;
  jenis: JenisDokumen;
}

const ukuranTeks = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Unggah SK yang dilampirkan ke arsip dokumen pegawai. Mengembalikan kalimat tambahan untuk pesan berhasil:
 * kosong bila tidak ada lampiran, atau keterangan berhasil atau gagalnya unggahan.
 */
export async function unggahKeArsip(
  pegawaiId: string,
  lampiran: LampiranSk | null,
  data: { nomorSK?: string; tanggalSK?: string; keterangan: string },
): Promise<string> {
  if (!lampiran) return "";
  try {
    const form = new FormData();
    form.set("jenis", lampiran.jenis);
    form.set("nomorSK", data.nomorSK ?? "");
    form.set("tanggalSK", /^\d{4}-\d{2}-\d{2}$/.test(data.tanggalSK ?? "") ? (data.tanggalSK as string) : "");
    form.set("keterangan", data.keterangan);
    form.set("berkas", lampiran.berkas);
    const res = await fetch(`/api/pegawai/${pegawaiId}/dokumen`, { method: "POST", body: form });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(d.error ?? "unggahan gagal");
    return ` ${JENIS_DOKUMEN[lampiran.jenis]} masuk arsip dokumen pegawai.`;
  } catch (e) {
    return ` Namun ${JENIS_DOKUMEN[lampiran.jenis]} gagal diunggah (${e instanceof Error ? e.message : "unggahan gagal"}); unggah ulang dari tab Dokumen.`;
  }
}

export default function PanelDokumenRujukan({
  pegawaiId,
  tindakan,
  lampiran,
  onLampiran,
  nonaktif = false,
}: {
  pegawaiId: string;
  tindakan: TindakanDokumen;
  lampiran?: LampiranSk | null;
  /** Bila diisi dan tindakannya punya jenis unggahan, tampil kotak unggah SK. */
  onLampiran?: (l: LampiranSk | null) => void;
  nonaktif?: boolean;
}) {
  const aturan = DOKUMEN_TINDAKAN[tindakan];
  const [dokumen, setDokumen] = useState<DokumenPegawai[] | null>(null);
  const [gagal, setGagal] = useState(false);
  const [lihat, setLihat] = useState<string | null>(null);
  const [jenisUnggah, setJenisUnggah] = useState<JenisDokumen>(aturan.unggah[0] ?? "lainnya");
  const [galat, setGalat] = useState<string | null>(null);
  const [seret, setSeret] = useState(false);
  const [kunciInput, setKunciInput] = useState(0);

  useEffect(() => {
    let batal = false;
    fetch(`/api/pegawai/${pegawaiId}/dokumen`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return (await r.json()) as DokumenPegawai[];
      })
      .then((d) => !batal && setDokumen(d))
      .catch(() => !batal && setGagal(true));
    return () => {
      batal = true;
    };
  }, [pegawaiId]);

  // Jenis bawaan unggahan mengikuti tindakan (mis. mutasi ↔ pemberhentian dalam satu modal).
  const jenisBawaan = aturan.unggah[0];
  useEffect(() => {
    if (!jenisBawaan) return;
    const t = setTimeout(() => {
      setJenisUnggah(jenisBawaan);
      if (lampiran && lampiran.jenis !== jenisBawaan && !aturan.unggah.includes(lampiran.jenis)) onLampiran?.({ ...lampiran, jenis: jenisBawaan });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tindakan]);

  const rujukan = useMemo(
    () =>
      (dokumen ?? [])
        .filter((d) => d.jenis && aturan.rujukan.includes(d.jenis))
        .sort(
          (a, b) =>
            aturan.rujukan.indexOf(a.jenis!) - aturan.rujukan.indexOf(b.jenis!) || (b.tanggal || "").localeCompare(a.tanggal || ""),
        ),
    [dokumen, aturan],
  );
  const aktif = rujukan.find((d) => d.id === lihat) ?? null;
  const bisaUnggah = !!onLampiran && aturan.unggah.length > 0;

  function pilih(f: File | null | undefined) {
    if (!f || !onLampiran) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setGalat("Berkas harus PDF.");
      return;
    }
    if (f.size > BATAS_DOKUMEN_BYTE) {
      setGalat("Ukuran berkas paling besar 500 KB.");
      return;
    }
    setGalat(null);
    onLampiran({ berkas: f, jenis: jenisUnggah });
  }

  return (
    <aside className="pgw-rujukan" aria-label="Dokumen rujukan">
      <div className="pgw-rujukan-kepala">
        <p className="pgw-rujukan-judul">Dokumen rujukan</p>
        <p className="pgw-rujukan-ket">{aturan.rujukan.map((j) => JENIS_DOKUMEN[j]).join(", ")} di arsip pegawai</p>
      </div>

      {gagal ? (
        <p className="pgw-rujukan-kosong">Dokumen gagal dimuat.</p>
      ) : !dokumen ? (
        <p className="pgw-rujukan-kosong">Memuat…</p>
      ) : rujukan.length === 0 ? (
        <p className="pgw-rujukan-kosong">Belum ada dokumen sejenis di arsip pegawai ini.</p>
      ) : (
        <ul className="pgw-rujukan-daftar">
          {rujukan.map((d) => (
            <li key={d.id}>
              <button type="button" className="pgw-rujukan-butir" aria-pressed={lihat === d.id} onClick={() => setLihat(lihat === d.id ? null : d.id)}>
                <span className="dok-ikon" aria-hidden="true">PDF</span>
                <span className="min-w-0">
                  <strong>{d.judul}</strong>
                  <span>{[d.nomorSK, d.tanggal ? formatTanggalId(d.tanggal) : ""].filter(Boolean).join(" · ") || "Tanpa nomor dan tanggal"}</span>
                  <span className="pgw-rujukan-sumber">{LABEL_SUMBER_DOKUMEN[d.sumber]}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {aktif && (
        <div className="pgw-rujukan-pratinjau">
          <iframe src={aktif.url} title={`Pratinjau ${aktif.judul}`} />
          <a href={aktif.url} target="_blank" rel="noopener noreferrer">Buka di tab baru ↗</a>
        </div>
      )}

      {bisaUnggah && (
        <div className="pgw-rujukan-unggah">
          <p className="pgw-rujukan-judul">SK untuk pencatatan ini</p>
          {aturan.unggah.length > 1 && (
            <select
              className="kgbm-input"
              aria-label="Jenis SK yang dilampirkan"
              value={jenisUnggah}
              disabled={nonaktif}
              onChange={(e) => {
                const j = e.target.value as JenisDokumen;
                setJenisUnggah(j);
                if (lampiran) onLampiran?.({ ...lampiran, jenis: j });
              }}
            >
              {aturan.unggah.map((j) => (
                <option key={j} value={j}>{JENIS_DOKUMEN[j]}</option>
              ))}
            </select>
          )}
          {lampiran ? (
            <div className="pgw-rujukan-lampiran">
              <span className="dok-ikon" aria-hidden="true">PDF</span>
              <span className="min-w-0">
                <strong>{lampiran.berkas.name}</strong>
                <span>{ukuranTeks(lampiran.berkas.size)} · diunggah sebagai {JENIS_DOKUMEN[lampiran.jenis]} setelah disimpan</span>
              </span>
              <button
                type="button"
                className="dok-tombol"
                data-nada="merah"
                disabled={nonaktif}
                onClick={() => {
                  onLampiran?.(null);
                  setKunciInput((k) => k + 1);
                }}
              >
                Hapus
              </button>
            </div>
          ) : (
            <label
              className="dok-lepas pgw-rujukan-lepas"
              data-seret={seret ? "" : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setSeret(true);
              }}
              onDragLeave={() => setSeret(false)}
              onDrop={(e) => {
                e.preventDefault();
                setSeret(false);
                pilih(e.dataTransfer.files?.[0]);
              }}
            >
              <input key={kunciInput} type="file" accept="application/pdf,.pdf" className="sr-only" disabled={nonaktif} onChange={(e) => pilih(e.target.files?.[0])} />
              <span className="dok-ikon" aria-hidden="true">+</span>
              <span className="dok-lepas-teks">
                <strong>Lampirkan PDF (opsional)</strong>
                <span>Lewati bila SK-nya sudah ada di daftar di atas</span>
              </span>
            </label>
          )}
          {galat && <p className="pmh-galat">{galat}</p>}
        </div>
      )}
    </aside>
  );
}
