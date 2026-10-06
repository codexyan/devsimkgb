// Penyimpanan dan pengiriman laporan SK KP/PI/PMK dari peramban (ADR-045, ADR-074), dipakai bersama kartu Laporkan per
// pegawai dan halaman Lapor KP/PI/PMK massal.
//
// Yang disimpan tetap usulan perbaikan yang sama (POST /api/upt/usulan, atau PATCH bila drafnya sudah ada), sebab
// Kanwil-lah yang mencatat riwayat KP atau PMK saat menyetujui (ADR-030). Karena rute PATCH menulis seluruh isian,
// seluruh nilai draf yang sudah ada dikirim kembali apa adanya dan hanya kolom yang memang ditetapkan SK yang ditimpa;
// tanpa itu, menyimpan laporan akan mengosongkan isian lain pada draf (data UPT hilang).

import { BIDANG_DIISI } from "@/lib/usulanFormulir";
import { berkasDasarBaru, berkasUntukKeadaan, pernahKgb } from "@/lib/usulanPegawai";
import { angkaLapor, type IsianLaporSk, type JenisLaporSk, type KeadaanTercatat } from "@/lib/laporSk";
import type { DrafUsulanUpt, PegawaiUntukUsulan } from "./FormulirUsulan";

/** Isi draf bila ada, selain itu data yang tercatat di SIM-KGB: dasar nilai yang dikirim ulang saat menyimpan. */
export function nilaiTercatat(pegawai: PegawaiUntukUsulan, draf: DrafUsulanUpt | null): Record<string, string> {
  return draf?.nilai ?? pegawai.dataSekarang ?? {};
}

/** Keadaan menurut isian draf, bila ada: dasar berkas yang ditagih, sebab server memeriksa usulan dengan nilai yang sama. */
export function keadaanTercatat(pegawai: PegawaiUntukUsulan, draf: DrafUsulanUpt | null): KeadaanTercatat {
  return keadaanDari(nilaiTercatat(pegawai, draf));
}

/**
 * Keadaan pegawai di data induk, bukan di draf. Inilah yang dipakai Kanwil sebagai golongan dan masa kerja "lama" saat
 * menyetujui (lib/dasarSkUsulan.ts), jadi pratinjau hitungan harus bertolak dari sini. Draf yang sudah memuat golongan
 * baru dari laporan ini tidak boleh dianggap golongan lama: pratinjau akan menolaknya karena "tidak lebih tinggi".
 */
export function keadaanInduk(pegawai: PegawaiUntukUsulan, draf: DrafUsulanUpt | null): KeadaanTercatat {
  return keadaanDari(pegawai.dataSekarang ?? nilaiTercatat(pegawai, draf));
}

function keadaanDari(n: Record<string, string>): KeadaanTercatat {
  return {
    golongan: n.golonganRuang ?? "",
    mkgTahun: angkaLapor(n.mkgTahun ?? "0"),
    mkgBulan: angkaLapor(n.mkgBulan ?? "0"),
    tmtKgbTerakhir: n.tmtKgbTerakhir ?? "",
  };
}

/**
 * Isian awal sebuah kartu: laporan SK yang sudah tersimpan pada draf dipakai kembali, supaya kembali ke halaman ini
 * tidak berarti mengetik ulang. Draf yang menyebut sebab lain (atau tidak menyebut apa pun) memberi isian kosong.
 */
export function isianDariDraf(draf: DrafUsulanUpt | null, jenisBawaan: JenisLaporSk = "kp"): IsianLaporSk {
  const kosong: IsianLaporSk = {
    jenis: jenisBawaan, jenisKp: "reguler", golonganBaru: "", mkgTahunSk: "", mkgBulanSk: "", nomorSk: "", tanggalSk: "", tmt: "", penetap: "",
  };
  const d = draf?.dasarBaru;
  if (!d || (d.jenis !== "kp" && d.jenis !== "pmk")) return kosong;
  const jenis: JenisLaporSk = d.jenis;
  return {
    jenis,
    jenisKp: d.jenisKp || "reguler",
    golonganBaru: jenis === "kp" ? draf?.nilai?.golonganRuang ?? "" : "",
    mkgTahunSk: jenis === "pmk" ? draf?.nilai?.mkgTahun ?? "" : "",
    mkgBulanSk: jenis === "pmk" ? draf?.nilai?.mkgBulan ?? "" : "",
    nomorSk: d.nomorSk ?? "",
    tanggalSk: d.tanggalSk ?? "",
    tmt: d.tmt ?? "",
    penetap: d.penetap ?? "",
  };
}

/**
 * Seluruh berkas yang akan ditagih saat laporan ini diajukan, bukan hanya SK yang sedang dilaporkan: perubahan yang
 * menyentuh golongan atau masa kerja golongan selalu disertai SK KGB terakhir dan SK kenaikan pangkat terakhir
 * (ADR-030). Dikumpulkan di satu tempat supaya satu jendela cukup.
 */
export function berkasDiminta(sekarang: KeadaanTercatat, jenis: JenisLaporSk) {
  return [...berkasUntukKeadaan(pernahKgb(sekarang.mkgTahun, sekarang.mkgBulan)), ...berkasDasarBaru(jenis)];
}

