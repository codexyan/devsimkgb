// Aturan pembatas cek status KGB publik, dipakai Durable Object PembatasCekKgb di worker-entry.js.
//
// Pembatas bawaan Workers (binding ratelimits) sengaja longgar dan menghitung per mesin di tiap pusat data,
// sehingga penebakan beruntun tetap lolos. Durable Object memberi satu penghitung tunggal untuk semua
// permintaan; aturannya di sini agar dapat diuji tanpa Cloudflare.
//
// - Per alamat IP: paling banyak BATAS_IP_PER_MENIT cek per menit.
// - Per alamat IP: setelah BATAS_GAGAL_IP kali gagal (NIP tak dikenal atau tempat lahir salah) dalam
//   JENDELA_GAGAL_IP_MS, alamat itu ditahan selama JENDELA_GAGAL_IP_MS.
// - Per NIP: setelah BATAS_GAGAL_NIP kali gagal dari alamat mana pun dalam JENDELA_GAGAL_NIP_MS, NIP itu
//   ditahan selama JENDELA_GAGAL_NIP_MS. Ini yang menutup penebakan tempat lahir seseorang dari banyak alamat.

// Longgar per alamat, karena pegawai satu kantor UPT biasanya keluar lewat satu alamat IP yang sama.
export const BATAS_IP_PER_MENIT = 30;
export const BATAS_GAGAL_IP = 10;
export const JENDELA_GAGAL_IP_MS = 10 * 60_000;
export const BATAS_GAGAL_NIP = 5;
export const JENDELA_GAGAL_NIP_MS = 30 * 60_000;
const SEMENIT = 60_000;
const BATAS_ENTRI = 20_000;

interface Jendela {
  mulai: number;
  jumlah: number;
}

export interface HasilPeriksa {
  boleh: boolean;
  /** Detik sampai boleh mencoba lagi; 0 bila boleh. */
  tunggu: number;
  alasan: "ip" | "gagal-ip" | "gagal-nip" | null;
}

function berjalan(peta: Map<string, Jendela>, kunci: string, sekarang: number, lama: number): Jendela | null {
  const j = peta.get(kunci);
  return j && sekarang - j.mulai < lama ? j : null;
}

function tambah(peta: Map<string, Jendela>, kunci: string, sekarang: number, lama: number): number {
  if (peta.size > BATAS_ENTRI) {
    for (const [k, j] of peta) if (sekarang - j.mulai >= lama) peta.delete(k);
    if (peta.size > BATAS_ENTRI) peta.clear();
  }
  const j = berjalan(peta, kunci, sekarang, lama);
  if (!j) {
    peta.set(kunci, { mulai: sekarang, jumlah: 1 });
    return 1;
  }
  j.jumlah += 1;
  return j.jumlah;
}

const sisaDetik = (j: Jendela, sekarang: number, lama: number) => Math.max(1, Math.ceil((j.mulai + lama - sekarang) / 1000));

export class AturanPembatasCek {
  private cekIp = new Map<string, Jendela>();
  private gagalIp = new Map<string, Jendela>();
  private gagalNip = new Map<string, Jendela>();

  /** Boleh dilayani? Permintaan yang diizinkan langsung dihitung ke jatah per menit alamatnya. */
  periksa(ip: string, nip: string, sekarang: number): HasilPeriksa {
    const gNip = nip ? berjalan(this.gagalNip, nip, sekarang, JENDELA_GAGAL_NIP_MS) : null;
    if (gNip && gNip.jumlah >= BATAS_GAGAL_NIP)
      return { boleh: false, tunggu: sisaDetik(gNip, sekarang, JENDELA_GAGAL_NIP_MS), alasan: "gagal-nip" };
    const gIp = berjalan(this.gagalIp, ip, sekarang, JENDELA_GAGAL_IP_MS);
    if (gIp && gIp.jumlah >= BATAS_GAGAL_IP)
      return { boleh: false, tunggu: sisaDetik(gIp, sekarang, JENDELA_GAGAL_IP_MS), alasan: "gagal-ip" };
    const cek = berjalan(this.cekIp, ip, sekarang, SEMENIT);
    if (cek && cek.jumlah >= BATAS_IP_PER_MENIT)
      return { boleh: false, tunggu: sisaDetik(cek, sekarang, SEMENIT), alasan: "ip" };
    tambah(this.cekIp, ip, sekarang, SEMENIT);
    return { boleh: true, tunggu: 0, alasan: null };
  }

  /** Catat satu percobaan gagal (NIP tak dikenal atau tempat lahir salah). */
  catatGagal(ip: string, nip: string, sekarang: number): void {
    tambah(this.gagalIp, ip, sekarang, JENDELA_GAGAL_IP_MS);
    if (nip) tambah(this.gagalNip, nip, sekarang, JENDELA_GAGAL_NIP_MS);
  }
}

/** Pesan untuk pengguna yang ditahan pembatas. */
export function pesanDitahan(h: HasilPeriksa): string {
  const menit = Math.ceil(h.tunggu / 60);
  if (h.alasan === "gagal-nip")
    return `Terlalu banyak percobaan yang tidak cocok untuk NIP ini. Coba lagi dalam ${menit} menit, atau hubungi pengelola kepegawaian di satker Anda.`;
  if (h.alasan === "gagal-ip")
    return `Terlalu banyak percobaan yang tidak cocok. Coba lagi dalam ${menit} menit.`;
  return "Terlalu banyak permintaan cek status. Coba lagi dalam satu menit.";
}
