import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const [jenisList, konfigList, regulasiList] = await Promise.all([
      db.hukdisJenis.findMany({ orderBy: { field: "urutan", dir: "asc" } }) as Promise<any[]>,
      db.hukdisKonfigurasi.findMany() as Promise<any[]>,
      db.regulasi.findMany() as Promise<any[]>,
    ]);
    const konfig = konfigList[0];
    const regById = new Map(regulasiList.map((r) => [r.id, r]));

    // Emulasi include regulasi.
    const jenis = jenisList.map((j) => {
      const r = j.regulasiId ? regById.get(j.regulasiId) : null;
      return { ...j, regulasi: r ? { id: r.id, nomor: r.nomor, tahun: r.tahun, status: r.status } : null };
    });

    return NextResponse.json({
      jenis,
      notifHariH1: konfig?.notifHariH1 ?? 30,
      notifHariH2: konfig?.notifHariH2 ?? 14,
    });
  } catch (e) {
    console.error("GET /api/hukdis/konfigurasi gagal:", e);
    return NextResponse.json({ error: "Gagal memuat konfigurasi hukdis" }, { status: 500 });
  }
}

/* ── POST: buat jenis hukdis baru ─────────────────────────────────────── */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const body = (await req.json()) as {
    label: string; dasarHukum?: string; regulasiId?: string | null; kategori: string;
    durasiHukdis: number; berdampakKGB: boolean; durasiTunda?: number | null; aktif: boolean;
  };

  if (!body.label?.trim()) return NextResponse.json({ error: "Nama jenis wajib diisi" }, { status: 400 });
  if (!["ringan", "sedang", "berat"].includes(body.kategori))
    return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });

  const { regulasiId, dasarHukum } = await resolveDasar(body.regulasiId, body.dasarHukum);
  if (!regulasiId && !dasarHukum)
    return NextResponse.json({ error: "Pilih regulasi atau isi dasar peraturan" }, { status: 400 });

  const kodeBase = body.label.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().replace(/\s+/g, "_").slice(0, 40);

  // Pastikan kode unik.
  let kode = kodeBase;
  let suffix = 2;
  while (await db.hukdisJenis.findUnique({ kode })) {
    kode = `${kodeBase}_${suffix++}`;
  }

  // Urutan = max + 1.
  const all = (await db.hukdisJenis.findMany()) as any[];
  const urutan = Math.max(0, ...all.map((j) => Number(j.urutan) || 0)) + 1;

  const jenis = {
    id: newId(),
    kode,
    label: body.label.trim(),
    kategori: body.kategori,
    dasarHukum,
    regulasiId,
    durasiHukdis: body.durasiHukdis ?? 0,
    berdampakKGB: body.berdampakKGB ?? false,
    durasiTunda: body.berdampakKGB ? (body.durasiTunda ?? 12) : null,
    aktif: body.aktif ?? true,
    urutan,
    updatedAt: new Date(),
    updatedBy: session.user.nip,
  };
  await db.hukdisJenis.create(jenis);

  return NextResponse.json(jenis, { status: 201 });
}

/* Menyelesaikan dasar hukum: jika regulasiId valid, denormalisasi labelnya. */
async function resolveDasar(regulasiId?: string | null, manual?: string | null) {
  const id = regulasiId?.trim() || null;
  if (id) {
    const reg = (await db.regulasi.findUnique({ id })) as any;
    if (reg) return { regulasiId: id, dasarHukum: `${reg.nomor} Tahun ${reg.tahun}` };
  }
  const text = manual?.trim() || null;
  return { regulasiId: null, dasarHukum: text };
}

/* ── PATCH: update jenis dan/atau notif ───────────────────────────────── */
interface JenisUpdate {
  id: string; label?: string; dasarHukum?: string | null; regulasiId?: string | null;
  kategori?: string; durasiHukdis?: number; berdampakKGB?: boolean; durasiTunda?: number | null; aktif?: boolean;
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const body = (await req.json()) as {
    notifHariH1?: number; notifHariH2?: number; jenisUpdates?: JenisUpdate[];
  };

  if (body.notifHariH1 !== undefined || body.notifHariH2 !== undefined) {
    const existing = ((await db.hukdisKonfigurasi.findMany()) as any[])[0];
    if (existing) {
      await db.hukdisKonfigurasi.update(
        { id: existing.id },
        {
          ...(body.notifHariH1 !== undefined ? { notifHariH1: body.notifHariH1 } : {}),
          ...(body.notifHariH2 !== undefined ? { notifHariH2: body.notifHariH2 } : {}),
          updatedAt: new Date(),
          updatedBy: session.user.nip,
        } as any,
      );
    } else {
      await db.hukdisKonfigurasi.create({
        id: newId(),
        notifHariH1: body.notifHariH1 ?? 30,
        notifHariH2: body.notifHariH2 ?? 14,
        updatedAt: new Date(),
        updatedBy: session.user.nip,
      } as any);
    }
  }

  // Halaman selalu mengirim dasarHukum saat menyimpan; tautan regulasi hanya dilepas
  // bila teks dasar hukumnya benar-benar diubah.
  const jenisById = new Map(
    (body.jenisUpdates?.length
      ? ((await db.hukdisJenis.findMany()) as { id: string; dasarHukum: string | null }[])
      : []
    ).map((j) => [j.id, j] as const),
  );
  for (const u of body.jenisUpdates ?? []) {
    let dasarPatch: { dasarHukum?: string | null; regulasiId?: string | null } = {};
    if (u.regulasiId !== undefined) {
      const r = await resolveDasar(u.regulasiId, u.dasarHukum);
      dasarPatch = { dasarHukum: r.dasarHukum, regulasiId: r.regulasiId };
    } else if (u.dasarHukum !== undefined && u.dasarHukum !== jenisById.get(u.id)?.dasarHukum) {
      dasarPatch = { dasarHukum: u.dasarHukum, regulasiId: null };
    }
    await db.hukdisJenis.update(
      { id: u.id },
      {
        ...(u.label !== undefined ? { label: u.label } : {}),
        ...dasarPatch,
        ...(u.kategori !== undefined ? { kategori: u.kategori } : {}),
        ...(u.durasiHukdis !== undefined ? { durasiHukdis: u.durasiHukdis } : {}),
        ...(u.berdampakKGB !== undefined ? { berdampakKGB: u.berdampakKGB } : {}),
        ...(u.durasiTunda !== undefined ? { durasiTunda: u.durasiTunda } : {}),
        ...(u.aktif !== undefined ? { aktif: u.aktif } : {}),
        updatedAt: new Date(),
        updatedBy: session.user.nip,
      } as any,
    );
  }

  return NextResponse.json({ ok: true });
}
