// Perencana placeholder KGB berikutnya dan pergeseran jadwal karena hukuman disiplin.
//
// Jalankan: node --import tsx --test lib/jadwalKgb.test.ts

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  kgbTercatatUntukPencabutan,
  rencanaPencabutanPenundaan,
  rencanaPenundaanHukdis,
  rencanaSetelahKgbSelesai,
  rencanaSiklusBerikutnya,
  tanggalPalingAkhir,
} from "./jadwalKgb";
import { hariIniWita } from "./waktu";

const tanggal = (tahun: number, bulan: number, hari = 1) => new Date(tahun, bulan - 1, hari);

test("III/a siklus biasa: placeholder lengkap untuk makeRiwayatKGB", () => {
  const rencana = rencanaSiklusBerikutnya({
    golonganRuang: "III/a",
    mkgTahun: 4,
    mkgBulan: 0,
    gajiPokok: 2964000,
    tmtKgbBerikutnya: "2026-04-01T00:00:00Z",
    tmtKgbTerakhir: "2024-03-31T16:00:00Z",
    hariIni: tanggal(2026, 1, 15),
  });
  assert.deepEqual(rencana, {
    tanggalSK: tanggal(2026, 4),
    tmtSK: tanggal(2026, 4),
    penetapSkDasar: null,
    golonganLama: "III/a",
    gajiPokokLama: 2964000,
    mkgTahunLama: 4,
    mkgBulanLama: 0,
    golonganBaru: "III/a",
    gajiPokokBaru: 3057300,
    mkgTahunBaru: 6,
    mkgBulanBaru: 0,
    tmtKgbBaru: tanggal(2026, 4),
    tmtKgbBerikutnya: tanggal(2028, 4),
    status: "belum_diproses",
    flagRapelan: false,
  });
});

test("II/a dari MKG 0 ke MKG 1, lalu setelah konfirmasi ke MKG 3", () => {
  const hariIni = tanggal(2026, 3, 1);
  const pertama = rencanaSiklusBerikutnya({
    golonganRuang: "II/a",
    mkgTahun: 0,
    mkgBulan: 0,
    gajiPokok: 2184000,
    tmtKgbBerikutnya: tanggal(2026, 6),
    tmtKgbTerakhir: tanggal(2025, 6),
    hariIni,
  });
  assert.equal(pertama.mkgTahunBaru, 1);
  assert.equal(pertama.gajiPokokBaru, 2218400);
  assert.deepEqual(pertama.tmtKgbBerikutnya, tanggal(2028, 6));

  const lanjut = rencanaSetelahKgbSelesai({
    kgb: { ...pertama, tmtKgbBaru: pertama.tmtKgbBaru, tmtKgbBerikutnya: pertama.tmtKgbBerikutnya },
    tmtKgbBerikutnyaPegawai: tanggal(2028, 6),
    penetapSkDasar: "Kepala Kantor Wilayah",
    hariIni,
  });
  assert.deepEqual(lanjut.pegawai, {
    golonganRuang: "II/a",
    gajiPokok: 2218400,
    mkgTahun: 1,
    mkgBulan: 0,
    tmtKgbTerakhir: tanggal(2026, 6),
    tmtKgbBerikutnya: tanggal(2028, 6),
  });
  assert.equal(lanjut.placeholder.mkgTahunLama, 1);
  assert.equal(lanjut.placeholder.gajiPokokLama, 2218400);
  assert.equal(lanjut.placeholder.mkgTahunBaru, 3);
  assert.equal(lanjut.placeholder.gajiPokokBaru, 2288200);
  assert.equal(lanjut.placeholder.penetapSkDasar, "Kepala Kantor Wilayah");
  assert.deepEqual(lanjut.placeholder.tmtKgbBaru, tanggal(2028, 6));
  assert.deepEqual(lanjut.placeholder.tmtKgbBerikutnya, tanggal(2030, 6));
});

test("masa penundaan terbaca dari selisih dengan TMT terakhir", () => {
  const rencana = rencanaSiklusBerikutnya({
    golonganRuang: "III/a",
    mkgTahun: 4,
    mkgBulan: 0,
    gajiPokok: 2964000,
    tmtKgbBerikutnya: tanggal(2026, 7),
    tmtKgbTerakhir: tanggal(2024, 1),
    hariIni: tanggal(2026, 1, 1),
  });
  assert.equal(rencana.mkgTahunBaru, 6);
  assert.equal(rencana.mkgBulanBaru, 6);
  assert.equal(rencana.gajiPokokBaru, 3057300);
  assert.deepEqual(rencana.tmtKgbBerikutnya, tanggal(2028, 1));
});

