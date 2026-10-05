import { test } from "node:test";
import assert from "node:assert/strict";
import type { RiwayatKgbItem } from "@/lib/kgbAksi";
import {
  berkasPdfSah,
  dasarAwalDariRiwayat,
  dasarAwalInputKgb,
  dasarDariKenaikanPangkat,
  isianDasarKosong,
  formatMkg,
  formatRupiah,
  formatUkuranBerkas,
  hitungKgbPegawai,
  isianDasarSk,
  nilaiInputTanggal,
  nomorSkTerisi,
  pesanBidangWajib,
  selaraskanDasarPegawai,
  subjudulPegawai,
  tahunTanggalInput,
} from "./format";

test("dasarAwalInputKgb: Input Ulang memakai data KGB yang dibatalkan, selain itu SK terakhir selesai", () => {
  const kosong = {
    statusKGB: null,
    nomorSK: null,
    tanggalSK: null,
    tmtSK: null,
    penetapSkDasar: null,
    prevNomorSK: null,
    prevTanggalSK: null,
    prevTmtSK: null,
    prevPenetapSkDasar: null,
  };
  assert.equal(dasarAwalInputKgb(kosong), null);

  const selesai = {
    ...kosong,
    prevNomorSK: "W.19-2/2024",
    prevTanggalSK: "2024-04-10T00:00:00.000Z",
    prevTmtSK: "2024-06-01T00:00:00.000Z",
    prevPenetapSkDasar: "Kepala Kantor Wilayah",
  };
  assert.deepEqual(dasarAwalInputKgb(selesai), {
    nomorSK: "W.19-2/2024",
    tanggalSK: "2024-04-10T00:00:00.000Z",
    tmtSK: "2024-06-01T00:00:00.000Z",
    penetapSkDasar: "Kepala Kantor Wilayah",
  });

  const dibatalkan = { ...selesai, statusKGB: "ditolak", nomorSK: "W.19-9/2024", tanggalSK: "2024-05-02T00:00:00.000Z" };
  assert.deepEqual(dasarAwalInputKgb(dibatalkan), {
    nomorSK: "W.19-9/2024",
    tanggalSK: "2024-05-02T00:00:00.000Z",
    tmtSK: null,
    penetapSkDasar: null,
  });

  // KGB dibatalkan tanpa data SK tersimpan kembali ke SK terakhir yang selesai.
  assert.equal(dasarAwalInputKgb({ ...selesai, statusKGB: "ditolak", nomorSK: " " })?.nomorSK, "W.19-2/2024");
  // Jadwal Belum Diproses yang dibatalkan: tanggal SK dan TMT SK berisi TMT KGB baru, tanpa nomor SK.
  const jadwalDibatalkan = {
    ...selesai,
    statusKGB: "ditolak",
    nomorSK: "",
    tanggalSK: "2026-11-01T00:00:00.000Z",
    tmtSK: "2026-11-01T00:00:00.000Z",
  };
  assert.deepEqual(dasarAwalInputKgb(jadwalDibatalkan), dasarAwalInputKgb(selesai));
  // TMT saja tanpa nomor maupun tanggal SK bukan SK yang dikenali: modal mencari sendiri di riwayat (termasuk kolom
  // SK arsip) dan data pegawai, alih-alih terbuka berisi TMT saja dengan catatan "belum tercatat" (ADR-056).
  assert.equal(dasarAwalInputKgb({ ...kosong, prevTmtSK: "2024-06-01T00:00:00.000Z" }), null);
});

function itemRiwayat(ubah: Partial<RiwayatKgbItem>): RiwayatKgbItem {
  return {
    id: "k1",
    status: "selesai",
    isArsip: false,
    flagRapelan: false,
    nomorSK: "W.19-1/2022",
    tanggalSK: "2022-04-10T00:00:00.000Z",
    tmtSK: "2022-06-01T00:00:00.000Z",
    penetapSkDasar: "Penetap SK sebelumnya",
    tmtKgbBaru: "2024-06-01T00:00:00.000Z",
    gajiPokokLama: null,
    gajiPokokBaru: null,
    mkgTahunBaru: null,
    mkgBulanBaru: null,
    surat: null,
    ...ubah,
  };
}

