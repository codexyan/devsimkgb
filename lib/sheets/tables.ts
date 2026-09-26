// Definisi tab Google Sheets = padanan tabel database. Setiap tab punya baris
// header persis nama kolom di bawah (urutan dicocokkan by-name saat baca; saat
// TULIS bersifat posisional, jadi header WAJIB urut sesuai definisi kolom).
// Kolom baru selalu ditambahkan di UJUNG daftar agar data lama tidak bergeser.
//
// Skrip scripts/setup-sheets.ts membuat tab yang belum ada beserta header-nya.

import { Table, type ColumnDef, type TableDef } from "./table";
import { newId } from "./id";
import type { PenandatanganRow } from "../penandatangan";

// ---- helper ringkas untuk mendefinisikan kolom ----
const s = (name: string): ColumnDef => ({ name, type: "string" });
const i = (name: string): ColumnDef => ({ name, type: "int" });
const b = (name: string): ColumnDef => ({ name, type: "boolean" });
const d = (name: string): ColumnDef => ({ name, type: "datetime" });

// ============================ Tipe baris (yang sering dipakai) ============================

export interface UserRow {
  id: string; nip: string; password: string; nama: string;
  jabatan: string | null; email: string | null; role: string; createdAt: Date | null;
  /** Kode satker (lib/satker.ts) untuk peran admin_upt; kosong untuk peran Kanwil. */
  satker: string | null;
}

export interface PegawaiRow {
  id: string; nip: string; nama: string; tempatLahir: string | null;
  tanggalLahir: Date | null; jenisKelamin: string | null; pendidikanTerakhir: string | null;
  jabatan: string; pangkat: string; golonganRuang: string; unitKerja: string;
  eselon: string | null; jenisJabatan: string | null; tmtGolongan: Date | null;
  mkgTahun: number; mkgBulan: number; gajiPokok: number; tmtKgbTerakhir: Date | null;
  tmtKgbBerikutnya: Date | null; statusHukdis: boolean; tanggalHukdisBerakhir: Date | null;
  jenisHukdis: string | null; keteranganHukdis: string | null; aktif: boolean;
  createdAt: Date | null; updatedAt: Date | null;
  /** Konfirmasi data oleh admin UPT untuk satu siklus KGB: TMT yang dikonfirmasi, waktunya, dan pelakunya. */
  konfirmasiUptTmt: Date | null; konfirmasiUptAt: Date | null; konfirmasiUptOleh: string | null;
  /**
   * Keadaan mutasi yang berlaku (lib/mutasiPegawai.ts). satkerTugas hanya keterangan tempat bertugas
   * pegawai BKO; unit kerja dan KPPN tetap di satker asal. berhentiTmt menentukan hak KGB: KGB yang
   * TMT-nya sebelum tanggal itu tetap sah diproses.
   */
  satkerTugas: string | null; berhentiTmt: Date | null; berhentiAlasan: string | null;
}

/** Satu kenaikan pangkat: dasar SK-nya dan dampaknya pada MKG serta gaji pokok (lib/kenaikanPangkat.ts). */
export interface RiwayatPangkatRow {
  id: string; pegawaiId: string; jenisKp: string; nomorSK: string; tanggalSK: Date | null;
  tmtPangkat: Date | null; golonganLama: string; golonganBaru: string;
  mkgTahunLama: number; mkgBulanLama: number; mkgTahunBaru: number; mkgBulanBaru: number;
  gajiPokokLama: number; gajiPokokBaru: number; keterangan: string | null;
  createdAt: Date | null; createdBy: string | null;
}

/**
 * Laporan perpindahan atau pemberhentian dari UPT, sebelum ditetapkan Kanwil (lib/laporanMutasi.ts).
 * Satker yang paling dulu tahu pegawainya pindah atau berhenti; yang menetapkan tetap Kanwil.
 */
export interface LaporanMutasiRow {
  id: string; pegawaiId: string; satker: string; jenis: string;
  satkerTujuan: string | null; tmt: Date | null; nomorSK: string | null; tanggalSK: Date | null;
  alasan: string | null; keterangan: string | null;
  status: string; catatanKanwil: string | null;
  dilaporkanOleh: string | null; dilaporkanAt: Date | null;
  ditinjauOleh: string | null; ditinjauAt: Date | null;
  /** Baris riwayat mutasi yang terbit dari laporan ini; null selama belum diterima. */
  riwayatId: string | null;
}

