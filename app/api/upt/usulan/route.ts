import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { pegawaiSatker, satkerAkunUpt } from "@/lib/aksesUpt";
import { BIDANG_USULAN, bandingkanUsulan, usulanKosong } from "@/lib/usulanPegawai";
import { adaPenandaPdf, bacaTanggalInput } from "@/lib/prosesKgb";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";
import type { Session } from "next-auth";

export const runtime = "nodejs";

/** Surat usulan jauh lebih kecil dari SK; batasnya dibuat lebih ketat agar unggahan salah cepat tertolak. */
const BATAS_BERKAS_BYTE = 5 * 1024 * 1024;
const PESAN_TERLALU_BESAR = "Ukuran berkas surat paling besar 5 MB.";

/** Satker akun yang login; null bila akunnya bukan Admin UPT yang tertaut satker. */
async function satkerAkun(session: Session | null) {
  if (!session) return { galat: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return { galat: NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 }) };
  const kode = satkerAkunUpt({ role: pengguna.role, satker: pengguna.satker });
  if (!kode)
    return {
      galat: NextResponse.json(
        { error: "Usulan hanya dapat dikirim akun Admin UPT yang tertaut ke satker." },
        { status: 403 },
      ),
    };
  return { pengguna, kode };
}

/** Usulan yang pernah dikirim satker ini, terbaru lebih dulu. */
export async function GET() {
  await muatBatasInputSdm();
  const akun = await satkerAkun(await auth());
  if ("galat" in akun) return akun.galat;

  const [semuaUsulan, semuaPegawai] = await Promise.all([
    db.usulanPegawai.findMany({ where: { satker: akun.kode } }) as Promise<UsulanPegawaiRow[]>,
    db.pegawai.findMany(),
  ]);
  const pegawaiById = new Map(semuaPegawai.map((p) => [p.id, p]));

  const daftar = semuaUsulan
    .map((u) => {
      const p = pegawaiById.get(u.pegawaiId);
      return {
        id: u.id,
        pegawaiId: u.pegawaiId,
        nama: p?.nama ?? "-",
        nip: p?.nip ?? "-",
        status: u.status,
        nomorSurat: u.nomorSurat,
        tanggalSurat: u.tanggalSurat ? new Date(u.tanggalSurat).toISOString() : null,
        berkasAda: !!u.pathBerkas,
        hukdisAda: !!u.hukdisAda,
        jumlahPerubahan: p ? bandingkanUsulan(p, u).length : 0,
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

/** Kirim usulan baru. Berkas surat opsional; nomor dan tanggal surat wajib. */
export async function POST(req: Request) {
  await muatBatasInputSdm();
  const akun = await satkerAkun(await auth());
  if ("galat" in akun) return akun.galat;
  const { pengguna, kode } = akun;

  const panjangIsi = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjangIsi) && panjangIsi > BATAS_BERKAS_BYTE + 64 * 1024)
    return NextResponse.json({ error: PESAN_TERLALU_BESAR }, { status: 413 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data usulan tidak valid" }, { status: 400 });
  }

  const teks = (kunci: string) => (form.get(kunci) as string | null)?.trim() || "";
  const pegawaiId = teks("pegawaiId");
  const nomorSurat = teks("nomorSurat");
  const tanggalSuratTeks = teks("tanggalSurat");
  if (!pegawaiId) return NextResponse.json({ error: "Pegawai wajib dipilih" }, { status: 400 });
  if (!nomorSurat) return NextResponse.json({ error: "Nomor surat usulan wajib diisi" }, { status: 400 });
  const tanggalSurat = tanggalSuratTeks ? bacaTanggalInput(tanggalSuratTeks) : null;
  if (!tanggalSurat) return NextResponse.json({ error: "Tanggal surat usulan wajib diisi dan harus valid" }, { status: 400 });

  const pegawai = await db.pegawai.findUnique({ id: pegawaiId });
  // Pegawai satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
  if (!pegawai || pegawaiSatker([pegawai], kode).length === 0)
    return NextResponse.json({ error: "Pegawai tidak ditemukan di satker ini" }, { status: 404 });

  // Isian kosong menjadi null: berarti UPT tidak mengusulkan perubahan pada kolom itu. Angka nol tetap
  // nilai yang sah, misalnya masa kerja golongan 0 tahun bagi pegawai yang belum pernah KGB.
  const isian: Partial<UsulanPegawaiRow> = {};
  const setIsian = (kunci: string, nilai: unknown) => { (isian as Record<string, unknown>)[kunci] = nilai; };
  for (const bidang of BIDANG_USULAN) {
    const mentah = teks(bidang.kunci);
    if (!mentah) {
      setIsian(bidang.kunci, null);
      continue;
    }
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

  const hukdisAda = teks("hukdisAda") === "true";
  const hukdisTmtMulaiTeks = teks("hukdisTmtMulai");
  const hukdisTmtBerakhirTeks = teks("hukdisTmtBerakhir");
  const hukdisTmtMulai = hukdisTmtMulaiTeks ? bacaTanggalInput(hukdisTmtMulaiTeks) : null;
  const hukdisTmtBerakhir = hukdisTmtBerakhirTeks ? bacaTanggalInput(hukdisTmtBerakhirTeks) : null;
  if (hukdisTmtMulaiTeks && !hukdisTmtMulai)
    return NextResponse.json({ error: "TMT mulai hukuman disiplin tidak valid" }, { status: 400 });
  if (hukdisTmtBerakhirTeks && !hukdisTmtBerakhir)
    return NextResponse.json({ error: "TMT berakhir hukuman disiplin tidak valid" }, { status: 400 });

  const calon: Partial<UsulanPegawaiRow> = { ...isian, hukdisAda };
  if (usulanKosong(pegawai, calon))
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

  // Berkas disimpan setelah semua pemeriksaan lolos, agar permintaan yang ditolak tidak meninggalkan objek di R2.
  let pathBerkas: string | null = null;
  const berkas = form.get("berkas");
  if (berkas instanceof File && berkas.size > 0) {
    if (berkas.type !== "application/pdf")
      return NextResponse.json({ error: "Berkas surat harus PDF" }, { status: 400 });
    if (berkas.size > BATAS_BERKAS_BYTE)
      return NextResponse.json({ error: PESAN_TERLALU_BESAR }, { status: 413 });
    if (!adaPenandaPdf(new Uint8Array(await berkas.slice(0, 1024).arrayBuffer())))
      return NextResponse.json({ error: "Berkas yang diunggah bukan PDF yang valid" }, { status: 400 });
    pathBerkas = `usulan/${kode}_${Date.now()}.pdf`;
    try {
      const { env } = await getCloudflareContext({ async: true });
      await env.SK_BUCKET.put(pathBerkas, await berkas.arrayBuffer(), {
        httpMetadata: { contentType: "application/pdf" },
      });
    } catch {
      return NextResponse.json({ error: "Gagal menyimpan berkas surat. Coba lagi." }, { status: 500 });
    }
  }

  const baris: UsulanPegawaiRow = {
    id: newId(),
    pegawaiId,
    satker: kode,
    status: "menunggu",
    nomorSurat,
    tanggalSurat,
    pathBerkas,
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

  const jumlah = bandingkanUsulan(pegawai, baris).length;
  logAudit({
    userId: pengguna.id,
    aksi: "usul_data_pegawai",
    detail: `Usulan data ${pegawai.nama} (${pegawai.nip}) dari ${kode}, surat ${nomorSurat}: ${jumlah} kolom diusulkan berubah${hukdisAda ? ", disertai laporan hukuman disiplin" : ""}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true, id: baris.id, jumlahPerubahan: jumlah }, { status: 201 });
}
