// Pencatatan satu hukuman disiplin: baris riwayat hukdis, penanda hukdis pada pegawai, dan penggeseran
// jadwal KGB bila hukumannya menunda KGB. Dipakai dua pintu yang harus berperilaku sama persis: input
// hukdis oleh SDM Hukdis (POST /api/pegawai/[id]/hukdis) dan penerimaan laporan hukdis dari UPT
// (PATCH /api/hukdis/laporan/[id], ADR-016).

import { db } from "./db";
import { makeRiwayatKGB, type PegawaiRow } from "./sheets/tables";
import { newId } from "./sheets/id";
import { logAudit } from "./auditLog";
import { bacaTanggal, kgbBerjalanTerbaru, teksAtauNull, teksIsian } from "./dataPegawai";
import { hukdisMasihBerlaku, ringkasanHukdisPegawai, type RiwayatHukdisRow } from "./hukdisKedaluwarsa";
import {
  rencanaPenundaanHukdis,
  rencanaSiklusBerikutnya,
  type RencanaPenundaanHukdis,
  type RencanaSiklusKgb,
} from "./jadwalKgb";
import { formatTanggalId, hariIniWita } from "./waktu";

type HukdisJenisRow = {
  kode: string;
  label: string | null;
  berdampakKGB: boolean | null;
  durasiTunda: number | null;
  dasarHukum: string | null;
};

export type HasilCatatHukdis =
  | {
      ok: true;
      hukdis: RiwayatHukdisRow;
      aktif: boolean;
      /** TMT KGB berikutnya sesudah digeser; null bila hukumannya tidak menunda KGB. */
      tmtKgbBerikutnya: Date | null;
      pegawai: PegawaiRow;
      labelJenis: string;
    }
  | { ok: false; status: number; error: string };

/**
 * Catat satu hukuman disiplin dari isian formulir (bentuk JSON yang sama dengan input hukdis). Semua
 * pemeriksaan dilakukan sebelum menulis apa pun; bila langkah sesudah hukdis tersimpan gagal, perubahan
 * dibatalkan sebisa mungkin. `asal` ditambahkan ke catatan audit, mis. ", dari laporan Rutan Rantau".
 */