/** Satu perpindahan atau pemberhentian pegawai beserta dasar SK-nya (lib/mutasiPegawai.ts). */
export interface RiwayatMutasiRow {
  id: string; pegawaiId: string; jenis: string;
  satkerAsal: string | null; satkerTujuan: string | null;
  tmt: Date | null; nomorSK: string | null; tanggalSK: Date | null;
  alasan: string | null; keterangan: string | null;
  createdAt: Date | null; createdBy: string | null;
}

export interface RiwayatKGBRow {
  id: string; pegawaiId: string; nomorSK: string; tanggalSK: Date | null; tmtSK: Date | null;
  golonganLama: string; gajiPokokLama: number; mkgTahunLama: number; mkgBulanLama: number;
  golonganBaru: string; gajiPokokBaru: number; mkgTahunBaru: number; mkgBulanBaru: number;
  tmtKgbBaru: Date | null; tmtKgbBerikutnya: Date | null; status: string;
  flagRapelan: boolean; isArsip: boolean; konfirmasiKeuanganAt: Date | null;
  konfirmasiKeuanganBy: string | null; rapelanDitetapkan: boolean | null;
  inputGajiWebAt: Date | null; inputGajiWebBy: string | null; createdBy: string; createdAt: Date | null;
  /** Pejabat yang menetapkan SK dasar; dicetak pada baris "Oleh" di surat KGB. */
  penetapSkDasar: string | null;
}

/**
 * Satu usulan data pegawai dari UPT. Nilai yang diusulkan disimpan lengkap, lalu dibandingkan dengan
 * data pegawai saat ditinjau (lib/usulanPegawai.ts). Kolom kosong berarti UPT tidak mengusulkan
 * perubahan pada kolom itu. Laporan hukuman disiplin ikut di sini karena UPT yang memegang SK-nya.
 */
export interface UsulanPegawaiRow {
  id: string;
  /** Kosong pada usulan pegawai baru, terisi setelah usulannya disetujui. */
  pegawaiId: string | null;
  satker: string; status: string;
  /** "perubahan" untuk pegawai yang sudah tercatat, "baru" untuk pegawai yang diusulkan UPT. */
  jenis: string;
  /** Hanya pada usulan pegawai baru; pegawai lama dikenali dari pegawaiId. */
  nip: string | null; unitKerja: string | null;
  /** Nomor surat usulan; kosong selama masih draf, diisi sekali saat pengajuan. */
  nomorSurat: string | null; tanggalSurat: Date | null;
  /** Berkas dasar: surat usulan Srikandi, SK KGB terakhir, syarat pengangkatan PNS, SK kenaikan pangkat. */
  pathBerkas: string | null; pathSkTerakhir: string | null;
  pathSyaratCpns: string | null; pathSkPangkat: string | null;
  nama: string | null; tempatLahir: string | null; tanggalLahir: Date | null; jenisKelamin: string | null;
  pendidikanTerakhir: string | null; jabatan: string | null; pangkat: string | null; golonganRuang: string | null;
  eselon: string | null; jenisJabatan: string | null; tmtGolongan: Date | null;
  mkgTahun: number | null; mkgBulan: number | null; gajiPokok: number | null;
  tmtKgbTerakhir: Date | null; tmtKgbBerikutnya: Date | null;
  nomorSkTerakhir: string | null; tanggalSkTerakhir: Date | null;
  hukdisAda: boolean; hukdisJenis: string | null; hukdisNomorSk: string | null;
  hukdisTmtMulai: Date | null; hukdisTmtBerakhir: Date | null; hukdisKeterangan: string | null;
  catatanUpt: string | null;
  diajukanOleh: string; diajukanAt: Date | null;
  ditinjauOleh: string | null; ditinjauAt: Date | null; alasanTolak: string | null;
  /** SK pengangkatan CPNS: acuan pertama (SK dasar) bagi pegawai yang belum pernah KGB. */
  pathSkCpns: string | null;
}

export interface AuditLogRow {
  id: string; waktu: Date | null; aksi: string; detail: string;
  targetNama: string | null; ipAddress: string | null; userId: string | null;
}

export interface NotifikasiRow {
  id: string; judul: string; pesan: string; tipe: string; referenceId: string | null;
  dibaca: boolean; createdAt: Date | null; prioritas: string; linkHref: string | null; kategori: string | null;
}

