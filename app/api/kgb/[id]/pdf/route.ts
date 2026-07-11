import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { renderToBuffer } from "@react-pdf/renderer";
import { SuratKGBDocument } from "@/lib/generateSuratKGB";
import { ReactElement } from "react";
import { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { canProcessKGB, ROLES } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // keuangan boleh preview saja; sdm_hukdis tidak boleh sama sekali
  const url0 = new URL(req.url);
  const isPreviewCheck = url0.searchParams.get("preview") === "true";
  const role = session.user.role!;
  if (role === ROLES.SDM_HUKDIS)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  if (!canProcessKGB(role) && !isPreviewCheck)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  // Ambil user ID yang valid dari database
  const userLogin = await prisma.user.findUnique({
    where: { nip: session.user.nip! },
  });
  if (!userLogin)
    return NextResponse.json(
      { error: "User tidak ditemukan" },
      { status: 401 },
    );

  const { id } = await params;
  const url = new URL(req.url);
  const isPreview = url.searchParams.get("preview") === "true";
  const isSrikandi = url.searchParams.get("srikandi") === "true";

  // Always try to read body (may be empty for no-body preview)
  let bodyData: { nomorSurat?: string; tanggalSurat?: string } = {};
  try { bodyData = await req.json() as any; } catch { /* ok */ }

  let nomorSurat: string;
  let tanggalSurat: string;

  if (isPreview) {
    if (bodyData.nomorSurat && bodyData.tanggalSurat) {
      // Preview with caller-supplied values (combined generate/edit modal)
      nomorSurat = bodyData.nomorSurat;
      tanggalSurat = bodyData.tanggalSurat;
    } else {
      // Preview using last saved SuratKGB record
      const existingSurat = await prisma.suratKGB.findFirst({
        where: { kgbId: id },
        orderBy: { tanggalSurat: "desc" },
      });
      if (!existingSurat) {
        return NextResponse.json({ error: "Belum ada surat yang digenerate" }, { status: 404 });
      }
      nomorSurat = existingSurat.nomorSurat;
      tanggalSurat = existingSurat.tanggalSurat.toISOString();
    }
  } else {
    nomorSurat = bodyData.nomorSurat ?? "";
    tanggalSurat = bodyData.tanggalSurat ?? "";
    if (!nomorSurat || !tanggalSurat) {
      return NextResponse.json(
        { error: "Nomor surat dan tanggal wajib diisi" },
        { status: 400 },
      );
    }
  }

  const kgb = await prisma.riwayatKGB.findUnique({
    where: { id },
    include: { pegawai: true },
  });

  if (!kgb)
    return NextResponse.json(
      { error: "Data KGB tidak ditemukan" },
      { status: 404 },
    );

  const kanwil = await prisma.konfigurasiKanwil.findUnique({
    where: { id: "default" },
  });

  if (!kanwil)
    return NextResponse.json(
      { error: "Konfigurasi kanwil belum diatur" },
      { status: 500 },
    );

  const pdfBuffer = await renderToBuffer(
    React.createElement(SuratKGBDocument, {
      nomorSurat,
      tanggalSurat: new Date(tanggalSurat),
      pegawai: {
        nama: kgb.pegawai.nama,
        nip: kgb.pegawai.nip,
        jabatan: kgb.pegawai.jabatan,
        pangkat: kgb.pegawai.pangkat,
        golonganRuang: kgb.pegawai.golonganRuang,
        unitKerja: kgb.pegawai.unitKerja,
      },
      kgb: {
        gajiPokokLama: kgb.gajiPokokLama,
        nomorSK: kgb.nomorSK,
        tanggalSK: kgb.tanggalSK,
        tmtSK: kgb.tmtSK,
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
      kanwil: {
        namaKepala: kanwil.namaKepala,
        nipKepala: kanwil.nipKepala,
        nomorPP: kanwil.nomorPP,
        tahunPP: kanwil.tahunPP,
      },
      srikandi: isSrikandi,
    }) as ReactElement<DocumentProps>,
  );

  // Preview mode hanya render PDF, jangan tulis ulang SuratKGB atau ubah status
  if (!isPreview) {
    await prisma.suratKGB.upsert({
      where: { kgbId: id },
      update: {
        nomorSurat,
        tanggalSurat: new Date(tanggalSurat),
        generatedBy: userLogin.id,
      },
      create: {
        kgbId: id,
        nomorSurat,
        tanggalSurat: new Date(tanggalSurat),
        namaKepalaKanwil: kanwil.namaKepala,
        nipKepalaKanwil: kanwil.nipKepala,
        generatedBy: userLogin.id,
      },
    });
  }

  // Hanya ubah status dan catat audit saat download (bukan preview)
  if (!isPreview) {
    await prisma.riwayatKGB.update({
      where: { id },
      data: { status: "sedang_diproses" },
    });

    logAudit({
      userId: userLogin.id,
      aksi: "generate_surat",
      detail: `Generate surat KGB ${kgb.pegawai.nama} (${kgb.pegawai.nip}), No. Surat: ${nomorSurat}`,
      targetNama: kgb.pegawai.nama,
    });
  }

  return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${isSrikandi ? "Srikandi_" : ""}KGB_${kgb.pegawai.nip}_${kgb.pegawai.nama.replace(/ /g, "_")}.pdf"`,
    },
  });
}
