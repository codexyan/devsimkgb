"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, hariIniWita, isoTanggalLokal, tanggalKalender } from "@/lib/waktu";
import { kunciBulanTmt, rekapPerBulanTmt, satuPerSiklus, type RekapBulanTmt } from "@/lib/rekapKgb";
import { bulanFokusRekon, jendelaRekonGaji, statusRekonGaji, type StatusRekon } from "@/lib/rekonGaji";
import { cariSatker } from "@/lib/satker";
import { useDialogModal } from "@/app/dashboard/components/useDialogModal";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { KerangkaModal } from "@/app/dashboard/components/kgb";
import { DaftarBulanRekon } from "@/app/dashboard/components/DaftarBulanRekon";
import { geserBulan, namaBulan, namaTampilSatker } from "@/app/dashboard/satker/labelSatker";
import { canKonfirmasiKeuangan } from "@/lib/auth";

/* Modul Keuangan: tinjau SK KGB yang sudah ditandatangani, tetapkan rapelan, lalu siapkan dasar input
   Gaji Web per bulan TMT. Alur kerjanya mengikuti jadwal rekon (lib/rekonGaji.ts): SK bulan TMT M harus
   sudah dikonfirmasi sebelum keuangan merekon gaji tanggal 1 sampai 15 bulan M-1. Hitungan per bulan memakai
   definisi bersama lib/rekapKgb.ts. Super Admin membuka halaman ini untuk memantau saja. */

interface KGB {
  /** null untuk entri Belum Diproses virtual (pegawai belum punya record KGB aktif). */
  id: string | null;
  pegawaiId: string;
  isVirtual?: boolean;
  isArsip?: boolean;
  status: string;
  tmtKgbBaru: string;
  golonganLama: string;
  golonganBaru: string;
  gajiPokokLama: number;
  gajiPokokBaru: number | null;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  flagRapelan: boolean;
  rapelanDitetapkan: boolean | null;
  konfirmasiKeuanganAt?: string | null;
  createdAt: string;
  pegawai: { nip: string; nama: string; jabatan: string; unitKerja: string } | null;
  surat: { nomorSurat: string; tanggalSurat: string; pathFile?: string | null } | null;
}

type SaringStatus = "semua" | "menunggu" | "selesai" | "belum";

interface LogKonfirmasi {
  id: string;
  waktu: string;
  aksi: string;
  detail: string;
  targetNama?: string | null;
  user: { nama: string } | null;
}

/** Nama, rapelan, dan konfirmasi cepat dari detail log /api/kgb/[id]/konfirmasi-keuangan. */
function uraiLog(l: LogKonfirmasi) {
  const m = /^Konfirmasi KGB (.+) \((\d+)\), Gol\. ([^,]+), Gaji (Rp [\d.]+), Rapelan: (Ya|Tidak)(, melalui Konfirmasi cepat)?/.exec(l.detail);
  return m ? { nama: m[1], golongan: m[3], gaji: m[4], rapelan: m[5] === "Ya", cepat: !!m[6] } : null;
}
const STATUS_BELUM_SAMPAI = ["belum_diproses", "sedang_diproses", "ditolak"];

/* ─── pembantu ─── */

const fmt = (s: string | null | undefined) => (s ? formatTanggalId(s, { day: "numeric", month: "short", year: "numeric" }) : "-");
const fmtRp = (n: number | null | undefined) => (typeof n === "number" ? "Rp " + n.toLocaleString("id-ID") : "-");
const fmtMkg = (k: KGB) => (k.mkgTahunBaru === null ? "-" : `${k.mkgTahunBaru} thn ${k.mkgBulanBaru ?? 0} bln`);
const namaPegawai = (k: KGB) => k.pegawai?.nama ?? "-";
const kunciKgb = (k: KGB) => k.id ?? `virtual-${k.pegawaiId}`;
const golongan = (k: KGB) => (k.golonganLama && k.golonganLama !== k.golonganBaru ? `${k.golonganLama} → ${k.golonganBaru}` : k.golonganBaru);
const selisihGaji = (k: KGB) => (k.gajiPokokBaru === null ? 0 : k.gajiPokokBaru - k.gajiPokokLama);
const tautanSk = (k: KGB) => (k.surat?.pathFile ? `/api/blob/download?url=${encodeURIComponent(k.surat.pathFile)}` : null);

function satkerLengkap(unitKerja: string | null | undefined): string {
  const s = cariSatker(unitKerja);
  return s ? namaTampilSatker(s) : unitKerja?.trim() || "-";
}

function sisaHari(tanggal: string, hariIni: Date): number | null {
  const t = tanggalKalender(tanggal);
  return t ? Math.round((t.getTime() - hariIni.getTime()) / 86_400_000) : null;
}

const ALASAN_TMT_LEWAT = "TMT sudah lewat, tinjau satu per satu";

/**
 * Alasan SK tidak dapat dipilih untuk Konfirmasi cepat; null bila dapat dipilih. SK berpotensi rapelan dan SK
 * yang TMT-nya (tanggal WITA) hari ini atau sebelumnya ditinjau satu per satu; API menolaknya dengan cepat: true.
 */
function alasanTanpaKonfirmasiCepat(k: KGB, hariIni: Date): string | null {
  if (!k.id) return "Belum ada SK";
  if (k.flagRapelan) return "Berpotensi rapelan, tinjau satu per satu";
  const tmt = tanggalKalender(k.tmtKgbBaru);
  return !tmt || tmt.getTime() <= hariIni.getTime() ? ALASAN_TMT_LEWAT : null;
}

function bisaKonfirmasiCepat(k: KGB, hariIni: Date): k is KGB & { id: string } {
  return alasanTanpaKonfirmasiCepat(k, hariIni) === null;
}

/** Daftar KGB dari respons API; null bila isinya bukan daftar. */
async function bacaDaftarKgb(res: Response): Promise<KGB[] | null> {
  const d = (await res.json()) as unknown;
  return Array.isArray(d) ? (d as KGB[]) : null;
}

async function pesanGalat(res: Response, bawaan: string) {
  try {
    const d = (await res.json()) as { error?: string };
    return d.error ?? bawaan;
  } catch {
    return bawaan;
  }
}

