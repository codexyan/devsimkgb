import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { hariIniWita, tanggalKalender } from "@/lib/waktu";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Jejak audit hanya untuk Super Admin: data sensitif lintas pengguna.
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get("perPage") || "15")));
  const aksi = searchParams.get("aksi") || "";
  const user = searchParams.get("user") || "";
  const dari = searchParams.get("dari") || "";
  const sampai = searchParams.get("sampai") || "";
  const q = searchParams.get("q") || "";

  try {
    const [logs, users] = await Promise.all([
      db.auditLog.findMany({ orderBy: { field: "waktu", dir: "desc" } }),
      db.user.findMany(),
    ]);
    const namaById = new Map(users.map((u) => [u.id, u.nama]));

    const sampaiDate = sampai ? new Date(sampai) : null;
    if (sampaiDate) sampaiDate.setHours(23, 59, 59, 999);
    const dariDate = dari ? new Date(dari) : null;
    const ql = q.toLowerCase();
    const ul = user.toLowerCase();

    const filtered = logs.filter((l) => {
      const uname = l.userId ? namaById.get(l.userId) ?? "" : "";
      if (aksi && l.aksi !== aksi) return false;
      if (user && !uname.toLowerCase().includes(ul)) return false;
      if (dariDate && !(l.waktu && l.waktu >= dariDate)) return false;
      if (sampaiDate && !(l.waktu && l.waktu <= sampaiDate)) return false;
      if (q) {
        const match =
          (l.detail ?? "").toLowerCase().includes(ql) ||
          (l.targetNama ?? "").toLowerCase().includes(ql) ||
          uname.toLowerCase().includes(ql);
        if (!match) return false;
      }
      return true;
    });

    // Ringkasan dihitung dari seluruh hasil saringan, bukan hanya halaman yang tampil, supaya
    // panel samping menggambarkan periode yang sedang dilihat.
    const perAksi = new Map<string, number>();
    const pelaku = new Set<string>();
    const kunciHariIni = hariIniWita().getTime();
    let hariIni = 0;
    for (const l of filtered) {
      perAksi.set(l.aksi, (perAksi.get(l.aksi) ?? 0) + 1);
      pelaku.add(l.userId ? namaById.get(l.userId) ?? "Pengguna dihapus" : "Sistem");
      if (tanggalKalender(l.waktu)?.getTime() === kunciHariIni) hariIni++;
    }
    const ringkasan = [...perAksi.entries()]
      .map(([aksi, jumlah]) => ({ aksi, jumlah }))
      .sort((a, b) => b.jumlah - a.jumlah);

    const total = filtered.length;
    const totalPages = Math.ceil(total / perPage);
    const pageData = filtered.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

    return NextResponse.json({
      data: pageData.map((item) => ({
        id: item.id,
        waktu: item.waktu ? item.waktu.toISOString() : "",
        // Entri milik pengguna yang sudah dihapus tetap menyimpan id-nya; nama dan NIP-nya ada pada entri hapus_pengguna.
        user: item.userId ? namaById.get(item.userId) || "Pengguna dihapus" : "Sistem",
        aksi: item.aksi,
        detail: item.detail,
        ipAddress: item.ipAddress || null,
        targetNama: item.targetNama || null,
      })),
      total,
      page,
      perPage,
      totalPages,
      ringkasan,
      hariIni,
      jumlahPelaku: pelaku.size,
    });
  } catch (error) {
    console.error("Error fetching audit log:", error);
    return NextResponse.json({ error: "Gagal memuat riwayat aktivitas" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "superAdminCore") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const userLogin = await penggunaLogin(session);
  if (!userLogin) {
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Tidak ada ID yang dipilih" }, { status: 400 });
  }

  const count = await db.auditLog.deleteMany({ id: { in: ids } });

  logAudit({
    userId: userLogin.id,
    aksi: "hapus_riwayat",
    detail: `Super Admin menghapus ${count} entri riwayat aktivitas`,
  });

  return NextResponse.json({ deleted: count });
}
