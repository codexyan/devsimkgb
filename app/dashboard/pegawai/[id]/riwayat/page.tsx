"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { canManageHukdis, canProcessKGB } from "@/lib/auth";
import { useRole } from "@/app/dashboard/components/RoleContext";
import { useDialogModal } from "@/app/dashboard/components/useDialogModal";
import {
  IkonDokumen,
  KerangkaModal,
  Lencana,
  LencanaRapelan,
  LencanaStatus,
  ModalArsipKgb,
  ModalBatalkanKgb,
  ModalBuatSk,
  ModalInputKgb,
  ModalUnggahSk,
  formatRupiah,
  nomorSkTerisi,
  type DasarSkAwal,
} from "@/app/dashboard/components/kgb";
import { tmtBerakhirOtomatis } from "@/lib/hukdisJenis";
import { tautanBerkasSk } from "@/lib/kgbAksi";
import { infoStatusKgb, warnaStatusKgb } from "@/lib/statusKgb";
import { jendelaProsesKgb } from "@/lib/tabelGaji";
import { formatTanggalId, hariIniWita, tanggalKalender, type NilaiTanggal } from "@/lib/waktu";

interface Pegawai {
  id: string;
  nip: string;
  nama: string;
  jabatan: string;
  pangkat: string;
  golonganRuang: string;
  gajiPokok: number;
  mkgTahun: number;
  mkgBulan: number;
  tmtKgbBerikutnya: string;
  statusHukdis?: boolean;
}

interface RiwayatKGB {
  id: string;
  nomorSK: string;
  tanggalSK: string | null;
  tmtSK: string | null;
  penetapSkDasar?: string | null;
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
  status: string;
  flagRapelan: boolean;
  rapelanDitetapkan?: boolean | null;
  isArsip: boolean;
  createdAt: string | null;
  surat: { nomorSurat: string; tanggalSurat?: string | null; pathFile?: string | null } | null;
  /** SK sudah dibuat di SIM-KGB; syarat Unggah SK TTE. */
  skSudahDibuat?: boolean;
  alasanBatal?: string | null;
}

/** Satu kenaikan pangkat dari GET /api/pegawai/[id]/pangkat. */
interface RiwayatPangkat {
  id: string;
  jenisLabel: string;
  nomorSK: string;
  tanggalSK: string | null;
  tmtPangkat: string | null;
  golonganLama: string;
  golonganBaru: string;
  mkgTahunLama: number;
  mkgBulanLama: number;
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  gajiPokokLama: number;
  gajiPokokBaru: number;
  keterangan: string | null;
}

interface RiwayatHukdis {
  id: string;
  jenisHukdis: string;
  nomorSK: string;
  tanggalSK: string;
  tmtMulai: string;
  tmtBerakhir: string | null;
  berdampakKGB: boolean;
  durasiTunda: number | null;
  keterangan: string | null;
  createdAt: string;
}

interface HukdisJenisKonfig {
  id: string;
  kode: string;
  label: string;
  kategori: string;
  durasiHukdis: number;
  berdampakKGB: boolean;
  durasiTunda: number | null;
  dasarHukum: string | null;
  aktif: boolean;
}

type ModalAksi =
  | { jenis: "input"; ulang: boolean; dasarAwal: DasarSkAwal | null }
  | { jenis: "arsip" }
  | { jenis: "buat_sk"; kgb: RiwayatKGB }
  | { jenis: "unggah_sk"; kgb: RiwayatKGB }
  | { jenis: "batalkan"; kgb: RiwayatKGB };

const FALLBACK_LABELS: Record<string, string> = {
  teguran_lisan:               "Teguran Lisan",
  teguran_tertulis:            "Teguran Tertulis",
  pernyataan_tidak_puas:       "Pernyataan Tidak Puas",
  penundaan_kgb:               "Penundaan KGB",
  penurunan_gaji_pokok:        "Penurunan Gaji Pokok",
  penundaan_kenaikan_pangkat:  "Penundaan Kenaikan Pangkat",
  penurunan_pangkat:           "Penurunan Pangkat",
  pembebasan_jabatan:          "Pembebasan Jabatan",
  pemberhentian_dengan_hormat: "Pemberhentian Dengan Hormat",
  pemberhentian_tidak_hormat:  "Pemberhentian Tidak Hormat",
};

const HUKDIS_FORM_INIT = {
  jenisHukdis: "",
  nomorSK: "",
  tanggalSK: "",
  tmtMulai: "",
  tmtBerakhir: "",
  dasarHukum: "",
  keterangan: "",
};

const STATUS_KGB_AKTIF = ["sedang_diproses", "menunggu_keuangan"];

const tanggalPanjang = (nilai: NilaiTanggal) => formatTanggalId(nilai);
const periode = (nilai: NilaiTanggal) => formatTanggalId(nilai, { month: "long", year: "numeric" });

function waktuDibuat(r: RiwayatKGB): number {
  const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
  return Number.isNaN(t) ? 0 : t;
}

