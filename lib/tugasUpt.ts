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
// Murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

export type JenisTugasUpt = "terlambat" | "perbaiki" | "lengkapi" | "ajukan" | "periksa";

/** Nada kartu tugas; mengikuti kosakata warna dasbor. */
export type NadaTugas = "merah" | "ungu" | "kuning" | "hijau" | "biru";

export const TUGAS_UPT: Record<JenisTugasUpt, { judul: string; nada: NadaTugas }> = {
  terlambat: { judul: "Lewat batas input", nada: "merah" },
  perbaiki: { judul: "Dikembalikan Kanwil", nada: "ungu" },
  lengkapi: { judul: "Belum lengkap", nada: "kuning" },
  ajukan: { judul: "Siap diajukan", nada: "hijau" },
  periksa: { judul: "Perlu diperiksa", nada: "biru" },
};

/** Urutan pengerjaan; makin kecil makin dulu. */
// Lewat batas didahulukan: batas input Kanwil sudah terlewati, jadi KGB-nya sudah terancam rapelan.
const URUTAN: Record<JenisTugasUpt, number> = { terlambat: 0, perbaiki: 1, lengkapi: 2, ajukan: 3, periksa: 4 };

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
  /** "berlaku" bila UPT sudah menyatakan data siklus ini benar. */
  konfirmasi: string;
  bolehKonfirmasi: boolean;
  /** Batas input Kanwil untuk TMT ini sudah lewat, padahal KGB-nya belum diinput. */
  terlambat?: boolean;
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
 * Pegawai yang sudah punya usulan berjalan juga tidak diminta konfirmasi lagi, sebab mengusulkan
 * adalah pernyataan yang lebih kuat daripada menyatakan data yang ada sudah benar.
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
    if (p.usulanBerjalan) continue;
    if (p.konfirmasi === "berlaku") continue;
    if (!p.bolehKonfirmasi) continue;
    // Yang lewat batas masuk walau bukan bulan usulan berjalan: siklusnya sudah terlewati, dan tanpa
    // langkah UPT pegawai itu tidak muncul di daftar mana pun selain tabel pegawai.
    const terlambat = !!p.terlambat;
    if (!terlambat && (!bulanUsulan || p.bulanTmt !== bulanUsulan)) continue;
    tugas.push({
      kunci: `pegawai:${p.id}`,
      jenis: terlambat ? "terlambat" : "periksa",
      nama: p.nama,
      nip: p.nip,
      langkah: terlambat
        ? "Batas input Kanwil sudah lewat. Segera nyatakan datanya sudah benar, atau usulkan perbaikan."
        : "Nyatakan datanya sudah benar, atau usulkan perbaikan bila ada yang keliru.",
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
