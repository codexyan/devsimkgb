// Penyelesaian satu KGB oleh keuangan: pemeriksaan ulang keadaan pegawai, pembaruan gaji pokok dan masa
// kerjanya, pembuatan jadwal siklus berikutnya, lalu status Selesai.
//
// Dipisahkan dari rutenya karena dijalankan dua pihak (ADR-009): keuangan Kanwil untuk pegawai Kanwil
// (POST /api/kgb/[id]/konfirmasi-keuangan), dan keuangan UPT lewat akun Admin UPT untuk pegawai satkernya
// (POST /api/upt/gaji-web). Keduanya harus menghasilkan data yang persis sama; yang berbeda hanya siapa
// yang menjalankan dan apakah rekam Gaji Web-nya ikut dicatat.

import { db } from "./db";
import { makeRiwayatKGB, type PegawaiRow, type RiwayatKGBRow } from "./sheets/tables";
import { penetapDariSurat } from "./penetapSk";
import { rencanaSetelahKgbSelesai, type RencanaSetelahKgbSelesai } from "./jadwalKgb";
import { placeholderBerlebih, type SuratKgbTersimpan } from "./prosesKgb";
import { hariIniWita, type NilaiTanggal } from "./waktu";
import { periksaUlangKgb } from "./pemeriksaanUlangKgb";

export type HasilSelesaikanKgb =
  | { ok: true; pegawai: PegawaiRow }
  | { ok: false; status: number; pesan: string };

export async function selesaikanKgb(input: {
  kgb: RiwayatKGBRow;
  /** Id pengguna yang menyelesaikan; dicatat di konfirmasiKeuanganBy dan createdBy jadwal berikutnya. */
  userId: string;
  isRapelan: boolean;
  /** Diisi bila penyelesaiannya sekaligus rekam Gaji Web oleh UPT. */
  gajiWeb?: { at: Date; oleh: string };
}): Promise<HasilSelesaikanKgb> {
  const { kgb, userId, isRapelan, gajiWeb } = input;
  if (kgb.status !== "menunggu_keuangan")
    return { ok: false, status: 409, pesan: "KGB ini tidak sedang menunggu konfirmasi keuangan." };

  const [pegawai, suratSelesai] = await Promise.all([
    db.pegawai.findUnique({ id: kgb.pegawaiId }),
    db.suratKGB.findUnique({ kgbId: kgb.id }) as Promise<SuratKgbTersimpan | null>,
  ]);
  if (!pegawai) return { ok: false, status: 404, pesan: "Data pegawai tidak ditemukan" };

  // Pintu terakhir sebelum gaji baru masuk Gaji Web: keadaan pegawai diperiksa ulang agar tidak
  // terjadi kelebihan bayar yang harus disetor kembali (masukan tim keuangan).
  const hukdisRows = await db.riwayatHukdis.findMany({ where: { pegawaiId: pegawai.id } });
  const periksa = periksaUlangKgb({
    tahap: "konfirmasi_keuangan",
    pegawai,
    riwayatHukdis: hukdisRows.map((h) => ({
      berdampakKGB: h.berdampakKGB === true,
      tmtBerakhir: h.tmtBerakhir as NilaiTanggal,
      tmtMulai: h.tmtMulai as NilaiTanggal,
    })),
    tmtKgb: kgb.tmtKgbBaru,
    hariIni: hariIniWita(),
  });
  if (periksa.tolak) return { ok: false, status: 409, pesan: periksa.tolak };

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
    return { ok: false, status: 422, pesan: `${pesan}. Hubungi Tim SDM Kanwil untuk memeriksa data KGB ini.` };
  }

  // Status Selesai ditulis paling akhir. Bila salah satu langkah gagal, KGB tetap Menunggu Keuangan
  // dan penyelesaian dapat diulang: data pegawai dihitung dari record KGB yang tidak berubah, dan
  // placeholder yang setengah jadi diganti.
  await db.pegawai.update({ id: pegawai.id }, rencana.pegawai);
  await db.riwayatKGB.deleteMany({ pegawaiId: pegawai.id, status: "belum_diproses" });
  await db.riwayatKGB.create(makeRiwayatKGB({ ...rencana.placeholder, pegawaiId: pegawai.id, createdBy: userId }));

  // Dua penyelesaian yang berjalan bersamaan bisa sama-sama membuat placeholder; sisakan satu.
  const placeholderList = await db.riwayatKGB.findMany({ where: { pegawaiId: pegawai.id, status: "belum_diproses" } });
  for (const idBerlebih of placeholderBerlebih(placeholderList)) {
    await db.riwayatKGB.delete({ id: idBerlebih });
  }

  const sekarang = new Date();
  await db.riwayatKGB.update(
    { id: kgb.id },
    {
      status: "selesai",
      konfirmasiKeuanganAt: sekarang,
      konfirmasiKeuanganBy: userId,
      rapelanDitetapkan: isRapelan,
      ...(gajiWeb ? { inputGajiWebAt: gajiWeb.at, inputGajiWebBy: gajiWeb.oleh } : {}),
    },
  );

  return { ok: true, pegawai };
}
