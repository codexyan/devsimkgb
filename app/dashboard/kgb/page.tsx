"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SATKER } from "@/lib/satker";
import { KODE_SATKER_LAIN, kodeSatkerPegawai } from "@/lib/rekapSatker";
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
import { formatTanggalId, hariIniWita, type NilaiTanggal } from "@/lib/waktu";

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

/** Nilai tab untuk KGB belum diproses yang masa inputnya belum dibuka (bukan status tersimpan). */
const STATUS_BELUM_DIBUKA = "belum_dibuka";

/** KGB yang sudah tersimpan (bukan entri virtual dari data pegawai). */
type KgbTersimpan = KGB & { id: string };

interface RingkasanStatus {
  total: number;
  belum_diproses: number;
  /** Bagian dari belum_diproses yang masa inputnya belum dibuka. */
  belum_dibuka?: number;
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
  // ?status= dari ubin KPI dashboard membuka tab status yang sesuai.
  const [filterStatus, setFilterStatus] = useState(() => {
    const s = searchParams.get("status") ?? "";
    return ["belum_diproses", "sedang_diproses", "menunggu_keuangan", "selesai"].includes(s) ? s : "";
  });
  const [filterBulan, setFilterBulan] = useState("");
  // Tautan langsung ke satu KGB atau pegawai membuka semua tahun agar record-nya ada di daftar.
  const [filterTahun, setFilterTahun] = useState(() => (kgbIdFromUrl || pegawaiIdFromUrl ? "" : defaultTahun));
  const [filterRapelan, setFilterRapelan] = useState(() => searchParams.get("rapelan") ?? "");
  const [filterDeadlineBulan, setFilterDeadlineBulan] = useState(() => searchParams.get("deadlineBulan") ?? "");
  const [filterGolongan, setFilterGolongan] = useState("");
  const [filterSatker, setFilterSatker] = useState(() => searchParams.get("satker") ?? "");
  const [sortBy, setSortBy] = useState("prioritas");
  const [showDetail, setShowDetail] = useState<KGB | null>(null);
  const [modal, setModal] = useState<ModalAksi | null>(null);
  const [pesanBerhasil, setPesanBerhasil] = useState<string | null>(null);

