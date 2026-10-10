import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { logAudit } from "@/lib/auditLog";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { db } from "@/lib/db";
import { bacaKegiatan, bacaKiriman } from "@/lib/inventarisServer";
import { berkasTersalin, salinBerkasKeArsip, salinSemuaKeArsip } from "@/lib/inventarisArsip";
import { ROLES } from "@/lib/auth/roles";

export const runtime = "nodejs";

/** Kegiatan, kiriman, dan pegawai terdaftar untuk ?kegiatan=&nip= atau badan { kegiatan, nip }. */
async function sasaran(kegiatanId: string, nip: string) {
  if (!/^\d{18}$/.test(nip)) return { galat: NextResponse.json({ error: "NIP tidak valid" }, { status: 400 }) } as const;
  const kegiatan = await bacaKegiatan(kegiatanId);
  if (!kegiatan) return { galat: NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 }) } as const;
  const kiriman = await bacaKiriman(kegiatan.id, nip);
  if (!kiriman) return { galat: NextResponse.json({ error: "Kiriman tidak ditemukan" }, { status: 404 }) } as const;
  const pegawai = await db.pegawai.findUnique({ nip });
  return { kegiatan, kiriman, pegawai } as const;
}

/**
 * Berkas kiriman mana yang sudah tersalin ke arsip dokumen pegawai (ADR-027). Pegawai yang belum terdaftar di
 * SIM-KGB tidak punya arsip, sehingga berkasnya belum dapat disalin.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const url = new URL(req.url);
  const s = await sasaran(url.searchParams.get("kegiatan") ?? "", url.searchParams.get("nip") ?? "");
  if ("galat" in s) return s.galat;
  const tersalin = s.pegawai ? await berkasTersalin(s.pegawai.id) : new Set<string>();
  return NextResponse.json(
    { terdaftar: !!s.pegawai, tersalin: s.kiriman.berkas.filter((b) => tersalin.has(b.kunci)).map((b) => b.kunci) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Salin satu berkas kiriman ke arsip dokumen pegawai atas perintah Tim SDM. Badan: { kegiatan, nip, kunci }. */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? "")) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const teks = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");

  // Salin seluruh berkas yang belum tersalin, sekali jalan, sebelum modul dihapus (ADR-098). Khusus Super Admin.
  if (body.semua === true) {
    if (session.user.role !== ROLES.SUPER_ADMIN) return NextResponse.json({ error: "Khusus Super Admin" }, { status: 403 });
    const hasil = await salinSemuaKeArsip(pengguna.nama);
    logAudit({
      userId: pengguna.id,
      aksi: "arsip_berkas_inventarisasi",
      targetNama: "Semua kiriman inventarisasi",
      detail:
        `Salin semua berkas kiriman inventarisasi ke arsip pegawai: ${hasil.disalin} disalin untuk ${hasil.pegawai.length} pegawai` +
        (hasil.pegawai.length ? ` (${hasil.pegawai.join(", ")})` : "") +
        `, ${hasil.sudah} sudah ada, ${hasil.tidakTerbaca} tidak terbaca` +
        (hasil.tanpaPegawai.length
          ? `; belum terdaftar di Data Pegawai: ${hasil.tanpaPegawai.map((t) => `${t.nama} (${t.nip}, ${t.berkas} berkas)`).join(", ")}`
          : ""),
    });
    return NextResponse.json({ ok: true, ...hasil });
  }
  const s = await sasaran(teks("kegiatan"), teks("nip"));
  if ("galat" in s) return s.galat;
  if (!s.pegawai)
    return NextResponse.json({ error: "Pegawai ini belum terdaftar di Data Pegawai, jadi belum punya arsip dokumen." }, { status: 409 });
  const berkas = s.kiriman.berkas.find((b) => b.kunci === teks("kunci"));
  if (!berkas) return NextResponse.json({ error: "Berkas tidak ditemukan pada kiriman ini" }, { status: 404 });

  const hasil = await salinBerkasKeArsip(s.pegawai.id, berkas, {
    oleh: pengguna.nama,
    keterangan: `Dari kiriman ${s.kegiatan.nama}`,
    nomorSK: s.kiriman.isian.nomorSkDasar ?? "",
  });
  if (hasil === "tidak_ada") return NextResponse.json({ error: "Berkas asal tidak terbaca. Coba lagi." }, { status: 404 });
  if (hasil === "disalin")
    logAudit({
      userId: pengguna.id,
      aksi: "arsip_berkas_inventarisasi",
      targetNama: s.pegawai.nama,
      detail: `${berkas.nama} dari kiriman "${s.kegiatan.nama}" disalin ke arsip dokumen ${s.pegawai.nama} (${s.pegawai.nip})`,
    });
  return NextResponse.json({ ok: true, sudahAda: hasil === "sudah" });
}
