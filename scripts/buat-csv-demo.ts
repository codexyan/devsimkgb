/*
 * Pembuat berkas CSV data peragaan (demo) SIM-KGB.
 *
 * Tidak mengarang tanggal. Tiap baris ditetapkan dari keadaan yang ingin terlihat di layar pada hari
 * peragaan, lalu TMT KGB terakhirnya dihitung mundur memakai fungsi yang sama dengan yang dipakai
 * aplikasi (bulanKeKgbBerikutnya), sehingga TMT KGB berikutnya jatuh persis di bulan yang dikehendaki.
 * Masa kerja golongan disetel ke langkah yang benar-benar ada pada tabel gaji PP 5/2024, dan tiap NIP
 * diperiksa dengan lib/nipPns.ts supaya tidak ada baris yang tertolak saat diunggah.
 *
 * Jalankan: npx tsx scripts/buat-csv-demo.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  bulanKeKgbBerikutnya,
  getMKGOptions,
  getPangkat,
  hitungDeadlineSDM,
  hitungUnlockDate,
  tambahBulan,
} from "@/lib/tabelGaji";
import { periksaNip } from "@/lib/nipPns";
import { SATKER } from "@/lib/satker";
import { formatTanggalId } from "@/lib/waktu";
import { keBerkasCsv } from "@/lib/csv";

/** Hari peragaan. Seluruh keadaan di bawah dihitung terhadap tanggal ini. */
const HARI_PERAGAAN = new Date(2026, 8, 30); // 30 September 2026

/** Keadaan yang ingin terlihat pada hari peragaan, beserta bulan TMT KGB berikutnya. */
const KEADAAN = {
  terlambat_agu: new Date(2026, 7, 1),
  terlambat_sep: new Date(2026, 8, 1),
  rapelan_nov: new Date(2026, 10, 1),
  buka_okt_des: new Date(2026, 11, 1),
  jan: new Date(2027, 0, 1),
  feb: new Date(2027, 1, 1),
  mar: new Date(2027, 2, 1),
} as const;
type Keadaan = keyof typeof KEADAAN;

interface Baris {
  nama: string;
  jabatan: string;
  jenisJabatan: string;
  eselon: string;
  gol: string;
  /** Masa kerja golongan yang diinginkan (tahun); dibulatkan ke langkah terdekat pada tabel gaji. */
  mkgTahun: number;
  keadaan: Keadaan;
  lahir: string; // yyyy-mm-dd
  tmtCpns: string; // yyyy-mm
  kelamin: "Laki-laki" | "Perempuan";
  pendidikan: string;
  tempatLahir: string;
  /** Tahun TMT golongan sekarang; tanggalnya selalu 1 pada bulan yang sama dengan TMT KGB terakhir. */
  tahunTmtGolongan: number;
  /** Nomor urut NIP. Sengaja dari blok 9xx supaya data peragaan mudah dikenali dan dibersihkan. */
  urut: number;
  /** Hanya untuk berkas Kanwil. */
  unitKerja?: string;
}