test("arsip KGB: placeholder berikutnya dari record arsip, penetap SK dasar dikosongkan", () => {
  const lanjut = rencanaSetelahKgbSelesai({
    kgb: {
      golonganBaru: "III/a",
      gajiPokokBaru: 3057300,
      mkgTahunBaru: 6,
      mkgBulanBaru: 0,
      tmtKgbBaru: tanggal(2026, 4),
      tmtKgbBerikutnya: tanggal(2028, 4),
    },
    // Sebelum arsip dicatat, TMT pegawai masih TMT KGB yang diarsipkan.
    tmtKgbBerikutnyaPegawai: tanggal(2026, 4),
    hariIni: tanggal(2026, 9, 15),
  });
  assert.deepEqual(lanjut.pegawai.tmtKgbTerakhir, tanggal(2026, 4));
  assert.deepEqual(lanjut.pegawai.tmtKgbBerikutnya, tanggal(2028, 4));
  assert.equal(lanjut.placeholder.mkgTahunBaru, 8);
  assert.equal(lanjut.placeholder.gajiPokokBaru, 3153600);
  assert.equal(lanjut.placeholder.penetapSkDasar, null);
  assert.deepEqual(lanjut.placeholder.tmtKgbBerikutnya, tanggal(2030, 4));
});

test("hukdis dicatat saat KGB menunggu keuangan: penundaan tetap ada setelah konfirmasi", () => {
  // Input KGB TMT 1 Juni 2026 sudah memajukan TMT pegawai ke 1 Juni 2028; MKG pegawai belum naik.
  const pegawai = {
    golonganRuang: "II/a",
    mkgTahun: 0,
    mkgBulan: 0,
    tmtKgbBerikutnya: tanggal(2028, 6),
    tmtKgbTerakhir: tanggal(2026, 6),
  };
  const kgbAktif = {
    golonganBaru: "II/a",
    gajiPokokBaru: 2218400,
    mkgTahunBaru: 1,
    mkgBulanBaru: 0,
    tmtKgbBaru: tanggal(2026, 6),
    tmtKgbBerikutnya: tanggal(2028, 6),
  };

  const rencana = rencanaPenundaanHukdis({ pegawai, kgbAktif, tmtMulaiHukdis: tanggal(2026, 7, 15), durasiTunda: 12 });
  assert.deepEqual(rencana, {
    aksi: "geser",
    tmtSebelumTunda: tanggal(2028, 6),
    tmtKgbBerikutnya: tanggal(2029, 6),
    tmtKgbTerakhir: tanggal(2026, 6),
    buatPlaceholder: false,
    geserKgbAktif: true,
  });
  if (rencana.aksi !== "geser") return;

  const harapan = {
    tmtKgbBaru: tanggal(2029, 6),
    mkgTahunBaru: 4,
    gajiPokokBaru: 2288200,
    tmtKgbBerikutnya: tanggal(2030, 6),
  };
  const ringkas = (r: ReturnType<typeof rencanaSetelahKgbSelesai>) => ({
    tmtKgbBaru: r.placeholder.tmtKgbBaru,
    mkgTahunBaru: r.placeholder.mkgTahunBaru,
    gajiPokokBaru: r.placeholder.gajiPokokBaru,
    tmtKgbBerikutnya: r.placeholder.tmtKgbBerikutnya,
  });

  // Hanya TMT pegawai yang digeser.
  const dariPegawai = rencanaSetelahKgbSelesai({ kgb: kgbAktif, tmtKgbBerikutnyaPegawai: rencana.tmtKgbBerikutnya });
  assert.deepEqual(ringkas(dariPegawai), harapan);
  assert.deepEqual(dariPegawai.pegawai.tmtKgbBerikutnya, tanggal(2029, 6));

  // Hanya record KGB aktif yang digeser.
  const dariKgb = rencanaSetelahKgbSelesai({
    kgb: { ...kgbAktif, tmtKgbBerikutnya: rencana.tmtKgbBerikutnya },
    tmtKgbBerikutnyaPegawai: pegawai.tmtKgbBerikutnya,
  });
  assert.deepEqual(ringkas(dariKgb), harapan);
});

