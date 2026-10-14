import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canManageHukdis } from "@/lib/auth";
import { jsonLinimasaHukdis } from "@/lib/linimasaHukdis";
import { jsonProyeksiHukdis } from "@/lib/proyeksiHukdis";
import { proyeksiIsianHukdis } from "@/lib/proyeksiHukdisServer";
import { hariIniWita } from "@/lib/waktu";

export const runtime = "nodejs";

/**
 * Perkiraan jadwal KGB dari isian formulir hukdis Kanwil sebelum disimpan (ADR-116), untuk SDM Hukdis dan Super Admin.
 * Hanya membaca. Parameter: `pegawaiId`, `jenis`, `tmtMulai` (yyyy-mm-dd), dan opsional `berdampak` ("1" atau "0") serta
 * `tunda` (bulan) bila peninjau menimpa bawaan jenisnya, dan `tmtBerakhir` untuk pita masa hukuman pada linimasa. `proyeksi`
 * null bila pegawai atau tanggalnya belum cukup; `linimasa` hanya ada bila hukumannya menggeser jadwal.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageHukdis(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const q = new URL(req.url).searchParams;
  const pegawaiId = q.get("pegawaiId")?.trim() ?? "";
  const jenisHukdis = q.get("jenis")?.trim() ?? "";
  if (!pegawaiId || !jenisHukdis) return NextResponse.json({ proyeksi: null, linimasa: null });

  const berdampak = q.get("berdampak");
  const perkiraan = await proyeksiIsianHukdis({
    pegawaiId,
    jenisHukdis,
    tmtMulai: q.get("tmtMulai"),
    tmtBerakhir: q.get("tmtBerakhir"),
    berdampakKGB: berdampak === "1" ? true : berdampak === "0" ? false : undefined,
    durasiTunda: q.get("tunda") ?? undefined,
    hariIni: hariIniWita(),
  });
  return NextResponse.json({
    proyeksi: perkiraan ? jsonProyeksiHukdis(perkiraan.proyeksi) : null,
    linimasa: perkiraan?.linimasa ? jsonLinimasaHukdis(perkiraan.linimasa) : null,
  });
}
