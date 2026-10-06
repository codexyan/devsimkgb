"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, hariIniWita, tanggalKalender } from "@/lib/waktu";
import { namaTampilSatker } from "@/app/dashboard/satker/labelSatker";

/* Modul Riwayat Admin UPT: riwayat KGB setiap pegawai satker, sebangun dengan panel yang dipakai
   Keuangan Kanwil. Sumbernya GET /api/upt/riwayat-kgb, yang memuat seluruh siklus termasuk arsip
   (SK yang terbit di luar SIM-KGB) dan yang dibatalkan, berbeda dari daftar SK di dasbor, yang hanya
   berisi antrian kerja. Halaman ini hanya membaca; tindakannya tetap di dasbor.

   Jejak usulan dan laporan yang pernah dikirim ke Kanwil bukan riwayat KGB, melainkan riwayat
   aktivitas, dan tinggal di halaman tersendiri (/dashboard/upt/riwayat/aktivitas). */

interface KgbApi {
  id: string;
  pegawaiId: string;
  status: string;
  isArsip: boolean;
  nomorSK: string;
  tmtKgbBaru: string | null;
  golonganLama: string;
  golonganBaru: string;
  gajiPokokLama: number | null;
  gajiPokokBaru: number | null;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  rapelanDitetapkan: boolean;
  nomorSurat: string | null;
  tanggalSurat: string | null;
  gajiWebAt: string | null;
  berkasAda: boolean;
  pegawai: { nama: string; nip: string; jabatan: string };
}

/**
 * SK yang mengubah golongan atau masa kerja golongan di luar KGB: kenaikan pangkat (termasuk penyesuaian
 * ijazah) dan peninjauan masa kerja. Sesudah SK KGB terakhir pun SK seperti ini masih mungkin terbit, dan
 * sejak itu dialah dasar SK KGB berikutnya (ADR-020, ADR-021).
 */
interface SkDasarApi {
  id: string;
  pegawaiId: string;
  jenis: "kp" | "pmk";
  label: string;
  nomorSK: string | null;
  tanggalSK: string | null;
  tmt: string | null;
  golonganLama: string;
  golonganBaru: string;
  mkgTahunLama: number;
  mkgBulanLama: number;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  penetapSK: string | null;
  tmtKgbBerikutnyaLama: string | null;
  tmtKgbBerikutnyaBaru: string | null;
}

interface DataApi {
  satker: { kode: string; nama: string; jenis: string };
  pegawaiAktif: number;
  kgb: KgbApi[];
  skDasar?: SkDasarApi[];
}

type Saring = "semua" | "tahunIni" | "belumDirekam" | "rapelan";

const fmtTgl = (s: string | null | undefined) =>
  s ? formatTanggalId(s, { day: "numeric", month: "short", year: "numeric" }) : "-";
const fmtRp = (n: number | null | undefined) => (typeof n === "number" ? "Rp " + n.toLocaleString("id-ID") : "-");
const fmtMkg = (tahun: number | null, bulan: number | null) =>
  tahun === null || tahun === undefined ? "-" : `${tahun} thn ${bulan ?? 0} bln`;
const tahunDari = (s: string | null) => tanggalKalender(s)?.getFullYear() ?? null;

function StatusKgb({ k }: { k: KgbApi }) {
  // Arsip adalah SK lama yang direkam belakangan sebagai dasar KGB berikutnya, bukan hasil proses di
  // SIM-KGB; menyebutnya "Selesai" akan menyesatkan.
  const label = k.isArsip ? "Arsip SK lama" : k.status === "selesai" ? "Selesai" : infoStatusKgb(k.status).label;
  return (
    <span className="dsb-status">
      <span className="dsb-titik" style={{ background: warnaStatusKgb(k.status).color }} aria-hidden="true" />
      {label}
    </span>
  );
}

