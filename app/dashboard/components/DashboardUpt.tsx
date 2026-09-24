"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDashUser } from "@/app/dashboard/components/RoleContext";
import { PanelNavy, Stat, StripStat, namaSapaan, sapaanWita, tanggalPanjangWita, type Nada } from "@/app/dashboard/components/PanelNavy";
import { formatTanggalId, hariIniWita, tanggalKalender } from "@/lib/waktu";
import { hitungDeadlineSDM } from "@/lib/tabelGaji";
import { kunciBulanTmt, type RekapStatusKgb } from "@/lib/rekapKgb";
import { geserBulan, namaBulan, namaTampilSatker } from "@/app/dashboard/satker/labelSatker";
import { BUTIR_KONFIRMASI_UPT, LABEL_KONFIRMASI_UPT, type StatusKonfirmasiUpt } from "@/lib/konfirmasiUpt";
import { LABEL_JENIS_USULAN, STATUS_USULAN, type StatusUsulan } from "@/lib/usulanPegawai";
import { TUGAS_UPT, daftarTugasUpt } from "@/lib/tugasUpt";
import { STATUS_LAPORAN_MUTASI, type StatusLaporanMutasi } from "@/lib/laporanMutasi";
import FormulirUsulan, { type DrafUsulanUpt, type PegawaiUntukUsulan } from "@/app/dashboard/components/upt/FormulirUsulan";
import ModalImporUpt from "@/app/dashboard/components/upt/ModalImporUpt";
import ModalLaporMutasi from "@/app/dashboard/components/upt/ModalLaporMutasi";
import { KIRIM_SURAT_BATAS } from "@/lib/batasInputSdm";
import { KerangkaModal, Catatan, ModalPratinjauBerkas, PesanGalat } from "@/app/dashboard/components/kgb";
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
  konfirmasi: StatusKonfirmasiUpt;
  konfirmasiAt: string | null;
  konfirmasiOleh: string | null;
  bolehKonfirmasi: boolean;
  /** "draf", "menunggu", atau "revisi" bila ada usulan berjalan; konfirmasi tidak diminta lagi. */
  usulanBerjalan?: string | null;
  dataSekarang: Record<string, string>;
}

/**
 * Usulan yang masih dipegang UPT dan boleh disunting: draf yang belum pernah dikirim, dan usulan yang
 * dikembalikan Kanwil untuk diperbaiki. Keduanya muncul di panel yang sama dan berangkat lewat satu surat.
 */
const dipegangUpt = (status: string) => status === "draf" || status === "revisi";

/**
 * Kalimat dialog penghapusan menurut status usulannya. Ketiganya menghapus baris yang sama, tetapi
 * akibatnya berbeda di mata UPT: draf belum pernah dilihat siapa pun, usulan terkirim sedang ditunggu
 * Kanwil, dan yang dikembalikan justru sedang ditunggu perbaikannya.
 */
function salinanHapusUsulan(status: string) {
  if (status === "draf")
    return {
      judul: "Hapus data yang disiapkan",
      tombol: "Hapus data",
      peringatan:
        "Data yang sudah diketik beserta berkas yang diunggah hilang dan tidak dapat dikembalikan. Kanwil belum pernah melihat data ini.",
    };
  if (status === "revisi")
    return {
      judul: "Hapus usulan yang dikembalikan",
      tombol: "Hapus usulan",
      peringatan:
        "Usulan ini beserta berkasnya hilang dan tidak dapat dikembalikan. Hapus hanya bila Kanwil memang meminta demikian; bila datanya cuma perlu diralat, tekan Perbaiki agar isinya tidak perlu diketik ulang.",
    };
  return {
    judul: "Batalkan usulan",
    tombol: "Batalkan usulan",
    peringatan:
      "Usulan ini beserta berkas yang sudah diunggah dihapus dan tidak lagi masuk antrian tinjauan Kanwil. Isinya tidak dapat dikembalikan; bila datanya keliru, kirim usulan baru setelah diperbaiki.",
  };
}

/** Satu baris pada daftar usulan UPT: draf yang masih disiapkan maupun usulan yang sudah dikirim. */
interface UsulanTerkirim extends DrafUsulanUpt {
  pegawaiId: string | null;
  status: string;
  nomorSurat: string | null;
  tanggalSurat: string | null;
  hukdisAda: boolean;
  jumlahPerubahan: number;
  /** Yang masih kurang sebelum draf ini boleh diajukan; selalu kosong untuk usulan yang sudah dikirim. */
  kekurangan: string[];
  diajukanAt: string | null;
  ditinjauAt: string | null;
  ditinjauOleh: string | null;
  alasanTolak: string | null;
}

