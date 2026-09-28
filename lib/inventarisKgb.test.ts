// Inventarisasi KGB pegawai Kanwil: nama folder, nama berkas, pemeriksaan isian, dan baris rekap.
//
// Jalankan: node --import tsx --test lib/inventarisKgb.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  KOLOM_REKAP,
  barisRekap,
  berkasUntuk,
  folderKiriman,
  namaBerkasInventaris,
  namaFolderPegawai,
  periksaIsianInventaris,
  tanggalLahirDariNip,
  keadaanFormulir,
  tanggalUntukBerkas,
  teksBatas,
  tutupPadaSah,
  waktuTutup,
  tmtCpnsDariNip,
  type IsianInventaris,
} from "./inventarisKgb";

const pernah: IsianInventaris = {
  keadaan: "pernah",
  nip: "199001012015031001",
  nama: "  Budi   Hartono, S.H. ",
  tempatLahir: "Banjarmasin",
  tanggalLahir: "1990-01-01",
  jabatan: "Analis SDM Aparatur",
  bidang: "Bagian Umum",
  golonganRuang: "III/b",
  tmtGolongan: "2023-04-01",
  naikSetelahKgb: "tidak",
  pmkSetelahKgb: "tidak",
  tmtPmk: "",
  tanggalSkPmk: "",
  mkgTahun: "8",
  mkgBulan: "0",
  tmtDasar: "2024-10-01",
  nomorSkDasar: "W.17-KP.04.03-123",
  tanggalSkDasar: "2024-09-20",
  tanggalSkPendukung: "2023-03-15",
  nomorWa: "0812-3456-7890",
  catatan: "",
};

test("nama folder NIP - Nama tanpa karakter terlarang", () => {
  assert.equal(namaFolderPegawai("199001012015031001", "Budi / Hartono: S.H."), "199001012015031001 - Budi Hartono S.H.");
});

test("nama berkas NIP_Jenis_TanggalSK, tanpa tanggal bila kosong", () => {
  assert.equal(
    namaBerkasInventaris("199001012015031001", "SK-KGB-Terakhir", "2024-09-20"),
    "199001012015031001_SK-KGB-Terakhir_2024-09-20.pdf",
  );
  assert.equal(namaBerkasInventaris("200101012025061001", "SK-PNS", ""), "200101012025061001_SK-PNS.pdf");
  assert.equal(tanggalUntukBerkas(pernah, "SK-KGB-Terakhir"), "2024-09-20");
  assert.equal(tanggalUntukBerkas(pernah, "SK-KP-Terakhir"), "2023-03-15");
});

test("isian lengkap lolos; yang kurang disebutkan", () => {
  assert.deepEqual(periksaIsianInventaris(pernah), []);
  const kurang = periksaIsianInventaris({ ...pernah, nip: "123", mkgBulan: "12", tanggalSkPendukung: "" });
  assert.ok(kurang.includes("NIP harus 18 angka"));
  assert.ok(kurang.some((k) => k.startsWith("masa kerja golongan (bulan)")));
  assert.ok(kurang.includes("tanggal SK kenaikan pangkat terakhir"));
});

test("belum pernah KGB tidak menuntut masa kerja dan SK kenaikan pangkat", () => {
  const belum: IsianInventaris = { ...pernah, keadaan: "belum", mkgTahun: "", mkgBulan: "", tanggalSkPendukung: "" };
  assert.deepEqual(periksaIsianInventaris(belum), []);
  const baris = barisRekap(belum);
  assert.equal(baris[0], "Belum pernah KGB");
  assert.equal(baris[10], "");
  assert.equal(baris[14], "0");
  assert.equal(baris[15], "0");
});

test("kenaikan pangkat setelah KGB terakhir: pertanyaannya wajib dan TMT golongan harus cocok dengan jawabannya", () => {
  // Penyesuaian ijazah II/c MKG 9 th ke III/a (dipotong 5 tahun) sesudah KGB terakhir.
  const pi: IsianInventaris = {
    ...pernah,
    golonganRuang: "III/a",
    tmtGolongan: "2026-04-01",
    naikSetelahKgb: "ya",
    mkgTahun: "4",
    mkgBulan: "1",
    tmtDasar: "2025-03-01",
    tanggalSkPendukung: "2026-03-20",
  };
  assert.deepEqual(periksaIsianInventaris(pi), []);
  assert.equal(barisRekap(pi)[10], "Ya");
  assert.ok(periksaIsianInventaris({ ...pi, naikSetelahKgb: "" }).some((k) => k.startsWith("jawab apakah ada SK kenaikan pangkat/PI atau SK PMK")));
  assert.ok(periksaIsianInventaris({ ...pi, naikSetelahKgb: "tidak" }).some((k) => k.startsWith("TMT golongan sesudah TMT KGB")));
  assert.ok(periksaIsianInventaris({ ...pi, tmtGolongan: "2024-04-01" }).some((k) => k.startsWith("TMT golongan lebih awal")));
});

