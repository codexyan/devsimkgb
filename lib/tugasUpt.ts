// Daftar kerja Admin UPT: satu pegawai, satu langkah berikutnya.
//
// Dasbor UPT semula memecah pekerjaan yang sama ke empat panel terpisah (data disiapkan, usulan
// terkirim, SK terbit, jadwal), sehingga operator harus tahu lebih dulu panel mana yang harus dilihat.
// Usulan yang dikembalikan Kanwil membuatnya makin kabur: barisnya berpindah dari satu panel ke panel
// lain, dan yang tidak diberi tahu akan mencarinya di tempat yang salah.
//
// Modul ini menjawabnya dengan satu pertanyaan saja: apa yang harus dikerjakan sekarang. Urutannya
// menurut siapa yang sedang menunggu. Yang dikembalikan Kanwil didahulukan, sebab di situ ada orang
// yang benar-benar menunggu jawaban; yang belum diperiksa sama sekali paling belakang.
//
// Pegawai yang KGB-nya jatuh tempo hanya diingatkan, tidak ditagih pernyataan: bila sampai batas input
// Kanwil tidak ada usulan perbaikan, datanya dianggap benar dan kartunya hilang sendiri. Tombol "Data
// sudah benar" yang dulu ada tidak menghalangi apa pun di Kanwil, jadi hanya menambah pekerjaan.
//
// Murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

import { formatTanggalId } from "./waktu";

export type JenisTugasUpt = "perbaiki" | "lengkapi" | "ajukan" | "periksa";

/** Nada kartu tugas; mengikuti kosakata warna dasbor. */
export type NadaTugas = "merah" | "ungu" | "kuning" | "hijau" | "biru";

export const TUGAS_UPT: Record<JenisTugasUpt, { judul: string; nada: NadaTugas }> = {
  perbaiki: { judul: "Dikembalikan Kanwil", nada: "ungu" },
  lengkapi: { judul: "Belum lengkap", nada: "kuning" },
  ajukan: { judul: "Siap diajukan", nada: "hijau" },
  periksa: { judul: "Perlu diperiksa", nada: "biru" },
};

/** Urutan pengerjaan; makin kecil makin dulu. */
const URUTAN: Record<JenisTugasUpt, number> = { perbaiki: 0, lengkapi: 1, ajukan: 2, periksa: 3 };

export interface UsulanTugas {
  id: string;
  pegawaiId: string | null;
  status: string;
  nama: string;
  nip: string;
  /** Yang masih kurang sebelum draf boleh diajukan; kosong berarti siap. */
  kekurangan: string[];
  /** Catatan peninjau pada usulan yang dikembalikan. */
  alasanTolak?: string | null;
}

export interface PegawaiTugas {
  id: string;
  nama: string;
  nip: string;
  tmtKgb: string | null;
  /** Bulan TMT KGB, dipakai membandingkan dengan bulan yang sedang diusulkan. */
  bulanTmt: string | null;
  /** Sudah punya usulan berjalan; tugasnya sudah terwakili baris usulan itu. */
  usulanBerjalan?: string | null;
  /** KGB-nya belum diinput Kanwil dan batas inputnya belum lewat, jadi perbaikan masih berguna. */
  perluDiperiksa: boolean;
  /** Batas input Kanwil untuk TMT ini, yyyy-mm-dd; disebut pada kartu pengingat. */
  batasInput?: string | null;
}

export interface TugasUpt {
  kunci: string;
  jenis: JenisTugasUpt;
  nama: string;
  nip: string;
  /** Kalimat langkah berikutnya, siap ditampilkan apa adanya. */
  langkah: string;
  /** Keterangan tambahan: catatan Kanwil, atau apa yang masih kurang. */
  catatan: string | null;
  usulanId: string | null;
  pegawaiId: string | null;
  tmt: string | null;
}

/**
 * Susun daftar kerja UPT.
 *
 * Yang sedang ditinjau Kanwil sengaja tidak masuk: UPT tidak dapat berbuat apa-apa atasnya, dan
 * menampilkannya sebagai "tugas" hanya membuat daftar ini berisi hal yang tidak bisa dikerjakan.
 * Pegawai yang sudah punya usulan berjalan juga tidak diingatkan lagi, karena perbaikannya sudah diurus.
 */
export function daftarTugasUpt(
  usulan: readonly UsulanTugas[],
  pegawai: readonly PegawaiTugas[],
  bulanUsulan: string | null,
): TugasUpt[] {
  const tugas: TugasUpt[] = [];
  const tmtPegawai = new Map(pegawai.map((p) => [p.id, p.tmtKgb]));

  for (const u of usulan) {
    const tmt = u.pegawaiId ? tmtPegawai.get(u.pegawaiId) ?? null : null;
    if (u.status === "revisi") {
      tugas.push({
        kunci: `usulan:${u.id}`,
        jenis: "perbaiki",
        nama: u.nama,
        nip: u.nip,
        langkah: "Betulkan yang diminta Kanwil, simpan, lalu kirim ulang.",
        catatan: u.alasanTolak?.trim() || null,
        usulanId: u.id,
        pegawaiId: u.pegawaiId,
        tmt,
      });
      continue;
    }
    if (u.status !== "draf") continue;
    tugas.push(
      u.kekurangan.length > 0
        ? {
            kunci: `usulan:${u.id}`,
            jenis: "lengkapi",
            nama: u.nama,
            nip: u.nip,
            langkah: "Lengkapi isiannya sebelum dapat diajukan.",
            catatan: u.kekurangan.join(", "),
            usulanId: u.id,
            pegawaiId: u.pegawaiId,
            tmt,
          }
        : {
            kunci: `usulan:${u.id}`,
            jenis: "ajukan",
            nama: u.nama,
            nip: u.nip,
            langkah: "Sudah lengkap. Centang, lalu kirim bersama surat usulan.",
            catatan: null,
            usulanId: u.id,
            pegawaiId: u.pegawaiId,
            tmt,
          },
    );
  }

  for (const p of pegawai) {
    if (p.usulanBerjalan || !p.perluDiperiksa) continue;
    if (!bulanUsulan || p.bulanTmt !== bulanUsulan) continue;
    tugas.push({
      kunci: `pegawai:${p.id}`,
      jenis: "periksa",
      nama: p.nama,
      nip: p.nip,
      langkah: p.batasInput
        ? `Periksa datanya. Bila ada yang keliru, usulkan perbaikan sebelum ${formatTanggalId(p.batasInput)}; tanpa usulan, datanya dianggap benar.`
        : "Periksa datanya. Bila ada yang keliru, usulkan perbaikan; tanpa usulan, datanya dianggap benar.",
      catatan: null,
      usulanId: null,
      pegawaiId: p.id,
      tmt: p.tmtKgb,
    });
  }

  // Yang jatuh temponya lebih dekat dikerjakan lebih dulu; yang tanpa TMT jatuh ke belakang.
  return tugas.sort(
    (a, b) =>
      URUTAN[a.jenis] - URUTAN[b.jenis] ||
      (a.tmt ?? "9999").localeCompare(b.tmt ?? "9999") ||
      a.nama.localeCompare(b.nama),
  );
}