const UPT: Baris[] = [
  { nama: "AHMAD FAUZAN NUGROHO", jabatan: "Penjaga Tahanan", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "II/a", mkgTahun: 2, keadaan: "terlambat_agu", lahir: "1996-04-12", tmtCpns: "2022-03", kelamin: "Laki-laki", pendidikan: "SMA/SMK", tempatLahir: "Rantau", tahunTmtGolongan: 2023, urut: 901 },
  { nama: "SITI RAHMAWATI", jabatan: "Pengadministrasi Umum", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "II/c", mkgTahun: 8, keadaan: "terlambat_sep", lahir: "1990-11-03", tmtCpns: "2015-04", kelamin: "Perempuan", pendidikan: "D3", tempatLahir: "Kandangan", tahunTmtGolongan: 2021, urut: 902 },
  { nama: "MUHAMMAD RIZALDI", jabatan: "Penjaga Tahanan", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "II/b", mkgTahun: 6, keadaan: "rapelan_nov", lahir: "1993-06-21", tmtCpns: "2017-11", kelamin: "Laki-laki", pendidikan: "SMA/SMK", tempatLahir: "Barabai", tahunTmtGolongan: 2022, urut: 903 },
  { nama: "NOVITA SARI ANGGRAINI", jabatan: "Perawat Terampil", jenisJabatan: "Jabatan Fungsional Tertentu", eselon: "Non Eselon", gol: "II/d", mkgTahun: 10, keadaan: "rapelan_nov", lahir: "1989-02-17", tmtCpns: "2014-01", kelamin: "Perempuan", pendidikan: "D3", tempatLahir: "Banjarmasin", tahunTmtGolongan: 2020, urut: 904 },
  { nama: "BAMBANG SETIAWAN", jabatan: "Kepala Subseksi Pelayanan Tahanan", jenisJabatan: "Struktural", eselon: "IV.b", gol: "III/c", mkgTahun: 18, keadaan: "buka_okt_des", lahir: "1981-08-09", tmtCpns: "2006-12", kelamin: "Laki-laki", pendidikan: "S1", tempatLahir: "Amuntai", tahunTmtGolongan: 2019, urut: 905 },
  { nama: "DEWI LESTARI HANDAYANI", jabatan: "Analis Kepegawaian Ahli Pertama", jenisJabatan: "Jabatan Fungsional Tertentu", eselon: "Non Eselon", gol: "III/a", mkgTahun: 4, keadaan: "buka_okt_des", lahir: "1995-12-25", tmtCpns: "2021-01", kelamin: "Perempuan", pendidikan: "S1", tempatLahir: "Martapura", tahunTmtGolongan: 2022, urut: 906 },
  { nama: "HENDRIK PRASETYO", jabatan: "Penjaga Tahanan", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "II/a", mkgTahun: 4, keadaan: "jan", lahir: "1994-09-30", tmtCpns: "2019-02", kelamin: "Laki-laki", pendidikan: "SMA/SMK", tempatLahir: "Pelaihari", tahunTmtGolongan: 2021, urut: 907 },
  { nama: "RATNA JUWITA SARI", jabatan: "Pengelola Keuangan", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "II/c", mkgTahun: 12, keadaan: "jan", lahir: "1987-05-14", tmtCpns: "2012-10", kelamin: "Perempuan", pendidikan: "D3", tempatLahir: "Marabahan", tahunTmtGolongan: 2018, urut: 908 },
  { nama: "YUDI KURNIAWAN SAPUTRA", jabatan: "Pembimbing Kemasyarakatan Ahli Muda", jenisJabatan: "Jabatan Fungsional Tertentu", eselon: "Non Eselon", gol: "III/d", mkgTahun: 22, keadaan: "feb", lahir: "1978-03-07", tmtCpns: "2003-06", kelamin: "Laki-laki", pendidikan: "S1", tempatLahir: "Tanjung", tahunTmtGolongan: 2017, urut: 909 },
  { nama: "INDAH PERMATA WULANDARI", jabatan: "Pengelola Data Pembinaan", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "II/b", mkgTahun: 8, keadaan: "feb", lahir: "1991-07-19", tmtCpns: "2016-05", kelamin: "Perempuan", pendidikan: "SMA/SMK", tempatLahir: "Kotabaru", tahunTmtGolongan: 2020, urut: 910 },
  { nama: "AGUS SALIM RIDHO", jabatan: "Penjaga Tahanan", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "I/c", mkgTahun: 14, keadaan: "mar", lahir: "1984-10-02", tmtCpns: "2009-08", kelamin: "Laki-laki", pendidikan: "SMP", tempatLahir: "Batulicin", tahunTmtGolongan: 2016, urut: 911 },
  { nama: "FITRIANI NURHALIZA", jabatan: "Pengadministrasi Keamanan", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "II/a", mkgTahun: 0, keadaan: "mar", lahir: "2000-01-23", tmtCpns: "2025-03", kelamin: "Perempuan", pendidikan: "SMA/SMK", tempatLahir: "Banjarbaru", tahunTmtGolongan: 2025, urut: 912 },
];

