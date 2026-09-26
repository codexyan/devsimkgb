// Usulan data pegawai dari UPT: apa yang boleh diusulkan, bagaimana membandingkannya dengan data
// induk, dan apa yang diterapkan setelah Kanwil menyetujui.
//
// UPT memegang dokumen aslinya (SK KGB terakhir, SK kenaikan pangkat, SK hukuman disiplin), sehingga
// UPT yang menginventarisir datanya. Yang menulis ke data induk tetap Kanwil, lewat tinjauan. Modul ini
// murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";
import { formatTanggalId, tanggalKalender, type NilaiTanggal } from "./waktu";
import { bulanKeKgbBerikutnya, getGajiPokok, getPangkat, isGolonganDikenal, tambahBulan } from "./tabelGaji";

export type StatusUsulan = "draf" | "menunggu" | "revisi" | "disetujui" | "ditolak";

/**
 * Daur hidup usulan. "draf" hanya ada di tangan UPT: belum menjadi dokumen usulan, tidak pernah masuk
 * antrian tinjauan Kanwil, dan boleh disunting atau dihapus sesukanya. Sesudah diajukan barulah ia
 * mengikat.
 *
 * "revisi" adalah usulan terkirim yang dilempar Kanwil kembali ke UPT. Isinya utuh, berkasnya tetap
 * menempel, dan yang berpindah hanya siapa yang memegangnya. Tanpa status ini satu salah ketik menuntut
 * UPT menyusun ulang usulan dari nol beserta seluruh pindaian SK-nya.
 *
 * "ditolak" tidak lagi dihasilkan peninjau: usulan yang memang tidak boleh lanjut dikembalikan dengan
 * catatan agar UPT yang menghapusnya, sebab UPT yang tahu duduk perkaranya. Labelnya tetap ada supaya
 * usulan lama yang telanjur ditolak masih terbaca.
 */
export const STATUS_USULAN: Record<
  StatusUsulan,
  { label: string; nada: "biru" | "kuning" | "hijau" | "merah" | "ungu" }
> = {
  draf: { label: "Disiapkan UPT", nada: "biru" },
  menunggu: { label: "Menunggu tinjauan", nada: "kuning" },
  revisi: { label: "Dikembalikan untuk revisi", nada: "ungu" },
  disetujui: { label: "Disetujui", nada: "hijau" },
  ditolak: { label: "Ditolak", nada: "merah" },
};

/** Status yang isinya masih boleh disunting dan dihapus UPT; keduanya belum ada di meja Kanwil. */
export const DIPEGANG_UPT: readonly string[] = ["draf", "revisi"];

/**
 * Status yang membuat pegawai tidak boleh menerima usulan baru. Satu pegawai hanya boleh punya satu
 * usulan yang belum selesai, supaya antrian tinjauan Kanwil tidak pernah memuat dua versi orang yang sama.
 */
export const BELUM_SELESAI: readonly string[] = ["draf", "menunggu", "revisi"];

export type JenisBidang = "teks" | "tanggal" | "angka" | "rupiah";

/**
 * Kolom pegawai yang boleh diusulkan UPT, urut seperti formulirnya. NIP ikut diusulkan, bukan diubah UPT
 * sendiri: NIP penanda orang, dan Kanwil mencocokkannya dengan SK CPNS sebelum menyetujui.
 */
