/* ───────────────────────────────────────────────────────────────────────────
   Isi basis data LOKAL (DATA_BACKEND=lokal, berkas .data-lokal/sim-kgb.json) dengan data contoh
   untuk `npm run dev`. Semua nama dan NIP fiktif; tidak ada koneksi ke Supabase atau Google Sheets.

   Jalankan: npx tsx scripts/seed-lokal.ts          (menimpa berkas lokal dari awal)

   Isi:
   - akun untuk empat peran (NIP dan password dicetak di akhir);
   - pegawai Kanwil dan lima UPT dengan TMT KGB tersebar dari 3 bulan lalu sampai 9 bulan ke depan;
   - riwayat KGB dengan status beragam (belum, sedang diproses, menunggu keuangan, selesai, rapelan);
   - dua pegawai ber-hukdis, jenis hukdis PP 94/2021, penandatangan, dan konfigurasi bawaan.
   ─────────────────────────────────────────────────────────────────────────── */

import { rm } from "node:fs/promises";
import bcrypt from "bcryptjs";

process.env.DATA_BACKEND = "lokal";
const BERKAS = process.env.DATA_LOKAL_BERKAS?.trim() || ".data-lokal/sim-kgb.json";

/** Tanggal kalender pada tengah malam UTC, sama dengan isian tanggal di aplikasi. */
const tgl = (tahun: number, bulan: number, hari = 1) => new Date(Date.UTC(tahun, bulan - 1, hari));
/** Geser bulan pada tanggal kalender UTC. */
const geser = (t: Date, bulan: number) => tgl(t.getUTCFullYear(), t.getUTCMonth() + 1 + bulan, t.getUTCDate());

const AKUN = [
  { nip: "199001012015031001", nama: "Budi Hartono", role: "superAdminCore", password: "superadmin123" },
  { nip: "199202022016042002", nama: "Siti Aminah", role: "sdm_kgb", password: "sdmkgb123" },
  { nip: "199303032017051003", nama: "Rahmat Hidayat", role: "sdm_hukdis", password: "hukdis123" },
  { nip: "199404042018062004", nama: "Dian Puspita", role: "keuangan", password: "keuangan123" },
  // Operator UPT: hanya melihat satkernya sendiri.
  { nip: "199505052019051005", nama: "Hendra Saputra", role: "admin_upt", password: "upt123", satker: "rutan-rantau" },
];

const KODE_SATKER = [
  "kanwil",
  "lapas-banjarmasin",
  "rutan-rantau",
  "bapas-banjarmasin",
  "lpka-martapura",
  "lapas-perempuan-martapura",
];
const JUMLAH_PER_SATKER = [18, 8, 6, 6, 5, 5];

const DEPAN = ["Andi", "Siti", "Budi", "Dewi", "Rizky", "Nur", "Hendra", "Fitri", "Agus", "Maya", "Yusuf", "Rina", "Fajar", "Lina", "Arif", "Wulan", "Taufik", "Indah", "Rudi", "Sari", "Eko", "Ratna", "Hadi", "Yuli", "Ilham", "Nadia", "Bayu", "Putri"];
const BELAKANG = ["Pratama", "Rahmawati", "Santoso", "Lestari", "Maulana", "Aisyah", "Wijaya", "Handayani", "Salim", "Sari", "Hakim", "Marlina", "Nugroho", "Kusuma", "Setiawan", "Anggraini", "Hidayat", "Permata", "Saputra", "Utami"];
const GOLONGAN = ["II/a", "II/b", "II/c", "II/d", "III/a", "III/b", "III/c", "III/d", "IV/a", "IV/b"];
const JABATAN_KANWIL = ["Analis Kepegawaian", "Pengelola Keuangan", "Arsiparis", "Penyusun Laporan Keuangan", "Pranata Komputer", "Analis Hukum"];
const JABATAN_UPT = ["Penjaga Tahanan", "Pembimbing Kemasyarakatan", "Pengelola Data Pembinaan", "Petugas Registrasi", "Pengadministrasi Umum", "Pengelola Keamanan"];

