"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { canProcessKGB, isSuperAdmin } from "@/lib/auth";
import { useRole } from "@/app/dashboard/components/RoleContext";
import {
  Catatan,
  DaftarData,
  IkonDokumen,
  IkonPeringatan,
  KerangkaModal,
  Lencana,
  LencanaRapelan,
  LencanaStatus,
  ModalArsipKgb,
  ModalBatalkanKgb,
  ModalBuatSk,
  ModalInputKgb,
  ModalRiwayatKgb,
  ModalUnggahSk,
  PesanGalat,
  formatMkg,
  formatRupiah,
  nomorSkTerisi,
  type DasarSkAwal,
  type RingkasanSk,
} from "@/app/dashboard/components/kgb";
import { BidangAlasan } from "@/app/dashboard/components/kgb/BidangForm";
import { PESAN_GAGAL_JARINGAN, tautanBerkasSk } from "@/lib/kgbAksi";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { jendelaProsesKgb } from "@/lib/tabelGaji";
import { formatTanggalId, hariIniWita, tanggalKalender, type NilaiTanggal } from "@/lib/waktu";

interface KGB {
  id: string | null;
  isVirtual?: boolean;
  pegawaiId: string;
  pegawai: { nama: string; nip: string; unitKerja: string; jabatan: string };
  golonganLama: string;
  gajiPokokLama: number;
  mkgTahunLama: number;
  mkgBulanLama: number;
  golonganBaru: string;
  gajiPokokBaru: number | null;
  mkgTahunBaru: number | null;
  mkgBulanBaru: number | null;
  tmtKgbBaru: string;
  tmtKgbBerikutnya: string;
  nomorSK: string;
  tanggalSK: string | null;
  tmtSK: string | null;
  penetapSkDasar?: string | null;
  status: string;
  flagRapelan: boolean;
  rapelanDitetapkan?: boolean | null;
  isArsip?: boolean;
  createdAt: string | null;
  surat: { nomorSurat: string; tanggalSurat?: string | null; pathFile?: string | null } | null;
  /** SK sudah dibuat di SIM-KGB (GET /api/kgb); syarat Unggah SK TTE. */
  skSudahDibuat?: boolean;
}

/** KGB yang sudah tersimpan (bukan entri virtual dari data pegawai). */
type KgbTersimpan = KGB & { id: string };

interface RingkasanStatus {
  total: number;
  belum_diproses: number;
  sedang_diproses: number;
  menunggu_keuangan: number;
  selesai: number;
  rapelan: number;
}

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
  | { jenis: "buat_sk"; kgb: KgbTersimpan }
  | { jenis: "unggah_sk"; kgb: KgbTersimpan }
  | { jenis: "batalkan"; kgb: KgbTersimpan }
  | { jenis: "koreksi_arsip"; kgb: KgbTersimpan }
  | { jenis: "riwayat"; pegawai: PegawaiModal };

const GOLONGAN = [
  "I/a", "I/b", "I/c", "I/d",
  "II/a", "II/b", "II/c", "II/d",
  "III/a", "III/b", "III/c", "III/d",
  "IV/a", "IV/b", "IV/c", "IV/d", "IV/e",
];

const BULAN = [
  { value: "1", label: "Januari" }, { value: "2", label: "Februari" },
  { value: "3", label: "Maret" }, { value: "4", label: "April" },
  { value: "5", label: "Mei" }, { value: "6", label: "Juni" },
  { value: "7", label: "Juli" }, { value: "8", label: "Agustus" },
  { value: "9", label: "September" }, { value: "10", label: "Oktober" },
  { value: "11", label: "November" }, { value: "12", label: "Desember" },
];

const tanggalPendek = (nilai: NilaiTanggal) => formatTanggalId(nilai, { day: "numeric", month: "short", year: "numeric" });

function pegawaiModal(k: KGB): PegawaiModal {
  return {
    id: k.pegawaiId,
    nama: k.pegawai.nama,
    nip: k.pegawai.nip,
    jabatan: k.pegawai.jabatan || null,
    golonganRuang: k.golonganLama || null,
  };
}

function skTercatat(k: KGB): boolean {
  return k.skSudahDibuat === true;
}

function ringkasanSk(k: KGB): RingkasanSk {
  return {
    golongan: k.golonganBaru,
    gajiPokokLama: k.gajiPokokLama,
    gajiPokokBaru: k.gajiPokokBaru,
    mkgTahunBaru: k.mkgTahunBaru,
    mkgBulanBaru: k.mkgBulanBaru,
    tmtKgbBaru: k.tmtKgbBaru,
    flagRapelan: k.flagRapelan,
  };
}

/** Data Atas Dasar SK Terakhir yang tersimpan pada record; null bila nomor SK belum diisi. */
function dasarDariRecord(k: KGB): DasarSkAwal | null {
  if (!nomorSkTerisi(k.nomorSK)) return null;
  return { nomorSK: k.nomorSK, tanggalSK: k.tanggalSK, tmtSK: k.tmtSK, penetapSkDasar: k.penetapSkDasar ?? null };
}

