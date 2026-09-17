import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeRiwayatKGB } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canManageHukdis } from "@/lib/auth";
import { kgbBerjalanTerbaru } from "@/lib/dataPegawai";
import { ringkasanHukdisPegawai, type RiwayatHukdisRow } from "@/lib/hukdisKedaluwarsa";
import {
  kgbTercatatUntukPencabutan,
  rencanaPencabutanPenundaan,
  rencanaSiklusBerikutnya,
  type RencanaSiklusKgb,
} from "@/lib/jadwalKgb";
import { formatTanggalId, hariIniWita } from "@/lib/waktu";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ hukdisId: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canManageHukdis(session.user.role!))
    return NextResponse.json({ error: "Akses ditolak: hanya SDM Hukdis dan Super Admin" }, { status: 403 });

  const { hukdisId } = await params;

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const hukdis = (await db.riwayatHukdis.findUnique({ id: hukdisId })) as unknown as RiwayatHukdisRow | null;
  if (!hukdis)
    return NextResponse.json({ error: "Data tidak ditemukan" }, { status: 404 });

  const pegawai = await db.pegawai.findUnique({ id: hukdis.pegawaiId });
  if (!pegawai)
    return NextResponse.json({ error: "Pegawai tidak ditemukan" }, { status: 404 });

  const hariIni = hariIniWita();
  const [riwayatKgb, riwayatHukdis] = await Promise.all([
    db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id } }),
    db.riwayatHukdis.findMany({
      where: { pegawaiId: pegawai.id },
      orderBy: { field: "createdAt", dir: "asc" },
    }) as unknown as Promise<RiwayatHukdisRow[]>,
  ]);
  const kgbAktif = kgbBerjalanTerbaru(riwayatKgb);

  // TMT hanya dipulihkan bila jadwal sekarang masih hasil penundaan dari hukdis ini: tidak ada KGB yang
  // dicatat sesudah hukdis, selain KGB yang TMT berikutnya memuat penundaan dari hukdis ini.
  let rencana = rencanaPencabutanPenundaan({
    hukdis,
    pegawai,
    kgbAktif,
    kgbTercatat: kgbTercatatUntukPencabutan({ riwayatKgb, hukdis }),
  });

  let placeholderBaru: RencanaSiklusKgb | null = null;
  if (rencana.aksi === "pulihkan" && rencana.buatPlaceholder) {
    const placeholderLama = riwayatKgb
      .filter((k) => k.status === "belum_diproses")
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
    try {
      placeholderBaru = rencanaSiklusBerikutnya({
        ...pegawai,
        tmtKgbBerikutnya: rencana.tmtKgbBerikutnya,
        penetapSkDasar: placeholderLama?.penetapSkDasar ?? null,
        hariIni,
      });
    } catch (e) {
      const pesan = e instanceof Error ? e.message : "jadwal KGB tidak dapat dihitung";
      rencana = { aksi: "tetap", alasan: `TMT KGB tidak dipulihkan otomatis: ${pesan}.` };
    }
  }

  // Penanda hukdis pegawai diambil dari hukdis lain yang masih berlaku menurut tanggal berakhirnya.
  const penanda = ringkasanHukdisPegawai(
    riwayatHukdis.filter((h) => h.id !== hukdisId),
    hariIni,
  );

  // Hukdis dihapus lebih dulu: bila langkah berikutnya gagal, pengulangan tidak menggeser TMT dua kali.
  await db.riwayatHukdis.delete({ id: hukdisId });
  let pegawaiDiubah = false;
  try {
    await db.pegawai.update(
      { id: pegawai.id },
      {
        ...penanda,
        ...(rencana.aksi === "pulihkan" ? { tmtKgbBerikutnya: rencana.tmtKgbBerikutnya, updatedAt: new Date() } : {}),
      },
    );
    pegawaiDiubah = true;

    if (rencana.aksi === "pulihkan" && rencana.geserKgbAktif && kgbAktif) {
      await db.riwayatKGB.update({ id: kgbAktif.id }, { tmtKgbBerikutnya: rencana.tmtKgbBerikutnya });
    }
    if (placeholderBaru) {
      await db.riwayatKGB.deleteMany({ pegawaiId: pegawai.id, status: "belum_diproses" });
      await db.riwayatKGB.create(makeRiwayatKGB({ pegawaiId: pegawai.id, createdBy: userLogin.id, ...placeholderBaru }));
    }
  } catch (err) {
    console.error("[hukdis] pembaruan jadwal sesudah hukdis dihapus gagal:", err);
    // Data pegawai belum berubah: catatan hukdis dikembalikan agar penghapusan dapat diulang dengan aman.
    if (!pegawaiDiubah) {
      try {
        await db.riwayatHukdis.create(hukdis);
        return NextResponse.json(
          { error: "Catatan hukdis gagal dihapus dan tidak ada perubahan yang tersimpan. Coba lagi beberapa saat lagi." },
          { status: 500 },
        );
      } catch (e) {
        console.error("[hukdis] catatan hukdis gagal dikembalikan:", e);
      }
    }
    const tmtSeharusnya =
      rencana.aksi === "pulihkan" ? rencana.tmtKgbBerikutnya : pegawai.tmtKgbBerikutnya;
    logAudit({
      userId: userLogin.id,
      aksi: "hapus_hukdis",
      detail: `Hapus hukdis ${hukdis.jenisHukdis} untuk ${pegawai.nama} (${pegawai.nip}), pembaruan jadwal KGB gagal; TMT KGB berikutnya seharusnya ${formatTanggalId(tmtSeharusnya)}`,
      targetNama: pegawai.nama,
    });
    return NextResponse.json(
      {
        error:
          `Catatan hukdis dihapus, tetapi data KGB ${pegawai.nama} gagal diperbarui. Sebelum mencatat hukdis lagi, ` +
          `periksa Data Pegawai: TMT KGB berikutnya seharusnya ${formatTanggalId(tmtSeharusnya)}, dan jadwal KGB ` +
          `Belum Diproses perlu sesuai dengan tanggal itu.`,
      },
      { status: 500 },
    );
  }

  const berdampak = hukdis.berdampakKGB === true && (hukdis.durasiTunda ?? 0) > 0;
  const pesan =
    rencana.aksi === "pulihkan"
      ? `Catatan hukdis dihapus. TMT KGB berikutnya dipulihkan ke ${formatTanggalId(rencana.tmtKgbBerikutnya)}.`
      : berdampak
        ? `Catatan hukdis dihapus. ${rencana.alasan} Periksa TMT KGB berikutnya pada data pegawai.`
        : "Catatan hukdis dihapus.";

  logAudit({
    userId: userLogin.id,
    aksi: "hapus_hukdis",
    detail: `Hapus hukdis ${hukdis.jenisHukdis} untuk ${pegawai.nama} (${pegawai.nip})${
      rencana.aksi === "pulihkan"
        ? `, TMT KGB dipulihkan ke ${formatTanggalId(rencana.tmtKgbBerikutnya)}`
        : berdampak
          ? ", TMT KGB tidak dipulihkan"
          : ""
    }`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({
    ok: true,
    tmtDipulihkan: rencana.aksi === "pulihkan",
    tmtKgbBerikutnya: rencana.aksi === "pulihkan" ? rencana.tmtKgbBerikutnya : null,
    pesan,
  });
}
