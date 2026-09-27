"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { canProcessKGB } from "@/lib/auth";
import { KerangkaModal, Catatan, PesanGalat } from "@/app/dashboard/components/kgb";
import DetailUsulan, { type UsulanKanwil } from "@/app/dashboard/components/usulan/DetailUsulan";
import { LABEL_JENIS_USULAN, STATUS_USULAN, type StatusUsulan } from "@/lib/usulanPegawai";
import { cariSatker } from "@/lib/satker";
import { namaRingkasSatker } from "@/app/dashboard/satker/labelSatker";
import { formatTanggalId } from "@/lib/waktu";

/* Usulan UPT (ADR-014): daftar usulan dikelompokkan per surat di kiri, detail usulan terpilih di kanan.
   Detailnya sama dengan jendela tinjauan di antrian kerja (DetailUsulan): perubahan lama → baru, dampaknya
   pada KGB yang berjalan, laporan hukdis, dan pratinjau berkas di tempat. Laporan mutasi dari UPT punya
   tabnya sendiri dengan susunan yang sama. */

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

type Tab = "menunggu" | "revisi" | "selesai" | "mutasi";

const tgl = (iso: string | null | undefined) => (iso ? formatTanggalId(iso, { day: "numeric", month: "short", year: "numeric" }) : "-");
const statusCfg = (status: string) => STATUS_USULAN[status as StatusUsulan] ?? { label: status, nada: "kuning" as const };
const ringkas = (unitKerja: string) => {
  const s = cariSatker(unitKerja);
  return s ? namaRingkasSatker(s) : unitKerja;
};

function cocokTab(u: UsulanKanwil, tab: Tab): boolean {
  if (tab === "menunggu") return u.status === "menunggu";
  if (tab === "revisi") return u.status === "revisi";
  if (tab === "selesai") return u.status === "disetujui" || u.status === "ditolak";
  return false;
}

