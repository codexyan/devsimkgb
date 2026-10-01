import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { newId } from "@/lib/sheets/id";
import { canKonfirmasiKeuangan } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";
import { TIPE_NOTIFIKASI } from "@/lib/generateNotifikasi";
import { dipegangKeuanganKanwil } from "@/lib/aksesUpt";
import { formatTanggalId } from "@/lib/waktu";
import type { PegawaiRow, RiwayatKGBRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * Keuangan mengembalikan SK yang menunggu konfirmasi kepada Tim SDM (ADR-047).
 *
 * Sebelum ini, SK yang sudah sampai keuangan tidak punya jalan pulang: pembatalan hanya diizinkan dari
 * "belum diproses" atau "sedang diproses", sehingga keuangan yang menemukan kekeliruan hanya punya dua
 * pilihan yang sama-sama buruk, yaitu mengkonfirmasi yang salah atau mendiamkannya.
 *
 * Statusnya kembali ke "sedang diproses", yaitu kolom Diproses pada papan Tim SDM. Tidak ada data pegawai
 * yang perlu dipulihkan: gaji pokok, masa kerja, dan jadwal siklus berikutnya baru ditulis saat konfirmasi
 * (lib/selesaikanKgb.ts), jadi yang berpindah hanya status dan siapa yang memegangnya. Dari kolom itu Tim
 * SDM dapat mengganti SK-nya, atau membatalkan prosesnya sekalian bila yang keliru justru angkanya.
 *
 * Alasannya wajib dan tidak disimpan di baris KGB, melainkan pada notifikasi untuk Tim SDM dan catatan
 * audit; baris KGB memang tidak punya kolom catatan, dan menambahkannya hanya untuk ini tidak sepadan.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canKonfirmasiKeuangan(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin) return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { alasan?: unknown };
  const alasan = typeof body.alasan === "string" ? body.alasan.trim() : "";
  if (!alasan) return NextResponse.json({ error: "Alasan pengembalian wajib diisi" }, { status: 400 });

  const kgb = (await db.riwayatKGB.findUnique({ id })) as RiwayatKGBRow | null;
  if (!kgb) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
  if (kgb.isArsip || kgb.status !== "menunggu_keuangan")
    return NextResponse.json(
      { error: "Hanya SK yang sedang menunggu konfirmasi keuangan yang dapat dikembalikan." },
      { status: 409 },
    );

  const pegawai = (await db.pegawai.findUnique({ id: kgb.pegawaiId })) as PegawaiRow | null;
  if (!pegawai) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });
  // Keuangan Kanwil hanya memegang pegawai Kanwil; SK pegawai UPT direkam keuangan satkernya (ADR-009).
  if (!dipegangKeuanganKanwil(pegawai.unitKerja))
    return NextResponse.json(
      { error: `${pegawai.nama} pegawai UPT, jadi SK-nya ditindaklanjuti keuangan satkernya sendiri.` },
      { status: 409 },
    );

  await db.riwayatKGB.update({ id }, { status: "sedang_diproses" });

  const tmt = formatTanggalId(kgb.tmtKgbBaru, { month: "long", year: "numeric" });
  try {
    await db.notifikasi.create({
      id: newId(),
      judul: "SK dikembalikan Keuangan",
      pesan:
        `Keuangan mengembalikan SK KGB atas nama ${pegawai.nama} (${pegawai.nip}) TMT ${tmt} untuk diperbaiki. ` +
        `Alasan: ${alasan}`,
      // Memakai tipe yang sama dengan permintaan follow up agar langsung muncul di panel tindakan Tim SDM.
      tipe: TIPE_NOTIFIKASI.FOLLOWUP_KEUANGAN,
      referenceId: pegawai.id,
      dibaca: false,
      createdAt: new Date(),
      prioritas: "warning",
      kategori: "kgb",
      linkHref: "/dashboard/kgb",
    });
  } catch {
    // Statusnya sudah kembali ke Tim SDM; notifikasinya menyusul lewat pemeriksaan berkala.
  }

  logAudit({
    userId: userLogin.id,
    aksi: "kembalikan_kgb_keuangan",
    detail: `SK KGB ${pegawai.nama} (${pegawai.nip}) TMT ${tmt} dikembalikan Keuangan ke Tim SDM. Alasan: ${alasan}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true });
}
