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
import { TIPE_NOTIFIKASI, notifikasiUsulanDisetujui } from "./generateNotifikasi";
import { bandingkanUsulan, perubahanPegawai, ringkasHukdisUsulan } from "./usulanPegawai";
import { getGajiPokok, getPangkat } from "./tabelGaji";
import { SATKER } from "./satker";
import type { PegawaiRow, RiwayatPangkatRow, RiwayatPmkRow, UsulanPegawaiRow } from "./sheets/tables";
import { rencanakanPenyesuaianKgb } from "./sesuaikanKgbUsulan";
import { catatKenaikanPangkat, catatPmk } from "./catatDasarGaji";
import { isJenisKp } from "./kenaikanPangkat";
import { ringkasDasarBaru } from "./dasarBaruUsulan";
// Kolom dasar gaji yang ditentukan SK kenaikan pangkat atau PMK (ADR-030) tidak ditulis dari usulan: nilainya
// berasal dari hitungan SK di lib/catatDasarGaji.ts, sama persis dengan Catat KP/PMK di halaman pegawai.
import {
  KOLOM_DITENTUKAN_SK,
  cariSkTercatat,
  hitungSkPegawaiBaru,
  rencanaSkUsulan,
  teksKoreksiDasar,
  usulanMenurutSk,
  type SkTercatat,
} from "./dasarSkUsulan";
import { kodeSatkerPegawai } from "./rekapSatker";
import { tanggalKalender } from "./waktu";
import { penetapSesudahUsulan } from "./penetapSk";
import { jadikanPerbaikan, kolomJadiPerbaikan, nipBaruTercatat, pesanSatkerLainKanwil } from "./usulanBaruTercatat";


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
  /** Riwayat kenaikan pangkat atau PMK yang terbentuk dari SK pada usulan ini (ADR-030); null bila tidak ada. */
  dasarBaru: string | null;
}

export interface GagalSetujui {
  ok: false;
  pesan: string;
}

/** Riwayat SK pegawai yang mungkin sudah memuat SK pada usulan ini (ADR-079). */
async function muatSkTercatat(pegawaiId: string, usulan: UsulanPegawaiRow): Promise<SkTercatat | null> {
  const jenis = usulan.dasarBaruJenis?.trim();
  if (jenis === "kp")
    return cariSkTercatat(usulan, { pangkat: (await db.riwayatPangkat.findMany({ where: { pegawaiId } })) as RiwayatPangkatRow[] });
  if (jenis === "pmk")
    return cariSkTercatat(usulan, { pmk: (await db.riwayatPmk.findMany({ where: { pegawaiId } })) as RiwayatPmkRow[] });
  return null;
}

const DUA_DETIK = 2000;

/**
 * true bila pegawai ber-NIP sama terbentuk dari usulan pegawai baru ini oleh persetujuan yang terputus di tengah jalan
 * (ADR-079): pegawai satker yang sama, dibuat lewat persetujuan usulan (konfirmasi UPT tercatat pada saat yang sama dengan
 * pembuatannya), dan belum ada usulan disetujui yang menunjuknya. Pegawai yang dicatat Kanwil sendiri tidak memenuhinya.
 */