test("dasarAwalDariRiwayat: SK KGB terakhir yang selesai menjadi SK dasar", () => {
  assert.equal(dasarAwalDariRiwayat([]), null);

  const lama = itemRiwayat({
    id: "lama",
    tmtKgbBaru: "2022-06-01T00:00:00.000Z",
    surat: { nomorSurat: "W.19-1/2022", tanggalSurat: "2022-04-12T00:00:00.000Z" },
  });
  const baru = itemRiwayat({
    id: "baru",
    tmtKgbBaru: "2024-05-31T16:00:00.000Z",
    surat: { nomorSurat: "W.19-7/2024", tanggalSurat: "2024-04-15T00:00:00.000Z", pathFile: "sk/a.pdf" },
  });
  const jadwal = itemRiwayat({ id: "jadwal", status: "belum_diproses", nomorSK: "", penetapSkDasar: "Kepala Kantor Wilayah" });
  const dibatalkan = itemRiwayat({ id: "batal", status: "ditolak", tmtKgbBaru: "2026-06-01T00:00:00.000Z" });

  assert.deepEqual(dasarAwalDariRiwayat([jadwal, dibatalkan, lama, baru]), {
    nomorSK: "W.19-7/2024",
    tanggalSK: "2024-04-15T00:00:00.000Z",
    tmtSK: "2024-05-31T16:00:00.000Z",
    penetapSkDasar: "Kepala Kantor Wilayah",
  });

  // Penetap SK dasar pada record selesai biasa milik SK sebelumnya, jadi tidak dipakai.
  assert.equal(dasarAwalDariRiwayat([baru])?.penetapSkDasar, null);

  // Surat tanpa nomor ("-") tidak memberi nomor dan tanggal.
  assert.deepEqual(dasarAwalDariRiwayat([itemRiwayat({ surat: { nomorSurat: "-", tanggalSurat: "2024-04-15" } })]), {
    nomorSK: null,
    tanggalSK: null,
    tmtSK: "2024-06-01T00:00:00.000Z",
    penetapSkDasar: null,
  });

  // Hanya jadwal Belum Diproses dengan penetap.
  assert.deepEqual(dasarAwalDariRiwayat([jadwal]), { penetapSkDasar: "Kepala Kantor Wilayah" });
});

test("dasarAwalDariRiwayat: record arsip tanpa surat memakai kolom SK yang diarsipkan", () => {
  const arsip = itemRiwayat({
    isArsip: true,
    nomorSK: "W.19-5/2024",
    tanggalSK: "2024-04-20T00:00:00.000Z",
    tmtSK: "2024-07-01T00:00:00.000Z",
    penetapSkDasar: "Kepala Kantor Wilayah",
  });
  assert.deepEqual(dasarAwalDariRiwayat([arsip]), {
    nomorSK: "W.19-5/2024",
    tanggalSK: "2024-04-20T00:00:00.000Z",
    tmtSK: "2024-07-01T00:00:00.000Z",
    penetapSkDasar: "Kepala Kantor Wilayah",
  });
  // TMT SK arsip yang kosong kembali ke TMT KGB.
  assert.equal(dasarAwalDariRiwayat([{ ...arsip, tmtSK: null }])?.tmtSK, "2024-06-01T00:00:00.000Z");
});

test("isianDasarKosong", () => {
  assert.equal(isianDasarKosong({ nomorSK: " ", tanggalSK: "", tmtSK: "", penetapSkDasar: "" }), true);
  assert.equal(isianDasarKosong({ nomorSK: "", tanggalSK: "2024-01-01", tmtSK: "", penetapSkDasar: "" }), false);
  assert.equal(isianDasarKosong({ nomorSK: "", tanggalSK: "", tmtSK: "", penetapSkDasar: "Kepala" }), false);
});

