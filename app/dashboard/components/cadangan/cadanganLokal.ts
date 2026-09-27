// Catatan cadangan di peramban (ADR-018). Server tetap sumber utama; catatan ini menjaga pengingat tetap
// benar di perangkat yang baru mencadangkan bila server gagal mencatat, dan menyimpan penundaan 24 jam.
// Semua akses dibungkus try/catch: penyimpanan peramban bisa tidak tersedia (mode privat, diblokir).

/** Kabar antar-komponen bahwa cadangan baru saja diunduh, agar pengingat langsung hilang. */
export const KABAR_CADANGAN = "simkgb:cadangan";

const kunciTerakhir = (nip: string) => `simkgb-cadangan-terakhir:${nip}`;
const kunciTunda = (nip: string) => `simkgb-cadangan-tunda:${nip}`;

export function bacaCadanganLokal(nip: string): string | null {
  try {
    return localStorage.getItem(kunciTerakhir(nip));
  } catch {
    return null;
  }
}

export function catatCadanganLokal(nip: string, waktu: Date): void {
  try {
    localStorage.setItem(kunciTerakhir(nip), waktu.toISOString());
  } catch {
    // Diabaikan; server tetap mencatat.
  }
}

/** Penundaan untuk satu jatuh tempo: sampai kapan, dan untuk jatuh tempo yang mana. */
export function bacaTunda(nip: string): { jatuhTempo: string; sampai: string } | null {
  try {
    const isi = localStorage.getItem(kunciTunda(nip));
    return isi ? (JSON.parse(isi) as { jatuhTempo: string; sampai: string }) : null;
  } catch {
    return null;
  }
}

export function catatTunda(nip: string, jatuhTempo: string, sampai: Date): void {
  try {
    localStorage.setItem(kunciTunda(nip), JSON.stringify({ jatuhTempo, sampai: sampai.toISOString() }));
  } catch {
    // Tanpa penyimpanan, penundaan hanya berlaku sampai halaman dimuat ulang.
  }
}
