"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import type {
  HasilPemeriksaanData,
  MasalahTmtBerikutnya,
  TemuanTmtBerikutnya,
  TemuanTmtTerakhir,
} from "@/lib/pemeriksaanData";
import { formatTanggalId } from "@/lib/waktu";

/* Pemeriksaan Data (Super Admin): menampilkan temuan dari GET /api/pemeriksaan-data. Hanya membaca;
   perbaikan dilakukan manual di Data Pegawai. */

type HasilApi = HasilPemeriksaanData & { jumlahPegawai: number; diperiksaPada: string };

const teksTanggal = (iso: string | null) => (iso ? formatTanggalId(iso) : "kosong");

function keteranganTmtTerakhir(t: TemuanTmtTerakhir): string {
  const sumber = t.sumber === "berjalan" ? "KGB yang sedang berjalan" : "KGB Selesai terakhir";
  return `TMT KGB terakhir tercatat ${teksTanggal(t.tmtKgbTerakhir)}, menurut riwayat ${formatTanggalId(t.tmtMenurutRiwayat)} (${sumber}).`;
}

const TEKS_MASALAH: Record<MasalahTmtBerikutnya, (t: TemuanTmtBerikutnya) => string> = {
  kosong: () => "TMT KGB berikutnya kosong atau tidak valid.",
  bukan_tanggal_1: (t) => `TMT KGB berikutnya ${teksTanggal(t.tmtKgbBerikutnya)} bukan tanggal 1.`,
  tidak_sesudah_tmt_terakhir: (t) => `TMT KGB berikutnya ${teksTanggal(t.tmtKgbBerikutnya)} tidak sesudah TMT KGB terakhir.`,
};

interface BarisTemuan {
  pegawaiId: string;
  nama: string;
  nip: string;
  keterangan: string;
  tambahan?: ReactNode;
}

