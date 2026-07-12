import { NextResponse } from "next/server";
import { sheets } from "@/lib/sheets/tables";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { renderToBuffer } from "@react-pdf/renderer";
import { SuratKGBDocument } from "@/lib/generateSuratKGB";
import { ReactElement } from "react";
import { DocumentProps } from "@react-pdf/renderer";
import React from "react";
import { canProcessKGB, ROLES } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url0 = new URL(req.url);
  const isPreviewCheck = url0.searchParams.get("preview") === "true";
  const role = session.user.role!;
  if (role === ROLES.SDM_HUKDIS)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  if (!canProcessKGB(role) && !isPreviewCheck)
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const userLogin = await sheets.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;
  const url = new URL(req.url);
  const isPreview = url.searchParams.get("preview") === "true";
  const isSrikandi = url.searchParams.get("srikandi") === "true";

  let bodyData: { nomorSurat?: string; tanggalSurat?: string } = {};
  try { bodyData = (await req.json()) as any; } catch { /* ok */ }

  let nomorSurat: string;
  let tanggalSurat: string;

  if (isPreview) {
    if (bodyData.nomorSurat && bodyData.tanggalSurat) {
      nomorSurat = bodyData.nomorSurat;
      tanggalSurat = bodyData.tanggalSurat;
    } else {
      const suratList = (await sheets.suratKGB.findMany({
        where: { kgbId: id },
        orderBy: { field: "tanggalSurat", dir: "desc" },
      })) as any[];
      const existingSurat = suratList[0];
      if (!existingSurat) {
        return NextResponse.json({ error: "Belum ada surat yang digenerate" }, { status: 404 });
      }
      nomorSurat = existingSurat.nomorSurat;
      tanggalSurat = new Date(existingSurat.tanggalSurat).toISOString();
    }
  } else {
    nomorSurat = bodyData.nomorSurat ?? "";
    tanggalSurat = bodyData.tanggalSurat ?? "";
    if (!nomorSurat || !tanggalSurat) {
      return NextResponse.json({ error: "Nomor surat dan tanggal wajib diisi" }, { status: 400 });
    }
  }

  const kgb = await sheets.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
  const pegawai = await sheets.pegawai.findUnique({ id: kgb.pegawaiId });
  if (!pegawai)
    return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });

  const kanwil = (await sheets.konfigurasiKanwil.findUnique({ id: "default" })) as any;
  if (!kanwil)
    return NextResponse.json({ error: "Konfigurasi kanwil belum diatur" }, { status: 500 });

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
      kanwil: {
        namaKepala: kanwil.namaKepala,
        nipKepala: kanwil.nipKepala,
        nomorPP: kanwil.nomorPP,
        tahunPP: kanwil.tahunPP,
      },
      srikandi: isSrikandi,
    }) as ReactElement<DocumentProps>,
  );

  // Preview mode hanya render PDF.
  if (!isPreview) {
    const existingSurat = (await sheets.suratKGB.findUnique({ kgbId: id })) as any;
    if (existingSurat) {
      await sheets.suratKGB.update(
        { kgbId: id },
        { nomorSurat, tanggalSurat: new Date(tanggalSurat), generatedBy: userLogin.id } as any,
      );
    } else {
      await sheets.suratKGB.create({
        id: newId(),
        kgbId: id,
        nomorSurat,
        tanggalSurat: new Date(tanggalSurat),
        namaKepalaKanwil: kanwil.namaKepala,
        nipKepalaKanwil: kanwil.nipKepala,
        pathFile: null,
        generatedAt: new Date(),
        generatedBy: userLogin.id,
      } as any);
    }

    await sheets.riwayatKGB.update({ id }, { status: "sedang_diproses" });

    logAudit({
      userId: userLogin.id,
      aksi: "generate_surat",
      detail: `Generate surat KGB ${pegawai.nama} (${pegawai.nip}), No. Surat: ${nomorSurat}`,
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
