import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { akunUpt } from "@/lib/auth/akunUpt";
import { logAudit } from "@/lib/auditLog";
import { notifikasiUsulanUpt } from "@/lib/generateNotifikasi";
import { pegawaiSatker } from "@/lib/aksesUpt";
import { BELUM_SELESAI, BERKAS_USULAN, BIDANG_USULAN, DIPEGANG_UPT, bandingkanUsulan, kekuranganUsulan, usulanKosong, namaAsliBerkas } from "@/lib/usulanPegawai";
import { bacaIsianUsulan, isiHitungan, nilaiFormulir, tanggalIsian } from "@/lib/usulanFormulir";
import { bacaTanggalInput } from "@/lib/prosesKgb";
import { BATAS_BERKAS_BYTE, PESAN_TERLALU_BESAR, simpanBerkasUsulan } from "@/lib/berkasUsulan";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { SATKER } from "@/lib/satker";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

const PESAN_BUKAN_UPT = "Usulan hanya dapat dikirim akun Admin UPT yang tertaut ke satker.";

/**
 * Sebab usulan baru ditolak ketika pegawainya masih punya usulan berjalan. Statusnya disebutkan, sebab
 * ketiganya menuntut langkah yang berbeda: melanjutkan draf, memperbaiki yang dikembalikan, atau menunggu.
 */
function pesanMasihBerjalan(status: string, subjek: string): string {
  if (status === "draf") return `${subjek} sudah disiapkan usulannya dan belum diajukan. Lanjutkan yang itu, jangan membuat yang baru.`;
  if (status === "revisi") return `${subjek} punya usulan yang dikembalikan Kanwil untuk diperbaiki. Perbaiki yang itu lalu kirim ulang.`;
  return `${subjek} punya usulan yang masih menunggu tinjauan Kanwil. Tunggu hasilnya lebih dulu.`;
}