export const BIDANG_USULAN = [
  { kunci: "nip", label: "NIP", jenis: "teks" },
  { kunci: "nama", label: "Nama lengkap", jenis: "teks" },
  { kunci: "tempatLahir", label: "Tempat lahir", jenis: "teks" },
  { kunci: "tanggalLahir", label: "Tanggal lahir", jenis: "tanggal" },
  { kunci: "jenisKelamin", label: "Jenis kelamin", jenis: "teks" },
  { kunci: "pendidikanTerakhir", label: "Pendidikan terakhir", jenis: "teks" },
  { kunci: "jabatan", label: "Jabatan", jenis: "teks" },
  { kunci: "jenisJabatan", label: "Jenis jabatan", jenis: "teks" },
  { kunci: "eselon", label: "Eselon", jenis: "teks" },
  { kunci: "pangkat", label: "Pangkat", jenis: "teks" },
  { kunci: "golonganRuang", label: "Golongan ruang", jenis: "teks" },
  { kunci: "tmtGolongan", label: "TMT golongan", jenis: "tanggal" },
  { kunci: "mkgTahun", label: "Masa kerja golongan (tahun)", jenis: "angka" },
  { kunci: "mkgBulan", label: "Masa kerja golongan (bulan)", jenis: "angka" },
  { kunci: "gajiPokok", label: "Gaji pokok", jenis: "rupiah" },
  { kunci: "tmtKgbTerakhir", label: "TMT KGB terakhir", jenis: "tanggal" },
  { kunci: "tmtKgbBerikutnya", label: "TMT KGB berikutnya", jenis: "tanggal" },
] as const satisfies readonly { kunci: keyof PegawaiRow & keyof UsulanPegawaiRow; label: string; jenis: JenisBidang }[];

export type KunciBidangUsulan = (typeof BIDANG_USULAN)[number]["kunci"];

/**
 * Kapan sebuah berkas wajib disertakan. Kewajibannya bergantung pada keadaan pegawai, bukan seragam:
 * pegawai yang belum pernah KGB tidak punya SK KGB terakhir, dan memintanya justru membuat operator
 * mengunggah SK pengangkatan PNS ke kolom yang salah.
 */
/**
 * Batas ukuran tiap berkas usulan. Satu lembar SK yang dipindai sebagai dokumen berukuran ratusan kilobyte;
 * yang melampaui satu megabyte hampir selalu foto kamera beresolusi penuh yang dibungkus PDF. Batas ini
 * menahan berkas semacam itu sejak awal, sebab operator UPT mengunggah lewat data seluler dan unggahan
 * besar yang putus di tengah jalan jauh lebih menyakitkan daripada ditolak sejak awal.
 */
export const BATAS_BERKAS_USULAN_BYTE = 1024 * 1024;
export const PESAN_BERKAS_TERLALU_BESAR =
  "Ukuran tiap berkas paling besar 1 MB. Pindai SK sebagai dokumen hitam putih, atau perkecil berkasnya, lalu unggah kembali.";

/**
 * Keadaan yang menentukan berkas mana yang diminta. Pegawai yang sudah pernah KGB dicocokkan dengan SK KGB
 * dan SK kenaikan pangkat terakhirnya; yang belum pernah dengan SK CPNS dan SK pengangkatan PNS-nya.
 * "pengajuan" adalah surat usulan Srikandi, yang diunggah sekali untuk satu surat pada langkah Ajukan.
 */
export type KeadaanBerkas = "pernah_kgb" | "belum_pernah_kgb" | "pengajuan";

/**
 * Berkas dasar yang menyertai usulan. Tim keuangan memintanya agar masa kerja golongan dan gaji pokok
 * dapat dicocokkan dengan dokumen aslinya, bukan dengan ingatan. `medan` adalah nama field pada formulir,
 * `kunci` adalah kolom penyimpan jalur berkasnya. Berkas `wajib` ditagih saat diajukan (kekuranganUsulan).
 */
