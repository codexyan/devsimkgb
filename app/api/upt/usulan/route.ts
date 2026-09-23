import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { notifikasiUsulanUpt } from "@/lib/generateNotifikasi";
import { pegawaiSatker } from "@/lib/aksesUpt";
import { BERKAS_USULAN, BIDANG_USULAN, bandingkanUsulan, usulanKosong } from "@/lib/usulanPegawai";
import { adaPenandaPdf, bacaTanggalInput } from "@/lib/prosesKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { SATKER } from "@/lib/satker";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Usulan hanya dapat dikirim akun Admin UPT yang tertaut ke satker.";

/** Surat dan SK jauh lebih kecil dari SK bertanda tangan; batasnya dibuat lebih ketat per berkas. */
const BATAS_BERKAS_BYTE = 5 * 1024 * 1024;
const PESAN_TERLALU_BESAR = "Ukuran tiap berkas paling besar 5 MB.";

/** Usulan yang pernah dikirim satker ini, terbaru lebih dulu. */
export async function GET() {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;

  const [semuaUsulan, semuaPegawai] = await Promise.all([
    db.usulanPegawai.findMany({ where: { satker: akun.kode } }) as Promise<UsulanPegawaiRow[]>,
    db.pegawai.findMany(),
  ]);
  const pegawaiById = new Map(semuaPegawai.map((p) => [p.id, p]));

  const daftar = semuaUsulan
    .map((u) => {
      const p = u.pegawaiId ? pegawaiById.get(u.pegawaiId) : null;
      return {
        id: u.id,
        pegawaiId: u.pegawaiId,
        jenis: u.jenis,
        nama: p?.nama ?? u.nama ?? "-",
        nip: p?.nip ?? u.nip ?? "-",
        status: u.status,
        nomorSurat: u.nomorSurat,
        tanggalSurat: u.tanggalSurat ? new Date(u.tanggalSurat).toISOString() : null,
        berkas: BERKAS_USULAN.filter((b) => u[b.kunci]).map((b) => b.label),
        hukdisAda: !!u.hukdisAda,
        jumlahPerubahan: u.jenis === "baru" ? BIDANG_USULAN.length : p ? bandingkanUsulan(p, u).length : 0,
        diajukanAt: u.diajukanAt ? new Date(u.diajukanAt).toISOString() : null,
        diajukanOleh: u.diajukanOleh,
        ditinjauAt: u.ditinjauAt ? new Date(u.ditinjauAt).toISOString() : null,
        ditinjauOleh: u.ditinjauOleh,
        alasanTolak: u.alasanTolak,
      };
    })
    .sort((a, b) => (b.diajukanAt ?? "").localeCompare(a.diajukanAt ?? ""));

  return NextResponse.json(daftar);
}

