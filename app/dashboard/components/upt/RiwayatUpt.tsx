"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatTanggalId } from "@/lib/waktu";
import { LABEL_JENIS_USULAN, STATUS_USULAN, type StatusUsulan } from "@/lib/usulanPegawai";
import { STATUS_LAPORAN_MUTASI, type StatusLaporanMutasi } from "@/lib/laporanMutasi";
import { ModalPratinjauBerkas } from "@/app/dashboard/components/kgb";

/* Modul Riwayat Admin UPT: semua usulan data dan laporan mutasi atau pemberhentian yang pernah dikirim
   satker ini ke Kanwil, bukan hanya lima terbaru di dasbor. Draf yang belum diajukan tidak di sini,
   melainkan di Perlu dikerjakan. Halaman ini hanya membaca; tindakan tetap di dasbor dan Data Pegawai. */

interface UsulanApi {
  id: string;
  jenis: string;
  nama: string;
  nip: string;
  status: string;
  nomorSurat: string | null;
  tanggalSurat: string | null;
  berkas: { medan: string; label: string; nama?: string | null }[];
  hukdisAda: boolean;
  jumlahPerubahan: number | null;
  diajukanAt: string | null;
  diajukanOleh?: string | null;
  ditinjauAt: string | null;
  alasanTolak: string | null;
}

interface LaporanApi {
  id: string;
  nama: string;
  nip: string;
  label: string;
  satkerTujuan: string | null;
  tmt: string | null;
  nomorSK: string | null;
  alasan: string | null;
  status: string;
  catatanKanwil: string | null;
  dilaporkanAt: string | null;
  dilaporkanOleh?: string | null;
  ditinjauAt: string | null;
}

type Kelompok = "menunggu" | "dikembalikan" | "selesai" | "ditolak";
type Nada = "kuning" | "ungu" | "hijau" | "merah" | "biru";

interface Baris {
  kunci: string;
  asal: "usulan" | "laporan";
  tanggal: string | null;
  nama: string;
  nip: string;
  jenis: string;
  status: { label: string; nada: Nada; kelompok: Kelompok };
  rincian: string[];
  catatanKanwil: string | null;
  ditinjauAt: string | null;
  berkas: { judul: string; nama: string | null; url: string }[];
}

const KELOMPOK_USULAN: Record<string, Kelompok> = { menunggu: "menunggu", revisi: "dikembalikan", disetujui: "selesai", ditolak: "ditolak" };
const KELOMPOK_LAPORAN: Record<string, Kelompok> = { menunggu: "menunggu", dikembalikan: "dikembalikan", diterima: "selesai" };

const PILIHAN_STATUS: { nilai: "semua" | Kelompok; label: string }[] = [
  { nilai: "semua", label: "Semua" },
  { nilai: "menunggu", label: "Menunggu" },
  { nilai: "dikembalikan", label: "Dikembalikan" },
  { nilai: "selesai", label: "Disetujui" },
  { nilai: "ditolak", label: "Ditolak" },
];

const tgl = (t: string | null) => (t ? formatTanggalId(t, { day: "numeric", month: "short", year: "numeric" }) : "-");

function dariUsulan(u: UsulanApi): Baris {
  const cfg = STATUS_USULAN[u.status as StatusUsulan] ?? { label: u.status, nada: "kuning" as const };
  const rincian = [
    u.nomorSurat ? `Surat ${u.nomorSurat}${u.tanggalSurat ? ` tanggal ${tgl(u.tanggalSurat)}` : ""}` : "",
    u.jumlahPerubahan !== null ? `${u.jumlahPerubahan} kolom diusulkan` : "",
    u.hukdisAda ? "disertai laporan hukuman disiplin" : "",
  ].filter(Boolean);
  return {
    kunci: `usulan:${u.id}`,
    asal: "usulan",
    tanggal: u.diajukanAt,
    nama: u.nama,
    nip: u.nip,
    jenis: LABEL_JENIS_USULAN[u.jenis] ?? u.jenis,
    status: { label: cfg.label, nada: cfg.nada, kelompok: KELOMPOK_USULAN[u.status] ?? "menunggu" },
    rincian,
    catatanKanwil: u.status === "revisi" || u.status === "ditolak" ? u.alasanTolak : null,
    ditinjauAt: u.ditinjauAt,
    berkas: u.berkas.map((b) => ({ judul: b.label, nama: b.nama ?? null, url: `/api/usulan/${u.id}/berkas?berkas=${b.medan}` })),
  };
}

