// Langkah isian data pegawai Admin UPT (ADR-083), sama di formulir per pegawai (Tambah pegawai, Perbarui data) dan di
// Usul KGB Kolektif: 1 Identitas, 2 Jabatan, 3 Jenis KGB, 4 SK sesudahnya, 5 Periksa & simpan. Urutannya mengikuti skema
// Admin UPT pengguna; berkas ikut langkah yang memintanya (SK KGB terakhir atau SK CPNS di langkah 3, SK kenaikan pangkat
// atau PMK di langkah 4). Murni, supaya kedua tempat memakai aturan kelengkapan yang sama dan dapat diuji.

export const LANGKAH_ISIAN = [
  { n: 1, judul: "Identitas", ket: "NIP, nama, tempat dan tanggal lahir, jenis kelamin, pendidikan terakhir" },
  { n: 2, judul: "Jabatan", ket: "Jabatan terbaru, jenis jabatan, dan eselon" },
  { n: 3, judul: "Jenis KGB", ket: "Sudah pernah KGB (dasar SK KGB terakhir) atau belum pernah (CPNS baru, dasar SK CPNS)" },
  { n: 4, judul: "SK sesudahnya", ket: "Kenaikan pangkat, penyesuaian ijazah, atau PMK sesudah SK acuan" },
  { n: 5, judul: "Periksa & simpan", ket: "Yang masih kurang, catatan untuk Kanwil, dan pratinjau SK KGB" },
] as const;

export type NomorLangkah = 1 | 2 | 3 | 4 | 5;

/** Satu syarat kelengkapan dan langkah tempat mengisinya. */
export interface CekIsian {
  langkah: 1 | 2 | 3 | 4;
  ok: boolean;
  label: string;
}

export type KeadaanLangkah = "lengkap" | "kurang";

/** Syarat kelengkapan satu pegawai, ditandai langkahnya. */
export function cekIsianPegawai(i: {
  jenis: string;
  nama: string;
  nip: string;
  jabatan: string;
  pernah: boolean;
  golongan: string;
  mkgTahun: string;
  /** TMT KGB terakhir, atau TMT CPNS bagi yang belum pernah KGB. */
  tmtAcuan: string;
  nomorSkAcuan: string;
  tanggalSkAcuan: string;
  /** Pejabat penetap SK acuan: baris "Oleh" SK KGB berikutnya (ADR-086). */
  penetapSkAcuan: string;
  /** Jawaban "ada SK sesudah SK acuan?"; null bila belum dijawab. */
  jawaban: "ada" | "tidak" | null;
  perluSebab: boolean;
  /** Kekurangan isian SK yang dilaporkan atau sebab koreksi (kekuranganDasarBaru). */
  kurangDasar: readonly string[];
  dasarJenis: string;
  golonganSk: string;
  mkgTahunSk: string;
  /** Pesan bila hitungan sesudah SK tidak dapat dijalankan. */
  galatSesudahSk: string | null;
  /** Berkas wajib beserta langkahnya dan ada tidaknya. */
  berkas: readonly { label: string; langkah: 3 | 4; ada: boolean }[];
}): CekIsian[] {
  const c: CekIsian[] = [];
  // Identitas dan jabatan hanya wajib pada pegawai baru; pada perbaikan, isian kosong berarti tidak diusulkan berubah.
  if (i.jenis === "baru") {
    c.push({ langkah: 1, ok: !!i.nama.trim(), label: "nama lengkap" });
    c.push({ langkah: 1, ok: /^\d{18}$/.test(i.nip.trim()), label: "NIP 18 digit" });
    c.push({ langkah: 2, ok: !!i.jabatan.trim(), label: "jabatan" });
  }
  const acuan = i.pernah ? "SK KGB terakhir" : "SK CPNS";
  c.push({ langkah: 3, ok: !!i.golongan, label: "golongan" });
  if (i.pernah) c.push({ langkah: 3, ok: /^\d+$/.test(i.mkgTahun), label: "masa kerja" });
  c.push({ langkah: 3, ok: !!i.tmtAcuan, label: i.pernah ? "TMT KGB terakhir" : "TMT CPNS" });
  c.push({ langkah: 3, ok: !!i.nomorSkAcuan.trim(), label: `nomor ${acuan}` });
  c.push({ langkah: 3, ok: !!i.tanggalSkAcuan, label: `tanggal ${acuan}` });
  c.push({ langkah: 3, ok: !!i.penetapSkAcuan.trim(), label: `pejabat penetap ${acuan}` });
  c.push({ langkah: 4, ok: !!i.jawaban, label: `jawaban SK sesudah ${acuan}` });
  if (i.jawaban === "ada" || (i.jawaban === "tidak" && i.perluSebab))
    c.push({
      langkah: 4,
      ok: i.kurangDasar.length === 0,
      label: i.jawaban === "ada" ? "isian SK yang dilaporkan" : "sebab golongan atau masa kerja berubah",
    });
  if (i.jawaban === "ada") {
    if (i.dasarJenis === "kp") c.push({ langkah: 4, ok: !!i.golonganSk, label: "golongan baru menurut SK kenaikan pangkat" });
    c.push({
      langkah: 4,
      ok: i.mkgTahunSk !== "",
      label: i.dasarJenis === "kp" ? "masa kerja golongan menurut SK kenaikan pangkat" : "masa kerja golongan menurut SK PMK",
    });
    if (i.galatSesudahSk) c.push({ langkah: 4, ok: false, label: i.galatSesudahSk.replace(/\.$/, "") });
  }
  for (const b of i.berkas) c.push({ langkah: b.langkah, ok: b.ada, label: b.label });
  return c;
}

/** Keadaan langkah 1 sampai 4; langkah 5 lengkap bila semua langkah lengkap. */
export function keadaanLangkah(cek: readonly CekIsian[], n: NomorLangkah): KeadaanLangkah {
  return cek.some((c) => !c.ok && (n === 5 || c.langkah === n)) ? "kurang" : "lengkap";
}

/** Langkah pertama yang masih kurang; langkah 5 bila semuanya lengkap. Dipakai saat draf dibuka lagi. */
export function langkahAwal(cek: readonly CekIsian[]): NomorLangkah {
  return (cek.find((c) => !c.ok)?.langkah ?? 5) as NomorLangkah;
}