/**
 * Kirim usulan baru, untuk pegawai yang sudah tercatat (jenis "perubahan") maupun pegawai yang belum
 * ada di SIM-KGB (jenis "baru", mis. CPNS yang baru dilantik). Nomor dan tanggal surat wajib; berkas
 * dasarnya opsional di sisi sistem, tetapi diminta tim keuangan agar masa kerja golongan dapat dicocokkan.
 */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  const akun = await akunUpt(await auth(), PESAN_BUKAN_UPT);
  if ("galat" in akun) return akun.galat;
  const { pengguna, kode } = akun;
  const satker = SATKER.find((s) => s.kode === kode)!;

  const panjangIsi = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjangIsi) && panjangIsi > BERKAS_USULAN.length * BATAS_BERKAS_BYTE + 64 * 1024)
    return NextResponse.json({ error: PESAN_TERLALU_BESAR }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data usulan tidak valid" }, { status: 400 });
  }

  const teks = (kunci: string) => (form.get(kunci) as string | null)?.trim() || "";
  const jenis = teks("jenis") === "baru" ? "baru" : "perubahan";
  const nomorSurat = teks("nomorSurat");
  if (!nomorSurat) return NextResponse.json({ error: "Nomor surat usulan wajib diisi" }, { status: 400 });
  const tanggalSurat = teks("tanggalSurat") ? bacaTanggalInput(teks("tanggalSurat")) : null;
  if (!tanggalSurat) return NextResponse.json({ error: "Tanggal surat usulan wajib diisi dan harus valid" }, { status: 400 });

  // Isian kosong menjadi null: pada usulan perubahan berarti kolom itu tidak diusulkan berubah.
  // Angka nol tetap nilai yang sah, misalnya masa kerja golongan 0 tahun bagi pegawai yang belum pernah KGB.
  const isian: Partial<UsulanPegawaiRow> = {};
  const setIsian = (kunci: string, nilai: unknown) => { (isian as Record<string, unknown>)[kunci] = nilai; };
  for (const bidang of BIDANG_USULAN) {
    const mentah = teks(bidang.kunci);
    if (!mentah) { setIsian(bidang.kunci, null); continue; }
    if (bidang.jenis === "tanggal") {
      const t = bacaTanggalInput(mentah);
      if (!t) return NextResponse.json({ error: `${bidang.label} tidak valid` }, { status: 400 });
      setIsian(bidang.kunci, t);
      continue;
    }
    if (bidang.jenis === "angka" || bidang.jenis === "rupiah") {
      const n = Number(mentah.replace(/[^\d]/g, ""));
      if (!Number.isFinite(n)) return NextResponse.json({ error: `${bidang.label} harus berupa angka` }, { status: 400 });
      setIsian(bidang.kunci, n);
      continue;
    }
    setIsian(bidang.kunci, mentah);
  }

  let pegawaiId: string | null = null;
  let nipBaru: string | null = null;
  let namaUntukCatatan = "";
  let nipUntukCatatan = "";

  if (jenis === "baru") {
    // Pegawai yang belum tercatat: identitasnya berasal dari usulan ini, jadi wajib lengkap.
    nipBaru = teks("nip");
    if (!/^\d{18}$/.test(nipBaru)) return NextResponse.json({ error: "NIP harus tepat 18 digit angka" }, { status: 400 });
    if (!isian.nama) return NextResponse.json({ error: "Nama lengkap wajib diisi" }, { status: 400 });
    if (!isian.golonganRuang) return NextResponse.json({ error: "Golongan ruang wajib diisi" }, { status: 400 });
    if (!isian.tmtKgbBerikutnya) return NextResponse.json({ error: "TMT KGB berikutnya wajib diisi" }, { status: 400 });
    const bentrokPegawai = await db.pegawai.findUnique({ nip: nipBaru });
    if (bentrokPegawai)
      return NextResponse.json({ error: `NIP ${nipBaru} sudah tercatat atas nama ${bentrokPegawai.nama}` }, { status: 409 });
    const usulanSama = (await db.usulanPegawai.findMany({ where: { nip: nipBaru, status: "menunggu" } })) as UsulanPegawaiRow[];
    if (usulanSama.length > 0)
      return NextResponse.json({ error: `Usulan untuk NIP ${nipBaru} masih menunggu tinjauan Kanwil` }, { status: 409 });
    namaUntukCatatan = String(isian.nama);
  } else {
    pegawaiId = teks("pegawaiId");
    if (!pegawaiId) return NextResponse.json({ error: "Pegawai wajib dipilih" }, { status: 400 });
    const pegawai = await db.pegawai.findUnique({ id: pegawaiId });
    // Pegawai satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
    if (!pegawai || pegawaiSatker([pegawai], kode).length === 0)
      return NextResponse.json({ error: "Pegawai tidak ditemukan di satker ini" }, { status: 404 });
    namaUntukCatatan = pegawai.nama;
    nipUntukCatatan = pegawai.nip;

    const hukdisAdaCek = teks("hukdisAda") === "true";
    if (usulanKosong(pegawai, { ...isian, hukdisAda: hukdisAdaCek }))
      return NextResponse.json(
        { error: "Tidak ada yang diusulkan: semua isian sama dengan data yang tercatat, dan tidak ada laporan hukuman disiplin." },
        { status: 400 },
      );
    // Satu usulan menunggu per pegawai, agar antrian tinjauan tidak berisi dua versi yang saling menimpa.
    const menunggu = await db.usulanPegawai.findMany({ where: { pegawaiId, status: "menunggu" } });
    if (menunggu.length > 0)
      return NextResponse.json(
        { error: "Masih ada usulan pegawai ini yang menunggu tinjauan Kanwil. Tunggu hasilnya lebih dulu." },
        { status: 409 },
      );
  }

  const hukdisAda = teks("hukdisAda") === "true";
  const hukdisTmtMulai = teks("hukdisTmtMulai") ? bacaTanggalInput(teks("hukdisTmtMulai")) : null;
  const hukdisTmtBerakhir = teks("hukdisTmtBerakhir") ? bacaTanggalInput(teks("hukdisTmtBerakhir")) : null;
  if (teks("hukdisTmtMulai") && !hukdisTmtMulai)
    return NextResponse.json({ error: "TMT mulai hukuman disiplin tidak valid" }, { status: 400 });
  if (teks("hukdisTmtBerakhir") && !hukdisTmtBerakhir)
    return NextResponse.json({ error: "TMT berakhir hukuman disiplin tidak valid" }, { status: 400 });

  // Berkas disimpan setelah semua pemeriksaan lolos, agar permintaan yang ditolak tidak meninggalkan objek di R2.
  const jalurBerkas: Partial<Record<(typeof BERKAS_USULAN)[number]["kunci"], string>> = {};
  for (const berkas of BERKAS_USULAN) {
    const isi = form.get(berkas.medan);
    if (!(isi instanceof File) || isi.size === 0) continue;
    if (isi.type !== "application/pdf")
      return NextResponse.json({ error: `${berkas.label} harus berupa PDF` }, { status: 400 });
    if (isi.size > BATAS_BERKAS_BYTE)
      return NextResponse.json({ error: PESAN_TERLALU_BESAR }, { status: 413 });
    if (!adaPenandaPdf(new Uint8Array(await isi.slice(0, 1024).arrayBuffer())))
      return NextResponse.json({ error: `${berkas.label} bukan PDF yang valid` }, { status: 400 });
    const jalur = `usulan/${kode}_${berkas.medan}_${Date.now()}.pdf`;
    try {
      const { env } = await getCloudflareContext({ async: true });
      await env.SK_BUCKET.put(jalur, await isi.arrayBuffer(), { httpMetadata: { contentType: "application/pdf" } });
    } catch {
      return NextResponse.json({ error: `Gagal menyimpan ${berkas.label}. Coba lagi.` }, { status: 500 });
    }
    jalurBerkas[berkas.kunci] = jalur;
  }

  const baris: UsulanPegawaiRow = {
    id: newId(),
    pegawaiId,
    satker: kode,
    status: "menunggu",
    jenis,
    nip: nipBaru,
    unitKerja: jenis === "baru" ? satker.nama : null,
    nomorSurat,
    tanggalSurat,
    pathBerkas: jalurBerkas.pathBerkas ?? null,
    pathSkTerakhir: jalurBerkas.pathSkTerakhir ?? null,
    pathSyaratCpns: jalurBerkas.pathSyaratCpns ?? null,
    pathSkPangkat: jalurBerkas.pathSkPangkat ?? null,
    nama: null, tempatLahir: null, tanggalLahir: null, jenisKelamin: null,
    pendidikanTerakhir: null, jabatan: null, pangkat: null, golonganRuang: null,
    eselon: null, jenisJabatan: null, tmtGolongan: null,
    mkgTahun: null, mkgBulan: null, gajiPokok: null,
    tmtKgbTerakhir: null, tmtKgbBerikutnya: null,
    nomorSkTerakhir: teks("nomorSkTerakhir") || null,
    tanggalSkTerakhir: teks("tanggalSkTerakhir") ? bacaTanggalInput(teks("tanggalSkTerakhir")) : null,
    hukdisAda,
    hukdisJenis: teks("hukdisJenis") || null,
    hukdisNomorSk: teks("hukdisNomorSk") || null,
    hukdisTmtMulai,
    hukdisTmtBerakhir,
    hukdisKeterangan: teks("hukdisKeterangan") || null,
    catatanUpt: teks("catatanUpt") || null,
    diajukanOleh: `${pengguna.nama} (${pengguna.nip})`,
    diajukanAt: new Date(),
    ditinjauOleh: null,
    ditinjauAt: null,
    alasanTolak: null,
    ...isian,
  };

  await db.usulanPegawai.create(baris);

  // Notifikasi dibuat di sini, bukan menunggu pemeriksaan berkala, supaya Tim SDM Kanwil melihat usulan
  // pada saat UPT mengirimnya. Kegagalannya tidak boleh membatalkan usulan yang sudah tersimpan:
  // pemeriksaan berkala membuatkan notifikasinya belakangan.
  try {
    await db.notifikasi.create({
      ...notifikasiUsulanUpt(baris, { nama: namaUntukCatatan, nip: nipUntukCatatan || nipBaru }),
      id: newId(),
      dibaca: false,
      createdAt: new Date(),
    });
  } catch {
    // Usulannya sudah tersimpan; notifikasinya menyusul lewat pemeriksaan berkala.
  }

  logAudit({
    userId: pengguna.id,
    aksi: "usul_data_pegawai",
    detail:
      jenis === "baru"
        ? `Usulan pegawai baru ${namaUntukCatatan} (${nipBaru}) dari ${satker.nama}, surat ${nomorSurat}${hukdisAda ? ", disertai laporan hukuman disiplin" : ""}`
        : `Usulan data ${namaUntukCatatan} dari ${satker.nama}, surat ${nomorSurat}${hukdisAda ? ", disertai laporan hukuman disiplin" : ""}`,
    targetNama: namaUntukCatatan,
  });

  return NextResponse.json({ ok: true, id: baris.id, jenis }, { status: 201 });
}