test("hukdis yang mulai pada atau sebelum TMT KGB aktif ditolak", () => {
  const pegawai = { golonganRuang: "II/a", mkgTahun: 0, mkgBulan: 0, tmtKgbBerikutnya: tanggal(2028, 6) };
  const kgbAktif = { tmtKgbBaru: "2026-05-31T16:00:00Z", tmtKgbBerikutnya: tanggal(2028, 6) };
  for (const tmtMulaiHukdis of [tanggal(2026, 6, 1), "2026-05-10", "2026-06-01T00:00:00Z"]) {
    const rencana = rencanaPenundaanHukdis({ pegawai, kgbAktif, tmtMulaiHukdis, durasiTunda: 12 });
    assert.equal(rencana.aksi, "tolak", String(tmtMulaiHukdis));
  }
  assert.equal(rencanaPenundaanHukdis({ pegawai, kgbAktif: null, tmtMulaiHukdis: null, durasiTunda: 0 }).aksi, "tolak");
  assert.equal(
    rencanaPenundaanHukdis({ pegawai: { ...pegawai, tmtKgbBerikutnya: null }, tmtMulaiHukdis: null, durasiTunda: 12 }).aksi,
    "tolak",
  );
});

test("hukdis tanpa KGB aktif dan tanpa TMT terakhir: masa penundaan tetap dihitung, lalu dapat dipulihkan", () => {
  const pegawai = {
    golonganRuang: "III/a",
    mkgTahun: 4,
    mkgBulan: 0,
    gajiPokok: 2964000,
    tmtKgbBerikutnya: "2026-04-01T00:00:00Z",
    tmtKgbTerakhir: null,
  };
  const rencana = rencanaPenundaanHukdis({ pegawai, tmtMulaiHukdis: tanggal(2026, 1, 10), durasiTunda: 12 });
  assert.deepEqual(rencana, {
    aksi: "geser",
    tmtSebelumTunda: tanggal(2026, 4),
    tmtKgbBerikutnya: tanggal(2027, 4),
    tmtKgbTerakhir: tanggal(2024, 4),
    buatPlaceholder: true,
    geserKgbAktif: false,
  });
  if (rencana.aksi !== "geser") return;

  const placeholder = rencanaSiklusBerikutnya({
    ...pegawai,
    tmtKgbBerikutnya: rencana.tmtKgbBerikutnya,
    tmtKgbTerakhir: rencana.tmtKgbTerakhir,
    hariIni: tanggal(2026, 1, 10),
  });
  assert.equal(placeholder.mkgTahunBaru, 7);
  assert.equal(placeholder.gajiPokokBaru, 3057300);
  assert.deepEqual(placeholder.tmtKgbBaru, tanggal(2027, 4));
  assert.deepEqual(placeholder.tmtKgbBerikutnya, tanggal(2028, 4));

  const cabut = rencanaPencabutanPenundaan({
    hukdis: { berdampakKGB: true, durasiTunda: 12, createdAt: "2026-01-10T02:00:00Z", tmtSetelahTunda: rencana.tmtKgbBerikutnya },
    pegawai: { tmtKgbBerikutnya: "2027-03-31T16:00:00Z" },
  });
  assert.deepEqual(cabut, { aksi: "pulihkan", tmtKgbBerikutnya: tanggal(2026, 4), buatPlaceholder: true, geserKgbAktif: false });
  if (cabut.aksi !== "pulihkan") return;

  const pulih = rencanaSiklusBerikutnya({
    ...pegawai,
    tmtKgbBerikutnya: cabut.tmtKgbBerikutnya,
    tmtKgbTerakhir: rencana.tmtKgbTerakhir,
    hariIni: tanggal(2026, 1, 10),
  });
  assert.equal(pulih.mkgTahunBaru, 6);
  assert.deepEqual(pulih.tmtKgbBerikutnya, tanggal(2028, 4));
});

