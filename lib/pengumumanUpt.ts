// Pop-up pengumuman perubahan untuk Admin UPT (ADR-073). Logika kapan pop-up boleh tampil dipisah di sini agar dapat
// diuji, sebab kesalahan di sini berarti jendela muncul di atas pekerjaan yang sedang diketik.
//
// Prinsip: pengumuman tidak pernah mengganggu isian. Ia hanya tampil di halaman yang tidak memuat isian, tidak di
// atas dialog lain, tidak selagi ada kolom yang sedang diketik, dan tidak menyimpan atau menghapus data apa pun;
// satu-satunya yang dicatat adalah penanda "sudah dilihat" di peramban.

/**
 * Pengumuman yang berlaku, dari yang terlama. Pengumuman baru ditambahkan di akhir: pengguna yang sudah melihat yang
 * lama hanya mendapat adegan yang baru, dan pengguna yang belum pernah melihat apa pun mendapat semuanya berurutan
 * (ADR-074). Tombol "Apa yang baru" memutar seluruhnya.
 */
export const PENGUMUMAN_UPT = ["nama-menu-2026-10", "lapor-sk-2026-10"] as const;
export type IdPengumumanUpt = (typeof PENGUMUMAN_UPT)[number];

/** Id pengumuman yang belum dilihat, menurut urutan terbitnya; kosong berarti tidak ada yang perlu ditampilkan. */
export function pengumumanBelumDilihat(sudahDilihat: (id: IdPengumumanUpt) => boolean): IdPengumumanUpt[] {
  return PENGUMUMAN_UPT.filter((id) => !sudahDilihat(id));
}

/** Peristiwa untuk membuka kembali pengumuman dari tombol "Apa yang baru". */
export const PERISTIWA_BUKA_PENGUMUMAN_UPT = "kgb-buka-pengumuman-upt";

/**
 * Halaman yang aman: dasbor, Pegawai Satker, dan Riwayat tidak punya isian yang bisa hilang. Usul KGB Kolektif,
 * Unggah daftar, Lapor Hukdis, dan Profil Saya sengaja tidak termasuk: di sana ada isian yang belum disimpan.
 */
export const HALAMAN_PENGUMUMAN_UPT: readonly string[] = ["/dashboard", "/dashboard/upt/pegawai", "/dashboard/upt/riwayat"];

/**
 * Kunci penanda "sudah dilihat" di peramban, per pengguna dan per pengumuman. Pengumuman pertama memakai kunci yang
 * sama dengan sebelum ada pengumuman kedua, jadi yang sudah melihatnya tidak melihatnya lagi.
 */
export const kunciPengumumanUpt = (nip: string, id: IdPengumumanUpt = PENGUMUMAN_UPT[0]) =>
  `kgb-pengumuman-upt:${id}:${nip || "-"}`;

/** Elemen yang sedang menerima ketikan; fokusnya tidak boleh direbut pengumuman. */
export function sedangMengetik(el: { tagName?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!el) return false;
  const tag = (el.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

export interface KeadaanPengumuman {
  peran: string;
  jalur: string;
  /** Ada dialog lain yang terbuka. */
  adaDialog: boolean;
  /** Ada kolom isian yang sedang difokuskan. */
  sedangMengetik: boolean;
  /** Seluruh pengumuman yang berlaku sudah dilihat pengguna ini. */
  sudahDilihat: boolean;
}

/** true bila pengumuman boleh tampil sekarang. */
export function bolehTampilPengumuman(k: KeadaanPengumuman): boolean {
  if (k.peran !== "admin_upt" || k.sudahDilihat || k.adaDialog || k.sedangMengetik) return false;
  const jalur = k.jalur.length > 1 ? k.jalur.replace(/\/+$/, "") : k.jalur;
  return HALAMAN_PENGUMUMAN_UPT.includes(jalur);
}
