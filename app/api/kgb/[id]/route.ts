import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canProcessKGB } from "@/lib/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { alasanTolakBuatSk, alasanTolakUbahSkTerakhir, bacaTanggalInput, tmtTerakhirSebelumInput } from "@/lib/prosesKgb";
import { nomorSkBentrok } from "@/lib/nomorSkBentrok";
import { samaTanggalKalender } from "@/lib/waktu";
import { penundaanHukdisSelamaKgb } from "@/lib/dataPegawai";
import type { RiwayatHukdisRow } from "@/lib/hukdisKedaluwarsa";

export const runtime = "nodejs";

/** Draf nomor dan tanggal SK baru satu KGB, untuk mengisi ulang Buat SK (ADR-011). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role!)) return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  const { id } = await params;
  const kgb = await db.riwayatKGB.findUnique({ id });
  if (!kgb) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
  return NextResponse.json({
    drafNomorSurat: kgb.drafNomorSurat ?? null,
    drafTanggalSurat: kgb.drafTanggalSurat ? new Date(kgb.drafTanggalSurat).toISOString() : null,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  // Akun yang sudah dihapus tidak boleh mengubah data, karena perubahan dicatat atas nama pelakunya.
  const userLogin = await penggunaLogin(session);
  if (!userLogin)
    return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object") throw new Error("bukan objek");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Request body tidak valid" }, { status: 400 });
  }

  // Draf nomor dan tanggal SK baru (Simpan draf pada Buat SK, ADR-011). Disimpan tanpa membuat catatan
  // surat, jadi status KGB dan tahapnya di papan tidak berubah. Nomornya dipesan: bentrok dengan SK atau
  // draf KGB lain ditolak.
  if (body.drafSk !== undefined) {
    const draf = body.drafSk && typeof body.drafSk === "object" ? (body.drafSk as Record<string, unknown>) : {};
    const nomor = typeof draf.nomorSurat === "string" ? draf.nomorSurat.trim() : "";
    const teksTanggal = typeof draf.tanggalSurat === "string" ? draf.tanggalSurat.trim() : "";
    const tanggal = teksTanggal ? bacaTanggalInput(teksTanggal) : null;
    if (teksTanggal && !tanggal) return NextResponse.json({ error: "Tanggal SK Baru tidak valid" }, { status: 400 });

    const kgb = await db.riwayatKGB.findUnique({ id });
    if (!kgb) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
    const alasan = alasanTolakBuatSk(kgb.status);
    if (alasan) return NextResponse.json({ error: alasan }, { status: 409 });
    if (nomor) {
      const bentrok = await nomorSkBentrok(nomor, id);
      if (bentrok) return NextResponse.json({ error: bentrok }, { status: 409 });
    }
    await db.riwayatKGB.update({ id }, { drafNomorSurat: nomor || null, drafTanggalSurat: nomor ? tanggal : null });
    return NextResponse.json({ ok: true });
  }

  // Update data SK terakhir (dasar surat), hanya selama KGB Sedang Diproses.
  if (body.nomorSK !== undefined) {
    if (typeof body.nomorSK !== "string")
      return NextResponse.json({ error: "Nomor SK Terakhir tidak valid" }, { status: 400 });

    const lama = await db.riwayatKGB.findUnique({ id });
    if (!lama) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
    const alasan = alasanTolakUbahSkTerakhir(lama.status);
    if (alasan) return NextResponse.json({ error: alasan }, { status: 409 });

    const patch: { nomorSK: string; tanggalSK?: Date; tmtSK?: Date; penetapSkDasar?: string | null } = {
      nomorSK: body.nomorSK.trim(),
    };
    // Tanggal kosong berarti tidak diubah; tanggal yang diisi harus valid.
    for (const kolom of ["tanggalSK", "tmtSK"] as const) {
      const nilai = body[kolom];
      if (nilai === undefined || nilai === null || nilai === "") continue;
      const tanggal = bacaTanggalInput(nilai);
      if (!tanggal) {
        const label = kolom === "tanggalSK" ? "Tanggal SK Terakhir" : "TMT SK Terakhir";
        return NextResponse.json({ error: `${label} tidak valid` }, { status: 400 });
      }
      patch[kolom] = tanggal;
    }
    if (typeof body.penetapSkDasar === "string") patch.penetapSkDasar = body.penetapSkDasar.trim() || null;
    const kgb = await db.riwayatKGB.update({ id }, patch);

    // Penetap SK dasar tercetak di surat, jadi perubahan sesudah surat dibuat dicatat.
    const penetapBerubah = "penetapSkDasar" in patch && patch.penetapSkDasar !== (lama.penetapSkDasar ?? null);
    if (penetapBerubah && (await db.suratKGB.findUnique({ kgbId: id }))) {
      const pegawai = await db.pegawai.findUnique({ id: lama.pegawaiId });
      logAudit({
        userId: userLogin.id,
        aksi: "ubah_penetap_sk",
        detail: `Ubah penetap SK dasar KGB ${pegawai?.nama ?? "-"} (${pegawai?.nip ?? "-"}) setelah surat dibuat: "${lama.penetapSkDasar ?? "-"}" menjadi "${patch.penetapSkDasar ?? "-"}"`,
        targetNama: pegawai?.nama ?? "-",
      });
    }
    return NextResponse.json(kgb);
  }

  // Pembatalan. Status lain hanya berpindah lewat Input KGB, unggah SK final, dan konfirmasi keuangan;
  // penanda rapelan diturunkan dari batas input SDM dan tidak diubah manual.
  if (body.status !== "ditolak") {
    return NextResponse.json({ error: "Status tidak valid" }, { status: 400 });
  }
  const alasan = typeof body.alasanTolak === "string" ? body.alasanTolak.trim() : "";
  if (!alasan) {
    return NextResponse.json({ error: "Alasan pembatalan wajib diisi" }, { status: 400 });
  }

  const lama = await db.riwayatKGB.findUnique({ id });
  if (!lama) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
  if (lama.isArsip || !["belum_diproses", "sedang_diproses"].includes(lama.status)) {
    return NextResponse.json(
      { error: "Hanya KGB yang belum atau sedang diproses yang dapat dibatalkan" },
      { status: 409 },
    );
  }

  const pegawai = await db.pegawai.findUnique({ id: lama.pegawaiId });

  // Input KGB menggeser TMT pegawai ke periode berikutnya; kembalikan agar KGB dapat diinput ulang.
  const pulihkanTmt =
    pegawai !== null &&
    samaTanggalKalender(pegawai.tmtKgbBerikutnya, lama.tmtKgbBerikutnya) &&
    !samaTanggalKalender(lama.tmtKgbBaru, lama.tmtKgbBerikutnya);

  // Penundaan hukdis yang dicatat selama KGB ini berjalan hanya tersimpan pada TMT KGB berikutnya,
  // yang ikut dikembalikan saat pembatalan. Pembatalan ditolak agar penundaan itu tidak hilang diam-diam.
  if (pulihkanTmt) {
    const riwayatHukdis = (await db.riwayatHukdis.findMany({
      where: { pegawaiId: lama.pegawaiId },
    })) as unknown as RiwayatHukdisRow[];
    const bulanTunda = penundaanHukdisSelamaKgb({ kgb: lama, riwayatHukdis });
    if (bulanTunda > 0) {
      return NextResponse.json(
        {
          error: `KGB ini tidak dapat dibatalkan karena selama KGB ini berjalan tercatat hukuman disiplin yang menunda KGB berikutnya ${bulanTunda} bulan. Pembatalan mengembalikan jadwal KGB pegawai sehingga penundaan tersebut akan hilang. Hapus catatan hukuman disiplin itu terlebih dahulu, batalkan KGB, lalu catat kembali hukuman disiplin setelah KGB diinput ulang.`,
        },
        { status: 409 },
      );
    }
  }

  const kgb = await db.riwayatKGB.update({ id }, { status: "ditolak" });

  if (pulihkanTmt && pegawai) {
    // TMT terakhir diturunkan dari tambahan MKG saat input, bukan dari TMT SK dasar yang bisa berupa
    // SK kenaikan pangkat; KGB selesai terakhir hanya dipakai bila tambahan itu tidak diketahui.
    let tmtKgbTerakhir = tmtTerakhirSebelumInput(lama);
    if (!tmtKgbTerakhir) {
      const selesaiTerakhir = (
        await db.riwayatKGB.findMany({
          where: { pegawaiId: lama.pegawaiId, status: "selesai" },
          orderBy: { field: "tmtKgbBaru", dir: "desc" },
        })
      )[0];
      tmtKgbTerakhir = selesaiTerakhir?.tmtKgbBaru ?? pegawai.tmtKgbTerakhir;
    }
    await db.pegawai.update(
      { id: pegawai.id },
      { tmtKgbBerikutnya: lama.tmtKgbBaru, tmtKgbTerakhir },
    );
  }

  await db.serahTerima.create({
    id: newId(),
    kgbId: id,
    namaAdmin: session.user.nama || userLogin.nama,
    keterangan: `DITOLAK: ${alasan}`,
    tanggalSerahTerima: new Date(),
    createdBy: userLogin.id,
  });
  logAudit({
    userId: userLogin.id,
    aksi: "reject_kgb",
    detail: `Status KGB ${pegawai?.nama ?? "-"} (${pegawai?.nip ?? "-"}) diubah menjadi "Dibatalkan", Alasan: ${alasan}`,
    targetNama: pegawai?.nama ?? "-",
  });

  return NextResponse.json({ ...kgb, pegawai: pegawai ? { nama: pegawai.nama, nip: pegawai.nip } : null });
}