test("nilaiInputTanggal: tanggal tersimpan dibaca sebagai tanggal kalender WITA", () => {
  assert.equal(nilaiInputTanggal("2026-06-01T00:00:00.000Z"), "2026-06-01");
  assert.equal(nilaiInputTanggal("2026-05-31T16:00:00.000Z"), "2026-06-01");
  assert.equal(nilaiInputTanggal("2026-06-01"), "2026-06-01");
  assert.equal(nilaiInputTanggal(null), "");
  assert.equal(nilaiInputTanggal("bukan tanggal"), "");
});

test("nomorSkTerisi dan tahunTanggalInput", () => {
  assert.equal(nomorSkTerisi(" - "), "");
  assert.equal(nomorSkTerisi(" W.19/2026 "), "W.19/2026");
  assert.equal(nomorSkTerisi(null), "");
  assert.equal(tahunTanggalInput("2026-09-15"), 2026);
  assert.equal(tahunTanggalInput("15/09/2026"), null);
  assert.equal(tahunTanggalInput(""), null);
});

test("isianDasarSk: nilai tersimpan menjadi isian form", () => {
  assert.deepEqual(
    isianDasarSk({
      nomorSK: "-",
      tanggalSK: "2024-05-31T16:00:00.000Z",
      tmtSK: "2024-06-01T00:00:00.000Z",
      penetapSkDasar: " Kepala Kantor Wilayah ",
    }),
    { nomorSK: "", tanggalSK: "2024-06-01", tmtSK: "2024-06-01", penetapSkDasar: "Kepala Kantor Wilayah" },
  );
  assert.deepEqual(isianDasarSk(null), { nomorSK: "", tanggalSK: "", tmtSK: "", penetapSkDasar: "" });
});

test("pesanBidangWajib menyebut bidang yang kosong", () => {
  assert.equal(pesanBidangWajib([["A", "x"], ["B", " "]]), "Lengkapi B.");
  assert.equal(pesanBidangWajib([["A", ""], ["B", null]]), "Lengkapi A dan B.");
  assert.equal(pesanBidangWajib([["A", ""], ["B", ""], ["C", undefined]]), "Lengkapi A, B, dan C.");
  assert.equal(pesanBidangWajib([["A", "x"]]), null);
});

test("format tampilan", () => {
  assert.equal(subjudulPegawai({ nama: "Pegawai Contoh", nip: "123" }), "Pegawai Contoh · NIP 123");
  assert.equal(subjudulPegawai({ nama: "Pegawai Contoh" }), "Pegawai Contoh");
  assert.equal(formatRupiah(null), "-");
  assert.equal(formatMkg(6, null), "6 Tahun 0 Bulan");
  assert.equal(formatMkg(null, 2), "-");
  assert.equal(formatUkuranBerkas(2048), "2 KB");
  assert.equal(formatUkuranBerkas(1.5 * 1024 * 1024), "1,5 MB");
  assert.equal(berkasPdfSah({ type: "application/pdf" }), true);
  assert.equal(berkasPdfSah({ type: "image/png" }), false);
  assert.equal(berkasPdfSah(null), false);
});

test("hitungKgbPegawai: jendela proses dan hasil perhitungan", () => {
  const pegawai = {
    golonganRuang: "III/a",
    mkgTahun: 4,
    mkgBulan: 0,
    tmtKgbBerikutnya: "2026-06-01T00:00:00.000Z",
    tmtKgbTerakhir: "2024-06-01T00:00:00.000Z",
  };
  const terbuka = hitungKgbPegawai(pegawai, new Date(2026, 3, 15));
  assert.equal(terbuka.ok, true);
  if (!terbuka.ok) return;
  assert.equal(terbuka.hasil.mkgTahunBaru, 6);
  assert.equal(terbuka.hasil.isLocked, false);
  assert.equal(terbuka.hasil.flagRapelan, false);
  assert.equal(nilaiInputTanggal(terbuka.hasil.tmtKgbBaru), "2026-06-01");

  const terkunci = hitungKgbPegawai(pegawai, new Date(2026, 2, 31));
  assert.equal(terkunci.ok && terkunci.hasil.isLocked, true);

  const lewat = hitungKgbPegawai(pegawai, new Date(2026, 4, 1));
  assert.equal(lewat.ok && lewat.hasil.flagRapelan, true);
});