test("penghapusan hukdis tidak memulihkan TMT bila jadwal sudah berubah", () => {
  const hukdis = { berdampakKGB: true, durasiTunda: 12, createdAt: "2026-01-10T02:00:00Z" };

  const berubah = rencanaPencabutanPenundaan({
    hukdis: { ...hukdis, tmtSetelahTunda: tanggal(2027, 4) },
    pegawai: { tmtKgbBerikutnya: tanggal(2029, 4) },
  });
  assert.equal(berubah.aksi, "tetap");

  // Tanpa TMT hasil penundaan dan tanpa waktu pencatatan KGB: KGB dengan TMT sesudah hukdis dicatat
  // berarti penundaan sudah dijalani.
  const sudahDijalani = rencanaPencabutanPenundaan({
    hukdis,
    pegawai: { tmtKgbBerikutnya: tanggal(2029, 4) },
    kgbTercatat: [{ tmt: "2024-04-01T00:00:00Z", dicatatPada: "2024-03-20T02:00:00Z" }, { tmt: "2027-03-31T16:00:00Z" }],
  });
  assert.equal(sudahDijalani.aksi, "tetap");

  const belumDijalani = rencanaPencabutanPenundaan({
    hukdis,
    pegawai: { tmtKgbBerikutnya: tanggal(2027, 4) },
    kgbTercatat: [{ tmt: "2024-04-01T00:00:00Z" }],
  });
  assert.deepEqual(belumDijalani, { aksi: "pulihkan", tmtKgbBerikutnya: tanggal(2026, 4), buatPlaceholder: true, geserKgbAktif: false });

  assert.equal(rencanaPencabutanPenundaan({ hukdis: { ...hukdis, createdAt: null }, pegawai: { tmtKgbBerikutnya: tanggal(2027, 4) } }).aksi, "tetap");
  assert.equal(rencanaPencabutanPenundaan({ hukdis: { ...hukdis, berdampakKGB: false }, pegawai: { tmtKgbBerikutnya: tanggal(2027, 4) } }).aksi, "tetap");

  const saatKgbAktif = rencanaPencabutanPenundaan({
    hukdis: { ...hukdis, tmtSetelahTunda: tanggal(2029, 6) },
    pegawai: { tmtKgbBerikutnya: tanggal(2029, 6) },
    kgbAktif: { tmtKgbBaru: tanggal(2026, 6), tmtKgbBerikutnya: tanggal(2028, 6) },
  });
  assert.deepEqual(saatKgbAktif, { aksi: "pulihkan", tmtKgbBerikutnya: tanggal(2028, 6), buatPlaceholder: false, geserKgbAktif: true });
});

test("hukdis tanpa KGB aktif yang mulai sesudah TMT KGB berikutnya ditolak; mulai pada TMT itu tetap menggeser", () => {
  const pegawai = { golonganRuang: "III/a", mkgTahun: 4, mkgBulan: 0, tmtKgbBerikutnya: tanggal(2026, 8), tmtKgbTerakhir: tanggal(2024, 8) };
  const hariIni = tanggal(2026, 9, 15);

  const sesudahTmt = rencanaPenundaanHukdis({ pegawai, tmtMulaiHukdis: tanggal(2026, 9, 15), durasiTunda: 12, hariIni });
  assert.equal(sesudahTmt.aksi, "tolak");
  if (sesudahTmt.aksi === "tolak") assert.match(sesudahTmt.alasan, /Input KGB TMT .* terlebih dahulu/);

  // Masa input TMT 1 Maret 2027 baru dibuka 1 Januari 2027.
  const belumDibuka = rencanaPenundaanHukdis({
    pegawai: { ...pegawai, tmtKgbBerikutnya: tanggal(2027, 3) },
    tmtMulaiHukdis: tanggal(2027, 4),
    durasiTunda: 12,
    hariIni,
  });
  assert.equal(belumDibuka.aksi, "tolak");
  if (belumDibuka.aksi === "tolak") assert.match(belumDibuka.alasan, /dapat dilakukan mulai/);

  const padaTmt = rencanaPenundaanHukdis({ pegawai, tmtMulaiHukdis: "2026-07-31T16:00:00Z", durasiTunda: 12, hariIni });
  assert.equal(padaTmt.aksi, "geser");
  assert.equal(rencanaPenundaanHukdis({ pegawai, tmtMulaiHukdis: "bukan tanggal", durasiTunda: 12 }).aksi, "tolak");
});