async function terbentukDariUsulan(pegawai: PegawaiRow, usulan: UsulanPegawaiRow): Promise<boolean> {
  if (kodeSatkerPegawai(pegawai.unitKerja) !== usulan.satker) return false;
  const dibuat = pegawai.createdAt ? new Date(pegawai.createdAt).getTime() : NaN;
  const dikonfirmasi = pegawai.konfirmasiUptAt ? new Date(pegawai.konfirmasiUptAt).getTime() : NaN;
  if (!Number.isFinite(dibuat) || !Number.isFinite(dikonfirmasi) || Math.abs(dibuat - dikonfirmasi) > DUA_DETIK) return false;
  const disetujui = await db.usulanPegawai.findMany({ where: { pegawaiId: pegawai.id, status: "disetujui" } });
  return disetujui.length === 0;
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
  // SK pada usulan yang sudah tercatat oleh percobaan persetujuan sebelumnya yang terputus (ADR-079).
  const tercatat = pegawaiLama ? await muatSkTercatat(pegawaiLama.id, usulan) : null;
  // Dibandingkan menurut hitungan SK-nya: masa kerja yang tertulis pada SK kenaikan pangkat (ADR-078) bukan angka yang
  // ditulis ke data pegawai.
  let perubahan = pegawaiLama
    ? bandingkanUsulan(pegawaiLama, usulanMenurutSk(pegawaiLama, usulan, nilaiBaru as Partial<PegawaiRow>, tercatat))
    : [];
  let dasarBaru: string | null = null;
  let pegawaiIdHasil = usulan.pegawaiId;

  if (usulan.jenis === "baru") {
    // NIP diperiksa ulang karena bisa saja sudah ditambahkan Kanwil sendiri sejak usulan dikirim.
    const nip = usulan.nip ?? "";
    if (!/^\d{18}$/.test(nip)) return { ok: false, pesan: "Usulan pegawai baru tidak memuat NIP yang sah" };
    const bentrok = (await db.pegawai.findUnique({ nip })) as PegawaiRow | null;
    // Pegawai yang sudah terbentuk dari usulan ini oleh persetujuan yang terputus dilanjutkan, bukan ditolak (ADR-079).
    const lanjutan = bentrok && (await terbentukDariUsulan(bentrok, usulan)) ? bentrok : null;
    if (bentrok && !lanjutan) {
      // Pegawai ber-NIP sama di satker yang sama: usulannya diterapkan sebagai perbaikan data pegawai itu (ADR-091).
      // Jenisnya ditulis lebih dulu, supaya usulan yang gagal diterapkan tetap terbaca sebagai perbaikan di kedua papan.
      if (nipBaruTercatat(usulan, bentrok) !== "satker_sama") return { ok: false, pesan: pesanSatkerLainKanwil(nip, bentrok) };
      await db.usulanPegawai.update({ id: usulan.id }, kolomJadiPerbaikan(bentrok));
      const hasil = await setujuiUsulan(jadikanPerbaikan(usulan, bentrok), bentrok, oleh, sekarang, userId);
      return hasil.ok
        ? { ...hasil, ringkasPerubahan: `NIP sudah tercatat, diterapkan sebagai perbaikan data: ${hasil.ringkasPerubahan}` }
        : hasil;
    }

    const golongan = String(nilaiBaru.golonganRuang ?? "");
    // SK kenaikan pangkat, penyesuaian ijazah, atau PMK sesudah SK KGB terakhir (ADR-065): golongan dan masa kerja
    // pada usulan disalin dari SK itu, jadi masa kerja pada TMT KGB terakhir, gaji pokok, dan jadwal KGB dihitung
    // darinya. Usulan yang diajukan sudah lolos hitungan ini; yang gagal di sini berarti datanya diubah sesudahnya.
    const skBaru = hitungSkPegawaiBaru(usulan);
    if (skBaru.berlaku && !skBaru.ok)
      return { ok: false, pesan: `SK sesudah SK KGB terakhir tidak dapat dihitung: periksa ${skBaru.pesan}. Kembalikan usulan ini ke UPT.` };
    const menurutSk = skBaru.berlaku && skBaru.ok ? skBaru.nilai : null;
    // Keadaan pada SK KGB terakhir yang ditulis UPT bersama SK-nya (ADR-078); null pada usulan lama.
    const acuan = skBaru.berlaku && skBaru.ok ? skBaru.acuan : null;
    const mkgTahun = menurutSk ? menurutSk.mkgTahun : Number(nilaiBaru.mkgTahun ?? 0);
    const mkgBulan = menurutSk ? menurutSk.mkgBulan : Number(nilaiBaru.mkgBulan ?? 0);
    const tmtKgbBerikutnya = menurutSk ? menurutSk.tmtKgbBerikutnya : ((nilaiBaru.tmtKgbBerikutnya as Date | null) ?? null);
    const unitKerja = usulan.unitKerja ?? SATKER.find((s) => s.kode === usulan.satker)?.nama ?? "";
    const pegawaiBaru: PegawaiRow = {
      id: lanjutan?.id ?? newId(),
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
      // TMT golongan pada usulan ber-acuan adalah TMT golongan pada SK KGB terakhir; golongan barunya berlaku sejak TMT
      // kenaikan pangkat, sama dengan Catat KP.
      tmtGolongan:
        acuan && skBaru.berlaku && skBaru.ok && skBaru.jenis === "kp" ? skBaru.tmtSk : ((nilaiBaru.tmtGolongan as Date | null) ?? null),
      mkgTahun,
      mkgBulan,
      // Gaji pokok dihitung dari tabel PP 5/2024 bila tidak diisi, sama dengan impor CSV.
      gajiPokok: menurutSk
        ? menurutSk.gajiPokok
        : Number(nilaiBaru.gajiPokok ?? 0) || getGajiPokok(golongan, mkgTahun, mkgBulan) || 0,
      tmtKgbTerakhir: (nilaiBaru.tmtKgbTerakhir as Date | null) ?? null,
      tmtKgbBerikutnya,
      statusHukdis: false,
      tanggalHukdisBerakhir: null,
      jenisHukdis: null,
      keteranganHukdis: null,
      aktif: true,
      createdAt: sekarang,
      updatedAt: sekarang,
      konfirmasiUptTmt: tmtKgbBerikutnya,
      konfirmasiUptAt: sekarang,
      konfirmasiUptOleh: usulan.diajukanOleh,
      satkerTugas: null,
      berhentiTmt: null,
      berhentiAlasan: null,
      // SK yang diketik UPT pada usulan (SK CPNS, atau SK KGB terakhir di luar SIM-KGB) menjadi SK dasar
      // Input KGB pertama, jadi Tim SDM tidak mengetiknya ulang (ADR-010).
      nomorSkDasar: usulan.nomorSkTerakhir?.trim() || null,
      tanggalSkDasar: usulan.tanggalSkTerakhir ?? null,
      // Pejabat penetap SK itu: isian UPT, atau saran dari awalan nomornya (ADR-086). Kosong diisi Kanwil saat Input KGB.
      penetapSkDasar: penetapSesudahUsulan(null, usulan) ?? null,
    };
    if (lanjutan) {
      // Isian usulan (yang mungkin sudah dibetulkan UPT sejak percobaan sebelumnya) ditulis ulang; yang dicatat Kanwil
      // sesudahnya, seperti hukuman disiplin, mutasi, dan penetap SK dasar, dibiarkan.
      const {
        id: _id, createdAt: _dibuat, statusHukdis: _h1, tanggalHukdisBerakhir: _h2, jenisHukdis: _h3, keteranganHukdis: _h4,
        aktif: _aktif, satkerTugas: _tugas, berhentiTmt: _b1, berhentiAlasan: _b2, penetapSkDasar: _penetap, ...isi
      } = pegawaiBaru;
      await db.pegawai.update({ id: lanjutan.id }, isi);
    } else await db.pegawai.create(pegawaiBaru);
    pegawaiIdHasil = pegawaiBaru.id;
    perubahan = [];

    // SK itu dicatat sebagai riwayat. Riwayat inilah yang menjadikannya Atas dasar SK KGB berikutnya (ADR-020,
    // ADR-062); tanpa itu dasar KGB pertamanya di SIM-KGB tetap SK KGB lama. Keadaan sebelum SK tidak dilaporkan pada
    // pendataan, jadi sisi "lama" riwayatnya sama dengan sisi barunya.
    const nomorSkBaru = usulan.dasarBaruNomorSk?.trim() ?? "";
    const tanggalSkBaru = tanggalKalender(usulan.dasarBaruTanggalSk);
    if (skBaru.berlaku && skBaru.ok && nomorSkBaru && tanggalSkBaru) {
      const tmtSkBaru = skBaru.tmtSk;
      const padaSk = skBaru.mkgPadaSk;
      const surat = `Dari usulan pegawai baru UPT${usulan.nomorSurat ? ` surat ${usulan.nomorSurat}` : ""}; `;
      const keterangan = acuan
        ? `${surat}keadaan pada SK KGB terakhir (${acuan.golongan}, ${acuan.mkgTahun} tahun ${acuan.mkgBulan} bulan) dan ` +
          `masa kerja golongan pada SK ini (${padaSk.tahun} tahun ${padaSk.bulan} bulan) dilaporkan saat pendataan`
        : `${surat}golongan dan masa kerja golongan (${padaSk.tahun} tahun ${padaSk.bulan} bulan pada TMT SK) disalin dari SK ini saat pendataan`;
      const penetapSK = usulan.dasarBaruPenetap?.trim() || null;
      // Riwayat SK yang sama dari percobaan sebelumnya diperbarui, bukan digandakan (ADR-079).
      const riwayatAda = lanjutan ? await muatSkTercatat(lanjutan.id, usulan) : null;
      if (skBaru.jenis === "kp") {
        const jenisKp = usulan.dasarBaruJenisKp?.trim() ?? "";
        const kp = {
          id: riwayatAda?.id ?? newId(),
          pegawaiId: pegawaiBaru.id,
          jenisKp: isJenisKp(jenisKp) ? jenisKp : "reguler",
          nomorSK: nomorSkBaru,
          tanggalSK: tanggalSkBaru,
          tmtPangkat: tmtSkBaru,
          // Golongan sebelum SK ini hanya diketahui bila UPT menuliskan keadaan pada SK KGB terakhir (ADR-078).
          golonganLama: acuan?.golongan ?? "",
          golonganBaru: pegawaiBaru.golonganRuang,
          mkgTahunLama: acuan?.mkgTahun ?? pegawaiBaru.mkgTahun,
          mkgBulanLama: acuan?.mkgBulan ?? pegawaiBaru.mkgBulan,
          mkgTahunBaru: pegawaiBaru.mkgTahun,
          mkgBulanBaru: pegawaiBaru.mkgBulan,
          gajiPokokLama: acuan?.gajiPokok ?? pegawaiBaru.gajiPokok,
          gajiPokokBaru: pegawaiBaru.gajiPokok,
          keterangan,
          createdAt: sekarang,
          createdBy: userId,
          penetapSK,
        };
        if (riwayatAda) {
          const { id: _id, createdAt: _c, createdBy: _b, ...isi } = kp;
          await db.riwayatPangkat.update({ id: riwayatAda.id }, isi);
        } else await db.riwayatPangkat.create(kp);
      } else {
        const pmk = acuan?.pmk ?? null;
        const isiPmk = {
          id: riwayatAda?.id ?? newId(),
          pegawaiId: pegawaiBaru.id,
          nomorSK: nomorSkBaru,
          tanggalSK: tanggalSkBaru,
          tmtPmk: tmtSkBaru,
          golonganRuang: pegawaiBaru.golonganRuang,
          tambahBulan: pmk?.tambahBulan ?? 0,
          mkgTahunSebelum: pmk?.mkgSebelumPadaTmt.tahun ?? padaSk.tahun,
          mkgBulanSebelum: pmk?.mkgSebelumPadaTmt.bulan ?? padaSk.bulan,
          mkgTahunSesudah: padaSk.tahun,
          mkgBulanSesudah: padaSk.bulan,
          mkgTahunDasarLama: acuan?.mkgTahun ?? pegawaiBaru.mkgTahun,
          mkgBulanDasarLama: acuan?.mkgBulan ?? pegawaiBaru.mkgBulan,
          mkgTahunDasarBaru: pegawaiBaru.mkgTahun,
          mkgBulanDasarBaru: pegawaiBaru.mkgBulan,
          gajiPokokLama: acuan?.gajiPokok ?? pegawaiBaru.gajiPokok,
          gajiPokokBaru: pegawaiBaru.gajiPokok,
          tmtKgbBerikutnyaLama: acuan?.tmtKgbBerikutnya ?? pegawaiBaru.tmtKgbBerikutnya,
          tmtKgbBerikutnyaBaru: pegawaiBaru.tmtKgbBerikutnya,
          penetapSK,
          keterangan,
          createdAt: sekarang,
          createdBy: userId,
        };
        if (riwayatAda) {
          const { id: _id, createdAt: _c, createdBy: _b, ...isi } = isiPmk;
          await db.riwayatPmk.update({ id: riwayatAda.id }, isi);
        } else await db.riwayatPmk.create(isiPmk);
      }
      dasarBaru = ringkasDasarBaru(usulan);
    }
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
    // SK kenaikan pangkat atau PMK pada usulan ini menentukan sendiri golongan, masa kerja, dan gaji pokok
    // (ADR-030). Hitungannya dijalankan lebih dulu tanpa menulis apa pun, supaya penyesuaian KGB berjalan
    // dinilai terhadap keadaan pegawai yang benar-benar akan terjadi.
    // Hitungan SK yang sama dipakai daftar perubahan yang dilihat peninjau (lib/dasarSkUsulan.ts). Dasarnya data tercatat,
    // atau keadaan sebelum SK yang dibetulkan UPT; SK yang sudah tercatat tidak dicatat dua kali (ADR-079).
    const rencana = rencanaSkUsulan(pegawaiLama, usulan, nilaiBaru as Partial<PegawaiRow>, tercatat);
    if (rencana.jenis === "galat") return { ok: false, pesan: rencana.pesan };
    const catatSk = rencana.jenis === "hitung";
    const jenisSk = catatSk ? rencana.sk.jenis : "";
    const dasarSk = catatSk ? rencana.dasar : pegawaiLama;
    const koreksi = catatSk ? rencana.koreksi : null;
    const tanggalSkBaru = tanggalKalender(usulan.dasarBaruTanggalSk);
    const tmtSkBaru = tercatat?.tmt ?? tanggalKalender(usulan.dasarBaruTmt);
    const golonganDiusulkan = String(nilaiBaru.golonganRuang ?? pegawaiLama.golonganRuang);
    const mkgTahunSk = Number(nilaiBaru.mkgTahun ?? pegawaiLama.mkgTahun ?? 0);
    const mkgBulanSk = Number(nilaiBaru.mkgBulan ?? pegawaiLama.mkgBulan ?? 0);
    // Kolom yang ditentukan SK tidak pernah ditulis dari angka mentah usulan bila SK-nya dihitung atau sudah diterapkan.
    const nilaiTanpaSk: Record<string, unknown> = { ...nilaiBaru };
    if (catatSk || rencana.jenis === "sudah") for (const kolom of KOLOM_DITENTUKAN_SK) delete nilaiTanpaSk[kolom];
    // Keadaan sebelum SK yang dibetulkan UPT ditulis lebih dulu; catatKenaikanPangkat atau catatPmk lalu menghitung darinya.
    const keadaanDasar: Partial<PegawaiRow> = koreksi
      ? {
          golonganRuang: dasarSk.golonganRuang,
          pangkat: dasarSk.pangkat,
          mkgTahun: dasarSk.mkgTahun,
          mkgBulan: dasarSk.mkgBulan,
          gajiPokok: dasarSk.gajiPokok,
          tmtGolongan: dasarSk.tmtGolongan,
          tmtKgbTerakhir: dasarSk.tmtKgbTerakhir,
          tmtKgbBerikutnya: dasarSk.tmtKgbBerikutnya,
        }
      : {};
    const perkiraan: PegawaiRow = {
      ...pegawaiLama,
      ...(nilaiTanpaSk as Partial<PegawaiRow>),
      ...keadaanDasar,
      ...(catatSk ? rencana.sk.nilai : {}),
    };

    // KGB yang sedang berjalan disesuaikan selama SK-nya belum diunggah; sesudahnya perubahan dasar gaji
    // ditolak. Penolakan diperiksa sebelum apa pun ditulis (ADR-011).
    const penyesuaian = await rencanakanPenyesuaianKgb(pegawaiLama, perkiraan, perubahan.length > 0);
    if (!penyesuaian.ok) return { ok: false, pesan: penyesuaian.pesan };
    terapkanPenyesuaian = penyesuaian.terapkan;

    // Kolom yang ditentukan SK tidak ditulis dari usulan; catatKenaikanPangkat atau catatPmk yang mengisinya
    // dengan hitungan yang sama persis dengan Catat KP/PMK di halaman pegawai.
    const nilaiDitulis: Record<string, unknown> = { ...nilaiTanpaSk, ...keadaanDasar };

    const tmtSiklus = (perkiraan.tmtKgbBerikutnya as Date | null) ?? pegawaiLama.tmtKgbBerikutnya ?? null;
    await db.pegawai.update(
      { id: pegawaiLama.id },
      {
        ...nilaiDitulis,
        // SK dasar ikut diperbarui hanya bila UPT mengisinya pada usulan ini (ADR-010). Pejabat penetapnya diambil dari
        // isian UPT; usulan lama tanpa isian itu yang mengganti nomor SK memakai saran dari nomornya, atau dikosongkan
        // dan diisi Tim SDM saat Input KGB (ADR-056, ADR-086).
        ...(usulan.nomorSkTerakhir?.trim() ? { nomorSkDasar: usulan.nomorSkTerakhir.trim() } : {}),
        ...(usulan.tanggalSkTerakhir ? { tanggalSkDasar: usulan.tanggalSkTerakhir } : {}),
        ...(() => {
          const penetap = penetapSesudahUsulan(pegawaiLama, usulan);
          return penetap === undefined ? {} : { penetapSkDasar: penetap };
        })(),
        konfirmasiUptTmt: tmtSiklus,
        konfirmasiUptAt: sekarang,
        konfirmasiUptOleh: usulan.diajukanOleh,
        updatedAt: sekarang,
      },
    );

    if (catatSk && tanggalSkBaru && tmtSkBaru) {
      const keterangan =
        `Dari usulan UPT${usulan.nomorSurat ? ` surat ${usulan.nomorSurat}` : ""}` +
        (koreksi ? `; keadaan sebelum SK dibetulkan UPT: ${teksKoreksiDasar(koreksi)}` : "");
      const riwayatAda = rencana.tercatat?.id ?? null;
      const hasilSk =
        jenisSk === "kp"
          ? await catatKenaikanPangkat({
              pegawai: dasarSk,
              riwayatAda,
              jenisKp: usulan.dasarBaruJenisKp?.trim() ?? "",
              golonganBaru: golonganDiusulkan,
              nomorSK: usulan.dasarBaruNomorSk ?? "",
              tanggalSK: tanggalSkBaru,
              tmtPangkat: tmtSkBaru,
              penetapSK: usulan.dasarBaruPenetap,
              keterangan,
              userId,
            })
          : await catatPmk({
              pegawai: dasarSk,
              riwayatAda,
              nomorSK: usulan.dasarBaruNomorSk ?? "",
              tanggalSK: tanggalSkBaru,
              tmtPmk: tmtSkBaru,
              mkgTahunSk,
              mkgBulanSk,
              penetapSK: usulan.dasarBaruPenetap,
              keterangan,
              userId,
            });
      // Hitungannya sudah dijalankan di atas tanpa galat, jadi kegagalan di sini hanya soal penyimpanan.
      // Dilaporkan apa adanya supaya Tim SDM mencatat SK-nya sendiri lewat Catat KP/PMK, bukan dibiarkan senyap.
      if (!hasilSk.ok) return { ok: false, pesan: hasilSk.pesan };
      dasarBaru =
        (riwayatAda ? "SK yang sudah tercatat dilengkapi: " : "") +
        hasilSk.ringkas +
        (koreksi ? `; keadaan sebelum SK dibetulkan: ${teksKoreksiDasar(koreksi)}` : "");
    }
    if (rencana.jenis === "sudah")
      dasarBaru = `${ringkasDasarBaru(usulan) ?? "SK"} sudah tercatat dan diterapkan sebelumnya; tidak dicatat ulang`;
  }

  const penyesuaianKgb = terapkanPenyesuaian ? await terapkanPenyesuaian(userId) : null;

  await db.usulanPegawai.update(
    { id: usulan.id },
    { status: "disetujui", ditinjauOleh: oleh, ditinjauAt: sekarang, pegawaiId: pegawaiIdHasil },
  );
  // Usulan yang sudah ditinjau tidak perlu lagi menagih tinjauan; loncengnya ditutup seperti pada
  // pembatalan oleh UPT, supaya daftar notifikasi Kanwil hanya berisi yang benar-benar tersisa.
  await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.USULAN_UPT, referenceId: usulan.id });
  // Laporan SK berangkat tanpa surat, jadi UPT tidak punya cara lain untuk tahu laporannya sudah diterapkan (ADR-074).
  // Hanya usulan perubahan yang benar-benar mencatat riwayat KP atau PMK yang dikabarkan; perbaikan data biasa dan
  // pegawai baru tidak.
  if (dasarBaru && usulan.jenis !== "baru") {
    try {
      await db.notifikasi.deleteMany({ tipe: TIPE_NOTIFIKASI.USULAN_DISETUJUI, referenceId: usulan.id });
      await db.notifikasi.create({
        ...notifikasiUsulanDisetujui(
          { id: usulan.id, satker: usulan.satker },
          { nama: usulan.nama ?? pegawaiLama?.nama ?? null, nip: usulan.nip ?? pegawaiLama?.nip ?? null },
          { dasarBaru, penyesuaianKgb },
        ),
        id: newId(),
        dibaca: false,
        createdAt: sekarang,
      });
    } catch {
      // Usulannya sudah disetujui dan tampak di riwayat UPT; loncengnya saja yang tidak jadi.
    }
  }

  return {
    ok: true,
    pegawaiId: pegawaiIdHasil,
    jumlahPerubahan: perubahan.length,
    perluCatatHukdis: !!usulan.hukdisAda,
    hukdis: ringkasHukdisUsulan(usulan),
    penyesuaianKgb,
    dasarBaru: dasarBaru ?? ringkasDasarBaru(usulan),
    ringkasPerubahan:
      usulan.jenis === "baru"
        ? "pegawai baru ditambahkan ke data induk"
        : perubahan.length > 0
          ? perubahan.map((p) => `${p.label} ${p.sekarang} → ${p.diusulkan}`).join("; ")
          : "tanpa perubahan kolom",
  };
}
