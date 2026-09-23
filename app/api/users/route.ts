import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { ROLE_LABEL, ROLES } from "@/lib/auth";
import { nilaiSatkerUntukPeran } from "@/lib/aksesUpt";
import { SATKER } from "@/lib/satker";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

const PERAN_VALID: string[] = Object.values(ROLES);

// GET, ambil semua user
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const all = await db.user.findMany({ orderBy: { field: "createdAt", dir: "desc" } });
  const users = all.map((u) => ({ id: u.id, nip: u.nip, nama: u.nama, role: u.role, satker: u.satker ?? null, createdAt: u.createdAt }));
  return NextResponse.json(users);
}

// POST, tambah user baru
export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const admin = await penggunaLogin(session);
  if (!admin) {
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("bukan objek");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }
  const teks = (nilai: unknown) => (typeof nilai === "string" ? nilai.trim() : "");
  const nip = teks(body.nip);
  const nama = teks(body.nama);
  const role = teks(body.role);
  const password = typeof body.password === "string" ? body.password : "";

  if (!nip || !nama || !role || !password) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }
  if (!PERAN_VALID.includes(role)) {
    return NextResponse.json({ error: "Peran tidak valid" }, { status: 400 });
  }
  // Admin UPT wajib punya satker; peran Kanwil selalu tanpa satker (lib/aksesUpt.ts).
  const satker = nilaiSatkerUntukPeran(role, body.satker);
  if (!satker.ok) {
    return NextResponse.json({ error: satker.pesan }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ nip });
  if (existing) {
    return NextResponse.json({ error: "NIP sudah terdaftar" }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = {
    id: newId(),
    nip,
    password: hashedPassword,
    nama,
    jabatan: null,
    email: null,
    role,
    createdAt: new Date(),
    satker: satker.satker,
  };
  await db.user.create(user);

  logAudit({
    userId: admin.id,
    aksi: "tambah_pengguna",
    detail: `Tambah pengguna ${nama} (${nip}) dengan peran ${ROLE_LABEL[role] ?? role}${satker.satker ? `, satker ${SATKER.find((s) => s.kode === satker.satker)?.nama ?? satker.satker}` : ""}`,
  });

  return NextResponse.json(
    { id: user.id, nip: user.nip, nama: user.nama, role: user.role, satker: user.satker, createdAt: user.createdAt },
    { status: 201 },
  );
}
