import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { canProcessKGB } from "@/lib/auth";
import { PESAN_SESI_BERAKHIR, penggunaLogin } from "@/lib/auth/penggunaLogin";
import { logAudit } from "@/lib/auditLog";
import { bandingkanUsulan, perubahanPegawai, ringkasHukdisUsulan } from "@/lib/usulanPegawai";
import { TIPE_NOTIFIKASI, notifikasiUsulanRevisi } from "@/lib/generateNotifikasi";
import { newId } from "@/lib/sheets/id";
import { getGajiPokok, getPangkat } from "@/lib/tabelGaji";
import { SATKER } from "@/lib/satker";
import type { PegawaiRow } from "@/lib/sheets/tables";
import { muatBatasInputSdm } from "@/lib/muatBatasInputSdm";
import type { UsulanPegawaiRow } from "@/lib/sheets/tables";

export const runtime = "nodejs";

/**
 * Tinjauan satu usulan data pegawai: setujui, atau kembalikan ke UPT untuk diperbaiki.
 *
 * Menyetujui menyalin kolom yang diusulkan ke data pegawai. Laporan hukuman disiplin tidak ikut
 * membuat catatan hukdis secara otomatis: penetapannya ada pada SDM Hukdis lewat modul Hukuman
 * Disiplin, karena butuh nomor SK dan penilaian dampaknya pada KGB. Usulan yang disetujui tetap
 * menyimpan laporan itu sebagai rujukan.
 *
 * Mengembalikan tidak menghapus apa pun: isian dan berkasnya tetap, statusnya menjadi "revisi", dan
 * usulan itu berpindah kembali ke daftar kerja UPT beserta catatan peninjau. Penolakan yang dulu ada
 * di sini dihapus karena selalu berujung sama: UPT mengetik ulang seluruh usulan dari nol. Usulan yang
 * memang tidak boleh lanjut pun dikembalikan, dengan catatan agar UPT menghapusnya.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await muatBatasInputSdm();
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canProcessKGB(session.user.role ?? ""))
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

  const peninjau = await penggunaLogin(session);
  if (!peninjau) return NextResponse.json({ error: PESAN_SESI_BERAKHIR }, { status: 401 });

  const { id } = await params;
  const usulan = (await db.usulanPegawai.findUnique({ id })) as UsulanPegawaiRow | null;
  if (!usulan) return NextResponse.json({ error: "Usulan tidak ditemukan" }, { status: 404 });
  if (usulan.status !== "menunggu")
    return NextResponse.json({ error: "Usulan ini sudah ditinjau" }, { status: 409 });

  let aksi = "";
  let catatan = "";
  try {
    const body = (await req.json()) as { aksi?: unknown; catatan?: unknown };
    if (typeof body.aksi === "string") aksi = body.aksi;
    if (typeof body.catatan === "string") catatan = body.catatan.trim();
  } catch {
    // body tidak valid diperlakukan sebagai aksi kosong
  }
  if (aksi !== "setujui" && aksi !== "kembalikan")
    return NextResponse.json({ error: "Aksi harus setujui atau kembalikan" }, { status: 400 });

  const pegawaiLama = usulan.pegawaiId ? await db.pegawai.findUnique({ id: usulan.pegawaiId }) : null;
  if (usulan.jenis !== "baru" && !pegawaiLama)
    return NextResponse.json({ error: "Data pegawai tidak ditemukan" }, { status: 404 });
  const namaUsulan = pegawaiLama?.nama ?? usulan.nama ?? "-";
  const nipUsulan = pegawaiLama?.nip ?? usulan.nip ?? "-";

  const oleh = `${peninjau.nama} (${peninjau.nip})`;
  const sekarang = new Date();

  if (aksi === "kembalikan") {
    if (!catatan)
      return NextResponse.json({ error: "Catatan perbaikan wajib diisi" }, { status: 400 });
    // Catatan peninjau menumpang kolom alasanTolak: isinya memang sama, yaitu sebab usulan tidak
    // diterima apa adanya, dan UPT membacanya di tempat yang sama pula.
    await db.usulanPegawai.update(
      { id },
      { status: "revisi", ditinjauOleh: oleh, ditinjauAt: sekarang, alasanTolak: catatan },
    );
    // Usulan ini tidak lagi menunggu Kanwil, jadi loncengnya ditutup di sini dan diganti lonceng UPT.
    await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.USULAN_UPT, referenceId: id });
    try {
      await db.notifikasi.create({
        ...notifikasiUsulanRevisi({ id, satker: usulan.satker, nomorSurat: usulan.nomorSurat }, { nama: namaUsulan, nip: nipUsulan }, catatan),
        id: newId(),
        dibaca: false,
        createdAt: sekarang,
      });
    } catch {
      // Usulannya sudah kembali ke UPT dan tampak pada dasbornya; loncengnya saja yang tidak jadi.
    }
    logAudit({
      userId: peninjau.id,
      aksi: "kembalikan_usulan_pegawai",
      detail: `Kembalikan usulan ${usulan.jenis === "baru" ? "pegawai baru" : "data"} ${namaUsulan} (${nipUsulan}) ke ${usulan.satker} untuk diperbaiki, surat ${usulan.nomorSurat ?? "-"}: ${catatan}`,
      targetNama: namaUsulan,
    });
    return NextResponse.json({ ok: true, status: "revisi" });
  }

  const nilaiBaru = perubahanPegawai(usulan);
  let perubahan = pegawaiLama ? bandingkanUsulan(pegawaiLama, usulan) : [];
  let pegawaiIdHasil = usulan.pegawaiId;

  if (usulan.jenis === "baru") {
    // Pegawai yang diusulkan UPT baru dibuat di sini, setelah Kanwil menyetujuinya. NIP diperiksa
    // ulang karena bisa saja sudah ditambahkan Kanwil sendiri sejak usulan dikirim.
    const nip = usulan.nip ?? "";
    if (!/^\d{18}$/.test(nip))
      return NextResponse.json({ error: "Usulan pegawai baru tidak memuat NIP yang sah" }, { status: 409 });
    const bentrok = await db.pegawai.findUnique({ nip });
    if (bentrok)
      return NextResponse.json(
        { error: `NIP ${nip} sudah tercatat atas nama ${bentrok.nama}. Tolak usulan ini dan minta UPT mengirim usulan perbaikan data.` },
        { status: 409 },
      );
    const golongan = String(nilaiBaru.golonganRuang ?? "");
    const mkgTahun = Number(nilaiBaru.mkgTahun ?? 0);
    const mkgBulan = Number(nilaiBaru.mkgBulan ?? 0);
    const unitKerja = usulan.unitKerja ?? SATKER.find((s) => s.kode === usulan.satker)?.nama ?? "";
    const pegawaiBaru: PegawaiRow = {
      id: newId(),
      nip,
      nama: String(nilaiBaru.nama ?? ""),
      tempatLahir: (nilaiBaru.tempatLahir as string | null) ?? null,
      tanggalLahir: (nilaiBaru.tanggalLahir as Date | null) ?? null,
      jenisKelamin: (nilaiBaru.jenisKelamin as string | null) ?? null,
      pendidikanTerakhir: (nilaiBaru.pendidikanTerakhir as string | null) ?? null,
      jabatan: String(nilaiBaru.jabatan ?? ""),
      // Pangkat mengikuti golongan bila UPT tidak menuliskannya.
      pangkat: String(nilaiBaru.pangkat ?? getPangkat(golongan) ?? ""),
      golonganRuang: golongan,
      unitKerja,
      eselon: (nilaiBaru.eselon as string | null) ?? null,
      jenisJabatan: (nilaiBaru.jenisJabatan as string | null) ?? null,
      tmtGolongan: (nilaiBaru.tmtGolongan as Date | null) ?? null,
      mkgTahun,
      mkgBulan,
      // Gaji pokok dihitung dari tabel PP 5/2024 bila tidak diisi, sama dengan impor CSV.
      gajiPokok: Number(nilaiBaru.gajiPokok ?? 0) || getGajiPokok(golongan, mkgTahun, mkgBulan) || 0,
      tmtKgbTerakhir: (nilaiBaru.tmtKgbTerakhir as Date | null) ?? null,
      tmtKgbBerikutnya: (nilaiBaru.tmtKgbBerikutnya as Date | null) ?? null,
      statusHukdis: false,
      tanggalHukdisBerakhir: null,
      jenisHukdis: null,
      keteranganHukdis: null,
      aktif: true,
      createdAt: sekarang,
      updatedAt: sekarang,
      // Usulan yang disetujui sekaligus menjadi konfirmasi UPT untuk siklus ini: mengusulkan data
      // adalah pernyataan yang lebih kuat daripada sekadar menyatakan data yang ada sudah benar.
      konfirmasiUptTmt: (nilaiBaru.tmtKgbBerikutnya as Date | null) ?? null,
      konfirmasiUptAt: sekarang,
      konfirmasiUptOleh: usulan.diajukanOleh,
      satkerTugas: null,
      berhentiTmt: null,
      berhentiAlasan: null,
    };
    await db.pegawai.create(pegawaiBaru);
    pegawaiIdHasil = pegawaiBaru.id;
    perubahan = [];
  } else if (pegawaiLama) {
    // Konfirmasi ikut ditulis walau tidak ada kolom yang berubah: UPT tetap sudah memeriksa pegawai
    // ini untuk siklus berjalan, dan itulah yang perlu diketahui Kanwil saat memproses KGB.
    const tmtSiklus = (nilaiBaru.tmtKgbBerikutnya as Date | null) ?? pegawaiLama.tmtKgbBerikutnya ?? null;
    await db.pegawai.update(
      { id: pegawaiLama.id },
      {
        ...nilaiBaru,
        konfirmasiUptTmt: tmtSiklus,
        konfirmasiUptAt: sekarang,
        konfirmasiUptOleh: usulan.diajukanOleh,
        updatedAt: sekarang,
      },
    );
  }

  await db.usulanPegawai.update(
    { id },
    { status: "disetujui", ditinjauOleh: oleh, ditinjauAt: sekarang, pegawaiId: pegawaiIdHasil },
  );
  // Usulan yang sudah ditinjau tidak perlu lagi menagih tinjauan; loncengnya ditutup seperti pada
  // pembatalan oleh UPT, supaya daftar notifikasi Kanwil hanya berisi yang benar-benar tersisa.
  await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.USULAN_UPT, referenceId: id });

  const hukdis = ringkasHukdisUsulan(usulan);
  const ringkasPerubahan =
    usulan.jenis === "baru"
      ? "pegawai baru ditambahkan ke data induk"
      : perubahan.length > 0
        ? perubahan.map((p) => `${p.label} ${p.sekarang} → ${p.diusulkan}`).join("; ")
        : "tanpa perubahan kolom";
  logAudit({
    userId: peninjau.id,
    aksi: "setujui_usulan_pegawai",
    detail: `Setujui usulan ${usulan.jenis === "baru" ? "pegawai baru" : "data"} ${namaUsulan} (${nipUsulan}) dari ${usulan.satker}, surat ${usulan.nomorSurat}: ${ringkasPerubahan}${hukdis ? `. Laporan hukuman disiplin: ${hukdis}` : ""}`,
    targetNama: namaUsulan,
  });

  return NextResponse.json({
    ok: true,
    status: "disetujui",
    jumlahPerubahan: perubahan.length,
    // Pengingat untuk peninjau: hukdis tetap dicatat manual di modul Hukuman Disiplin.
    perluCatatHukdis: !!usulan.hukdisAda,
  });
}
