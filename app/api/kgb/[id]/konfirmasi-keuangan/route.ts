import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { makeRiwayatKGB } from "@/lib/sheets/tables";
import { auth } from "@/auth";
import { logAudit } from "@/lib/auditLog";
import { canAccessKeuangan } from "@/lib/auth";
import { penetapDariSurat } from "@/lib/penetapSk";
import { rencanaSetelahKgbSelesai, type RencanaSetelahKgbSelesai } from "@/lib/jadwalKgb";
import { placeholderBerlebih, type SuratKgbTersimpan } from "@/lib/prosesKgb";
import { hariIniWita, tanggalKalender } from "@/lib/waktu";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!canAccessKeuangan(session.user.role!))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userLogin = await db.user.findUnique({ nip: session.user.nip! });
  if (!userLogin)
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 401 });

  const { id } = await params;

  let isRapelan = false;
  // cepat: dikirim oleh Konfirmasi cepat (beberapa SK sekaligus, semuanya tidak rapelan).
  let cepat = false;
  try {
    const body: unknown = await req.json();
    const isi = body && typeof body === "object" ? (body as { isRapelan?: unknown; cepat?: unknown }) : null;
    isRapelan = isi?.isRapelan === true;
    cepat = isi?.cepat === true;
  } catch {
    // body kosong → tidak rapelan
  }

  const kgb = await db.riwayatKGB.findUnique({ id });
  if (!kgb)
    return NextResponse.json({ error: "KGB tidak ditemukan" }, { status: 404 });

  if (kgb.status !== "menunggu_keuangan")
    return NextResponse.json({ error: "KGB ini tidak sedang menunggu konfirmasi keuangan." }, { status: 409 });

  // Konfirmasi cepat hanya untuk SK yang tidak berpotensi rapelan dan TMT-nya (tanggal WITA) masih
  // sesudah hari ini. SK lain harus ditinjau satu per satu agar keputusan rapelan tidak terlewat.
  if (cepat) {
    const tmt = tanggalKalender(kgb.tmtKgbBaru);
    if (!tmt || tmt.getTime() <= hariIniWita().getTime())
      return NextResponse.json({ error: "TMT sudah lewat, tinjau satu per satu" }, { status: 409 });
    if (kgb.flagRapelan || isRapelan)
      return NextResponse.json({ error: "SK berpotensi rapelan, tinjau satu per satu" }, { status: 409 });
  }

  const [pegawai, suratSelesai] = await Promise.all([
    db.pegawai.findUnique({ id: kgb.pegawaiId }),
    db.suratKGB.findUnique({ kgbId: kgb.id }) as Promise<SuratKgbTersimpan | null>,
  ]);
  if (!pegawai)
    return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });

  // TMT berikutnya memakai yang paling akhir antara record KGB dan data pegawai, agar penundaan hukdis
  // yang dicatat selama KGB berjalan tidak hilang. SK dasar siklus berikutnya adalah surat KGB ini,
  // jadi penetapnya = penandatangan surat ini.
  let rencana: RencanaSetelahKgbSelesai;
  try {
    rencana = rencanaSetelahKgbSelesai({
      kgb,
      tmtKgbBerikutnyaPegawai: pegawai.tmtKgbBerikutnya,
      penetapSkDasar: penetapDariSurat(suratSelesai),
    });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "Jadwal KGB berikutnya tidak dapat dihitung";
    return NextResponse.json({ error: `${pesan}. Hubungi Tim SDM untuk memeriksa data KGB ini.` }, { status: 422 });
  }

  // Status Selesai ditulis paling akhir. Bila salah satu langkah gagal, KGB tetap Menunggu Keuangan
  // dan konfirmasi dapat diulang: data pegawai dihitung dari record KGB yang tidak berubah, dan
  // placeholder yang setengah jadi diganti.
  await db.pegawai.update({ id: pegawai.id }, rencana.pegawai);
  await db.riwayatKGB.deleteMany({ pegawaiId: pegawai.id, status: "belum_diproses" });
  await db.riwayatKGB.create(
    makeRiwayatKGB({ ...rencana.placeholder, pegawaiId: pegawai.id, createdBy: userLogin.id }),
  );

  // Dua konfirmasi yang berjalan bersamaan bisa sama-sama membuat placeholder; sisakan satu.
  const placeholderList = await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id, status: "belum_diproses" } });
  for (const idBerlebih of placeholderBerlebih(placeholderList)) {
    await db.riwayatKGB.delete({ id: idBerlebih });
  }

  await db.riwayatKGB.update(
    { id },
    {
      status: "selesai",
      konfirmasiKeuanganAt: new Date(),
      konfirmasiKeuanganBy: userLogin.id,
      rapelanDitetapkan: isRapelan,
    },
  );

  logAudit({
    userId: userLogin.id,
    aksi: "konfirmasi_keuangan",
    detail: `Konfirmasi KGB ${pegawai.nama} (${pegawai.nip}), Gol. ${kgb.golonganBaru}, Gaji Rp ${kgb.gajiPokokBaru.toLocaleString("id-ID")}, Rapelan: ${isRapelan ? "Ya" : "Tidak"}${cepat ? ", melalui Konfirmasi cepat" : ""}`,
    targetNama: pegawai.nama,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