function waktuDibuat(k: KGB): number {
  const t = k.createdAt ? new Date(k.createdAt).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Koreksi sebagai Arsip Historis: menghapus penanda rapelan pada satu KGB Selesai.
 * Hanya Super Admin; alasan wajib dan dicatat di log aktivitas.
 */
function ModalKoreksiArsip({
  kgb,
  onTutup,
  onBerhasil,
}: {
  kgb: KgbTersimpan;
  onTutup: () => void;
  onBerhasil: (pesan: string) => void;
}) {
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  async function kirim() {
    if (sibuk) return;
    if (!alasan.trim()) {
      setGalat("Lengkapi Alasan koreksi.");
      return;
    }
    setSibuk(true);
    setGalat(null);
    try {
      const res = await fetch(`/api/kgb/${encodeURIComponent(kgb.id)}/fix-arsip`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alasan: alasan.trim() }),
      });
      if (!res.ok) {
        const isi = (await res.json().catch(() => null)) as { error?: string } | null;
        setGalat(isi?.error || "Koreksi arsip gagal disimpan.");
        return;
      }
      onBerhasil(`Penanda rapelan KGB ${kgb.pegawai.nama} dihapus.`);
    } catch {
      setGalat(PESAN_GAGAL_JARINGAN);
    } finally {
      setSibuk(false);
    }
  }

  return (
    <KerangkaModal
      judul="Koreksi sebagai Arsip Historis"
      subjudul={`${kgb.pegawai.nama} · NIP ${kgb.pegawai.nip}`}
      ikon={<IkonPeringatan />}
      nada="amber"
      ukuran="sm"
      sibuk={sibuk}
      onTutup={onTutup}
      onKirim={kirim}
      kaki={
        <>
          <button type="button" className="kgbm-tombol kgbm-kedua" onClick={onTutup} disabled={sibuk}>
            Kembali
          </button>
          <button type="submit" className="kgbm-tombol kgbm-amber" disabled={sibuk}>
            {sibuk ? "Menyimpan..." : "Simpan Koreksi"}
          </button>
        </>
      }
    >
      <Catatan nada="amber">
        Penanda rapelan pada KGB Selesai dengan TMT {formatTanggalId(kgb.tmtKgbBaru)} akan dihapus
        {kgb.rapelanDitetapkan === true
          ? ", termasuk Rapelan ditetapkan dari konfirmasi keuangan, sehingga KGB ini tidak lagi dihitung sebagai rapelan di rekap dan laporan"
          : ""}
        . Gunakan hanya untuk KGB historis yang sebenarnya tidak terlambat. KGB berikutnya tidak diubah, dan alasan
        koreksi dicatat di Log Aktivitas.
      </Catatan>
      <BidangAlasan
        label="Alasan koreksi"
        wajib
        nilai={alasan}
        onUbah={setAlasan}
        placeholder="Contoh: SK KGB periode ini terbit tepat waktu di luar SIM-KGB"
        nonaktif={sibuk}
        fokusAwal
      />
      <PesanGalat pesan={galat} />
    </KerangkaModal>
  );
}

