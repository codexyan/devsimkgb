// Draf nomor dan tanggal SK baru yang belum dibuat, disimpan di peramban.
//
// Nomor SK baru baru tercatat di server saat Buat dan Unduh SK, karena catatan surat itulah penanda
// "SK sudah dibuat" yang menggeser KGB ke tahap tunggu TTE. Draf ini menyimpan nomor dari arsiparis
// tanpa menyentuh status itu. Tempatnya localStorage, jadi hanya ada di peramban yang menyimpannya;
// yang menjaga satu nomor tidak dipakai dua SK adalah pemeriksaan nomor kembar di server.

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

/** false bila peramban menolak menyimpan (mode privat, penyimpanan diblokir). */
export function simpanDrafSk(kgbId: string, isi: { nomorSurat: string; tanggalSurat: string }): boolean {
  try {
    const draf: DrafSk = { ...isi, disimpan: new Date().toISOString() };
    window.localStorage.setItem(kunci(kgbId), JSON.stringify(draf));
    return true;
  } catch {
    return false;
  }
}

export function hapusDrafSk(kgbId: string): void {
  try {
    window.localStorage.removeItem(kunci(kgbId));
  } catch {
    // Draf yang tertinggal tidak dipakai lagi: formulir SK yang sudah dibuat mengambil nomornya dari server.
  }
}
