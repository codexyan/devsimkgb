import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis } from "@/lib/auth";
import { galatIsianJenisHukdis, perubahanJenisHukdis, ringkasanPerubahanJenisHukdis } from "@/lib/hukdisJenis";

export const runtime = "nodejs";

type JenisBaris = {
  id: string;
  kode?: string;
  label?: string | null;
  kategori?: string | null;
  durasiHukdis?: number | null;
  berdampakKGB?: boolean | null;
  durasiTunda?: number | null;
  aktif?: boolean | null;
  regulasiId: string | null;
  urutan: number | null;
  dasarHukum: string | null;
};
type RegulasiBaris = { id: string; nomor: string; tahun: string; status: string };

// Tab HukdisKonfigurasi (notifHariH1/H2) tidak dibaca lagi: tidak ada halaman yang memakainya dan
// notifikasi hukdis memakai ambang tetap. Definisi tabnya tetap ada untuk migrasi Supabase.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  try {
    const [jenisList, regulasiList] = await Promise.all([
      db.hukdisJenis.findMany({ orderBy: { field: "urutan", dir: "asc" } }) as Promise<JenisBaris[]>,
      db.regulasi.findMany() as Promise<RegulasiBaris[]>,
    ]);
    const regById = new Map(regulasiList.map((r) => [r.id, r]));

    // Emulasi include regulasi.
    const jenis = jenisList.map((j) => {
      const r = j.regulasiId ? regById.get(j.regulasiId) : null;
      return { ...j, regulasi: r ? { id: r.id, nomor: r.nomor, tahun: r.tahun, status: r.status } : null };
    });

    return NextResponse.json({ jenis });
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

  let body: {
    label: string; dasarHukum?: string; regulasiId?: string | null; kategori: string;
    durasiHukdis: number; berdampakKGB: boolean; durasiTunda?: number | null; aktif: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
    if (!body || typeof body !== "object") throw new Error("bukan objek");
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  // Lama penundaan hanya diperiksa untuk jenis yang berdampak KGB; selain itu disimpan kosong.
  const galat = galatIsianJenisHukdis({
    label: body.label ?? "",
    kategori: body.kategori ?? "",
    dasarHukum: body.dasarHukum ?? undefined,
    regulasiId: body.regulasiId ?? undefined,
    durasiHukdis: body.durasiHukdis ?? undefined,
    berdampakKGB: body.berdampakKGB ?? undefined,
    durasiTunda: body.berdampakKGB === true ? (body.durasiTunda ?? 12) : undefined,
    aktif: body.aktif ?? undefined,
  });
  if (galat) return NextResponse.json({ error: galat }, { status: 400 });

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
  const all = (await db.hukdisJenis.findMany()) as JenisBaris[];
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

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (userLogin) {
    logAudit({
      userId: userLogin.id,
      aksi: "tambah_jenis_hukdis",
      detail: `Tambah jenis hukdis ${jenis.label} (${jenis.kategori}), berdampak KGB: ${jenis.berdampakKGB ? `Ya, penundaan ${jenis.durasiTunda} bulan` : "Tidak"}`,
    });
  }

  return NextResponse.json(jenis, { status: 201 });
}

/* Menyelesaikan dasar hukum: jika regulasiId valid, denormalisasi labelnya. */
async function resolveDasar(regulasiId?: string | null, manual?: string | null) {
  const id = regulasiId?.trim() || null;
  if (id) {
    const reg = (await db.regulasi.findUnique({ id })) as RegulasiBaris | null;
    if (reg) return { regulasiId: id, dasarHukum: `${reg.nomor} Tahun ${reg.tahun}` };
  }
  const text = manual?.trim() || null;
  return { regulasiId: null, dasarHukum: text };
}

/* ── PATCH: update jenis hukdis ───────────────────────────────────────── */
interface JenisUpdate {
  id: string; label?: string; dasarHukum?: string | null; regulasiId?: string | null;
  kategori?: string; durasiHukdis?: number; berdampakKGB?: boolean; durasiTunda?: number | null; aktif?: boolean;
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  let body: { jenisUpdates?: JenisUpdate[] };
  try {
    body = (await req.json()) as typeof body;
    if (!body || typeof body !== "object") throw new Error("bukan objek");
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }
  const updates = Array.isArray(body.jenisUpdates) ? body.jenisUpdates : [];

  if (updates.length === 0) return NextResponse.json({ ok: true });

  // Semua perubahan diperiksa terhadap nilai tersimpan sebelum ada yang disimpan.
  const jenisById = new Map(((await db.hukdisJenis.findMany()) as JenisBaris[]).map((j) => [j.id, j] as const));
  const rencana: { u: JenisUpdate; lama: JenisBaris; aturan: Partial<JenisUpdate> }[] = [];
  for (const u of updates) {
    if (!u || typeof u !== "object" || typeof u.id !== "string")
      return NextResponse.json({ error: "Data jenis tidak valid" }, { status: 400 });
    const lama = jenisById.get(u.id);
    if (!lama) return NextResponse.json({ error: "Jenis hukdis tidak ditemukan. Muat ulang halaman." }, { status: 404 });
    const galatDasar = galatIsianJenisHukdis({ dasarHukum: u.dasarHukum, regulasiId: u.regulasiId });
    if (galatDasar) return NextResponse.json({ error: galatDasar }, { status: 400 });
    const hasil = perubahanJenisHukdis(lama, u);
    if (hasil.galat !== undefined) {
      return NextResponse.json({ error: `${lama.label ?? lama.kode ?? u.id}: ${hasil.galat}` }, { status: 400 });
    }
    rencana.push({ u, lama, aturan: hasil.perubahan as Partial<JenisUpdate> });
  }

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  for (const { u, lama, aturan } of rencana) {
    // Halaman selalu mengirim dasarHukum saat menyimpan; tautan regulasi hanya dilepas
    // bila teks dasar hukumnya benar-benar diubah.
    let dasarPatch: { dasarHukum?: string | null; regulasiId?: string | null } = {};
    if (u.regulasiId !== undefined) {
      const r = await resolveDasar(u.regulasiId, u.dasarHukum);
      dasarPatch = { dasarHukum: r.dasarHukum, regulasiId: r.regulasiId };
    } else if (u.dasarHukum !== undefined && (u.dasarHukum?.trim() || null) !== (lama.dasarHukum || null)) {
      dasarPatch = { dasarHukum: u.dasarHukum?.trim() || null, regulasiId: null };
    }
    const perubahan = ringkasanPerubahanJenisHukdis(lama, { ...aturan, ...dasarPatch });
    if (dasarPatch.regulasiId !== undefined && dasarPatch.regulasiId !== (lama.regulasiId ?? null)) {
      perubahan.push(dasarPatch.regulasiId ? "tautan regulasi diubah" : "tautan regulasi dilepas");
    }
    if (perubahan.length === 0) continue;

    await db.hukdisJenis.update(
      { id: u.id },
      { ...aturan, ...dasarPatch, updatedAt: new Date(), updatedBy: session.user.nip },
    );

    // Satu entri riwayat per jenis yang berubah, dengan nilai lama dan baru.
    if (userLogin) {
      logAudit({
        userId: userLogin.id,
        aksi: "ubah_jenis_hukdis",
        detail: `Ubah jenis hukdis ${lama.label ?? lama.kode ?? u.id}: ${perubahan.join(", ")}`,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
