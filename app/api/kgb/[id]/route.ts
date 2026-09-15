import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/sheets/id";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canProcessKGB } from "@/lib/auth";

export const runtime = "nodejs";

const samaHari = (a: Date | string | null | undefined, b: Date | string | null | undefined) =>
  !!a && !!b && new Date(a).toDateString() === new Date(b).toDateString();

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as any;

  // Toggle flagRapelan manual
  if (body.flagRapelan !== undefined) {
    const kgb = await db.riwayatKGB.update({ id }, { flagRapelan: body.flagRapelan });
    if (!kgb) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });
    return NextResponse.json(kgb);
  }

  // Update data SK terakhir (dasar surat)
  if (body.nomorSK !== undefined) {
    const lama = await db.riwayatKGB.findUnique({ id });
    if (!lama) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });

    const patch: Record<string, unknown> = { nomorSK: body.nomorSK };
    if (body.tanggalSK) patch.tanggalSK = new Date(body.tanggalSK);
    if (body.tmtSK) patch.tmtSK = new Date(body.tmtSK);
    if (typeof body.penetapSkDasar === "string") patch.penetapSkDasar = body.penetapSkDasar.trim() || null;
    const kgb = await db.riwayatKGB.update({ id }, patch);

    // Penetap SK dasar tercetak di surat, jadi perubahan sesudah surat dibuat dicatat.
    const penetapBerubah = "penetapSkDasar" in patch && patch.penetapSkDasar !== (lama.penetapSkDasar ?? null);
    if (penetapBerubah && (await db.suratKGB.findUnique({ kgbId: id }))) {
      const [pegawai, userLogin] = await Promise.all([
        db.pegawai.findUnique({ id: lama.pegawaiId }),
        db.user.findUnique({ nip: session.user.nip! }),
      ]);
      if (userLogin) {
        logAudit({
          userId: userLogin.id,
          aksi: "ubah_penetap_sk",
          detail: `Ubah penetap SK dasar KGB ${pegawai?.nama ?? "-"} (${pegawai?.nip ?? "-"}) setelah surat dibuat: "${lama.penetapSkDasar ?? "-"}" menjadi "${patch.penetapSkDasar ?? "-"}"`,
          targetNama: pegawai?.nama ?? "-",
        });
      }
    }
    return NextResponse.json(kgb);
  }

  // Pembatalan. Status lain hanya berpindah lewat input KGB, pembuatan surat,
  // unggah SK final, dan konfirmasi keuangan.
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

  const [pegawai, userLogin] = await Promise.all([
    db.pegawai.findUnique({ id: lama.pegawaiId }),
    db.user.findUnique({ nip: session.user.nip! }),
  ]);

  const kgb = await db.riwayatKGB.update({ id }, { status: "ditolak" });

  // Input KGB menggeser TMT pegawai ke periode berikutnya; kembalikan agar KGB dapat diinput ulang.
  if (
    pegawai &&
    samaHari(pegawai.tmtKgbBerikutnya, lama.tmtKgbBerikutnya) &&
    !samaHari(lama.tmtKgbBaru, lama.tmtKgbBerikutnya)
  ) {
    const selesaiTerakhir = (
      await db.riwayatKGB.findMany({
        where: { pegawaiId: lama.pegawaiId, status: "selesai" },
        orderBy: { field: "tmtKgbBaru", dir: "desc" },
      })
    )[0];
    await db.pegawai.update(
      { id: pegawai.id },
      {
        tmtKgbBerikutnya: lama.tmtKgbBaru,
        tmtKgbTerakhir: selesaiTerakhir?.tmtKgbBaru ?? lama.tmtSK ?? pegawai.tmtKgbTerakhir,
      },
    );
  }

  if (userLogin) {
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
      detail: `Status KGB ${pegawai?.nama ?? "-"} (${pegawai?.nip ?? "-"}) diubah menjadi "Ditolak", Alasan: ${alasan}`,
      targetNama: pegawai?.nama ?? "-",
    });
  }

  return NextResponse.json({ ...kgb, pegawai: pegawai ? { nama: pegawai.nama, nip: pegawai.nip } : null });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canProcessKGB(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const { id } = await params;
  const ok = await db.riwayatKGB.delete({ id });
  if (!ok) return NextResponse.json({ error: "Data KGB tidak ditemukan" }, { status: 404 });

  return NextResponse.json({ message: "Data KGB berhasil dihapus" });
}
