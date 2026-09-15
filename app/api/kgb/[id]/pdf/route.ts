import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { renderToBuffer } from "@react-pdf/renderer";
import { SuratKGBDocument } from "@/lib/generateSuratKGB";
import { ReactElement } from "react";
import { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { canProcessKGB, ROLES } from "@/lib/auth";
import { tentukanPenandatangan, type JenisPenandatangan } from "@/lib/penandatangan";
import { PENETAP_KANWIL } from "@/lib/penetapSk";

export const runtime = "nodejs";

// Surat hanya boleh dibuat (ulang) sebelum SK final diunggah.
const STATUS_TERKUNCI: Record<string, string> = {
  menunggu_keuangan: "SK final sudah diunggah dan menunggu keuangan, jadi surat tidak dapat dibuat ulang.",
  selesai: "KGB sudah selesai, jadi surat tidak dapat dibuat ulang.",
  ditolak: "KGB ini sudah dibatalkan. Input ulang KGB sebelum membuat surat.",
};

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

  const url = new URL(req.url);
  const isPreview = url.searchParams.get("preview") === "true";
  const isSrikandi = url.searchParams.get("srikandi") === "true";
  const role = session.user.role!;
  if (role === ROLES.SDM_HUKDIS)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  if (!canProcessKGB(role) && !isPreview)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;

  let bodyData: { nomorSurat?: string; tanggalSurat?: string } = {};
  try { bodyData = (await req.json()) as any; } catch { /* ok */ }

  // Preview tanpa nomor & tanggal = unduh ulang surat tersimpan, apa adanya.
  const unduhUlang = isPreview && !(bodyData.nomorSurat && bodyData.tanggalSurat);

  const kgb = await db.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
  if (!isPreview && STATUS_TERKUNCI[kgb.status])
    return NextResponse.json({ error: STATUS_TERKUNCI[kgb.status] }, { status: 409 });
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
    }) as Promise<any[]>,
    db.penandatangan.findMany(),
    db.konfigurasiKanwil.findUnique({ id: "default" }) as Promise<any>,
  ]);
  if (!pegawai)
    return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });
  const existingSurat = suratList[0] ?? null;

  let nomorSurat: string;
  let tanggalSurat: string;
  if (unduhUlang) {
    if (!existingSurat) {
      return NextResponse.json({ error: "Belum ada surat yang digenerate" }, { status: 404 });
    }
    nomorSurat = existingSurat.nomorSurat;
    tanggalSurat = new Date(existingSurat.tanggalSurat).toISOString();
  } else {
    nomorSurat = bodyData.nomorSurat ?? "";
    tanggalSurat = bodyData.tanggalSurat ?? "";
    if (!nomorSurat || !tanggalSurat) {
      return NextResponse.json({ error: "Nomor surat dan tanggal wajib diisi" }, { status: 400 });
    }
  }

  let penandatangan: { id: string | null; jenis: JenisPenandatangan; jabatan: string; nama: string; nip: string };
  if (unduhUlang && existingSurat.jabatanPenandatangan) {
    penandatangan = {
      id: existingSurat.penandatanganId ?? null,
      jenis: existingSurat.jenisPenandatangan,
      jabatan: existingSurat.jabatanPenandatangan,
      nama: existingSurat.namaKepalaKanwil,
      nip: existingSurat.nipKepalaKanwil,
    };
  } else {
    const hasil = tentukanPenandatangan(daftarPenandatangan, new Date(tanggalSurat), pegawai.nip);
    if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 422 });
    penandatangan = {
      id: hasil.penandatangan.id,
      jenis: hasil.penandatangan.jenis,
      jabatan: hasil.jabatan,
      nama: hasil.penandatangan.nama,
      nip: hasil.penandatangan.nip,
    };
  }

  const pdfBuffer = await renderToBuffer(
    React.createElement(SuratKGBDocument, {
      nomorSurat,
      tanggalSurat: new Date(tanggalSurat),
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
        tanggalSK: kgb.tanggalSK as Date,
        tmtSK: kgb.tmtSK as Date,
        // Surat lama (sebelum kolom ini ada) selalu mencetak penetap Kanwil.
        penetapSkDasar: kgb.penetapSkDasar?.trim() || PENETAP_KANWIL,
        mkgTahunLama: kgb.mkgTahunLama,
        mkgBulanLama: kgb.mkgBulanLama,
        gajiPokokBaru: kgb.gajiPokokBaru,
        mkgTahunBaru: kgb.mkgTahunBaru,
        mkgBulanBaru: kgb.mkgBulanBaru,
        golonganBaru: kgb.golonganBaru,
        tmtKgbBaru: kgb.tmtKgbBaru as Date,
        tmtKgbBerikutnya: kgb.tmtKgbBerikutnya as Date,
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
    }) as ReactElement<DocumentProps>,
  );

  // Preview mode hanya render PDF.
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
        { nomorSurat, tanggalSurat: new Date(tanggalSurat), generatedBy: userLogin.id, ...salinanPenandatangan } as any,
      );
    } else {
      await db.suratKGB.create({
        id: newId(),
        kgbId: id,
        nomorSurat,
        tanggalSurat: new Date(tanggalSurat),
        ...salinanPenandatangan,
        pathFile: null,
        generatedAt: new Date(),
        generatedBy: userLogin.id,
      } as any);
    }

    await db.riwayatKGB.update({ id }, { status: "sedang_diproses" });

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
