export const GOLONGAN_PANGKAT: Record<string, string> = {
  "I/a": "Juru Muda",
  "I/b": "Juru Muda Tingkat I",
  "I/c": "Juru",
  "I/d": "Juru Tingkat I",
  "II/a": "Pengatur Muda",
  "II/b": "Pengatur Muda Tingkat I",
  "II/c": "Pengatur",
  "II/d": "Pengatur Tingkat I",
  "III/a": "Penata Muda",
  "III/b": "Penata Muda Tingkat I",
  "III/c": "Penata",
  "III/d": "Penata Tingkat I",
  "IV/a": "Pembina",
  "IV/b": "Pembina Tingkat I",
  "IV/c": "Pembina Utama Muda",
  "IV/d": "Pembina Utama Madya",
  "IV/e": "Pembina Utama",
};

// Tabel Gaji PP No. 5 Tahun 2024
// Format: { [golongan]: { [mkg]: gaji } }
// MKG dalam format "tahun_bulan" misal "0_0", "2_0", "4_0"
export const TABEL_GAJI: Record<string, Record<string, number>> = {
  "I/a": {
    "0_0": 1685700,
    "2_0": 1738800,
    "4_0": 1793500,
    "6_0": 1850000,
    "8_0": 1908300,
    "10_0": 1968400,
    "12_0": 2030400,
    "14_0": 2094300,
    "16_0": 2160300,
    "18_0": 2228300,
    "20_0": 2298500,
    "22_0": 2370900,
    "24_0": 2445500,
    "26_0": 2522600,
  },
  "I/b": {
    "3_0": 1840800,
    "5_0": 1898800,
    "7_0": 1958600,
    "9_0": 2020300,
    "11_0": 2083900,
    "13_0": 2149600,
    "15_0": 2217300,
    "17_0": 2287100,
    "19_0": 2359100,
    "21_0": 2433400,
    "23_0": 2510100,
    "25_0": 2589100,
    "27_0": 2670700,
  },
  "I/c": {
    "3_0": 1918700,
    "5_0": 1979100,
    "7_0": 2041500,
    "9_0": 2105800,
    "11_0": 2172100,
    "13_0": 2240500,
    "15_0": 2311100,
    "17_0": 2383900,
    "19_0": 2458900,
    "21_0": 2536400,
    "23_0": 2616300,
    "25_0": 2698700,
    "27_0": 2783700,
  },
  "I/d": {
    "3_0": 1999900,
    "5_0": 2062900,
    "7_0": 2127800,
    "9_0": 2194800,
    "11_0": 2264000,
    "13_0": 2335300,
    "15_0": 2408800,
    "17_0": 2484700,
    "19_0": 2562900,
    "21_0": 2643700,
    "23_0": 2726900,
    "25_0": 2812800,
    "27_0": 2901400,
  },
  "II/a": {
    "0_0": 2184000,
    "2_0": 2218400,
    "4_0": 2360300,
    "6_0": 2434600,
    "8_0": 2511300,
    "10_0": 2590400,
    "12_0": 2672000,
    "14_0": 2756200,
    "16_0": 2843000,
    "18_0": 2932500,
    "20_0": 3024800,
    "22_0": 3120100,
    "24_0": 3218400,
    "26_0": 3319800,
    "28_0": 3424300,
    "30_0": 3532200,
    "32_0": 3643400,
  },
  "II/b": {
    "3_0": 2288200,
    "5_0": 2385000,
    "7_0": 2460100,
    "9_0": 2617500,
    "11_0": 2700000,
    "13_0": 2785000,
    "15_0": 2872700,
    "17_0": 2963200,
    "19_0": 3056500,
    "21_0": 3152800,
    "23_0": 3252100,
    "25_0": 3354500,
    "27_0": 3460200,
    "29_0": 3569200,
    "31_0": 3681600,
    "33_0": 3797500,
  },
  "II/c": {
    "3_0": 2485900,
    "5_0": 2564200,
    "7_0": 2645000,
    "9_0": 2728300,
    "11_0": 2814200,
    "13_0": 2902800,
    "15_0": 2994300,
    "17_0": 3088600,
    "19_0": 3185800,
    "21_0": 3286200,
    "23_0": 3389700,
    "25_0": 3496400,
    "27_0": 3606500,
    "29_0": 3720100,
    "31_0": 3837300,
    "33_0": 3958200,
  },
  "II/d": {
    "3_0": 2591100,
    "5_0": 2672700,
    "7_0": 2756800,
    "9_0": 2843700,
    "11_0": 2933200,
    "13_0": 3025600,
    "15_0": 3120900,
    "17_0": 3219200,
    "19_0": 3320600,
    "21_0": 3425200,
    "23_0": 3533100,
    "25_0": 3644300,
    "27_0": 3759100,
    "29_0": 3877500,
    "31_0": 3999500,
    "33_0": 4125600,
  },
  "III/a": {
    "0_0": 2785700,
    "2_0": 2873500,
    "4_0": 2964000,
    "6_0": 3057300,
    "8_0": 3153600,
    "10_0": 3252900,
    "12_0": 3355400,
    "14_0": 3461100,
    "16_0": 3570100,
    "18_0": 3682500,
    "20_0": 3798500,
    "22_0": 3918100,
    "24_0": 4041500,
    "26_0": 4168800,
    "28_0": 4300100,
    "30_0": 4435500,
    "32_0": 4575200,
  },
  "III/b": {
    "0_0": 2903600,
    "2_0": 2995000,
    "4_0": 3089300,
    "6_0": 3186600,
    "8_0": 3287000,
    "10_0": 3390500,
    "12_0": 3497300,
    "14_0": 3607500,
    "16_0": 3721100,
    "18_0": 3838300,
    "20_0": 3959200,
    "22_0": 4083900,
    "24_0": 4212500,
    "26_0": 4345100,
    "28_0": 4482000,
    "30_0": 4623200,
    "32_0": 4768800,
  },
  "III/c": {
    "0_0": 3026400,
    "2_0": 3121100,
    "4_0": 3220000,
    "6_0": 3321400,
    "8_0": 3426000,
    "10_0": 3533900,
    "12_0": 3645200,
    "14_0": 3760100,
    "16_0": 3878500,
    "18_0": 4000600,
    "20_0": 4126600,
    "22_0": 4256600,
    "24_0": 4390700,
    "26_0": 4528900,
    "28_0": 4671600,
    "30_0": 4818700,
    "32_0": 4970500,
  },
  "III/d": {
    "0_0": 3154400,
    "2_0": 3253700,
    "4_0": 3356200,
    "6_0": 3461900,
    "8_0": 3571000,
    "10_0": 3683400,
    "12_0": 3799400,
    "14_0": 3919100,
    "16_0": 4042500,
    "18_0": 4169900,
    "20_0": 4301200,
    "22_0": 4436700,
    "24_0": 4576400,
    "26_0": 4720500,
    "28_0": 4869200,
    "30_0": 5022500,
    "32_0": 5180700,
  },
  "IV/a": {
    "0_0": 3287800,
    "2_0": 3391400,
    "4_0": 3498200,
    "6_0": 3608400,
    "8_0": 3722000,
    "10_0": 3839200,
    "12_0": 3960200,
    "14_0": 4084900,
    "16_0": 4213500,
    "18_0": 4346200,
    "20_0": 4483100,
    "22_0": 4624300,
    "24_0": 4770000,
    "26_0": 4920200,
    "28_0": 5075200,
    "30_0": 5235000,
    "32_0": 5399900,
  },
  "IV/b": {
    "0_0": 3426900,
    "2_0": 3534800,
    "4_0": 3646200,
    "6_0": 3761000,
    "8_0": 3879500,
    "10_0": 4001600,
    "12_0": 4127700,
    "14_0": 4257700,
    "16_0": 4391800,
    "18_0": 4530100,
    "20_0": 4672800,
    "22_0": 4819900,
    "24_0": 4971700,
    "26_0": 5128300,
    "28_0": 5289800,
    "30_0": 5456400,
    "32_0": 5628300,
  },
  "IV/c": {
    "0_0": 3571900,
    "2_0": 3684400,
    "4_0": 3800400,
    "6_0": 3920100,
    "8_0": 4043600,
    "10_0": 4170900,
    "12_0": 4302300,
    "14_0": 4437800,
    "16_0": 4577500,
    "18_0": 4721700,
    "20_0": 4870400,
    "22_0": 5023800,
    "24_0": 5182000,
    "26_0": 5345200,
    "28_0": 5513600,
    "30_0": 5687200,
    "32_0": 5866400,
  },
  "IV/d": {
    "0_0": 3723000,
    "2_0": 3840200,
    "4_0": 3961200,
    "6_0": 4086000,
    "8_0": 4214600,
    "10_0": 4347300,
    "12_0": 4484300,
    "14_0": 4625500,
    "16_0": 4771200,
    "18_0": 4921400,
    "20_0": 5076400,
    "22_0": 5236300,
    "24_0": 5401200,
    "26_0": 5571400,
    "28_0": 5746800,
    "30_0": 5927800,
    "32_0": 6114500,
  },
  "IV/e": {
    "0_0": 3880400,
    "2_0": 4002700,
    "4_0": 4128700,
    "6_0": 4258700,
    "8_0": 4392900,
    "10_0": 4531200,
    "12_0": 4673900,
    "14_0": 4821100,
    "16_0": 4973000,
    "18_0": 5129600,
    "20_0": 5291200,
    "22_0": 5457800,
    "24_0": 5629700,
    "26_0": 5807000,
    "28_0": 5989900,
    "30_0": 6178600,
    "32_0": 6373200,
  },
};

