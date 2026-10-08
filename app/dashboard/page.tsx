"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRole, useDashUser } from "@/app/dashboard/components/RoleContext";
import { ROLES, ROLE_LABEL } from "@/lib/auth";
import dynamic from "next/dynamic";
import type { KartuPapan, KolomPapan } from "@/app/dashboard/components/PapanAntrian";
import type { UsulanMenunggu } from "@/app/dashboard/components/ModalUsulanUpt";
import { keteranganRingkasan, nadaUmurUsulan, ringkasUsulanPerUpt } from "@/lib/ringkasUsulanUpt";
import { LABEL_REVIEW_SK, skBolehDicetak, type InfoReviewSk } from "@/lib/reviewSkUpt";
import { cetakSk, mintaReviewSkUpt } from "@/lib/kgbAksi";

/* Satu akun hanya memakai satu dashboard peran. Memuatnya sesuai kebutuhan menekan kerja server per
   permintaan dan biaya mulai isolate; tampilan sementaranya memakai kerangka yang sama dengan panel lain. */
const Memuat = () => <div className="dsb-halaman"><div className="dsb-kerangka" style={{ height: 240 }} /></div>;
const DashboardHukdis = dynamic(() => import("@/app/dashboard/components/DashboardHukdis"), { ssr: false, loading: Memuat });
const DashboardKeuangan = dynamic(() => import("@/app/dashboard/components/DashboardKeuangan"), { ssr: false, loading: Memuat });
const DashboardUpt = dynamic(() => import("@/app/dashboard/components/DashboardUpt"), { ssr: false, loading: Memuat });
const ModalUsulanUpt = dynamic(() => import("@/app/dashboard/components/ModalUsulanUpt"), { ssr: false });
const PapanAntrian = dynamic(() => import("@/app/dashboard/components/PapanAntrian"), { ssr: false });
const PanelKartuSatker = dynamic(() => import("@/app/dashboard/components/PanelKartuSatker"), { ssr: false });
const PanelGajiWebUpt = dynamic(() => import("@/app/dashboard/components/PanelGajiWebUpt"), { ssr: false });
import {
  KerangkaDashboard,
  PanelNavy,
  PanelTindakan,
  namaSapaan,
  sapaanWita,
  tanggalPanjangWita,
  type Nada,
  type Tindakan,
} from "@/app/dashboard/components/PanelNavy";
import {
  IkonPeringatan,
  KerangkaModal,
  ModalArsipKgb,
  ModalBatalkanKgb,
  ModalBuatSk,
  ModalInputKgb,
  ModalLewatiReview,
  ModalRiwayatKgb,
  ModalUnggahSk,
  dasarAwalInputKgb,
  type DasarSkAwal,
  type RingkasanSk,
} from "@/app/dashboard/components/kgb";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { formatTanggalId, tanggalKalender } from "@/lib/waktu";
import { jendelaProsesKgb } from "@/lib/tabelGaji";
import { SATKER, SATKER_KANWIL, cariSatker } from "@/lib/satker";
import { kodeSatkerPegawai } from "@/lib/rekapSatker";
import { susunKartuSatker } from "@/lib/kartuSatkerDasbor";
import { bandingTindakan, tindakanProses, type TindakanProses } from "@/lib/tindakanProses";
import {
  FOKUS_KOSONG,
  alihPeriode,
  alihSatker,
  bacaFokus,
  cocokFokus,
  fokusBerlaku,
  fokusKosong,
  kunciSimpanFokus,
  satkerDalamFokus,
  type FokusPapan,
} from "@/lib/fokusPapan";
import { dipegangKeuanganKanwil } from "@/lib/aksesUpt";
import { namaRingkasSatker } from "@/app/dashboard/satker/labelSatker";
/* -----------------------------------------
   Interfaces
   ----------------------------------------- */

interface PegawaiJatuhTempo {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  golonganRuang: string;
  unitKerja: string | null;
  tmtKgbBerikutnya: string;
  deadlineSDM: string;
  statusHukdis: boolean;
  tanggalHukdisBerakhir: string | null;
  flagRapelan: boolean;
  terlambat: boolean;
  isLocked: boolean;
  statusKGB: string | null;
  kgbId: string | null;
  nomorSK: string | null;
  penetapSkDasar: string | null;
  /** SK sudah dibuat di SIM-KGB; syarat Unggah SK TTE. */
  skSudahDibuat: boolean;
  /** Review SK oleh Admin UPT (ADR-077); null untuk pegawai Kanwil atau selama review belum aktif. */
  reviewSk?: InfoReviewSk | null;
  suratNomorSurat: string | null;
  /** Tanggal SK baru yang tersimpan; tanpa nilai ini Buat SK memakai tanggal hari ini. */
  suratTanggalSurat?: string | null;
  tanggalSK: string | null;
  tmtSK: string | null;
  gajiPokokLama: number | null;
  gajiPokokBaru: number | null;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  prevNomorSK: string | null;
  prevTanggalSK: string | null;
  prevTmtSK: string | null;
  prevPenetapSkDasar: string | null;
}

interface DashboardStats {
  totalPegawai: number;
  totalHukdis: number;
  kgbTahunIni: number;
  belumDiproses: number;
  /** Sedang Diproses ditambah Menunggu Keuangan. */
  sedangDiproses: number;
  menungguKeuangan?: number;
  selesai: number;
  ditolak: number;
  rapelanKonfirmasi: number;
  rapelanBerisiko: number;
}

interface DashboardData {
  stats: DashboardStats;
  pegawaiJatuhTempo: PegawaiJatuhTempo[];
  followupNotifs: { id: string; pesan: string; createdAt: string }[];
}

/* -----------------------------------------
   Helpers
   ----------------------------------------- */

/** Label dan warna badge status KGB dari lib/statusKgb.ts. */
function tampilanStatus(status: string) {
  return { label: infoStatusKgb(status).label, ...warnaStatusKgb(status) };
}

/** "yyyy-mm" menurut tanggal kalender WITA; string kosong bila tanggal kosong atau tidak valid. */
function kunciBulan(nilai: string | null | undefined): string {
  const t = tanggalKalender(nilai);
  return t ? `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}` : "";
}

function daysDiff(date: string) {
  return Math.ceil((new Date(date).getTime() - new Date().getTime()) / 86400000);
}

