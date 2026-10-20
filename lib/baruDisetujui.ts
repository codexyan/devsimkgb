// Pegawai yang usulannya baru disetujui Kanwil tetap tampil di papan, walau jadwal KGB-nya belum dibuka (ADR-117).
//
// Persetujuan usulan hanya menulis data pegawai dan konfirmasi UPT-nya; ia tidak membuat KGB yang sedang diproses.
// Pegawai yang TMT-nya sudah dalam jendela input langsung terlihat: di UPT sebagai kartu "Data disetujui" di Di Kanwil,
// di Kanwil sebagai Perlu diinput. Pegawai yang TMT-nya masih jauh (masa usulnya belum dibuka, atau jadwalnya digeser
// hukuman disiplin) tidak masuk kolom mana pun di kedua papan, sehingga yang baru menyetujui mengira persetujuannya
// hilang. Modul ini memberi mereka kartu sementara selama beberapa hari sesudah disetujui. Murni agar dapat diuji.

/** Lama (hari) pegawai yang baru disetujui tetap tampil walau jadwal KGB-nya belum dibuka. */
export const HARI_BARU_DISETUJUI = 14;

const MS_HARI = 86_400_000;

/**
 * true bila persetujuan terakhir (waktu konfirmasi UPT, yang ditulis persetujuan usulan) jatuh dalam
 * `HARI_BARU_DISETUJUI` hari terakhir. Waktu kosong atau tidak valid tidak dihitung. `hariIni` adalah tanggal kalender
 * (awal hari), jadi persetujuan sore ini, yang waktunya lebih besar darinya, tetap terhitung.
 */
export function barusajaDisetujui(konfirmasiAt: string | Date | null | undefined, hariIni: Date): boolean {
  if (!konfirmasiAt) return false;
  const waktu = new Date(konfirmasiAt).getTime();
  if (!Number.isFinite(waktu)) return false;
  const umurHari = (hariIni.getTime() - waktu) / MS_HARI;
  return umurHari >= -1 && umurHari <= HARI_BARU_DISETUJUI;
}

export interface KeadaanSetelahAcc {
  statusKGB: string | null;
  /** Jendela input KGB-nya belum dibuka (TMT masih jauh). */
  terkunci: boolean;
  /** Status usulan data yang masih berjalan (draf, menunggu, revisi); null bila tidak ada. */
  usulanBerjalan?: string | null;
  /** "berlaku" bila konfirmasi UPT memang untuk TMT siklus ini. */
  konfirmasi: string;
  konfirmasiAt: string | null;
}

/**
 * Kartu "kanwil" untuk pegawai yang datanya sudah disetujui dan KGB-nya belum diinput Kanwil, di papan UPT:
 * - "siap": jendelanya sudah dibuka dan konfirmasinya berlaku, jadi tinggal menunggu Kanwil memproses (ADR-082);
 * - "baru": baru disetujui, tetapi jendelanya belum dibuka; kartu ini hanya sementara, supaya persetujuannya terlihat;
 * - null: tidak ada kartu.
 * Pegawai yang KGB-nya sudah berjalan, atau yang usulan datanya masih berjalan, dipegang kartu lain.
 */
export function kartuSetelahAcc(p: KeadaanSetelahAcc, hariIni: Date): "siap" | "baru" | null {
  if (p.statusKGB !== null && p.statusKGB !== "belum_diproses") return null;
  if (p.usulanBerjalan) return null;
  if (!p.terkunci) return p.konfirmasi === "berlaku" ? "siap" : null;
  // Jadwal yang digeser hukuman disiplin tidak membawa konfirmasi TMT-nya (ADR-113), jadi di sini yang dinilai waktunya.
  return barusajaDisetujui(p.konfirmasiAt, hariIni) ? "baru" : null;
}
