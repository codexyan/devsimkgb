import "dotenv/config";
import { kalkulasiKGB } from "../lib/tabelGaji";
import { prisma } from "../lib/prisma";

async function main() {
  const userLogin = await prisma.user.findFirst();
  if (!userLogin) {
    console.error("Tidak ada user ditemukan di database.");
    process.exit(1);
  }

  const pegawaiTanpaKGB = await prisma.pegawai.findMany({
    where: { aktif: true, riwayatKGB: { none: {} } },
  });

  console.log(`Ditemukan ${pegawaiTanpaKGB.length} pegawai tanpa riwayat KGB.`);

  let berhasil = 0;
  let gagal = 0;
  const today = new Date();

  for (const pegawai of pegawaiTanpaKGB) {
    try {
      const hasil = kalkulasiKGB(pegawai);
      const deadlineSDM = new Date(hasil.tmtKgbBaru.getFullYear(), hasil.tmtKgbBaru.getMonth() - 1, 0);
      const flagRapelan = today > deadlineSDM;

      await prisma.riwayatKGB.create({
        data: {
          pegawaiId: pegawai.id,
          nomorSK: "",
          tanggalSK: new Date(hasil.tmtKgbBaru),
          tmtSK: new Date(hasil.tmtKgbBaru),
          golonganLama: pegawai.golonganRuang,
          gajiPokokLama: pegawai.gajiPokok,
          mkgTahunLama: pegawai.mkgTahun,
          mkgBulanLama: pegawai.mkgBulan,
          golonganBaru: pegawai.golonganRuang,
          gajiPokokBaru: hasil.gajiPokokBaru,
          mkgTahunBaru: hasil.mkgTahunBaru,
          mkgBulanBaru: hasil.mkgBulanBaru,
          tmtKgbBaru: hasil.tmtKgbBaru,
          tmtKgbBerikutnya: hasil.tmtKgbBerikutnya,
          status: "belum_diproses",
          flagRapelan,
          createdBy: userLogin.id,
        },
      });
      berhasil++;
      console.log(`  OK ${pegawai.nama} (${pegawai.nip})`);
    } catch (e) {
      gagal++;
      console.error(`  GAGAL ${pegawai.nama} (${pegawai.nip}):`, e);
    }
  }

  console.log(`\nSelesai: ${berhasil} berhasil, ${gagal} gagal.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