  function paramsKgb(): URLSearchParams {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus === STATUS_BELUM_DIBUKA ? "belum_diproses" : filterStatus);
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
    .filter((k) => !filterSatker || kodeSatkerPegawai(k.pegawai.unitKerja) === filterSatker)
    // Tab Belum diproses hanya memuat yang masa inputnya sudah dibuka; yang belum dibuka punya tab sendiri.
    .filter((k) => {
      if (filterStatus !== "belum_diproses" && filterStatus !== STATUS_BELUM_DIBUKA) return true;
      const terkunci = !!jendelaProsesKgb(k.tmtKgbBaru, hariIni)?.isLocked;
      return filterStatus === STATUS_BELUM_DIBUKA ? terkunci : !terkunci;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "prioritas":
          return peringkatPrioritas(a) - peringkatPrioritas(b) || new Date(a.tmtKgbBaru).getTime() - new Date(b.tmtKgbBaru).getTime();
        case "nama_asc": return a.pegawai.nama.localeCompare(b.pegawai.nama, "id");
        case "nama_desc": return b.pegawai.nama.localeCompare(a.pegawai.nama, "id");
        case "tmt_asc": return new Date(a.tmtKgbBaru).getTime() - new Date(b.tmtKgbBaru).getTime();
        case "tmt_desc": return new Date(b.tmtKgbBaru).getTime() - new Date(a.tmtKgbBaru).getTime();
        case "status": return a.status.localeCompare(b.status);
        default: return 0;
      }
    });

  // filterTahun == defaultTahun adalah state normal, bukan filter aktif
  const hasActiveFilter = !!(filterGolongan || filterSatker || filterRapelan || filterDeadlineBulan || filterStatus || filterBulan || filterTahun !== defaultTahun || search);
  const jumlahVirtual = kgbList.filter((k) => k.isVirtual).length;

  /** Urutan kerja: lewat batas, sedang diproses, siap diinput, menunggu keuangan, belum dibuka, selesai. */
  function peringkatPrioritas(k: KGB): number {
    const jendela = jendelaProsesKgb(k.tmtKgbBaru, hariIni);
    if (k.status === "belum_diproses" || k.status === "ditolak") {
      if (jendela?.isLocked) return 5;
      return jendela?.flagRapelan ? 0 : 2;
    }
    if (k.status === "sedang_diproses") return 1;
    if (k.status === "menunggu_keuangan") return 3;
    if (k.status === "selesai") return 6;
    return 4;
  }

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
      // Masa input belum dibuka: tanggal dibukanya sudah tampil di kolom TMT KGB.
      if (jendela?.isLocked) return null;
      const terlambat = jendela?.flagRapelan ?? false;
      return (
        <>
          {terlambat && (
            <button
              type="button"
              onClick={() => bukaAksi({ jenis: "arsip", pegawai: pegawaiModal(k) })}
              className="dsb-tombol dsb-tombol-kecil"
              data-jenis="garis"
              title="SK KGB periode ini sudah terbit di luar SIM-KGB"
            >
              Arsip KGB
            </button>
          )}
          <button
            type="button"
            onClick={() => aksiInput(k)}
            className="dsb-tombol dsb-tombol-kecil"
            title={terlambat ? "Batas input SDM sudah lewat; KGB ini berpotensi rapelan" : undefined}
          >
            Input KGB
          </button>
        </>
      );
    }
    if (k.status === "sedang_diproses" && k.id) {
      const kgb: KgbTersimpan = { ...k, id: k.id };
      return (
        <>
          <button type="button" onClick={() => bukaAksi({ jenis: "buat_sk", kgb })} className="dsb-tombol dsb-tombol-kecil">
            Buat SK
          </button>
          {skTercatat(k) && (
            <button type="button" onClick={() => bukaAksi({ jenis: "unggah_sk", kgb })} className="dsb-tombol dsb-tombol-kecil" data-nada="hijau">
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

  const belumDibuka = summary?.belum_dibuka ?? 0;
  const tabs: { value: string; label: string; count: number | null; nada?: "merah" }[] = [
    { value: "", label: "Semua", count: summary?.total ?? null },
    { value: "belum_diproses", label: infoStatusKgb("belum_diproses").label, count: summary ? summary.belum_diproses - belumDibuka : null },
    { value: "sedang_diproses", label: infoStatusKgb("sedang_diproses").label, count: summary?.sedang_diproses ?? null },
    { value: "menunggu_keuangan", label: infoStatusKgb("menunggu_keuangan").label, count: summary?.menunggu_keuangan ?? null },
    { value: "selesai", label: infoStatusKgb("selesai").label, count: summary?.selesai ?? null },
    { value: STATUS_BELUM_DIBUKA, label: "Belum dibuka", count: summary ? belumDibuka : null },
  ];

  return (
    <>
    <div className="dsb-halaman">
      {/* Kepala halaman */}
      <header className="dsb-halaman-kepala dsb-muncul">
        <div className="min-w-0">
          <p className="dsb-label">Data</p>
          <h1 className="dsb-halaman-judul">Proses KGB</h1>
          <p className="dsb-sub">Input KGB, buat dan unggah SK, lalu kirim ke keuangan. Urutan bawaan menaruh yang paling mendesak di atas.</p>
        </div>
        <div className="dsb-segar">
          {lastSynced && (
            <span className="hidden sm:inline">
              Diperbarui {formatTanggalId(lastSynced, { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button type="button" onClick={handleSinkronkan} disabled={syncing} className="dsb-tombol" data-jenis="garis">
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={syncing ? "dsb-putar" : undefined}>
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {syncing ? "Menyinkronkan…" : "Sinkronkan data"}
          </button>
        </div>
      </header>

      <section className="dsb-kartu overflow-hidden dsb-muncul" style={{ "--i": 1 } as React.CSSProperties} aria-label="Daftar KGB">
        <div className="dsb-kartu-isi flex flex-col gap-3" style={{ paddingBottom: "14px" }}>
          {/* Tab status dan saringan lewat batas */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="dsb-segmen" role="group" aria-label="Saring status KGB">
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
                  >
                    {tab.label}
                    {tab.count !== null && <span style={{ color: "var(--dt5)" }}>{tab.count}</span>}
                  </button>
                );
              })}
            </div>
            {summary?.rapelan ? (
              <div className="dsb-segmen" role="group" aria-label="Saring lewat batas input">
                <button
                  type="button"
                  data-nada="merah"
                  aria-pressed={!!filterRapelan}
                  onClick={() => { setFilterRapelan(filterRapelan ? "" : "1"); setFilterDeadlineBulan(""); setFilterStatus(""); }}
                >
                  <span className="dsb-titik" data-nada="merah" aria-hidden="true" />
                  Lewat batas input <span style={{ color: "var(--dt5)" }}>{summary.rapelan}</span>
                </button>
              </div>
            ) : null}
            {filterDeadlineBulan && (
              <span className="dsb-tag" style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}>
                Jatuh tempo ≤{filterDeadlineBulan} bln
                <button type="button" onClick={() => setFilterDeadlineBulan("")} aria-label="Hapus saringan jatuh tempo" style={{ marginLeft: "2px" }}>×</button>
              </span>
            )}
          </div>

          {/* Pencarian, saringan, dan urutan */}
          <div className="dsb-alat">
            <input
              type="search"
              className="dsb-cari"
              aria-label="Cari nama atau NIP pegawai"
              placeholder="Cari nama atau NIP pegawai"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select aria-label="Golongan" className="dsb-pilih" data-aktif={filterGolongan ? "" : undefined} value={filterGolongan} onChange={(e) => setFilterGolongan(e.target.value)}>
              <option value="">Semua golongan</option>
              {GOLONGAN.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select aria-label="Satker" className="dsb-pilih" data-aktif={filterSatker ? "" : undefined} value={filterSatker} onChange={(e) => setFilterSatker(e.target.value)}>
              <option value="">Semua satker</option>
              {SATKER.map((s) => (
                <option key={s.kode} value={s.kode}>{s.jenis === "kanwil" ? "Kanwil Ditjenpas Kalsel" : s.nama}</option>
              ))}
              <option value={KODE_SATKER_LAIN}>Belum sesuai daftar satker</option>
            </select>
            <select
              aria-label="Tahun TMT"
              className="dsb-pilih"
              data-aktif={filterTahun !== defaultTahun ? "" : undefined}
              value={filterTahun}
              onChange={(e) => { setFilterTahun(e.target.value); if (!e.target.value) setFilterBulan(""); }}
            >
              <option value="">Semua tahun</option>
              {tahunList.map((y) => (
                <option key={y} value={y.toString()}>{y}</option>
              ))}
            </select>
            <select aria-label="Bulan TMT" className="dsb-pilih" data-aktif={filterBulan ? "" : undefined} value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}>
              <option value="">Semua bulan</option>
              {BULAN.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
            <select aria-label="Urutkan" className="dsb-pilih" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="prioritas">Prioritas</option>
              <option value="tmt_asc">TMT terlama dulu</option>
              <option value="tmt_desc">TMT terbaru dulu</option>
              <option value="nama_asc">Nama A–Z</option>
              <option value="nama_desc">Nama Z–A</option>
            </select>
            {(hasActiveFilter || sortBy !== "prioritas") && (
              <button
                type="button"
                className="dsb-tombol dsb-tombol-kecil"
                data-jenis="garis"
                onClick={() => { setSearch(""); setFilterStatus(""); setFilterBulan(""); setFilterTahun(defaultTahun); setFilterGolongan(""); setFilterSatker(""); setFilterRapelan(""); setFilterDeadlineBulan(""); setSortBy("prioritas"); }}
              >
                Atur ulang
              </button>
            )}
          </div>

          {!loading && (
            <p className="dsb-hasil" style={{ margin: 0 }}>
              Menampilkan <strong>{displayList.length}</strong> KGB
              {jumlahVirtual > 0 && <> · {jumlahVirtual} dari data pegawai yang belum punya catatan KGB</>}
            </p>
          )}
        </div>

        {loading ? (
          <div className="px-5 pb-5 flex flex-col gap-2" role="status" aria-label="Memuat data KGB">
            {[1, 2, 3, 4].map((i) => <div key={i} className="dsb-kerangka" style={{ height: 56, borderRadius: 12 }} />)}
          </div>
        ) : displayList.length === 0 ? (
          <p className="dsb-kosong" style={{ borderTop: "1px solid var(--ln2)", padding: "48px 16px" }}>
            {kgbList.length === 0 ? "Belum ada data KGB." : "Tidak ada KGB yang cocok dengan saringan."}
          </p>
        ) : (
          <div className="overflow-x-auto tbl-scroll" style={{ borderTop: "1px solid var(--ln2)" }}>
            <table className="dsb-tabel" style={{ minWidth: "900px" }}>
              <thead>
                <tr>
                  <th scope="col">Pegawai</th>
                  <th scope="col">Gaji pokok lama → baru</th>
                  <th scope="col">TMT KGB</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {displayList.map((k) => {
                  const warna = warnaStatusKgb(k.status);
                  const terlambat = terlambatSdm(k);
                  const jendela = jendelaProsesKgb(k.tmtKgbBaru, hariIni);
                  const terkunci = k.status === "belum_diproses" && !!jendela?.isLocked;
                  const satker = kodeSatkerPegawai(k.pegawai.unitKerja);
                  const namaSatker = SATKER.find((s) => s.kode === satker);
                  return (
                    <tr
                      key={k.id ?? `virtual-${k.pegawaiId}`}
                      className={terkunci ? "dsb-redup" : undefined}
                      style={{ background: terlambat ? "var(--tint-red-bg)" : undefined }}
                    >
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span className="dsb-avatar" aria-hidden="true">
                            {k.pegawai.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                          </span>
                          <div className="min-w-0" style={{ lineHeight: 1.35 }}>
                            <p className="dsb-nama" style={{ margin: 0 }}>{k.pegawai.nama}</p>
                            <p className="dsb-kecil" style={{ margin: 0 }}>
                              {k.pegawai.nip}
                              {namaSatker && namaSatker.jenis !== "kanwil" ? ` · ${namaSatker.nama.replace(/\bKelas\s+/, "")}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap">
                        <p style={{ margin: 0, color: "var(--dt3)", fontVariantNumeric: "tabular-nums" }}>
                          {k.golonganLama} · {formatRupiah(k.gajiPokokLama)}
                        </p>
                        {k.isVirtual ? (
                          <p className="dsb-kecil" style={{ margin: "2px 0 0" }}>Gaji baru dihitung saat input</p>
                        ) : (
                          <p style={{ margin: "2px 0 0", color: "var(--dtn)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>
                            {formatRupiah(k.gajiPokokBaru)}
                            <span className="dsb-kecil" style={{ fontWeight: 400 }}> · MKG {k.mkgTahunBaru ?? "-"} thn {k.mkgBulanBaru ?? "-"} bln</span>
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {tanggalPendek(k.tmtKgbBaru)}
                        {jendela && k.status === "belum_diproses" && (
                          <p className="dsb-kecil" style={{ margin: "2px 0 0", color: terlambat ? "var(--st-red)" : undefined }}>
                            {terkunci ? `Dibuka ${tanggalPendek(jendela.unlockDate)}` : `Batas input ${tanggalPendek(jendela.deadlineSDM)}`}
                          </p>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <span className="dsb-tag" style={terkunci ? undefined : { background: warna.bg, color: warna.color }} data-garis={terkunci ? "" : undefined}>
                            {terkunci ? "Belum dibuka" : infoStatusKgb(k.status).label}
                          </span>
                          {terlambat && (
                            <span className="dsb-tag" style={{ background: "var(--tint-red-bg2)", color: "var(--st-red)" }} title="Batas input SDM sudah lewat; berpotensi rapelan">
                              Lewat batas input
                            </span>
                          )}
                          {!k.isVirtual && k.status === "belum_diproses" && k.nomorSK === "" && (
                            <span className="dsb-tag" data-garis="">Antrean otomatis</span>
                          )}
                          {!k.isVirtual && !k.isArsip && !k.penetapSkDasar &&
                            (k.status === "sedang_diproses" || (k.status === "belum_diproses" && k.nomorSK !== "")) && (
                            <span className="dsb-tag" style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber2)" }} title="Pejabat penetap SK terakhir belum diisi; lengkapi saat Buat SK">
                              Penetap SK perlu dilengkapi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="kanan whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {!k.isVirtual && (
                            <button type="button" onClick={() => bukaDetail(k)} className="dsb-tombol dsb-tombol-kecil" data-jenis="garis">
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
      </section>

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