export const BERKAS_USULAN = [
  {
    medan: "berkas",
    kunci: "pathBerkas",
    label: "Surat usulan Srikandi",
    keterangan:
      "Surat pengantar dari UPT yang sudah dikirim ke Kanwil lewat Srikandi. Diunggah sekali pada langkah Ajukan dan berlaku untuk semua pegawai pada surat itu, jadi tidak ada di formulir tiap pegawai.",
    keadaan: "pengajuan",
    wajib: false,
  },
  {
    medan: "skTerakhir",
    kunci: "pathSkTerakhir",
    label: "SK KGB terakhir",
    keterangan: "SK kenaikan gaji berkala yang terakhir diterima pegawai.",
    keadaan: "pernah_kgb",
    wajib: true,
  },
  {
    medan: "skPangkat",
    kunci: "pathSkPangkat",
    label: "SK kenaikan pangkat terakhir",
    keterangan: "SK kenaikan pangkat yang terakhir diterima. Diperlukan karena kenaikan pangkat memotong masa kerja golongan.",
    keadaan: "pernah_kgb",
    wajib: true,
  },
  {
    medan: "skCpns",
    kunci: "pathSkCpns",
    label: "SK CPNS",
    keterangan:
      "Keputusan pengangkatan CPNS. SK inilah acuan pertama: TMT CPNS awal masa kerja golongan, dan nomor serta tanggalnya diisikan sebagai SK dasar gaji pokok.",
    keadaan: "belum_pernah_kgb",
    wajib: true,
  },
  {
    medan: "syaratCpns",
    kunci: "pathSyaratCpns",
    label: "SK pengangkatan PNS",
    keterangan:
      "Keputusan pengangkatan CPNS menjadi PNS, boleh digabung dengan SPMT dalam satu berkas. Lampirkan bila sudah terbit: KGB pertama dapat jatuh sebelum pegawai diangkat PNS.",
    keadaan: "belum_pernah_kgb",
    wajib: false,
  },
] as const satisfies readonly {
  medan: string;
  kunci: "pathBerkas" | "pathSkTerakhir" | "pathSkCpns" | "pathSyaratCpns" | "pathSkPangkat";
  label: string;
  /** Penjelasan singkat: dokumen apa yang dimaksud dan kapan diperlukan. */
  keterangan: string;
  keadaan: KeadaanBerkas;
  wajib: boolean;
}[];

/**
 * Pegawai sudah pernah KGB bila masa kerja golongannya lebih dari nol. Aturan yang sama dipakai formulir
 * untuk memilih keadaan awalnya, dan tombol "Belum pernah KGB" di sana mengisi masa kerja 0 tahun 0 bulan.
 */
export function pernahKgb(mkgTahun: unknown, mkgBulan: unknown): boolean {
  return Number(mkgTahun ?? 0) > 0 || Number(mkgBulan ?? 0) > 0;
}

/** Berkas yang diminta formulir tiap pegawai untuk satu keadaan, urut seperti di formulir. */
export function berkasUntukKeadaan(pernah: boolean) {
  const keadaan: KeadaanBerkas = pernah ? "pernah_kgb" : "belum_pernah_kgb";
  return BERKAS_USULAN.filter((b) => b.keadaan === keadaan);
}

/**
 * Kolom yang menentukan gaji pokok dan jatuh tempo KGB. Usulan perbaikan yang menyentuh salah satunya
 * harus disertai berkas dasar, sebab angka itulah yang dicocokkan tim keuangan dengan SK aslinya;
 * perbaikan nama atau tempat lahir tidak perlu.
 */
const KOLOM_DASAR_GAJI: readonly KunciBidangUsulan[] = ["golonganRuang", "tmtGolongan", "mkgTahun", "mkgBulan", "tmtKgbTerakhir"];

export const LABEL_JENIS_USULAN: Record<string, string> = {
  perubahan: "Perbaikan data",
  baru: "Pegawai baru",
};

const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);

/** Nilai satu kolom sebagai teks yang dapat dibandingkan dan ditampilkan; kosong menjadi "-". */
export function nilaiTampil(nilai: unknown, jenis: JenisBidang): string {
  if (nilai === null || nilai === undefined || nilai === "") return "-";
  if (jenis === "tanggal") {
    const t = tanggalKalender(nilai as NilaiTanggal);
    return t ? formatTanggalId(t) : "-";
  }
  if (jenis === "rupiah") return rupiah(Number(nilai));
  return String(nilai);
}

export interface PerubahanUsulan {
  kunci: KunciBidangUsulan;
  label: string;
  jenis: JenisBidang;
  sekarang: string;
  diusulkan: string;
}

/**
 * Kolom yang berbeda antara data pegawai sekarang dan usulan UPT. Kolom yang tidak diisi UPT
 * (null) berarti tidak diusulkan berubah, jadi dilewati. Perbandingan memakai bentuk tampilnya,
 * sehingga dua penulisan tanggal yang sama tidak terbaca sebagai perubahan.
 */