async function main() {
  // Modul data dimuat sesudah DATA_BACKEND di-set.
  const { db } = await import("../lib/db");
  const { ALL_DEFS, makeRiwayatKGB } = await import("../lib/sheets/tables");
  const { sinkronkanHeader } = await import("../lib/sheets/sinkronHeader");
  const { newId } = await import("../lib/sheets/id");
  const { getGajiPokok, getPangkat, bulanKeKgbBerikutnya, hitungDeadlineSDM } = await import("../lib/tabelGaji");
  const { SATKER } = await import("../lib/satker");
  const { JENIS_HUKDIS_PP94 } = await import("./jenis-hukdis-pp94");
  const { hariIniWita } = await import("../lib/waktu");

  const hariIni = hariIniWita();
  const bulanIni = tgl(hariIni.getFullYear(), hariIni.getMonth() + 1, 1);

  await rm(BERKAS, { force: true });
  await sinkronkanHeader(ALL_DEFS, true);

  /* ── Konfigurasi, penandatangan, jenis hukdis ─────────────────────────── */
  await db.konfigurasiKanwil.create({
    id: "default", namaKepala: "", nipKepala: "", nomorPP: "Nomor 5 Tahun 2024", tahunPP: "2024", waAdmin: "",
    notifKgbH1: 14, notifKgbH2: 7, sesiTimeoutMenit: 120, updatedAt: new Date(), updatedBy: null, batasInputSdm: 20,
  } as never);
  await db.penandatangan.create({
    id: newId(), jenis: "definitif", nama: "Drs. Kepala Contoh, M.Si.", nip: "197001011995031001",
    jabatan: "Kepala Kantor Wilayah", dasarPenunjukan: null, berlakuMulai: tgl(2025, 1, 1), berlakuSampai: null,
    updatedAt: new Date(), updatedBy: null,
  } as never);
  for (const j of JENIS_HUKDIS_PP94) {
    await db.hukdisJenis.create({
      id: newId(), ...j, regulasiId: null, berdampakKGB: false, durasiTunda: null, aktif: true,
      updatedAt: new Date(), updatedBy: null,
    } as never);
  }
  await db.hukdisKonfigurasi.create({ id: newId(), notifHariH1: 30, notifHariH2: 7, updatedAt: new Date(), updatedBy: null } as never);

  /* ── Akun ─────────────────────────────────────────────────────────────── */
  const idPengguna: Record<string, string> = {};
  for (const a of AKUN) {
    const id = newId();
    idPengguna[a.role] = id;
    await db.user.create({
      id, nip: a.nip, password: await bcrypt.hash(a.password, 10), nama: a.nama,
      jabatan: null, email: null, role: a.role, createdAt: new Date(), satker: a.satker ?? null,
    });
  }

  /* ── Pegawai dan riwayat KGB ──────────────────────────────────────────── */
  let urut = 0;
  let jumlahKgb = 0;
  for (const [s, kode] of KODE_SATKER.entries()) {
    const satker = SATKER.find((x) => x.kode === kode)!;
    for (let k = 0; k < JUMLAH_PER_SATKER[s]; k++, urut++) {
      const golongan = GOLONGAN[(urut * 7) % GOLONGAN.length];
      // MKG lama sesuai langkah tabel gaji: golongan II/b sampai II/d dimulai dari 3 tahun
      const mkgLama = (["II/b", "II/c", "II/d"].includes(golongan) ? 3 : 2) + ((urut * 3) % 10) * 2;
      // Nama unik: pasangan nama depan dan belakang tidak berulang untuk 48 pegawai
      const nama = `${DEPAN[urut % DEPAN.length]} ${BELAKANG[(urut + Math.floor(urut / DEPAN.length) * 3) % BELAKANG.length]}`;
      const nip = `19${85 + (urut % 12)}${String((urut % 12) + 1).padStart(2, "0")}${String((urut % 27) + 1).padStart(2, "0")}20${String(10 + (urut % 14)).padStart(2, "0")}${String((urut % 9) + 1).padStart(2, "0")}1${String(urut).padStart(3, "0")}`;
      // TMT KGB berikutnya tersebar dari 3 bulan lalu sampai 9 bulan ke depan
      const tmt = geser(bulanIni, (urut % 13) - 3);
      // KGB ini menaikkan MKG dari mkgLama ke langkah berikutnya di tabel gaji
      const selang = bulanKeKgbBerikutnya(golongan, mkgLama, 0);
      const tmtTerakhir = geser(tmt, -selang);
      const gajiLama = getGajiPokok(golongan, mkgLama, 0);
      const mkgBaru = mkgLama + Math.floor(selang / 12);
      const gajiBaru = getGajiPokok(golongan, mkgBaru, selang % 12);
      const hukdis = urut === 5 || urut === 27;

      // Status contoh menurut posisi TMT terhadap bulan ini
      const offset = (urut % 13) - 3;
      const pola = urut % 4;
      let status: string | null = null;
      if (offset <= -1) status = pola === 3 ? null : "selesai";
      else if (offset <= 1) status = ["selesai", "menunggu_keuangan", "sedang_diproses", null][pola];
      else if (offset === 2) status = ["menunggu_keuangan", "sedang_diproses", null, null][pola];
      if (hukdis) status = null;

      const pegawaiId = newId();
      const deadline = hitungDeadlineSDM(tmt);
      // Input sebelum batas kecuali satu contoh yang diinput terlambat (berpotensi rapelan)
      const terlambatInput = status !== null && status !== "selesai" && urut % 6 === 1;
      const dibuat = terlambatInput ? geser(deadline, 0) : geser(deadline, -1);
      if (terlambatInput) dibuat.setUTCDate(dibuat.getUTCDate() + 3);

      const selesai = status === "selesai";
      await db.pegawai.create({
        id: pegawaiId, nip, nama, tempatLahir: "Banjarmasin", tanggalLahir: tgl(1985 + (urut % 12), (urut % 12) + 1, (urut % 27) + 1),
        jenisKelamin: urut % 2 === 0 ? "L" : "P", pendidikanTerakhir: urut % 3 === 0 ? "S1" : "D3",
        jabatan: (kode === "kanwil" ? JABATAN_KANWIL : JABATAN_UPT)[urut % 6], pangkat: getPangkat(golongan),
        golonganRuang: golongan, unitKerja: satker.nama, eselon: null, jenisJabatan: "Pelaksana",
        konfirmasiUptTmt: null, konfirmasiUptAt: null, konfirmasiUptOleh: null,
        satkerTugas: null, berhentiTmt: null, berhentiAlasan: null,
        tmtGolongan: tgl(2016 + (urut % 6), 4, 1),
        mkgTahun: selesai ? mkgBaru : mkgLama, mkgBulan: selesai ? selang % 12 : 0,
        gajiPokok: selesai ? gajiBaru : gajiLama,
        tmtKgbTerakhir: selesai ? tmt : tmtTerakhir,
        tmtKgbBerikutnya: selesai ? geser(tmt, bulanKeKgbBerikutnya(golongan, mkgBaru, selang % 12)) : tmt,
        statusHukdis: hukdis, tanggalHukdisBerakhir: hukdis ? (urut === 5 ? geser(bulanIni, -1) : geser(bulanIni, 1)) : null,
        jenisHukdis: hukdis ? "pemotongan_tukin_6_bulan" : null, keteranganHukdis: hukdis ? "Contoh data lokal" : null,
        aktif: true, createdAt: new Date(), updatedAt: new Date(),
      });

      if (hukdis) {
        await db.riwayatHukdis.create({
          id: newId(), pegawaiId, jenisHukdis: "pemotongan_tukin_6_bulan", nomorSK: `W.17-KP.05-${100 + urut}`,
          tanggalSK: geser(bulanIni, -6), tmtMulai: geser(bulanIni, -6), tmtBerakhir: urut === 5 ? geser(bulanIni, -1) : geser(bulanIni, 1),
          berdampakKGB: false, durasiTunda: null, dasarHukum: "PP 94/2021 Pasal 8 ayat (3) huruf a",
          keterangan: "Contoh data lokal", createdAt: new Date(), createdBy: idPengguna.sdm_hukdis,
        } as never);
      }

      if (!status) continue;
      const kgbId = newId();
      await db.riwayatKGB.create(makeRiwayatKGB({
        id: kgbId, pegawaiId, nomorSK: `W.17-KP.04.03-${200 + urut}`, tanggalSK: geser(tmtTerakhir, -1), tmtSK: tmtTerakhir,
        golonganLama: golongan, gajiPokokLama: gajiLama, mkgTahunLama: mkgLama, mkgBulanLama: 0,
        golonganBaru: golongan, gajiPokokBaru: gajiBaru, mkgTahunBaru: mkgBaru, mkgBulanBaru: selang % 12,
        tmtKgbBaru: tmt, tmtKgbBerikutnya: geser(tmt, bulanKeKgbBerikutnya(golongan, mkgBaru, selang % 12)),
        status, flagRapelan: terlambatInput,
        konfirmasiKeuanganAt: selesai ? geser(tmt, -1) : null,
        konfirmasiKeuanganBy: selesai ? idPengguna.keuangan : null,
        // Satu contoh KGB selesai yang ditetapkan rapelan oleh keuangan
        rapelanDitetapkan: selesai ? urut === 13 : null,
        createdBy: idPengguna.sdm_kgb, createdAt: dibuat, penetapSkDasar: "Kepala Kantor Wilayah",
      }));
      jumlahKgb++;
      // Jejak konfirmasi keuangan untuk Riwayat Aktivitas, dengan format detail yang sama seperti API konfirmasi.
      if (selesai) {
        const rapelan = urut === 13;
        const cepat = !rapelan && urut % 3 === 0;
        const waktu = geser(tmt, -1);
        waktu.setUTCHours(1 + (urut % 7), (urut * 7) % 60);
        await db.auditLog.create({
          id: newId(), waktu, aksi: "konfirmasi_keuangan", targetNama: nama, ipAddress: null, userId: idPengguna.keuangan,
          detail: `Konfirmasi KGB ${nama} (${nip}), Gol. ${golongan}, Gaji Rp ${gajiBaru.toLocaleString("id-ID")}, Rapelan: ${rapelan ? "Ya" : "Tidak"}${cepat ? ", melalui Konfirmasi cepat" : ""}`,
        } as never);
      }
      if (status !== "sedang_diproses" || pola === 2) {
        await db.suratKGB.create({
          id: newId(), kgbId, nomorSurat: `W.17-KP.04.03-${500 + urut}`, tanggalSurat: dibuat,
          namaKepalaKanwil: "Drs. Kepala Contoh, M.Si.", nipKepalaKanwil: "197001011995031001",
          pathFile: null, generatedAt: dibuat, generatedBy: idPengguna.sdm_kgb,
          penandatanganId: null, jenisPenandatangan: "definitif", jabatanPenandatangan: "Kepala Kantor Wilayah",
        } as never);
      }
    }
  }

  console.log(`✓ Basis data lokal dibuat di ${BERKAS}`);
  console.log(`  ${urut} pegawai di ${KODE_SATKER.length} satker, ${jumlahKgb} riwayat KGB, 2 pegawai ber-hukdis.\n`);
  console.log("  Akun login (khusus lokal):");
  for (const a of AKUN) console.log(`  - ${a.role.padEnd(15)} NIP ${a.nip}  password ${a.password}${a.satker ? `  satker ${a.satker}` : ""}`);
}

main().catch((e) => {
  console.error("✗ Gagal:", e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
