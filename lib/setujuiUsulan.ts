// Penerapan satu usulan yang disetujui ke data induk.
//
// Dipisahkan dari rutenya karena dipakai dua tempat: tinjauan satu per satu, dan persetujuan sekaligus
// untuk seluruh usulan pada satu surat. Sejak UPT dapat mengunggah daftar pegawai sekaligus, satu surat
// dapat memuat ratusan nama, dan menyetujuinya satu per satu bukan pekerjaan yang masuk akal.
//
// Keduanya harus menerapkan dengan cara yang persis sama, sebab yang berbeda hanyalah berapa banyak
// yang ditinjau sekali jalan, bukan apa yang terjadi pada tiap usulan.

import { db } from "./db";
import { newId } from "./sheets/id";
import { TIPE_NOTIFIKASI } from "./generateNotifikasi";
import { bandingkanUsulan, perubahanPegawai, ringkasHukdisUsulan } from "./usulanPegawai";
import { getGajiPokok, getPangkat } from "./tabelGaji";
import { SATKER } from "./satker";
import type { PegawaiRow, UsulanPegawaiRow } from "./sheets/tables";
import { rencanakanPenyesuaianKgb } from "./sesuaikanKgbUsulan";

export interface HasilSetujui {
  ok: true;
  pegawaiId: string | null;
  jumlahPerubahan: number;
  perluCatatHukdis: boolean;
  /** Kalimat perubahan untuk jejak audit. */
  ringkasPerubahan: string;
  hukdis: string | null;
  /** Penyesuaian KGB berjalan akibat usulan ini (lib/sesuaikanKgbUsulan.ts); null bila tidak ada. */
  penyesuaianKgb: string | null;
}

export interface GagalSetujui {
  ok: false;
  pesan: string;
}

/**
 * Terapkan satu usulan ke data induk dan tandai usulannya disetujui.
 *
 * Usulan pegawai baru membuat barisnya di sini, bukan saat dikirim UPT: sampai Kanwil menyetujuinya,
 * pegawai itu belum ada di data induk. Usulan perubahan menimpa kolom yang diusulkan saja.
 *
 * Persetujuan sekaligus menuliskan konfirmasi UPT untuk siklus berjalan, walau tidak ada satu kolom pun
 * yang berubah: mengusulkan data adalah pernyataan yang lebih kuat daripada sekadar menyatakan data
 * yang ada sudah benar.
 */
