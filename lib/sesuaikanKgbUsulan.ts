// Penyesuaian KGB yang sedang berjalan ketika usulan data UPT disetujui (ADR-011).
//
// Usulan dapat tiba setelah Tim SDM melakukan Input KGB. Tanpa penyesuaian, data pegawai berubah tetapi
// hitungan KGB-nya tetap memakai golongan dan masa kerja lama, dan SK terbit dengan gaji pokok yang salah.
// Aturannya, selama SK bertanda tangan belum diunggah:
//   - KGB yang sedang diproses dihitung ulang dari data baru;
//   - SK yang sudah dibuat dilepas agar dibuat ulang, dan nomor serta tanggalnya dipindah ke draf supaya
//     tidak diketik ulang;
//   - jadwal Belum Diproses diselaraskan.
// Setelah SK diunggah (menunggu keuangan), usulan yang mengubah dasar gaji ditolak: SK-nya sudah
// ditandatangani, jadi KGB harus dibatalkan dulu.

import { db } from "./db";
import { makeRiwayatKGB, type PegawaiRow, type RiwayatKGBRow } from "./sheets/tables";
import { rencanaSiklusBerikutnya } from "./jadwalKgb";
import { kgbBerjalanTerbaru } from "./dataPegawai";
import { jendelaProsesKgb } from "./tabelGaji";
import { formatTanggalId, samaTanggalKalender } from "./waktu";
import type { SuratKgbTersimpan } from "./prosesKgb";

/** Kolom yang menentukan hitungan KGB; perubahan di sini menuntut hitung ulang. */
function dasarGajiBerubah(lama: PegawaiRow, baru: PegawaiRow): boolean {
  return (
    lama.golonganRuang !== baru.golonganRuang ||
    Number(lama.mkgTahun) !== Number(baru.mkgTahun) ||
    Number(lama.mkgBulan) !== Number(baru.mkgBulan) ||
    Number(lama.gajiPokok) !== Number(baru.gajiPokok) ||
    !samaTanggalKalender(lama.tmtKgbTerakhir, baru.tmtKgbTerakhir, { keduanyaKosongSama: true }) ||
    !samaTanggalKalender(lama.tmtKgbBerikutnya, baru.tmtKgbBerikutnya, { keduanyaKosongSama: true })
  );
}

export type RencanaPenyesuaianKgb =
  | { ok: false; pesan: string }
  | { ok: true; terapkan: (userId: string) => Promise<string | null> };

/**
 * Periksa lebih dulu, terapkan belakangan: penolakan harus terjadi sebelum data pegawai ditulis. `terapkan`
 * mengembalikan kalimat untuk peninjau (apa yang disesuaikan), atau null bila tidak ada KGB yang tersentuh.
 */
export async function rencanakanPenyesuaianKgb(
  lama: PegawaiRow,
  baru: PegawaiRow,
  adaPerubahan: boolean,
): Promise<RencanaPenyesuaianKgb> {
  if (!adaPerubahan) return { ok: true, terapkan: async () => null };
  const berubahDasar = dasarGajiBerubah(lama, baru);
  const riwayat = (await db.riwayatKGB.findMany({ where: { pegawaiId: lama.id } })) as RiwayatKGBRow[];
  const berjalan = kgbBerjalanTerbaru(riwayat);

  if (berjalan?.status === "menunggu_keuangan" && berubahDasar)
    return {
      ok: false,
      pesan: `SK KGB ${lama.nama} TMT ${formatTanggalId(berjalan.tmtKgbBaru)} sudah ditandatangani dan diunggah, jadi golongan, masa kerja, dan TMT-nya tidak dapat diubah lagi. Batalkan KGB tersebut lebih dulu, atau kembalikan usulan ini.`,
    };

  return {
    ok: true,
    terapkan: async (userId) => {
      const catatan: string[] = [];

      if (berjalan?.status === "sedang_diproses") {
        if (berubahDasar) {
          const rencana = rencanaSiklusBerikutnya({ ...baru, penetapSkDasar: berjalan.penetapSkDasar });
          // Potensi rapelan dinilai terhadap tanggal Input KGB, bukan tanggal persetujuan usulan.
          const jendela = jendelaProsesKgb(rencana.tmtKgbBaru, berjalan.createdAt ?? new Date());
          await db.riwayatKGB.update(
            { id: berjalan.id },
            {
              golonganLama: rencana.golonganLama,
              gajiPokokLama: rencana.gajiPokokLama,
              mkgTahunLama: rencana.mkgTahunLama,
              mkgBulanLama: rencana.mkgBulanLama,
              golonganBaru: rencana.golonganBaru,
              gajiPokokBaru: rencana.gajiPokokBaru,
              mkgTahunBaru: rencana.mkgTahunBaru,
              mkgBulanBaru: rencana.mkgBulanBaru,
              tmtKgbBaru: rencana.tmtKgbBaru,
              tmtKgbBerikutnya: rencana.tmtKgbBerikutnya,
              flagRapelan: jendela?.flagRapelan ?? berjalan.flagRapelan,
            },
          );
          catatan.push("hitungan KGB yang sedang diproses diperbarui");
        }
        // Nama, NIP, jabatan, dan angka gaji tercetak di SK, jadi SK yang sudah dibuat harus dibuat ulang.
        const surat = (await db.suratKGB.findUnique({ kgbId: berjalan.id })) as SuratKgbTersimpan | null;
        if (surat && !surat.pathFile) {
          await db.riwayatKGB.update(
            { id: berjalan.id },
            { drafNomorSurat: surat.nomorSurat || null, drafTanggalSurat: surat.tanggalSurat ?? null },
          );
          await db.suratKGB.delete({ kgbId: berjalan.id });
          catatan.push(`SK ${surat.nomorSurat} perlu dibuat ulang; nomornya disimpan sebagai draf`);
        }
      }

      if (berubahDasar) {
        const placeholder = riwayat
          .filter((k) => k.status === "belum_diproses")
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0];
        if (placeholder && berjalan?.status !== "sedang_diproses") {
          const rencana = rencanaSiklusBerikutnya({ ...baru, penetapSkDasar: placeholder.penetapSkDasar });
          await db.riwayatKGB.deleteMany({ pegawaiId: lama.id, status: "belum_diproses" });
          await db.riwayatKGB.create(makeRiwayatKGB({ pegawaiId: lama.id, createdBy: userId, ...rencana }));
          catatan.push("jadwal KGB Belum Diproses diselaraskan");
        }
      }

      return catatan.length > 0 ? catatan.join("; ") : null;
    },
  };
}
