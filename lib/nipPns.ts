// Pemeriksaan NIP menurut bentuk bakunya, bukan sekadar "18 angka".
//
// Sebabnya satu kejadian nyata di lapangan (30 September 2026): operator UPT menyunting berkas CSV di
// Excel, kolom NIP ditampilkan sebagai 1,97E+17, lalu berkasnya disimpan. Excel menulis ke CSV apa yang
// *tampil*, sehingga 197112051998031004 tersimpan menjadi 197112000000000000. Angka itu tetap 18 digit,
// jadi pemeriksaan /^\d{18}$/ meloloskannya dan pegawai palsu ber-NIP rusak masuk ke basis data.
//
// NIP PNS punya susunan tetap, dan justru susunan itulah yang hancur saat presisi hilang:
//
//   1971 12 05   1998 03   1   004
//   └─ lahir ─┘  └ TMT ┘  kel  urut
//    yyyymmdd     yyyymm   1/2  001-999
//
// Pada NIP yang rusak, tanggal lahirnya menjadi 00, bulan dan tahun TMT-nya 000000, dan angka jenis
// kelaminnya 0, tiga hal yang tidak mungkin ada pada NIP mana pun. Memeriksa susunannya karena itu
// menangkap kerusakan Excel dengan pasti, bukan menebak-nebak.
//
// Modul ini murni: tidak menyentuh basis data dan tidak membaca jam sistem kecuali lewat `tahunKini`
// yang boleh diisi pemanggil, agar dapat diuji tanpa bergantung pada tanggal hari ini.

/** Susunan NIP yang berhasil dibaca; dipakai untuk menerangkan isinya, bukan untuk menyimpan data. */
export interface NipTerbaca {
  /** Tanggal lahir yyyy-mm-dd. */
  tanggalLahir: string;
  /** TMT CPNS yyyy-mm; NIP tidak memuat tanggalnya. */
  tmtCpns: string;
  jenisKelamin: "Laki-laki" | "Perempuan";
  urutan: number;
}

export type KodeGalatNip =
  /** Tidak diisi sama sekali. */
  | "kosong"
  /** Masih berbentuk notasi ilmiah, misalnya 1,97E+17; berarti berkasnya disimpan Excel apa adanya. */
  | "notasiIlmiah"
  /** Bukan 18 digit angka. */
  | "bentuk"
  /** 18 digit, tetapi susunannya mustahil dan berakhir nol beruntun: ciri khas presisi yang hilang. */
  | "presisiHilang"
  /** 18 digit, tetapi ada bagian yang tidak mungkin (bulan 13, jenis kelamin 7, dan sebagainya). */
  | "struktur";

export interface GalatNip {
  kode: KodeGalatNip;
  /** Kalimat siap tampil untuk operator, sudah memuat jalan keluarnya. */
  pesan: string;
}

export type HasilNip = { ok: true; nip: string; isi: NipTerbaca } | { ok: false; galat: GalatNip };

/**
 * Cara membuka dan menyimpan berkas agar NIP tidak berubah. Satu kalimat ini dipakai ulang di pesan
 * tolak maupun di layar unggah, supaya operator membaca petunjuk yang sama persis di kedua tempat.
 */
export const SARAN_NIP_EXCEL =
  "Buka berkasnya lewat Data → From Text/CSV, lalu setel kolom nip sebagai Text sebelum ditarik masuk. " +
  "Bila mengetik manual, awali dengan tanda petik satu ('197112051998031004). Berkas yang NIP-nya telanjur " +
  "tampil 1,97E+17 jangan disimpan; tutup tanpa menyimpan, lalu buka ulang dengan cara di atas.";

/** Tahun lahir paling tua yang masih masuk akal untuk seorang PNS aktif maupun arsipnya. */
const TAHUN_LAHIR_PALING_TUA = 1930;
/** Tahun pengangkatan CPNS paling tua yang masih mungkin tercatat. */
const TAHUN_TMT_PALING_TUA = 1955;
/** Umur paling muda saat diangkat CPNS; di bawah ini pasti salah baca, bukan kasus langka. */
const UMUR_MINIMAL_CPNS = 15;

function tanggalMasukAkal(tahun: number, bulan: number, hari: number): boolean {
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) return false;
  const t = new Date(Date.UTC(tahun, bulan - 1, hari));
  return t.getUTCFullYear() === tahun && t.getUTCMonth() === bulan - 1 && t.getUTCDate() === hari;
}

/**
 * Apakah teks ini masih berbentuk notasi ilmiah, misalnya "1,97E+17" atau "1.99001e17". Bentuk inilah
 * yang tertulis di CSV ketika lebar kolom Excel membuat angkanya ditampilkan singkat.
 */
export function berbentukNotasiIlmiah(teks: string): boolean {
  return /^[+-]?\d+(?:[.,]\d+)?\s*[eE]\s*[+-]?\d+$/.test(teks.trim());
}

/**
 * Apakah 18 digit ini berakhir dengan nol beruntun yang mustahil. NIP yang sah paling banyak berakhir
 * dua nol (nomor urut 100, 200, … 900), sebab angka jenis kelamin di depannya selalu 1 atau 2 dan
 * nomor urut tidak pernah 000. Tiga nol beruntun di ujung karena itu bukan NIP, melainkan sisa
 * pembulatan: Excel hanya menyimpan 15 angka berarti, dan CSV-nya bahkan sering hanya 6.
 */
export function berakhirNolBeruntun(nip: string): boolean {
  return /0{3,}$/.test(nip);
}

