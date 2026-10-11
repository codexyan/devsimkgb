// Contoh record dan filter yang dipakai bersama uji pohon Kondisi (lib/db/kondisi.test.ts) dan terjemahannya ke
// SQLite (lib/db/d1/sql.test.ts): keduanya harus memberi hasil yang sama dengan pencocokan lapisan Sheets.

import type { Where } from "./repo";

type Rec = Record<string, unknown>;

/** Kolom aplikasi pada contoh: teks, teks, boolean, bilangan bulat, waktu. */
export const KOLOM_CONTOH = ["nama", "status", "aktif", "jumlah", "tmtKgbBaru"] as const;

export const T1 = new Date("2026-01-01T00:00:00.000Z");
export const T2 = new Date("2026-06-01T00:00:00.000Z");

export const RECORD_CONTOH: Rec[] = [
  { nama: "Budi Santoso", status: "a", aktif: true, jumlah: 5, tmtKgbBaru: T1 },
  { nama: "ANI", status: "b", aktif: false, jumlah: 3, tmtKgbBaru: T2 },
  { nama: "50% diskon", status: null, aktif: null, jumlah: null, tmtKgbBaru: null },
  { nama: "a_b", status: "a", aktif: true, jumlah: 1, tmtKgbBaru: T2 },
  { nama: "axb", status: "c", aktif: false, jumlah: 10, tmtKgbBaru: T1 },
  { nama: null, status: "b", aktif: true, jumlah: 5, tmtKgbBaru: null },
];

export const WHERE_CONTOH: Where[] = [
  {},
  { status: "a" },
  { status: null },
  { status: undefined },
  { status: ["a"] },
  { aktif: true },
  { aktif: false },
  { jumlah: 5 },
  { tmtKgbBaru: T1 },
  { tmtKgbBaru: "2026-06-01T00:00:00.000Z" },
  { tmtKgbBaru: new Date("tidak valid") },
  { status: { equals: "b" } },
  { status: { not: "a" } },
  { status: { not: null } },
  { status: { not: undefined } },
  { tmtKgbBaru: { not: T1 } },
  { status: { in: ["a", "b"] } },
  { status: { in: [] } },
  { status: { in: [null] } },
  { status: { in: ["a", null] } },
  { status: { in: "a" } },
  { status: { notIn: ["a"] } },
  { status: { notIn: [] } },
  { status: { notIn: [null] } },
  { status: { notIn: ["a", null] } },
  { nama: { contains: "an" } },
  { nama: { contains: "AN" } },
  { nama: { contains: "" } },
  { nama: { contains: "50%" } },
  { nama: { contains: "a_b" } },
  { nama: { startsWith: "bu" } },
  { nama: { contains: "an", mode: "insensitive" } },
  { jumlah: { lt: 5 } },
  { jumlah: { lte: 5 } },
  { jumlah: { gt: 3 } },
  { jumlah: { gte: 5 } },
  { jumlah: { lt: null } },
  { tmtKgbBaru: { lte: T1 } },
  { tmtKgbBaru: { gt: "2026-03-01T00:00:00.000Z" } },
  { status: "a", aktif: true },
  { status: { in: ["a", "b"], not: "b" } },
  { OR: [{ status: "a" }, { jumlah: { gt: 3 } }] },
  { OR: [] },
  { AND: [] },
  { OR: "x" },
  { AND: [{ status: { not: "a" } }, { nama: { contains: "i" } }] },
  { OR: [{ status: null }, { AND: [{ aktif: true }, { jumlah: { in: [1, 5] } }] }] },
  { status: { operatorAneh: 1 } },
  { tidakAda: "x" },
  { tidakAda: { not: "x" } },
  { tidakAda: undefined },
];