/** Satu laporan mutasi atau pemberhentian yang dikirim satker ini (lib/laporanMutasi.ts). */
interface LaporanUpt {
  id: string;
  pegawaiId: string;
  nama: string;
  nip: string;
  label: string;
  satkerTujuan: string | null;
  tmt: string | null;
  nomorSK: string | null;
  alasan: string | null;
  status: string;
  catatanKanwil: string | null;
  ditinjauOleh: string | null;
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
  /** Penanda KGB sudah direkam di Gaji Web satker oleh operator gaji UPT. */
  gajiWebAt: string | null;
  gajiWebOleh: string | null;
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
  // Surat usulan dikirim tanggal 1 sampai 10 bulan kedua sebelum TMT, bulan yang sama dengan dibukanya
  // input di SIM-KGB, sehingga TMT yang diusulkan bulan ini adalah TMT dua bulan ke depan.
  return geserBulan(kunciBulanTmt(hariIni) ?? "", 2);
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

  // Konfirmasi data: satu-satunya penulisan yang boleh dilakukan akun UPT (lib/konfirmasiUpt.ts).
  const [dialogKonfirmasi, setDialogKonfirmasi] = useState<PegawaiUpt | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [galatKonfirmasi, setGalatKonfirmasi] = useState<string | null>(null);
  const [kabar, setKabar] = useState<string | null>(null);

  async function kirimKonfirmasi() {
    if (!dialogKonfirmasi) return;
    setMengirim(true);
    setGalatKonfirmasi(null);
    try {
      const res = await fetch("/api/upt/konfirmasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pegawaiId: dialogKonfirmasi.id }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalatKonfirmasi(d.error ?? "Konfirmasi gagal dikirim");
        return;
      }
      setKabar(`Data ${dialogKonfirmasi.nama} sudah dikonfirmasi. Tim SDM Kanwil melihatnya saat memproses KGB.`);
      setTimeout(() => setKabar(null), 5000);
      setDialogKonfirmasi(null);
      muat();
    } catch {
      setGalatKonfirmasi("Konfirmasi gagal dikirim");
    } finally {
      setMengirim(false);
    }
  }

  // Data pegawai UPT disiapkan dulu sebagai draf, baru diajukan: satu surat usulan lazimnya memuat
  // beberapa pegawai, dan datanya dilengkapi bertahap dari SK yang tidak selalu ada di meja.
  const [formulir, setFormulir] = useState<
    { jenis: "perubahan" | "baru"; pegawai: PegawaiUntukUsulan | null; draf: DrafUsulanUpt | null } | null
  >(null);
  const [usulan, setUsulan] = useState<UsulanTerkirim[]>([]);
  /** Laporan mutasi satker ini beserta hasil tinjauan Kanwil. */
  const [laporan, setLaporan] = useState<LaporanUpt[]>([]);
  const [laporMutasi, setLaporMutasi] = useState<PegawaiUpt | null>(null);
  const [pilihAjukan, setPilihAjukan] = useState<Set<string>>(() => new Set());
  const [dialogAjukan, setDialogAjukan] = useState(false);
  /** Unggahan massal: satu berkas menjadi banyak draf sekaligus. */
  const [dialogImpor, setDialogImpor] = useState(false);
  const [suratAjukan, setSuratAjukan] = useState({ nomorSurat: "", tanggalSurat: "" });
  const [berkasAjukan, setBerkasAjukan] = useState<File | null>(null);
  const [mengajukan, setMengajukan] = useState(false);
  const [galatAjukan, setGalatAjukan] = useState<string | null>(null);
  /** Berkas usulan yang sedang dibuka; UPT dapat memastikan yang terkirim memang benar. */
  const [pratinjau, setPratinjau] = useState<{ judul: string; subjudul: string; url: string } | null>(null);

  const muatUsulan = useCallback(async () => {
    const res = await fetch("/api/upt/usulan");
    const d: unknown = res.ok ? await res.json().catch(() => []) : [];
    if (Array.isArray(d)) setUsulan(d as UsulanTerkirim[]);
    const resMutasi = await fetch("/api/upt/mutasi");
    const m: unknown = resMutasi.ok ? await resMutasi.json().catch(() => []) : [];
    if (Array.isArray(m)) setLaporan(m as LaporanUpt[]);
  }, []);