const KANWIL: Baris[] = [
  { nama: "SUPRIYADI HARTONO", jabatan: "Analis Kepegawaian Ahli Madya", jenisJabatan: "Jabatan Fungsional Tertentu", eselon: "Non Eselon", gol: "IV/a", mkgTahun: 24, keadaan: "terlambat_agu", lahir: "1976-02-11", tmtCpns: "2001-03", kelamin: "Laki-laki", pendidikan: "S2", tempatLahir: "Banjarmasin", tahunTmtGolongan: 2015, urut: 921 },
  { nama: "MARIA ULFAH SUSANTI", jabatan: "Pengelola Barang Milik Negara", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "III/b", mkgTahun: 14, keadaan: "terlambat_sep", lahir: "1985-06-08", tmtCpns: "2010-12", kelamin: "Perempuan", pendidikan: "S1", tempatLahir: "Banjarbaru", tahunTmtGolongan: 2019, urut: 922 },
  { nama: "TAUFIK HIDAYAT RAMADHAN", jabatan: "Kepala Subbagian Kepegawaian", jenisJabatan: "Struktural", eselon: "IV.a", gol: "III/d", mkgTahun: 20, keadaan: "rapelan_nov", lahir: "1980-04-27", tmtCpns: "2005-09", kelamin: "Laki-laki", pendidikan: "S2", tempatLahir: "Martapura", tahunTmtGolongan: 2018, urut: 923 },
  { nama: "LINDA KARTIKA DEWI", jabatan: "Analis Anggaran Ahli Pertama", jenisJabatan: "Jabatan Fungsional Tertentu", eselon: "Non Eselon", gol: "III/a", mkgTahun: 6, keadaan: "rapelan_nov", lahir: "1994-08-15", tmtCpns: "2019-04", kelamin: "Perempuan", pendidikan: "S1", tempatLahir: "Amuntai", tahunTmtGolongan: 2021, urut: 924 },
  { nama: "RUDI HERMAWAN", jabatan: "Pranata Komputer Ahli Muda", jenisJabatan: "Jabatan Fungsional Tertentu", eselon: "Non Eselon", gol: "III/c", mkgTahun: 16, keadaan: "buka_okt_des", lahir: "1983-11-05", tmtCpns: "2008-02", kelamin: "Laki-laki", pendidikan: "S1", tempatLahir: "Kandangan", tahunTmtGolongan: 2020, urut: 925 },
  { nama: "SRI WAHYUNI ASTUTI", jabatan: "Pengadministrasi Persuratan", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "II/c", mkgTahun: 10, keadaan: "buka_okt_des", lahir: "1988-09-22", tmtCpns: "2013-11", kelamin: "Perempuan", pendidikan: "SMA/SMK", tempatLahir: "Barabai", tahunTmtGolongan: 2019, urut: 926 },
  { nama: "DIDIK PURNOMO AJI", jabatan: "Arsiparis Terampil", jenisJabatan: "Jabatan Fungsional Tertentu", eselon: "Non Eselon", gol: "II/d", mkgTahun: 12, keadaan: "jan", lahir: "1986-01-30", tmtCpns: "2011-06", kelamin: "Laki-laki", pendidikan: "D3", tempatLahir: "Tanjung", tahunTmtGolongan: 2018, urut: 927 },
  { nama: "HENI PUSPITASARI", jabatan: "Analis Hukum Ahli Pertama", jenisJabatan: "Jabatan Fungsional Tertentu", eselon: "Non Eselon", gol: "III/b", mkgTahun: 8, keadaan: "jan", lahir: "1992-03-18", tmtCpns: "2017-02", kelamin: "Perempuan", pendidikan: "S1", tempatLahir: "Pelaihari", tahunTmtGolongan: 2021, urut: 928 },
  { nama: "IWAN SETYO NUGROHO", jabatan: "Penjaga Tahanan", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "II/b", mkgTahun: 10, keadaan: "feb", lahir: "1989-12-04", tmtCpns: "2014-08", kelamin: "Laki-laki", pendidikan: "SMA/SMK", tempatLahir: "Marabahan", tahunTmtGolongan: 2019, urut: 929, unitKerja: "Lembaga Pemasyarakatan Kelas IIA Banjarmasin" },
  { nama: "NUR AISYAH RAHMADANI", jabatan: "Perawat Terampil", jenisJabatan: "Jabatan Fungsional Tertentu", eselon: "Non Eselon", gol: "II/c", mkgTahun: 6, keadaan: "feb", lahir: "1993-05-26", tmtCpns: "2018-03", kelamin: "Perempuan", pendidikan: "D3", tempatLahir: "Kotabaru", tahunTmtGolongan: 2022, urut: 930, unitKerja: "Lembaga Pemasyarakatan Kelas IIB Amuntai" },
  { nama: "ANDI FIRMANSYAH PUTRA", jabatan: "Pembimbing Kemasyarakatan Ahli Pertama", jenisJabatan: "Jabatan Fungsional Tertentu", eselon: "Non Eselon", gol: "III/a", mkgTahun: 2, keadaan: "mar", lahir: "1997-10-11", tmtCpns: "2023-01", kelamin: "Laki-laki", pendidikan: "S1", tempatLahir: "Banjarmasin", tahunTmtGolongan: 2024, urut: 931, unitKerja: "Balai Pemasyarakatan Kelas I Banjarmasin" },
  { nama: "TRI UTAMI NINGSIH", jabatan: "Pengelola Data Kepegawaian", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "II/a", mkgTahun: 6, keadaan: "mar", lahir: "1992-07-07", tmtCpns: "2018-12", kelamin: "Perempuan", pendidikan: "SMA/SMK", tempatLahir: "Rantau", tahunTmtGolongan: 2020, urut: 932, unitKerja: "Rumah Tahanan Negara Kelas IIB Kandangan" },
  { nama: "ZAINAL ABIDIN MAHMUD", jabatan: "Kepala Seksi Pembinaan", jenisJabatan: "Struktural", eselon: "IV.a", gol: "IV/b", mkgTahun: 28, keadaan: "jan", lahir: "1972-09-13", tmtCpns: "1997-03", kelamin: "Laki-laki", pendidikan: "S2", tempatLahir: "Banjarmasin", tahunTmtGolongan: 2014, urut: 933 },
  { nama: "ELLY ROSMAWATI", jabatan: "Bendahara Pengeluaran", jenisJabatan: "Jabatan Fungsional Umum/Pelaksana", eselon: "Non Eselon", gol: "III/b", mkgTahun: 18, keadaan: "buka_okt_des", lahir: "1979-04-02", tmtCpns: "2004-11", kelamin: "Perempuan", pendidikan: "S1", tempatLahir: "Banjarbaru", tahunTmtGolongan: 2016, urut: 934 },
];