export function bandingkanUsulan(pegawai: Partial<PegawaiRow>, usulan: Partial<UsulanPegawaiRow>): PerubahanUsulan[] {
  const hasil: PerubahanUsulan[] = [];
  for (const bidang of BIDANG_USULAN) {
    const diusulkan = usulan[bidang.kunci];
    if (diusulkan === null || diusulkan === undefined || diusulkan === "") continue;
    const sekarang = nilaiTampil(pegawai[bidang.kunci], bidang.jenis);
    const baru = nilaiTampil(diusulkan, bidang.jenis);
    if (sekarang === baru) continue;
    hasil.push({ kunci: bidang.kunci, label: bidang.label, jenis: bidang.jenis, sekarang, diusulkan: baru });
  }
  return hasil;
}

/**
 * Nilai yang diusulkan UPT, apa adanya. Dipakai untuk usulan yang sudah ditinjau: setelah disetujui,
 * data induk sudah sama dengan usulannya, sehingga perbandingan tidak lagi menunjukkan apa pun.
 */
export function nilaiUsulan(usulan: Partial<UsulanPegawaiRow>): { kunci: KunciBidangUsulan; label: string; nilai: string }[] {
  const hasil: { kunci: KunciBidangUsulan; label: string; nilai: string }[] = [];
  for (const bidang of BIDANG_USULAN) {
    const nilai = usulan[bidang.kunci];
    if (nilai === null || nilai === undefined || nilai === "") continue;
    hasil.push({ kunci: bidang.kunci, label: bidang.label, nilai: nilaiTampil(nilai, bidang.jenis) });
  }
  return hasil;
}

/** Nilai yang diterapkan ke data pegawai setelah usulan disetujui; hanya kolom yang memang diisi UPT. */
export function perubahanPegawai(usulan: Partial<UsulanPegawaiRow>): Partial<PegawaiRow> {
  const hasil: Record<string, unknown> = {};
  for (const bidang of BIDANG_USULAN) {
    const nilai = usulan[bidang.kunci];
    if (nilai === null || nilai === undefined || nilai === "") continue;
    hasil[bidang.kunci] = nilai;
  }
  return hasil as Partial<PegawaiRow>;
}

/** Ringkasan laporan hukuman disiplin pada usulan; null bila UPT menyatakan tidak ada. */
export function ringkasHukdisUsulan(usulan: Partial<UsulanPegawaiRow>): string | null {
  if (!usulan.hukdisAda) return null;
  const bagian = [
    usulan.hukdisJenis ? `jenis ${usulan.hukdisJenis}` : null,
    usulan.hukdisNomorSk ? `SK ${usulan.hukdisNomorSk}` : null,
    usulan.hukdisTmtMulai ? `mulai ${nilaiTampil(usulan.hukdisTmtMulai, "tanggal")}` : null,
    usulan.hukdisTmtBerakhir ? `berakhir ${nilaiTampil(usulan.hukdisTmtBerakhir, "tanggal")}` : null,
  ].filter(Boolean);
  return bagian.length > 0 ? bagian.join(", ") : "dilaporkan tanpa rincian";
}

/**
 * Usulan yang tidak mengubah apa pun tidak perlu ditinjau. Laporan hukuman disiplin dihitung sebagai
 * isi, walaupun tidak ada kolom pegawai yang berubah, karena Kanwil tetap perlu menindaklanjutinya.
 */
export function usulanKosong(pegawai: Partial<PegawaiRow>, usulan: Partial<UsulanPegawaiRow>): boolean {
  return bandingkanUsulan(pegawai, usulan).length === 0 && !usulan.hukdisAda;
}

/* ── Hitungan yang tidak boleh diketik UPT ────────────────────────────────────────────────────── */

/**
 * Gaji pokok, pangkat, dan jatuh tempo KGB berikutnya seluruhnya turunan dari golongan, masa kerja
 * golongan, dan TMT KGB terakhir. Ketiganya dihitung di sini, bukan diketik operator, karena salah
 * ketik pada angka ini langsung menggeser uang: kekurangan rapelan atau kelebihan yang harus
 * dikembalikan ke kas negara. Fungsi ini dipakai dua tempat: peramban untuk memperlihatkan hasilnya
 * sambil mengetik, dan rute API sebagai penentu nilai yang benar-benar disimpan.
 */