/**
 * Baca dan periksa satu NIP. Nilai balik `ok` berarti susunannya sah; ini bukan jaminan orangnya ada,
 * hanya jaminan angkanya tidak rusak.
 */
export function periksaNip(mentah: unknown, tahunKini: number = new Date().getFullYear()): HasilNip {
  const nip = String(mentah ?? "").trim();

  if (!nip) return { ok: false, galat: { kode: "kosong", pesan: "NIP wajib diisi." } };

  if (berbentukNotasiIlmiah(nip))
    return {
      ok: false,
      galat: {
        kode: "notasiIlmiah",
        pesan:
          `NIP terbaca "${nip}", bukan 18 digit angka. Excel mengubah NIP menjadi notasi ilmiah dan ` +
          `menuliskannya apa adanya ke CSV, sehingga angka aslinya sudah hilang dari berkas ini. ` +
          `Ambil berkas aslinya, lalu ${SARAN_NIP_EXCEL.charAt(0).toLowerCase() + SARAN_NIP_EXCEL.slice(1)}`,
      },
    };

  if (!/^\d{18}$/.test(nip)) {
    // Petunjuk Excel hanya disertakan bila memang masuk akal: angka murni yang terlalu pendek biasanya
    // salah ketik, bukan berkas yang rusak, dan petunjuk panjang di situ justru mengaburkan sebabnya.
    const mungkinExcel = /\D/.test(nip) || (nip.length >= 14 && nip.length < 18);
    return {
      ok: false,
      galat: {
        kode: "bentuk",
        pesan:
          `NIP harus tepat 18 digit angka; yang terbaca "${nip}" berisi ${nip.length} karakter. ` +
          (mungkinExcel ? SARAN_NIP_EXCEL : "Salin ulang NIP dari SK pegawai yang bersangkutan."),
      },
    };
  }

  const tahunLahir = Number(nip.slice(0, 4));
  const bulanLahir = Number(nip.slice(4, 6));
  const hariLahir = Number(nip.slice(6, 8));
  const tahunTmt = Number(nip.slice(8, 12));
  const bulanTmt = Number(nip.slice(12, 14));
  const kelamin = Number(nip.slice(14, 15));
  const urutan = Number(nip.slice(15, 18));

  const sebab: string[] = [];

  if (!tanggalMasukAkal(tahunLahir, bulanLahir, hariLahir))
    sebab.push(`delapan angka pertama "${nip.slice(0, 8)}" bukan tanggal lahir yang ada`);
  else if (tahunLahir < TAHUN_LAHIR_PALING_TUA || tahunLahir > tahunKini - UMUR_MINIMAL_CPNS)
    sebab.push(`tahun lahir ${tahunLahir} di luar batas wajar`);

  if (bulanTmt < 1 || bulanTmt > 12) sebab.push(`bulan TMT CPNS "${nip.slice(12, 14)}" bukan bulan`);
  if (tahunTmt < TAHUN_TMT_PALING_TUA || tahunTmt > tahunKini + 1)
    sebab.push(`tahun TMT CPNS ${tahunTmt} di luar batas wajar`);

  if (kelamin !== 1 && kelamin !== 2)
    sebab.push(`angka jenis kelamin ${kelamin} harus 1 (laki-laki) atau 2 (perempuan)`);

  if (urutan < 1) sebab.push("nomor urut 000 tidak pernah dipakai");

  // Diangkat CPNS sebelum lahir, atau di usia yang tidak mungkin.
  if (sebab.length === 0 && tahunTmt - tahunLahir < UMUR_MINIMAL_CPNS)
    sebab.push(`TMT CPNS ${tahunTmt} terlalu dekat dengan tahun lahir ${tahunLahir}`);

  if (sebab.length === 0)
    return {
      ok: true,
      nip,
      isi: {
        tanggalLahir: `${nip.slice(0, 4)}-${nip.slice(4, 6)}-${nip.slice(6, 8)}`,
        tmtCpns: `${nip.slice(8, 12)}-${nip.slice(12, 14)}`,
        jenisKelamin: kelamin === 1 ? "Laki-laki" : "Perempuan",
        urutan,
      },
    };

  // NIP yang dirusak Excel melanggar hampir semua aturan sekaligus; menyebutkan kelimanya membuat pesan
  // panjang tanpa menambah keterangan. Dua yang pertama sudah cukup membuktikan, sisanya cukup dihitung.
  const rincian =
    sebab.length > 2 ? `${sebab.slice(0, 2).join("; ")}, dan ${sebab.length - 2} hal lain` : sebab.join("; ");

  if (berakhirNolBeruntun(nip))
    return {
      ok: false,
      galat: {
        kode: "presisiHilang",
        pesan:
          `NIP "${nip}" mustahil (${rincian}), dan angkanya berakhir nol beruntun. Itu ciri khas NIP yang ` +
          `dirusak Excel: 18 digit dipangkas menjadi angka pembulatan saat berkas disimpan sebagai CSV. ` +
          SARAN_NIP_EXCEL,
      },
    };

  return {
    ok: false,
    galat: {
      kode: "struktur",
      pesan:
        `NIP "${nip}" tidak sesuai susunan baku (lahir yyyymmdd, TMT CPNS yyyymm, jenis kelamin, ` +
        `nomor urut): ${rincian}. Cocokkan dengan NIP pada SK pegawai yang bersangkutan.`,
    },
  };
}

/** Bentuk singkat: sah atau tidak, tanpa alasannya. */
export function nipSah(mentah: unknown, tahunKini?: number): boolean {
  return periksaNip(mentah, tahunKini).ok;
}
