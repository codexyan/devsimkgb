"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { canProcessKGB } from "@/lib/auth";
import { KerangkaModal, Catatan, ModalPratinjauBerkas, PesanGalat } from "@/app/dashboard/components/kgb";
import { LABEL_JENIS_USULAN, STATUS_USULAN, type PerubahanUsulan, type StatusUsulan } from "@/lib/usulanPegawai";
import { formatTanggalId } from "@/lib/waktu";

interface Usulan {
  id: string;
  pegawaiId: string;
  nama: string;
  nip: string;
  unitKerja: string;
  status: string;
  jenis: string;
  nomorSurat: string;
  tanggalSurat: string | null;
  berkas: { medan: string; label: string }[];
  perubahan: PerubahanUsulan[];
  nilaiDiusulkan: { kunci: string; label: string; nilai: string }[];
  hukdis: string | null;
  hukdisKeterangan: string | null;
  nomorSkTerakhir: string | null;
  tanggalSkTerakhir: string | null;
  catatanUpt: string | null;
  diajukanOleh: string;
  diajukanAt: string | null;
  ditinjauOleh: string | null;
  ditinjauAt: string | null;
  alasanTolak: string | null;
}

/** Satu laporan mutasi atau pemberhentian dari UPT (lib/laporanMutasi.ts). */
interface LaporanMutasi {
  id: string;
  nama: string;
  nip: string;
  unitKerja: string;
  label: string;
  satkerTujuan: string | null;
  tmt: string | null;
  nomorSK: string | null;
  alasan: string | null;
  keterangan: string | null;
  status: string;
  catatanKanwil: string | null;
  dilaporkanOleh: string | null;
  dilaporkanAt: string | null;
}

const tgl = (iso: string | null, opsi?: Intl.DateTimeFormatOptions) =>
  iso ? formatTanggalId(new Date(iso), opsi ?? { day: "numeric", month: "short", year: "numeric" }) : "-";

const statusCfg = (status: string) => STATUS_USULAN[status as StatusUsulan] ?? { label: status, nada: "kuning" as const };

