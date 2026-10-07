// Mengembalikan usulan UPT yang sudah disetujui dan diterapkan, supaya UPT dapat memperbaikinya (ADR-076).
//
// Persetujuan sudah menulis data pegawai, riwayat KP/PMK, dan menyesuaikan KGB, dan keadaan sebelumnya tidak tersimpan,
// jadi usulan yang sama tidak dapat dibuka kembali lalu disetujui ulang: SK bernomor sama ditolak karena sudah tercatat,
// golongan lamanya sudah naik, dan NIP pegawai barunya sudah ada. Dokumen usulan yang disetujui juga dipakai tab
// Dokumen, linimasa SK, dan bawaan usulan berikutnya, sehingga akan hilang dari sana bila statusnya dibuka lagi.
//
// Karena itu yang dikembalikan bukan usulan lamanya, melainkan sebuah usulan perbaikan baru berstatus "revisi" yang
// sudah terisi sesuai data pegawai saat ini. Usulan lama tetap Selesai sebagai riwayat dan sumber dokumennya; data
// pegawai tidak diubah sebelum perbaikan UPT disetujui; yang disetujui kelak hanya selisihnya terhadap data saat itu.
// Dari sisi UPT ia sama dengan usulan yang dikembalikan biasa: muncul di daftar kerja beserta catatan Kanwil, isiannya
// dapat disunting, berkas dari usulan yang disetujui terbawa otomatis, dan dikirim ulang lewat jalur yang sama.

import { db } from "./db";
import { newId } from "./sheets/id";
import { notifikasiUsulanRevisi } from "./generateNotifikasi";
import { BELUM_SELESAI, BIDANG_USULAN } from "./usulanPegawai";
import { bawaanPegawai } from "./bawaanUsulan";
import { pegawaiSatker } from "./aksesUpt";
import { TANPA_SK_BARU } from "./dasarBaruUsulan";
import { SATKER } from "./satker";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";

export type HasilKembalikanDisetujui =
  | { ok: true; id: string; nama: string; nip: string }
  | { ok: false; status: number; pesan: string };

const gagal = (status: number, pesan: string): HasilKembalikanDisetujui => ({ ok: false, status, pesan });

/** Keadaan usulan berjalan pegawai dalam kalimat, supaya peninjau tahu apa yang harus diselesaikan lebih dulu. */
const KEADAAN_BERJALAN: Record<string, string> = {
  draf: "sedang disiapkan UPT dan belum diajukan",
  menunggu: "menunggu tinjauan Kanwil; setujui atau kembalikan yang itu lebih dulu",
  revisi: "sedang diperbaiki UPT sesudah dikembalikan",
};