test("hukdis pada KGB Menunggu Keuangan ditolak tanpa saran membatalkan KGB", () => {
  const pegawai = { golonganRuang: "II/a", mkgTahun: 0, mkgBulan: 0, tmtKgbBerikutnya: tanggal(2028, 10) };
  const kgbAktif = { tmtKgbBaru: tanggal(2026, 10), tmtKgbBerikutnya: tanggal(2028, 10) };

  const menunggu = rencanaPenundaanHukdis({
    pegawai,
    kgbAktif: { ...kgbAktif, status: "menunggu_keuangan" },
    tmtMulaiHukdis: tanggal(2026, 9, 20),
    durasiTunda: 12,
  });
  if (menunggu.aksi !== "tolak") assert.fail("hukdis pada KGB menunggu keuangan harus ditolak");
  assert.doesNotMatch(menunggu.alasan, /Batalkan KGB/);
  assert.match(menunggu.alasan, /Tim Keuangan/);

  const sedang = rencanaPenundaanHukdis({
    pegawai,
    kgbAktif: { ...kgbAktif, status: "sedang_diproses" },
    tmtMulaiHukdis: tanggal(2026, 9, 20),
    durasiTunda: 12,
  });
  if (sedang.aksi !== "tolak") assert.fail("hukdis pada KGB sedang diproses harus ditolak");
  assert.match(sedang.alasan, /Batalkan KGB/);
});

test("KGB dikonfirmasi sebelum TMT-nya, hukdis dicatat sesudahnya, lalu dihapus: TMT dipulihkan", () => {
  // KGB TMT 1 November 2026 dikonfirmasi 10 September 2026; hukdis dicatat 15 September 2026 dan
  // menggeser TMT berikutnya dari 1 November 2028 ke 1 November 2029.
  const hukdis = { berdampakKGB: true, durasiTunda: 12, tmtMulai: tanggal(2026, 9, 15), createdAt: "2026-09-15T02:00:00Z" };
  const selesai = {
    status: "selesai",
    isArsip: false,
    createdAt: "2024-11-01T02:00:00Z",
    konfirmasiKeuanganAt: "2026-09-10T03:00:00Z",
    golonganBaru: "III/a",
    mkgTahunBaru: 6,
    mkgBulanBaru: 0,
    tmtKgbBaru: tanggal(2026, 11),
    tmtKgbBerikutnya: tanggal(2028, 11),
  };
  const placeholder = {
    ...selesai,
    status: "belum_diproses",
    konfirmasiKeuanganAt: null,
    createdAt: "2026-09-15T02:00:01Z",
    tmtKgbBaru: tanggal(2029, 11),
    tmtKgbBerikutnya: tanggal(2031, 11),
  };
  const kgbTercatat = kgbTercatatUntukPencabutan({ riwayatKgb: [selesai, placeholder], hukdis });
  assert.deepEqual(kgbTercatat, [{ tmt: tanggal(2026, 11), dicatatPada: "2026-09-10T03:00:00Z" }]);
  assert.deepEqual(
    rencanaPencabutanPenundaan({ hukdis, pegawai: { tmtKgbBerikutnya: tanggal(2029, 11) }, kgbTercatat }),
    { aksi: "pulihkan", tmtKgbBerikutnya: tanggal(2028, 11), buatPlaceholder: true, geserKgbAktif: false },
  );

  // KGB yang dikonfirmasi atau diarsipkan sesudah hukdis dicatat berarti jadwal hasil penundaan sudah dipakai.
  for (const kgb of [
    { ...selesai, konfirmasiKeuanganAt: "2026-09-16T01:00:00Z" },
    { ...selesai, isArsip: true, konfirmasiKeuanganAt: null, createdAt: "2026-09-15T05:00:00Z" },
    // Data lama tanpa waktu konfirmasi memakai TMT.
    { ...selesai, konfirmasiKeuanganAt: null },
  ]) {
    const tercatat = kgbTercatatUntukPencabutan({ riwayatKgb: [kgb], hukdis });
    assert.equal(
      rencanaPencabutanPenundaan({ hukdis, pegawai: { tmtKgbBerikutnya: tanggal(2029, 11) }, kgbTercatat: tercatat }).aksi,
      "tetap",
    );
  }
});

