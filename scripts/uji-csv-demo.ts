/*
 * Uji berkas CSV peragaan dengan pemeriksa yang sesungguhnya dipakai aplikasi, bukan dengan
 * pembacaan sendiri: periksaImporUpt untuk unggahan Admin UPT dan bacaIsianPegawai untuk impor
 * Data Pegawai Kanwil. Berkasnya diurai memakai PapaParse, sama dengan yang dipakai layar unggah.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import { periksaImporUpt, ringkasImpor } from "@/lib/imporUsulanUpt";
import { bacaIsianPegawai } from "@/lib/dataPegawai";
import { formatTanggalId } from "@/lib/waktu";
import { buangPetunjukPemisah } from "@/lib/csv";

const AKAR = join(__dirname, "..", "docs", "demo");

function urai(nama: string): Record<string, string>[] {
  const isi = buangPetunjukPemisah(readFileSync(join(AKAR, nama), "utf8"));
  const hasil = Papa.parse<Record<string, string>>(isi, { header: true, skipEmptyLines: true });
  if (hasil.errors.length) throw new Error(`${nama}: ${JSON.stringify(hasil.errors[0])}`);
  return hasil.data;
}

let gagal = 0;

/* ── Berkas 1: unggahan kolektif Admin UPT ── */
const barisUpt = urai("demo-pegawai-admin-upt.csv");
const kosong = {
  pegawaiSatker: new Map(),
  satkerLain: new Map(),
  nipUsulan: new Set<string>(),
  pegawaiIdUsulan: new Set<string>(),
};
const hasilUpt = periksaImporUpt(barisUpt, kosong);
const ringkas = ringkasImpor(hasilUpt);
console.log(`BERKAS 1 · demo-pegawai-admin-upt.csv (${barisUpt.length} baris)`);
console.log(`  baru ${ringkas.baru} · perubahan ${ringkas.perubahan} · sama ${ringkas.sama} · ditolak ${ringkas.ditolak} · belum lengkap ${ringkas.belumLengkap}`);
for (const h of hasilUpt) {
  if (h.hasil === "ditolak") {
    console.log(`  ✗ baris ${h.baris} ${h.nama}: ${h.galat}`);
    gagal++;
  } else if (h.kurang.length) {
    // Kekurangan itu wajar untuk draf; hanya dilaporkan supaya tahu apa yang masih ditagih saat diajukan.
    console.log(`  · baris ${h.baris} ${h.nama}: masih perlu dilengkapi sebelum diajukan → ${h.kurang.join(", ")}`);
  }
}

/* ── Berkas 2: impor Data Pegawai Kanwil ── */
const barisKanwil = urai("demo-pegawai-kanwil.csv");
console.log(`\nBERKAS 2 · demo-pegawai-kanwil.csv (${barisKanwil.length} baris)`);
let sah = 0;
for (const [i, row] of barisKanwil.entries()) {
  const hasil = bacaIsianPegawai(row, { denganNip: true });
  if ("galat" in hasil) {
    console.log(`  ✗ baris ${i + 1} ${row.nama}: ${hasil.galat}`);
    gagal++;
    continue;
  }
  sah++;
  const d = hasil.data;
  if (i < 3)
    console.log(
      `  ✓ ${d.nama.padEnd(26)} ${d.golonganRuang.padEnd(6)} Rp ${d.gajiPokok.toLocaleString("id-ID").padEnd(10)} ` +
        `TMT berikutnya ${formatTanggalId(d.tmtKgbBerikutnya, { day: "numeric", month: "short", year: "numeric" })} · ${d.unitKerja}`,
    );
}
console.log(`  ${sah} dari ${barisKanwil.length} baris terbaca sah.`);

/* ── NIP kembar antar berkas ── */
const semua = [...barisUpt, ...barisKanwil].map((r) => r.nip);
if (new Set(semua).size !== semua.length) {
  console.log("\n✗ ada NIP yang muncul di kedua berkas");
  gagal++;
}

console.log(gagal === 0 ? "\nSEMUA BARIS LOLOS." : `\n${gagal} MASALAH DITEMUKAN.`);
process.exit(gagal === 0 ? 0 : 1);
