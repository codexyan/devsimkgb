// Satu nomor dari arsiparis hanya untuk satu SK KGB: nomor itu tidak boleh sudah dipakai SK yang dibuat,
// maupun sudah dipesan sebagai draf, oleh KGB lain. Dipakai Buat SK (pratinjau dan buat) dan Simpan draf.
//
// "KGB lain" berarti SK lain. Dua keadaan bukan SK lain dan tidak memegang nomor (ADR-056, ADR-058):
// - KGB yang dibatalkan, selama SK-nya belum diunggah bertanda tangan;
// - KGB lain milik pegawai yang sama, selama SK-nya belum diunggah: itu SK yang sama yang sedang dibuat ulang
//   (Input Ulang KGB), dan nomor arsiparisnya memang dipakai lagi.
// SK yang sudah diunggah bertanda tangan tetap memegang nomornya, siapa pun pemiliknya: nomor itu sudah tercetak
// pada surat yang sah.
//
// Nomor arsiparis dimulai lagi dari awal setiap tahun (ADR-127): nomor yang sama pada tahun yang berbeda bukan bentrok.
// Tahun dibandingkan dari tanggal SK baru dengan tanggal SK yang memegang nomor itu; bila salah satunya tidak diketahui,
// nomor tetap dianggap bentrok.

import { db } from "./db";
import { kunciNomorSk } from "./nomorSurat";
import { tanggalKalender, type NilaiTanggal } from "./waktu";
import type { SuratKgbTersimpan } from "./prosesKgb";

function tahunKalender(nilai: NilaiTanggal): number | null {
  return tanggalKalender(nilai)?.getFullYear() ?? null;
}

/** Pesan penolakan bila nomor bentrok dengan KGB lain pada tahun SK yang sama; null bila bebas. */
export async function nomorSkBentrok(nomor: string, kgbId: string, tanggalBaru?: NilaiTanggal): Promise<string | null> {
  const kunci = kunciNomorSk(nomor);
  if (!kunci) return null;
  const [surat, semuaKgb] = await Promise.all([
    db.suratKGB.findMany() as Promise<SuratKgbTersimpan[]>,
    db.riwayatKGB.findMany(),
  ]);
  const kgbById = new Map(semuaKgb.map((k) => [k.id, k]));
  const pegawaiIni = kgbById.get(kgbId)?.pegawaiId ?? null;
  const memegang = (k: { status: string; pegawaiId: string } | undefined, sudahDiunggah: boolean): boolean => {
    if (sudahDiunggah || !k) return true;
    if (k.status === "ditolak") return false;
    return !(pegawaiIni && k.pegawaiId === pegawaiIni);
  };

  const tahunBaru = tahunKalender(tanggalBaru);
  const tahunBeda = (tanggalLama: NilaiTanggal): boolean => {
    const lama = tahunKalender(tanggalLama);
    return tahunBaru !== null && lama !== null && lama !== tahunBaru;
  };

  const dariSurat = surat.find(
    (s) =>
      s.kgbId !== kgbId &&
      kunciNomorSk(s.nomorSurat) === kunci &&
      !tahunBeda(s.tanggalSurat) &&
      memegang(kgbById.get(s.kgbId), !!s.pathFile),
  )?.kgbId;
  const dariDraf = semuaKgb.find(
    (k) => k.id !== kgbId && kunciNomorSk(k.drafNomorSurat) === kunci && !tahunBeda(k.drafTanggalSurat) && memegang(k, false),
  )?.id;
  const kgbLainId = dariSurat ?? dariDraf;
  if (!kgbLainId) return null;

  const kgbLain = kgbById.get(kgbLainId);
  const pegawaiLain = kgbLain ? await db.pegawai.findUnique({ id: kgbLain.pegawaiId }) : null;
  const siapa = pegawaiLain ? `${pegawaiLain.nama} (${pegawaiLain.nip})` : "pegawai lain";
  return dariSurat
    ? `Nomor SK ${nomor} sudah dipakai SK KGB ${siapa}. Minta nomor lain kepada arsiparis.`
    : `Nomor SK ${nomor} sudah disimpan sebagai draf SK KGB ${siapa}. Minta nomor lain kepada arsiparis.`;
}