export default function RiwayatKGBPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const role = useRole();
  const canHukdis = canManageHukdis(role);
  const bolehProses = canProcessKGB(role);
  const hariIni = hariIniWita();

  const [pegawai, setPegawai] = useState<Pegawai | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatKGB[]>([]);
  const [hukdisList, setHukdisList] = useState<RiwayatHukdis[]>([]);
  const [pangkatList, setPangkatList] = useState<RiwayatPangkat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"kgb" | "pangkat" | "hukdis">("kgb");

  // Popup Proses KGB dan modal aksi KGB bersama
  const [showKgbPopup, setShowKgbPopup] = useState(false);
  const [modal, setModal] = useState<ModalAksi | null>(null);
  const [pesanBerhasil, setPesanBerhasil] = useState<string | null>(null);

  // Hukdis modal state
  const [showHukdisModal, setShowHukdisModal] = useState(false);
  const [hukdisForm, setHukdisForm] = useState(HUKDIS_FORM_INIT);
  const [savingHukdis, setSavingHukdis] = useState(false);
  const [hukdisError, setHukdisError] = useState("");
  const [deletingHukdisId, setDeletingHukdisId] = useState<string | null>(null);
  const [galatHapusHukdis, setGalatHapusHukdis] = useState("");
  const [jenisKonfig, setJenisKonfig] = useState<HukdisJenisKonfig[]>([]);
  const hukdisPanelRef = useDialogModal<HTMLDivElement>(showHukdisModal, () => setShowHukdisModal(false), savingHukdis);

  useEffect(() => {
    if (!canHukdis) return;
    fetch("/api/hukdis/konfigurasi")
      .then((r) => r.json() as Promise<{ jenis?: HukdisJenisKonfig[] }>)
      .then((d) => {
        const aktif = (d.jenis ?? []).filter((j) => j.aktif);
        setJenisKonfig(aktif);
        setHukdisForm((f) => ({ ...f, jenisHukdis: aktif[0]?.kode ?? "" }));
      })
      .catch(() => {});
  }, [canHukdis]);

  useEffect(() => {
    if (!pesanBerhasil) return;
    const t = setTimeout(() => setPesanBerhasil(null), 8000);
    return () => clearTimeout(t);
  }, [pesanBerhasil]);

  function getJenisLabel(kode: string): string {
    return jenisKonfig.find((j) => j.kode === kode)?.label ?? FALLBACK_LABELS[kode] ?? kode;
  }

  function handleJenisChange(kode: string) {
    const jenis = jenisKonfig.find((j) => j.kode === kode);
    setHukdisForm((f) => {
      let tmtBerakhir = f.tmtBerakhir;
      if (jenis && jenis.durasiHukdis > 0 && f.tmtMulai) {
        tmtBerakhir = tmtBerakhirOtomatis(f.tmtMulai, jenis.durasiHukdis) || tmtBerakhir;
      }
      // Dasar hukum default dari jenis (PIC bisa mengubah bila regulasi berbeda)
      const dasarHukum = jenis?.dasarHukum ?? f.dasarHukum;
      return { ...f, jenisHukdis: kode, tmtBerakhir, dasarHukum };
    });
  }

  function handleTmtMulaiChange(val: string) {
    const jenis = jenisKonfig.find((j) => j.kode === hukdisForm.jenisHukdis);
    setHukdisForm((f) => {
      let tmtBerakhir = f.tmtBerakhir;
      if (jenis && jenis.durasiHukdis > 0 && val) {
        tmtBerakhir = tmtBerakhirOtomatis(val, jenis.durasiHukdis) || tmtBerakhir;
      }
      return { ...f, tmtMulai: val, tmtBerakhir };
    });
  }

  // Memuat ulang tanpa mengosongkan halaman; status memuat hanya dipakai saat pertama dibuka.
  const fetchData = () => {
    const hukdisPromise: Promise<unknown> = canHukdis
      ? fetch(`/api/pegawai/${id}/hukdis`)
          .then(async (r) => {
            if (!r.ok) return [];
            const t = await r.text();
            try { return t ? (JSON.parse(t) as unknown) : []; } catch { return []; }
          })
          .catch(() => [])
      : Promise.resolve([]);

    const pangkatPromise = fetch(`/api/pegawai/${id}/pangkat`)
      .then(async (r) => (r.ok ? ((await r.json()) as unknown) : []))
      .catch(() => []);

    return Promise.all([
      fetch(`/api/pegawai/${id}/riwayat-kgb`).then((r) => r.json() as Promise<{ pegawai?: Pegawai; riwayat?: RiwayatKGB[] }>),
      hukdisPromise,
      pangkatPromise,
    ])
      .then(([kgbData, hukdisData, pangkatData]) => {
        setPegawai(kgbData.pegawai ?? null);
        setRiwayat(Array.isArray(kgbData.riwayat) ? kgbData.riwayat : []);
        setHukdisList(Array.isArray(hukdisData) ? (hukdisData as RiwayatHukdis[]) : []);
        setPangkatList(Array.isArray(pangkatData) ? (pangkatData as RiwayatPangkat[]) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSaveHukdis = async () => {
    setHukdisError("");
    if (!hukdisForm.nomorSK || !hukdisForm.tanggalSK || !hukdisForm.tmtMulai || !hukdisForm.tmtBerakhir) {
      setHukdisError("Nomor SK, Tanggal SK, TMT Mulai, dan TMT Berakhir wajib diisi.");
      return;
    }
    if (!hukdisForm.keterangan.trim()) {
      setHukdisError("Keterangan wajib diisi. Jelaskan jenis dan detail hukuman disiplin.");
      return;
    }
    setSavingHukdis(true);
    try {
      const res = await fetch(`/api/pegawai/${id}/hukdis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hukdisForm),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setHukdisError(d.error || "Gagal menyimpan.");
        return;
      }
      setShowHukdisModal(false);
      setHukdisForm(HUKDIS_FORM_INIT);
      fetchData();
    } finally {
      setSavingHukdis(false);
    }
  };

  const handleDeleteHukdis = async (hukdisId: string) => {
    if (!confirm("Hapus data hukdis ini? TMT KGB akan dikembalikan jika ini adalah penundaan KGB.")) return;
    setDeletingHukdisId(hukdisId);
    setGalatHapusHukdis("");
    try {
      const res = await fetch(`/api/hukdis/${hukdisId}`, { method: "DELETE" });
      const d = (await res.json().catch(() => ({}))) as { error?: string; pesan?: string };
      if (!res.ok) {
        setGalatHapusHukdis(d.error || "Catatan hukdis gagal dihapus.");
        return;
      }
      // Pesan API menyebut apakah TMT KGB dipulihkan atau perlu diperiksa.
      setPesanBerhasil(d.pesan || "Catatan hukdis dihapus.");
      fetchData();
    } catch {
      setGalatHapusHukdis("Gagal menghubungi server. Periksa koneksi, lalu coba lagi.");
    } finally {
      setDeletingHukdisId(null);
    }
  };

  function bukaHukdis() {
    setShowHukdisModal(true);
    setHukdisError("");
    setHukdisForm(HUKDIS_FORM_INIT);
  }

  function bukaAksi(aksi: ModalAksi) {
    setShowKgbPopup(false);
    setModal(aksi);
  }

  function aksiBerhasil(pesan: string) {
    setModal(null);
    setPesanBerhasil(pesan);
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p role="status" className="text-xs" style={{ color: "var(--dt4)" }}>Memuat data...</p>
      </div>
    );
  }

  if (!pegawai) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-xs" style={{ color: "var(--st-red)" }}>Pegawai tidak ditemukan.</p>
      </div>
    );
  }

  const pegawaiModal = {
    id: pegawai.id,
    nama: pegawai.nama,
    nip: pegawai.nip,
    jabatan: pegawai.jabatan || null,
    golonganRuang: pegawai.golonganRuang || null,
  };

  // Input Ulang KGB hanya ditawarkan pada pembatalan terakhir, selama belum ada KGB aktif atau KGB yang lebih baru.
  const batalTerakhir = riwayat
    .filter((r) => r.status === "ditolak")
    .sort((a, b) => waktuDibuat(b) - waktuDibuat(a))[0];
  const idInputUlang =
    batalTerakhir &&
    !riwayat.some(
      (r) =>
        r.status !== "ditolak" &&
        (STATUS_KGB_AKTIF.includes(r.status) || waktuDibuat(r) > waktuDibuat(batalTerakhir)),
    )
      ? batalTerakhir.id
      : null;

  const kelasTombolKecil = "kgbm-tombol kgbm-tombol-kecil";

  function renderAksiKgb(r: RiwayatKGB) {
    const tombol: React.ReactNode[] = [];
    if (r.surat?.pathFile) {
      tombol.push(
        <a key="lihat" href={tautanBerkasSk(r.surat.pathFile)} target="_blank" rel="noopener noreferrer" className={`${kelasTombolKecil} kgbm-kedua`}>
          Lihat SK Tertandatangani
        </a>,
      );
    }
    if (!bolehProses) return tombol;

    if (r.status === "belum_diproses" && !r.isArsip) {
      const jendela = jendelaProsesKgb(r.tmtKgbBaru, hariIni);
      if (jendela?.isLocked) {
        tombol.push(
          <span key="terkunci" className="text-xs" style={{ color: "var(--dt4)" }}>
            Input KGB dibuka {tanggalPanjang(jendela.unlockDate)}
          </span>,
        );
      } else if (jendela) {
        if (jendela.flagRapelan) {
          tombol.push(
            <button key="arsip" type="button" className={`${kelasTombolKecil} kgbm-amber`} onClick={() => bukaAksi({ jenis: "arsip" })}>
              Arsip KGB
            </button>,
          );
        }
        tombol.push(
          <button
            key="input"
            type="button"
            className={`${kelasTombolKecil} kgbm-utama`}
            onClick={() => bukaAksi({ jenis: "input", ulang: false, dasarAwal: null })}
          >
            Input KGB
          </button>,
        );
      }
    }
    if (r.status === "sedang_diproses" && !r.isArsip) {
      tombol.push(
        <button key="batal" type="button" className={`${kelasTombolKecil} kgbm-kedua`} onClick={() => bukaAksi({ jenis: "batalkan", kgb: r })}>
          Batalkan KGB
        </button>,
      );
      if (r.skSudahDibuat === true) {
        tombol.push(
          <button key="unggah" type="button" className={`${kelasTombolKecil} kgbm-hijau`} onClick={() => bukaAksi({ jenis: "unggah_sk", kgb: r })}>
            Unggah SK TTE
          </button>,
        );
      }
      tombol.push(
        <button key="buat" type="button" className={`${kelasTombolKecil} kgbm-utama`} onClick={() => bukaAksi({ jenis: "buat_sk", kgb: r })}>
          Buat SK
        </button>,
      );
    }
    if (r.status === "selesai" && r.isArsip && !r.surat?.pathFile) {
      tombol.push(
        <button key="unggah-arsip" type="button" className={`${kelasTombolKecil} kgbm-hijau`} onClick={() => bukaAksi({ jenis: "unggah_sk", kgb: r })}>
          Unggah SK TTE
        </button>,
      );
    }
    if (r.id === idInputUlang) {
      const dasarAwal: DasarSkAwal | null = nomorSkTerisi(r.nomorSK)
        ? { nomorSK: r.nomorSK, tanggalSK: r.tanggalSK, tmtSK: r.tmtSK, penetapSkDasar: r.penetapSkDasar ?? null }
        : null;
      tombol.push(
        <button
          key="input-ulang"
          type="button"
          className={`${kelasTombolKecil} kgbm-utama`}
          onClick={() => bukaAksi({ jenis: "input", ulang: true, dasarAwal })}
        >
          Input Ulang KGB
        </button>,
      );
    }
    return tombol;
  }

  return (
    <div>
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs mb-5 transition"
        style={{ color: "var(--dt4)" }}
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Kembali
      </button>

      {/* Profil Pegawai */}
      <div
        className="rounded-2xl p-5 mb-6 flex flex-col sm:flex-row gap-4 sm:items-center"
        style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}
      >
        <div
          aria-hidden="true"
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0"
          style={{ background: "var(--tint-navy)", color: "var(--dtn)" }}
        >
          {pegawai.nama.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>{pegawai.nama}</h1>
            {pegawai.statusHukdis && (
              <span
                className="text-xs px-2 py-0.5 rounded font-bold"
                style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", fontSize: "9px" }}
              >
                Hukdis aktif
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--dt4)" }}>NIP: {pegawai.nip}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            {[
              { label: "Jabatan", val: pegawai.jabatan },
              { label: "Pangkat / Gol", val: `${pegawai.pangkat} (${pegawai.golonganRuang})` },
              { label: "Gaji Pokok", val: formatRupiah(pegawai.gajiPokok) },
              { label: "MKG Sekarang", val: `${pegawai.mkgTahun} Thn ${pegawai.mkgBulan} Bln` },
              { label: "TMT KGB Berikutnya", val: tanggalPanjang(pegawai.tmtKgbBerikutnya) },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs" style={{ color: "var(--dt5)" }}>{item.label}</p>
                <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{item.val}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {canHukdis && (
            <button
              type="button"
              onClick={bukaHukdis}
              className="text-xs px-4 py-2 rounded-xl font-semibold"
              style={{ background: "var(--tint-red-bg)", color: "var(--st-red)", border: "0.5px solid var(--tint-red-ln)" }}
            >
              + Hukdis
            </button>
          )}
          {bolehProses && (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setShowKgbPopup(true)}
              className="shrink-0 text-xs px-4 py-2 rounded-xl font-semibold"
              style={{ background: "var(--navy-solid)", color: "#fff" }}
            >
              Proses KGB
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(["kgb", "pangkat", ...(canHukdis ? ["hukdis"] : [])] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab as "kgb" | "pangkat" | "hukdis")}
            className="text-xs px-4 py-2 rounded-xl font-semibold transition"
            style={{
              background: activeTab === tab ? "var(--navy-solid)" : "var(--sub)",
              color: activeTab === tab ? "#fff" : "var(--dt4)",
              border: "0.5px solid",
              borderColor: activeTab === tab ? "var(--dtn)" : "var(--ln1)",
            }}
          >
            {tab === "kgb"
              ? `Riwayat KGB (${riwayat.length})`
              : tab === "pangkat"
                ? `Riwayat Pangkat (${pangkatList.length})`
                : `Riwayat Hukdis (${hukdisList.length})`}
          </button>
        ))}
      </div>

      {/* Riwayat pangkat: dasar gaji setiap kali pangkat naik (lib/kenaikanPangkat.ts) */}
      {activeTab === "pangkat" && (
        <div>
          {pangkatList.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-16 gap-2"
              style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>Belum ada riwayat kenaikan pangkat</p>
              <p className="text-xs" style={{ color: "var(--dt5)" }}>
                Kenaikan pangkat dicatat dari Data Pegawai, dan langsung menyesuaikan golongan, masa kerja golongan, serta gaji pokok.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pangkatList.map((p) => (
                <div key={p.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}>
                  <div className="px-4 py-3 flex flex-wrap items-center gap-2" style={{ borderBottom: "0.5px solid var(--ln2)", background: "var(--sub)" }}>
                    <span className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
                      {p.golonganLama} → {p.golonganBaru}
                    </span>
                    <span className="dsb-tag" data-garis="">{p.jenisLabel}</span>
                    <span className="text-xs" style={{ color: "var(--dt4)", marginLeft: "auto" }}>
                      TMT {p.tmtPangkat ? formatTanggalId(p.tmtPangkat, { day: "numeric", month: "long", year: "numeric" }) : "-"}
                    </span>
                  </div>
                  <dl className="px-4 py-3 grid gap-x-6 gap-y-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", fontSize: "12px" }}>
                    <div>
                      <dt style={{ color: "var(--dt5)" }}>Masa kerja golongan</dt>
                      <dd style={{ margin: 0, color: "var(--dtn)" }}>
                        {p.mkgTahunLama} thn {p.mkgBulanLama} bln → {p.mkgTahunBaru} thn {p.mkgBulanBaru} bln
                        {p.mkgTahunLama - p.mkgTahunBaru > 0 && (
                          <span style={{ display: "block", color: "var(--st-amber)" }}>
                            dipotong {p.mkgTahunLama - p.mkgTahunBaru} tahun (pindah jenjang golongan)
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: "var(--dt5)" }}>Gaji pokok</dt>
                      <dd style={{ margin: 0, color: "var(--dtn)" }}>
                        Rp {p.gajiPokokLama.toLocaleString("id-ID")} → <span style={{ color: "var(--st-green)" }}>Rp {p.gajiPokokBaru.toLocaleString("id-ID")}</span>
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: "var(--dt5)" }}>SK kenaikan pangkat</dt>
                      <dd style={{ margin: 0, color: "var(--dtn)" }}>
                        {p.nomorSK || "-"}
                        <span style={{ display: "block", color: "var(--dt5)" }}>
                          {p.tanggalSK ? formatTanggalId(p.tanggalSK, { day: "numeric", month: "long", year: "numeric" }) : "-"}
                        </span>
                      </dd>
                    </div>
                    {p.keterangan && (
                      <div>
                        <dt style={{ color: "var(--dt5)" }}>Keterangan</dt>
                        <dd style={{ margin: 0, color: "var(--dt3)" }}>{p.keterangan}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* KGB Tab */}
      {activeTab === "kgb" && (
        <div>
          {riwayat.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-16 gap-2"
              style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}
            >
              <p className="text-xs" style={{ color: "var(--dt5)" }}>Belum ada riwayat KGB</p>
            </div>
          ) : (
            <div className="space-y-3">
              {riwayat.map((r, i) => {
                const warna = warnaStatusKgb(r.status);
                const isPending = r.status === "belum_diproses";
                const dalamProses = isPending || STATUS_KGB_AKTIF.includes(r.status);
                const nomorSurat = nomorSkTerisi(r.surat?.nomorSurat);
                return (
                  <div
                    key={r.id}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "var(--card)",
                      border: `0.5px solid ${isPending ? "var(--tint-amber-ln)" : "var(--ln1)"}`,
                    }}
                  >
                    <div
                      className="px-5 py-3 flex items-center justify-between"
                      style={{ background: isPending ? "var(--tint-amber-bg)" : "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: "var(--navy-solid)", color: "#fff" }}
                        >
                          {riwayat.length - i}
                        </div>
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "var(--dtn)" }}>
                            Periode {periode(r.tmtKgbBaru)}
                          </p>
                          <p className="text-xs" style={{ color: "var(--dt4)" }}>
                            Dibuat: {tanggalPanjang(r.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.isArsip && (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ background: "var(--tint-amber-bg2)", color: "var(--st-amber)", fontSize: "9px" }}
                          >
                            Arsip
                          </span>
                        )}
                        {r.flagRapelan && !r.isArsip && dalamProses && (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", fontSize: "9px" }}
                          >
                            Berpotensi rapelan
                          </span>
                        )}
                        {r.rapelanDitetapkan === true && (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", fontSize: "9px" }}
                          >
                            Rapelan ditetapkan
                          </span>
                        )}
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: warna.bg, color: warna.color }}
                        >
                          {infoStatusKgb(r.status).label}
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>Golongan</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dt4)" }}>{r.golonganLama}</p>
                        <p className="text-xs font-bold" style={{ color: "var(--dtn)" }}>→ {r.golonganBaru}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>MKG</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dt4)" }}>{r.mkgTahunLama} Thn {r.mkgBulanLama} Bln</p>
                        <p className="text-xs font-bold" style={{ color: "var(--dtn)" }}>→ {r.mkgTahunBaru ?? "-"} Thn {r.mkgBulanBaru ?? "-"} Bln</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>Gaji Pokok</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dt4)" }}>{formatRupiah(r.gajiPokokLama)}</p>
                        <p className="text-xs font-bold" style={{ color: "var(--st-green)" }}>→ {formatRupiah(r.gajiPokokBaru)}</p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>TMT Berikutnya</p>
                        <p className="text-xs font-bold" style={{ color: "var(--dtn)" }}>
                          {tanggalPanjang(r.tmtKgbBerikutnya)}
                        </p>
                        {nomorSkTerisi(r.nomorSK) && (
                          <p className="text-xs mt-1" style={{ color: "var(--dt4)" }}>
                            {r.isArsip ? "Nomor SK" : "SK terakhir"}: {r.nomorSK}
                          </p>
                        )}
                      </div>
                    </div>
                    {r.surat && (nomorSurat || r.surat.pathFile) && (
                      <div
                        className="px-5 py-2.5 flex items-center justify-between gap-2"
                        style={{ borderTop: "0.5px solid var(--ln1)", background: "var(--tint-green-bg)" }}
                      >
                        <p className="text-xs" style={{ color: "var(--st-green)" }}>
                          {nomorSurat ? `${r.isArsip ? "Nomor SK" : "Nomor SK Baru"}: ${nomorSurat}` : "SK tertandatangani sudah diunggah"}
                        </p>
                        {r.surat.pathFile && (
                          <a
                            href={tautanBerkasSk(r.surat.pathFile)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-lg font-semibold"
                            style={{ background: "var(--tint-green-bg)", color: "var(--st-green)", border: "0.5px solid var(--tint-green-ln)" }}
                          >
                            <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Lihat SK Tertandatangani
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hukdis Tab */}
      {activeTab === "hukdis" && (
        <div>
          {galatHapusHukdis && (
            <p role="alert" className="text-xs px-3 py-2 rounded-xl mb-3" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>
              {galatHapusHukdis}
            </p>
          )}
          {hukdisList.length === 0 ? (
            <div
              className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3"
              style={{ background: "var(--card)", border: "0.5px solid var(--ln1)" }}
            >
              <p className="text-xs" style={{ color: "var(--dt5)" }}>Tidak ada riwayat hukuman disiplin</p>
              {canHukdis && (
                <button
                  type="button"
                  onClick={bukaHukdis}
                  className="text-xs px-4 py-2 rounded-xl font-semibold"
                  style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}
                >
                  + Tambah Hukdis
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {hukdisList.map((h) => {
                const berakhir = tanggalKalender(h.tmtBerakhir);
                // Hukdis berlaku sampai dengan tanggal berakhir (WITA); tanpa tanggal berakhir dianggap berlaku.
                const isActive = !berakhir || berakhir >= hariIni;
                return (
                  <div
                    key={h.id}
                    className="rounded-2xl overflow-hidden"
                    style={{
                      background: "var(--card)",
                      border: `0.5px solid ${isActive ? "var(--tint-red-ln)" : "var(--ln1)"}`,
                    }}
                  >
                    <div
                      className="px-5 py-3 flex items-center justify-between"
                      style={{ background: isActive ? "var(--tint-red-bg)" : "var(--sub)", borderBottom: "0.5px solid var(--ln1)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "var(--st-red)" }}>
                            {getJenisLabel(h.jenisHukdis)}
                          </p>
                          <p className="text-xs" style={{ color: "var(--dt4)" }}>SK: {h.nomorSK}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {h.berdampakKGB && (
                          <span
                            className="text-xs px-2 py-0.5 rounded font-bold"
                            style={{ background: "var(--tint-amber-bg)", color: "var(--st-amber)", fontSize: "9px" }}
                          >
                            Tunda KGB {h.durasiTunda} bulan
                          </span>
                        )}
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{
                            background: isActive ? "var(--tint-red-bg)" : "var(--sub)",
                            color: isActive ? "var(--st-red)" : "var(--dt4)",
                          }}
                        >
                          {isActive ? "Aktif" : "Selesai"}
                        </span>
                        {canHukdis && (
                          <button
                            type="button"
                            onClick={() => handleDeleteHukdis(h.id)}
                            disabled={deletingHukdisId === h.id}
                            className="text-xs px-2.5 py-1 rounded-lg font-semibold"
                            style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}
                          >
                            {deletingHukdisId === h.id ? "Menghapus..." : "Hapus"}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>Tanggal SK</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>
                          {tanggalPanjang(h.tanggalSK)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--dt5)" }}>Berlaku</p>
                        <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>
                          {tanggalPanjang(h.tmtMulai)} s/d {tanggalPanjang(h.tmtBerakhir)}
                        </p>
                      </div>
                      {h.keterangan && (
                        <div>
                          <p className="text-xs" style={{ color: "var(--dt5)" }}>Keterangan</p>
                          <p className="text-xs font-medium" style={{ color: "var(--dtn)" }}>{h.keterangan}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Popup Proses KGB */}
      {showKgbPopup && (
        <KerangkaModal
          judul="Proses KGB"
          subjudul={`${pegawai.nama} · NIP ${pegawai.nip}`}
          ikon={<IkonDokumen />}
          nada="navy"
          onTutup={() => setShowKgbPopup(false)}
          kaki={
            <>
              <button type="button" className="kgbm-tombol kgbm-kedua" onClick={() => setShowKgbPopup(false)}>
                Tutup
              </button>
              <Link
                href={`/dashboard/kgb?pegawaiId=${encodeURIComponent(pegawai.id)}`}
                className="kgbm-tombol kgbm-utama"
                onClick={() => setShowKgbPopup(false)}
              >
                Buka di Halaman Proses KGB
              </Link>
            </>
          }
        >
          {riwayat.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--dt5)" }}>Belum ada data KGB.</p>
          ) : (
            <ul className="kgbm-daftar">
              {riwayat.map((r, i) => {
                const jendela = jendelaProsesKgb(r.tmtKgbBaru, hariIni);
                const terlambat =
                  (r.status === "belum_diproses" || r.status === "sedang_diproses") && !r.isArsip && (jendela?.flagRapelan ?? false);
                const aksi = renderAksiKgb(r);
                return (
                  <li
                    key={r.id}
                    className="kgbm-item"
                    style={terlambat ? { borderColor: "var(--tint-amber-ln)" } : undefined}
                  >
                    <div className="kgbm-item-kepala">
                      <p className="kgbm-item-judul">
                        {riwayat.length - i}. Periode {periode(r.tmtKgbBaru)}
                      </p>
                      {r.isArsip && <Lencana nada="navy">Arsip</Lencana>}
                      {terlambat && <Lencana nada="amber">Terlambat</Lencana>}
                      {r.flagRapelan && !r.isArsip && r.status === "menunggu_keuangan" && <LencanaRapelan />}
                      <LencanaStatus status={r.status} />
                    </div>
                    <dl className="kgbm-item-data">
                      <div>
                        <dt>Golongan</dt>
                        <dd>{r.golonganLama} → {r.golonganBaru}</dd>
                      </div>
                      <div>
                        <dt>Gaji pokok baru</dt>
                        <dd>{formatRupiah(r.gajiPokokBaru)}</dd>
                      </div>
                      <div>
                        <dt>Batas input SDM</dt>
                        <dd>{tanggalPanjang(jendela?.deadlineSDM)}</dd>
                      </div>
                      <div>
                        <dt>TMT berikutnya</dt>
                        <dd>{tanggalPanjang(r.tmtKgbBerikutnya)}</dd>
                      </div>
                    </dl>
                    {r.status === "ditolak" && r.alasanBatal && (
                      <p className="text-xs" style={{ color: "var(--st-red)" }}>
                        Alasan pembatalan: {r.alasanBatal}
                      </p>
                    )}
                    {aksi.length > 0 && (
                      <div className="kgbm-baris-tombol" style={{ justifyContent: "flex-end" }}>
                        {aksi}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </KerangkaModal>
      )}

      {/* -- Modal aksi KGB bersama (app/dashboard/components/kgb) -- */}
      {modal?.jenis === "input" && (
        <ModalInputKgb
          pegawai={pegawaiModal}
          ulang={modal.ulang}
          dasarAwal={modal.dasarAwal}
          dasarDariRiwayat
          onTutup={() => setModal(null)}
          onBerhasil={aksiBerhasil}
          onArsipKgb={() => setModal({ jenis: "arsip" })}
        />
      )}
      {modal?.jenis === "arsip" && (
        <ModalArsipKgb pegawai={pegawaiModal} onTutup={() => setModal(null)} onBerhasil={aksiBerhasil} />
      )}
      {modal?.jenis === "buat_sk" && (
        <ModalBuatSk
          kgbId={modal.kgb.id}
          status={modal.kgb.status}
          pegawai={pegawaiModal}
          ringkasan={{
            golongan: modal.kgb.golonganBaru,
            gajiPokokLama: modal.kgb.gajiPokokLama,
            gajiPokokBaru: modal.kgb.gajiPokokBaru,
            mkgTahunBaru: modal.kgb.mkgTahunBaru,
            mkgBulanBaru: modal.kgb.mkgBulanBaru,
            tmtKgbBaru: modal.kgb.tmtKgbBaru,
            flagRapelan: modal.kgb.flagRapelan,
          }}
          dasarAwal={{
            nomorSK: modal.kgb.nomorSK,
            tanggalSK: modal.kgb.tanggalSK,
            tmtSK: modal.kgb.tmtSK,
            penetapSkDasar: modal.kgb.penetapSkDasar ?? null,
          }}
          skBaruAwal={{ nomorSurat: modal.kgb.surat?.nomorSurat, tanggalSurat: modal.kgb.surat?.tanggalSurat }}
          onTutup={() => setModal(null)}
          onBerhasil={aksiBerhasil}
        />
      )}
      {modal?.jenis === "unggah_sk" && (
        <ModalUnggahSk
          kgbId={modal.kgb.id}
          status={modal.kgb.status}
          isArsip={modal.kgb.isArsip}
          pegawai={pegawaiModal}
          onTutup={() => setModal(null)}
          onBerhasil={aksiBerhasil}
        />
      )}
      {modal?.jenis === "batalkan" && (
        <ModalBatalkanKgb kgbId={modal.kgb.id} pegawai={pegawaiModal} onTutup={() => setModal(null)} onBerhasil={aksiBerhasil} />
      )}

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

      {/* Modal Tambah Hukdis */}
      {showHukdisModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !savingHukdis) setShowHukdisModal(false); }}
        >
          <div
            ref={hukdisPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="judul-tambah-hukdis"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-4 outline-none"
            style={{ background: "var(--card)", maxHeight: "90dvh", overflowY: "auto" }}
          >
            <div className="flex items-center justify-between">
              <h3 id="judul-tambah-hukdis" className="text-sm font-semibold" style={{ color: "var(--dtn)" }}>Tambah Hukuman Disiplin</h3>
              <button
                type="button"
                onClick={() => setShowHukdisModal(false)}
                disabled={savingHukdis}
                aria-label="Tutup"
                style={{ color: "var(--dt4)" }}
              >
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div role="alert" aria-live="assertive">
              {hukdisError && (
                <p className="text-xs px-3 py-2 rounded-xl" style={{ background: "var(--tint-red-bg)", color: "var(--st-red)" }}>
                  {hukdisError}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">

              {/* Jenis Hukdis - dari konfigurasi */}
              <div>
                <label htmlFor="hukdis-jenis" className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                  Jenis Hukuman Disiplin <span aria-hidden="true" style={{ color: "var(--st-red)" }}>*</span>
                </label>
                {jenisKonfig.length === 0 ? (
                  <p role="status" className="text-xs" style={{ color: "var(--dt4)" }}>Memuat daftar jenis hukdis...</p>
                ) : (
                  <select
                    id="hukdis-jenis"
                    value={hukdisForm.jenisHukdis}
                    onChange={(e) => handleJenisChange(e.target.value)}
                    className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                    style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  >
                    {["ringan", "sedang", "berat"].map((kat) => {
                      const items = jenisKonfig.filter((j) => j.kategori === kat);
                      if (!items.length) return null;
                      const katLabel = kat === "ringan" ? "Hukdis Ringan" : kat === "sedang" ? "Hukdis Sedang" : "Hukdis Berat";
                      return (
                        <optgroup key={kat} label={katLabel}>
                          {items.map((j) => (
                            <option key={j.kode} value={j.kode}>{j.label}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                )}

                {/* Info dampak KGB jika berdampakKGB */}
                {(() => {
                  const sel = jenisKonfig.find((j) => j.kode === hukdisForm.jenisHukdis);
                  if (!sel) return null;
                  return sel.berdampakKGB ? (
                    <div className="mt-1.5 rounded-lg px-3 py-2" style={{ background: "var(--tint-red-bg)", border: "1px solid var(--tint-red-ln)" }}>
                      <p className="text-xs font-semibold" style={{ color: "var(--st-red)" }}>
                        Memblokir KGB: TMT KGB digeser +{sel.durasiTunda ?? 12} bulan otomatis
                      </p>
                    </div>
                  ) : sel.durasiHukdis > 0 ? (
                    <div className="mt-1.5 rounded-lg px-3 py-2" style={{ background: "var(--tint-amber-bg)", border: "1px solid var(--tint-amber-ln)" }}>
                      <p className="text-xs" style={{ color: "var(--st-amber2)" }}>
                        Masa berlaku default: {sel.durasiHukdis} bulan. TMT Berakhir diisi otomatis.
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hukdis-nomor-sk" className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                    Nomor SK <span aria-hidden="true" style={{ color: "var(--st-red)" }}>*</span>
                  </label>
                  <input
                    id="hukdis-nomor-sk"
                    type="text"
                    required
                    value={hukdisForm.nomorSK}
                    onChange={(e) => setHukdisForm((f) => ({ ...f, nomorSK: e.target.value }))}
                    className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                    style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                    placeholder="Nomor SK Hukdis"
                  />
                </div>
                <div>
                  <label htmlFor="hukdis-tanggal-sk" className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                    Tanggal SK <span aria-hidden="true" style={{ color: "var(--st-red)" }}>*</span>
                  </label>
                  <input
                    id="hukdis-tanggal-sk"
                    type="date"
                    required
                    value={hukdisForm.tanggalSK}
                    onChange={(e) => setHukdisForm((f) => ({ ...f, tanggalSK: e.target.value }))}
                    className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                    style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="hukdis-dasar-hukum" className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>Dasar Hukum / Peraturan</label>
                <input
                  id="hukdis-dasar-hukum"
                  type="text"
                  aria-describedby="hukdis-dasar-hukum-petunjuk"
                  value={hukdisForm.dasarHukum}
                  onChange={(e) => setHukdisForm((f) => ({ ...f, dasarHukum: e.target.value }))}
                  className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                  style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  placeholder="mis. PP 94 Tahun 2021"
                />
                <p id="hukdis-dasar-hukum-petunjuk" className="text-xs mt-1" style={{ color: "var(--dt5)", fontSize: "10px" }}>Dikunci pada catatan ini (patokan: tanggal SK Hukdis).</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="hukdis-tmt-mulai" className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                    TMT Mulai <span aria-hidden="true" style={{ color: "var(--st-red)" }}>*</span>
                  </label>
                  <input
                    id="hukdis-tmt-mulai"
                    type="date"
                    required
                    value={hukdisForm.tmtMulai}
                    onChange={(e) => handleTmtMulaiChange(e.target.value)}
                    className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                    style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  />
                </div>
                <div>
                  <label htmlFor="hukdis-tmt-berakhir" className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                    TMT Berakhir <span aria-hidden="true" style={{ color: "var(--st-red)" }}>*</span>
                  </label>
                  <input
                    id="hukdis-tmt-berakhir"
                    type="date"
                    required
                    value={hukdisForm.tmtBerakhir}
                    onChange={(e) => setHukdisForm((f) => ({ ...f, tmtBerakhir: e.target.value }))}
                    className="w-full text-xs rounded-xl px-3 py-2 outline-none"
                    style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="hukdis-keterangan" className="text-xs font-medium block mb-1" style={{ color: "var(--dtn)" }}>
                  Keterangan <span aria-hidden="true" style={{ color: "var(--st-red)" }}>*</span>
                </label>
                <textarea
                  id="hukdis-keterangan"
                  required
                  value={hukdisForm.keterangan}
                  onChange={(e) => setHukdisForm((f) => ({ ...f, keterangan: e.target.value }))}
                  rows={3}
                  className="w-full text-xs rounded-xl px-3 py-2 outline-none resize-none"
                  style={{ border: "0.5px solid var(--ln1)", background: "var(--sub)", color: "var(--dtn)" }}
                  placeholder="Nomor dan isi SK, dasar pelanggaran, keterangan tambahan..."
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowHukdisModal(false)}
                disabled={savingHukdis}
                className="flex-1 text-xs py-2.5 rounded-xl font-semibold"
                style={{ background: "var(--sub)", color: "var(--dt4)" }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveHukdis}
                disabled={savingHukdis}
                className="flex-1 text-xs py-2.5 rounded-xl font-semibold"
                style={{ background: "var(--red-solid)", color: "#fff" }}
              >
                {savingHukdis ? "Menyimpan..." : "Simpan Hukdis"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