export type { PenandatanganRow };

// ============================ Definisi kolom per tab ============================

export const defs = {
  User: {
    tab: "User",
    columns: [s("id"), s("nip"), s("password"), s("nama"), s("jabatan"), s("email"), s("role"), d("createdAt"), s("satker")],
  },
  ProfileChangeRequest: {
    tab: "ProfileChangeRequest",
    columns: [s("id"), s("userId"), s("nama"), s("jabatan"), s("email"), s("status"), s("alasanTolak"), d("createdAt"), d("reviewedAt"), s("reviewedBy")],
  },
  Pegawai: {
    tab: "Pegawai",
    columns: [
      s("id"), s("nip"), s("nama"), s("tempatLahir"), d("tanggalLahir"), s("jenisKelamin"),
      s("pendidikanTerakhir"), s("jabatan"), s("pangkat"), s("golonganRuang"), s("unitKerja"),
      s("eselon"), s("jenisJabatan"), d("tmtGolongan"), i("mkgTahun"), i("mkgBulan"), i("gajiPokok"),
      d("tmtKgbTerakhir"), d("tmtKgbBerikutnya"), b("statusHukdis"), d("tanggalHukdisBerakhir"),
      s("jenisHukdis"), s("keteranganHukdis"), b("aktif"), d("createdAt"), d("updatedAt"),
      d("konfirmasiUptTmt"), d("konfirmasiUptAt"), s("konfirmasiUptOleh"),
      s("satkerTugas"), d("berhentiTmt"), s("berhentiAlasan"),
    ],
  },
  UsulanPegawai: {
    tab: "UsulanPegawai",
    columns: [
      s("id"), s("pegawaiId"), s("satker"), s("status"), s("jenis"), s("nip"), s("unitKerja"),
      s("nomorSurat"), d("tanggalSurat"),
      s("pathBerkas"), s("pathSkTerakhir"), s("pathSyaratCpns"), s("pathSkPangkat"),
      s("nama"), s("tempatLahir"), d("tanggalLahir"), s("jenisKelamin"),
      s("pendidikanTerakhir"), s("jabatan"), s("pangkat"), s("golonganRuang"),
      s("eselon"), s("jenisJabatan"), d("tmtGolongan"),
      i("mkgTahun"), i("mkgBulan"), i("gajiPokok"),
      d("tmtKgbTerakhir"), d("tmtKgbBerikutnya"),
      s("nomorSkTerakhir"), d("tanggalSkTerakhir"),
      b("hukdisAda"), s("hukdisJenis"), s("hukdisNomorSk"),
      d("hukdisTmtMulai"), d("hukdisTmtBerakhir"), s("hukdisKeterangan"),
      s("catatanUpt"),
      s("diajukanOleh"), d("diajukanAt"),
      s("ditinjauOleh"), d("ditinjauAt"), s("alasanTolak"),
      // Ditambahkan kemudian; penulisan baris posisional, jadi kolom baru selalu di ujung kanan.
      s("pathSkCpns"),
    ],
  },
  RiwayatKGB: {
    tab: "RiwayatKGB",
    columns: [
      s("id"), s("pegawaiId"), s("nomorSK"), d("tanggalSK"), d("tmtSK"), s("golonganLama"),
      i("gajiPokokLama"), i("mkgTahunLama"), i("mkgBulanLama"), s("golonganBaru"), i("gajiPokokBaru"),
      i("mkgTahunBaru"), i("mkgBulanBaru"), d("tmtKgbBaru"), d("tmtKgbBerikutnya"), s("status"),
      b("flagRapelan"), b("isArsip"), d("konfirmasiKeuanganAt"), s("konfirmasiKeuanganBy"),
      b("rapelanDitetapkan"), d("inputGajiWebAt"), s("inputGajiWebBy"), s("createdBy"), d("createdAt"),
      s("penetapSkDasar"),
    ],
  },
  SuratKGB: {
    tab: "SuratKGB",
    // namaKepalaKanwil/nipKepalaKanwil menyimpan salinan penandatangan (siapa pun jenisnya).
    columns: [
      s("id"), s("kgbId"), s("nomorSurat"), d("tanggalSurat"), s("namaKepalaKanwil"), s("nipKepalaKanwil"),
      s("pathFile"), d("generatedAt"), s("generatedBy"),
      s("penandatanganId"), s("jenisPenandatangan"), s("jabatanPenandatangan"),
    ],
  },
  SerahTerima: {
    tab: "SerahTerima",
    columns: [s("id"), s("kgbId"), s("namaAdmin"), s("keterangan"), d("tanggalSerahTerima"), s("createdBy")],
  },
  KonfigurasiKanwil: {
    tab: "KonfigurasiKanwil",
    // namaKepala/nipKepala tidak dipakai lagi (pindah ke tab Penandatangan), tetapi kolomnya
    // tetap ada karena penulisan posisional. batasInputSdm: tanggal batas input Tim SDM (lib/batasInputSdm.ts).
    // kppnSatker: JSON penyesuaian KPPN mitra per satker (lib/kppnSatker.ts).
    columns: [s("id"), s("namaKepala"), s("nipKepala"), s("nomorPP"), s("tahunPP"), s("waAdmin"), i("notifKgbH1"), i("notifKgbH2"), i("sesiTimeoutMenit"), d("updatedAt"), s("updatedBy"), i("batasInputSdm"), s("kppnSatker")],
  },
  Penandatangan: {
    tab: "Penandatangan",
    columns: [s("id"), s("jenis"), s("nama"), s("nip"), s("jabatan"), s("dasarPenunjukan"), d("berlakuMulai"), d("berlakuSampai"), d("updatedAt"), s("updatedBy")],
  },
  Notifikasi: {
    tab: "Notifikasi",
    columns: [s("id"), s("judul"), s("pesan"), s("tipe"), s("referenceId"), b("dibaca"), d("createdAt"), s("prioritas"), s("linkHref"), s("kategori")],
  },
  RiwayatMutasi: {
    tab: "RiwayatMutasi",
    columns: [
      s("id"), s("pegawaiId"), s("jenis"), s("satkerAsal"), s("satkerTujuan"),
      d("tmt"), s("nomorSK"), d("tanggalSK"), s("alasan"), s("keterangan"),
      d("createdAt"), s("createdBy"),
    ],
  },
  LaporanMutasi: {
    tab: "LaporanMutasi",
    columns: [
      s("id"), s("pegawaiId"), s("satker"), s("jenis"), s("satkerTujuan"),
      d("tmt"), s("nomorSK"), d("tanggalSK"), s("alasan"), s("keterangan"),
      s("status"), s("catatanKanwil"), s("dilaporkanOleh"), d("dilaporkanAt"),
      s("ditinjauOleh"), d("ditinjauAt"), s("riwayatId"),
    ],
  },
  RiwayatPangkat: {
    tab: "RiwayatPangkat",
    columns: [
      s("id"), s("pegawaiId"), s("jenisKp"), s("nomorSK"), d("tanggalSK"), d("tmtPangkat"),
      s("golonganLama"), s("golonganBaru"), i("mkgTahunLama"), i("mkgBulanLama"),
      i("mkgTahunBaru"), i("mkgBulanBaru"), i("gajiPokokLama"), i("gajiPokokBaru"),
      s("keterangan"), d("createdAt"), s("createdBy"),
    ],
  },
  RiwayatHukdis: {
    tab: "RiwayatHukdis",
    columns: [s("id"), s("pegawaiId"), s("jenisHukdis"), s("nomorSK"), d("tanggalSK"), d("tmtMulai"), d("tmtBerakhir"), b("berdampakKGB"), i("durasiTunda"), s("dasarHukum"), s("keterangan"), d("createdAt"), s("createdBy")],
  },
  HukdisJenis: {
    tab: "HukdisJenis",
    columns: [s("id"), s("kode"), s("label"), s("kategori"), s("dasarHukum"), s("regulasiId"), i("durasiHukdis"), b("berdampakKGB"), i("durasiTunda"), b("aktif"), i("urutan"), d("updatedAt"), s("updatedBy")],
  },
  HukdisKonfigurasi: {
    tab: "HukdisKonfigurasi",
    columns: [s("id"), i("notifHariH1"), i("notifHariH2"), d("updatedAt"), s("updatedBy")],
  },
  Regulasi: {
    tab: "Regulasi",
    columns: [s("id"), s("nomor"), s("tahun"), s("tentang"), s("status"), s("pasalBerlaku"), s("digantikanOlehId"), s("catatan"), i("urutan"), d("createdAt"), d("updatedAt"), s("updatedBy")],
  },
  AuditLog: {
    tab: "AuditLog",
    columns: [s("id"), d("waktu"), s("aksi"), s("detail"), s("targetNama"), s("ipAddress"), s("userId")],
  },
  RekonBulanan: {
    tab: "RekonBulanan",
    columns: [s("id"), s("bulanTmt"), d("tanggalInput"), s("inputBy"), i("jumlahData"), s("catatan"), d("createdAt")],
  },
} satisfies Record<string, TableDef>;

