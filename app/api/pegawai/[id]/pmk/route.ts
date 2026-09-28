import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canEditPegawai } from "@/lib/auth";
import { NON_KEUANGAN } from "@/lib/authGuard";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { catatPmk } from "@/lib/catatDasarGaji";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { isoTanggalKalender } from "@/lib/rekapKgb";
import { tanggalKalender } from "@/lib/waktu";
import type { RiwayatPmkRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/*
 * Peninjauan masa kerja (PMK) satu pegawai (ADR-021; hitungannya di lib/pmk.ts).
 *
 * Mencatat SK PMK lalu menyesuaikan data gaji pegawai: MKG bertambah sebesar tambahan PMK, gaji pokok dibaca ulang
 * dari tabel PP 5/2024, dan TMT KGB berikutnya diatur ulang karena MKG yang baru bisa mencapai langkah tabel lebih
 * cepat. Tim SDM dapat mengoreksi TMT KGB berikutnya sesuai SK PMK. KGB placeholder "belum diproses" ikut disusun
 * ulang; KGB yang sudah dikerjakan dikembalikan sebagai daftar "perlu ditinjau", sama dengan kenaikan pangkat.
 */

function keTanggal(nilai: unknown): Date | null {
  return typeof nilai === "string" && nilai.trim() ? tanggalKalender(nilai) : null;
}

/** Bilangan dari isian angka; NaN bila kosong atau bukan angka. */
function keBilangan(nilai: unknown): number {
  if (typeof nilai === "number") return nilai;
  return typeof nilai === "string" && nilai.trim() ? Number(nilai) : NaN;
}

// GET, riwayat PMK pegawai, terbaru dulu.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!NON_KEUANGAN.includes(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const riwayat = (await db.riwayatPmk.findMany({ where: { pegawaiId: id } })) as RiwayatPmkRow[];
  const urut = [...riwayat].sort(
    (a, b) => (tanggalKalender(b.tmtPmk)?.getTime() ?? 0) - (tanggalKalender(a.tmtPmk)?.getTime() ?? 0),
  );
  return NextResponse.json(
    urut.map((r) => ({
      id: r.id,
      nomorSK: r.nomorSK,
      tanggalSK: isoTanggalKalender(r.tanggalSK),
      tmtPmk: isoTanggalKalender(r.tmtPmk),
      golonganRuang: r.golonganRuang,
      tambahBulan: r.tambahBulan,
      mkgTahunSebelum: r.mkgTahunSebelum,
      mkgBulanSebelum: r.mkgBulanSebelum,
      mkgTahunSesudah: r.mkgTahunSesudah,
      mkgBulanSesudah: r.mkgBulanSesudah,
      gajiPokokLama: r.gajiPokokLama,
      gajiPokokBaru: r.gajiPokokBaru,
      tmtKgbBerikutnyaLama: isoTanggalKalender(r.tmtKgbBerikutnyaLama),
      tmtKgbBerikutnyaBaru: isoTanggalKalender(r.tmtKgbBerikutnyaBaru),
      penetapSK: r.penetapSK ?? null,
      keterangan: r.keterangan,
    })),
  );
}

// POST, catat PMK dan sesuaikan data gaji serta jadwal KGB pegawai (lib/catatDasarGaji.ts).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditPegawai(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("bukan objek");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const teks = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const tanggalSK = keTanggal(body.tanggalSK);
  const tmtPmk = keTanggal(body.tmtPmk);
  const bulan = keBilangan(body.mkgBulanSk);
  if (!tanggalSK || !tmtPmk) return NextResponse.json({ error: "Tanggal SK dan TMT PMK wajib diisi" }, { status: 400 });

  const { id } = await params;
  const pegawai = await db.pegawai.findUnique({ id });
  if (!pegawai) return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const hasil = await catatPmk({
    pegawai,
    nomorSK: teks(body.nomorSK),
    tanggalSK,
    tmtPmk,
    mkgTahunSk: keBilangan(body.mkgTahunSk),
    mkgBulanSk: Number.isNaN(bulan) ? 0 : bulan,
    tmtKgbBerikutnya: keTanggal(body.tmtKgbBerikutnya),
    penetapSK: teks(body.penetapSK),
    keterangan: teks(body.keterangan),
    userId: pengguna.id,
  });
  if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });

  logAudit({ userId: pengguna.id, aksi: "peninjauan_masa_kerja", targetNama: pegawai.nama, detail: hasil.ringkas });

  return NextResponse.json(
    {
      ok: true,
      hasil: {
        tambahBulan: hasil.tambahBulan,
        gajiPokokLama: hasil.gajiPokokLama,
        gajiPokokBaru: hasil.gajiPokokBaru,
        tmtKgbBerikutnyaLama: hasil.tmtKgbBerikutnyaLama,
        tmtKgbBerikutnya: hasil.tmtKgbBerikutnya,
      },
      kgbDiselaraskan: hasil.kgbDiselaraskan,
      kgbPerluDitinjau: hasil.kgbPerluDitinjau,
    },
    { status: 201 },
  );
}
