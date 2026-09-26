import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canProcessKGB } from "@/lib/auth";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  adaPenandaPdf,
  BATAS_UKURAN_SK_BYTE,
  bacaTanggalInput,
  izinUnggahSk,
  PESAN_SK_TERLALU_BESAR,
  suratSudahDibuat,
  type SuratKgbTersimpan,
} from "@/lib/prosesKgb";
import { hariIniWita, isoTanggalLokal } from "@/lib/waktu";
import { notifikasiSkDiunggah } from "@/lib/generateNotifikasi";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // SK final hanya diunggah pengelola KGB, bukan sembarang pengguna yang login.
  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;

  const kgb = await db.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  const [pegawai, existingSurat] = await Promise.all([
    db.pegawai.findUnique({ id: kgb.pegawaiId }),
    db.suratKGB.findUnique({ kgbId: id }) as Promise<SuratKgbTersimpan | null>,
  ]);

  // Semua pemeriksaan dilakukan sebelum file disimpan, agar permintaan yang ditolak tidak
  // meninggalkan file di R2.
  const izin = izinUnggahSk({ status: kgb.status, isArsip: kgb.isArsip, skSudahDibuat: suratSudahDibuat(existingSurat) });
  if (!izin.ok)
    return NextResponse.json({ error: izin.error }, { status: 409 });

  // Ukuran menurut header diperiksa sebelum isi permintaan dibaca ke memori; ruang tambahan untuk
  // bagian formulir selain berkas.
  const panjangIsi = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjangIsi) && panjangIsi > BATAS_UKURAN_SK_BYTE + 64 * 1024)
    return NextResponse.json({ error: PESAN_SK_TERLALU_BESAR }, { status: 413 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data unggahan tidak valid" }, { status: 400 });
  }
  const file = formData.get("file");
  const nomorSuratParam = (formData.get("nomorSurat") as string | null)?.trim() || null;
  const tanggalSuratParam = (formData.get("tanggalSurat") as string | null)?.trim() || null;

  if (!(file instanceof File))
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });

  if (file.type !== "application/pdf")
    return NextResponse.json({ error: "Hanya file PDF yang diperbolehkan" }, { status: 400 });

  if (file.size > BATAS_UKURAN_SK_BYTE)
    return NextResponse.json({ error: PESAN_SK_TERLALU_BESAR }, { status: 413 });

  // Jenis file dari peramban tidak dijamin benar, jadi isi file diperiksa memuat penanda PDF.
  if (!adaPenandaPdf(new Uint8Array(await file.slice(0, 1024).arrayBuffer())))
    return NextResponse.json({ error: "File yang diunggah bukan PDF yang valid" }, { status: 400 });

  const tanggalSuratInput = tanggalSuratParam ? bacaTanggalInput(tanggalSuratParam) : null;
  if (tanggalSuratParam && !tanggalSuratInput)
    return NextResponse.json({ error: "Tanggal SK tidak valid" }, { status: 400 });

  // Simpan ke Cloudflare R2 (privat).
  const pathFile = `sk/${pegawai?.nip ?? "unknown"}_${Date.now()}.pdf`;
  try {
    const arrayBuffer = await file.arrayBuffer();
    const { env } = await getCloudflareContext({ async: true });
    await env.SK_BUCKET.put(pathFile, arrayBuffer, {
      httpMetadata: { contentType: "application/pdf" },
    });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan file. Coba lagi." }, { status: 500 });
  }

  if (existingSurat) {
    await db.suratKGB.update(
      { kgbId: id },
      {
        pathFile,
        ...(nomorSuratParam ? { nomorSurat: nomorSuratParam } : {}),
        ...(tanggalSuratInput ? { tanggalSurat: tanggalSuratInput } : {}),
      },
    );
  } else {
    await db.suratKGB.create({
      id: newId(),
      kgbId: id,
      nomorSurat: nomorSuratParam ?? "-",
      // Tanpa tanggal dari formulir, dipakai tanggal hari ini menurut WITA.
      tanggalSurat: tanggalSuratInput ?? bacaTanggalInput(isoTanggalLokal(hariIniWita())),
      namaKepalaKanwil: "-",
      nipKepalaKanwil: "-",
      pathFile,
      generatedAt: new Date(),
      generatedBy: userLogin.id,
    });
  }

  if (izin.jenis === "unggah") {
    await db.riwayatKGB.update({ id }, { status: "menunggu_keuangan" });
    // Kabar langsung ke yang menindaklanjuti: keuangan Kanwil untuk pegawai Kanwil, UPT untuk pegawai UPT
    // (ADR-009). Kegagalannya tidak membatalkan unggahan; pemeriksaan berkala membuatnya belakangan.
    try {
      await db.notifikasi.create({ ...notifikasiSkDiunggah(kgb, pegawai), id: newId(), dibaca: false, createdAt: new Date() });
    } catch {
      // Notifikasinya menyusul lewat pemeriksaan berkala.
    }
  }

  const keterangan =
    izin.jenis === "unggah"
      ? "menunggu konfirmasi keuangan"
      : izin.jenis === "ganti"
        ? "mengganti file SK yang menunggu konfirmasi keuangan"
        : "file SK arsip";
  logAudit({
    userId: userLogin.id,
    aksi: "upload_sk",
    detail: `Upload SK TTD untuk ${pegawai?.nama ?? "-"} (${pegawai?.nip ?? "-"}), ${keterangan}`,
    targetNama: pegawai?.nama ?? "-",
  });

  return NextResponse.json({ pathFile }, { status: 200 });
}