test("hitungKgbPegawai: data yang tidak dapat dihitung menjadi galat", () => {
  const golongan = hitungKgbPegawai({ golonganRuang: "X/z", mkgTahun: 0, mkgBulan: 0, tmtKgbBerikutnya: "2026-06-01", tmtKgbTerakhir: null });
  assert.equal(golongan.ok, false);
  const tanpaTmt = hitungKgbPegawai({ golonganRuang: "III/a", mkgTahun: 4, mkgBulan: 0, tmtKgbBerikutnya: null, tmtKgbTerakhir: null });
  assert.equal(tanpaTmt.ok, false);
});

test("dasarDariKenaikanPangkat: SK PI sesudah KGB terakhir menjadi Atas dasar (ADR-020)", () => {
  const kgbTerakhir = { nomorSK: "W.19-KP.04.03-1", tanggalSK: "2024-11-20", tmtSK: "2024-12-01", penetapSkDasar: "Kakanwil" };
  const pi = { jenisLabel: "Penyesuaian ijazah", nomorSK: "W.19-KP.03.01-7", tanggalSK: "2026-01-29", tmtPangkat: "2026-02-01", penetapSK: null };
  const lama = { nomorSK: "W.19-KP.03.01-2", tanggalSK: "2022-03-20", tmtPangkat: "2022-04-01", penetapSK: "Kakanwil lama" };
  const hasil = dasarDariKenaikanPangkat(kgbTerakhir, [lama, pi]);
  assert.deepEqual(
    hasil && { nomorSK: hasil.nomorSK, tanggalSK: hasil.tanggalSK, tmtSK: hasil.tmtSK, penetapSkDasar: hasil.penetapSkDasar },
    { nomorSK: "W.19-KP.03.01-7", tanggalSK: "2026-01-29", tmtSK: "2026-02-01", penetapSkDasar: null },
  );
  // KP sebelum KGB terakhir sudah tercakup dalam SK KGB itu.
  assert.equal(dasarDariKenaikanPangkat(kgbTerakhir, [lama]), null);
  assert.equal(dasarDariKenaikanPangkat(kgbTerakhir, []), null);
  // Tanpa SK dasar yang diketahui, KP terbaru dipakai.
  assert.equal(dasarDariKenaikanPangkat(null, [lama, pi])?.nomorSK, "W.19-KP.03.01-7");
});

/* ── Atas Dasar SK diselaraskan dengan SK dasar pada data pegawai (ADR-056) ── */

const salinanDitolak = {
  nomorSK: "W.19-KP.04.04- 5591",
  tanggalSK: "2024-10-04",
  tmtSK: "2024-12-01",
  penetapSkDasar: "Kepala Kantor Wilayah Kementerian Hukum dan HAM Kalimantan Selatan",
};
const skPegawai = {
  nomorSkDasar: "W.19-KP.04.04-5591",
  tanggalSkDasar: "2024-10-04T00:00:00.000Z",
  penetapSkDasar: "Kepala Kantor Wilayah Kementerian Imigrasi dan Pemasyarakatan Kalimantan Selatan",
  tmtKgbTerakhir: "2024-12-01T00:00:00.000Z",
};

test("SK yang sama: nomor dan pejabat penetap diambil dari data pegawai, walau salinannya berspasi lain", () => {
  assert.deepEqual(selaraskanDasarPegawai(salinanDitolak, skPegawai), {
    nomorSK: "W.19-KP.04.04-5591",
    tanggalSK: "2024-10-04",
    tmtSK: "2024-12-01",
    penetapSkDasar: "Kepala Kantor Wilayah Kementerian Imigrasi dan Pemasyarakatan Kalimantan Selatan",
  });
  // Pejabat penetap pada data pegawai kosong: salinan tetap dipakai untuk baris itu.
  assert.equal(selaraskanDasarPegawai(salinanDitolak, { ...skPegawai, penetapSkDasar: null })?.penetapSkDasar, salinanDitolak.penetapSkDasar);
  // Sudah sama persis: tidak ada yang diubah.
  const sama = { ...salinanDitolak, nomorSK: "W.19-KP.04.04-5591", penetapSkDasar: skPegawai.penetapSkDasar };
  assert.equal(selaraskanDasarPegawai(sama, skPegawai), null);
});