export async function setujuiUsulan(
  usulan: UsulanPegawaiRow,
  pegawaiLama: PegawaiRow | null,
  oleh: string,
  sekarang: Date,
  /** Id pengguna peninjau, untuk jadwal KGB yang dibuat ulang; bawaannya nama peninjau. */
  userId: string = oleh,
): Promise<HasilSetujui | GagalSetujui> {
  const nilaiBaru = perubahanPegawai(usulan);
  let terapkanPenyesuaian: ((userId: string) => Promise<string | null>) | null = null;
  let perubahan = pegawaiLama ? bandingkanUsulan(pegawaiLama, usulan) : [];
  let pegawaiIdHasil = usulan.pegawaiId;

  if (usulan.jenis === "baru") {
    // NIP diperiksa ulang karena bisa saja sudah ditambahkan Kanwil sendiri sejak usulan dikirim.
    const nip = usulan.nip ?? "";
    if (!/^\d{18}$/.test(nip)) return { ok: false, pesan: "Usulan pegawai baru tidak memuat NIP yang sah" };
    const bentrok = await db.pegawai.findUnique({ nip });
    if (bentrok)
      return {
        ok: false,
        pesan: `NIP ${nip} sudah tercatat atas nama ${bentrok.nama}. Kembalikan usulan ini dan minta UPT mengirim usulan perbaikan data.`,
      };

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
      konfirmasiUptTmt: (nilaiBaru.tmtKgbBerikutnya as Date | null) ?? null,
      konfirmasiUptAt: sekarang,
      konfirmasiUptOleh: usulan.diajukanOleh,
      satkerTugas: null,
      berhentiTmt: null,
      berhentiAlasan: null,
      // SK yang diketik UPT pada usulan (SK CPNS, atau SK KGB terakhir di luar SIM-KGB) menjadi SK dasar
      // Input KGB pertama, jadi Tim SDM tidak mengetiknya ulang (ADR-010).
      nomorSkDasar: usulan.nomorSkTerakhir?.trim() || null,
      tanggalSkDasar: usulan.tanggalSkTerakhir ?? null,
      penetapSkDasar: null,
    };
    await db.pegawai.create(pegawaiBaru);
    pegawaiIdHasil = pegawaiBaru.id;
    perubahan = [];
  } else if (pegawaiLama) {
    // Pembetulan NIP diperiksa ulang: NIP itu bisa saja sudah dipakai sejak usulan dikirim.
    if (nilaiBaru.nip && nilaiBaru.nip !== pegawaiLama.nip) {
      const bentrok = await db.pegawai.findUnique({ nip: nilaiBaru.nip });
      if (bentrok && bentrok.id !== pegawaiLama.id)
        return {
          ok: false,
          pesan: `NIP ${nilaiBaru.nip} sudah tercatat atas nama ${bentrok.nama}. Kembalikan usulan ini agar UPT memeriksa NIP-nya.`,
        };
    }
    // KGB yang sedang berjalan disesuaikan selama SK-nya belum diunggah; sesudahnya perubahan dasar gaji
    // ditolak. Penolakan diperiksa sebelum apa pun ditulis (ADR-011).
    const penyesuaian = await rencanakanPenyesuaianKgb(
      pegawaiLama,
      { ...pegawaiLama, ...(nilaiBaru as Partial<PegawaiRow>) },
      perubahan.length > 0,
    );
    if (!penyesuaian.ok) return { ok: false, pesan: penyesuaian.pesan };
    terapkanPenyesuaian = penyesuaian.terapkan;

    const tmtSiklus = (nilaiBaru.tmtKgbBerikutnya as Date | null) ?? pegawaiLama.tmtKgbBerikutnya ?? null;
    await db.pegawai.update(
      { id: pegawaiLama.id },
      {
        ...nilaiBaru,
        // SK dasar ikut diperbarui hanya bila UPT mengisinya pada usulan ini (ADR-010).
        ...(usulan.nomorSkTerakhir?.trim() ? { nomorSkDasar: usulan.nomorSkTerakhir.trim() } : {}),
        ...(usulan.tanggalSkTerakhir ? { tanggalSkDasar: usulan.tanggalSkTerakhir } : {}),
        konfirmasiUptTmt: tmtSiklus,
        konfirmasiUptAt: sekarang,
        konfirmasiUptOleh: usulan.diajukanOleh,
        updatedAt: sekarang,
      },
    );
  }

  const penyesuaianKgb = terapkanPenyesuaian ? await terapkanPenyesuaian(userId) : null;

  await db.usulanPegawai.update(
    { id: usulan.id },
    { status: "disetujui", ditinjauOleh: oleh, ditinjauAt: sekarang, pegawaiId: pegawaiIdHasil },
  );
  // Usulan yang sudah ditinjau tidak perlu lagi menagih tinjauan; loncengnya ditutup seperti pada
  // pembatalan oleh UPT, supaya daftar notifikasi Kanwil hanya berisi yang benar-benar tersisa.
  await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.USULAN_UPT, referenceId: usulan.id });

  return {
    ok: true,
    pegawaiId: pegawaiIdHasil,
    jumlahPerubahan: perubahan.length,
    perluCatatHukdis: !!usulan.hukdisAda,
    hukdis: ringkasHukdisUsulan(usulan),
    penyesuaianKgb,
    ringkasPerubahan:
      usulan.jenis === "baru"
        ? "pegawai baru ditambahkan ke data induk"
        : perubahan.length > 0
          ? perubahan.map((p) => `${p.label} ${p.sekarang} → ${p.diusulkan}`).join("; ")
          : "tanpa perubahan kolom",
  };
}
