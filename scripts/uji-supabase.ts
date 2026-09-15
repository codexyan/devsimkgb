import "dotenv/config";
import { GalatSupabase } from "../lib/db/supabase/rest";
import { supabase } from "../lib/db/supabase/tables";
import { matches } from "../lib/sheets/table";
import { makeRiwayatKGB, type NotifikasiRow, type PegawaiRow } from "../lib/sheets/tables";

/* ───────────────────────────────────────────────────────────────────────────
   Uji lapisan data Supabase terhadap proyek Supabase sungguhan, sebelum data disalin.
   Hasil filter PostgREST dibandingkan dengan pencocokan JavaScript lapisan Google Sheets
   pada data yang sama. Semua baris uji ditandai "uji-supabase" dan dihapus lagi di akhir.

   Jalankan: npx tsx scripts/uji-supabase.ts
   Syarat  : migrasi skema sudah diterapkan; SUPABASE_URL dan SUPABASE_SECRET_KEY di .env.
   ─────────────────────────────────────────────────────────────────────────── */

const PENANDA = "uji-supabase";
/** Lebih dari satu halaman respons (1000 baris), untuk menguji pembacaan bertahap. */
const JUMLAH = 1205;
const HARI = 86_400_000;
const T0 = new Date("2026-01-01T00:00:00.000Z").getTime();

let gagal = 0;
function periksa(nama: string, ok: boolean, rincian = "") {
  console.log(`${ok ? "✓" : "✗"} ${nama}${ok || !rincian ? "" : ` — ${rincian}`}`);
  if (!ok) gagal++;
}

const JUDUL = ["Budi Santoso", "ANI", "50% diskon", "a_b", "axb", null, 'Kata "kutip", (kurung) \\ garis'];
const PRIORITAS = ["normal", "info", "warning", "critical"];
const KATEGORI = ["kgb", "hukdis", "sistem"];

function barisUji(i: number): NotifikasiRow {
  return {
    id: `${PENANDA}-${String(i).padStart(5, "0")}`,
    judul: JUDUL[i % JUDUL.length] as string,
    pesan: `pesan ${i}`,
    tipe: PENANDA,
    referenceId: i % 3 === 0 ? null : `ref-${i % 5}`,
    dibaca: (i % 4 === 0 ? null : i % 2 === 0) as boolean,
    createdAt: i % 6 === 0 ? null : new Date(T0 + (i % 50) * HARI),
    prioritas: PRIORITAS[i % PRIORITAS.length],
    linkHref: null,
    kategori: i % 7 === 0 ? null : KATEGORI[i % KATEGORI.length],
  };
}

const WHERE: Record<string, unknown>[] = [
  { judul: "ANI" },
  { judul: null },
  { judul: 'Kata "kutip", (kurung) \\ garis' },
  { judul: { contains: "an" } },
  { judul: { contains: "50%" } },
  { judul: { contains: "a_b" } },
  { judul: { contains: '"kutip", (k' } },
  { judul: { startsWith: "bu" } },
  { dibaca: true },
  { dibaca: false },
  { dibaca: null },
  { dibaca: { not: true } },
  { prioritas: { in: ["info", "warning"] } },
  { prioritas: { notIn: ["info"] } },
  { referenceId: { in: ["ref-1", null] } },
  { referenceId: { notIn: ["ref-1"] } },
  { referenceId: { notIn: ["ref-1", null] } },
  { kategori: { not: "kgb" } },
  { kategori: { not: null } },
  { createdAt: { lt: new Date(T0 + 10 * HARI) } },
  { createdAt: { gte: new Date(T0 + 40 * HARI).toISOString() } },
  { OR: [{ prioritas: "critical" }, { kategori: null }] },
  { AND: [{ dibaca: { not: false } }, { judul: { contains: "i" } }] },
  { OR: [{ referenceId: null }, { AND: [{ prioritas: "info" }, { createdAt: null }] }] },
];