test("SK dasar data pegawai yang lebih baru menggantikan salinan; salinan yang lebih baru (SK terbitan SIM-KGB) dipertahankan", () => {
  const baru = { ...skPegawai, nomorSkDasar: "W.19-KP.04.04-7001", tanggalSkDasar: "2026-01-10T00:00:00.000Z" };
  assert.deepEqual(selaraskanDasarPegawai(salinanDitolak, baru), {
    nomorSK: "W.19-KP.04.04-7001",
    tanggalSK: "2026-01-10",
    tmtSK: "2024-12-01",
    penetapSkDasar: skPegawai.penetapSkDasar,
  });
  const terbitanSimKgb = { nomorSK: "W.19-KP.04.04-9000", tanggalSK: "2026-11-20", tmtSK: "2026-12-01", penetapSkDasar: "Kepala Kantor Wilayah" };
  assert.equal(selaraskanDasarPegawai(terbitanSimKgb, skPegawai), null);
});

test("salinan kosong diisi SK dasar data pegawai; data pegawai tanpa SK dasar tidak mengubah apa pun", () => {
  const kosong = { nomorSK: "", tanggalSK: "", tmtSK: "", penetapSkDasar: "" };
  assert.deepEqual(selaraskanDasarPegawai(kosong, skPegawai), {
    nomorSK: "W.19-KP.04.04-5591",
    tanggalSK: "2024-10-04",
    tmtSK: "2024-12-01",
    penetapSkDasar: skPegawai.penetapSkDasar,
  });
  assert.equal(selaraskanDasarPegawai(salinanDitolak, { nomorSkDasar: null, tanggalSkDasar: null, penetapSkDasar: null, tmtKgbTerakhir: null }), null);
});

test("dasarDariKenaikanPangkat: KP yang lebih lama dari KGB terakhir pegawai, atau sesudah TMT KGB ini, bukan dasar (ADR-056)", () => {
  const kp2025 = { nomorSK: "KP-2025", tanggalSK: "2025-03-20", tmtPangkat: "2025-04-01", penetapSK: "Kakanwil" };
  const kp2027 = { nomorSK: "KP-2027", tanggalSK: "2027-03-20", tmtPangkat: "2027-04-01", penetapSK: "Kakanwil" };
  // Riwayat KGB kosong, tetapi data pegawai mencatat KGB terakhir Januari 2026 (terjadi di luar SIM-KGB).
  assert.equal(dasarDariKenaikanPangkat(null, [kp2025], { tmtKgbTerakhir: "2026-01-01" }), null);
  // KP yang baru berlaku sesudah TMT KGB yang diinput belum menetapkan gaji yang dinaikkan KGB itu.
  assert.equal(dasarDariKenaikanPangkat(null, [kp2027], { tmtKgbTerakhir: "2026-01-01", tmtKgbBaru: "2026-12-01" }), null);
  // Di antara batas itu, yang TMT-nya paling baru tetap terpilih; TMT yang sama dengan KGB terakhir dimenangkan KP.
  const kpSama = { ...kp2025, nomorSK: "KP-2026", tmtPangkat: "2026-01-01" };
  assert.equal(
    dasarDariKenaikanPangkat(null, [kp2025, kpSama, kp2027], { tmtKgbTerakhir: "2026-01-01", tmtKgbBaru: "2028-01-01" })?.nomorSK,
    "KP-2027",
  );
  assert.equal(dasarDariKenaikanPangkat(null, [kp2025, kpSama], { tmtKgbTerakhir: "2026-01-01" })?.nomorSK, "KP-2026");
});

test("selaraskanDasarPegawai: dua SK bernomor berbeda pada tanggal yang sama tidak dianggap satu SK", () => {
  const lain = { ...salinanDitolak, nomorSK: "W.19-KP.04.04-6000" };
  assert.equal(selaraskanDasarPegawai(lain, skPegawai), null);
});
