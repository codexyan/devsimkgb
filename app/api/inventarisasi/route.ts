import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canProcessKGB, isSuperAdmin } from "@/lib/auth";
import { penggunaLogin, PESAN_SESI_BERAKHIR } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { daftarKegiatan, daftarKiriman, simpanKegiatan } from "@/lib/inventarisServer";
import {
  ID_KEGIATAN_KANWIL,
  TEMPLATE_KEGIATAN,
  idDariNama,
  isTemplateKegiatan,
  periksaKegiatan,
  type Kegiatan,
} from "@/lib/kegiatanInventaris";

export const runtime = "nodejs";

/**
 * Daftar kegiatan dan kiriman satu kegiatan (?kegiatan=, bawaan "kanwil"). Kode akses hanya dikirim ke Super Admin.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user.role ?? "";
  if (!canProcessKGB(role)) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const kegiatan = await daftarKegiatan();
  const diminta = new URL(req.url).searchParams.get("kegiatan") ?? ID_KEGIATAN_KANWIL;
  const aktif = kegiatan.find((k) => k.id === diminta) ?? kegiatan[0];
  const kiriman = await daftarKiriman(aktif.id);
  const superAdmin = isSuperAdmin(role);
  return NextResponse.json(
    { kegiatan: superAdmin ? kegiatan : kegiatan.map((k) => ({ ...k, kode: "" })), aktif: aktif.id, kiriman },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Nilai kegiatan dari badan permintaan; id dan template diambil dari kegiatan lama bila sudah ada. */
function kegiatanDariBadan(body: Record<string, unknown>, lama: Kegiatan | null, id: string): Kegiatan {
  const teks = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    id,
    nama: teks(body.nama) || lama?.nama || "",
    template: lama?.template ?? (isTemplateKegiatan(body.template) ? body.template : ("" as never)),
    satker: Array.isArray(body.satker) ? body.satker.filter((s): s is string => typeof s === "string") : (lama?.satker ?? []),
    terbuka: body.terbuka === true,
    kode: teks(body.kode).toUpperCase(),
    tutupPada: teks(body.tutupPada),
    // Teks batas lama tidak dipakai lagi setelah pengaturan disimpan dengan waktu tutup.
    batas: "",
    dibuatAt: lama?.dibuatAt ?? new Date().toISOString(),
  };
}

async function penggunaSuperAdmin() {
  const session = await auth();
  if (!session) return { galat: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  if (!isSuperAdmin(session.user.role ?? "")) return { galat: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }) } as const;
  const pengguna = await penggunaLogin(session);
  if (!pengguna) return { galat: NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 }) } as const;
  return { pengguna } as const;
}

function ringkasAudit(k: Kegiatan): string {
  return `${k.terbuka ? "dibuka" : "ditutup"}${k.tutupPada ? `, ditutup otomatis ${k.tutupPada.replace("T", " ")} WITA` : ""}`;
}

/** Ubah pengaturan satu kegiatan: buka/tutup, kode akses, waktu tutup, nama, dan satker sasaran (Super Admin). */
export async function PUT(req: Request) {
  const cek = await penggunaSuperAdmin();
  if ("galat" in cek) return cek.galat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : ID_KEGIATAN_KANWIL;
  const lama = (await daftarKegiatan()).find((k) => k.id === id) ?? null;
  if (!lama) return NextResponse.json({ error: "Kegiatan tidak ditemukan" }, { status: 404 });

  const kegiatan = { ...kegiatanDariBadan(body, lama, id), diubahOleh: cek.pengguna.nama, diubahAt: new Date().toISOString() };
  const kurang = periksaKegiatan(kegiatan);
  if (kurang.length > 0) return NextResponse.json({ error: kurang.join(" ") }, { status: 400 });

  await simpanKegiatan(kegiatan);
  logAudit({
    userId: cek.pengguna.id,
    aksi: "atur_inventarisasi_kgb",
    detail: `Kegiatan "${kegiatan.nama}" ${ringkasAudit(kegiatan)}`,
    targetNama: kegiatan.nama,
  });
  return NextResponse.json({ ok: true });
}

/** Buat kegiatan baru dari salah satu template (Super Admin). */
export async function POST(req: Request) {
  const cek = await penggunaSuperAdmin();
  if ("galat" in cek) return cek.galat;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isTemplateKegiatan(body.template)) return NextResponse.json({ error: "Pilih template kegiatan." }, { status: 400 });

  const semua = await daftarKegiatan();
  const id = idDariNama(typeof body.nama === "string" ? body.nama : "", new Set(semua.map((k) => k.id)));
  const kegiatan = { ...kegiatanDariBadan(body, null, id), diubahOleh: cek.pengguna.nama, diubahAt: new Date().toISOString() };
  const kurang = periksaKegiatan(kegiatan);
  if (kurang.length > 0) return NextResponse.json({ error: kurang.join(" ") }, { status: 400 });

  await simpanKegiatan(kegiatan);
  logAudit({
    userId: cek.pengguna.id,
    aksi: "atur_inventarisasi_kgb",
    detail: `Kegiatan baru "${kegiatan.nama}" (${TEMPLATE_KEGIATAN[kegiatan.template].label}), ${ringkasAudit(kegiatan)}`,
    targetNama: kegiatan.nama,
  });
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