/* ── pembantu ── */

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Langkah masa kerja golongan yang benar-benar ada di tabel gaji, terdekat dengan tahun yang diminta. */
function mkgTerdekat(gol: string, tahunDiminta: number): { tahun: number; bulan: number; gaji: number } {
  const pilihan = getMKGOptions(gol);
  if (pilihan.length === 0) throw new Error(`Golongan ${gol} tidak ada di tabel gaji`);
  return pilihan.reduce((a, b) =>
    Math.abs(a.tahun * 12 + a.bulan - tahunDiminta * 12) <= Math.abs(b.tahun * 12 + b.bulan - tahunDiminta * 12) ? a : b,
  );
}

function nipDari(b: Baris): string {
  const lahir = b.lahir.replace(/-/g, "");
  const tmt = b.tmtCpns.replace(/-/g, "");
  const kelamin = b.kelamin === "Laki-laki" ? "1" : "2";
  return `${lahir}${tmt}${kelamin}${String(b.urut).padStart(3, "0")}`;
}

function tulisCsv(jalur: string, kepala: string[], baris: (string | number | null)[][]) {
  // Bentuknya sama persis dengan berkas yang diunduh dari aplikasi (lib/csv): BOM, petunjuk `sep=;`,
  // dan akhiran CRLF — supaya berkas peragaan dibuka di Excel seperti berkas sungguhan.
  writeFileSync(jalur, keBerkasCsv([kepala, ...baris]), "utf8");
}