export async function catatHukdis(
  pegawaiId: string,
  body: Record<string, unknown>,
  userId: string,
  asal = "",
): Promise<HasilCatatHukdis> {
  const jenisHukdis = teksIsian(body.jenisHukdis);
  if (!jenisHukdis) return { ok: false, status: 400, error: "Jenis hukuman disiplin wajib dipilih." };
  const tanggalSK = bacaTanggal(body.tanggalSK);
  const tmtMulai = bacaTanggal(body.tmtMulai);
  const tmtBerakhir = bacaTanggal(body.tmtBerakhir);
  if (tanggalSK.status !== "valid" || tmtMulai.status !== "valid" || tmtBerakhir.status !== "valid")
    return { ok: false, status: 400, error: "Tanggal SK, TMT mulai, dan TMT berakhir wajib diisi dengan tanggal yang valid." };
  if (tmtBerakhir.tanggal < tmtMulai.tanggal)
    return { ok: false, status: 400, error: "TMT berakhir tidak boleh sebelum TMT mulai." };

  const pegawai = await db.pegawai.findUnique({ id: pegawaiId });
  if (!pegawai) return { ok: false, status: 404, error: "Pegawai tidak ditemukan" };

  const jenisConfig = (await db.hukdisJenis.findUnique({ kode: jenisHukdis })) as unknown as HukdisJenisRow | null;

  const berdampakKGB: boolean =
    typeof body.berdampakKGB === "boolean"
      ? body.berdampakKGB
      : (jenisConfig?.berdampakKGB ?? jenisHukdis === "penundaan_kgb");

  const durasiTundaInput = Number(body.durasiTunda);
  const durasiTunda: number | null = berdampakKGB
    ? (Number.isFinite(durasiTundaInput) && durasiTundaInput > 0
        ? Math.round(durasiTundaInput)
        : (jenisConfig?.durasiTunda ?? 12))
    : null;
  if (durasiTunda !== null && !(Number.isInteger(durasiTunda) && durasiTunda >= 1 && durasiTunda <= 60))
    return { ok: false, status: 400, error: "Lama penundaan KGB harus 1 sampai 60 bulan." };

  const dasarHukum = teksAtauNull(body.dasarHukum) ?? jenisConfig?.dasarHukum ?? null;
  const hariIni = hariIniWita();

  // Rencana jadwal dihitung sebelum menulis apa pun, agar penolakan tidak meninggalkan data setengah jadi.
  const riwayatKgb = await db.riwayatKGB.findMany({ where: { pegawaiId } });
  const kgbAktif = kgbBerjalanTerbaru(riwayatKgb);
  let penundaan: Extract<RencanaPenundaanHukdis, { aksi: "geser" }> | null = null;
  let placeholderBaru: RencanaSiklusKgb | null = null;
  if (berdampakKGB) {
    const rencana = rencanaPenundaanHukdis({
      pegawai,
      kgbAktif,
      tmtMulaiHukdis: tmtMulai.tanggal,
      durasiTunda: durasiTunda ?? 0,
      hariIni,
    });
    if (rencana.aksi === "tolak") return { ok: false, status: kgbAktif ? 409 : 422, error: rencana.alasan };
    penundaan = rencana;

    if (rencana.buatPlaceholder) {
      const placeholderLama = riwayatKgb
        .filter((k) => k.status === "belum_diproses")
        .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
      try {
        placeholderBaru = rencanaSiklusBerikutnya({
          ...pegawai,
          tmtKgbBerikutnya: rencana.tmtKgbBerikutnya,
          tmtKgbTerakhir: rencana.tmtKgbTerakhir,
          penetapSkDasar: placeholderLama?.penetapSkDasar ?? null,
          hariIni,
        });
      } catch (e) {
        const pesan = e instanceof Error ? e.message : "Jadwal KGB tidak dapat dihitung";
        return { ok: false, status: 422, error: `${pesan}. Periksa data pegawai terlebih dahulu.` };
      }
    }
  }

  const hukdis: RiwayatHukdisRow = {
    id: newId(),
    pegawaiId,
    jenisHukdis,
    nomorSK: teksIsian(body.nomorSK),
    tanggalSK: tanggalSK.tanggal,
    tmtMulai: tmtMulai.tanggal,
    tmtBerakhir: tmtBerakhir.tanggal,
    berdampakKGB,
    durasiTunda,
    dasarHukum,
    keterangan: teksAtauNull(body.keterangan),
    createdAt: new Date(),
    createdBy: userId,
    // TMT hasil penundaan, acuan pemulihan saat hukdis dihapus. Tersimpan setelah kolomnya
    // ditambahkan ke tabel RiwayatHukdis; sebelum itu nilai ini diabaikan lapisan data.
    tmtSetelahTunda: penundaan?.tmtKgbBerikutnya ?? null,
  };

  // Penanda hukdis pegawai diambil dari seluruh hukdis yang masih berlaku, termasuk yang baru ini.
  const riwayatHukdis = (await db.riwayatHukdis.findMany({
    where: { pegawaiId },
    orderBy: { field: "createdAt", dir: "asc" },
  })) as unknown as RiwayatHukdisRow[];
  const penanda = ringkasanHukdisPegawai([...riwayatHukdis, hukdis], hariIni);

  await db.riwayatHukdis.create(hukdis);

  // Sheets tidak punya transaksi. Bila langkah sesudah hukdis tersimpan gagal, perubahan dibatalkan sebisa
  // mungkin: hukdis yang tertinggal tanpa TMT yang digeser akan memulihkan TMT ke tanggal yang terlalu awal
  // saat hukdis itu dihapus.
  let pegawaiDiubah = false;
  let kgbAktifDiubah = false;
  let placeholderDihapus = false;
  try {
    await db.pegawai.update(
      { id: pegawaiId },
      {
        ...penanda,
        ...(penundaan
          ? { tmtKgbBerikutnya: penundaan.tmtKgbBerikutnya, tmtKgbTerakhir: penundaan.tmtKgbTerakhir, updatedAt: new Date() }
          : {}),
      },
    );
    pegawaiDiubah = true;

    // Dengan KGB berjalan, siklus sesudah KGB itu yang digeser; konfirmasi keuangan membuat placeholder berikutnya.
    if (penundaan?.geserKgbAktif && kgbAktif) {
      await db.riwayatKGB.update({ id: kgbAktif.id }, { tmtKgbBerikutnya: penundaan.tmtKgbBerikutnya });
      kgbAktifDiubah = true;
    }
    if (placeholderBaru) {
      await db.riwayatKGB.deleteMany({ pegawaiId, status: "belum_diproses" });
      placeholderDihapus = true;
      await db.riwayatKGB.create(makeRiwayatKGB({ pegawaiId, createdBy: userId, ...placeholderBaru }));
    }
  } catch (err) {
    console.error("[hukdis] pencatatan hukdis gagal di tengah jalan, perubahan dibatalkan:", err);
    const gagalDibatalkan: string[] = [];
    const batalkan = async (bagian: string, langkah: () => Promise<unknown>) => {
      try {
        await langkah();
      } catch (e) {
        console.error(`[hukdis] pembatalan ${bagian} gagal:`, e);
        gagalDibatalkan.push(bagian);
      }
    };

    await batalkan("catatan hukdis", () => db.riwayatHukdis.delete({ id: hukdis.id }));
    if (pegawaiDiubah) {
      await batalkan("data pegawai", () =>
        db.pegawai.update(
          { id: pegawaiId },
          {
            statusHukdis: pegawai.statusHukdis,
            tanggalHukdisBerakhir: pegawai.tanggalHukdisBerakhir,
            jenisHukdis: pegawai.jenisHukdis,
            keteranganHukdis: pegawai.keteranganHukdis,
            tmtKgbBerikutnya: pegawai.tmtKgbBerikutnya,
            tmtKgbTerakhir: pegawai.tmtKgbTerakhir,
          },
        ),
      );
    }
    if (kgbAktifDiubah && kgbAktif) {
      await batalkan("KGB yang sedang berjalan", () =>
        db.riwayatKGB.update({ id: kgbAktif.id }, { tmtKgbBerikutnya: kgbAktif.tmtKgbBerikutnya }),
      );
    }
    if (placeholderDihapus) {
      await batalkan("jadwal KGB Belum Diproses", async () => {
        await db.riwayatKGB.deleteMany({ pegawaiId, status: "belum_diproses" });
        for (const lama of riwayatKgb.filter((k) => k.status === "belum_diproses")) await db.riwayatKGB.create(lama);
      });
    }

    const error =
      gagalDibatalkan.length === 0
        ? "Hukuman disiplin gagal dicatat dan tidak ada perubahan yang tersimpan. Coba lagi beberapa saat lagi."
        : `Hukuman disiplin gagal dicatat dan sebagian perubahan tidak dapat dibatalkan (${gagalDibatalkan.join(", ")}). ` +
          `Sebelum mencoba lagi, periksa catatan hukdis dan data KGB ${pegawai.nama}: TMT KGB berikutnya sebelum ` +
          `pencatatan adalah ${formatTanggalId(pegawai.tmtKgbBerikutnya)}.`;
    return { ok: false, status: 500, error };
  }

  const labelJenis = jenisConfig?.label ?? jenisHukdis;
  const keteranganJadwal = penundaan
    ? `, TMT KGB digeser ${durasiTunda} bulan dari ${formatTanggalId(penundaan.tmtSebelumTunda)} ke ${formatTanggalId(penundaan.tmtKgbBerikutnya)}`
    : "";
  logAudit({
    userId,
    aksi: "input_hukdis",
    detail: `Hukdis ${labelJenis} untuk ${pegawai.nama} (${pegawai.nip})${keteranganJadwal}${asal}`,
    targetNama: pegawai.nama,
  });

  return {
    ok: true,
    hukdis,
    aktif: hukdisMasihBerlaku(hukdis.tmtBerakhir, hariIni),
    tmtKgbBerikutnya: penundaan?.tmtKgbBerikutnya ?? null,
    pegawai,
    labelJenis,
  };
}