export default function KGBPage() {
  const searchParams = useSearchParams();
  const kgbIdFromUrl = searchParams.get("kgbId");
  const pegawaiIdFromUrl = searchParams.get("pegawaiId");
  const lastAutoOpenedId = useRef<string | null>(null);
  const role = useRole();
  const bolehProses = canProcessKGB(role);
  const superAdmin = isSuperAdmin(role);

  const hariIni = hariIniWita();
  const tahunIni = hariIni.getFullYear();
  const defaultTahun = String(tahunIni);

  const [kgbList, setKgbList] = useState<KGB[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [summary, setSummary] = useState<RingkasanStatus | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  // Tautan langsung ke satu KGB atau pegawai membuka semua tahun agar record-nya ada di daftar.
  const [filterTahun, setFilterTahun] = useState(() => (kgbIdFromUrl || pegawaiIdFromUrl ? "" : defaultTahun));
  const [filterRapelan, setFilterRapelan] = useState(() => searchParams.get("rapelan") ?? "");
  const [filterDeadlineBulan, setFilterDeadlineBulan] = useState(() => searchParams.get("deadlineBulan") ?? "");
  const [filterGolongan, setFilterGolongan] = useState("");
  const [sortBy, setSortBy] = useState("tmt_desc");
  const [showDetail, setShowDetail] = useState<KGB | null>(null);
  const [modal, setModal] = useState<ModalAksi | null>(null);
  const [pesanBerhasil, setPesanBerhasil] = useState<string | null>(null);

  function paramsKgb(): URLSearchParams {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    if (filterBulan) params.set("bulan", filterBulan);
    if (filterTahun) params.set("tahun", filterTahun);
    if (filterRapelan) params.set("rapelan", filterRapelan);
    if (filterDeadlineBulan) params.set("deadlineBulan", filterDeadlineBulan);
    return params;
  }

  async function fetchSummary() {
    try {
      const res = await fetch("/api/kgb/summary");
      if (res.ok) setSummary((await res.json()) as RingkasanStatus);
    } catch { /* ringkasan tidak wajib */ }
  }

  async function muatDaftar() {
    const res = await fetch(`/api/kgb?${paramsKgb()}`);
    const data: unknown = await res.json();
    // Record yang pegawainya sudah tidak ada tidak dapat ditampilkan maupun diproses.
    setKgbList(Array.isArray(data) ? (data as KGB[]).filter((k) => !!k?.pegawai) : []);
    setLastSynced(new Date());
  }

  async function fetchKGB() {
    setLoading(true);
    try {
      await muatDaftar();
    } catch {
      setKgbList([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSinkronkan() {
    setSyncing(true);
    try {
      await Promise.all([muatDaftar(), fetchSummary()]);
    } catch {
      // daftar lama tetap ditampilkan
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    fetchKGB();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, filterBulan, filterTahun, filterRapelan, filterDeadlineBulan]);

  useEffect(() => {
    const t = setTimeout(() => fetchKGB(), 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Ringkasan jumlah per status saat halaman dibuka
  useEffect(() => { fetchSummary(); }, []);

  useEffect(() => {
    if (!pesanBerhasil) return;
    const t = setTimeout(() => setPesanBerhasil(null), 8000);
    return () => clearTimeout(t);
  }, [pesanBerhasil]);

  // Buka detail otomatis dari ?kgbId= atau ?pegawaiId= (tautan dari dashboard dan Data Pegawai).
  useEffect(() => {
    if (kgbList.length === 0) return;
    if (!kgbIdFromUrl && !pegawaiIdFromUrl) return;
    const paramKey = kgbIdFromUrl ?? pegawaiIdFromUrl;
    if (lastAutoOpenedId.current === paramKey) return;
    let found: KGB | undefined;
    if (kgbIdFromUrl) found = kgbList.find((k) => k.id === kgbIdFromUrl);
    if (!found && pegawaiIdFromUrl) {
      const milikPegawai = kgbList.filter((k) => k.pegawaiId === pegawaiIdFromUrl);
      found =
        milikPegawai.find((k) => ["belum_diproses", "sedang_diproses", "menunggu_keuangan"].includes(k.status)) ??
        milikPegawai[0];
    }
    if (found) {
      lastAutoOpenedId.current = paramKey!;
      setShowDetail(found);
    }
  }, [kgbIdFromUrl, pegawaiIdFromUrl, kgbList]);

  function bukaDetail(k: KGB) {
    setShowDetail(k);
  }

  function tutupDetail() {
    setShowDetail(null);
  }

  function bukaAksi(aksi: ModalAksi) {
    setShowDetail(null);
    setModal(aksi);
  }

  function tutupModal() {
    setModal(null);
  }

  function aksiBerhasil(pesan: string) {
    setModal(null);
    setShowDetail(null);
    setPesanBerhasil(pesan);
    void Promise.all([muatDaftar().catch(() => {}), fetchSummary()]);
  }

  const tahunList = Array.from({ length: 7 }, (_, i) => tahunIni - 3 + i);

  const displayList = kgbList
    .filter((k) => !filterGolongan || k.golonganLama === filterGolongan)
    .sort((a, b) => {
      switch (sortBy) {
        case "nama_asc": return a.pegawai.nama.localeCompare(b.pegawai.nama, "id");
        case "nama_desc": return b.pegawai.nama.localeCompare(a.pegawai.nama, "id");
        case "tmt_asc": return new Date(a.tmtKgbBaru).getTime() - new Date(b.tmtKgbBaru).getTime();
        case "tmt_desc": return new Date(b.tmtKgbBaru).getTime() - new Date(a.tmtKgbBaru).getTime();
        case "status": return a.status.localeCompare(b.status);
        default: return 0;
      }
    });

  // filterTahun == defaultTahun adalah state normal, bukan filter aktif
  const hasActiveFilter = !!(filterGolongan || filterRapelan || filterDeadlineBulan || filterStatus || filterBulan || filterTahun !== defaultTahun || search);
  const jumlahVirtual = kgbList.filter((k) => k.isVirtual).length;

  /** Batas input SDM sudah lewat untuk KGB yang masih menjadi tanggung jawab SDM. */
  function terlambatSdm(k: KGB): boolean {
    if (k.status !== "belum_diproses" && k.status !== "sedang_diproses") return false;
    return jendelaProsesKgb(k.tmtKgbBaru, hariIni)?.flagRapelan ?? false;
  }

  function aksiInput(k: KGB) {
    bukaAksi({ jenis: "input", pegawai: pegawaiModal(k), ulang: false, dasarAwal: null });
  }

  function renderAksiBaris(k: KGB) {
    if (!bolehProses) return null;
    if (k.status === "belum_diproses") {
      const jendela = jendelaProsesKgb(k.tmtKgbBaru, hariIni);
      if (jendela?.isLocked) {
        return (
          <span
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium cursor-not-allowed"
            style={{ background: "var(--ln2)", color: "var(--dt5)", border: "0.5px solid var(--ln0)" }}
          >
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="flex flex-col leading-tight">
              <span>Terkunci</span>
              <span style={{ fontSize: "10px", fontWeight: 400, color: "var(--dt3)" }}>
                Dibuka {tanggalPendek(jendela.unlockDate)}
              </span>
            </span>
          </span>
        );
      }
      const terlambat = jendela?.flagRapelan ?? false;
      return (
        <>
          {terlambat && (
            <button
              type="button"
              onClick={() => bukaAksi({ jenis: "arsip", pegawai: pegawaiModal(k) })}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
              style={{ background: "var(--amber-solid)", color: "#fff" }}
              title="SK KGB periode ini sudah terbit di luar SIM-KGB"
            >
              <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
              </svg>
              Arsip KGB
            </button>
          )}
          <button
            type="button"
            onClick={() => aksiInput(k)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
            style={{ background: "var(--navy-solid)", color: "#fff" }}
            title={terlambat ? "Batas input SDM sudah lewat; KGB ini berpotensi rapelan" : undefined}
          >
            <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Input KGB
          </button>
        </>
      );
    }
    if (k.status === "sedang_diproses" && k.id) {
      const kgb: KgbTersimpan = { ...k, id: k.id };
      return (
        <>
          <button
            type="button"
            onClick={() => bukaAksi({ jenis: "buat_sk", kgb })}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
            style={{ background: "var(--navy-solid)", color: "#fff" }}
          >
            <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Buat SK
          </button>
          {skTercatat(k) && (
            <button
              type="button"
              onClick={() => bukaAksi({ jenis: "unggah_sk", kgb })}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition"
              style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "0.5px solid var(--tint-green-ln)" }}
            >
              <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Unggah SK TTE
            </button>
          )}
        </>
      );
    }
    return null;
  }

  function renderDetail(k: KGB) {
    const kgb: KgbTersimpan | null = k.id ? { ...k, id: k.id } : null;
    const jendela = jendelaProsesKgb(k.tmtKgbBaru, hariIni);
    const terlambat = terlambatSdm(k);
    const placeholder = k.status === "belum_diproses" && !nomorSkTerisi(k.nomorSK);
    const dalamProses = ["belum_diproses", "sedang_diproses", "menunggu_keuangan"].includes(k.status);
    const nomorSkBaru = nomorSkTerisi(k.surat?.nomorSurat);
    const pathFile = k.surat?.pathFile ?? null;
    const selisih = k.gajiPokokBaru !== null ? k.gajiPokokBaru - k.gajiPokokLama : null;

    const bisaInput = k.status === "belum_diproses" && !!jendela && !jendela.isLocked;
    const bisaBuatSk = !!kgb && k.status === "sedang_diproses";
    const bisaUnggah =
      !!kgb && ((k.status === "sedang_diproses" && skTercatat(k)) || (k.status === "selesai" && !!k.isArsip && !pathFile));
    const bisaBatal = !!kgb && !k.isArsip && (k.status === "belum_diproses" || k.status === "sedang_diproses");
    // Input Ulang hanya untuk pembatalan terakhir: pegawai belum punya KGB aktif atau KGB yang lebih baru.
    const sudahDiganti = kgbList.some(
      (x) =>
        x.pegawaiId === k.pegawaiId &&
        !x.isVirtual &&
        x.id !== k.id &&
        x.status !== "ditolak" &&
        (x.status === "sedang_diproses" || x.status === "menunggu_keuangan" || waktuDibuat(x) > waktuDibuat(k)),
    );
    const bisaInputUlang = k.status === "ditolak" && !sudahDiganti;
    const penetapKosong = k.status === "sedang_diproses" && !k.isArsip && !k.penetapSkDasar?.trim();

    return (
      <KerangkaModal
        judul="Detail KGB"
        subjudul={`${k.pegawai.nama} · NIP ${k.pegawai.nip}`}
        ikon={<IkonDokumen />}
        nada="navy"
        onTutup={tutupDetail}
        kaki={
          <>
            <button type="button" className="kgbm-tombol kgbm-kedua" onClick={tutupDetail}>
              Tutup
            </button>
            <button
              type="button"
              className="kgbm-tombol kgbm-kedua"
              onClick={() => bukaAksi({ jenis: "riwayat", pegawai: pegawaiModal(k) })}
            >
              Riwayat KGB
            </button>
            {bolehProses && bisaBatal && kgb && (
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => bukaAksi({ jenis: "batalkan", kgb })}>
                Batalkan KGB
              </button>
            )}
            {bolehProses && bisaUnggah && kgb && (
              <button type="button" className="kgbm-tombol kgbm-hijau" onClick={() => bukaAksi({ jenis: "unggah_sk", kgb })}>
                Unggah SK TTE
              </button>
            )}
            {bolehProses && bisaBuatSk && kgb && (
              <button type="button" className="kgbm-tombol kgbm-utama" onClick={() => bukaAksi({ jenis: "buat_sk", kgb })}>
                Buat SK
              </button>
            )}
            {bolehProses && bisaInput && terlambat && (
              <button type="button" className="kgbm-tombol kgbm-amber" onClick={() => bukaAksi({ jenis: "arsip", pegawai: pegawaiModal(k) })}>
                Arsip KGB
              </button>
            )}
            {bolehProses && bisaInput && (
              <button type="button" className="kgbm-tombol kgbm-utama" onClick={() => aksiInput(k)}>
                Input KGB
              </button>
            )}
            {bolehProses && bisaInputUlang && (
              <button
                type="button"
                className="kgbm-tombol kgbm-utama"
                onClick={() => bukaAksi({ jenis: "input", pegawai: pegawaiModal(k), ulang: true, dasarAwal: dasarDariRecord(k) })}
              >
                Input Ulang KGB
              </button>
            )}
          </>
        }
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
          <LencanaStatus status={k.status} />
          {k.isVirtual && <Lencana nada="amber">Dari Data Pegawai</Lencana>}
          {placeholder && !k.isVirtual && <Lencana>Antrean Otomatis</Lencana>}
          {k.isArsip && <Lencana nada="navy">Arsip</Lencana>}
          {k.flagRapelan && dalamProses && !k.isArsip && <LencanaRapelan />}
          {!k.isVirtual && k.createdAt && (
            <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--dt5)" }}>Dibuat {tanggalPendek(k.createdAt)}</span>
          )}
        </div>

        {k.status === "belum_diproses" && jendela?.isLocked && (
          <Catatan nada="navy">
            Jendela proses KGB ini dibuka mulai {formatTanggalId(jendela.unlockDate)}. Batas input SDM{" "}
            {formatTanggalId(jendela.deadlineSDM)}.
          </Catatan>
        )}
        {k.status === "belum_diproses" && jendela && !jendela.isLocked && (
          <Catatan nada={terlambat ? "amber" : "netral"}>
            {terlambat
              ? `Batas input SDM (${formatTanggalId(jendela.deadlineSDM)}) sudah lewat, sehingga KGB ini berpotensi rapelan. Bila SK KGB periode ini sudah terbit di luar SIM-KGB, gunakan Arsip KGB.`
              : `KGB ini belum diinput. Batas input SDM: ${formatTanggalId(jendela.deadlineSDM)}.`}
          </Catatan>
        )}
        {k.status === "sedang_diproses" && (
          <Catatan>
            {skTercatat(k)
              ? "SK KGB sudah dibuat. Setelah SK ditandatangani secara elektronik, pilih Unggah SK TTE."
              : "Langkah berikutnya: Buat SK. Unggah SK TTE tersedia setelah SK dibuat."}
          </Catatan>
        )}
        {penetapKosong && (
          <Catatan nada="amber">Ditetapkan oleh pada Atas Dasar SK Terakhir belum diisi. Lengkapi saat Buat SK.</Catatan>
        )}
        {k.status === "menunggu_keuangan" && (
          <Catatan nada="navy">SK yang sudah ditandatangani sudah diunggah dan menunggu konfirmasi bagian keuangan.</Catatan>
        )}
        {k.status === "selesai" && (
          <Catatan nada={k.isArsip && !pathFile ? "amber" : "hijau"}>
            {k.isArsip
              ? pathFile
                ? "KGB selesai dan dicatat melalui Arsip KGB."
                : "KGB selesai dan dicatat melalui Arsip KGB, tetapi berkas SK belum diunggah. Pilih Unggah SK TTE untuk mengunggahnya."
              : "KGB selesai dan sudah dikonfirmasi bagian keuangan."}
          </Catatan>
        )}
        {k.status === "ditolak" && (
          <Catatan nada="merah">
            {bisaInputUlang
              ? "KGB ini dibatalkan. Gunakan Input Ulang KGB untuk memasukkan data yang benar."
              : "KGB ini dibatalkan dan sudah digantikan oleh KGB yang lebih baru."}
          </Catatan>
        )}

        <DaftarData
          judul="Data Pegawai"
          baris={[
            { label: "Jabatan", nilai: k.pegawai.jabatan || "-" },
            { label: "Unit kerja", nilai: k.pegawai.unitKerja || "-" },
          ]}
        />

        {!placeholder && (
          <DaftarData
            judul={k.isArsip ? "SK KGB yang Diarsipkan" : "Atas Dasar SK Terakhir"}
            baris={[
              { label: k.isArsip ? "Nomor SK" : "Nomor SK Terakhir", nilai: nomorSkTerisi(k.nomorSK) || "-" },
              { label: k.isArsip ? "Tanggal SK" : "Tanggal SK Terakhir", nilai: formatTanggalId(k.tanggalSK) },
              { label: k.isArsip ? "TMT SK" : "TMT SK Terakhir", nilai: formatTanggalId(k.tmtSK) },
              { label: "Ditetapkan oleh", nilai: k.penetapSkDasar?.trim() || "Belum diisi" },
            ]}
          />
        )}

        <DaftarData
          judul="Perhitungan KGB"
          tambahan={k.flagRapelan && dalamProses && !k.isArsip ? <LencanaRapelan /> : undefined}
          baris={[
            {
              label: "Golongan",
              nilai: k.golonganBaru && k.golonganBaru !== k.golonganLama ? `${k.golonganLama} menjadi ${k.golonganBaru}` : k.golonganLama || "-",
            },
            { label: "Masa kerja lama", nilai: formatMkg(k.mkgTahunLama, k.mkgBulanLama) },
            { label: "Masa kerja baru", nilai: formatMkg(k.mkgTahunBaru, k.mkgBulanBaru) },
            { label: "Gaji pokok lama", nilai: formatRupiah(k.gajiPokokLama) },
            { label: "Gaji pokok baru", nilai: formatRupiah(k.gajiPokokBaru), nada: "hijau" },
            {
              label: "Kenaikan gaji pokok",
              nilai: selisih === null ? "-" : selisih > 0 ? `+ ${formatRupiah(selisih)}` : "Tidak ada kenaikan",
            },
            { label: "TMT KGB", nilai: formatTanggalId(k.tmtKgbBaru) },
            { label: "TMT KGB berikutnya", nilai: k.isVirtual ? "-" : formatTanggalId(k.tmtKgbBerikutnya) },
          ]}
        />

        {(nomorSkBaru || pathFile) && (
          <DaftarData
            judul={k.isArsip ? "Berkas SK" : "SK KGB Baru"}
            baris={[
              ...(nomorSkBaru && !k.isArsip
                ? [
                    { label: "Nomor SK Baru", nilai: nomorSkBaru },
                    { label: "Tanggal SK Baru", nilai: formatTanggalId(k.surat?.tanggalSurat) },
                  ]
                : []),
              {
                label: "SK tertandatangani",
                nilai: pathFile ? (
                  <a href={tautanBerkasSk(pathFile)} target="_blank" rel="noopener noreferrer" className="kgbm-tautan">
                    Lihat SK Tertandatangani
                  </a>
                ) : (
                  "Belum diunggah"
                ),
              },
            ]}
          />
        )}

        {superAdmin && k.status === "selesai" && (k.flagRapelan || k.rapelanDitetapkan === true) && kgb && (
          <div>
            <button
              type="button"
              className="kgbm-tombol kgbm-kedua kgbm-tombol-kecil"
              onClick={() => bukaAksi({ jenis: "koreksi_arsip", kgb })}
            >
              Koreksi sebagai Arsip Historis
            </button>
            <p className="kgbm-petunjuk">Khusus Super Admin. Menghapus penanda rapelan pada KGB historis ini; alasannya dicatat di Log Aktivitas.</p>
          </div>
        )}
      </KerangkaModal>
    );
  }

  const tabs = [
    { value: "", label: "Semua", count: summary?.total ?? null, bg: "var(--sub)", color: "var(--dtn)", activeBg: "var(--navy-solid)", activeColor: "#fff", dot: null as string | null },
    {
      value: "sedang_diproses", label: infoStatusKgb("sedang_diproses").label,
      count: summary?.sedang_diproses ?? null,
      bg: "var(--tint-navy)", color: "var(--dtn)",
      activeBg: "var(--navy-solid)", activeColor: "#fff",
      dot: summary?.sedang_diproses ? "#3b82f6" : null,
    },
    {
      value: "menunggu_keuangan", label: infoStatusKgb("menunggu_keuangan").label,
      count: summary?.menunggu_keuangan ?? null,
      bg: "var(--tint-violet-bg)", color: "var(--st-violet)",
      activeBg: "var(--tint-violet-bg)", activeColor: "var(--st-violet)",
      dot: summary?.menunggu_keuangan ? "var(--st-violet)" : null,
    },
    {
      value: "belum_diproses", label: infoStatusKgb("belum_diproses").label,
      count: summary?.belum_diproses ?? null,
      bg: "var(--sub)", color: "var(--st-amber)",
      activeBg: "var(--tint-amber-bg)", activeColor: "var(--st-amber)",
      dot: null,
    },
    {
      value: "selesai", label: infoStatusKgb("selesai").label,
      count: summary?.selesai ?? null,
      bg: "var(--sub)", color: "var(--st-green)",
      activeBg: "var(--tint-green-bg)", activeColor: "var(--st-green)",
      dot: null,
    },
  ];

  return (
    <>
    <div style={{ animation: "kgbPageIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
      <style>{`
        @keyframes kgbPageIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3">
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--st-amber)", marginBottom: "3px" }}>
            Data
          </p>
          <h1 className="text-base font-semibold" style={{ color: "var(--dtn)" }}>Proses KGB</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>
            Kelola dan proses Kenaikan Gaji Berkala pegawai
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <button
            type="button"
            onClick={handleSinkronkan}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-medium transition"
            style={{
              background: syncing ? "var(--ln2)" : "var(--tint-navy)",
              color: syncing ? "var(--dt5)" : "var(--dtn)",
              border: "1px solid var(--ln0)",
              cursor: syncing ? "wait" : "pointer",
            }}
          >
            <svg
              aria-hidden="true"
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ animation: syncing ? "spin 1s linear infinite" : "none" }}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {syncing ? "Menyinkronkan..." : "Sinkronkan Data"}
          </button>
          {lastSynced && (
            <span className="text-xs" style={{ color: "var(--dt3)" }}>
              Diperbarui {formatTanggalId(lastSynced, { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* -- Tab chips quick-filter status -- */}
      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map((tab) => {
          const isActive = filterStatus === tab.value && !filterRapelan && !filterDeadlineBulan;
          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                setFilterStatus(tab.value);
                setFilterRapelan("");
                setFilterDeadlineBulan("");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition"
              style={{
                background: isActive ? tab.activeBg : tab.bg,
                color: isActive ? tab.activeColor : tab.color,
                border: `1px solid ${isActive ? "transparent" : "var(--ln1)"}`,
                boxShadow: isActive ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {tab.dot && !isActive && (
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tab.dot }} />
              )}
              {tab.label}
              {tab.count !== null && (
                <span
                  className="px-1.5 py-0.5 rounded-md text-xs font-bold min-w-5 text-center"
                  style={{
                    background: isActive ? "rgba(255,255,255,0.25)" : "var(--ln1)",
                    color: isActive ? tab.activeColor : "var(--dt2)",
                    fontSize: "10px",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
        {summary?.rapelan ? (
          <button
            type="button"
            aria-pressed={!!filterRapelan}
            onClick={() => { setFilterRapelan("1"); setFilterDeadlineBulan(""); setFilterStatus(""); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition"
            style={{
              background: filterRapelan ? "var(--tint-amber-bg)" : "var(--sub)",
              color: "var(--st-amber)",
              border: `1px solid ${filterRapelan ? "var(--tint-amber-ln)" : "var(--tint-amber-bg2)"}`,
              boxShadow: filterRapelan ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
            Terlambat
            <span className="px-1.5 py-0.5 rounded-md font-bold" style={{ background: "var(--tint-amber-ln)", color: "var(--st-amber)", fontSize: "10px" }}>
              {summary.rapelan}
            </span>
          </button>
        ) : null}
        {filterDeadlineBulan && (
          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "1px solid var(--ln0)" }}>
            Jatuh tempo ≤{filterDeadlineBulan} bln
            <button
              type="button"
              onClick={() => setFilterDeadlineBulan("")}
              aria-label="Hapus filter jatuh tempo"
              className="opacity-50 hover:opacity-100 leading-none"
            >
              ×
            </button>
          </span>
        )}
      </div>


      {/* Filter */}
      <div className="bg-white rounded-2xl p-4 mb-4 space-y-3" style={{ border: "0.5px solid var(--ln1)" }}>
        {/* Baris 1: Search + Reset */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a0b4c8" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              aria-label="Cari nama atau NIP pegawai"
              placeholder="Cari nama atau NIP pegawai..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs outline-none"
              style={{ border: "1px solid var(--ln0)", background: "var(--sub)", color: "var(--dtn)" }}
            />
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={() => { setSearch(""); setFilterStatus(""); setFilterBulan(""); setFilterTahun(defaultTahun); setFilterGolongan(""); setFilterRapelan(""); setFilterDeadlineBulan(""); setSortBy("tmt_desc"); }}
              className="text-xs px-3 py-2 rounded-xl transition whitespace-nowrap"
              style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "1px solid var(--tint-red-ln)" }}
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Baris 2: Golongan + Tahun + Bulan + Sort */}
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Golongan"
            value={filterGolongan}
            onChange={(e) => setFilterGolongan(e.target.value)}
            className="rounded-xl px-3 py-2 text-xs outline-none"
            style={{ border: "1px solid var(--ln0)", background: filterGolongan ? "var(--tint-navy)" : "var(--sub)", color: "var(--dtn)", minWidth: "120px" }}
          >
            <option value="">Semua Golongan</option>
            {GOLONGAN.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            aria-label="Tahun TMT"
            value={filterTahun}
            onChange={(e) => { setFilterTahun(e.target.value); if (!e.target.value) setFilterBulan(""); }}
            className="rounded-xl px-3 py-2 text-xs outline-none"
            style={{ border: "1px solid var(--ln0)", background: filterTahun ? "var(--tint-navy)" : "var(--sub)", color: "var(--dtn)", minWidth: "115px" }}
          >
            <option value="">Semua Tahun</option>
            {tahunList.map((y) => (
              <option key={y} value={y.toString()}>{y}</option>
            ))}
          </select>

          <select
            aria-label="Bulan TMT"
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            className="rounded-xl px-3 py-2 text-xs outline-none"
            style={{ border: "1px solid var(--ln0)", background: filterBulan ? "var(--tint-navy)" : "var(--sub)", color: "var(--dtn)", minWidth: "130px" }}
          >
            <option value="">Semua Bulan</option>
            {BULAN.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>

          <select
            aria-label="Urutkan"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl px-3 py-2 text-xs outline-none"
            style={{ border: "1px solid var(--ln0)", background: "var(--sub)", color: "var(--dtn)", minWidth: "155px" }}
          >
            <option value="tmt_asc">TMT Terlama → Terbaru</option>
            <option value="tmt_desc">TMT Terbaru → Terlama</option>
            <option value="nama_asc">Nama A → Z</option>
            <option value="nama_desc">Nama Z → A</option>
            <option value="status">Berdasarkan Status</option>
          </select>

        </div>

        {/* Info hasil filter */}
        {hasActiveFilter && (
          <p className="text-xs" style={{ color: "var(--dt5)" }}>
            Menampilkan <strong style={{ color: "var(--dtn)" }}>{displayList.length}</strong> dari <strong style={{ color: "var(--dtn)" }}>{kgbList.length}</strong> data KGB
            {jumlahVirtual > 0 && (
              <span style={{ color: "var(--st-amber2)" }}> · {jumlahVirtual} belum diproses</span>
            )}
          </p>
        )}
      </div>

      {/* Tabel */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "0.5px solid var(--ln1)" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p role="status" className="text-xs" style={{ color: "var(--dt4)" }}>
              Memuat data...
            </p>
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <svg
              aria-hidden="true"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d0dce8"
              strokeWidth="1.5"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="text-xs" style={{ color: "var(--dt5)" }}>
              {kgbList.length === 0 ? "Belum ada data KGB" : "Tidak ada data yang sesuai filter"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto tbl-scroll">
            <table className="w-full">
              <thead>
                <tr
                  style={{
                    background: "var(--sub)",
                    borderBottom: "0.5px solid var(--ln1)",
                  }}
                >
                  {[
                    "No",
                    "Pegawai",
                    "Golongan",
                    "Gaji Lama → Baru",
                    "MKG Baru",
                    "TMT KGB",
                    "Status",
                    "Aksi",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold whitespace-nowrap"
                      style={{ color: "var(--dt4)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayList.map((k, i) => {
                  const warna = warnaStatusKgb(k.status);
                  const terlambat = terlambatSdm(k);
                  const tahunTmt = tanggalKalender(k.tmtKgbBaru)?.getFullYear() ?? tahunIni;
                  const isPeriodeBerikutnya = !k.isVirtual && k.status === "belum_diproses" && tahunTmt > tahunIni;
                  return (
                    <tr
                      key={k.id ?? `virtual-${k.pegawaiId}`}
                      style={{
                        borderBottom:
                          i < displayList.length - 1
                            ? "0.5px solid var(--ln2)"
                            : "none",
                        background: k.isVirtual ? "var(--sub)" : isPeriodeBerikutnya ? "var(--sub)" : "var(--card)",
                        borderLeft: k.isVirtual ? "3px solid var(--tint-amber-ln)" : isPeriodeBerikutnya ? "3px solid var(--ln0)" : "3px solid transparent",
                        opacity: isPeriodeBerikutnya ? 0.82 : 1,
                      }}
                    >
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--dt5)" }}>{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            aria-hidden="true"
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}
                          >
                            {k.pegawai.nama
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p
                                className="text-xs font-medium"
                                style={{ color: "var(--dtn)" }}
                              >
                                {k.pegawai.nama}
                              </p>
                              {terlambat && (
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded font-bold"
                                  style={{
                                    background: "var(--tint-amber-bg)",
                                    color: "var(--st-amber)",
                                    fontSize: "9px",
                                  }}
                                  title="Batas input SDM sudah lewat"
                                >
                                  Terlambat
                                </span>
                              )}
                            </div>
                            <p className="text-xs" style={{ color: "var(--dt4)" }}>
                              {k.pegawai.nip}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        style={{ color: "var(--dtn)" }}
                      >
                        {k.golonganLama}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs" style={{ color: "var(--dt4)" }}>
                          {formatRupiah(k.gajiPokokLama)}
                        </p>
                        {k.isVirtual ? (
                          <p className="text-xs italic" style={{ color: "var(--st-amber2)" }}>belum diproses</p>
                        ) : (
                          <p className="text-xs font-semibold" style={{ color: "var(--st-green)" }}>
                            {formatRupiah(k.gajiPokokBaru)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--dt3)" }}>
                        {k.isVirtual ? (
                          <span className="italic" style={{ color: "var(--dt6)" }}>-</span>
                        ) : (
                          `${k.mkgTahunBaru ?? "-"} Thn ${k.mkgBulanBaru ?? "-"} Bln`
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        style={{ color: "var(--dt3)" }}
                      >
                        {tanggalPendek(k.tmtKgbBaru)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{ background: warna.bg, color: warna.color }}
                          >
                            {infoStatusKgb(k.status).label}
                          </span>
                          {k.isVirtual && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber2)", fontSize: "10px", border: "1px solid var(--tint-amber-ln)" }}
                            >
                              Dari Data Pegawai
                            </span>
                          )}
                          {!k.isVirtual && k.status === "belum_diproses" && k.nomorSK === "" && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: "var(--ln2)", color: "var(--dt4)", fontSize: "10px" }}
                            >
                              Antrean Otomatis
                            </span>
                          )}
                          {!k.isVirtual && !k.isArsip && !k.penetapSkDasar &&
                            (k.status === "sedang_diproses" || (k.status === "belum_diproses" && k.nomorSK !== "")) && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber2)", fontSize: "10px" }}
                              title="Pejabat penetap SK terakhir belum diisi; lengkapi saat Buat SK"
                            >
                              Penetap SK perlu dilengkapi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {!k.isVirtual && (
                            <button
                              type="button"
                              onClick={() => bukaDetail(k)}
                              className="text-xs px-3 py-1.5 rounded-lg transition"
                              style={{ background: "var(--tint-navy)", color: "var(--dtn)", border: "0.5px solid var(--ln0)" }}
                            >
                              Detail
                            </button>
                          )}
                          {renderAksiBaris(k)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>

      {showDetail && renderDetail(showDetail)}

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
          kgbId={modal.kgb.id}
          status={modal.kgb.status}
          pegawai={pegawaiModal(modal.kgb)}
          ringkasan={ringkasanSk(modal.kgb)}
          dasarAwal={{
            nomorSK: modal.kgb.nomorSK,
            tanggalSK: modal.kgb.tanggalSK,
            tmtSK: modal.kgb.tmtSK,
            penetapSkDasar: modal.kgb.penetapSkDasar ?? null,
          }}
          skBaruAwal={{ nomorSurat: modal.kgb.surat?.nomorSurat, tanggalSurat: modal.kgb.surat?.tanggalSurat }}
          onTutup={tutupModal}
          onBerhasil={aksiBerhasil}
        />
      )}
      {modal?.jenis === "unggah_sk" && (
        <ModalUnggahSk
          kgbId={modal.kgb.id}
          status={modal.kgb.status}
          isArsip={!!modal.kgb.isArsip}
          pegawai={pegawaiModal(modal.kgb)}
          onTutup={tutupModal}
          onBerhasil={aksiBerhasil}
        />
      )}
      {modal?.jenis === "batalkan" && (
        <ModalBatalkanKgb
          kgbId={modal.kgb.id}
          pegawai={pegawaiModal(modal.kgb)}
          onTutup={tutupModal}
          onBerhasil={aksiBerhasil}
        />
      )}
      {modal?.jenis === "koreksi_arsip" && (
        <ModalKoreksiArsip kgb={modal.kgb} onTutup={tutupModal} onBerhasil={aksiBerhasil} />
      )}
      {modal?.jenis === "riwayat" && <ModalRiwayatKgb pegawai={modal.pegawai} onTutup={tutupModal} />}

      {/* Pesan hasil aksi. Wadah live region selalu ada agar pesan baru dibacakan pembaca layar. */}
      <div role="status" aria-live="polite" className="fixed bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm z-40 pointer-events-none">
        {pesanBerhasil && (
          <div className="pointer-events-auto rounded-xl px-3 py-2.5 flex items-start gap-2.5 shadow-lg"
            style={{ background: "var(--card)", border: "1px solid var(--tint-green-ln)" }}>
            <p className="text-xs leading-relaxed flex-1" style={{ color: "var(--st-green)" }}>{pesanBerhasil}</p>
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
