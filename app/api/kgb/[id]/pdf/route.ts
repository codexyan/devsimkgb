import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pesanUsulanMenahan, usulanMenahan } from "@/lib/usulanMenahan";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canProcessKGB, canViewKGB } from "@/lib/auth";
import { tentukanPenandatangan, type JenisPenandatangan } from "@/lib/penandatangan";
import { cariSatker, SATKER_KANWIL } from "@/lib/satker";
import { muatKppnSatker } from "@/lib/muatKppnSatker";
import { tanggalKalender } from "@/lib/waktu";
import { alasanTolakBuatSk, bacaTanggalInput, type SuratKgbTersimpan } from "@/lib/prosesKgb";
import type { HukdisUntukKgb } from "@/lib/prosesKgb";
import { periksaUlangKgb, pesanKgbBasi } from "@/lib/pemeriksaanUlangKgb";
import { hariIniWita, type NilaiTanggal } from "@/lib/waktu";
import { nomorSkBentrok } from "@/lib/nomorSkBentrok";
import { susunDataSuratKgb } from "@/lib/dataSuratKgbServer";
import { infoReviewSk, pegawaiPerluReviewSk, skBolehDicetak } from "@/lib/reviewSkUpt";
import { mintaReviewSk, muatReviewSk } from "@/lib/reviewSkUptServer";
import { cekSesuaiUsulan } from "@/lib/sesuaiUsulanServer";

