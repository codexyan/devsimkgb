// Usulan data pegawai dari UPT: apa yang boleh diusulkan, bagaimana membandingkannya dengan data
// induk, dan apa yang diterapkan setelah Kanwil menyetujui.
//
// UPT memegang dokumen aslinya (SK KGB terakhir, SK kenaikan pangkat, SK hukuman disiplin), sehingga
// UPT yang menginventarisir datanya. Yang menulis ke data induk tetap Kanwil, lewat tinjauan. Modul ini
// murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";
import { formatTanggalId, tanggalKalender, type NilaiTanggal } from "./waktu";

export type StatusUsulan = "menunggu" | "disetujui" | "ditolak";

export const STATUS_USULAN: Record<StatusUsulan, { label: string; nada: "kuning" | "hijau" | "merah" }> = {
  menunggu: { label: "Menunggu tinjauan", nada: "kuning" },
  disetujui: { label: "Disetujui", nada: "hijau" },
  ditolak: { label: "Ditolak", nada: "merah" },
};

export type JenisBidang = "teks" | "tanggal" | "angka" | "rupiah";

/** Kolom pegawai yang boleh diusulkan UPT, urut seperti formulirnya. */
export const BIDANG_USULAN = [
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
 * Berkas dasar yang menyertai usulan. Tim keuangan meminta ketiga berkas selain suratnya agar masa
 * kerja golongan dan gaji pokok dapat dicocokkan dengan dokumen aslinya, bukan dengan ingatan.
 * `medan` adalah nama field pada formulir, `kunci` adalah kolom penyimpan jalur berkasnya.
 */
export const BERKAS_USULAN = [
  { medan: "berkas", kunci: "pathBerkas", label: "Surat usulan Srikandi", wajibUntuk: "semua" },
  { medan: "skTerakhir", kunci: "pathSkTerakhir", label: "SK KGB terakhir", wajibUntuk: "semua" },
  { medan: "syaratCpns", kunci: "pathSyaratCpns", label: "Syarat pengangkatan PNS", wajibUntuk: "cpns" },
  { medan: "skPangkat", kunci: "pathSkPangkat", label: "SK kenaikan pangkat terakhir", wajibUntuk: "pernah_naik_pangkat" },
] as const satisfies readonly {
  medan: string;
  kunci: "pathBerkas" | "pathSkTerakhir" | "pathSyaratCpns" | "pathSkPangkat";
  label: string;
  wajibUntuk: string;
}[];

export const LABEL_JENIS_USULAN: Record<string, string> = {
  perubahan: "Perbaikan data",
  baru: "Pegawai baru",
};

const rupiah = (n: number) => "Rp" + new Intl.NumberFormat("id-ID").format(n);

/** Nilai satu kolom sebagai teks yang dapat dibandingkan dan ditampilkan; kosong menjadi "—". */
export function nilaiTampil(nilai: unknown, jenis: JenisBidang): string {
  if (nilai === null || nilai === undefined || nilai === "") return "—";
  if (jenis === "tanggal") {
    const t = tanggalKalender(nilai as NilaiTanggal);
    return t ? formatTanggalId(t) : "—";
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
