"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashUser } from "@/app/dashboard/components/RoleContext";
import { PanelNavy, Stat, StripStat, namaSapaan, sapaanWita, tanggalPanjangWita, type Nada } from "@/app/dashboard/components/PanelNavy";
import { formatTanggalId, hariIniWita, tanggalKalender } from "@/lib/waktu";
import { hitungDeadlineSDM } from "@/lib/tabelGaji";
import { kunciBulanTmt, type RekapStatusKgb } from "@/lib/rekapKgb";
import { geserBulan, namaBulan, namaTampilSatker, LABEL_JENIS_SATKER } from "@/app/dashboard/satker/labelSatker";
import type { Satker } from "@/lib/satker";

/* Dashboard Admin UPT: satu halaman berisi jadwal pengiriman surat usulan, daftar pegawai satker dengan status
   KGB-nya di Kanwil, dan SK yang sudah selesai untuk diunduh. Seluruh datanya dari /api/upt, yang membatasi
   isinya ke satker akun. Peran ini hanya melihat: tidak ada tombol yang mengubah data, dan hukuman disiplin
   hanya tampil sebagai "KGB ditunda". */

interface PegawaiUpt {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  golonganRuang: string;
  gajiPokok: number;
  tmtKgb: string | null;
  bulanTmt: string | null;
  deadlineSDM: string | null;
  terkunci: boolean;
  statusKGB: string | null;
  terlambat: boolean;
  kgbDitunda: boolean;
}

interface SkUpt {
  id: string;
  pegawaiId: string;
  nama: string;
  nip: string;
  tmtKgbBaru: string | null;
  golonganBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  nomorSurat: string | null;
  tanggalSurat: string | null;
  konfirmasiKeuanganAt: string | null;
  rapelan: boolean;
  berkasAda: boolean;
}

interface DataUpt {
  satker: Satker;
  pegawaiAktif: number;
  kgbDitunda: number;
  tahunIni: RekapStatusKgb | null;
  terlambat: number;
  mendatang: { bulanTmt: string; jumlah: number }[];
  pegawai: PegawaiUpt[];
  sk: SkUpt[];
}

type Saring = "semua" | "usulkan" | "proses" | "selesai";

const fmtRp = (n: number | null | undefined) => (typeof n === "number" ? "Rp " + n.toLocaleString("id-ID") : "-");
const fmtTgl = (s: string | null | undefined) => (s ? formatTanggalId(s, { day: "numeric", month: "short", year: "numeric" }) : "-");

/** Bulan TMT yang suratnya dikirim bulan ini: surat UPT dikirim pada bulan ketiga sebelum TMT. */
function bulanUsulanSekarang(hariIni: Date): string {
  return geserBulan(kunciBulanTmt(hariIni) ?? "", 3);
}

/** Keadaan KGB satu pegawai dari kacamata UPT. */
function keadaan(p: PegawaiUpt): { teks: string; nada?: Nada } {
  if (p.statusKGB === "selesai") return { teks: "Selesai", nada: "hijau" };
  if (p.statusKGB === "menunggu_keuangan") return { teks: "Menunggu konfirmasi keuangan", nada: "ungu" };
  if (p.statusKGB === "sedang_diproses") return { teks: "Sedang diproses Kanwil", nada: "navy" };
  if (p.terkunci) return { teks: "Belum masuk jadwal" };
  if (p.terlambat) return { teks: "Lewat batas input Kanwil", nada: "merah" };
  return { teks: "Menunggu diproses Kanwil", nada: "kuning" };
}

