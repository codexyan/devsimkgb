// Templat Excel (.xlsx) Unggah daftar pegawai UPT.
//
// Isinya disusun dari KOLOM_TEMPLAT_UPT dan PANDUAN_DASAR_BARU, sumber yang sama dengan panduan di layar,
// sehingga templat, lembar panduannya, dan layar tidak pernah berbeda. Dipisah dari lib/imporUsulanUpt.ts
// karena hanya dipakai peramban: modul itu ikut terbawa ke Worker, penulis .xlsx tidak perlu.

import { JENIS_KP } from "./kenaikanPangkat";
import {
  ATURAN_DASAR_BARU,
  BATAS_BARIS_IMPOR,
  KOLOM_DASAR_BARU,
  KOLOM_TEMPLAT_UPT,
  LABEL_PERAN_KOLOM,
  LEMBAR_DATA_UPT,
  PANDUAN_DASAR_BARU,
  type KolomTemplatUpt,
} from "./imporUsulanUpt";
import { tulisXlsx, type GayaSel, type KolomXlsx, type LembarXlsx, type NilaiSel, type SelXlsx } from "./xlsx";

export const NAMA_TEMPLAT_XLSX_UPT = "templat_data_pegawai_upt.xlsx";

const GAYA_KEPALA: Record<KolomTemplatUpt["peran"], GayaSel> = {
  wajib: "kepalaWajib",
  diajukan: "kepalaDiajukan",
  opsional: "kepalaOpsional",
};

const lebar = (k: KolomTemplatUpt) =>
  k.kolom === "nama" || k.kolom === "jabatan" ? 30 : k.jenis === "tanggal" ? 14 : k.jenis === "angka" ? 10 : Math.max(14, Math.min(34, k.kolom.length + 4));

/** Format kolom lembar isian: NIP dan teks lain bertipe Text, tanggal bertipe tanggal, ditambah daftar pilihan. */
const kolomIsian = (): KolomXlsx[] =>
  KOLOM_TEMPLAT_UPT.map((k) => ({
    lebar: lebar(k),
    gaya: k.jenis === "tanggal" ? "tanggal" : k.jenis === "angka" ? "biasa" : "teks",
    pilihan: k.pilihan,
  }));

const kepalaIsian = (): SelXlsx[] => KOLOM_TEMPLAT_UPT.map((k) => ({ v: k.kolom, gaya: GAYA_KEPALA[k.peran] }));

/** Nilai contoh menjadi isi sel: tanggal sebagai tanggal sungguhan, angka sebagai angka. */
function nilaiContoh(k: KolomTemplatUpt, teks: string): NilaiSel {
  if (!teks) return null;
  if (k.jenis === "tanggal") return new Date(`${teks}T00:00:00Z`);
  if (k.jenis === "angka") return Number(teks);
  return teks;
}

/** Baris-baris lembar Contoh: pegawai rekaan dalam tiga keadaan yang paling sering diunggah. */
function barisContoh(): (NilaiSel | SelXlsx)[][] {
  const naikPangkat = PANDUAN_DASAR_BARU.find((p) => p.isian.dasarBaruJenisKp === "reguler")!;
  const contoh: { keterangan: string; isi: Record<string, string> }[] = [
    {
      keterangan: "CPNS yang belum pernah KGB: masa kerja 0, TMT KGB terakhir = TMT CPNS.",
      isi: Object.fromEntries(KOLOM_TEMPLAT_UPT.map((k) => [k.kolom, k.contoh])),
    },
    {
      keterangan:
        "Pegawai baru yang sesudah KGB terakhir (Maret 2024, masa kerja golongan II 9 tahun) naik ke III/a lewat penyesuaian ijazah: " +
        "masa kerja dipotong 5 tahun menjadi 4, TMT KGB terakhir tetap. Kolom dasarBaru kosong karena pegawai baru.",
      isi: {
        nip: "198501012015031001",
        nama: "PEGAWAI CONTOH DUA, S.H.",
        jabatan: "Pengelola Data Pemasyarakatan",
        jenisJabatan: "Jabatan Fungsional Umum/Pelaksana",
        eselon: "Non Eselon",
        golonganRuang: "III/a",
        tmtGolongan: "2025-04-01",
        mkgTahun: "4",
        mkgBulan: "0",
        tmtKgbTerakhir: "2024-03-01",
        tempatLahir: "Martapura",
        tanggalLahir: "1985-01-01",
        jenisKelamin: "Laki-laki",
        pendidikanTerakhir: "S1",
      },
    },
    {
      keterangan:
        "Pegawai yang sudah tercatat (golongan III/a) dan naik pangkat reguler ke III/b: golongan diisi yang baru, SK kenaikan pangkatnya " +
        "disebut di kolom dasarBaru. Masa kerja golongannya dihitung sistem.",
      isi: {
        nip: "198001012005011001",
        nama: "PEGAWAI CONTOH TIGA, S.H.",
        jabatan: "Kepala Subseksi Registrasi",
        jenisJabatan: "Struktural",
        eselon: "V.a",
        golonganRuang: "III/b",
        tmtGolongan: naikPangkat.isian.dasarBaruTmt,
        mkgTahun: "20",
        mkgBulan: "0",
        tmtKgbTerakhir: "2025-01-01",
        tempatLahir: "Banjarbaru",
        tanggalLahir: "1980-01-01",
        jenisKelamin: "Laki-laki",
        pendidikanTerakhir: "S1",
        ...naikPangkat.isian,
      },
    },
  ];
  return [
    [...kepalaIsian(), { v: "keterangan contoh (tidak ada di lembar Data Pegawai)", gaya: "kepala" }],
    ...contoh.map((c) => [...KOLOM_TEMPLAT_UPT.map((k) => nilaiContoh(k, c.isi[k.kolom] ?? "")), c.keterangan]),
  ];
}

