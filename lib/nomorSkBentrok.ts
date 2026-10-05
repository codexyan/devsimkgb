// Satu nomor dari arsiparis hanya untuk satu SK KGB: nomor itu tidak boleh sudah dipakai SK yang dibuat,
// maupun sudah dipesan sebagai draf, oleh KGB lain. Dipakai Buat SK (pratinjau dan buat) dan Simpan draf.

import { db } from "./db";
import { kunciNomorSk } from "./nomorSurat";
import type { SuratKgbTersimpan } from "./prosesKgb";

/** Pesan penolakan bila nomor bentrok dengan KGB lain; null bila bebas. */
export async function nomorSkBentrok(nomor: string, kgbId: string): Promise<string | null> {
  const kunci = kunciNomorSk(nomor);
  if (!kunci) return null;
  const [surat, semuaKgb] = await Promise.all([
    db.suratKGB.findMany() as Promise<SuratKgbTersimpan[]>,
    db.riwayatKGB.findMany(),
  ]);
  // KGB yang dibatalkan tidak lagi memegang nomornya: Input Ulang KGB lazimnya memakai nomor arsiparis yang sama,
  // dan dulu ditolak "sudah dipakai" oleh KGB batal milik pegawai yang sama (ADR-056).
  const batal = new Set(semuaKgb.filter((k) => k.status === "ditolak").map((k) => k.id));
  const dariSurat = surat.find((s) => s.kgbId !== kgbId && !batal.has(s.kgbId) && kunciNomorSk(s.nomorSurat) === kunci)?.kgbId;
  const dariDraf = semuaKgb.find((k) => k.id !== kgbId && !batal.has(k.id) && kunciNomorSk(k.drafNomorSurat) === kunci)?.id;
  const kgbLainId = dariSurat ?? dariDraf;
  if (!kgbLainId) return null;

  const kgbLain = semuaKgb.find((k) => k.id === kgbLainId);
  const pegawaiLain = kgbLain ? await db.pegawai.findUnique({ id: kgbLain.pegawaiId }) : null;
  const siapa = pegawaiLain ? `${pegawaiLain.nama} (${pegawaiLain.nip})` : "pegawai lain";
  return dariSurat
    ? `Nomor SK ${nomor} sudah dipakai SK KGB ${siapa}. Minta nomor lain kepada arsiparis.`
    : `Nomor SK ${nomor} sudah disimpan sebagai draf SK KGB ${siapa}. Minta nomor lain kepada arsiparis.`;
}