export interface HitunganUsulan {
  pangkat: string;
  gajiPokok: number;
  tmtKgbBerikutnya: Date | null;
  /** Jarak ke langkah tabel gaji berikutnya; 12 bulan untuk II/a dari MKG 0, umumnya 24 bulan. */
  bulanKeBerikutnya: number;
  /** Hal yang harus dibaca operator sebelum mengirim; kosong bila isiannya masuk akal. */
  peringatan: string[];
  /** Satu kalimat yang menerangkan asal angkanya, untuk ditampilkan di bawah isian. */
  penjelasan: string;
}

function angka(nilai: unknown): number {
  const n = typeof nilai === "string" ? Number(nilai.trim()) : Number(nilai);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function hitungUsulan(isian: {
  golonganRuang?: string | null;
  mkgTahun?: number | string | null;
  mkgBulan?: number | string | null;
  tmtKgbTerakhir?: NilaiTanggal;
}): HitunganUsulan {
  const golongan = (isian.golonganRuang ?? "").trim();
  const mkgTahun = angka(isian.mkgTahun);
  const mkgBulan = angka(isian.mkgBulan);
  const tmtTerakhir = tanggalKalender(isian.tmtKgbTerakhir);
  const peringatan: string[] = [];

  if (!golongan) {
    return {
      pangkat: "", gajiPokok: 0, tmtKgbBerikutnya: null, bulanKeBerikutnya: 0,
      peringatan: ["Golongan/ruang belum diisi, sehingga gaji pokok dan jatuh tempo KGB belum dapat dihitung."],
      penjelasan: "",
    };
  }
  if (!isGolonganDikenal(golongan)) {
    return {
      pangkat: "", gajiPokok: 0, tmtKgbBerikutnya: null, bulanKeBerikutnya: 0,
      peringatan: [`Golongan "${golongan}" tidak ada pada tabel gaji PP 5/2024.`],
      penjelasan: "",
    };
  }
  if (mkgBulan > 11) peringatan.push("Masa kerja golongan bagian bulan mestinya 0 sampai 11; sisanya dihitung sebagai tahun.");

  const gajiPokok = getGajiPokok(golongan, mkgTahun, mkgBulan);
  if (gajiPokok === 0) {
    // Mis. II/c dengan MKG 0: golongan itu tidak pernah menjadi pangkat pengangkatan pertama, sehingga
    // tabelnya memang tidak punya barisnya. Dulu keadaan ini lolos diam-diam sebagai gaji pokok nol.
    peringatan.push(
      `Golongan ${golongan} dengan masa kerja ${mkgTahun} tahun ${mkgBulan} bulan tidak ada pada tabel PP 5/2024. ` +
      "Periksa kembali masa kerja golongan pada SK; angka ini menentukan gaji pokoknya.",
    );
  }

  const bulanKeBerikutnya = bulanKeKgbBerikutnya(golongan, mkgTahun, mkgBulan);
  const tmtKgbBerikutnya = tmtTerakhir ? tambahBulan(tmtTerakhir, bulanKeBerikutnya) : null;
  if (!tmtTerakhir) peringatan.push("TMT KGB terakhir belum diisi, sehingga jatuh tempo KGB berikutnya belum dapat dihitung.");

  const penjelasan = [
    `${golongan} · masa kerja ${mkgTahun} tahun ${mkgBulan} bulan → gaji pokok ${gajiPokok > 0 ? rupiah(gajiPokok) : "belum dapat dihitung"} menurut PP 5/2024.`,
    tmtKgbBerikutnya
      ? `KGB berikutnya ${bulanKeBerikutnya} bulan setelah ${nilaiTampil(tmtTerakhir, "tanggal")}, yaitu ${nilaiTampil(tmtKgbBerikutnya, "tanggal")}.`
      : `Jarak ke KGB berikutnya ${bulanKeBerikutnya} bulan dari TMT KGB terakhir.`,
  ].join(" ");

  return { pangkat: getPangkat(golongan), gajiPokok, tmtKgbBerikutnya, bulanKeBerikutnya, peringatan, penjelasan };
}

/**
 * Apa yang masih kurang sebelum sebuah draf boleh diajukan ke Kanwil. Draf sengaja boleh disimpan
 * setengah jadi (itu gunanya draf), sehingga pemeriksaan kelengkapan dilakukan di sini, sekali, pada
 * saat pengajuan. Daftar yang kosong berarti siap diajukan.
 */
export function kekuranganUsulan(
  usulan: Partial<UsulanPegawaiRow>,
  jenis: string,
  pegawai?: Partial<PegawaiRow> | null,
): string[] {
  const kurang: string[] = [];
  const nilai = <K extends keyof PegawaiRow & keyof UsulanPegawaiRow>(kunci: K) =>
    (usulan[kunci] ?? pegawai?.[kunci] ?? null) as PegawaiRow[K] | null;

  if (jenis === "baru") {
    if (!String(usulan.nama ?? "").trim()) kurang.push("nama lengkap");
    if (!/^\d{18}$/.test(String(usulan.nip ?? "").trim())) kurang.push("NIP 18 digit");
    if (!String(usulan.jabatan ?? "").trim()) kurang.push("jabatan");
  }

  const golongan = String(nilai("golonganRuang") ?? "").trim();
  if (!golongan) kurang.push("golongan/ruang");
  if (!tanggalKalender(nilai("tmtKgbTerakhir"))) kurang.push("TMT KGB terakhir");

  const hitung = hitungUsulan({
    golonganRuang: golongan,
    mkgTahun: nilai("mkgTahun"),
    mkgBulan: nilai("mkgBulan"),
    tmtKgbTerakhir: nilai("tmtKgbTerakhir"),
  });
  if (golongan && hitung.gajiPokok === 0) {
    kurang.push(`masa kerja golongan yang cocok dengan tabel PP 5/2024 untuk golongan ${golongan}`);
  }

  const perluBerkas =
    jenis === "baru" || (!!pegawai && bandingkanUsulan(pegawai, usulan).some((p) => KOLOM_DASAR_GAJI.includes(p.kunci)));
  if (perluBerkas) {
    for (const b of berkasUntukKeadaan(pernahKgb(nilai("mkgTahun"), nilai("mkgBulan")))) {
      if (b.wajib && !usulan[b.kunci]) kurang.push(b.label);
    }
  }
  return kurang;
}

// Nama asli berkas usulan disimpan di kunci objek R2 (tanpa kolom baru), disandikan base64url karena kunci
// hanya boleh memuat huruf, angka, titik, garis bawah, dan tanda hubung (lib/berkasSk.ts). Kunci lama tanpa
// bagian ini tetap berlaku; namanya saja yang tidak diketahui.
const POLA_KUNCI_BERNAMA = /^usulan\/[^_/]+_[^_/]+_\d+_n-([A-Za-z0-9_-]+)\.pdf$/;

function keBase64Url(teks: string): string {
  let biner = "";
  for (const b of new TextEncoder().encode(teks)) biner += String.fromCharCode(b);
  return btoa(biner).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function dariBase64Url(sandi: string): string | null {
  try {
    const biner = atob(sandi.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(biner, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** Kunci objek R2 untuk satu berkas usulan, memuat nama aslinya (dipangkas 100 karakter). */
export function kunciBerkasUsulan(kode: string, medan: string, waktu: number, namaAsli: string): string {
  const nama = namaAsli.trim().slice(0, 100);
  return nama ? `usulan/${kode}_${medan}_${waktu}_n-${keBase64Url(nama)}.pdf` : `usulan/${kode}_${medan}_${waktu}.pdf`;
}

/** Nama asli berkas dari kuncinya; null untuk kunci lama yang tidak memuatnya. */
export function namaAsliBerkas(kunci: string | null | undefined): string | null {
  const cocok = POLA_KUNCI_BERNAMA.exec(kunci ?? "");
  return cocok ? dariBase64Url(cocok[1]) : null;
}
