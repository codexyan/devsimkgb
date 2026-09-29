// Jam layanan Tim SDM Kanwil Ditjenpas Kalimantan Selatan (WITA), sama dengan portal SDM Pas Kalsel.
// Dipakai kaki halaman dan penanda jam layanan di halaman publik.

import { ZONA_WITA } from "./waktu";

export interface BarisJamLayanan {
  hari: string;
  jam: string;
}

export const JAM_LAYANAN: BarisJamLayanan[] = [
  { hari: "Senin–Kamis", jam: "07.30–16.00" },
  { hari: "Jumat", jam: "07.30–16.30" },
  { hari: "Sabtu, Minggu, libur", jam: "Tutup" },
];

// Menit sejak tengah malam per hari (0 = Minggu). null berarti tutup sepanjang hari.
const RENTANG: ({ mulai: number; selesai: number } | null)[] = [
  null,
  { mulai: 450, selesai: 960 },
  { mulai: 450, selesai: 960 },
  { mulai: 450, selesai: 960 },
  { mulai: 450, selesai: 960 },
  { mulai: 450, selesai: 990 },
  null,
];

const HARI = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatWita = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_WITA,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const jam = (menit: number) =>
  `${String(Math.floor(menit / 60)).padStart(2, "0")}.${String(menit % 60).padStart(2, "0")}`;

export interface StatusJamLayanan {
  buka: boolean;
  /** Jam layanan hari ini, misalnya "07.30–16.00 WITA"; null pada hari tutup. */
  jadwalHariIni: string | null;
}

/** Status layanan menurut jam WITA, tidak bergantung zona waktu perangkat. Hari libur nasional tidak dicek. */
export function statusJamLayanan(sekarang: Date = new Date()): StatusJamLayanan {
  const bagian = formatWita.formatToParts(sekarang);
  const ambil = (jenis: Intl.DateTimeFormatPartTypes) => bagian.find((b) => b.type === jenis)?.value ?? "";
  const rentang = RENTANG[HARI.indexOf(ambil("weekday"))] ?? null;
  if (!rentang) return { buka: false, jadwalHariIni: null };
  const menit = Number(ambil("hour")) * 60 + Number(ambil("minute"));
  return {
    buka: menit >= rentang.mulai && menit < rentang.selesai,
    jadwalHariIni: `${jam(rentang.mulai)}–${jam(rentang.selesai)} WITA`,
  };
}
