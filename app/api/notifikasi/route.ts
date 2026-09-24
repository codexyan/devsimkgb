import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { TIPE_NOTIFIKASI, bolehLihatNotifikasi, tipeNotifikasiUntukRole } from "@/lib/generateNotifikasi";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import { pegawaiSatker, satkerAkunUpt } from "@/lib/aksesUpt";
import { ROLES } from "@/lib/auth/roles";

export const runtime = "nodejs";

// Rute ini hanya membaca. Notifikasi dibuat oleh cron harian (/api/cron/notifikasi) dan tombol
// "Periksa sekarang" (/api/notifikasi/periksa), bukan di sini: sidebar memanggil GET dari setiap
// halaman dashboard, dan menjalankan generator di jalur itu membuat Worker melampaui batas sumber daya.

export async function GET(req: NextRequest) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tipeRole = tipeNotifikasiUntukRole(session.user.role);
  if (tipeRole !== null && tipeRole.length === 0) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const tipeFilter = searchParams.get("tipe") || "";
  const dibacaFilter = searchParams.get("dibaca");
  const prioritasFilter = searchParams.get("prioritas") || "";
  const limitParam = Number.parseInt(searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(200, Math.max(1, limitParam)) : 50;

  if (tipeFilter && !bolehLihatNotifikasi(session.user.role, tipeFilter)) return NextResponse.json([]);

  const where: Record<string, unknown> = {};
  if (tipeFilter) where.tipe = tipeFilter;
  else if (tipeRole !== null) where.tipe = { in: [...tipeRole] };
  if (dibacaFilter !== null && dibacaFilter !== "") where.dibaca = dibacaFilter === "true";
  if (prioritasFilter) where.prioritas = prioritasFilter;

  const all = await db.notifikasi.findMany({ where, orderBy: { field: "createdAt", dir: "desc" } });

  // Admin UPT hanya menerima notifikasi tentang pegawai satkernya sendiri.
  if (session.user.role === ROLES.ADMIN_UPT) {
    // Satker dibaca dari baris pengguna, bukan token, agar perubahan oleh Super Admin langsung berlaku.
    const pengguna = await penggunaLogin(session);
    const kode = pengguna ? satkerAkunUpt({ role: pengguna.role, satker: pengguna.satker }) : null;
    if (!kode) return NextResponse.json([]);
    const idPegawai = new Set(pegawaiSatker(await db.pegawai.findMany(), kode).map((p) => p.id));
    // Riwayat KGB hanya dibaca bila memang ada notifikasi yang menunjuk ke KGB, bukan ke pegawai.
    const adaSkTerbit = all.some((n) => n.tipe === "sk_terbit");
    const idKgb = adaSkTerbit
      ? new Set((await db.riwayatKGB.findMany()).filter((k) => idPegawai.has(k.pegawaiId)).map((k) => k.id))
      : new Set<string>();
    // Usulan yang dikembalikan menunjuk ke usulannya, bukan ke pegawainya, sebab usulan pegawai baru
    // belum punya pegawai sampai disetujui. Satkernya karena itu dibaca dari baris usulan.
    const adaUsulanRevisi = all.some((n) => n.tipe === TIPE_NOTIFIKASI.USULAN_REVISI);
    const idUsulan = adaUsulanRevisi
      ? new Set((await db.usulanPegawai.findMany({ where: { satker: kode } })).map((u) => u.id))
      : new Set<string>();
    const milikSatker = all.filter((n) => {
      const ref = n.referenceId ?? "";
      if (n.tipe === "sk_terbit") return idKgb.has(ref);
      if (n.tipe === TIPE_NOTIFIKASI.USULAN_REVISI) return idUsulan.has(ref);
      return idPegawai.has(ref);
    });
    return NextResponse.json(milikSatker.slice(0, limit));
  }

  return NextResponse.json(all.slice(0, limit));
}

// Tandai dibaca. Status dibaca berlaku untuk semua pengguna, jadi hanya notifikasi yang boleh dilihat
// role ini yang dapat ditandai.
export async function PATCH(req: Request) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: unknown; dibacaSemua?: unknown };
  try {
    body = (await req.json()) as { id?: unknown; dibacaSemua?: unknown };
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  const role = session.user.role;
  // Status dibaca dipakai bersama semua penerima, jadi peran lihat-saja tidak boleh mengubahnya.
  if (role === ROLES.ADMIN_UPT)
    return NextResponse.json({ error: "Akun Admin UPT hanya dapat melihat notifikasi" }, { status: 403 });
  if (body.dibacaSemua === true) {
    const tipeRole = tipeNotifikasiUntukRole(role);
    if (tipeRole !== null && tipeRole.length === 0) return NextResponse.json({ success: true });
    const where = tipeRole === null ? { dibaca: false } : { dibaca: false, tipe: { in: [...tipeRole] } };
    await db.notifikasi.updateMany(where, { dibaca: true });
    return NextResponse.json({ success: true });
  }

  if (typeof body.id === "string" && body.id) {
    const notif = await db.notifikasi.findUnique({ id: body.id });
    if (!notif || !bolehLihatNotifikasi(role, notif.tipe))
      return NextResponse.json({ error: "Notifikasi tidak ditemukan" }, { status: 404 });
    await db.notifikasi.update({ id: body.id }, { dibaca: true });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "id atau dibacaSemua wajib diisi" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Penghapusan notifikasi hanya untuk Super Admin, satu per satu atau seluruhnya.
  if (session.user.role !== "superAdminCore")
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  if (!(await penggunaLogin(session)))
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (searchParams.get("all") === "true") {
    const count = await db.notifikasi.deleteMany({});
    return NextResponse.json({ success: true, deleted: count });
  }

  if (id) {
    await db.notifikasi.delete({ id });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "id atau all=true wajib diisi" }, { status: 400 });
}