// ============================ Instance repository ============================

export const sheets = {
  user: new Table<UserRow>(defs.User),
  profileChangeRequest: new Table(defs.ProfileChangeRequest),
  pegawai: new Table<PegawaiRow>(defs.Pegawai),
  riwayatKGB: new Table<RiwayatKGBRow>(defs.RiwayatKGB),
  suratKGB: new Table(defs.SuratKGB),
  serahTerima: new Table(defs.SerahTerima),
  konfigurasiKanwil: new Table(defs.KonfigurasiKanwil),
  penandatangan: new Table<PenandatanganRow>(defs.Penandatangan),
  notifikasi: new Table<NotifikasiRow>(defs.Notifikasi),
  riwayatHukdis: new Table(defs.RiwayatHukdis),
  riwayatPangkat: new Table<RiwayatPangkatRow>(defs.RiwayatPangkat),
  riwayatMutasi: new Table<RiwayatMutasiRow>(defs.RiwayatMutasi),
  laporanMutasi: new Table<LaporanMutasiRow>(defs.LaporanMutasi),
  usulanPegawai: new Table<UsulanPegawaiRow>(defs.UsulanPegawai),
  hukdisJenis: new Table(defs.HukdisJenis),
  hukdisKonfigurasi: new Table(defs.HukdisKonfigurasi),
  regulasi: new Table(defs.Regulasi),
  auditLog: new Table<AuditLogRow>(defs.AuditLog),
  rekonBulanan: new Table(defs.RekonBulanan),
};

