import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const [jenisList, konfig] = await Promise.all([
      prisma.hukdisJenis.findMany({
        orderBy: { urutan: "asc" },
        include: { regulasi: { select: { id: true, nomor: true, tahun: true, status: true } } },
      }),
      prisma.hukdisKonfigurasi.findFirst(),
    ]);

    return NextResponse.json({
      jenis: jenisList,
      notifHariH1: konfig?.notifHariH1 ?? 30,
      notifHariH2: konfig?.notifHariH2 ?? 14,
    });
  } catch (e) {
    console.error("GET /api/hukdis/konfigurasi gagal:", e);
    return NextResponse.json(
      { error: "Gagal memuat konfigurasi hukdis" },
      { status: 500 },
    );
  }
}

/* ── POST: buat jenis hukdis baru ─────────────────────────────────────── */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const body = await req.json() as {
    label: string;
    dasarHukum?: string;
    regulasiId?: string | null;
    kategori: string;
    durasiHukdis: number;
    berdampakKGB: boolean;
    durasiTunda?: number | null;
    aktif: boolean;
  };

  if (!body.label?.trim()) return NextResponse.json({ error: "Nama jenis wajib diisi" }, { status: 400 });
  if (!["ringan","sedang","berat"].includes(body.kategori))
    return NextResponse.json({ error: "Kategori tidak valid" }, { status: 400 });

  // Dasar hukum: utamakan link ke master Regulasi (denormalisasi labelnya ke
  // dasarHukum). Bila tidak dipilih, pakai teks manual. Salah satu wajib ada.
  const { regulasiId, dasarHukum } = await resolveDasar(body.regulasiId, body.dasarHukum);
  if (!regulasiId && !dasarHukum)
    return NextResponse.json({ error: "Pilih regulasi atau isi dasar peraturan" }, { status: 400 });

  // Generate kode dari label
  const kodeBase = body.label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);

  // Pastikan kode unik
  let kode = kodeBase;
  let suffix = 2;
  while (await prisma.hukdisJenis.findUnique({ where: { kode } })) {
    kode = `${kodeBase}_${suffix++}`;
  }

  // Urutan = max + 1
  const maxUrutan = await prisma.hukdisJenis.aggregate({ _max: { urutan: true } });
  const urutan = (maxUrutan._max.urutan ?? 0) + 1;

  const jenis = await prisma.hukdisJenis.create({
    data: {
      kode,
      label:        body.label.trim(),
      dasarHukum,
      regulasiId,
      kategori:     body.kategori,
      durasiHukdis: body.durasiHukdis ?? 0,
      berdampakKGB: body.berdampakKGB ?? false,
      durasiTunda:  body.berdampakKGB ? (body.durasiTunda ?? 12) : null,
      aktif:        body.aktif ?? true,
      urutan,
      updatedBy:    session.user.nip,
    },
  });

  return NextResponse.json(jenis, { status: 201 });
}

/* Menyelesaikan dasar hukum: jika regulasiId valid, denormalisasi labelnya ke
   dasarHukum; jika tidak, pakai teks manual (regulasiId dikosongkan). */
async function resolveDasar(regulasiId?: string | null, manual?: string | null) {
  const id = regulasiId?.trim() || null;
  if (id) {
    const reg = await prisma.regulasi.findUnique({ where: { id }, select: { nomor: true, tahun: true } });
    if (reg) return { regulasiId: id, dasarHukum: `${reg.nomor} Tahun ${reg.tahun}` };
  }
  const text = manual?.trim() || null;
  return { regulasiId: null, dasarHukum: text };
}

/* ── PATCH: update jenis dan/atau notif ───────────────────────────────── */
interface JenisUpdate {
  id: string;
  label?: string;
  dasarHukum?: string | null;
  regulasiId?: string | null;
  kategori?: string;
  durasiHukdis?: number;
  berdampakKGB?: boolean;
  durasiTunda?: number | null;
  aktif?: boolean;
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const body = await req.json() as {
    notifHariH1?: number;
    notifHariH2?: number;
    jenisUpdates?: JenisUpdate[];
  };

  const ops: Promise<unknown>[] = [];

  if (body.notifHariH1 !== undefined || body.notifHariH2 !== undefined) {
    const existing = await prisma.hukdisKonfigurasi.findFirst();
    if (existing) {
      ops.push(prisma.hukdisKonfigurasi.update({
        where: { id: existing.id },
        data: {
          ...(body.notifHariH1 !== undefined ? { notifHariH1: body.notifHariH1 } : {}),
          ...(body.notifHariH2 !== undefined ? { notifHariH2: body.notifHariH2 } : {}),
          updatedBy: session.user.nip,
        },
      }));
    } else {
      ops.push(prisma.hukdisKonfigurasi.create({
        data: { notifHariH1: body.notifHariH1 ?? 30, notifHariH2: body.notifHariH2 ?? 14, updatedBy: session.user.nip },
      }));
    }
  }

  for (const u of body.jenisUpdates ?? []) {
    // Bila regulasiId dikirim, resolusi dulu (denormalisasi dasarHukum + link).
    let dasarPatch: { dasarHukum?: string | null; regulasiId?: string | null } = {};
    if (u.regulasiId !== undefined) {
      const r = await resolveDasar(u.regulasiId, u.dasarHukum);
      dasarPatch = { dasarHukum: r.dasarHukum, regulasiId: r.regulasiId };
    } else if (u.dasarHukum !== undefined) {
      dasarPatch = { dasarHukum: u.dasarHukum, regulasiId: null };
    }
    ops.push(prisma.hukdisJenis.update({
      where: { id: u.id },
      data: {
        ...(u.label        !== undefined ? { label: u.label }               : {}),
        ...dasarPatch,
        ...(u.kategori     !== undefined ? { kategori: u.kategori }         : {}),
        ...(u.durasiHukdis !== undefined ? { durasiHukdis: u.durasiHukdis } : {}),
        ...(u.berdampakKGB !== undefined ? { berdampakKGB: u.berdampakKGB } : {}),
        ...(u.durasiTunda  !== undefined ? { durasiTunda: u.durasiTunda }   : {}),
        ...(u.aktif        !== undefined ? { aktif: u.aktif }               : {}),
        updatedBy: session.user.nip,
      },
    }));
  }

  await Promise.all(ops);
  return NextResponse.json({ ok: true });
}