/** Umur dalam hari penuh sejak sebuah waktu lampau; 0 bila belum genap sehari. */
function hariSejak(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

/* -----------------------------------------
   Main Dashboard
   ----------------------------------------- */

/** Pegawai pada kartu pipeline yang diteruskan ke modal aksi KGB. */
interface PegawaiModal {
  id: string;
  nama: string;
  nip: string;
  jabatan: string | null;
  golonganRuang: string | null;
}

type ModalAksi =
  | { jenis: "input"; pegawai: PegawaiModal; ulang: boolean; dasarAwal: DasarSkAwal | null }
  | { jenis: "arsip"; pegawai: PegawaiModal }
  | {
      jenis: "buat_sk";
      kgbId: string;
      status: string;
      pegawai: PegawaiModal;
      ringkasan: RingkasanSk;
      dasarAwal: DasarSkAwal;
      nomorSkBaru: string | null;
      tanggalSkBaru: string | null;
      reviewUpt: InfoReviewSk | null;
    }
  | { jenis: "unggah_sk"; kgbId: string; status: string; pegawai: PegawaiModal }
  | { jenis: "lewati_review"; kgbId: string; pegawai: PegawaiModal; reviewSk: InfoReviewSk | null }
  | { jenis: "batalkan"; kgbId: string; pegawai: PegawaiModal }
  | { jenis: "riwayat"; pegawai: PegawaiModal };

/* -----------------------------------------
   Antrian kerja
   ----------------------------------------- */

/** Saringan tahap antrian kerja di dashboard. */
type Tahap = "perlu" | "lewat" | "keuangan" | "selesai" | "semua";

/** Posisi satu pegawai dalam antrian kerja KGB. */
/** "keuangan" = menunggu keuangan Kanwil; "rekam_upt" = SK pegawai UPT menunggu direkam keuangan UPT (ADR-009). */
type PosisiAntrian = "lewat" | "diproses" | "siap" | "keuangan" | "rekam_upt" | "terkunci" | "selesai";

const URUTAN_POSISI: Record<PosisiAntrian, number> = { lewat: 0, diproses: 1, siap: 2, keuangan: 3, rekam_upt: 4, terkunci: 5, selesai: 6 };

function posisiAntrian(p: PegawaiJatuhTempo): PosisiAntrian {
  if (p.statusKGB === "selesai") return "selesai";
  if (p.statusKGB === "menunggu_keuangan") return dipegangKeuanganKanwil(p.unitKerja) ? "keuangan" : "rekam_upt";
  if (p.statusKGB === "sedang_diproses") return "diproses";
  if (p.isLocked) return "terkunci";
  return p.terlambat ? "lewat" : "siap";
}

function cocokTahap(pos: PosisiAntrian, tahap: Tahap): boolean {
  switch (tahap) {
    case "perlu": return pos === "lewat" || pos === "diproses" || pos === "siap";
    case "lewat": return pos === "lewat";
    case "keuangan": return pos === "keuangan" || pos === "rekam_upt";
    case "selesai": return pos === "selesai";
    default: return true;
  }
}


/** Kolom papan untuk posisi antrian. */
function kolomPapan(pos: PosisiAntrian): KolomPapan {
  if (pos === "lewat" || pos === "siap") return "input";
  if (pos === "diproses") return "proses";
  return pos;
}

/** Tab tahap yang memuat tiap kolom papan; dipakai menunjuk tab saat isi sebuah kolom tersaring (ADR-052). */
const TAB_KOLOM: Record<KolomPapan, Tahap> = {
  terkunci: "semua", input: "perlu", proses: "perlu", keuangan: "keuangan", rekam_upt: "keuangan", selesai: "selesai",
};

/** Saringan satker antrian: semua, Kanwil, seluruh UPT, atau kode satu satker. */
function cocokSatker(p: PegawaiJatuhTempo, saring: string): boolean {
  if (saring === "semua") return true;
  const kode = kodeSatkerPegawai(p.unitKerja);
  if (saring === "upt") return kode !== SATKER_KANWIL.kode;
  return kode === saring;
}

function pegawaiModal(p: PegawaiJatuhTempo): PegawaiModal {
  return { id: p.id, nama: p.nama, nip: p.nip, jabatan: p.jabatan, golonganRuang: p.golonganRuang };
}


function DashboardMain() {
  const dashUser = useDashUser();
  const role = useRole();
  const [data, setData] = useState<DashboardData | null>(null);
  // Dibaca penyegaran latar, yang berjalan di luar siklus render.
  const dataRef = useRef<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tahap, setTahap] = useState<Tahap>("perlu");
  // Tampilan antrian: daftar (tabel) atau papan (kanban); pilihan diingat per peramban.
  const [cariAntrian, setCariAntrian] = useState("");
  const [filterMonth, setFilterMonth] = useState<string | null>(null);
  // Saringan satker (ADR-012): "semua", "upt", atau kode satker ("kanwil" untuk pegawai Kanwil).
  const [saringSatker, setSaringSatker] = useState("semua");
  // Fokus papan per satker dan periode TMT (ADR-088), tersimpan per akun di peramban ini.
  const [fokusSimpan, setFokusSimpan] = useState<FokusPapan>(() => {
    try {
      return typeof window === "undefined" ? FOKUS_KOSONG : bacaFokus(window.localStorage.getItem(kunciSimpanFokus(dashUser.nip)));
    } catch {
      return FOKUS_KOSONG;
    }
  });
  const simpanFokus = (f: FokusPapan) => {
    setFokusSimpan(f);
    try {
      window.localStorage.setItem(kunciSimpanFokus(dashUser.nip), JSON.stringify(f));
    } catch {
      // Penyimpanan peramban tidak tersedia: fokus tetap berlaku sampai halaman dimuat ulang.
    }
  };
  const [modal, setModal] = useState<ModalAksi | null>(null);
  // Seluruh usulan UPT yang menunggu tinjauan, termasuk pegawai baru yang belum punya pegawaiId.
  const [usulanMenunggu, setUsulanMenunggu] = useState<UsulanMenunggu[]>([]);
  // Usulan data UPT yang menunggu tinjauan, per pegawai: tampil langsung di papan dan daftar (ADR-011).
  // Hanya usulan perbaikan yang masuk sini, sebab hanya itu yang menahan proses KGB pegawai tertentu.
  const [usulanPerPegawai, setUsulanPerPegawai] = useState<Map<string, UsulanMenunggu>>(() => new Map());
  const [usulanDibuka, setUsulanDibuka] = useState<UsulanMenunggu | null>(null);
  const [pesanBerhasil, setPesanBerhasil] = useState<string | null>(null);
  // Galat aksi langsung dari kartu (Cetak SK, Minta review UPT) dan KGB yang sedang dikerjakan aksinya (ADR-077).
  const [pesanGagal, setPesanGagal] = useState<string | null>(null);
  const [sibukSk, setSibukSk] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  /**
   * Rincian di balik satu angka pada pita ringkasan. Dibuka sebagai jendela agar dasbor tidak
   * ditinggalkan; daftarnya diambil dari antrian kerja, jadi jumlahnya bisa lebih sedikit daripada
   * angka setahun penuh pada kartunya, dan subjudulnya menyebut keduanya.
   */
  const [showRapelanPopup, setShowRapelanPopup] = useState(false);
  const [rapelanKonfirmasiList, setRapelanKonfirmasiList] = useState<{ id: string; pegawai: { nama: string; nip: string }; tmtKgbBaru: string; golonganBaru: string; gajiPokokBaru: number; konfirmasiKeuanganAt: string | null }[]>([]);
  const [rapelanKonfirmasiLoading, setRapelanKonfirmasiLoading] = useState(false);

  const fetchDashboard = (silent = false) => {
    if (!silent) setApiError(null);
    fetch("/api/dashboard")
      .then((r) => r.json() as Promise<(Partial<DashboardData> & { error?: string }) | null>)
      .then((d) => {
        if (d && d.stats && Array.isArray(d.pegawaiJatuhTempo)) {
          dataRef.current = d as DashboardData;
          setData(d as DashboardData);
          setApiError(null);
          setLastRefresh(new Date());
        } else if (!silent || !dataRef.current) {
          // Penyegaran latar yang gagal tidak menghapus dasbor yang sudah tampil; berikutnya dicoba lagi.
          setApiError(d?.error ?? "Respons tidak valid dari server");
        }
        setLoading(false);
        setRefreshing(false);
      })
      .catch((e) => {
        if (!silent || !dataRef.current) setApiError(e?.message ?? "Gagal menghubungi server");
        setLoading(false);
        setRefreshing(false);
      });
  };

  function handleManualRefresh() {
    setRefreshing(true);
    fetchDashboard(true);
  }

  useEffect(() => {
    fetchDashboard();
    const onVisible = () => { if (document.visibilityState === "visible") fetchDashboard(true); };
    document.addEventListener("visibilitychange", onVisible);
    // Auto-refresh setiap 60 detik untuk menangkap perubahan dari halaman lain (pegawai baru, dll)
    const interval = setInterval(() => { if (document.visibilityState === "visible") fetchDashboard(true); }, 60_000);
    return () => { document.removeEventListener("visibilitychange", onVisible); clearInterval(interval); };
  }, []);

  // Pesan hasil aksi hilang sendiri setelah beberapa detik.
  useEffect(() => {
    if (!pesanBerhasil) return;
    const t = setTimeout(() => setPesanBerhasil(null), 8000);
    return () => clearTimeout(t);
  }, [pesanBerhasil]);
  useEffect(() => {
    if (!pesanGagal) return;
    const t = setTimeout(() => setPesanGagal(null), 12000);
    return () => clearTimeout(t);
  }, [pesanGagal]);

  // Usulan UPT yang menunggu dimuat ulang setiap dasbor disegarkan.
  useEffect(() => {
    if (!lastRefresh) return;
    let batal = false;
    fetch("/api/usulan?status=menunggu")
      .then((r) => (r.ok ? (r.json() as Promise<UsulanMenunggu[]>) : []))
      .then((daftar) => {
        if (batal || !Array.isArray(daftar)) return;
        setUsulanMenunggu(daftar);
        setUsulanPerPegawai(new Map(daftar.filter((u) => u.pegawaiId).map((u) => [u.pegawaiId as string, u])));
      })
      .catch(() => {
        // Penanda usulan hanya pelengkap; kegagalannya tidak mengganggu papan.
      });
    return () => {
      batal = true;
    };
  }, [lastRefresh]);

  if (loading) return <KerangkaDashboard />;

  if (apiError)
    return (
      <div className="dsb-halaman">
        <div className="dsb-kartu dsb-kosong" style={{ padding: "56px 20px" }} role="alert">
          <p className="dsb-judul" style={{ marginTop: 0 }}>Gagal memuat dashboard</p>
          <p>{apiError}</p>
          <button type="button" onClick={() => fetchDashboard()} className="dsb-tombol" style={{ marginTop: "8px" }}>
            Coba lagi
          </button>
        </div>
      </div>
    );

  if (!data) return null;

  const { stats, pegawaiJatuhTempo, followupNotifs } = data;

  // Pantau satker: angka per tahap dari antrian yang sama, ditambah usulan UPT yang menunggu.
  const usulanPerSatker = new Map<string, number>();
  for (const u of usulanMenunggu) {
    const kode = cariSatker(u.unitKerja)?.kode;
    if (kode) usulanPerSatker.set(kode, (usulanPerSatker.get(kode) ?? 0) + 1);
  }
  /**
   * Kartu satker (ADR-036): pekerjaan tiap satker dipecah per bulan TMT. Sumbernya sama dengan papan
   * antrian, yaitu pegawaiJatuhTempo beserta posisinya, jadi angka di kartu dan isi papan tidak bisa berbeda.
   * Tidak disaring satker maupun bulan, sebab kartunya justru yang memilih keduanya.
   */
  const kartuSatker = susunKartuSatker(
    pegawaiJatuhTempo.map((p) => ({
      kode: kodeSatkerPegawai(p.unitKerja) ?? SATKER_KANWIL.kode,
      bulanTmt: kunciBulan(p.tmtKgbBerikutnya),
      posisi: posisiAntrian(p),
    })),
    usulanPerSatker,
  );
  const kodeKartu = (p: PegawaiJatuhTempo) => kodeSatkerPegawai(p.unitKerja) ?? SATKER_KANWIL.kode;
  // Kunci yang satker atau periodenya sudah tidak punya pekerjaan tidak berlaku, supaya papan tidak kosong diam-diam.
  const fokus = fokusBerlaku(
    fokusSimpan,
    kartuSatker.map((k) => ({ kode: k.kode, bulan: k.bulan.map((b) => b.bulanTmt) })),
  );
  const adaFokus = !fokusKosong(fokus);

  /* -- Antrian kerja: satu daftar untuk semua tahap, disaring fokus, satker, lalu bulan TMT -- */
  const dalamSatker = pegawaiJatuhTempo.filter(
    (p) => cocokSatker(p, saringSatker) && cocokFokus(fokus, kodeKartu(p), kunciBulan(p.tmtKgbBerikutnya)),
  );

  /*
   * Kolom papan mengikuti satker yang disaring (ADR-049). Sesudah SK diunggah, pegawai Kanwil menunggu
   * keuangan Kanwil dan pegawai UPT menunggu satkernya merekam di Gaji Web (ADR-009); keduanya tidak
   * pernah terjadi pada orang yang sama. Menampilkan kolom yang tidak mungkin terisi hanya membuat alur
   * tampak lebih panjang daripada yang sebenarnya dijalani.
   */
  const kolomPapanTampil: KolomPapan[] = (() => {
    const semuaKolom: KolomPapan[] = ["terkunci", "input", "proses", "keuangan", "rekam_upt", "selesai"];
    if (saringSatker === "semua") {
      if (!adaFokus) return semuaKolom;
      // Fokus hanya Kanwil, atau hanya UPT: kolom yang tidak mungkin terisi disembunyikan, sama dengan saringan satker.
      const kode = [...satkerDalamFokus(fokus)];
      const adaKanwil = kode.includes(SATKER_KANWIL.kode);
      const adaUpt = kode.some((k) => k !== SATKER_KANWIL.kode);
      return semuaKolom.filter((k) => (k === "rekam_upt" ? adaUpt : k === "keuangan" ? adaKanwil : true));
    }
    const kanwil = saringSatker === SATKER_KANWIL.kode;
    return semuaKolom.filter((k) => (k === "rekam_upt" ? !kanwil : k === "keuangan" ? kanwil : true));
  })();
  // Lini masa dihitung dari daftar yang sama dengan antrian, sehingga angkanya selalu cocok.
  const qAntrian = cariAntrian.trim().toLowerCase();
  const dalamBulan = dalamSatker
    .filter((p) => !filterMonth || kunciBulan(p.tmtKgbBerikutnya) === filterMonth)
    .filter((p) => !qAntrian || p.nama.toLowerCase().includes(qAntrian) || p.nip.includes(qAntrian) || (p.unitKerja ?? "").toLowerCase().includes(qAntrian))
    .sort((a, b) => {
      const pa = posisiAntrian(a);
      const pb = posisiAntrian(b);
      if (pa !== pb) return URUTAN_POSISI[pa] - URUTAN_POSISI[pb];
      // Sedang diproses: menurut tindakan Kanwil, lalu batas input terdekat (ADR-089).
      if (pa === "diproses") {
        const t = bandingTindakan(a, b);
        if (t !== 0) return t;
      }
      return (
        new Date(a.tmtKgbBerikutnya).getTime() - new Date(b.tmtKgbBerikutnya).getTime() || a.nama.localeCompare(b.nama, "id")
      );
    });
  const jumlahTahap = (t: Tahap) => dalamBulan.filter((p) => cocokTahap(posisiAntrian(p), t)).length;
  const antrian = dalamBulan.filter((p) => cocokTahap(posisiAntrian(p), tahap));
  const jumlahPosisi = (...daftar: PosisiAntrian[]) => dalamBulan.filter((p) => daftar.includes(posisiAntrian(p))).length;
  const lewatBatas = jumlahPosisi("lewat");
  const diKeuanganKanwil = jumlahPosisi("keuangan");
  const diRekamUpt = jumlahPosisi("rekam_upt");
  const totalSiklus = dalamBulan.length;
  const tabTahap: {
    nilai: Tahap;
    label: string;
    nada?: "merah";
    meta?: string;
    metaNada?: "merah" | "ungu" | "hijau";
    dari?: number;
    progres?: number;
  }[] = [
    {
      nilai: "perlu",
      label: "Perlu diproses",
      meta: lewatBatas > 0 ? `${lewatBatas} lewat batas` : "semua dalam jadwal",
      metaNada: lewatBatas > 0 ? "merah" : "hijau",
    },
    {
      nilai: "lewat",
      label: "Lewat batas",
      nada: lewatBatas > 0 ? "merah" : undefined,
      meta: lewatBatas > 0 ? "berpotensi rapelan" : "tidak ada",
    },
    {
      nilai: "keuangan",
      label: "Di keuangan",
      meta: diKeuanganKanwil + diRekamUpt > 0
        ? [diKeuanganKanwil > 0 ? `${diKeuanganKanwil} Kanwil` : "", diRekamUpt > 0 ? `${diRekamUpt} rekam UPT` : ""].filter(Boolean).join(" · ")
        : "tidak ada",
      metaNada: diKeuanganKanwil + diRekamUpt > 0 ? "ungu" : undefined,
    },
    {
      nilai: "selesai",
      label: "Selesai",
      dari: totalSiklus,
      progres: totalSiklus > 0 ? Math.round((jumlahPosisi("selesai") / totalSiklus) * 100) : 0,
    },
    { nilai: "semua", label: "Semua", meta: `${jumlahPosisi("terkunci")} belum dibuka` },
  ];
  const jumlahKanwil = pegawaiJatuhTempo.filter((p) => cocokSatker(p, SATKER_KANWIL.kode)).length;
  const uptBerisi = SATKER.filter((st) => st.kode !== SATKER_KANWIL.kode)
    .map((st) => ({ st, jumlah: pegawaiJatuhTempo.filter((p) => cocokSatker(p, st.kode)).length }))
    .filter((x) => x.jumlah > 0);
  const labelSaringan =
    saringSatker === "semua" ? (adaFokus ? "fokus" : "semua satker")
    : saringSatker === "upt" ? "seluruh UPT"
    : namaRingkasSatker(SATKER.find((st) => st.kode === saringSatker) ?? SATKER_KANWIL);

  /**
   * Usulan menunggu diringkas satu butir per UPT, yang terbanyak lebih dulu (ADR-076). Satu UPT dapat mengirim puluhan
   * sampai ratusan usulan sekaligus; daftar satu baris per pegawai memenuhi dasbor. Meninjau tiap pegawai dan menyetujui
   * per surat dikerjakan di halaman Usulan UPT, yang dibuka sudah tersaring ke UPT yang dipilih.
   */
  const usulanPerUpt = ringkasUsulanPerUpt(usulanMenunggu, new Date(), (unitKerja) => cariSatker(unitKerja)?.kode ?? unitKerja.trim());

  const namaSatkerKartu = (kode: string) => {
    const st = SATKER.find((s) => s.kode === kode);
    return { ringkas: st ? namaRingkasSatker(st) : kode, lengkap: st?.nama ?? kode };
  };
  // Rincian fokus untuk penanda di kepala papan: satker utuh, lalu satker dengan TMT yang dikunci.
  const rincianFokus = [
    ...fokus.satker.map((k) => namaSatkerKartu(k).ringkas),
    ...fokus.periode.map((p) => {
      const [kode, bulan] = p.split("|");
      const [y, m] = bulan.split("-").map(Number);
      const namaBulan = y && m ? new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" }) : bulan;
      return `${namaSatkerKartu(kode).ringkas} TMT ${namaBulan}`;
    }),
  ];
  const satkerTanpaPekerjaan = Math.max(0, SATKER.length - kartuSatker.length);


  const namaBulanFilter = filterMonth
    ? (() => {
        const [y, m] = filterMonth.split("-");
        return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
      })()
    : null;

  // Menyaring antrian lalu menggulir ke panelnya.
  const bukaAntrian = (t: Tahap, bulan: string | null = null) => () => {
    setCariAntrian("");
    setTahap(t);
    setFilterMonth(bulan);
    document.getElementById("antrian-kerja")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* -- Perlu tindakan -- */
  const tindakan: Tindakan[] = [];
  const terlambatList = pegawaiJatuhTempo.filter((p) => p.terlambat);
  if (terlambatList.length > 0)
    tindakan.push({
      id: "terlambat",
      nada: "merah",
      isi: <><strong>{terlambatList.length} KGB lewat batas input</strong>, berpotensi rapelan.</>,
      aksi: { label: "Tampilkan", onClick: bukaAntrian("lewat") },
    });

  const deadline7 = pegawaiJatuhTempo.filter((p) => p.statusKGB !== "selesai" && !p.terlambat && daysDiff(p.deadlineSDM) >= 0 && daysDiff(p.deadlineSDM) <= 7);
  if (deadline7.length > 0)
    tindakan.push({
      id: "deadline7",
      nada: "kuning",
      isi: <><strong>{deadline7.length} pegawai</strong> batas input SK-nya kurang dari 7 hari lagi.</>,
      aksi: { label: "Tampilkan", onClick: bukaAntrian("perlu") },
    });

  // Potensi rapelan hanya jadi butir sendiri bila menambah informasi di luar yang lewat batas input.
  if (stats.rapelanBerisiko > terlambatList.length || stats.rapelanKonfirmasi > 0)
    tindakan.push({
      id: "rapelan",
      nada: "kuning",
      isi:
        stats.rapelanBerisiko > terlambatList.length
          ? <><strong>{stats.rapelanBerisiko} KGB berpotensi rapelan</strong>, termasuk yang sudah diproses setelah batas.</>
          : <><strong>{stats.rapelanKonfirmasi} rapelan</strong> sudah ditetapkan keuangan.</>,
      aksi: { label: "Rincian", onClick: bukaRapelan },
    });

  // Review SK oleh Admin UPT (ADR-077): yang diminta diperbaiki menunggu Kanwil, yang disetujui siap dicetak dan
  // ditandatangani. Yang masih menunggu UPT bukan pekerjaan Kanwil, jadi cukup tampil sebagai penanda kartu.
  const skDiprosesUpt = pegawaiJatuhTempo.filter((p) => p.statusKGB === "sedang_diproses" && p.skSudahDibuat && p.reviewSk);
  const skPerbaikan = skDiprosesUpt.filter((p) => p.reviewSk?.status === "perbaikan");
  if (skPerbaikan.length > 0)
    tindakan.push({
      id: "review-perbaikan",
      nada: "merah",
      isi: (
        <>
          <strong>{skPerbaikan.length} SK diminta diperbaiki UPT</strong>
          {skPerbaikan.length === 1 ? ` (${skPerbaikan[0].nama})` : ""}. Perbaiki SK; review diminta ulang otomatis.
        </>
      ),
      aksi: { label: "Tampilkan", onClick: bukaAntrian("perlu") },
    });
  const skSiapCetak = skDiprosesUpt.filter((p) => p.reviewSk?.status === "disetujui");
  if (skSiapCetak.length > 0)
    tindakan.push({
      id: "review-disetujui",
      nada: "hijau",
      isi: (
        <>
          <strong>{skSiapCetak.length} SK disetujui UPT</strong>, siap dicetak, ditandatangani, dikirim lewat Srikandi, lalu
          diunggah TTE.
        </>
      ),
      aksi: { label: "Tampilkan", onClick: bukaAntrian("perlu") },
    });

  // Usulan data UPT yang menunggu tidak diulang di sini: panel Usulan UPT menunggu di atas Perlu tindakan sudah memuatnya
  // per UPT beserta umur terlamanya, dan jumlah KGB yang tertahan ikut di kepalanya (ADR-092).

  // Permintaan follow up dari keuangan
  for (const notif of (followupNotifs ?? [])) {
    tindakan.push({
      id: `followup-${notif.id}`,
      nada: "kuning",
      isi: <><strong>Keuangan:</strong> {notif.pesan}</>,
      aksi: { label: "Buka Proses KGB", href: "/dashboard/kgb" },
    });
  }

  function tutupModal() {
    setModal(null);
  }

  /**
   * Proses KGB tertahan selama usulan UPT pegawai ini menunggu tinjauan dan SK TTE-nya belum diunggah
   * (ADR-014); server menolak langkahnya dengan aturan yang sama (lib/usulanMenahan.ts).
   */
  function tertahanUsulan(p: { id: string }, pos: PosisiAntrian): boolean {
    return usulanPerPegawai.has(p.id) && pos !== "keuangan" && pos !== "rekam_upt" && pos !== "selesai";
  }

  /** Tombol tinjauan usulan UPT; tombol utama bila prosesnya sedang tertahan. */
  function tombolUsulan(p: { id: string }, utama = false) {
    const u = usulanPerPegawai.get(p.id);
    if (!u) return null;
    return (
      <button
        type="button"
        className="dsb-tombol dsb-tombol-kecil"
        data-jenis={utama ? undefined : "garis"}
        data-nada={utama ? "ungu" : undefined}
        onClick={() => setUsulanDibuka(u)}
        title="Tinjau usulan data dari UPT"
      >
        {utama ? "Tinjau usulan UPT" : "Usulan UPT"}
        {u.perubahan.length > 0 ? ` (${u.perubahan.length})` : ""}
      </button>
    );
  }

  function aksiBerhasil(pesan: string) {
    setModal(null);
    setPesanBerhasil(pesan);
    fetchDashboard(true);
  }

  function bukaRapelan() {
    setShowRapelanPopup(true);
    setRapelanKonfirmasiLoading(true);
    fetch("/api/kgb?rapelanDitetapkan=true")
      .then((r) => r.json() as Promise<unknown>)
      .then((d) => setRapelanKonfirmasiList(Array.isArray(d) ? d : []))
      .catch(() => setRapelanKonfirmasiList([]))
      .finally(() => setRapelanKonfirmasiLoading(false));
  }

  function bukaBuatSk(p: PegawaiJatuhTempo) {
    if (!p.kgbId) return;
    setModal({
      jenis: "buat_sk",
      kgbId: p.kgbId,
      status: p.statusKGB ?? "",
      pegawai: pegawaiModal(p),
      ringkasan: {
        golongan: p.golonganRuang,
        gajiPokokLama: p.gajiPokokLama,
        gajiPokokBaru: p.gajiPokokBaru,
        mkgTahunBaru: p.mkgTahunBaru,
        mkgBulanBaru: p.mkgBulanBaru,
        tmtKgbBaru: p.tmtKgbBerikutnya,
        flagRapelan: p.flagRapelan,
      },
      dasarAwal: { nomorSK: p.nomorSK, tanggalSK: p.tanggalSK, tmtSK: p.tmtSK, penetapSkDasar: p.penetapSkDasar },
      nomorSkBaru: p.suratNomorSurat,
      tanggalSkBaru: p.suratTanggalSurat ?? null,
      reviewUpt: p.reviewSk ?? null,
    });
  }

  /** Cetak SK: SK biasa untuk tanda tangan basah dan versi Srikandi, tanpa tanda air (ADR-077). */
  async function cetakSkPegawai(p: PegawaiJatuhTempo) {
    if (!p.kgbId || sibukSk) return;
    setSibukSk(p.kgbId);
    setPesanGagal(null);
    const hasil = await cetakSk(p.kgbId, { nama: p.nama });
    setSibukSk(null);
    if (!hasil.ok) {
      setPesanGagal(hasil.error);
      return;
    }
    setPesanBerhasil(`SK ${p.nama} diunduh: SK biasa untuk tanda tangan basah dan versi Srikandi. Setelah ditandatangani, pilih Unggah TTE.`);
  }

  /** Minta review UPT untuk SK yang dibuat sebelum review aktif (ADR-077). */
  async function mintaReviewPegawai(p: PegawaiJatuhTempo) {
    if (!p.kgbId || sibukSk) return;
    setSibukSk(p.kgbId);
    setPesanGagal(null);
    const hasil = await mintaReviewSkUpt(p.kgbId);
    setSibukSk(null);
    if (!hasil.ok) {
      setPesanGagal(hasil.error);
      return;
    }
    aksiBerhasil(`Permintaan review SK ${p.nama} dikirim ke Admin UPT. Cetak SK tersedia setelah UPT menyetujui.`);
  }

  /** Kartu papan: isi yang sama dengan baris daftar, ditambah kolom tujuan yang boleh untuk diseret. */
  function kartuPapan(p: PegawaiJatuhTempo): KartuPapan {
    const pos = posisiAntrian(p);
    const kolom = kolomPapan(pos);
    const hari = daysDiff(p.deadlineSDM);
    const satker = p.unitKerja?.trim() ? cariSatker(p.unitKerja) : SATKER_KANWIL;
    const dibatalkan = p.statusKGB === "ditolak";
    const buka = pos === "terkunci" ? jendelaProsesKgb(p.tmtKgbBerikutnya)?.unlockDate : null;
    const tombol = aksiBaris(p, pos);
    const tertahan = tertahanUsulan(p, pos);
    const pindah: Partial<Record<KolomPapan, string>> = {};
    if (tertahan) {
      // Tidak ada langkah yang boleh dijalankan sampai usulannya ditinjau (ADR-014).
    } else if (kolom === "input") {
      pindah.proses = dibatalkan ? "Input ulang KGB" : "Input KGB";
      if (pos === "lewat") pindah.selesai = "Arsip, SK sudah terbit di luar SIM-KGB";
    }
    if (kolom === "proses" && p.kgbId) {
      // Sesudah diunggah, SK pegawai UPT ditindaklanjuti keuangan UPT, bukan keuangan Kanwil (ADR-009).
      // SK pegawai UPT yang belum disetujui UPT tidak dapat diseret ke unggah TTE (ADR-077).
      if (!p.skSudahDibuat || skBolehDicetak(p.reviewSk))
        pindah[dipegangKeuanganKanwil(p.unitKerja) ? "keuangan" : "rekam_upt"] = p.skSudahDibuat ? "Unggah SK TTE" : "Buat SK dulu";
      pindah.input = "Batalkan proses";
    }
    const tanda: NonNullable<KartuPapan["tanda"]> = [];
    // Kolom Sedang diproses (ADR-089): garis, label, dan redup menurut siapa yang harus bertindak.
    let nadaKartu: Nada | undefined = pos === "lewat" ? "merah" : undefined;
    let label: KartuPapan["label"];
    let redup = false;
    if (kolom === "proses") {
      const tindakan = tindakanProses(p);
      const review = p.reviewSk ?? null;
      const tgl = (iso: string | null) => (iso ? ` ${formatTanggalId(iso, { day: "numeric", month: "short" })}` : "");
      if (tindakan === "buat_sk") tanda.push({ teks: "Perlu buat SK" });
      else if (tindakan === "perbaikan") {
        nadaKartu = "merah";
        label = { teks: "Perbaiki SK", nada: "merah" };
        tanda.push({ teks: `${LABEL_REVIEW_SK.perbaikan.kanwil}${review?.catatan ? `: ${review.catatan}` : ""}`, nada: "merah" });
      } else if (tindakan === "siap") {
        nadaKartu = "hijau";
        label = { teks: "Siap cetak", nada: "hijau" };
        tanda.push(
          review?.status === "disetujui"
            ? { teks: `Disetujui UPT${tgl(review.ditanggapiAt)}`, nada: "hijau" }
            : review?.status === "dilewati"
              ? { teks: `Review dilewati${review.alasanLewati ? `: ${review.alasanLewati}` : ""}`, nada: "kuning" }
              : { teks: "SK dibuat, siap cetak dan TTE", nada: "hijau" },
        );
      } else if (tindakan === "minta_review") {
        tanda.push({ teks: "SK lama belum direview UPT: minta review", nada: "kuning" });
      } else {
        redup = true;
        const hari = review?.dimintaAt ? hariSejak(review.dimintaAt) : null;
        tanda.push({
          teks: `Menunggu review UPT${hari === null ? "" : hari === 0 ? " sejak hari ini" : ` · ${hari} hari`}`,
          nada: "ungu",
        });
      }
    }
    if (dibatalkan) tanda.push({ teks: "Dibatalkan", nada: "merah" });
    // Kartu yang lewat batas sudah menyebutnya di baris TMT; penanda rapelan hanya untuk yang sudah berjalan.
    if (p.flagRapelan && pos !== "selesai" && pos !== "lewat") tanda.push({ teks: "Berpotensi rapelan", nada: "kuning" });
    if (p.statusHukdis) tanda.push({ teks: `Hukdis${p.tanggalHukdisBerakhir ? ` s.d. ${formatTanggalId(p.tanggalHukdisBerakhir, { day: "numeric", month: "short" })}` : ""}`, nada: "merah" });
    if (tertahan) tanda.push({ teks: "Tertahan usulan UPT", nada: "ungu" });
    const [catatan, catatanNada]: [string | undefined, Nada | undefined] =
      pos === "terkunci" ? [buka ? `dibuka ${formatTanggalId(buka, { day: "numeric", month: "short" })}` : "belum dibuka", undefined]
      : pos === "keuangan" || pos === "rekam_upt" || pos === "selesai" ? [undefined, undefined]
      : hari < 0 ? [`lewat batas ${-hari} hari`, "merah"]
      : hari <= 7 ? [hari === 0 ? "batas hari ini" : `batas ${hari} hari lagi`, "merah"]
      : [`batas ${formatTanggalId(p.deadlineSDM, { day: "numeric", month: "short" })}`, undefined];
    return {
      id: p.id,
      kolom,
      nama: p.nama,
      sub: `${p.golonganRuang} · ${satker ? namaRingkasSatker(satker) : p.unitKerja}`,
      // Penanda asal, bukan singkatan nama satker: nama satker tetap utuh pada baris di bawahnya.
      asal: { teks: satker?.jenis === "kanwil" ? "Kanwil" : "UPT", kanwil: satker?.jenis === "kanwil" },
      judulSub: p.unitKerja ?? undefined,
      tmt: `TMT ${formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}`,
      catatan,
      catatanNada,
      nada: nadaKartu,
      label,
      redup,
      tanda,
      aksi: tombol ? (
        <div className="dsb-aksi" style={{ flexWrap: "wrap", justifyContent: "flex-start" }}>{tombol}</div>
      ) : undefined,
      pindah,
    };
  }

  /** Kartu dilepas di kolom lain: buka modal aksi yang sesuai; datanya baru berubah setelah modal dikonfirmasi. */
  function pindahKartu(id: string, ke: KolomPapan) {
    const p = pegawaiJatuhTempo.find((x) => x.id === id);
    if (!p) return;
    const dari = kolomPapan(posisiAntrian(p));
    if (dari === "input" && ke === "proses") {
      setModal({ jenis: "input", pegawai: pegawaiModal(p), ulang: p.statusKGB === "ditolak", dasarAwal: dasarAwalInputKgb(p) });
    } else if (dari === "input" && ke === "selesai" && posisiAntrian(p) === "lewat") {
      setModal({ jenis: "arsip", pegawai: pegawaiModal(p) });
    } else if (dari === "proses" && (ke === "keuangan" || ke === "rekam_upt") && p.kgbId) {
      if (p.skSudahDibuat) setModal({ jenis: "unggah_sk", kgbId: p.kgbId, status: p.statusKGB ?? "", pegawai: pegawaiModal(p) });
      else bukaBuatSk(p);
    } else if (dari === "proses" && ke === "input" && p.kgbId) {
      setModal({ jenis: "batalkan", kgbId: p.kgbId, pegawai: pegawaiModal(p) });
    }
  }

  /** Tombol aksi baris antrian menurut posisinya. */
  function aksiBaris(p: PegawaiJatuhTempo, pos: PosisiAntrian) {
    if (tertahanUsulan(p, pos)) {
      const kgbId = p.kgbId;
      return (
        <>
          {pos === "diproses" && kgbId && (
            <button type="button" className="dsb-ikon-tombol" data-nada="merah" onClick={() => setModal({ jenis: "batalkan", kgbId, pegawai: pegawaiModal(p) })} title="Batalkan proses KGB" aria-label={`Batalkan proses KGB ${p.nama}`}>
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
          {tombolUsulan(p, true)}
        </>
      );
    }
    if (usulanPerPegawai.has(p.id) && (pos === "keuangan" || pos === "rekam_upt" || pos === "selesai")) {
      return <>{tombolUsulan(p)}{aksiBarisTanpaUsulan(p, pos)}</>;
    }
    return aksiBarisTanpaUsulan(p, pos);
  }

  function aksiBarisTanpaUsulan(p: PegawaiJatuhTempo, pos: PosisiAntrian) {
    if (pos === "lewat" || pos === "siap") {
      const dibatalkan = p.statusKGB === "ditolak";
      return (
        <>
          {pos === "lewat" && (
            <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setModal({ jenis: "arsip", pegawai: pegawaiModal(p) })} title="SK KGB periode ini sudah terbit di luar SIM-KGB">
              Arsip
            </button>
          )}
          <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={() => setModal({ jenis: "input", pegawai: pegawaiModal(p), ulang: dibatalkan, dasarAwal: dasarAwalInputKgb(p) })}>
            {dibatalkan ? "Input ulang" : "Input KGB"}
          </button>
        </>
      );
    }
    if (pos === "diproses" && p.kgbId) {
      const kgbId = p.kgbId;
      return (
        <>
          {/* Batalkan di ujung, supaya langkah berikutnya selalu tombol pertama (ADR-089). */}
          <button type="button" className="dsb-ikon-tombol" data-nada="merah" style={{ order: 1 }} onClick={() => setModal({ jenis: "batalkan", kgbId, pegawai: pegawaiModal(p) })} title="Batalkan proses KGB" aria-label={`Batalkan proses KGB ${p.nama}`}>
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          {p.skSudahDibuat ? (
            <>
              {/* SK yang sudah dibuat masih mungkin keliru isinya, misalnya ketika Keuangan
                  mengembalikannya (ADR-047). Buat SK dapat mencatat ulang nomor, tanggal, dan isinya, tetapi
                  sebelum ini pintunya tertutup begitu SK pertama jadi: satu-satunya tombol yang tersisa
                  justru mengunggah SK yang salah itu (ADR-049). SK pegawai UPT dicetak dan diunggah TTE
                  setelah Admin UPT menyetujuinya; Perbaiki SK meminta review ulang (ADR-077). */}
              <button
                type="button"
                className="dsb-tombol dsb-tombol-kecil"
                data-jenis={p.reviewSk?.status === "perbaikan" ? undefined : "garis"}
                onClick={() => bukaBuatSk(p)}
                title="Buat ulang SK: nomor, tanggal, dan isinya dicatat ulang"
              >
                Perbaiki SK
              </button>
              {p.reviewSk && p.reviewSk.status === null && (
                <button
                  type="button"
                  className="dsb-tombol dsb-tombol-kecil"
                  data-jenis="garis"
                  disabled={sibukSk === kgbId}
                  onClick={() => void mintaReviewPegawai(p)}
                  title="SK ini dibuat sebelum review UPT aktif. Minta Admin UPT memeriksanya sebelum dicetak."
                >
                  Minta review UPT
                </button>
              )}
              {!skBolehDicetak(p.reviewSk) && role === ROLES.SUPER_ADMIN && (
                <button
                  type="button"
                  className="dsb-tombol dsb-tombol-kecil"
                  data-jenis="garis"
                  onClick={() => setModal({ jenis: "lewati_review", kgbId, pegawai: pegawaiModal(p), reviewSk: p.reviewSk ?? null })}
                  title="Lanjutkan tanpa menunggu UPT, dengan alasan yang tercatat"
                >
                  Lewati review
                </button>
              )}
              {skBolehDicetak(p.reviewSk) && (
                <>
                  {/* Langkah berikutnya tampil paling depan dan Cetak SK menjadi tombol utama (ADR-089). */}
                  <button
                    type="button"
                    className="dsb-tombol dsb-tombol-kecil"
                    data-nada="hijau-penuh"
                    style={{ order: -2 }}
                    disabled={sibukSk === kgbId}
                    onClick={() => void cetakSkPegawai(p)}
                    title="Unduh SK biasa (tanda tangan basah) dan versi Srikandi tanpa tanda air"
                  >
                    {sibukSk === kgbId ? "Menyiapkan..." : "Cetak SK"}
                  </button>
                  <button type="button" className="dsb-tombol dsb-tombol-kecil" data-nada="hijau" style={{ order: -1 }} onClick={() => setModal({ jenis: "unggah_sk", kgbId, status: p.statusKGB ?? "", pegawai: pegawaiModal(p) })}>
                    Unggah TTE
                  </button>
                </>
              )}
            </>
          ) : (
            <button type="button" className="dsb-tombol dsb-tombol-kecil" onClick={() => bukaBuatSk(p)}>
              Buat SK
            </button>
          )}
        </>
      );
    }
    if (pos === "selesai")
      return (
        <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="garis" onClick={() => setModal({ jenis: "riwayat", pegawai: pegawaiModal(p) })}>
          Riwayat
        </button>
      );
    return null;
  }

  const nama = namaSapaan(dashUser.nama, ROLE_LABEL[role]);

  return (
    <>
    <div className="dsb-halaman" data-muat-layar="">

      {/* -- Pita ringkas: sapaan dan keterangan satu baris (ADR-013) -- */}
      <PanelNavy
        ringkas
        label={`Dashboard ${ROLE_LABEL[role] ?? "SIM-KGB"}`}
        judul={`${sapaanWita()}${nama ? `, ${nama}` : ""}`}
        sub={<>
          {tanggalPanjangWita()} · {stats.totalPegawai} pegawai aktif
          {stats.totalHukdis > 0 && <> · {stats.totalHukdis} hukdis aktif</>}
        </>}
        diperbarui={lastRefresh}
        onMuatUlang={handleManualRefresh}
        memuat={refreshing}
      />

      <div className="dsb-dasbor-isi">

        {/* -- Antrian kerja KGB: kartu utama, mengisi tinggi layar -- */}
        <section id="antrian-kerja" className="dsb-panel dsb-antrian dsb-penuh dsb-tujuan dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="judul-antrian">
          <div className="dsb-panel-kepala dsb-antrian-kepala">
            <h2 id="judul-antrian" className="dsb-panel-judul">
              Antrian kerja KGB <small>{labelSaringan}</small>
            </h2>
            <div className="dsb-antrian-alat">
              {adaFokus && (
                <button
                  type="button"
                  className="dsb-tombol dsb-tombol-kecil"
                  data-jenis="lembut"
                  onClick={() => simpanFokus(FOKUS_KOSONG)}
                  title={`Fokus: ${rincianFokus.join(", ")}. Tekan untuk membuka semua kunci.`}
                  aria-label={`Buka fokus papan: ${rincianFokus.join(", ")}`}
                >
                  <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                  Fokus: {rincianFokus.length > 2 ? `${rincianFokus.slice(0, 2).join(", ")} +${rincianFokus.length - 2}` : rincianFokus.join(", ")}
                  <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
              {filterMonth && (
                <button type="button" className="dsb-tombol dsb-tombol-kecil" data-jenis="lembut" onClick={() => setFilterMonth(null)} aria-label={`Hapus saringan TMT ${namaBulanFilter}`}>
                  TMT {namaBulanFilter}
                  <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
              <select
                className="dsb-cari dsb-pilih-satker"
                aria-label="Saring satker"
                value={saringSatker}
                onChange={(e) => setSaringSatker(e.target.value)}
              >
                <option value="semua">Semua satker ({pegawaiJatuhTempo.length})</option>
                <option value={SATKER_KANWIL.kode}>Kanwil ({jumlahKanwil})</option>
                <option value="upt">Seluruh UPT ({pegawaiJatuhTempo.length - jumlahKanwil})</option>
                {uptBerisi.length > 0 && (
                  <optgroup label="Satu UPT">
                    {uptBerisi.map(({ st, jumlah }) => (
                      <option key={st.kode} value={st.kode}>{namaRingkasSatker(st)} ({jumlah})</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <input
                type="search"
                className="dsb-cari dsb-cari-antrian"
                aria-label="Cari di antrian"
                placeholder="Cari nama, NIP, satker"
                value={cariAntrian}
                onChange={(e) => setCariAntrian(e.target.value)}
              />
            </div>
          </div>

          {/* Angka tahap sekaligus saringan papan (ADR-013, ADR-036). Dulu ubin ini memaksa pindah ke
              tampilan daftar dan papan mengabaikannya; sejak daftar dilepas, ubinlah penyaring papannya.
              Menekan ubin yang sedang aktif mengembalikan papan ke seluruh tahap. */}
          <div className="dsb-tahap" role="group" aria-label="Tahap antrian">
            {tabTahap.map((t) => (
              <button
                key={t.nilai}
                type="button"
                className="dsb-tahap-ubin"
                aria-pressed={tahap === t.nilai}
                data-nada={t.nada}
                onClick={() => setTahap(tahap === t.nilai ? "semua" : t.nilai)}
              >
                <span className="dsb-tahap-label">{t.label}</span>
                <span className="dsb-tahap-angka">
                  {jumlahTahap(t.nilai)}
                  {t.dari != null && <small>/ {t.dari}</small>}
                </span>
                {t.meta && <span className="dsb-tahap-meta" data-nada={t.metaNada} title={t.meta}>{t.meta}</span>}
                {t.progres != null && (
                  <span className="dsb-tahap-bar" aria-hidden="true"><span style={{ width: `${t.progres}%` }} /></span>
                )}
              </button>
            ))}
          </div>

          {/* Papan kanban adalah satu-satunya tampilan antrian sejak ADR-036. Kartunya memakai `antrian`,
              yakni pegawai bulan terpilih yang lolos saringan tahap, sehingga ubin tahap di atas benar-benar
              menyaring papan ini. */}
          {antrian.length === 0 ? (
            <p className="dsb-kosong" style={{ padding: "48px 16px" }}>
              {tahap === "perlu" || tahap === "lewat"
                ? "Tidak ada KGB yang perlu diproses untuk saringan ini."
                : "Tidak ada KGB untuk saringan ini."}
            </p>
          ) : (
            <PapanAntrian
              className="dsb-antrian-gulir"
              kartu={antrian.map(kartuPapan)}
              kolom={kolomPapanTampil}
              tersaring={Object.fromEntries(kolomPapanTampil.map((k) => {
                const tab = TAB_KOLOM[k];
                const jumlah = dalamBulan.filter((p) => kolomPapan(posisiAntrian(p)) === k).length
                  - antrian.filter((p) => kolomPapan(posisiAntrian(p)) === k).length;
                return [k, { jumlah, tab: tabTahap.find((x) => x.nilai === tab)?.label ?? "Semua", buka: () => setTahap(tab) }];
              }))}
              keterangan={{
                input: (() => { const n = antrian.filter((p) => posisiAntrian(p) === "lewat").length; return n > 0 ? `${n} lewat batas` : undefined; })(),
                proses: (() => {
                  // Ringkasan menurut tindakan (ADR-089); yang menunggu UPT tidak disebut "tunggu TTE".
                  const hitung = (t: TindakanProses) => antrian.filter((p) => posisiAntrian(p) === "diproses" && tindakanProses(p) === t).length;
                  const bagian = [
                    [hitung("perbaikan"), "perbaikan"],
                    [hitung("siap"), "siap cetak"],
                    [hitung("menunggu_upt"), "menunggu UPT"],
                  ].filter(([n]) => (n as number) > 0).map(([n, teks]) => `${n} ${teks}`);
                  return bagian.length > 0 ? bagian.join(" · ") : undefined;
                })(),
              }}
              onPindah={pindahKartu}
            />
          )}
          <div className="dsb-kaki">
            <span>
              {antrian.length} pegawai · seret kartu ke kolom lain untuk membuka aksinya; tombol di kartu
              melakukan hal yang sama.
            </span>
            <Link href={tahap === "lewat" ? "/dashboard/kgb?rapelan=1" : "/dashboard/kgb"} className="dsb-tautan">Buka Proses KGB →</Link>
          </div>
        </section>

        {/* -- Rail: tindakan, jadwal input, dan pantau satker -- */}
        <aside className="dsb-samping dsb-muncul" style={{ "--i": 2 } as React.CSSProperties} aria-label="Ringkasan pendamping">
          {/* Usulan UPT yang menunggu, paling atas di rel (ADR-092): didahulukan karena menahan proses KGB pegawainya
              (ADR-014). Dulu panel ini selebar halaman di atas antrian dan memakan ±140 px tinggi papan. Diringkas satu
              baris per UPT (ADR-076); peninjauan per pegawai dan per surat ada di halaman Usulan UPT. */}
          {usulanMenunggu.length > 0 && (
            <section id="panel-usulan-upt" className="dsb-panel usl-antrian-panel" aria-labelledby="judul-usulan-upt">
              <div className="dsb-panel-kepala">
                <h2 id="judul-usulan-upt" className="dsb-panel-judul">
                  Usulan UPT menunggu <small>{usulanMenunggu.length}</small>
                </h2>
                <Link href="/dashboard/usulan" className="dsb-tautan" style={{ marginLeft: "auto" }}>
                  Semua →
                </Link>
              </div>
              <p className="usl-ringkas-sub">
                {usulanPerUpt.length} UPT
                {usulanPerPegawai.size > 0 && <> · proses KGB {usulanPerPegawai.size} pegawai tertahan sampai ditinjau</>}
              </p>
              <ul className="usl-ringkas" aria-label="Usulan menunggu per UPT">
                {usulanPerUpt.map((r) => {
                  const satker = cariSatker(r.unitKerja);
                  return (
                    <li key={r.kode}>
                      <span className="min-w-0">
                        <strong title={satker?.nama ?? r.unitKerja}>{satker ? namaRingkasSatker(satker) : r.unitKerja}</strong>
                        <span>{keteranganRingkasan(r)}</span>
                      </span>
                      <span className="dsb-tag" data-garis="" data-nada={nadaUmurUsulan(r.hariTerlama)} title="Jumlah usulan yang menunggu">
                        {r.jumlah}
                      </span>
                      <Link
                        href={`/dashboard/usulan?upt=${encodeURIComponent(r.kode)}`}
                        className="dsb-tombol dsb-tombol-kecil"
                        aria-label={`Tinjau ${r.jumlah} usulan dari ${satker ? namaRingkasSatker(satker) : r.unitKerja}`}
                      >
                        Tinjau
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <PanelTindakan daftar={tindakan} kosong="Tidak ada KGB yang perlu ditindaklanjuti saat ini." lainnyaHref="/dashboard/notifikasi" />

          {/* Panel Jadwal input dilepas (ADR-036): rincian per bulan TMT kini melekat pada satkernya di
              kartu di bawah, sehingga tidak lagi perlu lini masa se-Kanwil yang berdiri sendiri. */}
          <PanelKartuSatker
            kartu={kartuSatker}
            namaSatker={namaSatkerKartu}
            tanpaPekerjaan={satkerTanpaPekerjaan}
            fokus={fokus}
            onAlihSatker={(kode) => {
              // Fokus menjadi saringan utama papan; saringan satker dan TMT di kepala papan dikembalikan ke semua.
              simpanFokus(alihSatker(fokus, kode));
              setSaringSatker("semua");
              setFilterMonth(null);
            }}
            onAlihPeriode={(kode, bulan) => {
              simpanFokus(alihPeriode(fokus, kode, bulan));
              setSaringSatker("semua");
              setFilterMonth(null);
            }}
            onBukaSemua={() => simpanFokus(FOKUS_KOSONG)}
          />

          {/* Pemantauan SK pegawai UPT yang belum direkam di Gaji Web satkernya. Dipindah dari dasbor
              Keuangan (ADR-049): keuangan Kanwil tidak menindaklanjutinya, sedangkan Tim SDM-lah yang
              menagih UPT-nya. */}
          <PanelGajiWebUpt versi={lastRefresh?.getTime()} />
        </aside>
      </div>

    </div>

      {showRapelanPopup && (() => {
        const berisiko = pegawaiJatuhTempo.filter((p) => p.flagRapelan);
        const tutupRapelan = () => setShowRapelanPopup(false);
        return (
          <KerangkaModal
            judul="Status Rapelan"
            subjudul={`${stats.rapelanKonfirmasi} terkonfirmasi · ${stats.rapelanBerisiko} berpotensi rapelan`}
            ikon={<IkonPeringatan />}
            nada="merah"
            onTutup={tutupRapelan}
            kaki={
              <>
                <button type="button" className="kgbm-tombol kgbm-kedua" onClick={tutupRapelan}>
                  Tutup
                </button>
                <Link href="/dashboard/kgb" className="kgbm-tombol kgbm-utama" onClick={tutupRapelan}>
                  Buka Proses KGB
                </Link>
              </>
            }
          >
            {/* Ringkasan */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3 text-center" style={{ background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)" }}>
                <p className="text-xl font-bold" style={{ color: "var(--st-red)" }}>{stats.rapelanKonfirmasi}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--st-amber)" }}>Terkonfirmasi</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--dt5)", fontSize: "10px" }}>dikonfirmasi keuangan</p>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: stats.rapelanBerisiko > 0 ? "var(--tint-amber-bg)" : "var(--sub)", border: `1px solid ${stats.rapelanBerisiko > 0 ? "var(--tint-amber-ln)" : "var(--ln1)"}` }}>
                <p className="text-xl font-bold" style={{ color: stats.rapelanBerisiko > 0 ? "var(--st-amber)" : "var(--dt5)" }}>{stats.rapelanBerisiko}</p>
                <p className="text-xs mt-0.5" style={{ color: stats.rapelanBerisiko > 0 ? "var(--st-amber2)" : "var(--dt5)" }}>Berpotensi rapelan</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--dt5)", fontSize: "10px" }}>belum selesai, sudah lewat batas input</p>
              </div>
            </div>

            {/* Daftar terkonfirmasi */}
            {rapelanKonfirmasiLoading ? (
              <p role="status" className="text-xs text-center py-3" style={{ color: "var(--dt5)" }}>Memuat data terkonfirmasi...</p>
            ) : rapelanKonfirmasiList.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold" style={{ color: "var(--st-red)" }}>
                  Dikonfirmasi Keuangan ({rapelanKonfirmasiList.length})
                </p>
                {rapelanKonfirmasiList.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: "var(--tint-red-bg)", border: "0.5px solid var(--tint-red-ln)" }}>
                    <div aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: "var(--tint-red-ln)", color: "var(--st-red)" }}>
                      {k.pegawai.nama.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--dtn)" }}>{k.pegawai.nama}</p>
                      <p className="text-xs truncate" style={{ color: "var(--dt4)" }}>{k.pegawai.nip} · {k.golonganBaru}</p>
                      <p className="text-xs" style={{ color: "var(--st-red)" }}>
                        TMT {formatTanggalId(k.tmtKgbBaru, { month: "short", year: "numeric" })}
                        {k.konfirmasiKeuanganAt && (
                          <span className="ml-1.5" style={{ color: "var(--dt5)" }}>
                            · Dikonfirmasi {formatTanggalId(k.konfirmasiKeuanganAt, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
                        Rp {Number(k.gajiPokokBaru).toLocaleString("id-ID")}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--dt5)" }}>Gaji baru</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Daftar berpotensi rapelan */}
            {berisiko.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold" style={{ color: "var(--st-amber)" }}>
                  Perlu Segera Diproses ({berisiko.length})
                </p>
                {berisiko.map((p) => {
                  const statusCfg = p.statusKGB ? tampilanStatus(p.statusKGB) : null;
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "var(--tint-amber-bg)", border: "0.5px solid var(--tint-amber-ln)" }}>
                      <div aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: "var(--tint-amber-ln)", color: "var(--st-amber)" }}>
                        {p.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: "var(--dtn)" }}>{p.nama}</p>
                        <p className="text-xs truncate" style={{ color: "var(--dt4)" }}>{p.nip} · {p.golonganRuang}</p>
                        <p className="text-xs" style={{ color: "var(--st-amber)" }}>
                          TMT {formatTanggalId(p.tmtKgbBerikutnya, { month: "short", year: "numeric" })}
                          {statusCfg && <span className="ml-1.5 px-1.5 py-px rounded-full text-xs" style={{ background: statusCfg.bg, color: statusCfg.color }}>{statusCfg.label}</span>}
                        </p>
                      </div>
                      {p.kgbId && (
                        <Link href={`/dashboard/kgb?kgbId=${encodeURIComponent(p.kgbId)}`}
                          onClick={tutupRapelan}
                          aria-label={`Buka KGB ${p.nama} di Proses KGB`}
                          className="text-xs px-2 py-1 rounded-lg shrink-0 font-medium hover:opacity-80 transition"
                          style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>
                          Buka
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-6 gap-2">
                <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--dt6)" strokeWidth="1.5"><polyline points="20 6 9 17 4 12"/></svg>
                <p className="text-xs text-center" style={{ color: "var(--dt5)" }}>Tidak ada KGB yang berpotensi rapelan saat ini</p>
              </div>
            )}

            {/* Keterangan */}
            <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "var(--tint-navy)", color: "var(--dt3)" }}>
              Rapelan terkonfirmasi adalah KGB yang telah dikonfirmasi keuangan dengan rapelan ditetapkan. KGB berpotensi rapelan adalah KGB yang melewati batas input SDM tetapi belum selesai diproses.
            </div>
          </KerangkaModal>
        );
      })()}


      {usulanDibuka && (
        <ModalUsulanUpt
          usulan={usulanDibuka}
          onTutup={() => setUsulanDibuka(null)}
          onBerhasil={(pesan) => {
            setUsulanDibuka(null);
            aksiBerhasil(pesan);
          }}
        />
      )}

      {/* -- Modal aksi KGB bersama (app/dashboard/components/kgb) -- */}
      {modal?.jenis === "input" && (
        <ModalInputKgb
          pegawai={modal.pegawai}
          ulang={modal.ulang}
          dasarAwal={modal.dasarAwal}
          dasarDariRiwayat
          onTutup={tutupModal}
          onBerhasil={aksiBerhasil}
          onArsipKgb={() => setModal({ jenis: "arsip", pegawai: modal.pegawai })}
        />
      )}
      {modal?.jenis === "arsip" && (
        <ModalArsipKgb pegawai={modal.pegawai} onTutup={tutupModal} onBerhasil={aksiBerhasil} />
      )}
      {modal?.jenis === "buat_sk" && (
        <ModalBuatSk
          kgbId={modal.kgbId}
          status={modal.status}
          pegawai={modal.pegawai}
          ringkasan={modal.ringkasan}
          dasarAwal={modal.dasarAwal}
          skBaruAwal={{ nomorSurat: modal.nomorSkBaru, tanggalSurat: modal.tanggalSkBaru }}
          reviewUpt={modal.reviewUpt}
          onTutup={tutupModal}
          onBerhasil={aksiBerhasil}
        />
      )}
      {modal?.jenis === "lewati_review" && (
        <ModalLewatiReview
          kgbId={modal.kgbId}
          pegawai={modal.pegawai}
          reviewSk={modal.reviewSk}
          onTutup={tutupModal}
          onBerhasil={aksiBerhasil}
        />
      )}
      {modal?.jenis === "unggah_sk" && (
        <ModalUnggahSk
          kgbId={modal.kgbId}
          status={modal.status}
          pegawai={modal.pegawai}
          onTutup={tutupModal}
          onBerhasil={aksiBerhasil}
        />
      )}
      {modal?.jenis === "batalkan" && (
        <ModalBatalkanKgb kgbId={modal.kgbId} pegawai={modal.pegawai} onTutup={tutupModal} onBerhasil={aksiBerhasil} />
      )}
      {modal?.jenis === "riwayat" && <ModalRiwayatKgb pegawai={modal.pegawai} onTutup={tutupModal} />}

      {/* Pesan hasil aksi. Wadah live region selalu ada agar pesan baru dibacakan pembaca layar. */}
      <div role="status" aria-live="polite" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-40 pointer-events-none">
        {pesanGagal && (
          <div className="dsb-toast" data-nada="merah" style={{ marginBottom: 8 }}>
            <p className="flex-1">{pesanGagal}</p>
            <button type="button" onClick={() => setPesanGagal(null)} aria-label="Tutup pesan"
              className="shrink-0 opacity-60 hover:opacity-100 transition" style={{ color: "var(--st-red)" }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        )}
        {pesanBerhasil && (
          <div className="dsb-toast">
            <p className="flex-1">{pesanBerhasil}</p>
            <button type="button" onClick={() => setPesanBerhasil(null)} aria-label="Tutup pesan"
              className="shrink-0 opacity-60 hover:opacity-100 transition" style={{ color: "var(--st-green)" }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const role = useRole();
  if (role === ROLES.SDM_HUKDIS) return <DashboardHukdis />;
  if (role === ROLES.KEUANGAN)   return <DashboardKeuangan />;
  if (role === ROLES.ADMIN_UPT)  return <DashboardUpt />;
  return <DashboardMain />;
}