function KelompokTemuan({ judul, penjelasan, baris }: { judul: string; penjelasan: string; baris: BarisTemuan[] }) {
  const idJudul = useId();
  const ada = baris.length > 0;
  return (
    <section aria-labelledby={idJudul} className="rounded-xl overflow-hidden" style={{ border: "0.5px solid var(--ln1)" }}>
      <div className="px-3 py-2.5 flex items-start gap-2" style={{ background: "var(--sub)", borderBottom: ada ? "0.5px solid var(--ln2)" : "none" }}>
        <div className="flex-1 min-w-0">
          <h3 id={idJudul} className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>{judul}</h3>
          <p style={{ fontSize: "10.5px", color: "var(--dt4)", lineHeight: 1.5 }}>{penjelasan}</p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
          style={{ background: ada ? "var(--tint-amber-bg)" : "var(--tint-green-bg)", color: ada ? "var(--st-amber2)" : "var(--st-green)", fontSize: "10.5px" }}>
          {baris.length} pegawai
        </span>
      </div>
      {ada ? (
        <ul className="overflow-y-auto" style={{ maxHeight: "320px", scrollbarWidth: "thin" }}>
          {baris.map((b, i) => (
            <li key={b.pegawaiId} className="px-3 py-2 flex flex-wrap items-start gap-x-3 gap-y-1"
              style={{ borderBottom: i < baris.length - 1 ? "0.5px solid var(--ln2)" : "none" }}>
              <div className="flex-1 min-w-0" style={{ minWidth: "12rem" }}>
                <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>
                  {b.nama}
                  {b.tambahan}
                </p>
                <p style={{ fontSize: "10.5px", color: "var(--dt4)" }}>NIP {b.nip}</p>
                <p style={{ fontSize: "10.5px", color: "var(--st-amber2)", lineHeight: 1.5 }}>{b.keterangan}</p>
              </div>
              <Link href={`/dashboard/pegawai/${encodeURIComponent(b.pegawaiId)}/riwayat`}
                className="text-xs px-2.5 py-1 rounded-lg font-medium shrink-0"
                style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)", textDecoration: "none" }}
                aria-label={`Buka di Data Pegawai: ${b.nama}`}>
                Buka di Data Pegawai
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 pb-2.5" style={{ fontSize: "10.5px", color: "var(--st-green)" }}>Tidak ada temuan.</p>
      )}
    </section>
  );
}

export default function PemeriksaanData() {
  const [hasil, setHasil] = useState<HasilApi | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function periksa() {
    if (memuat) return;
    setMemuat(true);
    setGalat(null);
    try {
      const res = await fetch("/api/pemeriksaan-data", { cache: "no-store" });
      const isi = (await res.json().catch(() => null)) as (HasilApi & { error?: string }) | null;
      if (!res.ok || !isi || !Array.isArray(isi.unitKerjaTidakDikenal)) {
        setGalat(isi?.error || "Pemeriksaan data gagal dijalankan.");
        return;
      }
      setHasil(isi);
    } catch {
      setGalat("Gagal menghubungi server. Periksa koneksi, lalu coba lagi.");
    } finally {
      setMemuat(false);
    }
  }

  const totalTemuan = hasil
    ? hasil.unitKerjaTidakDikenal.length + hasil.tmtKgbTerakhirTidakSesuai.length + hasil.tmtKgbBerikutnyaTidakValid.length
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void periksa()} disabled={memuat}
          className="text-xs font-semibold px-4 py-2 rounded-xl transition disabled:cursor-not-allowed"
          style={{ background: memuat ? "var(--ln1)" : "var(--navy-solid)", color: memuat ? "var(--dt4)" : "#fff", border: "none" }}>
          {memuat ? "Memeriksa..." : hasil ? "Periksa Ulang" : "Periksa Data"}
        </button>
        <p role="status" aria-live="polite" style={{ fontSize: "10.5px", color: "var(--dt4)" }}>
          {hasil && !memuat
            ? `${hasil.jumlahPegawai} pegawai diperiksa pada ${formatTanggalId(hasil.diperiksaPada, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}. ${totalTemuan === 0 ? "Tidak ada temuan." : `${totalTemuan} temuan.`}`
            : "Pemeriksaan hanya membaca data; tidak ada data yang diubah otomatis."}
        </p>
      </div>

      {galat && (
        <p role="alert" className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "1px solid var(--tint-red-ln)" }}>
          {galat}
        </p>
      )}

      {hasil && (
        <div className="space-y-3">
          <KelompokTemuan
            judul="Unit kerja tidak dikenali"
            penjelasan="Pegawai aktif dengan unit kerja yang tidak cocok dengan satu pun dari 19 satker. SK KGB memakai KPPN mitra satker, jadi pilih satker yang benar di Data Pegawai."
            baris={hasil.unitKerjaTidakDikenal.map((t) => ({
              pegawaiId: t.pegawaiId,
              nama: t.nama,
              nip: t.nip,
              keterangan: `Unit kerja tercatat: "${t.unitKerja}".`,
            }))}
          />
          <KelompokTemuan
            judul="TMT KGB terakhir tidak sesuai riwayat"
            penjelasan="TMT KGB terakhir di Data Pegawai berbeda dengan riwayat KGB: TMT KGB yang sedang berjalan (Sedang Diproses atau Menunggu Keuangan), atau bila tidak ada, TMT KGB Selesai terakhir."
            baris={hasil.tmtKgbTerakhirTidakSesuai.map((t) => ({
              pegawaiId: t.pegawaiId,
              nama: t.nama,
              nip: t.nip,
              keterangan: keteranganTmtTerakhir(t),
              tambahan: t.aktif ? undefined : (
                <span className="ml-1.5 px-1.5 py-0.5 rounded font-semibold" style={{ background: "var(--ln2)", color: "var(--dt4)", fontSize: "9.5px" }}>
                  Nonaktif
                </span>
              ),
            }))}
          />
          <KelompokTemuan
            judul="TMT KGB berikutnya tidak valid"
            penjelasan="Pegawai aktif yang TMT KGB berikutnya kosong, bukan tanggal 1, atau tidak sesudah TMT KGB terakhir, sehingga jadwal KGB-nya tidak dapat dihitung dengan benar."
            baris={hasil.tmtKgbBerikutnyaTidakValid.map((t) => ({
              pegawaiId: t.pegawaiId,
              nama: t.nama,
              nip: t.nip,
              keterangan: TEKS_MASALAH[t.masalah](t),
            }))}
          />
        </div>
      )}
    </div>
  );
}