test("tanggal lahir harus sama dengan NIP dan usianya wajar", () => {
  assert.equal(tanggalLahirDariNip("196911091994032001"), "1969-11-09");
  assert.equal(tanggalLahirDariNip("19691339199403200"), "");
  assert.equal(tmtCpnsDariNip("200001032025061009"), "2025-06-01");
  // Kiriman nyata: tanggal lahir terisi tanggal hari pengisian.
  const hariIni = periksaIsianInventaris({ ...pernah, tanggalLahir: "2026-09-28" }, "2026-09-28");
  assert.ok(hariIni.some((k) => k.startsWith("tanggal lahir tidak sama dengan NIP (NIP Anda menunjukkan 01-01-1990)")));
  // NIP dengan tanggal lahir tak sah tidak dicocokkan, tetapi usianya tetap diperiksa.
  const nipAneh = { ...pernah, nip: "199013012015031001", tanggalLahir: "2020-01-01" };
  assert.ok(periksaIsianInventaris(nipAneh, "2026-09-28").includes("tanggal lahir tidak wajar; periksa tahunnya"));
  assert.deepEqual(periksaIsianInventaris(pernah, "2026-09-28"), []);
});

test("Sudah pernah KGB ditolak bila TMT KGB terakhir tidak sesudah TMT CPNS pada NIP", () => {
  // Kiriman nyata: CPNS TMT Juni 2025 memilih "Sudah pernah KGB" dengan TMT KGB = TMT CPNS.
  const cpns: IsianInventaris = {
    ...pernah,
    nip: "200001032025061009",
    tanggalLahir: "2000-01-03",
    golonganRuang: "III/a",
    tmtGolongan: "2025-06-01",
    tmtDasar: "2025-06-01",
    mkgTahun: "1",
  };
  assert.ok(periksaIsianInventaris(cpns, "2026-09-28").some((k) => k.startsWith("TMT KGB terakhir tidak sesudah TMT CPNS")));
  assert.ok(periksaIsianInventaris({ ...cpns, keadaan: "belum" }, "2026-09-28").every((k) => !k.startsWith("TMT KGB terakhir")));
});

test("kiriman lama tanpa jawaban kenaikan pangkat tetap terbaca di rekap", () => {
  const lama = { ...pernah } as Partial<IsianInventaris>;
  delete lama.naikSetelahKgb;
  assert.equal(barisRekap(lama as IsianInventaris)[10], "");
});

test("baris rekap sejajar dengan kolomnya dan dirapikan", () => {
  const baris = barisRekap(pernah);
  assert.equal(baris.length, KOLOM_REKAP.length - 2);
  assert.equal(baris[2], "Budi Hartono, S.H.");
  assert.equal(baris[8], "Penata Muda Tingkat I");
  assert.equal(baris[10], "Tidak");
  assert.equal(baris[20], "081234567890");
});

test("formulir tertutup sendiri saat batas pengisian WITA lewat, dan terbuka lagi dengan batas baru", () => {
  const k = { terbuka: true, kode: "KANWIL2026", tutupPada: "2026-10-10T23:59" };
  assert.equal(waktuTutup(k.tutupPada)?.toISOString(), "2026-10-10T15:59:00.000Z");
  assert.equal(keadaanFormulir(k, new Date("2026-10-10T23:58:00+08:00")), "dibuka");
  assert.equal(keadaanFormulir(k, new Date("2026-10-10T23:59:00+08:00")), "lewat_batas");
  assert.equal(keadaanFormulir({ ...k, tutupPada: "2026-10-17T23:59" }, new Date("2026-10-11T08:00:00+08:00")), "dibuka");
  assert.equal(keadaanFormulir({ ...k, tutupPada: "" }, new Date("2030-01-01")), "dibuka");
  assert.equal(keadaanFormulir({ ...k, terbuka: false }, new Date("2026-10-01")), "ditutup");
  assert.equal(keadaanFormulir({ ...k, kode: "" }, new Date("2026-10-01")), "ditutup");
  assert.ok(tutupPadaSah("") && tutupPadaSah("2026-10-10T23:59"));
  assert.ok(!tutupPadaSah("10 Oktober 2026") && !tutupPadaSah("2026-13-40T99:99"));
});