function dariLaporan(l: LaporanApi): Baris {
  const cfg = STATUS_LAPORAN_MUTASI[l.status as StatusLaporanMutasi] ?? { label: l.status, nada: "kuning" as const };
  const rincian = [
    l.satkerTujuan ? `ke ${l.satkerTujuan}` : "",
    l.alasan ?? "",
    l.tmt ? `TMT ${tgl(l.tmt)}` : "",
    l.nomorSK ? `SK ${l.nomorSK}` : "",
  ].filter(Boolean);
  return {
    kunci: `laporan:${l.id}`,
    asal: "laporan",
    tanggal: l.dilaporkanAt,
    nama: l.nama,
    nip: l.nip,
    jenis: l.label,
    status: { label: cfg.label, nada: cfg.nada, kelompok: KELOMPOK_LAPORAN[l.status] ?? "menunggu" },
    rincian,
    catatanKanwil: l.status === "dikembalikan" ? l.catatanKanwil : null,
    ditinjauAt: l.ditinjauAt,
    berkas: [],
  };
}

export default function RiwayatUpt() {
  const [baris, setBaris] = useState<Baris[] | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [asal, setAsal] = useState<"semua" | "usulan" | "laporan">("semua");
  const [status, setStatus] = useState<"semua" | Kelompok>("semua");
  const [tahun, setTahun] = useState("semua");
  const [cari, setCari] = useState("");
  const [pratinjau, setPratinjau] = useState<{ judul: string; subjudul: string; url: string } | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/upt/usulan"), fetch("/api/upt/mutasi")])
      .then(async ([ru, rl]) => {
        const u = (await ru.json()) as UsulanApi[] | { error?: string };
        const l = (await rl.json()) as LaporanApi[] | { error?: string };
        if (!ru.ok || !Array.isArray(u)) throw new Error(("error" in u && u.error) || "Riwayat usulan gagal dimuat");
        if (!rl.ok || !Array.isArray(l)) throw new Error(("error" in l && l.error) || "Riwayat laporan gagal dimuat");
        const semua = [...u.filter((x) => x.status !== "draf").map(dariUsulan), ...l.map(dariLaporan)];
        semua.sort((a, b) => (b.tanggal ?? "").localeCompare(a.tanggal ?? ""));
        setBaris(semua);
      })
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : "Riwayat gagal dimuat"));
  }, []);

  const daftarTahun = useMemo(
    () => [...new Set((baris ?? []).map((b) => b.tanggal?.slice(0, 4)).filter((t): t is string => !!t))].sort().reverse(),
    [baris],
  );

  if (galat)
    return (
      <div className="dsb-halaman">
        <div className="dsb-kartu dsb-kosong" role="alert" style={{ padding: "56px 20px" }}>
          <p className="dsb-judul" style={{ marginTop: 0 }}>Riwayat tidak dapat dibuka</p>
          <p>{galat}</p>
        </div>
      </div>
    );

  const semua = baris ?? [];
  const q = cari.trim().toLowerCase();
  const tampil = semua.filter(
    (b) =>
      (asal === "semua" || b.asal === asal) &&
      (status === "semua" || b.status.kelompok === status) &&
      (tahun === "semua" || b.tanggal?.startsWith(tahun)) &&
      (!q || b.nama.toLowerCase().includes(q) || b.nip.includes(q) || b.rincian.some((r) => r.toLowerCase().includes(q))),
  );
  const hitung = (k: Kelompok) => semua.filter((b) => b.status.kelompok === k).length;

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Riwayat</p>
          <h1 className="dsb-halaman-judul">Riwayat usulan dan laporan</h1>
          <p className="dsb-sub">
            Semua usulan data pegawai dan laporan mutasi atau pemberhentian yang pernah dikirim ke Kanwil, beserta
            hasil tinjauannya. Data yang masih disiapkan ada di{" "}
            <Link href="/dashboard" className="kgbm-tautan">Perlu dikerjakan</Link>.
          </p>
        </div>
      </header>

      <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Dikirim ke Kanwil</span>
          <span className="dsb-angka-nilai">{semua.length}</span>
          <span className="dsb-angka-meta">{semua.filter((b) => b.asal === "usulan").length} usulan · {semua.filter((b) => b.asal === "laporan").length} laporan</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Menunggu tinjauan</span>
          <span className="dsb-angka-nilai">{hitung("menunggu")}</span>
          <span className="dsb-angka-meta"><span className="dsb-titik" data-nada="kuning" aria-hidden="true" />Sedang di meja Kanwil</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Dikembalikan</span>
          <span className="dsb-angka-nilai">{hitung("dikembalikan")}</span>
          <span className="dsb-angka-meta"><span className="dsb-titik" data-nada="ungu" aria-hidden="true" />Perlu diperbaiki UPT</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Disetujui</span>
          <span className="dsb-angka-nilai">{hitung("selesai")}</span>
          <span className="dsb-angka-meta"><span className="dsb-titik" data-nada="hijau" aria-hidden="true" />{hitung("ditolak")} ditolak</span>
        </div>
      </div>

      <section className="dsb-panel dsb-penuh overflow-hidden dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="judul-riwayat-upt">
        <div className="dsb-panel-kepala">
          <h2 id="judul-riwayat-upt" className="dsb-panel-judul">
            Daftar kiriman <small>{tampil.length} dari {semua.length}</small>
          </h2>
        </div>
        <div className="dsb-alat" style={{ padding: "10px 16px", borderBottom: "1px solid var(--ln2)" }}>
          <div className="dsb-segmen" role="group" aria-label="Saring jenis kiriman">
            {([
              ["semua", "Semua"],
              ["usulan", "Usulan data"],
              ["laporan", "Mutasi dan pemberhentian"],
            ] as const).map(([v, l]) => (
              <button key={v} type="button" aria-pressed={asal === v} onClick={() => setAsal(v)}>{l}</button>
            ))}
          </div>
          <div className="dsb-segmen" role="group" aria-label="Saring status">
            {PILIHAN_STATUS.map((p) => (
              <button key={p.nilai} type="button" aria-pressed={status === p.nilai} onClick={() => setStatus(p.nilai)}>{p.label}</button>
            ))}
          </div>
          <select className="dsb-cari" style={{ flex: "0 0 auto" }} aria-label="Tahun kiriman" value={tahun} onChange={(e) => setTahun(e.target.value)}>
            <option value="semua">Semua tahun</option>
            {daftarTahun.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="search"
            className="dsb-cari"
            style={{ flex: "0 1 220px", marginLeft: "auto" }}
            aria-label="Cari riwayat"
            placeholder="Cari nama, NIP, nomor surat"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
          />
        </div>

        {!baris ? (
          <div className="flex flex-col gap-2" style={{ padding: 16 }} role="status" aria-label="Memuat riwayat">
            {[1, 2, 3, 4].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 44, borderRadius: 8 }} />)}
          </div>
        ) : tampil.length === 0 ? (
          <p className="dsb-kosong" style={{ padding: "44px 16px" }}>
            {semua.length === 0 ? "Belum ada usulan atau laporan yang dikirim ke Kanwil." : "Tidak ada kiriman yang cocok dengan saringan."}
          </p>
        ) : (
          <div className="dsb-gulir-tabel">
            <table className="dsb-tabel" style={{ minWidth: "920px" }}>
              <thead>
                <tr>
                  <th scope="col">Dikirim</th>
                  <th scope="col">Pegawai</th>
                  <th scope="col">Jenis</th>
                  <th scope="col">Status</th>
                  <th scope="col">Rincian</th>
                  <th scope="col">Berkas</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((b) => (
                  <tr key={b.kunci} data-nada={b.status.kelompok === "dikembalikan" ? "kuning" : b.status.kelompok === "ditolak" ? "merah" : undefined}>
                    <td className="whitespace-nowrap">{tgl(b.tanggal)}</td>
                    <td style={{ maxWidth: 240 }}>
                      <p className="dsb-nama truncate" style={{ margin: 0 }}>{b.nama}</p>
                      <p className="dsb-kecil" style={{ margin: 0 }}>{b.nip}</p>
                    </td>
                    <td className="whitespace-nowrap">{b.jenis}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span className="dsb-titik" data-nada={b.status.nada} aria-hidden="true" />
                        {b.status.label}
                      </span>
                      {b.ditinjauAt && <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>ditinjau {tgl(b.ditinjauAt)}</p>}
                    </td>
                    <td style={{ maxWidth: 320 }}>
                      <p className="dsb-kecil" style={{ margin: 0, color: "var(--dt3)" }}>{b.rincian.join(" · ") || "-"}</p>
                      {b.catatanKanwil && (
                        <p className="dsb-kecil" style={{ margin: "2px 0 0", color: "var(--st-violet)" }}>Catatan Kanwil: {b.catatanKanwil}</p>
                      )}
                    </td>
                    <td>
                      {b.berkas.length === 0 ? (
                        <span className="dsb-kecil">-</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {b.berkas.map((f) => (
                            <button
                              key={f.url}
                              type="button"
                              className="dsb-tombol dsb-tombol-kecil"
                              data-jenis="garis"
                              title={f.nama ?? undefined}
                              onClick={() => setPratinjau({ judul: f.judul, subjudul: f.nama ?? `${b.nama} · ${b.nip}`, url: f.url })}
                            >
                              {f.judul}
                            </button>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="dsb-kaki">
          <span>Urut terbaru · garis tepi kuning: dikembalikan untuk diperbaiki, merah: ditolak</span>
          <span>Perbaikan dan pengiriman ulang dilakukan dari dasbor</span>
        </div>
      </section>

      {pratinjau && (
        <ModalPratinjauBerkas judul={pratinjau.judul} subjudul={pratinjau.subjudul} url={pratinjau.url} onTutup={() => setPratinjau(null)} />
      )}
    </div>
  );
}