test("KGB yang berjalan saat hukdis dicatat lalu dikonfirmasi tidak menghalangi pemulihan", () => {
  // Hukdis mulai 1 Desember 2026 dicatat 15 September 2026 saat KGB TMT 1 November 2026 menunggu
  // keuangan: TMT berikutnya KGB itu digeser ke 1 November 2029, lalu KGB dikonfirmasi 20 September.
  const hukdis = { berdampakKGB: true, durasiTunda: 12, tmtMulai: tanggal(2026, 12), createdAt: "2026-09-15T02:00:00Z" };
  const selesai = {
    status: "selesai",
    isArsip: false,
    createdAt: "2024-11-01T02:00:00Z",
    konfirmasiKeuanganAt: "2026-09-20T03:00:00Z",
    golonganBaru: "III/a",
    mkgTahunBaru: 6,
    mkgBulanBaru: 0,
    tmtKgbBaru: tanggal(2026, 11),
    tmtKgbBerikutnya: tanggal(2029, 11),
  };
  const kgbTercatat = kgbTercatatUntukPencabutan({ riwayatKgb: [selesai], hukdis });
  assert.deepEqual(kgbTercatat, []);
  assert.deepEqual(
    rencanaPencabutanPenundaan({ hukdis, pegawai: { tmtKgbBerikutnya: tanggal(2029, 11) }, kgbTercatat }),
    { aksi: "pulihkan", tmtKgbBerikutnya: tanggal(2028, 11), buatPlaceholder: true, geserKgbAktif: false },
  );
});

test("KGB yang diinput sesudah hukdis dicatat menghalangi pemulihan walau TMT-nya sebelum tanggal hukdis", () => {
  // Hukdis mulai 1 Januari 2024 baru dicatat 15 September 2026: TMT 1 Juni 2024 digeser ke 1 Juni 2025,
  // lalu KGB TMT 1 Juni 2025 diinput 16 September 2026 dan masih berjalan.
  const hukdis = { berdampakKGB: true, durasiTunda: 12, tmtMulai: tanggal(2024, 1), createdAt: "2026-09-15T02:00:00Z" };
  const berjalan = {
    status: "sedang_diproses",
    isArsip: false,
    createdAt: "2026-09-15T02:00:01Z",
    konfirmasiKeuanganAt: null,
    golonganBaru: "III/a",
    mkgTahunBaru: 6,
    mkgBulanBaru: 0,
    tmtKgbBaru: tanggal(2025, 6),
    tmtKgbBerikutnya: tanggal(2027, 6),
  };
  const kgbTercatat = kgbTercatatUntukPencabutan({ riwayatKgb: [berjalan], hukdis });
  assert.deepEqual(kgbTercatat, [{ tmt: tanggal(2025, 6), dicatatPada: null, berjalan: true }]);
  const cabut = rencanaPencabutanPenundaan({
    hukdis,
    pegawai: { tmtKgbBerikutnya: tanggal(2027, 6) },
    kgbAktif: berjalan,
    kgbTercatat,
  });
  assert.equal(cabut.aksi, "tetap");
});

test("flagRapelan placeholder mengikuti hari ini WITA yang disuntikkan", () => {
  const dasar = {
    golonganRuang: "III/a",
    mkgTahun: 4,
    mkgBulan: 0,
    gajiPokok: 2964000,
    tmtKgbBerikutnya: "2026-05-31T16:00:00Z",
    tmtKgbTerakhir: "2024-06-01T00:00:00Z",
  };
  // Batas SDM untuk TMT 1 Juni 2026 adalah 20 April 2026 (WITA, batas bawaan).
  const sebelumBatas = rencanaSiklusBerikutnya({ ...dasar, hariIni: hariIniWita(new Date("2026-04-20T15:30:00Z")) });
  const sesudahBatas = rencanaSiklusBerikutnya({ ...dasar, hariIni: hariIniWita(new Date("2026-04-20T16:30:00Z")) });
  assert.equal(sebelumBatas.flagRapelan, false);
  assert.equal(sesudahBatas.flagRapelan, true);
  assert.equal(sesudahBatas.mkgTahunBaru, 6);
});

test("tanggalPalingAkhir membaca tanggal kalender", () => {
  assert.deepEqual(tanggalPalingAkhir(null, "2028-05-31T16:00:00Z", "bukan tanggal", tanggal(2027, 6)), tanggal(2028, 6));
  assert.equal(tanggalPalingAkhir(null, undefined, ""), null);
});
