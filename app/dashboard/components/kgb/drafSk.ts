// Draf nomor SK baru yang dulu disimpan di peramban.
//
// Draf kini disimpan di SIM-KGB pada KGB-nya (ADR-011). Modul ini hanya membaca draf lama yang sempat
// tersimpan di peramban sebelum perubahan itu, supaya nomornya tidak hilang, lalu membersihkannya begitu
// draf disimpan ke server atau SK dibuat.

export interface DrafSk {
  nomorSurat: string;
  tanggalSurat: string;
  /** Waktu draf disimpan, ISO. */
  disimpan: string;
}

const kunci = (kgbId: string) => `sim-kgb:draf-sk:${kgbId}`;

export function bacaDrafSk(kgbId: string): DrafSk | null {
  try {
    const mentah = window.localStorage.getItem(kunci(kgbId));
    if (!mentah) return null;
    const d = JSON.parse(mentah) as Partial<DrafSk>;
    if (typeof d.nomorSurat !== "string" || typeof d.tanggalSurat !== "string") return null;
    return { nomorSurat: d.nomorSurat, tanggalSurat: d.tanggalSurat, disimpan: typeof d.disimpan === "string" ? d.disimpan : "" };
  } catch {
    return null;
  }
}

export function hapusDrafSk(kgbId: string): void {
  try {
    window.localStorage.removeItem(kunci(kgbId));
  } catch {
    // Draf yang tertinggal tidak dipakai lagi: formulir SK yang sudah dibuat mengambil nomornya dari server.
  }
}
