import { test } from "node:test";
import assert from "node:assert/strict";
import type { RiwayatKgbItem } from "@/lib/kgbAksi";
import {
  berkasPdfSah,
  dasarAwalDariRiwayat,
  dasarAwalInputKgb,
  isianDasarKosong,
  formatMkg,
  formatRupiah,
  formatUkuranBerkas,
  hitungKgbPegawai,
  isianDasarSk,
  nilaiInputTanggal,
  nomorSkTerisi,
  pesanBidangWajib,
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
  // Tanpa nomor SK terakhir, TMT tetap menjadi isian awal.
  assert.deepEqual(dasarAwalInputKgb({ ...kosong, prevTmtSK: "2024-06-01T00:00:00.000Z" }), {
    nomorSK: null,
    tanggalSK: null,
    tmtSK: "2024-06-01T00:00:00.000Z",
    penetapSkDasar: null,
  });
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