/** Bangun satu baris RiwayatKGB dengan default untuk field opsional/audit. */
export function makeRiwayatKGB(p: Partial<RiwayatKGBRow>): RiwayatKGBRow {
  return {
    id: p.id ?? newId(),
    pegawaiId: p.pegawaiId ?? "",
    nomorSK: p.nomorSK ?? "",
    tanggalSK: p.tanggalSK ?? null,
    tmtSK: p.tmtSK ?? null,
    golonganLama: p.golonganLama ?? "",
    gajiPokokLama: p.gajiPokokLama ?? 0,
    mkgTahunLama: p.mkgTahunLama ?? 0,
    mkgBulanLama: p.mkgBulanLama ?? 0,
    golonganBaru: p.golonganBaru ?? "",
    gajiPokokBaru: p.gajiPokokBaru ?? 0,
    mkgTahunBaru: p.mkgTahunBaru ?? 0,
    mkgBulanBaru: p.mkgBulanBaru ?? 0,
    tmtKgbBaru: p.tmtKgbBaru ?? null,
    tmtKgbBerikutnya: p.tmtKgbBerikutnya ?? null,
    status: p.status ?? "belum_diproses",
    flagRapelan: p.flagRapelan ?? false,
    isArsip: p.isArsip ?? false,
    konfirmasiKeuanganAt: p.konfirmasiKeuanganAt ?? null,
    konfirmasiKeuanganBy: p.konfirmasiKeuanganBy ?? null,
    rapelanDitetapkan: p.rapelanDitetapkan ?? null,
    inputGajiWebAt: p.inputGajiWebAt ?? null,
    inputGajiWebBy: p.inputGajiWebBy ?? null,
    createdBy: p.createdBy ?? "",
    createdAt: p.createdAt ?? new Date(),
    penetapSkDasar: p.penetapSkDasar ?? null,
  };
}

export const ALL_DEFS: TableDef[] = Object.values(defs);

/** Semua tab wajib ada (dipakai health-check & setup). */
export const REQUIRED_TABS = ALL_DEFS.map((def) => def.tab);

/** Header yang diharapkan per tab (untuk membuat tab baru saat setup). */
export const TAB_HEADERS: Record<string, string[]> = Object.fromEntries(
  ALL_DEFS.map((def) => [def.tab, def.columns.map((c) => c.name)]),
);