export default function UsulanPage() {
  const router = useRouter();
  const role = useRole();
  const boleh = canProcessKGB(role);

  const [daftar, setDaftar] = useState<UsulanKanwil[]>([]);
  const [laporan, setLaporan] = useState<LaporanMutasi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [tab, setTab] = useState<Tab>("menunggu");
  const [cari, setCari] = useState("");
  const [terpilih, setTerpilih] = useState<string | null>(null);
  const [dialogKembali, setDialogKembali] = useState<UsulanKanwil | null>(null);
  const [catatanKembali, setCatatanKembali] = useState("");
  /** Persetujuan seluruh usulan pada satu surat; dikonfirmasi dulu karena tidak dapat dibatalkan. */
  const [dialogMassal, setDialogMassal] = useState<{ nomorSurat: string; satker: string; isi: UsulanKanwil[] } | null>(null);
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
    setDaftar(Array.isArray(d) ? (d as UsulanKanwil[]) : []);
    const resMutasi = await fetch("/api/mutasi/laporan");
    const m: unknown = resMutasi.ok ? await resMutasi.json().catch(() => []) : [];
    setLaporan(Array.isArray(m) ? (m as LaporanMutasi[]) : []);
    setMemuat(false);
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  function beriKabar(teks: string, lama = 7000) {
    setKabar(teks);
    setTimeout(() => setKabar(null), lama);
  }

  async function tinjau(u: UsulanKanwil, aksi: "setujui" | "kembalikan", catatan?: string) {
    setSibuk(true);
    setGalat("");
    try {
      const res = await fetch(`/api/usulan/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi, catatan: catatan ?? "" }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        error?: string;
        jumlahPerubahan?: number;
        perluCatatHukdis?: boolean;
        penyesuaianKgb?: string | null;
      };
      if (!res.ok) { setGalat(d.error ?? "Tinjauan gagal disimpan"); return; }
      beriKabar(
        aksi === "setujui"
          ? `Usulan ${u.nama} disetujui, ${d.jumlahPerubahan ?? 0} kolom diperbarui.${d.penyesuaianKgb ? ` KGB: ${d.penyesuaianKgb}.` : ""}${d.perluCatatHukdis ? " Laporan hukuman disiplinnya masih perlu dicatat di modul Hukuman Disiplin." : ""}`
          : `Usulan ${u.nama} dikembalikan ke ${ringkas(u.unitKerja)} dengan catatan perbaikan.`,
      );
      setDialogKembali(null);
      setCatatanKembali("");
      setTerpilih(null);
      void muat();
    } catch {
      setGalat("Tinjauan gagal disimpan");
    } finally {
      setSibuk(false);
    }
  }

  /** Setujui seluruh usulan pada satu surat lewat satu permintaan. */
  async function setujuiSurat(sasaran: { nomorSurat: string; isi: UsulanKanwil[] }) {
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
      beriKabar(
        `${d.berhasil ?? 0} usulan pada surat ${sasaran.nomorSurat} disetujui dan diterapkan ke data pegawai.` +
          (d.gagal ? ` ${d.gagal} gagal: ${(d.galat ?? []).slice(0, 3).join("; ")}` : ""),
        9000,
      );
      setDialogMassal(null);
      setTerpilih(null);
      void muat();
    } catch {
      setGalat("Persetujuan gagal disimpan");
    } finally {
      setSibuk(false);
    }
  }

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
      beriKabar(aksi === "terima" ? `${l.label} ${l.nama} dicatat pada data pegawai.` : `Laporan ${l.nama} dikembalikan ke ${ringkas(l.unitKerja)}.`);
      setDialogLaporan(null);
      setCatatanLaporan("");
      setTerpilih(null);
      void muat();
    } catch {
      setGalat("Laporan gagal ditinjau");
    } finally {
      setSibuk(false);
    }
  }

  const jumlah: Record<Tab, number> = {
    menunggu: daftar.filter((u) => cocokTab(u, "menunggu")).length,
    revisi: daftar.filter((u) => cocokTab(u, "revisi")).length,
    selesai: daftar.filter((u) => cocokTab(u, "selesai")).length,
    mutasi: laporan.filter((l) => l.status === "menunggu").length,
  };

  const q = cari.trim().toLowerCase();
  const usulanTampil = useMemo(
    () =>
      daftar
        .filter((u) => cocokTab(u, tab))
        .filter((u) => !q || `${u.nama} ${u.nip} ${u.unitKerja} ${u.nomorSurat ?? ""}`.toLowerCase().includes(q)),
    [daftar, tab, q],
  );

  /** Usulan dikelompokkan per surat; yang menunggu paling lama di atas. */
  const kelompok = useMemo(() => {
    const peta = new Map<string, UsulanKanwil[]>();
    for (const u of usulanTampil) {
      const kunci = u.nomorSurat?.trim() || "(tanpa surat)";
      peta.set(kunci, [...(peta.get(kunci) ?? []), u]);
    }
    return [...peta.entries()]
      .map(([nomorSurat, isi]) => ({
        nomorSurat,
        isi,
        tanggal: isi[0].tanggalSurat,
        satker: [...new Set(isi.map((u) => ringkas(u.unitKerja)))].join(", "),
        diajukan: isi.map((u) => u.diajukanAt ?? "").sort()[0] ?? "",
      }))
      .sort((a, b) => (tab === "menunggu" ? a.diajukan.localeCompare(b.diajukan) : b.diajukan.localeCompare(a.diajukan)));
  }, [usulanTampil, tab]);

  const laporanTampil = useMemo(
    () =>
      laporan
        .filter((l) => !q || `${l.nama} ${l.nip} ${l.unitKerja}`.toLowerCase().includes(q))
        .sort((a, b) => Number(b.status === "menunggu") - Number(a.status === "menunggu") || (b.dilaporkanAt ?? "").localeCompare(a.dilaporkanAt ?? "")),
    [laporan, q],
  );

  // Yang terpilih jatuh ke butir pertama bila pilihan lama tidak lagi tampil (mis. sesudah disetujui).
  const usulanAktif = tab === "mutasi" ? null : usulanTampil.find((u) => u.id === terpilih) ?? usulanTampil[0] ?? null;
  const laporanAktif = tab === "mutasi" ? laporanTampil.find((l) => l.id === terpilih) ?? laporanTampil[0] ?? null : null;

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

  const TAB: { nilai: Tab; label: string; nada?: "kuning" | "ungu" }[] = [
    { nilai: "menunggu", label: "Menunggu tinjauan", nada: "kuning" },
    { nilai: "revisi", label: "Dikembalikan", nada: "ungu" },
    { nilai: "selesai", label: "Selesai" },
    { nilai: "mutasi", label: "Laporan mutasi", nada: "kuning" },
  ];

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul usl-kepala-halaman">
        <div className="min-w-0">
          <p className="dsb-label">Data</p>
          <h1 className="dsb-halaman-judul">Usulan UPT</h1>
          <p className="dsb-sub">
            Perubahan data dari UPT baru masuk ke data induk setelah disetujui di sini. Selama menunggu, proses KGB
            pegawainya tertahan.
          </p>
        </div>
        <button type="button" className="dsb-ikon-tombol" onClick={() => void muat()} title="Muat ulang" aria-label="Muat ulang usulan">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={memuat ? "dsb-putar" : undefined}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
        </button>
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
      {galat && !dialogKembali && !dialogMassal && !dialogLaporan && (
        <div role="alert" className="dsb-pesan" data-nada="merah">
          <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
          <p>{galat}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setGalat("")}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      <section className="dsb-panel dsb-penuh usl-kerja dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-label="Tinjauan usulan UPT">
        <div className="usl-alat">
          <div className="usl-tab" role="tablist" aria-label="Status usulan">
            {TAB.map((t) => (
              <button
                key={t.nilai}
                type="button"
                role="tab"
                aria-selected={tab === t.nilai}
                onClick={() => { setTab(t.nilai); setTerpilih(null); }}
              >
                {t.label}
                <span className="usl-tab-angka" data-nada={jumlah[t.nilai] > 0 ? t.nada : undefined}>{jumlah[t.nilai]}</span>
              </button>
            ))}
          </div>
          <input
            type="search"
            className="dsb-cari usl-cari"
            aria-label="Cari usulan"
            placeholder="Cari nama, NIP, satker, atau surat"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
          />
        </div>

        <div className="usl-tata">
          {/* ── Daftar ─────────────────────────────────────────────── */}
          <div className="usl-daftar-kolom">
            {memuat ? (
              <p className="dsb-kosong">Memuat usulan…</p>
            ) : tab === "mutasi" ? (
              laporanTampil.length === 0 ? (
                <p className="dsb-kosong">Tidak ada laporan mutasi dari UPT.</p>
              ) : (
                <ul className="usl-grup-isi">
                  {laporanTampil.map((l) => (
                    <li key={l.id}>
                      <button type="button" className="usl-butir" aria-pressed={laporanAktif?.id === l.id} onClick={() => setTerpilih(l.id)}>
                        <span className="usl-butir-nama">{l.nama}</span>
                        <span className="usl-butir-sub">{l.label} · {ringkas(l.unitKerja)}</span>
                        <span className="usl-butir-tanda">
                          <span className="dsb-tag" data-garis="" data-nada={l.status === "menunggu" ? "kuning" : "hijau"}>
                            {l.status === "menunggu" ? "Menunggu" : l.status === "dikembalikan" ? "Dikembalikan" : "Dicatat"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )
            ) : kelompok.length === 0 ? (
              <p className="dsb-kosong">
                {tab === "menunggu" ? "Tidak ada usulan yang menunggu tinjauan." : tab === "revisi" ? "Tidak ada usulan yang sedang diperbaiki UPT." : "Belum ada usulan yang selesai ditinjau."}
              </p>
            ) : (
              kelompok.map((g) => (
                <section key={g.nomorSurat} className="usl-grup" aria-label={`Surat ${g.nomorSurat}`}>
                  <div className="usl-grup-kepala">
                    <div className="min-w-0">
                      <p className="usl-grup-judul">Surat {g.nomorSurat}</p>
                      <p className="usl-grup-sub">
                        {g.satker}
                        {g.tanggal ? ` · ${tgl(g.tanggal)}` : ""} · {g.isi.length} pegawai
                      </p>
                    </div>
                    {tab === "menunggu" && g.isi.length > 1 && (
                      <button
                        type="button"
                        className="dsb-tombol dsb-tombol-kecil"
                        data-nada="hijau"
                        disabled={sibuk}
                        onClick={() => setDialogMassal({ nomorSurat: g.nomorSurat, satker: g.satker, isi: g.isi })}
                      >
                        Setujui {g.isi.length}
                      </button>
                    )}
                  </div>
                  <ul className="usl-grup-isi">
                    {g.isi.map((u) => {
                      const cfg = statusCfg(u.status);
                      return (
                        <li key={u.id}>
                          <button type="button" className="usl-butir" aria-pressed={usulanAktif?.id === u.id} onClick={() => setTerpilih(u.id)}>
                            <span className="usl-butir-nama">{u.nama}</span>
                            <span className="usl-butir-sub">{u.nip}</span>
                            <span className="usl-butir-tanda">
                              {u.jenis === "baru" && <span className="dsb-tag" data-garis="" data-nada="hijau">{LABEL_JENIS_USULAN.baru}</span>}
                              {u.perubahan.length > 0 && <span className="dsb-tag" data-garis="">{u.perubahan.length} perubahan</span>}
                              {u.hukdis && <span className="dsb-tag" data-garis="" data-nada="merah">Hukdis</span>}
                              {u.status === "menunggu" && u.kgb && u.kgb.status !== "menunggu_keuangan" && (
                                <span className="dsb-tag" data-garis="" data-nada="ungu">KGB tertahan</span>
                              )}
                              {tab !== "menunggu" && <span className="dsb-tag" data-garis="" data-nada={cfg.nada}>{cfg.label}</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )}
          </div>

          {/* ── Detail ─────────────────────────────────────────────── */}
          <div className="usl-detail-kolom" aria-live="polite">
            {usulanAktif ? (
              <>
                <div className="usl-detail-kepala">
                  <div className="min-w-0">
                    <h2 className="usl-detail-nama">{usulanAktif.nama}</h2>
                    <p className="usl-detail-sub">
                      {usulanAktif.nip} · {ringkas(usulanAktif.unitKerja)}
                    </p>
                  </div>
                  <span className="dsb-tag" data-garis="" data-nada={statusCfg(usulanAktif.status).nada}>
                    <span className="dsb-titik" data-nada={statusCfg(usulanAktif.status).nada} aria-hidden="true" />
                    {statusCfg(usulanAktif.status).label}
                  </span>
                </div>
                <div className="usl-detail-isi">
                  <DetailUsulan key={usulanAktif.id} usulan={usulanAktif} pratinjauDiTempat />
                </div>
                {usulanAktif.status === "menunggu" && (
                  <div className="usl-detail-kaki">
                    <button
                      type="button"
                      className="dsb-tombol"
                      data-jenis="garis"
                      disabled={sibuk}
                      onClick={() => { setDialogKembali(usulanAktif); setCatatanKembali(""); setGalat(""); }}
                    >
                      Kembalikan ke UPT
                    </button>
                    <button type="button" className="dsb-tombol" disabled={sibuk} onClick={() => void tinjau(usulanAktif, "setujui")}>
                      {sibuk ? "Menyimpan…" : "Setujui dan terapkan"}
                    </button>
                  </div>
                )}
              </>
            ) : laporanAktif ? (
              <>
                <div className="usl-detail-kepala">
                  <div className="min-w-0">
                    <h2 className="usl-detail-nama">{laporanAktif.nama}</h2>
                    <p className="usl-detail-sub">{laporanAktif.nip} · {ringkas(laporanAktif.unitKerja)}</p>
                  </div>
                  <span className="dsb-tag" data-garis="" data-nada={laporanAktif.status === "menunggu" ? "kuning" : "hijau"}>{laporanAktif.label}</span>
                </div>
                <div className="usl-detail-isi">
                  <dl className="usl-nilai">
                    {laporanAktif.satkerTujuan && <div><dt>Satker tujuan</dt><dd>{laporanAktif.satkerTujuan}</dd></div>}
                    {laporanAktif.alasan && <div><dt>Alasan</dt><dd>{laporanAktif.alasan}</dd></div>}
                    <div><dt>TMT</dt><dd>{tgl(laporanAktif.tmt)}</dd></div>
                    <div><dt>Nomor SK</dt><dd>{laporanAktif.nomorSK ?? "-"}</dd></div>
                  </dl>
                  {laporanAktif.keterangan && <blockquote className="usl-kutipan">{laporanAktif.keterangan}</blockquote>}
                  {laporanAktif.catatanKanwil && <Catatan nada="amber">Catatan Kanwil: {laporanAktif.catatanKanwil}</Catatan>}
                  {laporanAktif.status === "menunggu" && (
                    <Catatan>Mencatat laporan ini langsung mengubah data pegawai; yang pindah tidak lagi diusulkan dari satker asal.</Catatan>
                  )}
                  <p className="usl-meta">Dilaporkan {laporanAktif.dilaporkanOleh ?? "UPT"} · {tgl(laporanAktif.dilaporkanAt)}</p>
                </div>
                {laporanAktif.status === "menunggu" && (
                  <div className="usl-detail-kaki">
                    <button
                      type="button"
                      className="dsb-tombol"
                      data-jenis="garis"
                      disabled={sibuk}
                      onClick={() => { setDialogLaporan(laporanAktif); setCatatanLaporan(""); setGalat(""); }}
                    >
                      Kembalikan ke UPT
                    </button>
                    <button type="button" className="dsb-tombol" disabled={sibuk} onClick={() => void tinjauLaporan(laporanAktif, "terima")}>
                      {sibuk ? "Menyimpan…" : "Catat pada data pegawai"}
                    </button>
                  </div>
                )}
              </>
            ) : (
              !memuat && <p className="dsb-kosong">Pilih usulan di daftar untuk meninjaunya.</p>
            )}
          </div>
        </div>
      </section>

      {dialogLaporan && (
        <KerangkaModal
          judul="Kembalikan laporan mutasi"
          subjudul={`${dialogLaporan.nama} · ${ringkas(dialogLaporan.unitKerja)}`}
          ukuran="sm"
          sibuk={sibuk}
          onTutup={() => setDialogLaporan(null)}
          onKirim={() => void tinjauLaporan(dialogLaporan, "kembalikan", catatanLaporan)}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogLaporan(null)} disabled={sibuk}>Batal</button>
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
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogMassal(null)} disabled={sibuk}>Batal</button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={sibuk}>
                {sibuk ? "Menerapkan…" : `Setujui ${dialogMassal.isi.length} usulan`}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galat || null} />
          <Catatan nada="amber">
            Seluruh {dialogMassal.isi.length} usulan pada surat ini langsung diterapkan ke data pegawai dan tidak dapat
            dibatalkan. KGB yang sedang berjalan ikut disesuaikan. Usulan yang perlu diperbaiki lebih baik dikembalikan
            satu per satu lebih dulu, sebab persetujuan ini tidak memilah.
          </Catatan>
          <ul className="dsb-log-ringkas">
            {dialogMassal.isi.slice(0, 8).map((u) => (
              <li key={u.id}>
                <span className="dsb-titik" data-nada="kuning" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="dsb-nama">{u.nama}</span>
                  <span className="dsb-kecil"> · {u.perubahan.length} perubahan{u.hukdis ? " · hukdis" : ""}</span>
                </span>
              </li>
            ))}
          </ul>
          {dialogMassal.isi.length > 8 && <p className="dsb-kecil">dan {dialogMassal.isi.length - 8} pegawai lainnya.</p>}
        </KerangkaModal>
      )}

      {dialogKembali && (
        <KerangkaModal
          judul="Kembalikan untuk revisi"
          subjudul={`${dialogKembali.nama} · ${ringkas(dialogKembali.unitKerja)}`}
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
            Usulan ini kembali ke daftar kerja UPT dengan isian dan berkas yang utuh. Proses KGB pegawainya dapat
            dilanjutkan dengan data yang ada; bila UPT mengirim ulang, prosesnya tertahan lagi sampai ditinjau.
          </Catatan>
        </KerangkaModal>
      )}
    </div>
  );
}