// Fungsi cari gaji pokok terdekat berdasarkan golongan + MKG
export function getGajiPokok(
  golongan: string,
  mkgTahun: number,
  mkgBulan: number,
): number {
  const tabel = TABEL_GAJI[golongan];
  if (!tabel) return 0;

  // Cari MKG total dalam bulan
  const mkgTotal = mkgTahun * 12 + mkgBulan;

  // Cari entry terdekat yang <= MKG saat ini
  let gajiTerpilih = 0;
  let mkgTerpilih = -1;

  for (const key of Object.keys(tabel)) {
    const [th, bl] = key.split("_").map(Number);
    const totalBulan = th * 12 + bl;
    if (totalBulan <= mkgTotal && totalBulan > mkgTerpilih) {
      mkgTerpilih = totalBulan;
      gajiTerpilih = tabel[key];
    }
  }

  return gajiTerpilih;
}

// Fungsi otomatis isi pangkat dari golongan
export function getPangkat(golongan: string): string {
  return GOLONGAN_PANGKAT[golongan] || "";
}

// Potongan MKG saat kenaikan pangkat antar jenjang golongan (dalam tahun)
// III → IV tidak ada potongan MKG
const POTONGAN_MKG_KENAIKAN_PANGKAT: Array<{
  dari: RegExp;
  ke: string;
  potong: number;
}> = [
  { dari: /^I\//, ke: "II/a", potong: 6 },
  { dari: /^II\//, ke: "III/a", potong: 5 },
];

/**
 * Hitung MKG setelah kenaikan pangkat.
 * Mengembalikan { mkgTahun, mkgBulan } yang sudah disesuaikan,
 * atau null jika tidak ada aturan potongan (golongan ke golongan biasa/KGB).
 */
export function hitungMKGKenaikanPangkat(
  golonganLama: string,
  golonganBaru: string,
  mkgTahunLama: number,
  mkgBulanLama: number,
): { mkgTahun: number; mkgBulan: number } | null {
  const aturan = POTONGAN_MKG_KENAIKAN_PANGKAT.find(
    (a) => a.dari.test(golonganLama) && a.ke === golonganBaru,
  );
  if (!aturan) return null;
  return {
    mkgTahun: Math.max(0, mkgTahunLama - aturan.potong),
    mkgBulan: mkgBulanLama,
  };
}

// Daftar MKG yang valid per golongan
export function getMKGOptions(
  golongan: string,
): { tahun: number; bulan: number; gaji: number }[] {
  const tabel = TABEL_GAJI[golongan];
  if (!tabel) return [];

  return Object.entries(tabel)
    .map(([key, gaji]) => {
      const [tahun, bulan] = key.split("_").map(Number);
      return { tahun, bulan, gaji };
    })
    .sort((a, b) => a.tahun * 12 + a.bulan - (b.tahun * 12 + b.bulan));
}

export interface HasilKalkulasiKGB {
  mkgTahunBaru: number;
  mkgBulanBaru: number;
  gajiPokokBaru: number;
  tmtKgbBaru: Date;
  tmtKgbBerikutnya: Date;
  deadlineSDM: Date;
  /** Tanggal sistem membuka kunci proses KGB = tanggal 1 bulan ke-2 sebelum TMT */
  unlockDate: Date;
  /** true jika hari ini belum mencapai unlockDate, KGB belum boleh diproses */
  isLocked: boolean;
  flagRapelan: boolean;
}

/**
 * Hitung tanggal unlock: tanggal 1 bulan ke-2 sebelum TMT.
 * Contoh: TMT 1 April 2026 → unlock 1 Februari 2026
 */
export function hitungUnlockDate(tmtKgbBaru: Date): Date {
  // getMonth() sudah 0-indexed, kurang 2 → bulan ke-2 sebelum TMT
  return new Date(tmtKgbBaru.getFullYear(), tmtKgbBaru.getMonth() - 2, 1);
}

export function kalkulasiKGB(pegawai: {
  golonganRuang: string;
  mkgTahun: number;
  mkgBulan: number;
  tmtKgbBerikutnya: Date | string;
  tmtKgbTerakhir?: Date | string | null;
}): HasilKalkulasiKGB {
  const tmtKgbBaru = new Date(pegawai.tmtKgbBerikutnya);

  // MKG baru: hitung dari selisih tahun aktual antara TMT terakhir dan TMT baru.
  // PP No. 53/2010 Penjelasan Pasal 7 ayat (3): masa penundaan KGB dihitung penuh
  // untuk KGB berikutnya, sehingga jika ada penundaan 1 tahun, MKG bertambah 3 tahun.
  let tambahTahun = 2; // default siklus normal
  if (pegawai.tmtKgbTerakhir) {
    const tmtTerakhir = new Date(pegawai.tmtKgbTerakhir);
    const yr = tmtKgbBaru.getFullYear() - tmtTerakhir.getFullYear();
    const mo = tmtKgbBaru.getMonth() - tmtTerakhir.getMonth();
    tambahTahun = Math.max(2, yr + (mo < 0 ? -1 : 0));
  }

  const mkgTahunBaru = pegawai.mkgTahun + tambahTahun;
  const mkgBulanBaru = pegawai.mkgBulan;

  const gajiPokokBaru = getGajiPokok(pegawai.golonganRuang, mkgTahunBaru, mkgBulanBaru);

  const tmtKgbBerikutnya = new Date(tmtKgbBaru);
  tmtKgbBerikutnya.setFullYear(tmtKgbBerikutnya.getFullYear() + 2);

  const today = new Date();

  // Deadline SDM = akhir bulan ke-2 sebelum TMT (misal TMT Juni → deadline 30 April)
  const deadlineSDM = new Date(tmtKgbBaru.getFullYear(), tmtKgbBaru.getMonth() - 1, 0);
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const flagRapelan = todayDate > deadlineSDM;

  // Unlock date = tanggal 1 bulan ke-2 sebelum TMT (awal jendela proses, 1 bulan penuh)
  const unlockDate = hitungUnlockDate(tmtKgbBaru);
  const isLocked = today < unlockDate;

  return {
    mkgTahunBaru,
    mkgBulanBaru,
    gajiPokokBaru,
    tmtKgbBaru,
    tmtKgbBerikutnya,
    deadlineSDM,
    unlockDate,
    isLocked,
    flagRapelan,
  };
}