export default function RiwayatKgbUpt() {
  const [hariIni] = useState(() => hariIniWita());
  const tahun = hariIni.getFullYear();

  const [data, setData] = useState<DataApi | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState<Saring>("semua");
  const [terbuka, setTerbuka] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const res = await fetch("/api/upt/riwayat-kgb");
      if (!res.ok) {
        const isi = (await res.json().catch(() => null)) as { error?: string } | null;
        setGalat(isi?.error ?? "Riwayat KGB gagal dimuat.");
        return;
      }
      setData((await res.json()) as DataApi);
    } catch {
      setGalat("Riwayat KGB gagal dimuat. Periksa sambungan, lalu muat ulang.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  /* SK kenaikan pangkat dan PMK pegawai ini, terbaru lebih dulu; dipakai saat barisnya dibuka. */
  const skDasarPegawai = useMemo(() => {
    const peta = new Map<string, SkDasarApi[]>();
    for (const s of data?.skDasar ?? []) peta.set(s.pegawaiId, [...(peta.get(s.pegawaiId) ?? []), s]);
    return peta;
  }, [data]);

  /* Satu baris per pegawai, berisi seluruh siklusnya; yang terbaru menjadi ringkasan barisnya. */
  const pegawaiList = useMemo(() => {
    const peta = new Map<string, KgbApi[]>();
    for (const k of data?.kgb ?? []) {
      if (!peta.has(k.pegawaiId)) peta.set(k.pegawaiId, []);
      peta.get(k.pegawaiId)!.push(k);
    }
    return [...peta.entries()]
      .map(([pegawaiId, daftar]) => {
        const urut = [...daftar].sort(
          (a, b) => (tanggalKalender(b.tmtKgbBaru)?.getTime() ?? 0) - (tanggalKalender(a.tmtKgbBaru)?.getTime() ?? 0),
        );
        return {
          pegawaiId,
          pegawai: urut[0].pegawai,
          kgbs: urut,
          adaTahunIni: urut.some((k) => tahunDari(k.tmtKgbBaru) === tahun),
          adaRapelan: urut.some((k) => k.rapelanDitetapkan),
          // SK sudah terbit tetapi belum dicatat di Gaji Web satker: satu-satunya sisa tugas UPT di sini.
          belumDirekam: urut.some((k) => k.status === "menunggu_keuangan" && !k.gajiWebAt),
        };
      })
      .sort(
        (a, b) =>
          Number(b.belumDirekam) - Number(a.belumDirekam) ||
          Number(b.adaTahunIni) - Number(a.adaTahunIni) ||
          a.pegawai.nama.localeCompare(b.pegawai.nama, "id"),
      );
  }, [data, tahun]);

  const q = cari.trim().toLowerCase();
  const tampil = pegawaiList.filter((e) => {
    if (saring === "tahunIni" && !e.adaTahunIni) return false;
    if (saring === "belumDirekam" && !e.belumDirekam) return false;
    if (saring === "rapelan" && !e.adaRapelan) return false;
    if (!q) return true;
    return (
      e.pegawai.nama.toLowerCase().includes(q) ||
      e.pegawai.nip.includes(q) ||
      e.kgbs.some((k) => (k.nomorSurat ?? "").toLowerCase().includes(q) || (k.nomorSK ?? "").toLowerCase().includes(q))
    );
  });

  const jumlahBelumDirekam = pegawaiList.filter((e) => e.belumDirekam).length;
  const jumlahSiklus = (data?.kgb ?? []).length;

  const PILIHAN: [Saring, string][] = [
    ["semua", "Semua"],
    ["tahunIni", `Ada KGB ${tahun}`],
    ["belumDirekam", `Belum direkam di Gaji Web${jumlahBelumDirekam ? ` (${jumlahBelumDirekam})` : ""}`],
    ["rapelan", "Pernah rapelan"],
  ];

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">{data ? namaTampilSatker(data.satker) : "Admin UPT"}</p>
          <h1 className="dsb-halaman-judul">Riwayat KGB</h1>
          <p className="dsb-sub">
            Seluruh siklus kenaikan gaji berkala pegawai satker ini, termasuk SK lama yang direkam sebagai
            arsip. Buka satu baris untuk melihat siklus sebelumnya.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="dsb-ikon-tombol"
            onClick={() => void muat()}
            title="Muat ulang"
            aria-label="Muat ulang riwayat KGB"
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={memuat ? "dsb-putar" : undefined}
            >
              <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <Link href="/dashboard/upt/riwayat/aktivitas" className="dsb-tombol" data-jenis="garis">
            Usulan dan laporan
          </Link>
        </div>
      </header>

      {galat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">
            !
          </span>
          <p>
            {galat}{" "}
            <button type="button" className="dsb-tautan" onClick={() => void muat()}>
              Muat ulang
            </button>
          </p>
        </div>
      )}

      {memuat && !data ? (
        <div className="dsb-penuh flex flex-col gap-2" role="status" aria-label="Memuat riwayat KGB">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="dsb-kerangka" style={{ height: 52 }} />
          ))}
        </div>
      ) : (
        <section
          className="dsb-panel dsb-penuh overflow-hidden dsb-muncul"
          style={{ "--i": 1 } as React.CSSProperties}
          aria-labelledby="judul-riwayat-kgb-upt"
        >
          <div className="dsb-panel-kepala">
            <h2 id="judul-riwayat-kgb-upt" className="dsb-panel-judul">
              Riwayat KGB pegawai{" "}
              <small>
                {tampil.length} pegawai · {jumlahSiklus} siklus
              </small>
            </h2>
          </div>
          <div className="dsb-alat" style={{ padding: "12px 16px", borderBottom: "1px solid var(--ln2)" }}>
            <div className="dsb-segmen" role="group" aria-label="Saring pegawai">
              {PILIHAN.map(([v, l]) => (
                <button key={v} type="button" aria-pressed={saring === v} onClick={() => setSaring(v)}>
                  {l}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="dsb-cari"
              aria-label="Cari pegawai"
              placeholder="Cari nama, NIP, atau nomor SK"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </div>

          {tampil.length === 0 ? (
            <p className="dsb-kosong" style={{ padding: "44px 16px" }}>
              {pegawaiList.length === 0
                ? "Belum ada riwayat KGB untuk satker ini. Riwayat terisi setelah SK KGB pertama terbit, atau setelah SK lama direkam Kanwil sebagai arsip."
                : "Tidak ada pegawai yang cocok."}
            </p>
          ) : (
            <div className="dsb-gulir-tabel tbl-scroll">
              <table className="dsb-tabel" style={{ minWidth: "820px" }}>
                <thead>
                  <tr>
                    <th scope="col">Pegawai</th>
                    <th scope="col">KGB terakhir</th>
                    <th scope="col">Gaji pokok</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="kanan">
                      Siklus
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((e) => {
                    const akhir = e.kgbs[0];
                    const buka = terbuka === e.pegawaiId;
                    const alih = () => setTerbuka(buka ? null : e.pegawaiId);
                    return (
                      <Fragment key={e.pegawaiId}>
                        <tr
                          className="dsb-baris-klik"
                          tabIndex={0}
                          aria-expanded={buka}
                          onClick={alih}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter" || ev.key === " ") {
                              ev.preventDefault();
                              alih();
                            }
                          }}
                          style={{ background: buka ? "var(--sub)" : undefined }}
                        >
                          <td style={{ maxWidth: "280px" }}>
                            <p className="dsb-nama truncate" style={{ margin: 0 }}>
                              {e.pegawai.nama}
                            </p>
                            <p className="dsb-kecil truncate" style={{ margin: 0 }} title={e.pegawai.jabatan}>
                              {e.pegawai.nip}
                              {e.pegawai.jabatan ? ` · ${e.pegawai.jabatan}` : ""}
                            </p>
                          </td>
                          <td className="whitespace-nowrap">
                            TMT {fmtTgl(akhir.tmtKgbBaru)}
                            <p className="dsb-kecil" style={{ margin: 0 }}>
                              {akhir.golonganLama && akhir.golonganLama !== akhir.golonganBaru
                                ? `${akhir.golonganLama} → ${akhir.golonganBaru}`
                                : akhir.golonganBaru}
                            </p>
                          </td>
                          <td className="whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: "var(--dtn)", fontWeight: 500 }}>{fmtRp(akhir.gajiPokokBaru)}</span>
                            <p className="dsb-kecil" style={{ margin: 0 }}>
                              lama {fmtRp(akhir.gajiPokokLama)}
                            </p>
                          </td>
                          <td>
                            <StatusKgb k={akhir} />
                            {e.belumDirekam && (
                              <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-violet)" }}>
                                Belum direkam di Gaji Web
                              </p>
                            )}
                          </td>
                          <td className="kanan whitespace-nowrap">
                            <span className="dsb-kecil" style={{ marginRight: 8 }}>
                              {e.kgbs.length} siklus
                            </span>
                            <svg
                              aria-hidden="true"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              style={{
                                display: "inline-block",
                                color: "var(--dt5)",
                                transform: buka ? "rotate(180deg)" : "none",
                                transition: "transform 0.2s",
                                verticalAlign: "middle",
                              }}
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </td>
                        </tr>
                        {buka && (
                          <tr>
                            <td colSpan={5} style={{ padding: "0 16px 14px", background: "var(--sub)" }}>
                              {/* SK di luar KGB lebih dulu: saat UPT memastikan dasar gaji pokok sudah benar,
                                  SK inilah yang paling sering terlewat; KGB-nya sendiri sudah terlihat di
                                  baris ringkasan. Baca-saja; pelaporannya lewat tindakan di Pegawai Satker. */}
                              {(skDasarPegawai.get(e.pegawaiId) ?? []).length > 0 && (
                                <table className="dsb-tabel dsb-tabel-sisip" style={{ marginBottom: 10 }}>
                                  <caption>SK kenaikan pangkat dan peninjauan masa kerja, dicatat Kanwil</caption>
                                  <thead>
                                    <tr>
                                      <th scope="col">TMT</th>
                                      <th scope="col">SK</th>
                                      <th scope="col">Golongan</th>
                                      <th scope="col">Masa kerja golongan</th>
                                      <th scope="col">Gaji pokok</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(skDasarPegawai.get(e.pegawaiId) ?? []).map((s) => (
                                      <tr key={s.id}>
                                        <td className="whitespace-nowrap">{fmtTgl(s.tmt)}</td>
                                        <td>
                                          <span className="dsb-tag" data-garis="" data-nada="ungu">
                                            {s.jenis === "kp" ? "KP/PI" : "PMK"}
                                          </span>{" "}
                                          {s.nomorSK ?? "tanpa nomor"}
                                          <span className="dsb-kecil" style={{ display: "block" }}>
                                            {s.label}
                                            {s.tanggalSK ? ` · ${fmtTgl(s.tanggalSK)}` : ""}
                                          </span>
                                        </td>
                                        <td className="whitespace-nowrap">
                                          {s.golonganLama && s.golonganLama !== s.golonganBaru
                                            ? `${s.golonganLama} → ${s.golonganBaru}`
                                            : s.golonganBaru}
                                        </td>
                                        <td className="whitespace-nowrap">
                                          {fmtMkg(s.mkgTahunLama, s.mkgBulanLama)} →{" "}
                                          <span style={{ color: "var(--dtn)", fontWeight: 500 }}>
                                            {fmtMkg(s.mkgTahunBaru, s.mkgBulanBaru)}
                                          </span>
                                          {s.tmtKgbBerikutnyaBaru && (
                                            <span className="dsb-kecil" style={{ display: "block" }}>
                                              KGB berikutnya menjadi {fmtTgl(s.tmtKgbBerikutnyaBaru)}
                                            </span>
                                          )}
                                        </td>
                                        <td className="whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                                          {fmtRp(s.gajiPokokLama)} →{" "}
                                          <span style={{ color: "var(--dtn)", fontWeight: 500 }}>
                                            {fmtRp(s.gajiPokokBaru)}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              <table className="dsb-tabel dsb-tabel-sisip">
                                <thead>
                                  <tr>
                                    <th scope="col">TMT KGB</th>
                                    <th scope="col">Golongan dan MKG</th>
                                    <th scope="col">Gaji pokok</th>
                                    <th scope="col">Nomor SK</th>
                                    <th scope="col">Status</th>
                                    <th scope="col" className="kanan">
                                      <span className="sr-only">SK</span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {e.kgbs.map((k) => (
                                    <tr key={k.id}>
                                      <td className="whitespace-nowrap">{fmtTgl(k.tmtKgbBaru)}</td>
                                      <td className="whitespace-nowrap">
                                        {k.golonganLama !== k.golonganBaru
                                          ? `${k.golonganLama} → ${k.golonganBaru}`
                                          : k.golonganBaru}
                                        <span className="dsb-kecil">
                                          {" "}
                                          ·{" "}
                                          {k.mkgTahunBaru === null
                                            ? "-"
                                            : `${k.mkgTahunBaru} thn ${k.mkgBulanBaru ?? 0} bln`}
                                        </span>
                                      </td>
                                      <td className="whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {fmtRp(k.gajiPokokLama)} →{" "}
                                        <span style={{ color: "var(--dtn)", fontWeight: 500 }}>
                                          {fmtRp(k.gajiPokokBaru)}
                                        </span>
                                      </td>
                                      <td className="whitespace-nowrap">
                                        {k.nomorSurat || k.nomorSK || "-"}
                                        {k.tanggalSurat && (
                                          <span className="dsb-kecil" style={{ display: "block" }}>
                                            {fmtTgl(k.tanggalSurat)}
                                          </span>
                                        )}
                                      </td>
                                      <td>
                                        <StatusKgb k={k} />
                                        {k.rapelanDitetapkan && (
                                          <span className="dsb-kecil" style={{ display: "block", color: "var(--st-red)" }}>
                                            Dibayar sebagai rapelan
                                          </span>
                                        )}
                                        {k.gajiWebAt ? (
                                          <span className="dsb-kecil" style={{ display: "block" }}>
                                            Direkam di Gaji Web {fmtTgl(k.gajiWebAt)}
                                          </span>
                                        ) : k.status === "menunggu_keuangan" ? (
                                          <span className="dsb-kecil" style={{ display: "block", color: "var(--st-violet)" }}>
                                            Belum direkam di Gaji Web
                                          </span>
                                        ) : null}
                                      </td>
                                      <td className="kanan">
                                        {k.berkasAda ? (
                                          <a
                                            href={`/api/upt/sk/${k.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="dsb-tombol dsb-tombol-kecil"
                                            data-jenis="garis"
                                          >
                                            SK
                                          </a>
                                        ) : (
                                          <span className="dsb-kecil">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