test("teks batas memakai hari dan jam WITA, atau teks lama", () => {
  assert.equal(teksBatas({ tutupPada: "2026-10-10T23:59" }), "Sabtu, 10 Oktober 2026 pukul 23.59 WITA");
  assert.equal(teksBatas({ tutupPada: "", batas: "Jumat, 9 Oktober" }), "Jumat, 9 Oktober");
  assert.equal(teksBatas({}), "");
});

test("PMK setelah KGB terakhir: SK PMK wajib diunggah, TMT dan tanggal SK PMK wajib diisi", () => {
  const pmk: IsianInventaris = { ...pernah, pmkSetelahKgb: "ya", tmtPmk: "2025-07-01", tanggalSkPmk: "2025-06-20", mkgTahun: "10" };
  assert.deepEqual(periksaIsianInventaris(pmk, "2026-09-28"), []);
  assert.deepEqual(berkasUntuk(pmk).map((b) => b.jenis), ["SK-KGB-Terakhir", "SK-KP-Terakhir", "SK-PMK"]);
  assert.deepEqual(berkasUntuk(pernah).map((b) => b.jenis), ["SK-KGB-Terakhir", "SK-KP-Terakhir"]);
  assert.equal(tanggalUntukBerkas(pmk, "SK-PMK"), "2025-06-20");
  const baris = barisRekap(pmk);
  assert.deepEqual([baris[11], baris[12], baris[13]], ["Ya", "2025-07-01", "2025-06-20"]);
  const kurang = periksaIsianInventaris({ ...pmk, tmtPmk: "", tanggalSkPmk: "" }, "2026-09-28");
  assert.ok(kurang.includes("TMT PMK") && kurang.includes("tanggal SK PMK"));
  // PMK sebelum KGB terakhir sudah tercakup dalam SK KGB itu.
  assert.ok(periksaIsianInventaris({ ...pmk, tmtPmk: "2024-01-01" }, "2026-09-28").some((k) => k.startsWith("TMT PMK lebih awal")));
  // Kiriman dari halaman lama yang belum menanyakan PMK diminta menjawab.
  assert.ok(periksaIsianInventaris({ ...pernah, pmkSetelahKgb: "" }, "2026-09-28").some((k) => k.startsWith("jawab apakah ada SK")));
});

test("kegiatan UPT: satker wajib dipilih dari sasaran, masuk rekap dan letak folder ZIP", () => {
  const upt: IsianInventaris = { ...pernah, satker: "lapas-banjarmasin" };
  assert.deepEqual(periksaIsianInventaris(upt, "2026-09-28", ["lapas-banjarmasin", "rutan-barabai"]), []);
  assert.ok(periksaIsianInventaris({ ...upt, satker: "" }, "2026-09-28", ["lapas-banjarmasin"]).includes("satker tempat Anda bertugas"));
  assert.ok(periksaIsianInventaris({ ...upt, satker: "kanwil" }, "2026-09-28", ["lapas-banjarmasin"]).includes("satker tempat Anda bertugas"));
  // Kegiatan tanpa isian satker tidak memeriksanya.
  assert.deepEqual(periksaIsianInventaris(pernah, "2026-09-28"), []);
  const baris = barisRekap(upt);
  assert.equal(baris.length, KOLOM_REKAP.length - 2);
  assert.equal(baris[baris.length - 1], "Lembaga Pemasyarakatan Kelas IIA Banjarmasin");
  assert.equal(barisRekap(pernah)[baris.length - 1], "");
  assert.equal(
    folderKiriman(upt),
    "Lembaga Pemasyarakatan Kelas IIA Banjarmasin/01 Pernah KGB/199001012015031001 - Budi Hartono, S.H.",
  );
  assert.equal(folderKiriman(pernah), "01 Pernah KGB/199001012015031001 - Budi Hartono, S.H.");
});