function lembarPanduanKolom(): LembarXlsx {
  return {
    nama: "Panduan kolom",
    kolom: [{ lebar: 22 }, { lebar: 30 }, { lebar: 20 }, { lebar: 90 }, { lebar: 22 }, { lebar: 44 }],
    baris: [
      [{ v: "Panduan kolom templat Unggah daftar pegawai SIM-KGB", gaya: "judul" }],
      [`Isi lembar "${LEMBAR_DATA_UPT}" mulai baris 2, satu baris untuk satu pegawai, paling banyak ${BATAS_BARIS_IMPOR} baris. Jangan mengubah judul kolom di baris 1; lembar lain tidak ikut terbaca.`],
      ["Warna judul kolom: merah = wajib, barisnya ditolak bila kosong; kuning = boleh kosong saat diunggah, ditagih saat diajukan; abu-abu = boleh kosong."],
      ["Pangkat, gaji pokok, dan TMT KGB berikutnya tidak perlu diisi: ketiganya dihitung sistem dari golongan, masa kerja golongan, dan TMT KGB terakhir."],
      ["Nomor SK dasar dan pindaian SK tidak lewat berkas ini; keduanya dilengkapi per pegawai di Usulan kolektif sebelum diajukan."],
      [],
      ["Kolom", "Nama isian", "Peran", "Cara mengisi", "Contoh", "Pilihan"].map((v): SelXlsx => ({ v, gaya: "kepala" })),
      ...KOLOM_TEMPLAT_UPT.map((k): SelXlsx[] => [
        { v: k.kolom, gaya: "tebal" },
        { v: k.label, gaya: "bungkus" },
        { v: LABEL_PERAN_KOLOM[k.peran], gaya: "bungkus" },
        { v: k.keterangan, gaya: "bungkus" },
        { v: k.contoh, gaya: "bungkus" },
        { v: k.pilihan?.join(" · ") ?? "", gaya: "bungkus" },
      ]),
    ],
  };
}

function lembarPanduanDasarBaru(): LembarXlsx {
  const kosong = (v: string): SelXlsx => ({ v: v || "(kosong)", gaya: "bungkus" });
  return {
    nama: "Panduan dasarBaru",
    kolom: [{ lebar: 30 }, { lebar: 22 }, ...KOLOM_DASAR_BARU.map(() => ({ lebar: 19 })), { lebar: 60 }],
    baris: [
      [{ v: "Mengisi enam kolom dasarBaru: sebab golongan atau masa kerja golongan berubah", gaya: "judul" }],
      ...ATURAN_DASAR_BARU.map((a) => [`• ${a}`]),
      [],
      ["Keadaan pegawai", "Misalnya", ...KOLOM_DASAR_BARU, "Golongan, masa kerja, dan TMT pada baris yang sama"].map(
        (v): SelXlsx => ({ v, gaya: "kepala" }),
      ),
      ...PANDUAN_DASAR_BARU.map((p): SelXlsx[] => [
        { v: p.keadaan, gaya: "tebal" },
        { v: p.misalnya, gaya: "bungkus" },
        ...KOLOM_DASAR_BARU.map((k) => kosong(p.isian[k])),
        { v: p.barisLain, gaya: "bungkus" },
      ]),
      [],
      [
        { v: "dasarBaruJenisKp", gaya: "kepala" },
        { v: "Artinya", gaya: "kepala" },
      ],
      ...Object.entries(JENIS_KP).map(([kunci, label]): SelXlsx[] => [
        { v: kunci, gaya: "tebal" },
        { v: label, gaya: "bungkus" },
      ]),
      [],
      ["Nomor SK pada tabel di atas fiktif; tulis nomor persis seperti pada SK pegawai."],
    ],
  };
}

/** Susun templat .xlsx: lembar isian yang kosong, dua lembar panduan, dan satu lembar contoh. */
export function templatXlsxUpt(): Uint8Array {
  return tulisXlsx([
    {
      nama: LEMBAR_DATA_UPT,
      kolom: kolomIsian(),
      bekukanKepala: true,
      barisValidasi: BATAS_BARIS_IMPOR + 1,
      baris: [kepalaIsian()],
    },
    lembarPanduanKolom(),
    lembarPanduanDasarBaru(),
    {
      nama: "Contoh",
      kolom: [...kolomIsian().map((k) => ({ ...k, pilihan: undefined })), { lebar: 70, gaya: "bungkus" }],
      bekukanKepala: true,
      baris: barisContoh(),
    },
  ]);
}