/* ── penyusunan dan pemeriksaan ── */

interface Terhitung extends Baris {
  nip: string;
  mkg: { tahun: number; bulan: number; gaji: number };
  tmtKgbTerakhir: Date;
  tmtKgbBerikutnya: Date;
  tmtGolongan: Date;
  langkahBulan: number;
}

function hitung(b: Baris): Terhitung {
  const nip = nipDari(b);
  const cekNip = periksaNip(nip, HARI_PERAGAAN.getFullYear());
  if (!cekNip.ok) throw new Error(`NIP ${b.nama} tertolak: ${cekNip.galat.pesan}`);

  const mkg = mkgTerdekat(b.gol, b.mkgTahun);
  const langkahBulan = bulanKeKgbBerikutnya(b.gol, mkg.tahun, mkg.bulan);
  const tmtKgbBerikutnya = KEADAAN[b.keadaan];
  // Dihitung mundur dari keadaan yang dikehendaki, memakai langkah tabel gaji yang sesungguhnya.
  const tmtKgbTerakhir = tambahBulan(tmtKgbBerikutnya, -langkahBulan);
  const tmtGolongan = new Date(b.tahunTmtGolongan, tmtKgbTerakhir.getMonth(), 1);

  if (tmtGolongan > tmtKgbTerakhir)
    throw new Error(`${b.nama}: TMT golongan ${iso(tmtGolongan)} melewati TMT KGB terakhir ${iso(tmtKgbTerakhir)}`);

  return { ...b, nip, mkg, tmtKgbTerakhir, tmtKgbBerikutnya, tmtGolongan, langkahBulan };
}

function keadaanHariIni(tmt: Date): string {
  if (tmt <= HARI_PERAGAAN) return "TERLAMBAT (TMT sudah lewat)";
  const buka = hitungUnlockDate(tmt);
  const batas = hitungDeadlineSDM(tmt);
  if (HARI_PERAGAAN < buka) return `belum dibuka, input buka ${formatTanggalId(buka, { day: "numeric", month: "short" })}`;
  if (HARI_PERAGAAN > batas) return `BERPOTENSI RAPELAN (batas ${formatTanggalId(batas, { day: "numeric", month: "short" })} lewat)`;
  return `dapat diinput, batas ${formatTanggalId(batas, { day: "numeric", month: "short" })}`;
}

/** Unit kerja ditulis lengkap, bukan dikosongkan: yang menonton peragaan harus melihat satkernya. */
const NAMA_KANWIL = SATKER.find((s) => s.jenis === "kanwil")!.nama;

const AKAR = join(__dirname, "..", "docs", "demo");

const uptHitung = UPT.map(hitung);
const kanwilHitung = KANWIL.map(hitung);

const semuaNip = [...uptHitung, ...kanwilHitung].map((r) => r.nip);
if (new Set(semuaNip).size !== semuaNip.length) throw new Error("ada NIP kembar antar berkas");