  /** Batalkan laporan yang belum ditetapkan Kanwil. */
  async function batalkanLaporan(l: LaporanUpt) {
    const res = await fetch(`/api/upt/mutasi/${l.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setGalat(d.error ?? "Laporan gagal dibatalkan");
      return;
    }
    setKabar(`Laporan ${l.label.toLowerCase()} ${l.nama} dibatalkan.`);
    setTimeout(() => setKabar(null), 6000);
    void muatUsulan();
  }

  useEffect(() => {
    const t = setTimeout(() => void muatUsulan(), 0);
    return () => clearTimeout(t);
  }, [muatUsulan]);

  /** Usulan pegawai ini yang masih di tangan UPT, bila ada: draf, atau yang dikembalikan Kanwil. */
  function drafPegawai(pegawaiId: string): UsulanTerkirim | null {
    return usulan.find((u) => dipegangUpt(u.status) && u.pegawaiId === pegawaiId) ?? null;
  }

  function bukaUsulan(p: PegawaiUpt) {
    setFormulir({
      jenis: "perubahan",
      pegawai: { id: p.id, nama: p.nama, nip: p.nip, dataSekarang: p.dataSekarang },
      draf: drafPegawai(p.id),
    });
  }

  function bukaPegawaiBaru() {
    setFormulir({ jenis: "baru", pegawai: null, draf: null });
  }

  function lanjutkanDraf(u: UsulanTerkirim) {
    const p = (data?.pegawai ?? []).find((x) => x.id === u.pegawaiId) ?? null;
    setFormulir({
      jenis: u.jenis === "baru" ? "baru" : "perubahan",
      pegawai: p ? { id: p.id, nama: p.nama, nip: p.nip, dataSekarang: p.dataSekarang } : null,
      draf: u,
    });
  }

  function selesaiFormulir(pesan: string) {
    setFormulir(null);
    setKabar(pesan);
    setTimeout(() => setKabar(null), 7000);
    void muatUsulan();
  }

  function pilihDraf(id: string) {
    setPilihAjukan((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  }

  /**
   * Buka dialog pengiriman, dengan surat yang lama sudah terisi bila memang ada.
   *
   * Usulan yang dikembalikan Kanwil sudah pernah berangkat dengan satu surat, dan surat itulah yang
   * dipakai lagi: satu salah ketik tidak sepatutnya menuntut nomor surat baru dari arsiparis. Nomornya
   * tetap boleh diubah, dan hanya diisikan bila seluruh yang dipilih memang berasal dari surat yang sama.
   */
  function bukaDialogAjukan() {
    setGalatAjukan(null);
    const terpilih = draf.filter((u) => pilihAjukan.has(u.id));
    const nomor = [...new Set(terpilih.map((u) => u.surat?.nomorSurat?.trim()).filter((n): n is string => !!n))];
    if (nomor.length === 1) {
      const asal = terpilih.find((u) => u.surat?.nomorSurat?.trim() === nomor[0]);
      setSuratAjukan({ nomorSurat: nomor[0], tanggalSurat: asal?.surat?.tanggalSurat ?? "" });
    }
    setDialogAjukan(true);
  }

  /** Kirim draf terpilih ke Kanwil dengan satu surat usulan untuk semuanya. */
  async function ajukanTerpilih() {
    setMengajukan(true);
    setGalatAjukan(null);
    try {
      const form = new FormData();
      for (const id of pilihAjukan) form.append("id", id);
      form.set("nomorSurat", suratAjukan.nomorSurat);
      form.set("tanggalSurat", suratAjukan.tanggalSurat);
      if (berkasAjukan) form.set("berkas", berkasAjukan);

      const res = await fetch("/api/upt/usulan/ajukan", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { error?: string; jumlah?: number };
      if (!res.ok) {
        setGalatAjukan(d.error ?? "Usulan gagal dikirim");
        return;
      }
      setKabar(`${d.jumlah ?? 0} pegawai diusulkan ke Kanwil dengan surat ${suratAjukan.nomorSurat}.`);
      setTimeout(() => setKabar(null), 7000);
      setDialogAjukan(false);
      setPilihAjukan(new Set());
      setSuratAjukan({ nomorSurat: "", tanggalSurat: "" });
      setBerkasAjukan(null);
      void muatUsulan();
    } catch {
      setGalatAjukan("Usulan gagal dikirim");
    } finally {
      setMengajukan(false);
    }
  }

  /**
   * Usulan yang telanjur salah dibatalkan, bukan disunting di tempat: Kanwil tidak boleh menerima dua
   * versi usulan untuk pegawai yang sama. Hanya usulan yang belum ditinjau yang bisa ditarik kembali.
   */
  const [dialogBatal, setDialogBatal] = useState<UsulanTerkirim | null>(null);
  const [membatalkan, setMembatalkan] = useState(false);

  async function batalkanUsulan() {
    if (!dialogBatal) return;
    setMembatalkan(true);
    try {
      const res = await fetch(`/api/upt/usulan/${dialogBatal.id}`, { method: "DELETE" });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Usulan gagal dibatalkan");
        return;
      }
      setKabar(
        dialogBatal.status === "draf"
          ? `Data ${dialogBatal.nama} yang disiapkan sudah dihapus.`
          : dialogBatal.status === "revisi"
            ? `Usulan ${dialogBatal.nama} yang dikembalikan Kanwil sudah dihapus.`
            : `Usulan ${dialogBatal.nama} dibatalkan. Kirim ulang setelah datanya diperbaiki.`,
      );
      setTimeout(() => setKabar(null), 6000);
      setDialogBatal(null);
      void muatUsulan();
    } catch {
      setGalat("Usulan gagal dibatalkan");
    } finally {
      setMembatalkan(false);
    }
  }

  const [menandaiGajiWeb, setMenandaiGajiWeb] = useState<string | null>(null);

  /**
   * UPT merekam KGB di Gaji Web satkernya sendiri, bukan keuangan Kanwil, karena tiap UPT satker
   * tersendiri dengan operator gajinya sendiri. Penandaan ini yang menutup pekerjaan di sisi UPT.
   */
  async function tandaiGajiWeb(sk: SkUpt) {
    setMenandaiGajiWeb(sk.id);
    try {
      const res = await fetch("/api/upt/gaji-web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kgbId: sk.id }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setGalat(d.error ?? "Penandaan Gaji Web gagal disimpan");
        return;
      }
      setKabar(`KGB ${sk.nama} ditandai sudah direkam di Gaji Web satker.`);
      setTimeout(() => setKabar(null), 5000);
      muat();
    } catch {
      setGalat("Penandaan Gaji Web gagal disimpan");
    } finally {
      setMenandaiGajiWeb(null);
    }
  }

  const bulanUsulan = bulanUsulanSekarang(hariIni);
  const pegawai = useMemo(() => data?.pegawai ?? [], [data]);
  /** Data yang masih di tangan UPT: draf yang belum dikirim, dan yang dikembalikan Kanwil. */
  const draf = usulan.filter((u) => dipegangUpt(u.status));
  const terkirim = usulan.filter((u) => !dipegangUpt(u.status));

  /**
   * Satu daftar kerja untuk menggantikan empat panel yang dulu terpisah: tiap pegawai muncul sekali,
   * dengan satu langkah berikutnya yang jelas (lib/tugasUpt.ts). Yang sedang ditinjau Kanwil tidak
   * masuk, sebab UPT tidak dapat berbuat apa pun atasnya.
   */
  const tugas = useMemo(
    () =>
      daftarTugasUpt(
        usulan.map((u) => ({
          id: u.id, pegawaiId: u.pegawaiId, status: u.status,
          nama: u.nama, nip: u.nip, kekurangan: u.kekurangan, alasanTolak: u.alasanTolak,
        })),
        pegawai.map((p) => ({
          id: p.id, nama: p.nama, nip: p.nip, tmtKgb: p.tmtKgb, bulanTmt: p.bulanTmt,
          usulanBerjalan: p.usulanBerjalan, konfirmasi: p.konfirmasi, bolehKonfirmasi: p.bolehKonfirmasi,
        })),
        bulanUsulan,
      ),
    [usulan, pegawai, bulanUsulan],
  );
  /** Laporan mutasi pegawai ini yang belum ditetapkan Kanwil; selama ada, laporan kedua tidak ditawarkan. */
  const laporanBerjalan = (pegawaiId: string) =>
    laporan.find((l) => l.pegawaiId === pegawaiId && l.status !== "diterima") ?? null;
  const usulanById = (id: string | null) => (id ? usulan.find((u) => u.id === id) ?? null : null);
  const pegawaiById = (id: string | null) => (id ? pegawai.find((p) => p.id === id) ?? null : null);
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
            {data && <> · {namaTampilSatker(data.satker)} · KPPN {data.satker.kppn}</>}
          </>
        }
        diperbarui={segar}
        onMuatUlang={muat}
        memuat={memuat}
      >
        <StripStat>
          <Stat
            nada="kuning"
            label="Usulan dikirim bulan ini"
            angka={perluDiusulkan.length}
            satuan={`pegawai TMT ${namaBulan(bulanUsulan)}`}
            meta={perluDiusulkan.length > 0 ? "Kirim surat usulan ke Kanwil lewat Srikandi" : "Tidak ada yang perlu diusulkan bulan ini"}
            metaNada={perluDiusulkan.length > 0 ? "kuning" : "hijau"}
            sorot={perluDiusulkan.length > 0}
          />
          <Stat
            nada="biru"
            label="Sedang diproses Kanwil"
            angka={sedangDiproses.length}
            meta={sedangDiproses.length > 0 ? "SK sedang dibuat atau menunggu keuangan" : "Tidak ada yang sedang diproses"}
          />
          <Stat
            nada="hijau"
            label={`Selesai TMT ${hariIni.getFullYear()}`}
            angka={tahunIni?.selesai ?? 0}
            satuan={tahunIni ? `/ ${tahunIni.total} · ${pctSelesai}%` : undefined}
            progres={pctSelesai}
            meta={skBerkas.length > 0 ? `${skBerkas.length} SK dapat diunduh` : skSelesai.length > 0 ? "Berkas SK belum diunggah Tim SDM" : "Belum ada SK yang terbit"}
          />
          <Stat
            nada="merah"
            label="KGB ditunda"
            angka={data?.kgbDitunda ?? 0}
            meta={(data?.kgbDitunda ?? 0) > 0 ? "Karena hukuman disiplin yang masih berlaku" : "Tidak ada KGB yang ditunda"}
            metaNada={(data?.kgbDitunda ?? 0) > 0 ? "merah" : "hijau"}
          />
        </StripStat>
      </PanelNavy>

      {kabar && (
        <div role="status" className="dsb-pesan" data-nada="hijau">
          <span className="dsb-pesan-ikon" aria-hidden="true">✓</span>
          <p>{kabar}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setKabar(null)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {pratinjau && (
        <ModalPratinjauBerkas
          judul={pratinjau.judul}
          subjudul={pratinjau.subjudul}
          url={pratinjau.url}
          onTutup={() => setPratinjau(null)}
        />
      )}

      {dialogBatal && (
        <KerangkaModal
          judul={salinanHapusUsulan(dialogBatal.status).judul}
          subjudul={
            dialogBatal.status === "draf"
              ? `${dialogBatal.nama} · belum diajukan ke Kanwil`
              : `${dialogBatal.nama} · surat ${dialogBatal.nomorSurat}${dialogBatal.status === "revisi" ? " · dikembalikan Kanwil" : ""}`
          }
          nada="merah"
          ukuran="sm"
          sibuk={membatalkan}
          onTutup={() => setDialogBatal(null)}
          onKirim={() => void batalkanUsulan()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogBatal(null)} disabled={membatalkan}>
                Tidak jadi
              </button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={membatalkan}>
                {membatalkan ? "Menghapus…" : salinanHapusUsulan(dialogBatal.status).tombol}
              </button>
            </>
          }
        >
          <Catatan nada="amber">{salinanHapusUsulan(dialogBatal.status).peringatan}</Catatan>
        </KerangkaModal>
      )}

      {laporMutasi && (
        <ModalLaporMutasi
          pegawai={{ id: laporMutasi.id, nama: laporMutasi.nama, nip: laporMutasi.nip }}
          onTutup={() => setLaporMutasi(null)}
          onSelesai={(pesan) => { setLaporMutasi(null); selesaiFormulir(pesan); }}
        />
      )}

      {dialogImpor && (
        <ModalImporUpt
          onTutup={() => setDialogImpor(false)}
          onSelesai={(pesan) => { setDialogImpor(false); selesaiFormulir(pesan); }}
        />
      )}

      {formulir && (
        <FormulirUsulan
          jenis={formulir.jenis}
          pegawai={formulir.pegawai}
          draf={formulir.draf}
          onTutup={() => setFormulir(null)}
          onSelesai={selesaiFormulir}
        />
      )}

      {dialogAjukan && (
        <KerangkaModal
          judul="Ajukan ke Kanwil"
          subjudul={`${pilihAjukan.size} pegawai dalam satu surat usulan`}
          ukuran="md"
          sibuk={mengajukan}
          onTutup={() => setDialogAjukan(false)}
          onKirim={() => void ajukanTerpilih()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogAjukan(false)} disabled={mengajukan}>
                Batal
              </button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={mengajukan || pilihAjukan.size === 0}>
                {mengajukan ? "Mengirim…" : `Kirim ${pilihAjukan.size} pegawai`}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galatAjukan} />
          <Catatan>
            Surat usulan yang sudah dikirim lewat Srikandi diisikan sekali di sini dan berlaku untuk seluruh
            pegawai yang dipilih. Setelah terkirim, datanya masuk antrian tinjauan Kanwil dan tidak lagi dapat
            disunting; yang keliru dibatalkan lalu dikirim ulang.
          </Catatan>
          {draf.some((u) => pilihAjukan.has(u.id) && u.status === "revisi") && (
            <Catatan nada="amber">
              Ada usulan yang dikembalikan Kanwil di antara pilihan ini. Nomor surat lamanya sudah terisi dan
              boleh dipakai lagi, jadi tidak perlu meminta nomor baru ke arsiparis untuk sekadar ralat.
            </Catatan>
          )}
          <ul className="dsb-log-ringkas">
            {draf.filter((u) => pilihAjukan.has(u.id)).map((u) => (
              <li key={u.id}>
                <span className="dsb-titik" data-nada={u.kekurangan.length > 0 ? "merah" : "hijau"} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="dsb-nama">{u.nama}</span>
                  <span className="dsb-kecil"> · {LABEL_JENIS_USULAN[u.jenis] ?? u.jenis}</span>
                  {u.kekurangan.length > 0 && (
                    <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-red)" }}>
                      Belum lengkap: {u.kekurangan.join(", ")}
                    </p>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="kgbm-grid2">
            <label className="kgbm-label">
              <span className="kgbm-wajib">Nomor surat</span>
              <input
                className="kgbm-input"
                data-autofocus
                value={suratAjukan.nomorSurat}
                onChange={(e) => setSuratAjukan((f) => ({ ...f, nomorSurat: e.target.value }))}
                placeholder="WP.19.PAS.7-SA.04.04-1"
              />
            </label>
            <label className="kgbm-label">
              <span className="kgbm-wajib">Tanggal surat</span>
              <input
                className="kgbm-input"
                type="date"
                value={suratAjukan.tanggalSurat}
                onChange={(e) => setSuratAjukan((f) => ({ ...f, tanggalSurat: e.target.value }))}
              />
            </label>
          </div>
          <label className="kgbm-label">
            Salinan surat usulan (PDF, paling besar 1 MB)
            <input
              className="kgbm-input"
              type="file"
              accept="application/pdf"
              onChange={(e) => setBerkasAjukan(e.target.files?.[0] ?? null)}
            />
            <span className="kgbm-bantuan">Satu salinan untuk seluruh pegawai pada surat ini.</span>
          </label>
        </KerangkaModal>
      )}

      {dialogKonfirmasi && (
        <KerangkaModal
          judul="Data sudah benar"
          subjudul={`${dialogKonfirmasi.nama} · ${dialogKonfirmasi.nip}${dialogKonfirmasi.tmtKgb ? ` · TMT KGB ${formatTanggalId(dialogKonfirmasi.tmtKgb)}` : ""}`}
          ukuran="md"
          sibuk={mengirim}
          onTutup={() => setDialogKonfirmasi(null)}
          onKirim={() => void kirimKonfirmasi()}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setDialogKonfirmasi(null)} disabled={mengirim}>
                Batal
              </button>
              <button type="submit" className="kgbm-tombol kgbm-utama" disabled={mengirim}>
                {mengirim ? "Mengirim…" : "Ya, data sudah benar"}
              </button>
            </>
          }
        >
          <PesanGalat pesan={galatKonfirmasi} />
          <p className="dsb-sub" style={{ marginTop: 0 }}>
            Dengan menekan tombol di bawah, UPT menyatakan hal berikut untuk siklus KGB ini. Bila ternyata ada
            yang perlu diperbaiki, tutup jendela ini lalu pilih Usulkan perbaikan data; usulan itu sekaligus
            menjadi pernyataan yang sama.
          </p>
          <ol className="dsb-jadwal" style={{ paddingLeft: 18, listStyle: "decimal" }}>
            {BUTIR_KONFIRMASI_UPT.map((butir) => (
              <li key={butir}>
                <span>{butir}</span>
              </li>
            ))}
          </ol>
          <Catatan nada="amber">
            Masa kerja golongan dan hukuman disiplin yang keliru membuat gaji pokok pada SK salah. Kekurangannya
            dibayar sebagai rapel, tetapi kelebihannya harus disetor kembali ke kas negara oleh pegawai yang
            bersangkutan.
          </Catatan>
        </KerangkaModal>
      )}

      <div className="dsb-dasbor-isi">
       <div className="dsb-kolom">
        {/* Satu daftar kerja menggantikan panel yang dulu terpisah: tiap pegawai muncul sekali, dengan
            satu langkah berikutnya. Yang sedang ditinjau Kanwil tidak di sini, melainkan di Usulan terkirim. */}
        <section className="dsb-panel dsb-muncul" style={{ "--i": 0 } as React.CSSProperties} aria-labelledby="judul-tugas-upt">
          <div className="dsb-panel-kepala">
            <h2 id="judul-tugas-upt" className="dsb-panel-judul">
              Perlu dikerjakan <small>{tugas.length === 0 ? "tidak ada" : `${tugas.length} pegawai`}</small>
            </h2>
            <span className="upt-aksi">
              <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setDialogImpor(true)}>
                Unggah daftar
              </button>{" "}
              <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={bukaPegawaiBaru}>
                Tambah pegawai
              </button>
            </span>
          </div>
          {tugas.length === 0 ? (
            <p className="dsb-kosong">
              {memuat && !data
                ? "Memuat…"
                : "Tidak ada yang perlu dikerjakan sekarang. Usulan yang sudah dikirim dan sedang ditinjau Kanwil ada di panel Usulan terkirim."}
            </p>
          ) : (
            <>
              <div className="dsb-gulir">
                <ul className="dsb-log-ringkas">
                  {tugas.map((t) => {
                    const u = usulanById(t.usulanId);
                    const p = pegawaiById(t.pegawaiId);
                    const cfg = TUGAS_UPT[t.jenis];
                    return (
                      <li key={t.kunci}>
                        {u ? (
                          <input
                            type="checkbox"
                            className="dsb-cek"
                            checked={pilihAjukan.has(u.id)}
                            onChange={() => pilihDraf(u.id)}
                            aria-label={`Pilih ${t.nama} untuk diajukan`}
                          />
                        ) : (
                          <span className="dsb-titik" data-nada={cfg.nada} aria-hidden="true" />
                        )}
                        <span className="min-w-0">
                          <span className="dsb-nama">{t.nama}</span>
                          <span className="dsb-kecil"> · {t.nip}</span>{" "}
                          <span className="dsb-tag" data-garis="" data-nada={cfg.nada}>{cfg.judul}</span>
                          <p className="dsb-kecil" style={{ margin: 0 }}>
                            {t.tmt ? `TMT ${formatTanggalId(t.tmt, { month: "long", year: "numeric" })} · ` : ""}
                            {t.langkah}
                          </p>
                          {t.catatan && (
                            <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-amber)" }}>
                              {t.jenis === "perbaiki" ? "Catatan Kanwil: " : "Belum ada: "}
                              {t.catatan}
                            </p>
                          )}
                          <span className="upt-aksi">
                            {u ? (
                              <>
                                <button
                                  type="button"
                                  className="dsb-tombol dsb-tombol-kecil"
                                  data-jenis="garis"
                                  onClick={() => lanjutkanDraf(u)}
                                >
                                  {t.jenis === "perbaiki" ? "Perbaiki" : "Lanjutkan"}
                                </button>{" "}
                                <button
                                  type="button"
                                  className="dsb-tombol dsb-tombol-kecil"
                                  data-jenis="garis"
                                  onClick={() => setDialogBatal(u)}
                                >
                                  Hapus
                                </button>
                              </>
                            ) : p ? (
                              <>
                                <button
                                  type="button"
                                  className="dsb-tombol dsb-tombol-kecil"
                                  data-jenis="garis"
                                  onClick={() => { setDialogKonfirmasi(p); setGalatKonfirmasi(null); }}
                                >
                                  Data sudah benar
                                </button>{" "}
                                <button
                                  type="button"
                                  className="dsb-tombol dsb-tombol-kecil"
                                  data-jenis="garis"
                                  onClick={() => bukaUsulan(p)}
                                >
                                  Usulkan perbaikan data
                                </button>
                              </>
                            ) : null}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--ln2)" }}>
                <button
                  type="button"
                  className="dsb-tombol"
                  disabled={pilihAjukan.size === 0}
                  onClick={bukaDialogAjukan}
                >
                  {pilihAjukan.size > 0 ? `Ajukan ${pilihAjukan.size} pegawai ke Kanwil` : "Centang dulu yang akan diajukan"}
                </button>
              </div>
            </>
          )}
        </section>

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
            <button type="button" className="dsb-tombol dsb-tombol-kecil" style={{ marginLeft: "auto" }} onClick={bukaPegawaiBaru}>
              Tambah data pegawai
            </button>
            <input
              type="search"
              className="dsb-cari"
              style={{ flex: "0 1 200px" }}
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
                    // Usulan yang sedang ditinjau Kanwil tidak boleh disentuh UPT, jadi tombolnya pun
                    // tidak ditawarkan: dulu tombol itu tetap hidup dan penolakannya baru muncul setelah
                    // operator mengisi seluruh formulir.
                    const milikSendiri = drafPegawai(p.id);
                    const sedangDitinjau = p.usulanBerjalan === "menunggu";
                    const bulanKirim = p.bulanTmt ? geserBulan(p.bulanTmt, -2) : null;
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
                          {p.konfirmasi === "berlaku" ? (
                            <p className="dsb-kecil" style={{ margin: "2px 0 0" }} title={p.konfirmasiOleh ?? undefined}>
                              <span className="dsb-titik" data-nada="hijau" aria-hidden="true" />{" "}
                              {LABEL_KONFIRMASI_UPT.berlaku}
                              {p.konfirmasiAt ? ` ${formatTanggalId(p.konfirmasiAt, { day: "numeric", month: "short" })}` : ""}
                            </p>
                          ) : p.usulanBerjalan ? (
                            <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>
                              <span
                                className="dsb-titik"
                                data-nada={p.usulanBerjalan === "revisi" ? "ungu" : "biru"}
                                aria-hidden="true"
                              />{" "}
                              {p.usulanBerjalan === "draf"
                                ? "Sedang disiapkan usulannya, konfirmasi tidak diperlukan"
                                : p.usulanBerjalan === "revisi"
                                  ? "Dikembalikan Kanwil, perlu diperbaiki lalu dikirim ulang"
                                  : "Sudah diusulkan, menunggu tinjauan Kanwil"}
                            </p>
                          ) : p.bolehKonfirmasi ? (
                            <span className="upt-aksi">
                              <button
                                type="button"
                                className="dsb-tombol dsb-tombol-kecil"
                                data-jenis="garis"
                                onClick={() => { setDialogKonfirmasi(p); setGalatKonfirmasi(null); }}
                              >
                                Data sudah benar
                              </button>
                            </span>
                          ) : null}
                          {!sedangDitinjau && (
                            <span className="upt-aksi">
                              <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => bukaUsulan(p)}>
                                {milikSendiri?.status === "revisi"
                                  ? "Perbaiki usulan"
                                  : milikSendiri
                                    ? "Lanjutkan draf"
                                    : "Usulkan perbaikan data"}
                              </button>
                            </span>
                          )}
                          {!laporanBerjalan(p.id) && (
                            <span className="upt-aksi">
                              <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setLaporMutasi(p)}>
                                Laporkan mutasi
                              </button>
                            </span>
                          )}
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
       </div>

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
                      {s.gajiWebAt ? (
                        <span className="dsb-kecil" style={{ display: "block", marginTop: 2 }} title={s.gajiWebOleh ?? undefined}>
                          <span className="dsb-titik" data-nada="hijau" aria-hidden="true" /> Sudah direkam di Gaji Web{" "}
                          {fmtTgl(s.gajiWebAt)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="dsb-tombol dsb-tombol-kecil"
                          data-jenis="garis"
                          style={{ marginTop: 6 }}
                          disabled={menandaiGajiWeb === s.id}
                          onClick={() => void tandaiGajiWeb(s)}
                        >
                          {menandaiGajiWeb === s.id ? "Menyimpan…" : "Tandai sudah direkam di Gaji Web"}
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Laporan mutasi dan pemberhentian; penetapannya tetap di Kanwil */}
          {laporan.length > 0 && (
            <section className="dsb-panel dsb-susut" aria-labelledby="judul-mutasi-upt">
              <div className="dsb-panel-kepala">
                <h2 id="judul-mutasi-upt" className="dsb-panel-judul">
                  Laporan mutasi <small>{laporan.filter((l) => l.status === "menunggu").length} menunggu tinjauan</small>
                </h2>
              </div>
              <div className="dsb-gulir">
                <ul className="dsb-log-ringkas">
                  {laporan.slice(0, 20).map((l) => {
                    const cfg = STATUS_LAPORAN_MUTASI[l.status as StatusLaporanMutasi] ?? { label: l.status, nada: "kuning" as const };
                    return (
                      <li key={l.id}>
                        <span className="dsb-titik" data-nada={cfg.nada} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="dsb-nama">{l.nama}</span>
                          <span className="dsb-kecil"> · {l.label}</span>
                          <p className="dsb-kecil" style={{ margin: 0 }}>
                            {cfg.label}
                            {l.satkerTujuan ? ` · ke ${l.satkerTujuan}` : ""}
                            {l.alasan ? ` · ${l.alasan}` : ""}
                            {l.tmt ? ` · TMT ${fmtTgl(l.tmt)}` : ""}
                          </p>
                          {l.status === "dikembalikan" && l.catatanKanwil && (
                            <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-violet)" }}>
                              Catatan Kanwil: {l.catatanKanwil}
                            </p>
                          )}
                          {l.status !== "diterima" && (
                            <span className="upt-aksi">
                              <button
                                type="button"
                                className="dsb-tombol dsb-tombol-kecil"
                                data-jenis="garis"
                                onClick={() => void batalkanLaporan(l)}
                              >
                                Batalkan laporan
                              </button>
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="dsb-kaki">
                <span>Pegawainya baru berpindah atau berhenti setelah Kanwil menetapkan</span>
              </div>
            </section>
          )}

          {/* Kapan surat usulan dikirim untuk bulan TMT berikutnya */}
          <section className="dsb-panel dsb-susut" aria-labelledby="judul-usulan-upt">
            <div className="dsb-panel-kepala">
              <h2 id="judul-usulan-upt" className="dsb-panel-judul">
                Usulan terkirim <small>{terkirim.filter((u) => u.status === "menunggu").length} menunggu tinjauan</small>
              </h2>
            </div>
            {terkirim.length === 0 ? (
              <p className="dsb-kosong">
                Belum ada usulan. Pakai tautan Usulkan perbaikan data pada daftar pegawai untuk mengirim data
                terbaru beserta surat usulannya ke Kanwil.
              </p>
            ) : (
              <div className="dsb-gulir">
                <ul className="dsb-log-ringkas">
                  {terkirim.slice(0, 20).map((u) => {
                    const cfg = STATUS_USULAN[u.status as StatusUsulan] ?? { label: u.status, nada: "kuning" as const };
                    return (
                      <li key={u.id}>
                        <span className="dsb-titik" data-nada={cfg.nada} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="dsb-nama">{u.nama}</span>
                          <span className="dsb-kecil"> · {LABEL_JENIS_USULAN[u.jenis] ?? u.jenis} · {cfg.label}</span>
                          <p className="dsb-kecil" style={{ margin: 0 }}>
                            {u.nomorSurat ? `Surat ${u.nomorSurat} · ` : ""}{u.jumlahPerubahan} kolom{u.hukdisAda ? " · disertai laporan hukdis" : ""}
                          </p>
                          {u.alasanTolak && (
                            <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-red)" }}>Ditolak: {u.alasanTolak}</p>
                          )}
                          {u.berkas.length > 0 && (
                            <span className="upt-aksi">
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
                            </span>
                          )}
                          {u.status === "menunggu" && (
                            <span className="upt-aksi">
                              <button
                                type="button"
                                className="dsb-tombol dsb-tombol-kecil"
                                data-jenis="garis"
                                onClick={() => setDialogBatal(u)}
                              >
                                Batalkan usulan
                              </button>
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
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
                  const kirim = geserBulan(m.bulanTmt, -2);
                  const sekarang = m.bulanTmt === bulanUsulan;
                  return (
                    <li key={m.bulanTmt}>
                      <span>
                        KGB berlaku <strong>{namaBulan(m.bulanTmt, true)}</strong>
                        {sekarang && <span className="dsb-tag" data-garis="" style={{ marginLeft: 6, color: "var(--st-amber)" }}>kirim bulan ini</span>}
                      </span>
                      <span className="dsb-tag" data-garis="">{m.jumlah} pegawai</span>
                      <span className="dsb-kecil">
                        Surat UPT dikirim tanggal 1 sampai {KIRIM_SURAT_BATAS} {namaBulan(kirim, true)}.
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
