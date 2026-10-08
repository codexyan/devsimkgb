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

/* Usulan UPT (ADR-014): daftar di kiri, detail usulan terpilih di kanan.

   Daftarnya satu butir per pegawai, dikelompokkan per UPT, dan dapat disaring per UPT. Satu pegawai bisa punya
   beberapa usulan (mis. pegawai baru lalu perbaikan data, atau usulan ulang setelah dikembalikan); semuanya
   tampil sebagai riwayat di detail pegawai itu, bukan sebagai nama yang berulang di daftar. Persetujuan sekaligus
   tetap per surat, dari detail usulan yang menunggu.

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

/** Satu pegawai di daftar: NIP bila ada, lalu id pegawai, lalu nama. */
const kunciPegawai = (u: Pick<UsulanKanwil, "nip" | "pegawaiId" | "nama">) =>
  u.nip?.trim() || u.pegawaiId || `nama:${u.nama.trim().toLowerCase()}`;
/** Kunci UPT untuk saringan: kode satker baku bila dikenali, selain itu teks unit kerjanya. */
const kunciUpt = (unitKerja: string) => cariSatker(unitKerja)?.kode ?? unitKerja.trim();

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
  // Hasil tinjauan ditandai di state lokal supaya daftar dan angka tab langsung benar tanpa menarik
  // ulang seluruh riwayat. Penanda ini membuat data segar ditarik sekali saat pengguna pindah tab.
  const [perluSegar, setPerluSegar] = useState(false);
  const [tab, setTab] = useState<Tab>("menunggu");
  const [cari, setCari] = useState("");
  const [upt, setUpt] = useState("semua");
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
    setPerluSegar(false);
    setMemuat(false);
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => void muat(), 0);
    return () => clearTimeout(t);
  }, [muat]);

  // Dibuka dari dasbor (tombol Tinjau pada ringkasan per UPT): ?upt=<kode satker>[&tab=menunggu|revisi|selesai]. Saringan UPT
  // yang tidak ada pada tab itu otomatis kembali ke Semua UPT (uptAktif), jadi tautan lama tidak pernah menampilkan daftar kosong.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams(window.location.search);
      const kodeUpt = q.get("upt");
      if (kodeUpt) setUpt(kodeUpt);
      const tabAwal = q.get("tab");
      if (tabAwal === "menunggu" || tabAwal === "revisi" || tabAwal === "selesai") setTab(tabAwal);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function beriKabar(teks: string, lama = 7000) {
    setKabar(teks);
    setTimeout(() => setKabar(null), lama);
  }

  /**
   * Menandai hasil tinjauan pada salinan lokal. Butirnya langsung pindah tab dan angka tab ikut benar,
   * tanpa memanggil muat() yang menarik seluruh usulan, seluruh pegawai, riwayat KGB, dan surat. Beberapa
   * medan hasil hitungan server (mis. nilaiDiusulkan) baru menyusul saat data segar ditarik, dan itu
   * terjadi begitu pengguna membuka tab lain; tepat di tempat medan itu dipakai.
   */
  function tandaiUsulan(id: string, ubah: Partial<UsulanKanwil>) {
    setDaftar((lama) => lama.map((u) => (u.id === id ? { ...u, ...ubah } : u)));
    setPerluSegar(true);
  }

  function tandaiLaporan(id: string, ubah: Partial<LaporanMutasi>) {
    setLaporan((lama) => lama.map((l) => (l.id === id ? { ...l, ...ubah } : l)));
    setPerluSegar(true);
  }

  async function tinjau(u: UsulanKanwil, aksi: "setujui" | "kembalikan", catatan?: string) {
    // Usulan yang sudah disetujui dikembalikan sebagai usulan perbaikan baru (ADR-076); usulan lamanya tetap Selesai.
    const sudahDisetujui = u.status === "disetujui";
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
          : sudahDisetujui
            ? `Usulan ${u.nama} yang sudah disetujui dikembalikan ke ${ringkas(u.unitKerja)}. Data pegawai tidak berubah; UPT menerima usulan perbaikan beserta catatan Anda.`
            : `Usulan ${u.nama} dikembalikan ke ${ringkas(u.unitKerja)} dengan catatan perbaikan.`,
      );
      setDialogKembali(null);
      setCatatanKembali("");
      setTerpilih(null);
      if (sudahDisetujui) {
        // Yang lahir adalah usulan perbaikan baru, bukan perubahan status baris ini; hanya server yang tahu id dan isinya.
        await muat();
        return;
      }
      tandaiUsulan(
        u.id,
        aksi === "setujui"
          ? { status: "disetujui", ditinjauAt: new Date().toISOString() }
          : { status: "revisi", ditinjauAt: new Date().toISOString(), alasanTolak: catatan ?? "" },
      );
    } catch {
      setGalat("Tinjauan gagal disimpan");
    } finally {
      setSibuk(false);
    }
  }

  /**
   * Setujui seluruh usulan pada satu surat, dikirim bertahap beberapa usulan per permintaan: satu permintaan
   * untuk puluhan pegawai melampaui batas CPU Worker dan terputus di tengah jalan (ADR-079).
   */
  async function setujuiSurat(sasaran: { nomorSurat: string; isi: UsulanKanwil[] }) {
    setSibuk(true);
    setGalat("");
    try {
      const ids = sasaran.isi.map((u) => u.id);
      const d = { berhasil: 0, gagal: 0, galat: [] as string[] };
      for (let i = 0; i < ids.length; i += 3) {
        if (ids.length > 3) beriKabar(`Menyetujui ${Math.min(i + 3, ids.length)} dari ${ids.length} usulan…`, 60000);
        const res = await fetch("/api/usulan/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: ids.slice(i, i + 3) }),
        });
        const h = (await res.json().catch(() => ({}))) as { error?: string; berhasil?: number; gagal?: number; galat?: string[] };
        if (!res.ok) {
          setGalat(
            `${h.error ?? "Persetujuan gagal disimpan"}` +
              (d.berhasil ? ` (${d.berhasil} usulan sudah disetujui; tekan Setujui lagi untuk sisanya.)` : ""),
          );
          if (d.berhasil) void muat();
          return;
        }
        d.berhasil += h.berhasil ?? 0;
        d.gagal += h.gagal ?? 0;
        d.galat.push(...(h.galat ?? []));
      }
      beriKabar(
        `${d.berhasil ?? 0} usulan pada surat ${sasaran.nomorSurat} disetujui dan diterapkan ke data pegawai.` +
          (d.gagal ? ` ${d.gagal} gagal: ${(d.galat ?? []).slice(0, 3).join("; ")}` : ""),
        9000,
      );
      setDialogMassal(null);
      setTerpilih(null);
      // Sebagian gagal berarti tidak semua id berubah status, dan hanya server yang tahu yang mana.
      if (d.gagal) void muat();
      else {
        const ditinjauAt = new Date().toISOString();
        const idDisetujui = new Set(sasaran.isi.map((u) => u.id));
        setDaftar((lama) => lama.map((u) => (idDisetujui.has(u.id) ? { ...u, status: "disetujui", ditinjauAt } : u)));
        setPerluSegar(true);
      }
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
      tandaiLaporan(l.id, {
        status: aksi === "terima" ? "diterima" : "dikembalikan",
        catatanKanwil: aksi === "kembalikan" ? catatan ?? "" : null,
      });
    } catch {
      setGalat("Laporan gagal ditinjau");
    } finally {
      setSibuk(false);
    }
  }

  // Angka tab menghitung pegawai, sama dengan daftar yang satu butir per pegawai.
  const pegawaiDi = (t: Tab) => new Set(daftar.filter((u) => cocokTab(u, t)).map(kunciPegawai)).size;
  const jumlah: Record<Tab, number> = {
    menunggu: pegawaiDi("menunggu"),
    revisi: pegawaiDi("revisi"),
    selesai: pegawaiDi("selesai"),
    mutasi: laporan.filter((l) => l.status === "menunggu").length,
  };

  const q = cari.trim().toLowerCase();

  /** Pilihan saringan UPT untuk tab yang sedang dibuka, dengan jumlah pegawai di tiap UPT. */
  const pilihanUpt = useMemo(() => {
    const peta = new Map<string, { label: string; pegawai: Set<string> }>();
    const tambah = (unitKerja: string, kunci: string) => {
      const k = kunciUpt(unitKerja);
      const isi = peta.get(k) ?? { label: ringkas(unitKerja), pegawai: new Set<string>() };
      isi.pegawai.add(kunci);
      peta.set(k, isi);
    };
    if (tab === "mutasi") for (const l of laporan) tambah(l.unitKerja, l.nip || l.nama);
    else for (const u of daftar) if (cocokTab(u, tab)) tambah(u.unitKerja, kunciPegawai(u));
    return [...peta.entries()]
      .map(([kode, v]) => ({ kode, label: v.label, jumlah: v.pegawai.size }))
      .sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [daftar, laporan, tab]);
  // Saringan UPT yang tidak ada di tab ini kembali ke Semua UPT.
  const uptAktif = upt !== "semua" && pilihanUpt.some((p) => p.kode === upt) ? upt : "semua";

  const usulanTampil = useMemo(
    () =>
      daftar
        .filter((u) => cocokTab(u, tab))
        .filter((u) => uptAktif === "semua" || kunciUpt(u.unitKerja) === uptAktif)
        .filter((u) => !q || `${u.nama} ${u.nip} ${u.unitKerja} ${u.nomorSurat ?? ""}`.toLowerCase().includes(q)),
    [daftar, tab, q, uptAktif],
  );

  /** Semua usulan satu pegawai dari semua status, terbaru lebih dulu: riwayat di detail. */
  const riwayatPer = useMemo(() => {
    const peta = new Map<string, UsulanKanwil[]>();
    for (const u of daftar) peta.set(kunciPegawai(u), [...(peta.get(kunciPegawai(u)) ?? []), u]);
    for (const isi of peta.values()) isi.sort((a, b) => (b.diajukanAt ?? "").localeCompare(a.diajukanAt ?? ""));
    return peta;
  }, [daftar]);

  /**
   * Satu butir per pegawai, dikelompokkan per UPT. Di tab Menunggu, pegawai yang menunggu paling lama di atas;
   * di tab lain, yang terbaru di atas. Usulan utama butir adalah usulan terbaru pegawai itu di tab ini.
   */
  const kelompok = useMemo(() => {
    const perPegawai = new Map<string, UsulanKanwil[]>();
    for (const u of usulanTampil) perPegawai.set(kunciPegawai(u), [...(perPegawai.get(kunciPegawai(u)) ?? []), u]);
    const butir = [...perPegawai.entries()].map(([kunci, isi]) => {
      const urut = [...isi].sort((a, b) => (b.diajukanAt ?? "").localeCompare(a.diajukanAt ?? ""));
      const diajukan = tab === "menunggu" ? urut[urut.length - 1].diajukanAt ?? "" : urut[0].diajukanAt ?? "";
      return { kunci, utama: urut[0], isi: urut, diajukan };
    });
    butir.sort((a, b) => (tab === "menunggu" ? a.diajukan.localeCompare(b.diajukan) : b.diajukan.localeCompare(a.diajukan)));
    const perUpt = new Map<string, { kode: string; label: string; butir: typeof butir }>();
    for (const b of butir) {
      const kode = kunciUpt(b.utama.unitKerja);
      const g = perUpt.get(kode) ?? { kode, label: ringkas(b.utama.unitKerja), butir: [] };
      g.butir.push(b);
      perUpt.set(kode, g);
    }
    return [...perUpt.values()].sort((a, b) => a.label.localeCompare(b.label, "id"));
  }, [usulanTampil, tab]);
  const jumlahPegawai = kelompok.reduce((n, g) => n + g.butir.length, 0);

  const laporanTampil = useMemo(
    () =>
      laporan
        .filter((l) => uptAktif === "semua" || kunciUpt(l.unitKerja) === uptAktif)
        .filter((l) => !q || `${l.nama} ${l.nip} ${l.unitKerja}`.toLowerCase().includes(q))
        .sort((a, b) => Number(b.status === "menunggu") - Number(a.status === "menunggu") || (b.dilaporkanAt ?? "").localeCompare(a.dilaporkanAt ?? "")),
    [laporan, q, uptAktif],
  );

  // Usulan terpilih boleh dari status lain (dibuka lewat riwayat), asalkan pegawainya tampil di daftar. Bila
  // pilihan lama tidak lagi tampil (mis. sesudah disetujui), pilihan jatuh ke butir pertama.
  const kunciTampil = new Set(kelompok.flatMap((g) => g.butir.map((b) => b.kunci)));
  const dipilih = terpilih ? daftar.find((u) => u.id === terpilih) : undefined;
  const usulanAktif =
    tab === "mutasi" ? null : dipilih && kunciTampil.has(kunciPegawai(dipilih)) ? dipilih : kelompok[0]?.butir[0]?.utama ?? null;
  const laporanAktif = tab === "mutasi" ? laporanTampil.find((l) => l.id === terpilih) ?? laporanTampil[0] ?? null : null;
  const riwayatAktif = usulanAktif ? riwayatPer.get(kunciPegawai(usulanAktif)) ?? [usulanAktif] : [];
  /** Satu pegawai hanya boleh punya satu usulan yang belum selesai, jadi usulan selesai belum dapat dikembalikan selama itu ada. */
  const usulanLainBerjalan = usulanAktif ? riwayatAktif.find((r) => r.id !== usulanAktif.id && (r.status === "menunggu" || r.status === "revisi")) : undefined;
  /** Usulan lain yang masih menunggu pada surat yang sama: dasar persetujuan sekaligus per surat. */
  const suratAktif =
    usulanAktif?.status === "menunggu" && usulanAktif.nomorSurat?.trim()
      ? daftar.filter((u) => u.status === "menunggu" && u.nomorSurat?.trim() === usulanAktif.nomorSurat?.trim())
      : [];

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
                onClick={() => {
                  setTab(t.nilai);
                  setTerpilih(null);
                  // Tab yang baru dibuka memakai medan hasil hitungan server, jadi di sinilah data
                  // segar ditarik: sekali setelah serangkaian tinjauan, bukan sekali per tinjauan.
                  if (perluSegar) void muat();
                }}
              >
                {t.label}
                <span className="usl-tab-angka" data-nada={jumlah[t.nilai] > 0 ? t.nada : undefined}>{jumlah[t.nilai]}</span>
              </button>
            ))}
          </div>
          <div className="usl-saring">
            <select
              className="dsb-cari usl-upt"
              aria-label="Saring per UPT"
              value={uptAktif}
              onChange={(e) => { setUpt(e.target.value); setTerpilih(null); }}
            >
              <option value="semua">Semua UPT ({pilihanUpt.length})</option>
              {pilihanUpt.map((p) => (
                <option key={p.kode} value={p.kode}>{p.label} · {p.jumlah} pegawai</option>
              ))}
            </select>
            <input
              type="search"
              className="dsb-cari usl-cari"
              aria-label="Cari usulan"
              placeholder="Cari nama, NIP, atau surat"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
          </div>
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
                {q || uptAktif !== "semua" ? "Tidak ada usulan yang cocok dengan saringan." : tab === "menunggu" ? "Tidak ada usulan yang menunggu tinjauan." : tab === "revisi" ? "Tidak ada usulan yang sedang diperbaiki UPT." : "Belum ada usulan yang selesai ditinjau."}
              </p>
            ) : (
              <>
                <p className="usl-daftar-ringkas">
                  {jumlahPegawai} pegawai{usulanTampil.length > jumlahPegawai ? ` · ${usulanTampil.length} usulan` : ""}
                  {uptAktif === "semua" && kelompok.length > 1 ? ` · ${kelompok.length} UPT` : ""}
                </p>
                {kelompok.map((g) => (
                  <section key={g.kode} className="usl-grup" aria-label={g.label}>
                    <div className="usl-grup-kepala">
                      <div className="min-w-0">
                        <p className="usl-grup-judul">{g.label}</p>
                        <p className="usl-grup-sub">{g.butir.length} pegawai</p>
                      </div>
                    </div>
                    <ul className="usl-grup-isi">
                      {g.butir.map((b) => {
                        const u = b.utama;
                        const cfg = statusCfg(u.status);
                        const semuaUsulan = riwayatPer.get(b.kunci)?.length ?? b.isi.length;
                        return (
                          <li key={b.kunci}>
                            <button
                              type="button"
                              className="usl-butir"
                              aria-pressed={!!usulanAktif && kunciPegawai(usulanAktif) === b.kunci}
                              onClick={() => setTerpilih(u.id)}
                            >
                              <span className="usl-butir-nama">{u.nama}</span>
                              <span className="usl-butir-sub">
                                {u.nip}
                                {u.nomorSurat ? ` · ${u.nomorSurat}` : ""}
                              </span>
                              <span className="usl-butir-tanda">
                                {u.jenis === "baru" && !u.nipTercatat && (
                                  <span className="dsb-tag" data-garis="" data-nada="hijau">{LABEL_JENIS_USULAN.baru}</span>
                                )}
                                {/* Diajukan sebagai pegawai baru padahal NIP-nya sudah tercatat (ADR-091). */}
                                {u.nipTercatat && (
                                  <span className="dsb-tag" data-garis="" data-nada={u.nipTercatat.satkerSama ? "kuning" : "merah"}>
                                    {u.nipTercatat.satkerSama ? "NIP sudah tercatat" : "NIP di satker lain"}
                                  </span>
                                )}
                                {u.perubahan.length > 0 && <span className="dsb-tag" data-garis="">{u.perubahan.length} perubahan</span>}
                                {u.hukdis && <span className="dsb-tag" data-garis="" data-nada="merah">Hukdis</span>}
                                {u.status === "menunggu" && u.kgb && u.kgb.status !== "menunggu_keuangan" && (
                                  <span className="dsb-tag" data-garis="" data-nada="ungu">KGB tertahan</span>
                                )}
                                {tab !== "menunggu" && <span className="dsb-tag" data-garis="" data-nada={cfg.nada}>{cfg.label}</span>}
                                {semuaUsulan > 1 && (
                                  <span className="dsb-tag" data-garis="" data-nada="biru" title="Riwayat usulan pegawai ini ada di detail">
                                    {semuaUsulan} usulan
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </>
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
                  {riwayatAktif.length > 1 && (
                    <div className="usl-riwayat">
                      <p className="usl-bagian-judul">
                        Riwayat usulan <span>{riwayatAktif.length}</span>
                      </p>
                      <div className="usl-riwayat-daftar" role="group" aria-label="Pilih usulan">
                        {riwayatAktif.map((r) => {
                          const cfg = statusCfg(r.status);
                          return (
                            <button key={r.id} type="button" className="usl-riwayat-butir" aria-pressed={r.id === usulanAktif.id} onClick={() => setTerpilih(r.id)}>
                              <span className="usl-riwayat-judul">{LABEL_JENIS_USULAN[r.jenis] ?? r.jenis}</span>
                              <span className="usl-riwayat-sub">
                                Diajukan {tgl(r.diajukanAt)}
                                {r.nomorSurat ? ` · ${r.nomorSurat}` : ""}
                              </span>
                              <span className="dsb-tag" data-garis="" data-nada={cfg.nada}>{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {suratAktif.length > 1 && (
                    <div className="usl-surat">
                      <p>
                        Surat <strong>{usulanAktif.nomorSurat}</strong> memuat {suratAktif.length} usulan yang menunggu tinjauan.
                      </p>
                      <button
                        type="button"
                        className="dsb-tombol dsb-tombol-kecil"
                        data-nada="hijau"
                        disabled={sibuk}
                        onClick={() =>
                          setDialogMassal({
                            nomorSurat: usulanAktif.nomorSurat ?? "",
                            satker: [...new Set(suratAktif.map((u) => ringkas(u.unitKerja)))].join(", "),
                            isi: suratAktif,
                          })
                        }
                      >
                        Setujui {suratAktif.length} usulan pada surat ini
                      </button>
                    </div>
                  )}
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
                {/* Usulan yang sudah diterapkan tetap dapat dikembalikan agar UPT memperbaikinya (ADR-076). */}
                {usulanAktif.status === "disetujui" && (
                  <div className="usl-detail-kaki">
                    {usulanLainBerjalan && (
                      <p className="usl-meta" style={{ marginRight: "auto" }}>
                        Pegawai ini punya usulan lain yang {usulanLainBerjalan.status === "menunggu" ? "menunggu tinjauan" : "sedang diperbaiki UPT"}; selesaikan itu lebih dulu.
                      </p>
                    )}
                    <button
                      type="button"
                      className="dsb-tombol"
                      data-jenis="garis"
                      disabled={sibuk || !!usulanLainBerjalan}
                      title="Usulan sudah diterapkan ke data pegawai. UPT menerima usulan perbaikan baru; data pegawai tidak berubah sebelum perbaikannya disetujui."
                      onClick={() => { setDialogKembali(usulanAktif); setCatatanKembali(""); setGalat(""); }}
                    >
                      Kembalikan ke UPT
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
          judul={dialogKembali.status === "disetujui" ? "Kembalikan usulan yang sudah disetujui" : "Kembalikan untuk revisi"}
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
              placeholder={
                dialogKembali.status === "disetujui"
                  ? "Misalnya: tanggal lahir tidak sesuai SK CPNS, atau SK yang dilampirkan bukan SK terakhir"
                  : "Misalnya: gaji pokok tidak sesuai SK terakhir yang dilampirkan"
              }
            />
          </label>
          {dialogKembali.status === "disetujui" ? (
            <Catatan>
              Usulan ini sudah diterapkan ke data pegawai, dan data pegawai tidak ditarik kembali. UPT menerima usulan
              perbaikan baru yang sudah terisi sesuai data pegawai saat ini (termasuk yang sudah Anda betulkan di Data
              Pegawai), lengkap dengan catatan ini, lalu memperbaiki dan mengirim ulang. Data baru berubah setelah
              perbaikannya Anda setujui. Usulan ini tetap tercatat Selesai. SK kenaikan pangkat atau PMK yang sudah
              tercatat tetap dibetulkan lewat Ubah data SK di tab Pangkat &amp; PMK.
            </Catatan>
          ) : (
            <Catatan>
              Usulan ini kembali ke daftar kerja UPT dengan isian dan berkas yang utuh. Proses KGB pegawainya dapat
              dilanjutkan dengan data yang ada; bila UPT mengirim ulang, prosesnya tertahan lagi sampai ditinjau.
            </Catatan>
          )}
        </KerangkaModal>
      )}
    </div>
  );
}
