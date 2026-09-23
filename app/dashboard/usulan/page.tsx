"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { canProcessKGB } from "@/lib/auth";
import { KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import { STATUS_USULAN, type PerubahanUsulan, type StatusUsulan } from "@/lib/usulanPegawai";
import { formatTanggalId } from "@/lib/waktu";

interface Usulan {
  id: string;
  pegawaiId: string;
  nama: string;
  nip: string;
  unitKerja: string;
  status: string;
  nomorSurat: string;
  tanggalSurat: string | null;
  berkasAda: boolean;
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
  const [dialogTolak, setDialogTolak] = useState<Usulan | null>(null);
  const [alasanTolak, setAlasanTolak] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    const res = await fetch("/api/usulan");
    if (res.status === 403) { router.push("/dashboard"); return; }
    const d: unknown = await res.json().catch(() => []);
    setDaftar(Array.isArray(d) ? (d as Usulan[]) : []);
    setMemuat(false);
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  async function tinjau(u: Usulan, aksi: "setujui" | "tolak", alasan?: string) {
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch(`/api/usulan/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi, alasanTolak: alasan ?? "" }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; jumlahPerubahan?: number; perluCatatHukdis?: boolean };
      if (!res.ok) { setGalat(d.error ?? "Tinjauan gagal disimpan"); return; }
      setKabar(
        aksi === "setujui"
          ? `Usulan ${u.nama} disetujui, ${d.jumlahPerubahan ?? 0} kolom diperbarui.${d.perluCatatHukdis ? " Laporan hukuman disiplinnya masih perlu dicatat di modul Hukuman Disiplin." : ""}`
          : `Usulan ${u.nama} ditolak. Alasannya terlihat oleh UPT pengusul.`,
      );
      setTimeout(() => setKabar(null), 7000);
      setDialogTolak(null);
      setAlasanTolak("");
      void muat();
    } catch {
      setGalat("Tinjauan gagal disimpan");
    } finally {
      setSibuk(false);
    }
  }

  const menunggu = daftar.filter((u) => u.status === "menunggu");
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
            {daftar.filter((u) => u.status === "disetujui").length} disetujui · {daftar.filter((u) => u.status === "ditolak").length} ditolak
          </span>
        </div>
      </div>

      <div className="dsb-dasbor-isi">
        <div className="dsb-kolom">
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
                            <span className="dsb-tag" data-garis="">
                              {(u.status === "menunggu" ? u.perubahan.length : u.nilaiDiusulkan.length)} kolom
                            </span>
                            {u.hukdis && <span className="dsb-tag" data-garis="" data-nada="merah">Hukdis</span>}
                          </span>
                        </button>

                        {terbuka && (
                          <div className="usl-isi">
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
                            {u.alasanTolak && <Catatan nada="amber">Alasan penolakan: {u.alasanTolak}</Catatan>}

                            <div className="usl-aksi">
                              {u.berkasAda && (
                                <a className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" href={`/api/usulan/${u.id}/berkas`} target="_blank" rel="noopener noreferrer">
                                  Lihat surat
                                </a>
                              )}
                              {u.status === "menunggu" && (
                                <>
                                  <button type="button" className="dsb-tombol dsb-tombol-kecil" data-nada="hijau" disabled={sibuk} onClick={() => void tinjau(u, "setujui")}>
                                    Setujui dan terapkan
                                  </button>
                                  <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" disabled={sibuk} onClick={() => { setDialogTolak(u); setAlasanTolak(""); }}>
                                    Tolak
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
                  <strong>Tolak dengan alasan</strong>
                  <p className="dsb-kecil">Alasannya terlihat oleh UPT pengusul, sehingga mereka dapat memperbaiki dan mengirim ulang.</p>
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

      {dialogTolak && (
        <KerangkaModal
          judul="Tolak usulan"
          subjudul={`${dialogTolak.nama} · ${dialogTolak.unitKerja}`}
          nada="merah"
          ukuran="sm"
          sibuk={sibuk}
          onTutup={() => setDialogTolak(null)}
          onKirim={() => void tinjau(dialogTolak, "tolak", alasanTolak)}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogTolak(null)} disabled={sibuk}>Batal</button>
              <button type="submit" className="kgbm-tombol kgbm-bahaya" disabled={sibuk || !alasanTolak.trim()}>
                {sibuk ? "Menyimpan…" : "Tolak usulan"}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galat || null} />
          <label className="kgbm-label">
            <span className="kgbm-wajib">Alasan penolakan</span>
            <textarea
              className="kgbm-input"
              data-autofocus
              rows={3}
              value={alasanTolak}
              onChange={(e) => setAlasanTolak(e.target.value)}
              placeholder="Misalnya: gaji pokok tidak sesuai SK terakhir yang dilampirkan"
            />
          </label>
          <Catatan>Alasan ini ditampilkan kepada UPT pengusul agar dapat diperbaiki dan dikirim ulang.</Catatan>
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