export default function UsulanPage() {
  const router = useRouter();
  const role = useRole();
  const boleh = canProcessKGB(role);

  const [daftar, setDaftar] = useState<Usulan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [saring, setSaring] = useState<"menunggu" | "semua">("menunggu");
  const [cari, setCari] = useState("");
  const [dibuka, setDibuka] = useState<string | null>(null);
  /** Berkas yang sedang dipratinjau; peninjau tidak perlu berpindah tab untuk membacanya. */
  const [pratinjau, setPratinjau] = useState<{ judul: string; subjudul: string; url: string } | null>(null);
  const [dialogKembali, setDialogKembali] = useState<Usulan | null>(null);
  const [catatanKembali, setCatatanKembali] = useState("");
  /** Persetujuan seluruh usulan pada satu surat; dikonfirmasi dulu karena tidak dapat dibatalkan. */
  const [dialogMassal, setDialogMassal] = useState<{ nomorSurat: string; satker: string; isi: Usulan[] } | null>(null);
  /** Laporan mutasi dan pemberhentian dari UPT, beserta laporan yang sedang dikembalikan. */
  const [laporan, setLaporan] = useState<LaporanMutasi[]>([]);
  const [dialogLaporan, setDialogLaporan] = useState<LaporanMutasi | null>(null);
  const [catatanLaporan, setCatatanLaporan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    const res = await fetch("/api/usulan");
    if (res.status === 403) { router.push("/dashboard"); return; }
    const d: unknown = await res.json().catch(() => []);
    setDaftar(Array.isArray(d) ? (d as Usulan[]) : []);
    const resMutasi = await fetch("/api/mutasi/laporan");
    const m: unknown = resMutasi.ok ? await resMutasi.json().catch(() => []) : [];
    setLaporan(Array.isArray(m) ? (m as LaporanMutasi[]) : []);
    setMemuat(false);
  }, [router]);

  /** Tetapkan atau kembalikan satu laporan mutasi dari UPT. */
  async function tinjauLaporan(l: LaporanMutasi, aksi: "terima" | "kembalikan", catatan?: string) {
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch(`/api/mutasi/laporan/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi, catatan: catatan ?? "" }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setGalat(d.error ?? "Laporan gagal ditinjau"); return; }
      setKabar(
        aksi === "terima"
          ? `${l.label} ${l.nama} dicatat pada data pegawai.`
          : `Laporan ${l.nama} dikembalikan ke ${l.unitKerja}.`,
      );
      setTimeout(() => setKabar(null), 7000);
      setDialogLaporan(null);
      setCatatanLaporan("");
      void muat();
    } catch {
      setGalat("Laporan gagal ditinjau");
    } finally {
      setSibuk(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  async function tinjau(u: Usulan, aksi: "setujui" | "kembalikan", catatan?: string) {
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch(`/api/usulan/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi, catatan: catatan ?? "" }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; jumlahPerubahan?: number; perluCatatHukdis?: boolean };
      if (!res.ok) { setGalat(d.error ?? "Tinjauan gagal disimpan"); return; }
      setKabar(
        aksi === "setujui"
          ? `Usulan ${u.nama} disetujui, ${d.jumlahPerubahan ?? 0} kolom diperbarui.${d.perluCatatHukdis ? " Laporan hukuman disiplinnya masih perlu dicatat di modul Hukuman Disiplin." : ""}`
          : `Usulan ${u.nama} dikembalikan ke ${u.unitKerja}. Isian dan berkasnya tetap utuh, dan catatan perbaikannya terbaca di sana.`,
      );
      setTimeout(() => setKabar(null), 7000);
      setDialogKembali(null);
      setCatatanKembali("");
      void muat();
    } catch {
      setGalat("Tinjauan gagal disimpan");
    } finally {
      setSibuk(false);
    }
  }

  /** Setujui seluruh usulan pada satu surat lewat satu permintaan. */
  async function setujuiSurat(sasaran: { nomorSurat: string; isi: Usulan[] }) {
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch("/api/usulan/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: sasaran.isi.map((u) => u.id) }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; berhasil?: number; gagal?: number; galat?: string[] };
      if (!res.ok) { setGalat(d.error ?? "Persetujuan gagal disimpan"); return; }
      setKabar(
        `${d.berhasil ?? 0} usulan pada surat ${sasaran.nomorSurat} disetujui dan diterapkan ke data pegawai.` +
          (d.gagal ? ` ${d.gagal} gagal: ${(d.galat ?? []).slice(0, 3).join("; ")}` : ""),
      );
      setTimeout(() => setKabar(null), 9000);
      setDialogMassal(null);
      void muat();
    } catch {
      setGalat("Persetujuan gagal disimpan");
    } finally {
      setSibuk(false);
    }
  }

  const menunggu = daftar.filter((u) => u.status === "menunggu");

  /**
   * Usulan menunggu yang datang pada satu surat yang sama. UPT mengirim satu surat memuat banyak
   * pegawai, dan sejak daftar pegawai dapat diunggah sekaligus jumlahnya bisa ratusan. Meninjau satu
   * per satu tetap tersedia; yang ditambahkan di sini hanya cara menyetujui seluruh surat sekali jalan.
   */
  const perSurat = useMemo(() => {
    const peta = new Map<string, Usulan[]>();
    for (const u of menunggu) {
      const kunci = u.nomorSurat?.trim();
      if (!kunci) continue;
      peta.set(kunci, [...(peta.get(kunci) ?? []), u]);
    }
    return [...peta.entries()]
      .filter(([, isi]) => isi.length > 1)
      .map(([nomorSurat, isi]) => ({
        nomorSurat,
        isi,
        satker: [...new Set(isi.map((u) => u.unitKerja))].join(", "),
      }))
      .sort((a, b) => b.isi.length - a.isi.length);
  }, [menunggu]);
  const satkerPengusul = new Set(menunggu.map((u) => u.unitKerja)).size;
  const adaHukdis = menunggu.filter((u) => u.hukdis).length;

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return daftar.filter((u) => {
      if (saring === "menunggu" && u.status !== "menunggu") return false;
      if (!q) return true;
      return `${u.nama} ${u.nip} ${u.unitKerja} ${u.nomorSurat}`.toLowerCase().includes(q);
    });
  }, [daftar, saring, cari]);

  if (!boleh) {
    return (
      <div className="dsb-halaman">
        <section className="dsb-panel">
          <p className="dsb-kosong">
            <strong style={{ color: "var(--dtn)" }}>Akses ditolak</strong>
            Tinjauan usulan UPT hanya untuk Super Admin dan Tim SDM KGB.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Data</p>
          <h1 className="dsb-halaman-judul">Usulan data dari UPT</h1>
          <p className="dsb-sub">
            UPT menginventarisir data pegawainya sendiri dan mengusulkannya ke Kanwil. Perubahan baru masuk ke data
            induk setelah disetujui di sini, sehingga masa kerja golongan dan gaji pokok yang dipakai SK berasal dari
            dokumen yang dipegang UPT.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="dsb-ikon-tombol" onClick={() => void muat()} title="Muat ulang" aria-label="Muat ulang usulan">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={memuat ? "dsb-putar" : undefined}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
          </button>
        </div>
      </header>

      {kabar && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
          <p>{kabar}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setKabar(null)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}
      {galat && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>{galat}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setGalat("")}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Menunggu tinjauan</span>
          <span className="dsb-angka-nilai" style={{ color: menunggu.length > 0 ? "var(--st-amber)" : undefined }}>
            {memuat ? "–" : menunggu.length}
          </span>
          <span className="dsb-angka-meta">{daftar.length} usulan tercatat seluruhnya</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Satuan kerja pengusul</span>
          <span className="dsb-angka-nilai">{memuat ? "–" : satkerPengusul}</span>
          <span className="dsb-angka-meta">Dihitung dari usulan yang menunggu</span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Disertai laporan hukdis</span>
          <span className="dsb-angka-nilai" style={{ color: adaHukdis > 0 ? "var(--st-red)" : undefined }}>
            {memuat ? "–" : adaHukdis}
          </span>
          <span className="dsb-angka-meta">
            {adaHukdis > 0 && <span className="dsb-titik" data-nada="merah" aria-hidden="true" />}
            {adaHukdis > 0 ? "Periksa dampaknya pada jadwal KGB" : "Tidak ada laporan hukuman disiplin"}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Sudah ditinjau</span>
          <span className="dsb-angka-nilai">{memuat ? "–" : daftar.filter((u) => u.status !== "menunggu").length}</span>
          <span className="dsb-angka-meta">
            {daftar.filter((u) => u.status === "disetujui").length} disetujui ·{" "}
            {daftar.filter((u) => u.status === "revisi").length} menunggu perbaikan UPT
          </span>
        </div>
      </div>

      <div className="dsb-dasbor-isi">
        <div className="dsb-kolom">
          {laporan.filter((l) => l.status === "menunggu").length > 0 && (
            <section className="dsb-panel dsb-penuh" aria-labelledby="judul-laporan-mutasi">
              <div className="dsb-panel-kepala">
                <h2 id="judul-laporan-mutasi" className="dsb-panel-judul">
                  Laporan mutasi dari UPT{" "}
                  <small>{laporan.filter((l) => l.status === "menunggu").length} menunggu tinjauan</small>
                </h2>
              </div>
              <ul className="dsb-log-ringkas">
                {laporan.filter((l) => l.status === "menunggu").map((l) => (
                  <li key={l.id}>
                    <span className="dsb-titik" data-nada="kuning" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="dsb-nama">{l.nama}</span>
                      <span className="dsb-kecil"> · {l.nip} · {l.unitKerja}</span>
                      <p className="dsb-kecil" style={{ margin: 0 }}>
                        <strong style={{ color: "var(--dtn)" }}>{l.label}</strong>
                        {l.satkerTujuan ? ` ke ${l.satkerTujuan}` : ""}
                        {l.alasan ? ` · ${l.alasan}` : ""}
                        {l.tmt ? ` · TMT ${tgl(l.tmt)}` : ""} · SK {l.nomorSK ?? "-"}
                      </p>
                      {l.keterangan && <p className="dsb-kecil" style={{ margin: 0 }}>{l.keterangan}</p>}
                      <p className="dsb-kecil" style={{ margin: 0 }}>
                        Dilaporkan {l.dilaporkanOleh} · {tgl(l.dilaporkanAt)}
                      </p>
                      <span className="usl-aksi" style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          className="dsb-tombol dsb-tombol-kecil"
                          data-nada="hijau"
                          disabled={sibuk}
                          onClick={() => void tinjauLaporan(l, "terima")}
                        >
                          Catat pada data pegawai
                        </button>{" "}
                        <button
                          type="button"
                          className="dsb-tombol dsb-tombol-kecil"
                          data-jenis="garis"
                          disabled={sibuk}
                          onClick={() => { setDialogLaporan(l); setCatatanLaporan(""); }}
                        >
                          Kembalikan
                        </button>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="dsb-kaki">
                <span>Mencatat langsung mengubah data pegawai; yang pindah tidak lagi diusulkan dari satker asal</span>
              </div>
            </section>
          )}
          {perSurat.length > 0 && (
            <section className="dsb-panel dsb-penuh" aria-labelledby="judul-surat-usulan">
              <div className="dsb-panel-kepala">
                <h2 id="judul-surat-usulan" className="dsb-panel-judul">
                  Setujui sekaligus <small>{perSurat.length} surat</small>
                </h2>
              </div>
              <ul className="dsb-log-ringkas">
                {perSurat.map((s) => (
                  <li key={s.nomorSurat}>
                    <span className="dsb-titik" data-nada="kuning" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="dsb-nama">{s.satker}</span>
                      <p className="dsb-kecil" style={{ margin: 0 }}>
                        Surat {s.nomorSurat} · {s.isi.length} usulan menunggu
                      </p>
                      <span className="usl-aksi" style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          className="dsb-tombol dsb-tombol-kecil"
                          data-nada="hijau"
                          disabled={sibuk}
                          onClick={() => setDialogMassal(s)}
                        >
                          Setujui {s.isi.length} usulan surat ini
                        </button>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="dsb-kaki">
                <span>Periksa berkasnya lebih dulu; persetujuan langsung menimpa data pegawai</span>
              </div>
            </section>
          )}
          <section className="dsb-panel dsb-penuh">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">
                Antrian usulan <small>{tampil.length} tampil</small>
              </h2>
              <div className="dsb-alat">
                <div className="dsb-segmen" role="group" aria-label="Saring status usulan">
                  <button type="button" aria-pressed={saring === "menunggu"} onClick={() => setSaring("menunggu")}>Menunggu</button>
                  <button type="button" aria-pressed={saring === "semua"} onClick={() => setSaring("semua")}>Semua</button>
                </div>
                <input
                  type="search"
                  className="dsb-cari"
                  aria-label="Cari usulan"
                  placeholder="Cari nama, NIP, satker, atau nomor surat…"
                  value={cari}
                  onChange={(e) => setCari(e.target.value)}
                />
              </div>
            </div>

            {memuat ? (
              <p className="dsb-kosong">Memuat usulan…</p>
            ) : tampil.length === 0 ? (
              <p className="dsb-kosong">
                {saring === "menunggu"
                  ? "Tidak ada usulan yang menunggu tinjauan."
                  : "Belum ada usulan dari UPT."}
              </p>
            ) : (
              <div className="dsb-gulir">
                <ul className="usl-daftar">
                  {tampil.map((u) => {
                    const cfg = statusCfg(u.status);
                    const terbuka = dibuka === u.id;
                    return (
                      <li key={u.id} className="usl-item">
                        <button
                          type="button"
                          className="usl-kepala"
                          aria-expanded={terbuka}
                          onClick={() => setDibuka(terbuka ? null : u.id)}
                        >
                          <span className="min-w-0">
                            <span className="dsb-nama">{u.nama}</span>
                            <span className="dsb-kecil"> · {u.nip}</span>
                            <span className="dsb-kecil usl-baris2">
                              {u.unitKerja} · surat {u.nomorSurat} ({tgl(u.tanggalSurat)})
                            </span>
                          </span>
                          <span className="usl-tanda">
                            <span className="dsb-tag" data-garis="" data-nada={cfg.nada}>
                              <span className="dsb-titik" data-nada={cfg.nada} aria-hidden="true" />
                              {cfg.label}
                            </span>
                            {u.jenis === "baru" && (
                              <span className="dsb-tag" data-garis="" data-nada="hijau">{LABEL_JENIS_USULAN.baru}</span>
                            )}
                            <span className="dsb-tag" data-garis="">
                              {/* Usulan pegawai baru tidak punya pembanding, jadi yang dihitung nilai yang diusulkan. */}
                              {(u.perubahan.length || u.nilaiDiusulkan.length)} kolom
                            </span>
                            {u.hukdis && <span className="dsb-tag" data-garis="" data-nada="merah">Hukdis</span>}
                          </span>
                        </button>

                        {terbuka && (
                          <div className="usl-isi">
                            {u.jenis === "baru" && (
                              <Catatan nada="hijau">
                                Pegawai ini belum tercatat di SIM-KGB. Menyetujui usulan akan menambahkannya ke data
                                induk beserta jadwal KGB-nya, jadi periksa NIP, golongan, masa kerja golongan, dan TMT
                                terhadap berkas yang dilampirkan.
                              </Catatan>
                            )}
                            {u.perubahan.length > 0 ? (
                              <table className="dsb-tabel dsb-tabel-sisip">
                                <thead>
                                  <tr>
                                    <th scope="col">Kolom</th>
                                    <th scope="col">Tercatat sekarang</th>
                                    <th scope="col">Diusulkan UPT</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {u.perubahan.map((p) => (
                                    <tr key={p.kunci}>
                                      <td>{p.label}</td>
                                      <td className="dsb-kecil">{p.sekarang}</td>
                                      <td style={{ fontWeight: 600, color: "var(--dtn)" }}>{p.diusulkan}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : u.nilaiDiusulkan.length > 0 ? (
                              <table className="dsb-tabel dsb-tabel-sisip">
                                <thead>
                                  <tr>
                                    <th scope="col">Kolom</th>
                                    <th scope="col">Nilai yang diusulkan</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {u.nilaiDiusulkan.map((n) => (
                                    <tr key={n.kunci}>
                                      <td>{n.label}</td>
                                      <td style={{ fontWeight: 600, color: "var(--dtn)" }}>{n.nilai}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <Catatan>Tidak ada kolom data yang diusulkan berubah.</Catatan>
                            )}

                            {(u.nomorSkTerakhir || u.tanggalSkTerakhir) && (
                              <p className="dsb-kecil">
                                Dasar: SK terakhir {u.nomorSkTerakhir ?? "-"} tanggal {tgl(u.tanggalSkTerakhir)}
                              </p>
                            )}
                            {u.hukdis && (
                              <Catatan nada="merah">
                                Laporan hukuman disiplin: {u.hukdis}
                                {u.hukdisKeterangan ? `. ${u.hukdisKeterangan}` : ""}. Menyetujui usulan ini tidak
                                membuat catatan hukuman disiplin; catat sendiri di modul Hukuman Disiplin agar
                                penundaan KGB-nya berlaku.
                              </Catatan>
                            )}
                            {u.catatanUpt && <p className="dsb-kecil">Catatan UPT: {u.catatanUpt}</p>}
                            <p className="dsb-kecil">
                              Diajukan {u.diajukanOleh} · {tgl(u.diajukanAt)}
                              {u.ditinjauAt ? ` · ditinjau ${u.ditinjauOleh} ${tgl(u.ditinjauAt)}` : ""}
                            </p>
                            {u.alasanTolak && (
                              <Catatan nada="amber">
                                {u.status === "revisi" ? "Dikembalikan untuk diperbaiki: " : "Alasan penolakan: "}
                                {u.alasanTolak}
                              </Catatan>
                            )}

                            <div className="usl-aksi">
                              {u.berkas.map((b) => (
                                <button
                                  key={b.medan}
                                  type="button"
                                  className="dsb-tombol dsb-tombol-kecil"
                                  data-jenis="garis"
                                  onClick={() =>
                                    setPratinjau({
                                      judul: b.label,
                                      subjudul: `${u.nama} · surat ${u.nomorSurat}`,
                                      url: `/api/usulan/${u.id}/berkas?berkas=${b.medan}`,
                                    })
                                  }
                                >
                                  {b.label}
                                </button>
                              ))}
                              {u.status === "menunggu" && (
                                <>
                                  <button type="button" className="dsb-tombol dsb-tombol-kecil" data-nada="hijau" disabled={sibuk} onClick={() => void tinjau(u, "setujui")}>
                                    Setujui dan terapkan
                                  </button>
                                  <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" disabled={sibuk} onClick={() => { setDialogKembali(u); setCatatanKembali(""); }}>
                                    Kembalikan untuk revisi
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </div>

        <aside className="dsb-samping" data-urutan="tetap">
          <section className="dsb-panel dsb-penuh">
            <div className="dsb-panel-kepala">
              <h2 className="dsb-panel-judul">Cara meninjau</h2>
            </div>
            <div className="dsb-gulir dsb-panel-isi">
              <ul className="dsb-jadwal">
                <li>
                  <strong>Cocokkan dengan suratnya</strong>
                  <p className="dsb-kecil">Buka berkas surat usulan, lalu bandingkan masa kerja golongan dan gaji pokok dengan SK terakhir yang disebut UPT.</p>
                </li>
                <li>
                  <strong>Setujui bila sudah sesuai</strong>
                  <p className="dsb-kecil">Kolom yang diusulkan langsung menimpa data pegawai, dan perubahannya tercatat di log aktivitas.</p>
                </li>
                <li>
                  <strong>Kembalikan bila perlu diperbaiki</strong>
                  <p className="dsb-kecil">
                    Usulannya berpindah kembali ke UPT dengan isian dan berkas yang utuh, disertai catatan Anda tentang apa
                    yang harus dibetulkan. UPT menyunting seperlunya lalu mengirim ulang, tidak menyusun dari nol.
                  </p>
                </li>
                <li>
                  <strong>Usulan yang memang keliru</strong>
                  <p className="dsb-kecil">
                    Kembalikan juga, dengan catatan agar UPT menghapusnya. Mereka yang tahu duduk perkaranya, dan pegawainya
                    baru bebas diusulkan lagi setelah usulan yang menggantung itu ditutup.
                  </p>
                </li>
                <li>
                  <strong>Hukuman disiplin dicatat terpisah</strong>
                  <p className="dsb-kecil">Laporan dari UPT hanya pemberitahuan. Penundaan KGB baru berlaku setelah dicatat di modul Hukuman Disiplin oleh SDM Hukdis.</p>
                </li>
              </ul>
            </div>
          </section>
        </aside>
      </div>


      {pratinjau && (
        <ModalPratinjauBerkas
          judul={pratinjau.judul}
          subjudul={pratinjau.subjudul}
          url={pratinjau.url}
          onTutup={() => setPratinjau(null)}
        />
      )}
      {dialogLaporan && (
        <KerangkaModal
          judul="Kembalikan laporan mutasi"
          subjudul={`${dialogLaporan.nama} · ${dialogLaporan.unitKerja}`}
          ukuran="sm"
          sibuk={sibuk}
          onTutup={() => setDialogLaporan(null)}
          onKirim={() => void tinjauLaporan(dialogLaporan, "kembalikan", catatanLaporan)}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogLaporan(null)} disabled={sibuk}>
                Batal
              </button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk || !catatanLaporan.trim()}>
                {sibuk ? "Menyimpan…" : "Kembalikan"}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galat || null} />
          <label className="kgbm-label">
            <span className="kgbm-wajib">Apa yang harus diperbaiki</span>
            <textarea
              className="kgbm-input"
              data-autofocus
              rows={3}
              value={catatanLaporan}
              onChange={(e) => setCatatanLaporan(e.target.value)}
              placeholder="Misalnya: nomor SK tidak sesuai, atau TMT berlakunya berbeda dengan SK"
            />
          </label>
          <Catatan>
            Data pegawai tidak berubah. Laporannya kembali ke daftar UPT beserta catatan ini, dan mereka dapat
            membatalkannya lalu mengirim ulang setelah dibetulkan.
          </Catatan>
        </KerangkaModal>
      )}

      {dialogMassal && (
        <KerangkaModal
          judul="Setujui seluruh usulan pada surat ini"
          subjudul={`${dialogMassal.satker} · surat ${dialogMassal.nomorSurat}`}
          ukuran="sm"
          sibuk={sibuk}
          onTutup={() => setDialogMassal(null)}
          onKirim={() => void setujuiSurat(dialogMassal)}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogMassal(null)} disabled={sibuk}>
                Batal
              </button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
                {sibuk ? "Menerapkan…" : `Setujui ${dialogMassal.isi.length} usulan`}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galat || null} />
          <Catatan nada="amber">
            Seluruh {dialogMassal.isi.length} usulan pada surat ini langsung diterapkan ke data pegawai dan tidak
            dapat dibatalkan. Pastikan berkas suratnya sudah diperiksa. Usulan yang perlu diperbaiki lebih baik
            dikembalikan satu per satu lebih dulu, sebab persetujuan ini tidak memilah.
          </Catatan>
          <ul className="dsb-log-ringkas">
            {dialogMassal.isi.slice(0, 8).map((u) => (
              <li key={u.id}>
                <span className="dsb-titik" data-nada="kuning" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="dsb-nama">{u.nama}</span>
                  <span className="dsb-kecil"> · {u.nip}</span>
                </span>
              </li>
            ))}
          </ul>
          {dialogMassal.isi.length > 8 && (
            <p className="dsb-kecil">dan {dialogMassal.isi.length - 8} pegawai lainnya.</p>
          )}
        </KerangkaModal>
      )}

      {dialogKembali && (
        <KerangkaModal
          judul="Kembalikan untuk revisi"
          subjudul={`${dialogKembali.nama} · ${dialogKembali.unitKerja}`}
          ukuran="sm"
          sibuk={sibuk}
          onTutup={() => setDialogKembali(null)}
          onKirim={() => void tinjau(dialogKembali, "kembalikan", catatanKembali)}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogKembali(null)} disabled={sibuk}>Batal</button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk || !catatanKembali.trim()}>
                {sibuk ? "Menyimpan…" : "Kembalikan"}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galat || null} />
          <label className="kgbm-label">
            <span className="kgbm-wajib">Apa yang harus diperbaiki</span>
            <textarea
              className="kgbm-input"
              data-autofocus
              rows={3}
              value={catatanKembali}
              onChange={(e) => setCatatanKembali(e.target.value)}
              placeholder="Misalnya: gaji pokok tidak sesuai SK terakhir yang dilampirkan"
            />
          </label>
          <Catatan>
            Usulan ini kembali ke daftar kerja UPT dengan isian dan berkas yang utuh. Catatan di atas yang mereka baca,
            jadi sebutkan kolom atau berkas yang keliru, bukan sekadar bahwa usulannya belum sesuai.
          </Catatan>
        </KerangkaModal>
      )}

      <style href="sim-kgb-usulan" precedence="default">{GAYA}</style>
    </div>
  );
}

const GAYA = `
.usl-daftar { margin: 0; padding: 0; list-style: none; }
.usl-item { border-bottom: 1px solid var(--ln2); }
.usl-item:last-child { border-bottom: 0; }
.usl-kepala {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  width: 100%; padding: 11px 16px; border: 0; background: transparent;
  font-family: inherit; font-size: 13px; text-align: left; color: var(--dt2); cursor: pointer;
}
.usl-kepala:hover { background: var(--sub); }
.usl-kepala[aria-expanded="true"] { background: var(--tint-navy); }
.usl-baris2 { display: block; }
.usl-tanda { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px; }
.usl-isi { display: grid; gap: 10px; padding: 4px 16px 14px; }
.usl-isi .dsb-tabel-sisip { width: 100%; }
.usl-aksi { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 640px) { .usl-kepala { flex-direction: column; align-items: flex-start; } .usl-tanda { justify-content: flex-start; } }
`;
