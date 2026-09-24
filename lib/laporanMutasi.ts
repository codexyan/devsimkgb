// Laporan mutasi dan pemberhentian dari UPT.
//
// Pencatatan mutasi adalah wewenang Kanwil, tetapi satker yang paling dulu tahu pegawainya pindah,
// pensiun, atau meninggal. Selama belum tercatat, pegawai itu tetap muncul di antrian KGB dan tetap
// dihitung jatuh tempo, sehingga Kanwil menyiapkan SK untuk orang yang sudah tidak di sana.
//
// Daur hidupnya meniru usulan data, sebab persoalannya sama: UPT yang memegang dokumennya, Kanwil yang
// menetapkan. Laporan yang diterima menerbitkan barisnya di riwayat mutasi; yang dikembalikan kembali
// ke UPT beserta catatan peninjau.
//
// Murni agar dapat dipakai server maupun peramban dan diuji tanpa lapisan data.

export type StatusLaporanMutasi = "menunggu" | "diterima" | "dikembalikan";

export const STATUS_LAPORAN_MUTASI: Record<
  StatusLaporanMutasi,
  { label: string; nada: "kuning" | "hijau" | "ungu" }
> = {
  menunggu: { label: "Menunggu tinjauan", nada: "kuning" },
  diterima: { label: "Sudah dicatat Kanwil", nada: "hijau" },
  dikembalikan: { label: "Dikembalikan untuk diperbaiki", nada: "ungu" },
};

/** Status yang masih dipegang UPT dan karena itu boleh dibatalkan sendiri. */
export const LAPORAN_DIPEGANG_UPT: readonly string[] = ["menunggu", "dikembalikan"];

/**
 * Satu pegawai hanya boleh punya satu laporan berjalan. Tanpa ini, satu kepindahan yang dilaporkan dua
 * kali membuat Kanwil mencatat mutasi yang sama dua kali, dan riwayatnya tidak lagi dapat dipercaya.
 */
export function adaLaporanBerjalan(
  laporan: readonly { pegawaiId: string; status: string }[],
  pegawaiId: string,
): boolean {
  return laporan.some((l) => l.pegawaiId === pegawaiId && LAPORAN_DIPEGANG_UPT.includes(l.status));
}