/** Usulan dan draf satker ini, terbaru lebih dulu. */
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
        berkas: BERKAS_USULAN.filter((b) => u[b.kunci]).map((b) => ({ medan: b.medan, label: b.label, nama: namaAsliBerkas(u[b.kunci]) })),
        hukdisAda: !!u.hukdisAda,
        // Dibandingkan dengan data induk sekarang, jadi hanya bermakna sebelum ditinjau: sesudah disetujui
        // data induk sudah sama dengan usulannya, dan angkanya menjadi 0 atau menyesatkan.
        jumlahPerubahan: !BELUM_SELESAI.includes(u.status)
          ? null
          : u.jenis === "baru" ? BIDANG_USULAN.length : p ? bandingkanUsulan(p, u).length : 0,
        // Apa yang masih kurang sebelum draf ini boleh diajukan; kosong berarti siap.
        kekurangan: DIPEGANG_UPT.includes(u.status) ? kekuranganUsulan(u, u.jenis, p) : [],
        // Isi dikirim utuh agar formulirnya dapat dilanjutkan, baik draf maupun usulan yang
        // dikembalikan Kanwil; usulan yang sedang ditinjau atau sudah selesai tidak perlu.
        nilai: DIPEGANG_UPT.includes(u.status) ? nilaiFormulir(u) : null,
        surat: DIPEGANG_UPT.includes(u.status)
          ? {
              nomorSurat: u.nomorSurat ?? "",
              tanggalSurat: tanggalIsian(u.tanggalSurat),
              nomorSkTerakhir: u.nomorSkTerakhir ?? "",
              tanggalSkTerakhir: tanggalIsian(u.tanggalSkTerakhir),
              catatanUpt: u.catatanUpt ?? "",
            }
          : null,
        hukdis: DIPEGANG_UPT.includes(u.status)
          ? {
              ada: !!u.hukdisAda,
              jenis: u.hukdisJenis ?? "",
              nomorSk: u.hukdisNomorSk ?? "",
              tmtMulai: tanggalIsian(u.hukdisTmtMulai),
              tmtBerakhir: tanggalIsian(u.hukdisTmtBerakhir),
              keterangan: u.hukdisKeterangan ?? "",
            }
          : null,
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
 * Simpan data pegawai sebagai draf, atau kirim usulannya sekaligus.
 *
 * UPT mendata dulu, mengusulkan belakangan: satu surat usulan lazimnya memuat beberapa pegawai, dan
 * datanya dilengkapi bertahap dari SK yang tidak selalu ada di meja. Karena itu `status` menentukan
 * dua perlakuan yang berbeda. Draf tidak menuntut surat dan tidak pernah terlihat Kanwil; usulan
 * yang dikirim menuntut surat lengkap dan langsung memunculkan notifikasi bagi Tim SDM.
 *
 * Gaji pokok, pangkat, dan TMT KGB berikutnya tidak dibaca dari formulir melainkan dihitung di sini
 * (lib/usulanFormulir.ts), sebab salah ketik pada angka itu langsung menggeser uang.
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
  const draf = teks("status") === "draf";

  const nomorSurat = teks("nomorSurat");
  const tanggalSurat = teks("tanggalSurat") ? bacaTanggalInput(teks("tanggalSurat")) : null;
  if (!draf) {
    if (!nomorSurat) return NextResponse.json({ error: "Nomor surat usulan wajib diisi" }, { status: 400 });
    if (!tanggalSurat) return NextResponse.json({ error: "Tanggal surat usulan wajib diisi dan harus valid" }, { status: 400 });
  }
  if (teks("tanggalSurat") && !tanggalSurat)
    return NextResponse.json({ error: "Tanggal surat tidak valid" }, { status: 400 });

  const dibaca = bacaIsianUsulan(form);
  if ("galat" in dibaca) return NextResponse.json({ error: dibaca.galat }, { status: 400 });

  let pegawaiId: string | null = null;
  let nipBaru: string | null = null;
  let namaUntukCatatan = "";
  let nipUntukCatatan = "";
  let dasar: Awaited<ReturnType<typeof db.pegawai.findUnique>> = null;

  if (jenis === "baru") {
    // NIP menjadi penanda draf pegawai baru, jadi wajib sejak draf pertama disimpan.
    nipBaru = teks("nip");
    if (!/^\d{18}$/.test(nipBaru)) return NextResponse.json({ error: "NIP harus tepat 18 digit angka" }, { status: 400 });
    const bentrokPegawai = await db.pegawai.findUnique({ nip: nipBaru });
    if (bentrokPegawai)
      return NextResponse.json({ error: `NIP ${nipBaru} sudah tercatat atas nama ${bentrokPegawai.nama}` }, { status: 409 });
    const sudahAda = (await db.usulanPegawai.findMany({
      where: { nip: nipBaru, status: { in: BELUM_SELESAI } },
    })) as UsulanPegawaiRow[];
    if (sudahAda.length > 0)
      return NextResponse.json({ error: pesanMasihBerjalan(sudahAda[0].status, `NIP ${nipBaru}`) }, { status: 409 });
    namaUntukCatatan = String(dibaca.isian.nama ?? nipBaru);
    nipUntukCatatan = nipBaru;
  } else {
    pegawaiId = teks("pegawaiId");
    if (!pegawaiId) return NextResponse.json({ error: "Pegawai wajib dipilih" }, { status: 400 });
    const pegawai = await db.pegawai.findUnique({ id: pegawaiId });
    // Pegawai satker lain dijawab sama dengan yang tidak ada, agar keberadaannya tidak terbaca dari luar.
    if (!pegawai || pegawaiSatker([pegawai], kode).length === 0)
      return NextResponse.json({ error: "Pegawai tidak ditemukan di satker ini" }, { status: 404 });
    dasar = pegawai;
    namaUntukCatatan = pegawai.nama;
    nipUntukCatatan = pegawai.nip;

    const sudahAda = await db.usulanPegawai.findMany({ where: { pegawaiId, status: { in: BELUM_SELESAI } } });
    if (sudahAda.length > 0)
      return NextResponse.json(
        { error: pesanMasihBerjalan((sudahAda[0] as UsulanPegawaiRow).status, "Pegawai ini") },
        { status: 409 },
      );
  }

  const isian = isiHitungan(dibaca.isian, dasar);
  const hukdisAda = teks("hukdisAda") === "true";

  if (!draf) {
    const kurang = kekuranganUsulan({ ...isian, nip: nipBaru, nama: isian.nama ?? null }, jenis, dasar);
    if (kurang.length > 0)
      return NextResponse.json({ error: `Belum lengkap: ${kurang.join(", ")}.` }, { status: 400 });
    if (jenis === "perubahan" && dasar && usulanKosong(dasar, { ...isian, hukdisAda }))
      return NextResponse.json(
        { error: "Tidak ada yang diusulkan: semua isian sama dengan data yang tercatat, dan tidak ada laporan hukuman disiplin." },
        { status: 400 },
      );
  }

  const hukdisTmtMulai = teks("hukdisTmtMulai") ? bacaTanggalInput(teks("hukdisTmtMulai")) : null;
  const hukdisTmtBerakhir = teks("hukdisTmtBerakhir") ? bacaTanggalInput(teks("hukdisTmtBerakhir")) : null;
  if (teks("hukdisTmtMulai") && !hukdisTmtMulai)
    return NextResponse.json({ error: "TMT mulai hukuman disiplin tidak valid" }, { status: 400 });
  if (teks("hukdisTmtBerakhir") && !hukdisTmtBerakhir)
    return NextResponse.json({ error: "TMT berakhir hukuman disiplin tidak valid" }, { status: 400 });

  // Berkas disimpan setelah semua pemeriksaan lolos, agar permintaan yang ditolak tidak meninggalkan objek di R2.
  const berkas = await simpanBerkasUsulan(form, kode);
  if ("galat" in berkas) return berkas.galat;

  const baris: UsulanPegawaiRow = {
    id: newId(),
    pegawaiId,
    satker: kode,
    status: draf ? "draf" : "menunggu",
    jenis,
    nip: nipBaru,
    unitKerja: jenis === "baru" ? satker.nama : null,
    nomorSurat,
    tanggalSurat,
    pathBerkas: berkas.jalur.pathBerkas ?? null,
    pathSkTerakhir: berkas.jalur.pathSkTerakhir ?? null,
    pathSyaratCpns: berkas.jalur.pathSyaratCpns ?? null,
    pathSkPangkat: berkas.jalur.pathSkPangkat ?? null,
    pathSkCpns: berkas.jalur.pathSkCpns ?? null,
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

  if (!draf) {
    // Notifikasi dibuat di sini, bukan menunggu pemeriksaan berkala, supaya Tim SDM Kanwil melihat usulan
    // pada saat UPT mengirimnya. Kegagalannya tidak boleh membatalkan usulan yang sudah tersimpan:
    // pemeriksaan berkala membuatkan notifikasinya belakangan.
    try {
      await db.notifikasi.create({
        ...notifikasiUsulanUpt(baris, { nama: namaUntukCatatan, nip: nipUntukCatatan }),
        id: newId(),
        dibaca: false,
        createdAt: new Date(),
      });
    } catch {
      // Usulannya sudah tersimpan; notifikasinya menyusul lewat pemeriksaan berkala.
    }
  }

  logAudit({
    userId: pengguna.id,
    aksi: draf ? "simpan_draf_pegawai" : "usul_data_pegawai",
    detail: draf
      ? `Draf data ${namaUntukCatatan} (${nipUntukCatatan}) disiapkan ${satker.nama}`
      : jenis === "baru"
        ? `Usulan pegawai baru ${namaUntukCatatan} (${nipBaru}) dari ${satker.nama}, surat ${nomorSurat}${hukdisAda ? ", disertai laporan hukuman disiplin" : ""}`
        : `Usulan data ${namaUntukCatatan} dari ${satker.nama}, surat ${nomorSurat}${hukdisAda ? ", disertai laporan hukuman disiplin" : ""}`,
    targetNama: namaUntukCatatan,
  });

  return NextResponse.json({ ok: true, id: baris.id, jenis, status: baris.status }, { status: 201 });
}
