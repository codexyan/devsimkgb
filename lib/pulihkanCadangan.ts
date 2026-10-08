// Membaca berkas cadangan otomatis (lib/cadanganOtomatis.ts) dan menyusun SQL untuk mengembalikan sebagian barisnya
// ke Supabase (ADR-084). Dipakai scripts/pulihkan-cadangan.ts; SQL-nya dijalankan sendiri oleh pemilik di Supabase
// SQL Editor, jadi tidak ada yang berubah tanpa dibaca lebih dulu.

type Baris = Record<string, unknown>;

export interface KepalaCadangan {
  aplikasi: string;
  versi: number;
  bentuk: "postgres" | "aplikasi";
  dibuat: string;
  tabel: string[];
}

export interface IsiCadangan {
  kepala: KepalaCadangan;
  baris: Map<string, Baris[]>;
  /** true bila baris penutup ada dan jumlahnya cocok; cadangan yang terputus tidak utuh. */
  utuh: boolean;
}

export function bacaCadangan(teks: string): IsiCadangan {
  const baris = new Map<string, Baris[]>();
  let kepala: KepalaCadangan | null = null;
  let penutup: { jumlah: Record<string, number> } | null = null;
  for (const satu of teks.split("\n")) {
    if (!satu.trim()) continue;
    const isi = JSON.parse(satu) as { jenis?: string; t?: string; r?: Baris } & Partial<KepalaCadangan> & { jumlah?: Record<string, number> };
    if (isi.jenis === "kepala") kepala = isi as KepalaCadangan;
    else if (isi.jenis === "akhir") penutup = { jumlah: isi.jumlah ?? {} };
    else if (isi.t && isi.r) {
      const daftar = baris.get(isi.t) ?? [];
      daftar.push(isi.r);
      baris.set(isi.t, daftar);
    }
  }
  if (!kepala || kepala.aplikasi !== "SIM-KGB") throw new Error("Bukan berkas cadangan otomatis SIM-KGB");
  const utuh =
    penutup !== null && Object.entries(penutup.jumlah).every(([t, n]) => (baris.get(t)?.length ?? 0) === n);
  return { kepala, baris, utuh };
}

/** Baris yang id-nya disebut, dan/atau yang memuat teks tertentu di salah satu nilainya (tanpa beda huruf besar). */
export function saringBaris(daftar: readonly Baris[], saring: { id?: readonly string[]; cari?: string }): Baris[] {
  const id = saring.id?.length ? new Set(saring.id) : null;
  const cari = saring.cari?.trim().toLowerCase() || null;
  return daftar.filter(
    (b) =>
      (!id || id.has(String(b.id))) &&
      (!cari || Object.values(b).some((v) => v !== null && v !== undefined && String(v).toLowerCase().includes(cari))),
  );
}

/** Kolom yang tidak ditimpa saat baris sudah ada: kuncinya, dan urutan baris dimasukkan. */
const KOLOM_TETAP = new Set(["id", "urutan_sisip"]);

/**
 * SQL pengembalian baris ke satu tabel. Baris dibentuk ulang oleh Postgres dari JSON (jsonb_populate_recordset),
 * sehingga jenis kolom mengikuti tabelnya. Bawaannya baris yang id-nya sudah ada dilewati; dengan `timpa`, isinya
 * diganti isi cadangan. Urutan baris dimasukkan (urutan_sisip) dipertahankan.
 */
export function sqlPulihkan(tabel: string, daftar: readonly Baris[], opsi: { timpa?: boolean } = {}): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(tabel)) throw new Error(`Nama tabel tidak sah: ${tabel}`);
  if (daftar.length === 0) return `-- public.${tabel}: tidak ada baris yang cocok.\n`;
  const json = JSON.stringify(daftar);
  let tanda = "cadangan";
  while (json.includes(`$${tanda}$`)) tanda += "_";
  const kolom = [...new Set(daftar.flatMap((b) => Object.keys(b)))].filter((k) => !KOLOM_TETAP.has(k));
  for (const k of kolom) if (!/^[a-z_][a-z0-9_]*$/.test(k)) throw new Error(`Nama kolom tidak sah: ${k}`);
  const konflik = opsi.timpa
    ? `on conflict (id) do update set\n  ${kolom.map((k) => `${k} = excluded.${k}`).join(",\n  ")}`
    : "on conflict (id) do nothing";
  // Penghitung urutan baris dimasukkan dimajukan melewati baris yang dikembalikan, supaya baris baru sesudahnya tetap
  // berada di urutan paling akhir walau tabelnya dipulihkan dari kosong. Tidak pernah dimundurkan.
  const urutan = daftar.some((b) => "urutan_sisip" in b)
    ? `select setval(pg_get_serial_sequence('public.${tabel}', 'urutan_sisip'), greatest(\n` +
      `  (select coalesce(max(urutan_sisip), 1) from public.${tabel}),\n` +
      `  (select coalesce(s.last_value, 1) from pg_sequences s\n` +
      `   where format('%I.%I', s.schemaname, s.sequencename) = pg_get_serial_sequence('public.${tabel}', 'urutan_sisip'))));\n`
    : "";
  return (
    `-- ${daftar.length} baris public.${tabel}${opsi.timpa ? " (menimpa baris yang sudah ada)" : " (baris yang sudah ada dilewati)"}\n` +
    `insert into public.${tabel} overriding system value\n` +
    `select * from jsonb_populate_recordset(null::public.${tabel}, $${tanda}$${json}$${tanda}$::jsonb)\n` +
    `${konflik};\n` +
    urutan
  );
}