/** Berkas yang sudah ada untuk satu medan: unggahan pada draf, atau salinan dari usulan yang disetujui. */
export function berkasTersedia(pegawai: PegawaiUntukUsulan, draf: DrafUsulanUpt | null, medan: string) {
  return {
    draf: draf?.berkas.find((b) => b.medan === medan) ?? null,
    bawaan: pegawai.bawaan?.berkas.find((b) => b.medan === medan) ?? null,
  };
}

/** Berkas wajib yang belum ada di mana pun: belum dipilih, belum di draf, dan belum terbawa dari usulan lama. */
export function berkasBelumAda(
  pegawai: PegawaiUntukUsulan,
  draf: DrafUsulanUpt | null,
  sekarang: KeadaanTercatat,
  jenis: JenisLaporSk,
  dipilih: Record<string, File | null>,
) {
  return berkasDiminta(sekarang, jenis).filter((b) => {
    const ada = berkasTersedia(pegawai, draf, b.medan);
    return b.wajib && !dipilih[b.medan] && !ada.draf && !ada.bawaan;
  });
}

export type HasilSimpanLapor = { ok: true; id: string } | { ok: false; galat: string };

/** Simpan laporan sebagai draf usulan perbaikan; drafnya dibuat bila belum ada, atau diperbarui bila sudah. */
export async function simpanLaporSk(p: {
  pegawai: PegawaiUntukUsulan;
  draf: DrafUsulanUpt | null;
  isian: IsianLaporSk;
  berkas: Record<string, File | null>;
}): Promise<HasilSimpanLapor> {
  const { pegawai, draf, isian, berkas } = p;
  const sekarang = keadaanTercatat(pegawai, draf);
  const form = new FormData();
  // Disimpan sebagai draf lebih dulu, baru diajukan lewat rutenya sendiri bila diminta; nomor surat usulan memang
  // belum ada pada tahap ini.
  form.set("status", "draf");
  form.set("jenis", "perubahan");
  if (!draf) form.set("pegawaiId", pegawai.id);

  // Seluruh isian draf dikirim ulang apa adanya; rute menulis semua kolom, jadi yang tidak ikut akan terhapus. Yang
  // berubah hanya kolom yang memang ditetapkan SK ini.
  const nilai: Record<string, string> = { ...nilaiTercatat(pegawai, draf) };
  if (isian.jenis === "kp") nilai.golonganRuang = isian.golonganBaru;
  else {
    nilai.mkgTahun = String(angkaLapor(isian.mkgTahunSk));
    nilai.mkgBulan = String(angkaLapor(isian.mkgBulanSk));
  }
  for (const bidang of BIDANG_DIISI) form.set(bidang.kunci, nilai[bidang.kunci] ?? "");

  // SK dasar gaji pokok dan catatan pada draf dipertahankan, sebab rute menuliskannya juga.
  form.set("nomorSkTerakhir", draf?.surat?.nomorSkTerakhir ?? pegawai.bawaan?.nomorSkTerakhir ?? "");
  form.set("tanggalSkTerakhir", draf?.surat?.tanggalSkTerakhir ?? pegawai.bawaan?.tanggalSkTerakhir ?? "");
  form.set("catatanUpt", draf?.surat?.catatanUpt ?? "");

  form.set("dasarBaruJenis", isian.jenis);
  form.set("dasarBaruJenisKp", isian.jenis === "kp" ? isian.jenisKp : "");
  form.set("dasarBaruNomorSk", isian.nomorSk.trim());
  form.set("dasarBaruTanggalSk", isian.tanggalSk);
  form.set("dasarBaruTmt", isian.tmt);
  form.set("dasarBaruPenetap", isian.penetap.trim());
  for (const b of berkasDiminta(sekarang, isian.jenis)) {
    const dipilih = berkas[b.medan];
    if (dipilih) form.set(b.medan, dipilih);
  }

  try {
    const res = draf
      ? await fetch(`/api/upt/usulan/${draf.id}`, { method: "PATCH", body: form })
      : await fetch("/api/upt/usulan", { method: "POST", body: form });
    const d = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
    if (!res.ok) return { ok: false, galat: d.error ?? "Laporan gagal disimpan" };
    const id = draf?.id ?? d.id;
    if (!id) return { ok: false, galat: "Tersimpan sebagai draf, tetapi nomor drafnya tidak diterima. Kirim dari daftar Perlu dikerjakan." };
    return { ok: true, id };
  } catch {
    return { ok: false, galat: "Laporan gagal disimpan. Periksa sambungan lalu coba lagi." };
  }
}

/**
 * Ajukan satu draf laporan ke Kanwil. Laporan yang isinya murni SK kenaikan pangkat atau PMK berangkat tanpa surat
 * usulan (ADR-046); yang isinya lebih dari itu ditolak rute pengajuan dengan menyebut suratnya, dan drafnya tetap
 * tersimpan.
 */
export async function ajukanLaporSk(id: string): Promise<{ ok: true } | { ok: false; galat: string }> {
  try {
    const pengajuan = new FormData();
    pengajuan.append("id", id);
    const res = await fetch("/api/upt/usulan/ajukan", { method: "POST", body: pengajuan });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    // Drafnya sudah tersimpan, jadi tidak ada yang hilang; yang gagal hanya pengirimannya.
    if (!res.ok) return { ok: false, galat: `${d.error ?? "Pengiriman gagal"} Isiannya sudah tersimpan sebagai draf.` };
    return { ok: true };
  } catch {
    return { ok: false, galat: "Pengiriman gagal. Isiannya sudah tersimpan sebagai draf; kirim dari daftar Perlu dikerjakan." };
  }
}