export async function kembalikanUsulanDisetujui(input: {
  usulan: UsulanPegawaiRow;
  catatan: string;
  /** "Nama (NIP)" peninjau. */
  oleh: string;
  sekarang: Date;
}): Promise<HasilKembalikanDisetujui> {
  const { usulan, catatan, oleh, sekarang } = input;

  // Usulan pegawai baru yang disetujui sebelum pegawaiId dicatat saat persetujuan dikenali dari NIP-nya.
  const pegawai = (
    usulan.pegawaiId
      ? await db.pegawai.findUnique({ id: usulan.pegawaiId })
      : usulan.nip
        ? await db.pegawai.findUnique({ nip: usulan.nip })
        : null
  ) as PegawaiRow | null;
  if (!pegawai) return gagal(404, "Data pegawai dari usulan ini tidak ditemukan, jadi tidak ada yang dapat diperbaiki UPT.");

  // UPT hanya melihat pegawai satkernya; pegawai yang sudah dimutasi tidak dapat diperbaiki dari sana.
  if (pegawaiSatker([pegawai], usulan.satker).length === 0) {
    const namaSatker = SATKER.find((s) => s.kode === usulan.satker)?.nama ?? usulan.satker;
    return gagal(409, `${pegawai.nama} sudah tidak tercatat di ${namaSatker}, jadi UPT itu tidak dapat memperbaiki datanya. Betulkan langsung di Data Pegawai.`);
  }

  // Satu pegawai hanya boleh punya satu usulan yang belum selesai (antrian tinjauan tidak boleh memuat dua versi orang yang sama).
  const berjalan = (await db.usulanPegawai.findMany({
    where: { pegawaiId: pegawai.id, status: { in: [...BELUM_SELESAI] } },
  })) as UsulanPegawaiRow[];
  if (berjalan.length > 0)
    return gagal(409, `${pegawai.nama} sudah punya usulan yang ${KEADAAN_BERJALAN[berjalan[0].status] ?? "belum selesai"}.`);

  // SK dasar yang terbawa ke usulan berikutnya: dari data pegawai, atau usulan disetujui terakhir yang memuatnya.
  const disetujui = (await db.usulanPegawai.findMany({ where: { pegawaiId: pegawai.id, status: "disetujui" } })) as UsulanPegawaiRow[];
  const bawaan = bawaanPegawai(pegawai, disetujui);

  // Seluruh kolom data diisi dari data pegawai saat ini, termasuk kolom hitungan, sehingga usulan perbaikan ini mulai
  // dari "tidak ada selisih" dan UPT hanya menyunting yang memang keliru. Yang sudah dibetulkan Kanwil langsung di
  // Data Pegawai ikut terbaca di sini. Menyalin isian lama justru akan mengembalikan nilai yang keliru, dan masa kerja
  // golongan pada usulan lama (sebelum SK dihitung) bukan lagi angka yang berlaku.
  const isian: Record<string, unknown> = {};
  for (const bidang of BIDANG_USULAN) isian[bidang.kunci] = pegawai[bidang.kunci] ?? null;

  const baris: UsulanPegawaiRow = {
    id: newId(),
    pegawaiId: pegawai.id,
    satker: usulan.satker,
    status: "revisi",
    // Pegawainya sudah tercatat, jadi tinjauan berikutnya membandingkan dengan data pegawai, bukan mengusulkan orang baru.
    jenis: "perubahan",
    nip: null,
    unitKerja: null,
    nomorSurat: usulan.nomorSurat,
    tanggalSurat: usulan.tanggalSurat,
    // Berkas tidak disalin: usulan perbaikan membawa berkas dari usulan yang disetujui (bawaan), dan disalin saat
    // UPT menyimpan atau mengajukannya. Surat usulan diunggah ulang saat mengajukan.
    pathBerkas: null,
    pathSkTerakhir: null,
    pathSyaratCpns: null,
    pathSkPangkat: null,
    pathSkCpns: null,
    pathSkPmk: null,
    nama: null, tempatLahir: null, tanggalLahir: null, jenisKelamin: null,
    pendidikanTerakhir: null, jabatan: null, pangkat: null, golonganRuang: null,
    eselon: null, jenisJabatan: null, tmtGolongan: null,
    mkgTahun: null, mkgBulan: null, gajiPokok: null,
    tmtKgbTerakhir: null, tmtKgbBerikutnya: null,
    nomorSkTerakhir: bawaan.nomorSkTerakhir,
    tanggalSkTerakhir: bawaan.tanggalSkTerakhir,
    // SK kenaikan pangkat atau PMK pada usulan lama sudah tercatat sebagai riwayat dan dibetulkan lewat Ubah data SK,
    // bukan dicatat ulang: jawabannya di sini "tidak ada SK baru yang belum tercatat". UPT dapat menggantinya bila
    // memang ada SK lain sesudahnya.
    dasarBaruJenis: TANPA_SK_BARU,
    dasarBaruJenisKp: null,
    dasarBaruNomorSk: null,
    dasarBaruTanggalSk: null,
    dasarBaruTmt: null,
    dasarBaruPenetap: null,
    // Laporan hukuman disiplin pada usulan lama sudah ditindaklanjuti di modulnya; tidak dilaporkan dua kali.
    hukdisAda: false,
    hukdisJenis: null,
    hukdisNomorSk: null,
    hukdisTmtMulai: null,
    hukdisTmtBerakhir: null,
    hukdisKeterangan: null,
    catatanUpt: null,
    diajukanOleh: usulan.diajukanOleh,
    diajukanAt: sekarang,
    ditinjauOleh: oleh,
    ditinjauAt: sekarang,
    // Catatan peninjau menumpang kolom alasanTolak, sama dengan usulan yang dikembalikan sebelum disetujui.
    alasanTolak: catatan,
    ...isian,
  };
  await db.usulanPegawai.create(baris);

  try {
    await db.notifikasi.create({
      ...notifikasiUsulanRevisi(
        { id: baris.id, satker: usulan.satker, nomorSurat: usulan.nomorSurat },
        { nama: pegawai.nama, nip: pegawai.nip },
        catatan,
        { sudahDisetujui: true },
      ),
      id: newId(),
      dibaca: false,
      createdAt: sekarang,
    });
  } catch {
    // Usulan perbaikannya sudah ada di daftar kerja UPT; loncengnya saja yang tidak jadi.
  }

  return { ok: true, id: baris.id, nama: pegawai.nama, nip: pegawai.nip };
}