async function ujiNotifikasi() {
  const repo = supabase.notifikasi;
  const baris = Array.from({ length: JUMLAH }, (_, i) => barisUji(i));

  await repo.createMany(baris);
  const semua = await repo.findMany({ where: { tipe: PENANDA } });
  periksa(`createMany lalu findMany membaca ${JUMLAH} baris lintas halaman`, semua.length === JUMLAH, `terbaca ${semua.length}`);
  periksa("urutan bawaan mengikuti urutan data dimasukkan", semua.every((r, i) => r.id === baris[i].id));

  for (const w of WHERE) {
    const where = { tipe: PENANDA, ...w };
    const harapan = semua.filter((r) => matches(r as unknown as Record<string, unknown>, where));
    const hasil = await repo.findMany({ where });
    periksa(
      `findMany ${JSON.stringify(w)}`,
      hasil.map((r) => r.id).join() === harapan.map((r) => r.id).join(),
      `${hasil.length} baris, seharusnya ${harapan.length}`,
    );
    const jumlah = await repo.count(where);
    periksa(`count ${JSON.stringify(w)}`, jumlah === harapan.length, `${jumlah}, seharusnya ${harapan.length}`);
  }

  const pertamaWarning = baris.find((r) => r.prioritas === "warning");
  const unik = await repo.findUnique({ tipe: PENANDA, prioritas: "warning" });
  periksa("findUnique mengembalikan record pertama yang cocok", unik?.id === pertamaWarning?.id, `dapat ${unik?.id}`);

  // Kunci bernilai undefined mengosongkan kolom, sama seperti update di spreadsheet.
  const target = baris[1];
  const diubah = await repo.update({ id: target.id }, { judul: "diubah", kategori: undefined });
  periksa("update mengembalikan record yang sudah diubah", diubah?.judul === "diubah" && diubah?.kategori === null, JSON.stringify(diubah));
  const tersimpan = await repo.findUnique({ id: target.id });
  periksa(
    "update tersimpan tanpa mengubah kolom lain",
    tersimpan?.judul === "diubah" && tersimpan?.kategori === null && tersimpan?.pesan === target.pesan,
    JSON.stringify(tersimpan),
  );
  periksa("update record yang tidak ada mengembalikan null", (await repo.update({ id: `${PENANDA}-tidak-ada` }, { judul: "x" })) === null);

  const jumlahInfo = semua.filter((r) => r.prioritas === "info").length;
  const terubah = await repo.updateMany({ tipe: PENANDA, prioritas: "info" }, { dibaca: true });
  periksa("updateMany mengembalikan jumlah baris yang diubah", terubah === jumlahInfo, `${terubah}, seharusnya ${jumlahInfo}`);
  periksa("updateMany tersimpan", (await repo.count({ tipe: PENANDA, prioritas: "info", dibaca: true })) === jumlahInfo);

  periksa("delete menghapus satu record", (await repo.delete({ id: target.id })) === true);
  periksa("delete kedua kalinya mengembalikan false", (await repo.delete({ id: target.id })) === false);

  const dibuat = await repo.create({ ...barisUji(JUMLAH + 1), createdAt: new Date(T0) });
  periksa("create mengembalikan Date untuk kolom waktu", dibuat.createdAt instanceof Date && dibuat.createdAt.getTime() === T0);
}

async function ujiBatasan() {
  const pegawai = { id: `${PENANDA}-pegawai`, nip: `${PENANDA}-nip`, nama: "Pegawai Uji", aktif: true } as unknown as PegawaiRow;
  await supabase.pegawai.create(pegawai);

  let unikDitolak = false;
  try {
    await supabase.pegawai.create({ ...pegawai, id: `${PENANDA}-pegawai-2` });
  } catch (e) {
    unikDitolak = e instanceof GalatSupabase && e.kode === "23505";
  }
  periksa("NIP ganda ditolak (unique)", unikDitolak);

  let rujukanDitolak = false;
  try {
    await supabase.riwayatKGB.create(makeRiwayatKGB({ id: `${PENANDA}-kgb-yatim`, pegawaiId: `${PENANDA}-tidak-ada`, createdBy: PENANDA }));
  } catch (e) {
    rujukanDitolak = e instanceof GalatSupabase && e.kode === "23503";
  }
  periksa("KGB tanpa pegawai ditolak (foreign key)", rujukanDitolak);

  await supabase.riwayatKGB.create(makeRiwayatKGB({ id: `${PENANDA}-kgb`, pegawaiId: pegawai.id, createdBy: PENANDA }));
  await supabase.pegawai.delete({ id: pegawai.id });
  periksa("menghapus pegawai ikut menghapus riwayat KGB-nya", (await supabase.riwayatKGB.count({ id: `${PENANDA}-kgb` })) === 0);
}

async function bersihkan() {
  await supabase.notifikasi.deleteMany({ tipe: PENANDA });
  await supabase.pegawai.deleteMany({ nip: { startsWith: PENANDA } });
}

async function main() {
  await bersihkan();
  try {
    await ujiNotifikasi();
    await ujiBatasan();
  } finally {
    await bersihkan();
    const sisa = (await supabase.notifikasi.count({ tipe: PENANDA })) + (await supabase.pegawai.count({ nip: { startsWith: PENANDA } }));
    periksa("baris uji sudah dibersihkan", sisa === 0, `${sisa} baris tersisa`);
  }
  console.log(gagal === 0 ? "\n✓ Semua uji lulus." : `\n✗ ${gagal} uji gagal.`);
  if (gagal > 0) process.exit(1);
}

main().catch((e) => {
  console.error("\n✗ Gagal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