/* ── berkas 1: unggahan kolektif Admin UPT ── */
tulisCsv(
  join(AKAR, "demo-pegawai-admin-upt.csv"),
  ["nip", "nama", "jabatan", "jenisJabatan", "eselon", "golonganRuang", "tmtGolongan", "mkgTahun", "mkgBulan", "tmtKgbTerakhir", "tempatLahir", "tanggalLahir", "jenisKelamin", "pendidikanTerakhir"],
  uptHitung.map((r) => [
    r.nip, r.nama, r.jabatan, r.jenisJabatan, r.eselon, r.gol, iso(r.tmtGolongan),
    r.mkg.tahun, r.mkg.bulan, iso(r.tmtKgbTerakhir), r.tempatLahir, r.lahir, r.kelamin, r.pendidikan,
  ]),
);

/* ── berkas 2: impor Data Pegawai oleh Kanwil ── */
tulisCsv(
  join(AKAR, "demo-pegawai-kanwil.csv"),
  ["nip", "nama", "jabatan", "unitKerja", "pangkat", "golonganRuang", "tmtGolongan", "mkgTahun", "mkgBulan", "gajiPokok", "tmtKgbTerakhir", "tmtKgbBerikutnya", "tempatLahir", "tanggalLahir", "jenisKelamin", "pendidikanTerakhir", "jenisJabatan", "eselon", "statusHukdis", "keteranganHukdis", "nomorSkDasar", "tanggalSkDasar", "penetapSkDasar"],
  kanwilHitung.map((r) => [
    r.nip, r.nama, r.jabatan, r.unitKerja ?? NAMA_KANWIL, getPangkat(r.gol), r.gol, iso(r.tmtGolongan),
    r.mkg.tahun, r.mkg.bulan, "", iso(r.tmtKgbTerakhir), iso(r.tmtKgbBerikutnya),
    r.tempatLahir, r.lahir, r.kelamin, r.pendidikan, r.jenisJabatan, r.eselon, "false", "",
    `W.17-KP.04.04-${400 + r.urut}`, iso(r.tmtKgbTerakhir), "Kepala Kantor Wilayah",
  ]),
);

/* ── laporan pemeriksaan ── */
const tabel = (judul: string, baris: Terhitung[]) => {
  console.log(`\n${judul}`);
  console.log("  " + "nama".padEnd(38) + "gol   mkg      gaji pokok    TMT KGB terakhir  TMT berikutnya   keadaan 30 Sep 2026");
  for (const r of baris) {
    console.log(
      "  " +
        r.nama.padEnd(38) +
        r.gol.padEnd(6) +
        `${r.mkg.tahun}th ${r.mkg.bulan}bl`.padEnd(9) +
        ("Rp " + r.mkg.gaji.toLocaleString("id-ID")).padEnd(14) +
        iso(r.tmtKgbTerakhir).padEnd(18) +
        iso(r.tmtKgbBerikutnya).padEnd(17) +
        keadaanHariIni(r.tmtKgbBerikutnya),
    );
  }
};
tabel(`BERKAS 1 · Admin UPT (${uptHitung.length} pegawai) → docs/demo/demo-pegawai-admin-upt.csv`, uptHitung);
tabel(`BERKAS 2 · Kanwil (${kanwilHitung.length} pegawai) → docs/demo/demo-pegawai-kanwil.csv`, kanwilHitung);

const ringkas = (baris: Terhitung[]) => {
  const peta = new Map<string, number>();
  for (const r of baris) {
    const k = keadaanHariIni(r.tmtKgbBerikutnya).split(" (")[0].split(", ")[0];
    peta.set(k, (peta.get(k) ?? 0) + 1);
  }
  return [...peta].map(([k, v]) => `${v} ${k}`).join(" · ");
};
console.log(`\nRingkasan UPT   : ${ringkas(uptHitung)}`);
console.log(`Ringkasan Kanwil: ${ringkas(kanwilHitung)}`);
console.log(`\nSemua NIP lolos pemeriksaan struktur lib/nipPns.ts. Nomor urut 9xx menandai data peragaan.`);
