import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { renderToBuffer } from "@react-pdf/renderer";
import { siapkanAsetSurat, SuratKGBDocument } from "@/lib/generateSuratKGB";
import { ReactElement } from "react";
import { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { canProcessKGB, canViewKGB } from "@/lib/auth";
import { tentukanPenandatangan, type JenisPenandatangan } from "@/lib/penandatangan";
import { PENETAP_KANWIL } from "@/lib/penetapSk";
import { cariSatker, SATKER_KANWIL } from "@/lib/satker";
import { muatKppnSatker } from "@/lib/muatKppnSatker";
import { tanggalKalender } from "@/lib/waktu";
import { alasanTolakBuatSk, bacaTanggalInput, type SuratKgbTersimpan } from "@/lib/prosesKgb";
import type { HukdisUntukKgb } from "@/lib/prosesKgb";
import { periksaUlangKgb } from "@/lib/pemeriksaanUlangKgb";
import { hariIniWita, type NilaiTanggal } from "@/lib/waktu";

export const runtime = "nodejs";

/** Teks peraturan gaji: nilai lengkap dipakai apa adanya, nomor polos digabung dengan tahunnya. */
function teksDasarHukum(nomorPP?: string | null, tahunPP?: string | null): string {
  const nomor = nomorPP?.trim() ?? "";
  const tahun = tahunPP?.trim() || "2024";
  if (!nomor) return `Nomor 5 Tahun ${tahun}`;
  return /^\d+$/.test(nomor) ? `Nomor ${nomor} Tahun ${tahun}` : nomor;
}

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
  const isSrikandi = url.searchParams.get("srikandi") === "true";
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

  const [pegawai, suratList, daftarPenandatangan, kanwil] = await Promise.all([
    db.pegawai.findUnique({ id: kgb.pegawaiId }),
    db.suratKGB.findMany({
      where: { kgbId: id },
      orderBy: { field: "tanggalSurat", dir: "desc" },
    }) as Promise<SuratKgbTersimpan[]>,
    db.penandatangan.findMany(),
    db.konfigurasiKanwil.findUnique({ id: "default" }) as Promise<{ nomorPP?: string | null; tahunPP?: string | null } | null>,
  ]);
  if (!pegawai)
    return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });

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
  const kppn = satker.kppn;

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

  const aset = await siapkanAsetSurat(isSrikandi);
  const pdfBuffer = await renderToBuffer(
    React.createElement(SuratKGBDocument, {
      nomorSurat,
      tanggalSurat,
      kppn,
      pegawai: {
        nama: pegawai.nama,
        nip: pegawai.nip,
        jabatan: pegawai.jabatan,
        pangkat: pegawai.pangkat,
        golonganRuang: pegawai.golonganRuang,
        unitKerja: pegawai.unitKerja,
      },
      kgb: {
        gajiPokokLama: kgb.gajiPokokLama,
        nomorSK: kgb.nomorSK,
        tanggalSK: kgb.tanggalSK,
        tmtSK: kgb.tmtSK,
        // Surat lama (sebelum kolom ini ada) selalu mencetak penetap Kanwil.
        penetapSkDasar: kgb.penetapSkDasar?.trim() || PENETAP_KANWIL,
        mkgTahunLama: kgb.mkgTahunLama,
        mkgBulanLama: kgb.mkgBulanLama,
        gajiPokokBaru: kgb.gajiPokokBaru,
        mkgTahunBaru: kgb.mkgTahunBaru,
        mkgBulanBaru: kgb.mkgBulanBaru,
        golonganBaru: kgb.golonganBaru,
        tmtKgbBaru: kgb.tmtKgbBaru,
        tmtKgbBerikutnya: kgb.tmtKgbBerikutnya,
        flagRapelan: kgb.flagRapelan,
      },
      penandatangan: {
        jenis: penandatangan.jenis,
        jabatan: penandatangan.jabatan,
        nama: penandatangan.nama,
        nip: penandatangan.nip,
      },
      dasarHukum: teksDasarHukum(kanwil?.nomorPP, kanwil?.tahunPP),
      srikandi: isSrikandi,
      aset,
    }) as ReactElement<DocumentProps>,
  );

  // Preview mode hanya render PDF. Status sudah Sedang Diproses (dijaga di atas), jadi tidak diubah.
  if (!isPreview) {
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

    logAudit({
      userId: userLogin.id,
      aksi: "generate_surat",
      detail: `Generate surat KGB ${pegawai.nama} (${pegawai.nip}), No. Surat: ${nomorSurat}, penandatangan: ${penandatangan.jabatan} ${penandatangan.nama}`,
      targetNama: pegawai.nama,
    });
  }

  return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${isSrikandi ? "Srikandi_" : ""}KGB_${pegawai.nip}_${pegawai.nama.replace(/ /g, "_")}.pdf"`,
    },
  });
}