export const runtime = "nodejs";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // KPPN tujuan SK mengikuti Pengaturan, bukan hanya daftar bawaan di lib/satker.ts.
  await muatKppnSatker();

  const url = new URL(req.url);
  const isPreview = url.searchParams.get("preview") === "true";
  const role = session.user.role!;
  // Daftar peran yang boleh: SDM Hukdis dan Admin UPT tidak pernah membuka SK di sini.
  if (!canViewKGB(role))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  if (!canProcessKGB(role) && !isPreview)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;

  let bodyData: { nomorSurat?: unknown; tanggalSurat?: unknown } = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === "object") bodyData = parsed as typeof bodyData;
  } catch { /* ok */ }
  const nomorSuratBody = typeof bodyData.nomorSurat === "string" ? bodyData.nomorSurat.trim() : "";
  const tanggalSuratBody = typeof bodyData.tanggalSurat === "string" ? bodyData.tanggalSurat.trim() : "";

  // Preview tanpa nomor & tanggal = unduh ulang surat tersimpan, apa adanya.
  const unduhUlang = isPreview && !(nomorSuratBody && tanggalSuratBody);

  const kgb = await db.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
  // SK hanya boleh dibuat (ulang) selama KGB Sedang Diproses, yaitu sesudah Input KGB dan sebelum SK final diunggah.
  const alasanTolak = isPreview ? null : alasanTolakBuatSk(kgb.status);
  if (alasanTolak)
    return NextResponse.json({ error: alasanTolak }, { status: 409 });
  if (!unduhUlang && !(kgb.nomorSK?.trim() && kgb.tanggalSK && kgb.tmtSK)) {
    return NextResponse.json(
      { error: "Data SK terakhir belum lengkap. Isi Nomor SK Terakhir, Tanggal SK Terakhir, dan TMT SK Terakhir sebelum membuat SK." },
      { status: 422 },
    );
  }
  if (!unduhUlang && !kgb.penetapSkDasar?.trim()) {
    return NextResponse.json(
      { error: "Pejabat penetap SK terakhir belum diisi. Lengkapi data SK terakhir sebelum membuat surat." },
      { status: 422 },
    );
  }

  const [pegawai, suratList, daftarPenandatangan] = await Promise.all([
    db.pegawai.findUnique({ id: kgb.pegawaiId }),
    db.suratKGB.findMany({
      where: { kgbId: id },
      orderBy: { field: "tanggalSurat", dir: "desc" },
    }) as Promise<SuratKgbTersimpan[]>,
    db.penandatangan.findMany(),
  ]);
  if (!pegawai)
    return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });
  // KGB yang dihitung sebelum SK kenaikan pangkat atau PMK dicatat masih memakai golongan dan gaji lama (ADR-062).
  // Pratinjau ikut ditolak karena isinya akan mencetak angka yang keliru; unduh ulang SK yang sudah ada tetap boleh.
  if (!unduhUlang) {
    const basi = pesanKgbBasi(kgb, pegawai);
    if (basi) return NextResponse.json({ error: basi }, { status: 409 });
  }
  // SK tidak dibuat selama usulan UPT pegawai ini belum ditinjau; pratinjau tetap boleh (ADR-014).
  if (!isPreview && (await usulanMenahan(pegawai.id)))
    return NextResponse.json({ error: pesanUsulanMenahan(pegawai.nama) }, { status: 409 });

  // Keadaan pegawai diperiksa ulang di sini, bukan hanya saat Input KGB: jarak input ke TMT sekitar dua
  // bulan, dan hukuman disiplin yang terbit di sela itu membuat SK ini tidak boleh terbit.
  if (!isPreview) {
    const hukdisRows = await db.riwayatHukdis.findMany({ where: { pegawaiId: pegawai.id } });
    const riwayatHukdis: HukdisUntukKgb[] = hukdisRows.map((h) => ({
      berdampakKGB: h.berdampakKGB === true,
      tmtBerakhir: h.tmtBerakhir as NilaiTanggal,
      tmtMulai: h.tmtMulai as NilaiTanggal,
    }));
    const periksa = periksaUlangKgb({
      tahap: "buat_sk",
      pegawai,
      riwayatHukdis,
      tmtKgb: kgb.tmtKgbBaru,
      hariIni: hariIniWita(),
    });
    if (periksa.tolak) return NextResponse.json({ error: periksa.tolak }, { status: 409 });
  }

  const existingSurat = suratList[0] ?? null;

  // SK dikirim ke KPPN mitra satker pegawai, juga saat unduh ulang. Unit kerja kosong berarti Kanwil,
  // sama dengan pembacaan data pegawai; unit kerja di luar daftar satker ditolak karena KPPN-nya tidak diketahui.
  const unitKerja = pegawai.unitKerja?.trim() ?? "";
  const satker = unitKerja ? cariSatker(unitKerja) : SATKER_KANWIL;
  if (!satker) {
    return NextResponse.json(
      {
        error: `Unit kerja "${unitKerja}" belum sesuai daftar satker, sehingga KPPN tujuan SK tidak dapat ditentukan. Pilih satker yang benar di Data Pegawai.`,
      },
      { status: 422 },
    );
  }

  let nomorSurat: string;
  let tanggalSurat: Date;
  if (unduhUlang) {
    const tersimpan = existingSurat?.tanggalSurat ? new Date(existingSurat.tanggalSurat) : null;
    if (!existingSurat || !tersimpan || Number.isNaN(tersimpan.getTime())) {
      return NextResponse.json({ error: "Belum ada surat yang digenerate" }, { status: 404 });
    }
    nomorSurat = existingSurat.nomorSurat;
    tanggalSurat = tersimpan;
  } else {
    if (!nomorSuratBody || !tanggalSuratBody) {
      return NextResponse.json({ error: "Nomor surat dan tanggal wajib diisi" }, { status: 400 });
    }
    const tanggal = bacaTanggalInput(tanggalSuratBody);
    if (!tanggal) {
      return NextResponse.json({ error: "Tanggal SK Baru tidak valid" }, { status: 400 });
    }
    nomorSurat = nomorSuratBody;
    tanggalSurat = tanggal;

    // Satu nomor dari arsiparis untuk satu SK, termasuk yang dipesan sebagai draf KGB lain. Diperiksa juga
    // saat pratinjau, agar nomor yang bentrok ketahuan sebelum operator menekan Buat dan Unduh SK.
    const bentrok = await nomorSkBentrok(nomorSurat, id);
    if (bentrok) return NextResponse.json({ error: bentrok }, { status: 409 });
  }

  let penandatangan: { id: string | null; jenis: JenisPenandatangan; jabatan: string; nama: string; nip: string };
  if (unduhUlang && existingSurat?.jabatanPenandatangan) {
    penandatangan = {
      id: existingSurat.penandatanganId ?? null,
      jenis: existingSurat.jenisPenandatangan as JenisPenandatangan,
      jabatan: existingSurat.jabatanPenandatangan,
      nama: existingSurat.namaKepalaKanwil ?? "",
      nip: existingSurat.nipKepalaKanwil ?? "",
    };
  } else {
    // Penandatangan dipilih menurut tanggal kalender WITA dari tanggal surat.
    const hasil = tentukanPenandatangan(daftarPenandatangan, tanggalKalender(tanggalSurat)!, pegawai.nip);
    if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 422 });
    penandatangan = {
      id: hasil.penandatangan.id,
      jenis: hasil.penandatangan.jenis,
      jabatan: hasil.jabatan,
      nama: hasil.penandatangan.nama,
      nip: hasil.penandatangan.nip,
    };
  }

  // PDF disusun di peramban (lib/generateSuratKGB.tsx); di sini hanya isinya, karena menyusun PDF
  // di Worker memakan ±1 detik CPU per surat. Isinya disusun lib/dataSuratKgbServer.ts, yang juga dipakai
  // pratinjau review Admin UPT, sehingga yang direview UPT sama persis dengan yang dicetak (ADR-077).
  const surat = await susunDataSuratKgb({ kgb, pegawai, satker, nomorSurat, tanggalSurat, penandatangan });

  // SK pegawai UPT direview Admin UPT sebelum dicetak dan diunggah TTE (ADR-077). Selama tabel review belum ada,
  // review belum aktif dan alur lama berlaku.
  const perluReview = pegawaiPerluReviewSk(pegawai.unitKerja);
  const reviewAwal = perluReview ? await muatReviewSk(id) : { aktif: false, review: null };
  let reviewAkhir = reviewAwal.review;

  // Preview mode hanya mengirim isi surat. Status sudah Sedang Diproses (dijaga di atas), jadi tidak diubah.
  if (!isPreview) {
    // SK yang dibuat atau diperbaiki adalah SK yang belum pernah dilihat UPT: review diminta (ulang) lebih dulu. Bila
    // permintaan gagal, surat tidak disimpan, sehingga persetujuan untuk SK lama tidak terbawa ke SK yang baru.
    if (perluReview && reviewAwal.aktif) {
      // SK yang sama dengan usulan UPT yang disetujui tidak direview ulang; yang berbeda masuk Periksa SK (ADR-082).
      const cek = await cekSesuaiUsulan(kgb, pegawai);
      const minta = await mintaReviewSk({
        kgb,
        pegawai,
        nomorSurat,
        tanggalSurat,
        oleh: `${userLogin.nama} (${userLogin.nip})`,
        sekarang: new Date(),
        sesuaiUsulan: cek.sesuai,
      });
      if (minta.aktif) reviewAkhir = minta.review;
    }

    // Salinan penandatangan diperbarui setiap kali surat dibuat, agar unduhan ulang sama persis.
    const salinanPenandatangan = {
      namaKepalaKanwil: penandatangan.nama,
      nipKepalaKanwil: penandatangan.nip,
      penandatanganId: penandatangan.id,
      jenisPenandatangan: penandatangan.jenis,
      jabatanPenandatangan: penandatangan.jabatan,
    };
    if (existingSurat) {
      await db.suratKGB.update(
        { kgbId: id },
        { nomorSurat, tanggalSurat, generatedBy: userLogin.id, ...salinanPenandatangan },
      );
    } else {
      await db.suratKGB.create({
        id: newId(),
        kgbId: id,
        nomorSurat,
        tanggalSurat,
        ...salinanPenandatangan,
        pathFile: null,
        generatedAt: new Date(),
        generatedBy: userLogin.id,
      });
    }

    // Draf nomor sudah menjadi SK; kolomnya dikosongkan agar tidak lagi memesan nomor itu.
    if (kgb.drafNomorSurat || kgb.drafTanggalSurat)
      await db.riwayatKGB.update({ id }, { drafNomorSurat: null, drafTanggalSurat: null });

    logAudit({
      userId: userLogin.id,
      aksi: "generate_surat",
      detail:
        `Generate surat KGB ${pegawai.nama} (${pegawai.nip}), No. Surat: ${nomorSurat}, penandatangan: ${penandatangan.jabatan} ${penandatangan.nama}` +
        (perluReview && reviewAwal.aktif ? `; review diminta ke ${satker.nama}` : ""),
      targetNama: pegawai.nama,
    });
  }

  // Tanda air DRAF selama SK pegawai UPT belum boleh ditandatangani: belum disetujui UPT (atau dilewati Super Admin),
  // dan pratinjau dengan nomor baru, yang memang belum pernah direview. SK yang sudah diunggah tidak lagi bertanda.
  const reviewSk = infoReviewSk(reviewAkhir, { aktif: reviewAwal.aktif, unitKerja: pegawai.unitKerja });
  const pratinjauBaru = isPreview && !unduhUlang;
  const draf = !!reviewSk && kgb.status === "sedang_diproses" && (pratinjauBaru || !skBolehDicetak(reviewSk));

  return NextResponse.json({ surat, draf, reviewSk });
}