export default function DashboardUpt() {
  const dashUser = useDashUser();
  const [hariIni] = useState(() => hariIniWita());
  const [data, setData] = useState<DataUpt | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [segar, setSegar] = useState<Date | null>(null);
  const [saring, setSaring] = useState<Saring>("semua");
  const [cari, setCari] = useState("");

  function muat() {
    setMemuat(true);
    fetch("/api/upt")
      .then(async (r) => {
        const d = (await r.json()) as DataUpt & { error?: string };
        if (!r.ok) throw new Error(d.error ?? "Data gagal dimuat");
        setData(d);
        setGalat(null);
        setSegar(new Date());
      })
      .catch((e: unknown) => setGalat(e instanceof Error ? e.message : "Data gagal dimuat"))
      .finally(() => setMemuat(false));
  }

  useEffect(() => {
    const t = setTimeout(muat, 0);
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") muat();
    }, 120_000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);

  const bulanUsulan = bulanUsulanSekarang(hariIni);
  const pegawai = useMemo(() => data?.pegawai ?? [], [data]);
  const perluDiusulkan = pegawai.filter((p) => p.bulanTmt === bulanUsulan);
  const sedangDiproses = pegawai.filter((p) => p.statusKGB === "sedang_diproses" || p.statusKGB === "menunggu_keuangan");

  const q = cari.trim().toLowerCase();
  const tampil = useMemo(
    () =>
      pegawai.filter((p) => {
        if (saring === "usulkan" && p.bulanTmt !== bulanUsulan) return false;
        if (saring === "proses" && !(p.statusKGB === "sedang_diproses" || p.statusKGB === "menunggu_keuangan")) return false;
        if (saring === "selesai" && p.statusKGB !== "selesai") return false;
        return !q || p.nama.toLowerCase().includes(q) || p.nip.includes(q) || p.jabatan.toLowerCase().includes(q);
      }),
    [pegawai, saring, q, bulanUsulan],
  );
  const jumlah = (s: Saring) =>
    s === "semua" ? pegawai.length
    : s === "usulkan" ? perluDiusulkan.length
    : s === "proses" ? sedangDiproses.length
    : pegawai.filter((p) => p.statusKGB === "selesai").length;

  const skSelesai = data?.sk ?? [];
  const skBerkas = skSelesai.filter((s) => s.berkasAda);
  const nama = namaSapaan(dashUser.nama, "Admin UPT");
  const tahunIni = data?.tahunIni;
  const pctSelesai = tahunIni && tahunIni.total > 0 ? Math.round((tahunIni.selesai / tahunIni.total) * 100) : 0;

  if (galat && !data) {
    return (
      <div className="dsb-halaman">
        <div className="dsb-panel dsb-kosong" style={{ padding: "56px 20px" }} role="alert">
          <p className="dsb-nama" style={{ margin: 0 }}>Dashboard tidak dapat dibuka</p>
          <p style={{ margin: 0 }}>{galat}</p>
          <button type="button" className="dsb-tombol" onClick={muat}>Coba lagi</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <PanelNavy
        label="Dashboard Admin UPT"
        judul={`${sapaanWita()}${nama ? `, ${nama}` : ""}`}
        sub={
          <>
            {tanggalPanjangWita()}
            {data && <> · {namaTampilSatker(data.satker)} · {LABEL_JENIS_SATKER[data.satker.jenis]} · KPPN {data.satker.kppn}</>}
          </>
        }
        diperbarui={segar}
        onMuatUlang={muat}
        memuat={memuat}
      >
        <StripStat>
          <Stat
            label="Usulan dikirim bulan ini"
            angka={perluDiusulkan.length}
            satuan={`pegawai TMT ${namaBulan(bulanUsulan)}`}
            meta={perluDiusulkan.length > 0 ? "Kirim surat usulan ke Kanwil lewat Srikandi" : "Tidak ada yang perlu diusulkan bulan ini"}
            metaNada={perluDiusulkan.length > 0 ? "kuning" : "hijau"}
            sorot={perluDiusulkan.length > 0}
          />
          <Stat
            label="Sedang diproses Kanwil"
            angka={sedangDiproses.length}
            meta={sedangDiproses.length > 0 ? "SK sedang dibuat atau menunggu keuangan" : "Tidak ada yang sedang diproses"}
          />
          <Stat
            label={`Selesai TMT ${hariIni.getFullYear()}`}
            angka={tahunIni?.selesai ?? 0}
            satuan={tahunIni ? `/ ${tahunIni.total} · ${pctSelesai}%` : undefined}
            progres={pctSelesai}
            meta={skBerkas.length > 0 ? `${skBerkas.length} SK dapat diunduh` : skSelesai.length > 0 ? "Berkas SK belum diunggah Tim SDM" : "Belum ada SK yang terbit"}
          />
          <Stat
            label="KGB ditunda"
            angka={data?.kgbDitunda ?? 0}
            meta={(data?.kgbDitunda ?? 0) > 0 ? "Karena hukuman disiplin yang masih berlaku" : "Tidak ada KGB yang ditunda"}
            metaNada={(data?.kgbDitunda ?? 0) > 0 ? "merah" : "hijau"}
          />
        </StripStat>
      </PanelNavy>

      <div className="dsb-dasbor-isi">
        {/* Pegawai dan status KGB-nya di Kanwil */}
        <section className="dsb-panel dsb-antrian overflow-hidden dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="judul-pegawai-upt">
          <div className="dsb-panel-kepala">
            <h2 id="judul-pegawai-upt" className="dsb-panel-judul">
              Pegawai dan KGB <small>{tampil.length} dari {pegawai.length}</small>
            </h2>
          </div>
          <div className="dsb-alat" style={{ padding: "10px 16px", borderBottom: "1px solid var(--ln2)" }}>
            <div className="dsb-segmen" role="group" aria-label="Saring pegawai">
              {([
                ["semua", "Semua"],
                ["usulkan", `Diusulkan ${namaBulan(bulanUsulan)}`],
                ["proses", "Diproses Kanwil"],
                ["selesai", "Selesai"],
              ] as [Saring, string][]).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={saring === v} onClick={() => setSaring(v)}>
                  {l} {data && <span style={{ color: "var(--dt5)" }}>{jumlah(v)}</span>}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="dsb-cari"
              style={{ flex: "0 1 200px", marginLeft: "auto" }}
              aria-label="Cari pegawai"
              placeholder="Cari nama, NIP, jabatan"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </div>

          {memuat && !data ? (
            <div className="flex flex-col gap-2" style={{ padding: "16px" }} role="status" aria-label="Memuat data">
              {[1, 2, 3, 4].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 44, borderRadius: 8 }} />)}
            </div>
          ) : tampil.length === 0 ? (
            <p className="dsb-kosong" style={{ padding: "44px 16px" }}>
              {pegawai.length === 0 ? "Belum ada pegawai satker ini di SIM-KGB." : "Tidak ada pegawai yang cocok dengan saringan."}
            </p>
          ) : (
            <div className="dsb-antrian-gulir">
              <table className="dsb-tabel" style={{ minWidth: "720px" }}>
                <thead>
                  <tr>
                    <th scope="col">Pegawai</th>
                    <th scope="col">KGB berikutnya</th>
                    <th scope="col">Gaji pokok</th>
                    <th scope="col">Status di Kanwil</th>
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((p) => {
                    const k = keadaan(p);
                    const bulanKirim = p.bulanTmt ? geserBulan(p.bulanTmt, -3) : null;
                    const tmt = tanggalKalender(p.tmtKgb);
                    const batas = tmt ? hitungDeadlineSDM(tmt) : null;
                    return (
                      <tr key={p.id}>
                        <td style={{ maxWidth: "240px" }}>
                          <p className="dsb-nama truncate" style={{ margin: 0 }}>{p.nama}</p>
                          <p className="dsb-kecil truncate" style={{ margin: 0 }} title={p.jabatan}>{p.nip} · {p.golonganRuang} · {p.jabatan}</p>
                        </td>
                        <td className="whitespace-nowrap">
                          {p.tmtKgb ? formatTanggalId(p.tmtKgb, { month: "short", year: "numeric" }) : "-"}
                          {bulanKirim && (
                            <p className="dsb-kecil" style={{ margin: 0, color: p.bulanTmt === bulanUsulan ? "var(--st-amber)" : undefined }}>
                              {p.bulanTmt === bulanUsulan ? "usulkan bulan ini" : `usulkan ${namaBulan(bulanKirim)}`}
                              {batas && !p.terkunci ? ` · batas Kanwil ${formatTanggalId(batas, { day: "numeric", month: "short" })}` : ""}
                            </p>
                          )}
                        </td>
                        <td className="whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>{fmtRp(p.gajiPokok)}</td>
                        <td>
                          <span className="dsb-status" data-nada={k.nada === "merah" ? "merah" : undefined}>
                            <span className="dsb-titik" data-nada={k.nada} aria-hidden="true" />
                            {k.teks}
                          </span>
                          {p.kgbDitunda && <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-red)" }}>KGB ditunda</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="dsb-kaki">
            <span>Urut TMT terdekat · data diperbarui Tim SDM Kanwil</span>
            <span>Surat usulan dikirim lewat Srikandi</span>
          </div>
        </section>

        <aside className="dsb-samping dsb-muncul" data-urutan="tetap" style={{ "--i": 2 } as React.CSSProperties} aria-label="Jadwal usulan dan SK">
          {/* SK yang sudah selesai; hanya yang sudah dikonfirmasi keuangan yang muncul di sini */}
          <section className="dsb-panel dsb-susut" aria-labelledby="judul-sk-upt">
            <div className="dsb-panel-kepala">
              <h2 id="judul-sk-upt" className="dsb-panel-judul">
                SK terbit <small>{skSelesai.length}{skBerkas.length < skSelesai.length ? ` · ${skBerkas.length} siap diunduh` : ""}</small>
              </h2>
            </div>
            {skSelesai.length === 0 ? (
              <p className="dsb-kosong" style={{ padding: "18px 16px" }}>
                {memuat && !data ? "Memuat…" : "Belum ada SK yang selesai dikonfirmasi keuangan."}
              </p>
            ) : (
              <ul className="dsb-log-ringkas dsb-gulir">
                {skSelesai.map((s) => (
                  <li key={s.id}>
                    <span className="dsb-titik" data-nada="hijau" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="dsb-nama truncate" style={{ display: "block" }}>{s.nama}</span>
                      <span className="dsb-kecil">
                        TMT {fmtTgl(s.tmtKgbBaru)} · {s.golonganBaru} · {fmtRp(s.gajiPokokBaru)}
                        {s.rapelan && <span style={{ color: "var(--st-red)" }}> · rapelan</span>}
                      </span>
                      {s.berkasAda ? (
                        <a
                          href={`/api/upt/sk/${s.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="dsb-tautan"
                          style={{ marginTop: 4 }}
                        >
                          Unduh SK {s.nomorSurat ? `${s.nomorSurat} ` : ""}→
                        </a>
                      ) : (
                        <span className="dsb-kecil" style={{ display: "block", marginTop: 2 }}>
                          {s.nomorSurat ? `${s.nomorSurat} · ` : ""}berkas belum diunggah Tim SDM
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Kapan surat usulan dikirim untuk bulan TMT berikutnya */}
          <section className="dsb-panel dsb-penuh" aria-labelledby="judul-jadwal-upt">
            <div className="dsb-panel-kepala">
              <h2 id="judul-jadwal-upt" className="dsb-panel-judul">Jadwal usulan <small>enam bulan ke depan</small></h2>
            </div>
            {(data?.mendatang ?? []).filter((m) => m.jumlah > 0).length === 0 ? (
              <p className="dsb-kosong" style={{ padding: "18px 16px" }}>
                {memuat && !data ? "Memuat…" : "Tidak ada KGB dalam enam bulan ke depan."}
              </p>
            ) : (
              <ul className="dsb-jadwal dsb-gulir" style={{ padding: "4px 16px 12px" }}>
                {(data?.mendatang ?? []).filter((m) => m.jumlah > 0).map((m) => {
                  const [y, b] = m.bulanTmt.split("-").map(Number);
                  const batas = hitungDeadlineSDM(new Date(y, b - 1, 1));
                  const kirim = geserBulan(m.bulanTmt, -3);
                  const sekarang = m.bulanTmt === bulanUsulan;
                  return (
                    <li key={m.bulanTmt}>
                      <span>
                        KGB berlaku <strong>{namaBulan(m.bulanTmt, true)}</strong>
                        {sekarang && <span className="dsb-tag" data-garis="" style={{ marginLeft: 6, color: "var(--st-amber)" }}>kirim bulan ini</span>}
                      </span>
                      <span className="dsb-tag" data-garis="">{m.jumlah} pegawai</span>
                      <span className="dsb-kecil">
                        Surat UPT dikirim {namaBulan(kirim, true)}, diterima Kanwil paling lambat awal {namaBulan(geserBulan(m.bulanTmt, -2), true)}.
                        Batas input Tim SDM {formatTanggalId(batas, { day: "numeric", month: "long" })}.
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