function selCsv(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Unduh berkas CSV (UTF-8 dengan BOM agar nama pegawai terbaca benar di Excel). */
function unduhCsv(namaBerkas: string, kepala: string[], baris: (string | number | null | undefined)[][]) {
  const isi = [kepala, ...baris].map((b) => b.map(selCsv).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + isi], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const LABEL_STATUS_REKON: Record<StatusRekon, string> = {
  akan_datang: "belum dimulai",
  berjalan: "sedang berjalan",
  lewat: "sudah lewat",
};

function teksJendelaRekon(bulanTmt: string): string {
  const { mulai, batas } = jendelaRekonGaji(bulanTmt);
  return `${mulai.getDate()}–${formatTanggalId(batas, { day: "numeric", month: "short", year: "numeric" })}`;
}

function StatusKgb({ k }: { k: KGB }) {
  const warna = warnaStatusKgb(k.status);
  return (
    <span className="dsb-status">
      <span className="dsb-titik" style={{ background: warna.color }} aria-hidden="true" />
      {k.status === "selesai" ? "Dikonfirmasi" : infoStatusKgb(k.status).label}
      {k.isArsip ? " (arsip)" : ""}
    </span>
  );
}

const IkonMata = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
);
const IkonUnduh = () => (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);
const IkonCentang = () => (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

/* ─── halaman ─── */

export default function KeuanganPage() {
  const bolehKonfirmasi = canKonfirmasiKeuangan(useRole());
  const params = useSearchParams();
  const [hariIni] = useState(() => hariIniWita());
  const bulanFokus = bulanFokusRekon(hariIni);
  const bulanIni = kunciBulanTmt(hariIni) ?? bulanFokus;

  const [menunggu, setMenunggu] = useState<KGB[]>([]);
  const [semua, setSemua] = useState<KGB[]>([]);
  const [muatMenunggu, setMuatMenunggu] = useState(true);
  const [muatSemua, setMuatSemua] = useState(true);
  const [logTerakhir, setLogTerakhir] = useState<LogKonfirmasi[] | null>(null);
  // Selama terisi, daftar ditampilkan sebagai galat, bukan sebagai daftar kosong.
  const [galatMenunggu, setGalatMenunggu] = useState(false);
  const [galatSemua, setGalatSemua] = useState(false);

  // ?bulan=yyyy-mm dari Riwayat Aktivitas membuka bulan TMT itu; bawaannya bulan fokus rekon.
  const [bulan, setBulan] = useState(() => {
    const b = params.get("bulan");
    return b && /^\d{4}-\d{2}$/.test(b) ? b : bulanFokus;
  });
  const [saring, setSaring] = useState<SaringStatus>("semua");
  const [cari, setCari] = useState("");

  const [pesan, setPesan] = useState<{ nada: "hijau" | "merah"; teks: string } | null>(null);
  const [followupTerkirim, setFollowupTerkirim] = useState<Set<string>>(new Set());
  const [followupMassal, setFollowupMassal] = useState(false);

  // Tinjau SK: pratinjau berkas dan data berdampingan, konfirmasi dari tempat yang sama.
  const [tinjauId, setTinjauId] = useState<string | null>(null);
  const [pilihRapelan, setPilihRapelan] = useState(false);
  const [lanjutOtomatis, setLanjutOtomatis] = useState(true);
  const [konfirmasiSibuk, setKonfirmasiSibuk] = useState(false);
  const [konfirmasiGalat, setKonfirmasiGalat] = useState<string | null>(null);

  // Konfirmasi cepat untuk SK tanpa potensi rapelan dengan TMT yang belum lewat.
  const [pilihan, setPilihan] = useState<Set<string>>(new Set());
  const [bukaCepat, setBukaCepat] = useState(false);
  const [cepatSibuk, setCepatSibuk] = useState(false);
  const [cepatProgres, setCepatProgres] = useState(0);

  const tampilkanPesan = useCallback((nada: "hijau" | "merah", teks: string, lama = 6000) => {
    setPesan({ nada, teks });
    setTimeout(() => setPesan((p) => (p?.teks === teks ? null : p)), lama);
  }, []);

  /* pemuat data; bila pemuatan ulang gagal, daftar yang sudah ada tidak ditimpa */
  const muatDaftarMenunggu = useCallback(async () => {
    setMuatMenunggu(true);
    setGalatMenunggu(false);
    try {
      const res = await fetch("/api/kgb?status=menunggu_keuangan");
      const daftar = res.ok ? await bacaDaftarKgb(res) : null;
      if (!daftar) {
        setGalatMenunggu(true);
        return;
      }
      setMenunggu(daftar);
      const layak = new Set(daftar.filter((k) => bisaKonfirmasiCepat(k, hariIniWita())).map((k) => k.id as string));
      setPilihan((prev) => {
        const sisa = new Set([...prev].filter((id) => layak.has(id)));
        return sisa.size === prev.size ? prev : sisa;
      });
    } catch {
      setGalatMenunggu(true);
    } finally {
      setMuatMenunggu(false);
    }
  }, []);

  const muatDaftarSemua = useCallback(async () => {
    setMuatSemua(true);
    setGalatSemua(false);
    try {
      const res = await fetch("/api/kgb");
      const daftar = res.ok ? await bacaDaftarKgb(res) : null;
      if (daftar) setSemua(daftar);
      else setGalatSemua(true);
    } catch {
      setGalatSemua(true);
    } finally {
      setMuatSemua(false);
    }
  }, []);

  const muatLog = useCallback(async () => {
    try {
      const res = await fetch("/api/keuangan/log");
      const d = res.ok ? ((await res.json()) as unknown) : null;
      setLogTerakhir(Array.isArray(d) ? (d as LogKonfirmasi[]).filter((l) => l.aksi === "konfirmasi_keuangan").slice(0, 30) : []);
    } catch {
      setLogTerakhir([]);
    }
  }, []);

  const muatUlang = useCallback(() => {
    void muatDaftarMenunggu();
    void muatDaftarSemua();
    void muatLog();
  }, [muatDaftarMenunggu, muatDaftarSemua, muatLog]);

  useEffect(() => {
    const t = setTimeout(muatUlang, 0);
    return () => clearTimeout(t);
  }, [muatUlang]);

  /* ─── turunan ─── */

  // Antrian: TMT terdekat dulu, karena itu yang paling dekat dengan rekon Gaji Web.
  const antrian = useMemo(
    () =>
      [...menunggu].sort(
        (a, b) =>
          (tanggalKalender(a.tmtKgbBaru)?.getTime() ?? 0) - (tanggalKalender(b.tmtKgbBaru)?.getTime() ?? 0) ||
          namaPegawai(a).localeCompare(namaPegawai(b), "id"),
      ),
    [menunggu],
  );
  const layakCepat = antrian.filter((k) => bisaKonfirmasiCepat(k, hariIni));
  const antrianRapelan = antrian.filter((k) => k.flagRapelan).length;
  const antrianTmtLewat = antrian.filter((k) => !k.flagRapelan && alasanTanpaKonfirmasiCepat(k, hariIni) === ALASAN_TMT_LEWAT).length;

  const siklus = useMemo(() => satuPerSiklus(semua), [semua]);
  const rekapBulan = useMemo(
    () => new Map<string, RekapBulanTmt>(rekapPerBulanTmt(siklus, hariIni).map((r) => [r.bulanTmt, r])),
    [siklus, hariIni],
  );
  const dataSiap = !muatSemua && !galatSemua;
  const rekapFokus = rekapBulan.get(bulanFokus);
  const pctFokus = rekapFokus && rekapFokus.total > 0 ? Math.round((rekapFokus.dikonfirmasi / rekapFokus.total) * 100) : 0;
  const tahun = hariIni.getFullYear();
  const rekapTahunIni = [...rekapBulan.values()].filter((r) => r.bulanTmt.startsWith(`${tahun}-`));
  const rapelanDitetapkan = rekapTahunIni.reduce((s, r) => s + r.rapelanDitetapkan, 0);
  const rapelanBerpotensi = rekapTahunIni.reduce((s, r) => s + r.berpotensiRapelan, 0);

  // Tabel bulan: KGB siklus bulan itu, ditambah arsip (SK terbit di luar SIM-KGB) sebagai keterangan.
  const isiBulan = useMemo(() => {
    const siklusBulan = siklus.filter((k) => kunciBulanTmt(k.tmtKgbBaru) === bulan);
    const arsip = semua.filter((k) => k.isArsip && kunciBulanTmt(k.tmtKgbBaru) === bulan);
    return [...siklusBulan, ...arsip].sort((a, b) => namaPegawai(a).localeCompare(namaPegawai(b), "id"));
  }, [siklus, semua, bulan]);
  const cocokSaring = (k: KGB, s: SaringStatus) =>
    s === "semua" ? true
    : s === "menunggu" ? k.status === "menunggu_keuangan"
    : s === "selesai" ? k.status === "selesai"
    : STATUS_BELUM_SAMPAI.includes(k.status) && !k.isArsip;
  const q = cari.trim().toLowerCase();
  const tampilBulan = isiBulan.filter(
    (k) =>
      cocokSaring(k, saring) &&
      (!q || namaPegawai(k).toLowerCase().includes(q) || (k.pegawai?.nip ?? "").includes(q) || (k.surat?.nomorSurat ?? "").toLowerCase().includes(q)),
  );
  const dikonfirmasiBulan = isiBulan.filter((k) => k.status === "selesai" && !k.isArsip);
  // Follow up ke Tim SDM untuk bulan TMT yang masa inputnya sudah dibuka (sampai dua bulan ke depan).
  const bisaFollowUp = (k: KGB) =>
    bolehKonfirmasi && !k.isArsip && STATUS_BELUM_SAMPAI.includes(k.status) && bulan <= geserBulan(bulanIni, 2);
  const perluFollowUp = isiBulan.filter((k) => bisaFollowUp(k) && !followupTerkirim.has(kunciKgb(k)));
  const rekonBulan = statusRekonGaji(bulan, hariIni);

  /* ─── tinjau dan konfirmasi ─── */

  const target = tinjauId ? [...antrian, ...semua].find((k) => k.id === tinjauId) ?? null : null;
  const indeksAntrian = target ? antrian.findIndex((k) => k.id === target.id) : -1;
  const refTinjau = useDialogModal(!!target, () => setTinjauId(null), konfirmasiSibuk);

  function bukaTinjau(k: KGB) {
    if (!k.id) return;
    setTinjauId(k.id);
    setPilihRapelan(k.flagRapelan);
    setKonfirmasiGalat(null);
  }

  function geserTinjau(arah: 1 | -1) {
    const k = antrian[indeksAntrian + arah];
    if (k) bukaTinjau(k);
  }

  async function konfirmasi() {
    if (!target?.id) return;
    const berikutnya = antrian[indeksAntrian + 1] ?? antrian[indeksAntrian - 1] ?? null;
    setKonfirmasiSibuk(true);
    setKonfirmasiGalat(null);
    try {
      const res = await fetch(`/api/kgb/${target.id}/konfirmasi-keuangan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRapelan: pilihRapelan }),
      });
      if (res.ok) {
        tampilkanPesan("hijau", `KGB ${namaPegawai(target)} dikonfirmasi${pilihRapelan ? " sebagai rapelan" : ""}.`);
        if (lanjutOtomatis && berikutnya && indeksAntrian >= 0) bukaTinjau(berikutnya);
        else setTinjauId(null);
        muatUlang();
      } else {
        setKonfirmasiGalat(await pesanGalat(res, "Gagal mengkonfirmasi."));
        // 404/409: KGB sudah tidak menunggu konfirmasi, jadi daftar dimuat ulang.
        if (res.status === 404 || res.status === 409) muatUlang();
      }
    } catch {
      setKonfirmasiGalat("Gagal menghubungi server. Coba lagi.");
    } finally {
      setKonfirmasiSibuk(false);
    }
  }

  async function konfirmasiCepat() {
    const ids = [...pilihan].filter((id) => {
      const k = antrian.find((x) => x.id === id);
      return !!k && bisaKonfirmasiCepat(k, hariIniWita());
    });
    if (ids.length === 0) {
      setBukaCepat(false);
      tampilkanPesan("merah", `SK yang dipilih tidak lagi dapat dikonfirmasi cepat: ${ALASAN_TMT_LEWAT}.`, 10000);
      return;
    }
    setCepatSibuk(true);
    setCepatProgres(0);
    let berhasil = 0;
    const gagal: string[] = [];
    for (const id of ids) {
      const k = antrian.find((x) => x.id === id);
      const nama = k ? namaPegawai(k) : id;
      try {
        const res = await fetch(`/api/kgb/${id}/konfirmasi-keuangan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isRapelan: false, cepat: true }),
        });
        if (res.ok) berhasil++;
        else gagal.push(`${nama} (${await pesanGalat(res, `HTTP ${res.status}`)})`);
      } catch {
        gagal.push(`${nama} (koneksi gagal)`);
      }
      setCepatProgres((p) => p + 1);
    }
    setCepatSibuk(false);
    setBukaCepat(false);
    setPilihan(new Set());
    if (gagal.length > 0) tampilkanPesan("merah", `${gagal.length} SK gagal dikonfirmasi: ${gagal.join("; ")}.`, 12000);
    else tampilkanPesan("hijau", `${berhasil} SK berhasil dikonfirmasi sebagai tidak rapelan.`);
    muatUlang();
  }

  /* ─── follow up Tim SDM ─── */

  // KGB tanpa record aktif (virtual) atau yang dibatalkan dikirim dengan pegawaiId.
  async function kirimFollowUp(k: KGB): Promise<"baru" | "sudah" | string> {
    const body = k.id && (k.status === "belum_diproses" || k.status === "sedang_diproses") ? { kgbId: k.id } : { pegawaiId: k.pegawaiId };
    try {
      const res = await fetch("/api/notifikasi/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return await pesanGalat(res, "Follow up gagal dikirim.");
      const d = (await res.json()) as { sudahAda?: boolean };
      setFollowupTerkirim((prev) => new Set(prev).add(kunciKgb(k)));
      return d.sudahAda ? "sudah" : "baru";
    } catch {
      return "Follow up gagal dikirim.";
    }
  }

  async function followUpSatu(k: KGB) {
    const hasil = await kirimFollowUp(k);
    if (hasil === "baru") tampilkanPesan("hijau", `Follow up untuk ${namaPegawai(k)} dikirim ke Tim SDM.`, 4000);
    else if (hasil === "sudah") tampilkanPesan("hijau", `Follow up untuk ${namaPegawai(k)} sudah dikirim sebelumnya dan belum dibaca Tim SDM.`, 5000);
    else tampilkanPesan("merah", hasil);
  }

  async function followUpSemua() {
    setFollowupMassal(true);
    let terkirim = 0;
    let gagal = 0;
    for (const k of perluFollowUp) {
      const hasil = await kirimFollowUp(k);
      if (hasil === "baru" || hasil === "sudah") terkirim++;
      else gagal++;
    }
    setFollowupMassal(false);
    if (gagal > 0) tampilkanPesan("merah", `${gagal} follow up gagal dikirim; ${terkirim} terkirim.`);
    else tampilkanPesan("hijau", `Follow up untuk ${terkirim} pegawai dikirim ke Tim SDM.`);
  }

  function unduhDasarGajiWeb() {
    unduhCsv(
      `dasar-gaji-web_TMT-${bulan}.csv`,
      ["No", "Nama", "NIP", "Unit kerja", "Golongan", "MKG tahun", "MKG bulan", "Gaji pokok lama", "Gaji pokok baru", "Kenaikan", "TMT KGB", "Nomor SK", "Tanggal SK", "Rapelan", "Dikonfirmasi"],
      dikonfirmasiBulan.map((k, i) => {
        const tmt = tanggalKalender(k.tmtKgbBaru);
        const tglSk = tanggalKalender(k.surat?.tanggalSurat);
        const tglKonfirmasi = tanggalKalender(k.konfirmasiKeuanganAt);
        return [
          i + 1, namaPegawai(k), k.pegawai?.nip ?? "", satkerLengkap(k.pegawai?.unitKerja), k.golonganBaru,
          k.mkgTahunBaru, k.mkgBulanBaru, k.gajiPokokLama, k.gajiPokokBaru, selisihGaji(k),
          tmt ? isoTanggalLokal(tmt) : "", k.surat?.nomorSurat ?? "", tglSk ? isoTanggalLokal(tglSk) : "",
          k.rapelanDitetapkan ? "Ya" : "Tidak", tglKonfirmasi ? isoTanggalLokal(tglKonfirmasi) : "",
        ];
      }),
    );
  }

  /* ─── tampilan ─── */

  const cepatTerpilih = antrian.filter((k) => k.id && pilihan.has(k.id) && bisaKonfirmasiCepat(k, hariIni));
  const semuaCepatTerpilih = layakCepat.length > 0 && layakCepat.every((k) => pilihan.has(k.id as string));
  const kolomCentang = bolehKonfirmasi && layakCepat.length > 0;
  const jumlahSaring = (s: SaringStatus) => isiBulan.filter((k) => cocokSaring(k, s)).length;

  return (
    <div className="dsb-halaman" data-muat-layar="">
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Keuangan</p>
          <h1 className="dsb-halaman-judul">Konfirmasi SK KGB</h1>
          <p className="dsb-sub">
            Tinjau SK bertanda tangan, tetapkan rapelan, lalu siapkan dasar input Gaji Web.
            {!bolehKonfirmasi && <> <strong style={{ color: "var(--dtn)", fontWeight: 600 }}>Mode lihat:</strong> konfirmasi dan follow up hanya oleh petugas Keuangan.</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="dsb-ikon-tombol" onClick={muatUlang} title="Muat ulang" aria-label="Muat ulang data">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={muatSemua || muatMenunggu ? "dsb-putar" : undefined}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
          </button>
          <Link href="/dashboard/keuangan/riwayat" className="dsb-tombol" data-jenis="garis">Riwayat aktivitas</Link>
        </div>
      </header>

      {pesan && (
        <div role={pesan.nada === "merah" ? "alert" : "status"} className="dsb-pesan" data-nada={pesan.nada}>
          <span className="dsb-pesan-ikon" aria-hidden="true">
            {pesan.nada === "hijau" ? <IkonCentang /> : "!"}
          </span>
          <p>{pesan.teks}</p>
          <button type="button" className="dsb-ikon-tombol" aria-label="Tutup pesan" onClick={() => setPesan(null)}>
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* ── Ringkasan kerja ── */}
      <div className="dsb-angka-kisi dsb-muncul" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Menunggu konfirmasi</span>
          <span className="dsb-angka-nilai" style={{ color: antrian.length > 0 ? "var(--st-violet)" : undefined }}>
            {muatMenunggu && antrian.length === 0 ? "–" : antrian.length}
          </span>
          <span className="dsb-angka-meta">
            {antrian.length === 0
              ? "Antrian kosong"
              : [antrianRapelan > 0 && `${antrianRapelan} berpotensi rapelan`, antrianTmtLewat > 0 && `${antrianTmtLewat} TMT lewat`, layakCepat.length > 0 && `${layakCepat.length} bisa cepat`]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Siap rekon TMT {namaBulan(bulanFokus, true)}</span>
          <span className="dsb-angka-nilai">
            {dataSiap ? rekapFokus?.dikonfirmasi ?? 0 : "–"}
            {dataSiap && <small>/ {rekapFokus?.total ?? 0} dikonfirmasi</small>}
          </span>
          <span className="dsb-angka-meta">
            <span className="dsb-bar-mini" style={{ width: "100%" }} aria-hidden="true"><span style={{ width: `${pctFokus}%` }} /></span>
          </span>
          <span className="dsb-angka-meta" style={{ marginTop: 4 }}>
            Rekon {teksJendelaRekon(bulanFokus)} · {LABEL_STATUS_REKON[statusRekonGaji(bulanFokus, hariIni)]}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Belum sampai keuangan</span>
          <span className="dsb-angka-nilai" style={{ color: (rekapFokus?.belumSampaiKeuangan ?? 0) > 0 ? "var(--st-amber)" : undefined }}>
            {dataSiap ? rekapFokus?.belumSampaiKeuangan ?? 0 : "–"}
          </span>
          <span className="dsb-angka-meta">
            {(rekapFokus?.belumSampaiKeuangan ?? 0) > 0 ? `TMT ${namaBulan(bulanFokus)} masih di Tim SDM` : `Semua KGB TMT ${namaBulan(bulanFokus)} sudah sampai`}
          </span>
        </div>
        <div className="dsb-angka">
          <span className="dsb-angka-label">Rapelan TMT {tahun}</span>
          <span className="dsb-angka-nilai">
            {dataSiap ? rapelanDitetapkan : "–"}
            {dataSiap && <small>ditetapkan</small>}
          </span>
          <span className="dsb-angka-meta">
            {rapelanBerpotensi > 0 && <span className="dsb-titik" data-nada="kuning" aria-hidden="true" />}
            {rapelanBerpotensi > 0 ? `${rapelanBerpotensi} lagi berpotensi rapelan` : "Tidak ada yang berpotensi rapelan"}
          </span>
        </div>
      </div>

      <div className="dsb-dasbor-isi">
        <div className="dsb-kolom">
        {/* ── Antrian SK menunggu konfirmasi ── */}
        <section className="dsb-panel dsb-antrian dsb-susut overflow-hidden dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="judul-antrian-sk">
          <div className="dsb-panel-kepala">
            <h2 id="judul-antrian-sk" className="dsb-panel-judul">SK menunggu konfirmasi <small>{antrian.length}</small></h2>
            {bolehKonfirmasi && antrian.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {cepatTerpilih.length > 0 ? (
                  <button type="button" className="dsb-tombol dsb-tombol-kecil" data-nada="hijau" onClick={() => setBukaCepat(true)}>
                    <IkonCentang /> Konfirmasi cepat ({cepatTerpilih.length})
                  </button>
                ) : (
                  <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={() => bukaTinjau(antrian[0])}>
                    Mulai tinjau dari yang teratas
                  </button>
                )}
              </div>
            )}
          </div>

          {muatMenunggu && antrian.length === 0 ? (
            <div className="flex flex-col gap-2" style={{ padding: "16px" }} role="status" aria-label="Memuat antrian">
              {[1, 2, 3].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 48, borderRadius: 8 }} />)}
            </div>
          ) : galatMenunggu ? (
            <div className="dsb-kosong" role="alert">
              <p style={{ margin: 0, color: "var(--st-red)" }}>Daftar SK menunggu konfirmasi gagal dimuat.</p>
              <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => void muatDaftarMenunggu()}>Muat ulang</button>
            </div>
          ) : antrian.length === 0 ? (
            <div className="dsb-kosong" style={{ padding: "44px 16px" }}>
              <span className="dsb-pesan-ikon" style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", width: 36, height: 36 }} aria-hidden="true"><IkonCentang /></span>
              <p className="dsb-nama" style={{ margin: 0 }}>Tidak ada SK yang menunggu konfirmasi</p>
              <p style={{ margin: 0 }}>SK baru muncul di sini setelah Tim SDM mengunggah SK yang sudah ditandatangani.</p>
            </div>
          ) : (
            <div className="dsb-antrian-gulir">
              <table className="dsb-tabel" style={{ minWidth: kolomCentang ? "760px" : "720px" }}>
                <thead>
                  <tr>
                    {kolomCentang && (
                      <th scope="col" style={{ width: 36 }}>
                        <input
                          type="checkbox"
                          className="dsb-cek"
                          checked={semuaCepatTerpilih}
                          onChange={() => setPilihan(semuaCepatTerpilih ? new Set() : new Set(layakCepat.map((k) => k.id as string)))}
                          aria-label="Pilih semua SK yang bisa dikonfirmasi cepat"
                          title="Pilih semua SK tanpa potensi rapelan dengan TMT yang belum lewat"
                        />
                      </th>
                    )}
                    <th scope="col">Pegawai</th>
                    <th scope="col">TMT</th>
                    <th scope="col">Gaji pokok baru</th>
                    <th scope="col">Nomor SK</th>
                    <th scope="col" className="kanan"><span className="sr-only">Aksi</span></th>
                  </tr>
                </thead>
                <tbody>
                  {antrian.map((k) => {
                    const alasan = alasanTanpaKonfirmasiCepat(k, hariIni);
                    const sisa = sisaHari(k.tmtKgbBaru, hariIni);
                    const selisih = selisihGaji(k);
                    return (
                      <tr key={kunciKgb(k)} className="dsb-baris-klik" onClick={() => bukaTinjau(k)}>
                        {kolomCentang && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="dsb-cek"
                              disabled={!!alasan}
                              checked={!!k.id && pilihan.has(k.id)}
                              onChange={() => setPilihan((prev) => {
                                if (!k.id) return prev;
                                const n = new Set(prev);
                                if (n.has(k.id)) n.delete(k.id); else n.add(k.id);
                                return n;
                              })}
                              aria-label={`Pilih SK ${namaPegawai(k)} untuk konfirmasi cepat`}
                              title={alasan ?? "Pilih untuk konfirmasi cepat"}
                            />
                          </td>
                        )}
                        <td style={{ maxWidth: "220px" }}>
                          <p className="dsb-nama truncate" style={{ margin: 0 }} title={k.pegawai?.jabatan}>{namaPegawai(k)}</p>
                          <p className="dsb-kecil truncate" style={{ margin: 0 }} title={k.pegawai?.unitKerja}>
                            {k.pegawai?.nip ?? "-"} · {satkerLengkap(k.pegawai?.unitKerja)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap">
                          {fmt(k.tmtKgbBaru)}
                          <p className="dsb-kecil" style={{ margin: 0, color: k.flagRapelan || alasan === ALASAN_TMT_LEWAT ? "var(--st-amber)" : undefined }}>
                            {k.flagRapelan ? "berpotensi rapelan" : alasan === ALASAN_TMT_LEWAT ? "TMT sudah lewat" : sisa !== null ? `${sisa} hari lagi` : ""}
                          </p>
                        </td>
                        <td className="whitespace-nowrap">
                          <span style={{ color: "var(--dtn)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{fmtRp(k.gajiPokokBaru)}</span>
                          <p className="dsb-kecil" style={{ margin: 0 }}>
                            {selisih > 0 && <span style={{ color: "var(--st-green)" }}>+{selisih.toLocaleString("id-ID")} · </span>}
                            {golongan(k)} · {fmtMkg(k)}
                          </p>
                        </td>
                        <td className="whitespace-nowrap">
                          {k.surat?.nomorSurat ?? <span className="dsb-kecil">-</span>}
                          {k.surat?.tanggalSurat && <p className="dsb-kecil" style={{ margin: 0 }}>{fmt(k.surat.tanggalSurat)}</p>}
                        </td>
                        <td className="kanan">
                          <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis={bolehKonfirmasi ? undefined : "garis"} onClick={(e) => { e.stopPropagation(); bukaTinjau(k); }}>
                            {bolehKonfirmasi ? "Tinjau" : "Lihat"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {antrian.length > 0 && (
            <div className="dsb-kaki">
              <span>Urut TMT terdekat · klik baris untuk meninjau SK{kolomCentang ? " · centang untuk konfirmasi cepat" : ""}</span>
            </div>
          )}
        </section>

          {/* ── KGB berlaku per bulan TMT ── */}
          <section className="dsb-panel dsb-penuh overflow-hidden dsb-muncul" style={{ "--i": 4 } as React.CSSProperties} aria-labelledby="judul-bulan-tmt">
            <div className="dsb-panel-kepala">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <button type="button" className="dsb-ikon-tombol" onClick={() => setBulan(geserBulan(bulan, -1))} aria-label="Bulan TMT sebelumnya" title="Bulan sebelumnya">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <h2 id="judul-bulan-tmt" className="dsb-panel-judul" style={{ minWidth: 0 }}>
                TMT {namaBulan(bulan)}
                <small title="SK bulan TMT ini harus dikonfirmasi sebelum rekon Gaji Web">
                  {isiBulan.length} KGB · rekon {teksJendelaRekon(bulan)},{" "}
                  <span style={{ color: rekonBulan === "berjalan" ? "var(--st-violet)" : rekonBulan === "lewat" && jumlahSaring("belum") + jumlahSaring("menunggu") > 0 ? "var(--st-red)" : undefined }}>{LABEL_STATUS_REKON[rekonBulan]}</span>
                </small>
              </h2>
                <button type="button" className="dsb-ikon-tombol" onClick={() => setBulan(geserBulan(bulan, 1))} aria-label="Bulan TMT berikutnya" title="Bulan berikutnya">
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
                {bulan !== bulanFokus && (
                  <button type="button" className="dsb-tautan" onClick={() => setBulan(bulanFokus)}>Ke bulan fokus</button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {bolehKonfirmasi && perluFollowUp.length > 1 && (
                  <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" disabled={followupMassal} onClick={() => void followUpSemua()}>
                    {followupMassal ? "Mengirim…" : `Follow up (${perluFollowUp.length})`}
                  </button>
                )}
                <button
                  type="button"
                  className="dsb-tombol dsb-tombol-kecil"
                  data-jenis="garis"
                  disabled={dikonfirmasiBulan.length === 0}
                  onClick={unduhDasarGajiWeb}
                  title={dikonfirmasiBulan.length === 0 ? "Belum ada KGB yang dikonfirmasi pada bulan ini" : "Unduh daftar KGB yang sudah dikonfirmasi sebagai dasar input Gaji Web"}
                >
                  <IkonUnduh /> Gaji Web ({dikonfirmasiBulan.length})
                </button>
              </div>
            </div>

            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--ln2)" }}>
              <div className="dsb-alat">
                <div className="dsb-segmen" role="group" aria-label="Saring status">
                  {([
                    ["semua", "Semua"],
                    ["menunggu", "Menunggu"],
                    ["selesai", "Dikonfirmasi"],
                    ["belum", "Belum sampai"],
                  ] as [SaringStatus, string][]).map(([s, l]) => (
                    <button key={s} type="button" aria-pressed={saring === s} onClick={() => setSaring(s)}>
                      {l} {dataSiap && <span style={{ color: "var(--dt5)" }}>{jumlahSaring(s)}</span>}
                    </button>
                  ))}
                </div>
                <input type="search" className="dsb-cari" style={{ flex: "1 1 160px" }} aria-label="Cari di bulan ini" placeholder="Cari nama, NIP, atau nomor SK" value={cari} onChange={(e) => setCari(e.target.value)} />
              </div>
            </div>

            {muatSemua && semua.length === 0 ? (
              <div className="flex flex-col gap-2" style={{ padding: "16px" }} role="status" aria-label="Memuat KGB bulan ini">
                {[1, 2, 3].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 44, borderRadius: 8 }} />)}
              </div>
            ) : galatSemua ? (
              <div className="dsb-kosong" role="alert">
                <p style={{ margin: 0, color: "var(--st-red)" }}>Data KGB gagal dimuat.</p>
                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => void muatDaftarSemua()}>Muat ulang</button>
              </div>
            ) : tampilBulan.length === 0 ? (
              <p className="dsb-kosong" style={{ padding: "40px 16px" }}>
                {isiBulan.length === 0 ? `Tidak ada KGB berlaku ${namaBulan(bulan, true)}.` : "Tidak ada KGB yang cocok dengan saringan."}
              </p>
            ) : (
              <div className="dsb-gulir-tabel tbl-scroll">
                <table className="dsb-tabel" style={{ minWidth: "720px" }}>
                  <thead>
                    <tr>
                      <th scope="col">Pegawai</th>
                      <th scope="col">Gaji pokok baru</th>
                      <th scope="col">Nomor SK</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="kanan"><span className="sr-only">Aksi</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tampilBulan.map((k) => {
                      const terkirim = followupTerkirim.has(kunciKgb(k));
                      const selisih = selisihGaji(k);
                      const sk = tautanSk(k);
                      return (
                        <tr key={kunciKgb(k)} className={k.isArsip ? "dsb-redup" : undefined}>
                          <td style={{ maxWidth: "220px" }}>
                            <p className="dsb-nama truncate" style={{ margin: 0 }} title={k.pegawai?.jabatan}>{namaPegawai(k)}</p>
                            <p className="dsb-kecil truncate" style={{ margin: 0 }} title={k.pegawai?.unitKerja}>
                              {k.pegawai?.nip ?? "-"} · {satkerLengkap(k.pegawai?.unitKerja)}
                            </p>
                          </td>
                          <td className="whitespace-nowrap">
                            {k.gajiPokokBaru === null ? (
                              <span className="dsb-kecil">Belum diinput</span>
                            ) : (
                              <span style={{ color: "var(--dtn)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{fmtRp(k.gajiPokokBaru)}</span>
                            )}
                            <p className="dsb-kecil" style={{ margin: 0 }}>
                              {selisih > 0 && <span style={{ color: "var(--st-green)" }}>+{selisih.toLocaleString("id-ID")} · </span>}
                              {golongan(k)}{k.mkgTahunBaru !== null && <> · {fmtMkg(k)}</>}
                            </p>
                          </td>
                          <td className="whitespace-nowrap">
                            {k.surat?.nomorSurat ?? <span className="dsb-kecil">-</span>}
                            {k.surat?.tanggalSurat && <p className="dsb-kecil" style={{ margin: 0 }}>{fmt(k.surat.tanggalSurat)}</p>}
                          </td>
                          <td>
                            <StatusKgb k={k} />
                            {k.status === "selesai" && k.rapelanDitetapkan && <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-red)" }}>Rapelan ditetapkan</p>}
                            {k.status !== "selesai" && k.flagRapelan && <p className="dsb-kecil" style={{ margin: 0, color: "var(--st-amber)" }}>Berpotensi rapelan</p>}
                            {k.status === "selesai" && k.konfirmasiKeuanganAt && <p className="dsb-kecil" style={{ margin: 0 }}>{fmt(k.konfirmasiKeuanganAt)}</p>}
                          </td>
                          <td className="kanan">
                            <span className="dsb-aksi">
                              {k.status === "menunggu_keuangan" && k.id && (
                                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis={bolehKonfirmasi ? undefined : "garis"} onClick={() => bukaTinjau(k)}>
                                  {bolehKonfirmasi ? "Tinjau" : "Lihat"}
                                </button>
                              )}
                              {bisaFollowUp(k) && (
                                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" disabled={terkirim} onClick={() => void followUpSatu(k)} title="Minta Tim SDM segera memproses KGB ini">
                                  {terkirim ? "Terkirim" : "Follow up"}
                                </button>
                              )}
                              {k.status === "selesai" && sk && (
                                <a href={sk} target="_blank" rel="noopener noreferrer" className="dsb-ikon-tombol" title="Buka SK yang sudah ditandatangani" aria-label={`Buka SK ${namaPegawai(k)}`}>
                                  <IkonMata />
                                </a>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* ── Kolom kanan: per bulan TMT dan konfirmasi terakhir ── */}
        <aside className="dsb-samping dsb-muncul" data-urutan="tetap" style={{ "--i": 3 } as React.CSSProperties} aria-label="Rekap per bulan TMT dan konfirmasi terakhir">
          <section className="dsb-panel dsb-susut" aria-labelledby="judul-per-bulan">
            <div className="dsb-panel-kepala">
              <h2 id="judul-per-bulan" className="dsb-panel-judul">Per bulan TMT <small>dasar Gaji Web</small></h2>
              <Link href="/dashboard/keuangan/riwayat?tab=rekap" className="dsb-tautan">Semua →</Link>
            </div>
            {muatSemua && semua.length === 0 ? (
              <div className="dsb-panel-isi flex flex-col gap-2" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 40, borderRadius: 8 }} />)}
              </div>
            ) : galatSemua ? (
              <div className="dsb-kosong" role="alert">
                <p style={{ margin: 0, color: "var(--st-red)" }}>Data KGB gagal dimuat.</p>
                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => void muatDaftarSemua()}>Muat ulang</button>
              </div>
            ) : (
              <DaftarBulanRekon rekap={rekapBulan} bulanFokus={bulanFokus} terpilih={bulan} onPilih={(b) => { setBulan(b); setSaring("semua"); }} />
            )}
          </section>

          <section className="dsb-panel dsb-penuh" aria-labelledby="judul-konfirmasi-terakhir">
            <div className="dsb-panel-kepala">
              <h2 id="judul-konfirmasi-terakhir" className="dsb-panel-judul">Konfirmasi terakhir</h2>
              <Link href="/dashboard/keuangan/riwayat" className="dsb-tautan">Riwayat →</Link>
            </div>
            {!logTerakhir ? (
              <div className="dsb-panel-isi flex flex-col gap-2" aria-hidden="true">
                {[1, 2, 3].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 36, borderRadius: 8 }} />)}
              </div>
            ) : logTerakhir.length === 0 ? (
              <p className="dsb-kosong">Belum ada konfirmasi yang tercatat.</p>
            ) : (
              <ul className="dsb-log-ringkas dsb-gulir">
                {logTerakhir.map((l) => {
                  const isi = uraiLog(l);
                  return (
                    <li key={l.id}>
                      <span className="dsb-titik" data-nada={isi?.rapelan ? "merah" : "hijau"} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="dsb-nama truncate" style={{ display: "block" }}>{isi?.nama ?? l.targetNama ?? "-"}</span>
                        <span className="dsb-kecil">
                          {formatTanggalId(l.waktu, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          {isi?.rapelan && <span style={{ color: "var(--st-red)" }}> · rapelan</span>}
                          {isi?.cepat && " · cepat"}
                          {l.user && ` · ${l.user.nama}`}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {/* ── Tinjau SK ── */}
      {target && (
        <>
          <div className="dsb-lapis" onClick={() => !konfirmasiSibuk && setTinjauId(null)} />
          <div ref={refTinjau} className="dsb-tinjau" role="dialog" aria-modal="true" aria-labelledby="judul-tinjau" aria-busy={konfirmasiSibuk} tabIndex={-1}>
            <div className="dsb-tinjau-kepala">
              <div className="min-w-0 flex-1">
                <p className="dsb-label">{target.status === "menunggu_keuangan" ? "Tinjau SK KGB" : "SK KGB"}</p>
                <h2 id="judul-tinjau" className="dsb-panel-judul truncate">{namaPegawai(target)}</h2>
              </div>
              {indeksAntrian >= 0 && antrian.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <button type="button" className="dsb-ikon-tombol" disabled={indeksAntrian === 0 || konfirmasiSibuk} onClick={() => geserTinjau(-1)} aria-label="SK sebelumnya" title="SK sebelumnya">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <span className="dsb-kecil" style={{ minWidth: 64, textAlign: "center" }}>{indeksAntrian + 1} dari {antrian.length}</span>
                  <button type="button" className="dsb-ikon-tombol" disabled={indeksAntrian === antrian.length - 1 || konfirmasiSibuk} onClick={() => geserTinjau(1)} aria-label="SK berikutnya" title="SK berikutnya">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </div>
              )}
              <button type="button" className="dsb-ikon-tombol" disabled={konfirmasiSibuk} onClick={() => setTinjauId(null)} aria-label="Tutup">
                <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="dsb-tinjau-isi">
              <div className="dsb-tinjau-berkas">
                {tautanSk(target) ? (
                  <iframe key={target.id} src={tautanSk(target)!} title={`SK KGB ${namaPegawai(target)} yang sudah ditandatangani`} />
                ) : (
                  <div className="dsb-kosong" style={{ margin: "auto", maxWidth: 360 }}>
                    <p className="dsb-nama" style={{ margin: 0 }}>Berkas SK bertanda tangan tidak ditemukan</p>
                    <p style={{ margin: 0 }}>Periksa data di samping dengan SK yang Anda terima, atau minta Tim SDM mengunggah ulang SK-nya.</p>
                  </div>
                )}
              </div>

              <div className="dsb-tinjau-data">
                <dl className="dsb-rincian-data">
                  <dt>NIP</dt><dd>{target.pegawai?.nip ?? "-"}</dd>
                  <dt>Jabatan</dt><dd>{target.pegawai?.jabatan ?? "-"}</dd>
                  <dt>Unit kerja</dt><dd>{satkerLengkap(target.pegawai?.unitKerja)}</dd>
                  <dt>Golongan</dt><dd>{golongan(target)}</dd>
                  <dt>MKG baru</dt><dd>{fmtMkg(target)}</dd>
                  <dt>Gaji pokok lama</dt><dd>{fmtRp(target.gajiPokokLama)}</dd>
                  <dt>Gaji pokok baru</dt>
                  <dd style={{ color: "var(--st-green)", fontWeight: 600 }}>
                    {fmtRp(target.gajiPokokBaru)}
                    {selisihGaji(target) > 0 && <span className="dsb-kecil" style={{ display: "block", fontWeight: 500 }}>naik {fmtRp(selisihGaji(target))} per bulan</span>}
                  </dd>
                  <dt>TMT KGB</dt>
                  <dd>
                    {formatTanggalId(target.tmtKgbBaru)}
                    {alasanTanpaKonfirmasiCepat(target, hariIni) === ALASAN_TMT_LEWAT && <span className="dsb-kecil" style={{ display: "block", color: "var(--st-amber)" }}>TMT sudah lewat</span>}
                  </dd>
                  <dt>Nomor SK</dt><dd>{target.surat?.nomorSurat ?? "-"}</dd>
                  <dt>Tanggal SK</dt><dd>{target.surat?.tanggalSurat ? formatTanggalId(target.surat.tanggalSurat) : "-"}</dd>
                  {target.status !== "menunggu_keuangan" && <><dt>Status</dt><dd><StatusKgb k={target} /></dd></>}
                </dl>

                {target.status === "menunggu_keuangan" && (
                  <div className="flex flex-col gap-3" style={{ padding: "0 18px 16px" }}>
                    {target.flagRapelan && (
                      <div className="dsb-pesan" data-nada="kuning" style={{ padding: "8px 10px" }}>
                        <span className="dsb-pesan-ikon" aria-hidden="true">!</span>
                        <p style={{ fontSize: "12.5px" }}>Tim SDM menginput KGB ini setelah batas input, jadi <strong>berpotensi rapelan</strong>. Pilih Rapelan bila selisih gaji dibayar mundur.</p>
                      </div>
                    )}
                    {bolehKonfirmasi ? (
                      <fieldset className="dsb-pilihan">
                        <legend className="dsb-kecil" style={{ marginBottom: 6, color: "var(--dt3)", fontWeight: 500 }}>Status pembayaran</legend>
                        <label>
                          <input type="radio" name="rapelan" checked={!pilihRapelan} onChange={() => setPilihRapelan(false)} />
                          Tidak rapelan
                          <small>Dibayar mulai TMT</small>
                        </label>
                        <label data-nada="kuning">
                          <input type="radio" name="rapelan" checked={pilihRapelan} onChange={() => setPilihRapelan(true)} />
                          Rapelan
                          <small>Selisih dibayar mundur</small>
                        </label>
                      </fieldset>
                    ) : (
                      <p className="dsb-kecil" style={{ margin: 0 }}>Mode lihat: konfirmasi hanya oleh petugas Keuangan.</p>
                    )}
                    <div role="alert" aria-live="assertive">
                      {konfirmasiGalat && <p className="dsb-pesan" data-nada="merah" style={{ margin: 0, padding: "8px 10px", fontSize: "12.5px" }}>{konfirmasiGalat}</p>}
                    </div>
                  </div>
                )}

                {target.status === "menunggu_keuangan" && bolehKonfirmasi && (
                  <div className="dsb-tinjau-kaki">
                    {indeksAntrian >= 0 && antrian.length > 1 && (
                      <label className="dsb-kecil flex items-center gap-2" style={{ color: "var(--dt3)", cursor: "pointer" }}>
                        <input type="checkbox" className="dsb-cek" checked={lanjutOtomatis} onChange={(e) => setLanjutOtomatis(e.target.checked)} />
                        Setelah konfirmasi, buka SK berikutnya
                      </label>
                    )}
                    <p className="dsb-kecil" style={{ margin: 0 }}>KGB ditandai selesai dan data gaji pegawai diperbarui otomatis.</p>
                    <button type="button" className="dsb-tombol dsb-tombol-penuh" disabled={konfirmasiSibuk} onClick={() => void konfirmasi()} style={{ minHeight: 38 }}>
                      <IkonCentang />
                      {konfirmasiSibuk ? "Memproses…" : pilihRapelan ? "Konfirmasi sebagai rapelan" : "Konfirmasi"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Konfirmasi cepat ── */}
      {bukaCepat && (
        <KerangkaModal
          judul={`Konfirmasi cepat ${cepatTerpilih.length} SK`}
          subjudul="Semua ditandai tidak rapelan"
          nada="hijau"
          ukuran="sm"
          sibuk={cepatSibuk}
          onTutup={() => setBukaCepat(false)}
          ikon={<IkonCentang />}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" disabled={cepatSibuk} onClick={() => setBukaCepat(false)}>Batal</button>
              <button type="button" className="kgbm-tombol kgbm-utama" disabled={cepatSibuk} onClick={() => void konfirmasiCepat()}>
                {cepatSibuk ? `Memproses ${cepatProgres}/${cepatTerpilih.length}…` : `Konfirmasi ${cepatTerpilih.length} SK`}
              </button>
            </>
          }
        >
          <div className="dsb-catatan">
            <span>Total kenaikan gaji</span>
            <strong>+{fmtRp(cepatTerpilih.reduce((s, k) => s + Math.max(0, selisihGaji(k)), 0))} per bulan</strong>
          </div>
          <ul className="dsb-daftar-ringkas">
            {cepatTerpilih.map((k) => (
              <li key={kunciKgb(k)}>
                <span className="min-w-0">
                  <span className="dsb-nama truncate" style={{ display: "block" }}>{namaPegawai(k)}</span>
                  <span className="dsb-kecil">{golongan(k)} · TMT {fmt(k.tmtKgbBaru)}</span>
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--dtn)" }}>{fmtRp(k.gajiPokokBaru)}</span>
              </li>
            ))}
          </ul>
          <p className="dsb-kecil" style={{ margin: 0 }}>SK berpotensi rapelan dan SK dengan TMT hari ini atau sebelumnya tidak ikut; tinjau satu per satu.</p>
          {cepatSibuk && (
            <div className="dsb-status-bar" role="progressbar" aria-valuemin={0} aria-valuemax={cepatTerpilih.length} aria-valuenow={cepatProgres}>
              <span style={{ width: `${(cepatProgres / Math.max(cepatTerpilih.length, 1)) * 100}%`, background: "var(--st-green)" }} />
            </div>
          )}
        </KerangkaModal>
      )}
    </div>
  );
}
