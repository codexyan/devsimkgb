import "dotenv/config";
import { ALL_DEFS, sheets } from "../lib/sheets/tables";
import { newId } from "../lib/sheets/id";
import { sinkronkanHeader } from "../lib/sheets/sinkronHeader";
import { JENIS_HUKDIS_PP94, KODE_HUKDIS_PP53_SAJA } from "./jenis-hukdis-pp94";

/* ───────────────────────────────────────────────────────────────────────────
   Migrasi Tahap 1 (kepatuhan Kepmen M.IP-01.OT.01.01/2025):
     1. Tab Penandatangan dibuat; kolom baru RiwayatKGB & SuratKGB ditambahkan.
     2. Kepala Kanwil di KonfigurasiKanwil disalin menjadi penandatangan definitif.
     3. Jenis hukdis khusus PP 53/2010 dinonaktifkan; jenis PP 94/2021 dilengkapi.

   Simulasi (tidak menulis) : npx tsx scripts/migrasi-tahap1.ts
   Terapkan                 : npx tsx scripts/migrasi-tahap1.ts --terapkan

   Idempotent: aman dijalankan ulang. Jalankan SEBELUM kode Tahap 1 dideploy,
   karena kolom baru harus sudah ada di header agar nilainya terbaca.
   ─────────────────────────────────────────────────────────────────────────── */

const terapkan = process.argv.includes("--terapkan");
const oleh = "migrasi-tahap1";
// Kepmen delegasi ditetapkan 6 Januari 2025; surat sebelumnya diterbitkan Kanwil Kemenkumham.
const BERLAKU_AWAL = new Date("2025-01-06");
const akan = (sudah: string, belum: string) => (terapkan ? sudah : belum);

async function main() {
  console.log(
    terapkan
      ? "Mode TERAPKAN: perubahan ditulis ke spreadsheet.\n"
      : "Mode SIMULASI: tidak ada yang ditulis. Tambahkan --terapkan untuk menjalankan.\n",
  );

  // 1. Header tab
  const tabTahap1 = ["Penandatangan", "RiwayatKGB", "SuratKGB"];
  const hasilHeader = await sinkronkanHeader(ALL_DEFS.filter((def) => tabTahap1.includes(def.tab)), terapkan);
  for (const h of hasilHeader) {
    if (h.aksi === "buat_tab") console.log(`+ Tab ${h.tab} ${akan("dibuat", "akan dibuat")}`);
    else if (h.aksi === "isi_header") console.log(`~ Header ${h.tab} ${akan("diisi", "akan diisi")}`);
    else if (h.aksi === "tambah_kolom") console.log(`+ Kolom ${h.tab}: ${h.kolom.join(", ")} ${akan("ditambahkan", "akan ditambahkan")}`);
    else if (h.aksi === "cocok") console.log(`= Header ${h.tab} sudah sesuai`);
    else throw new Error(`Header ${h.tab} tidak cocok dengan definisi (${h.headerSheet.join(", ")}). Perbaiki manual dulu.`);
  }

  // 2. Penandatangan definitif dari KonfigurasiKanwil
  const tabPenandatanganBaru = hasilHeader.some((h) => h.tab === "Penandatangan" && h.aksi === "buat_tab");
  const daftar = tabPenandatanganBaru && !terapkan ? [] : await sheets.penandatangan.findMany();
  const konfig = (await sheets.konfigurasiKanwil.findUnique({ id: "default" })) as {
    namaKepala?: string | null;
    nipKepala?: string | null;
  } | null;
  if (daftar.length > 0) {
    console.log(`= Penandatangan sudah berisi ${daftar.length} data, tidak disalin ulang`);
  } else if (!konfig?.namaKepala || !konfig?.nipKepala) {
    console.log("! KonfigurasiKanwil tidak berisi Kepala Kanwil; tambahkan penandatangan di halaman Pengaturan");
  } else {
    const baris = {
      id: newId(),
      jenis: "definitif" as const,
      nama: String(konfig.namaKepala),
      nip: String(konfig.nipKepala).replace(/\s/g, ""),
      jabatan: "Kepala Kantor Wilayah",
      dasarPenunjukan: null,
      berlakuMulai: BERLAKU_AWAL,
      berlakuSampai: null,
      updatedAt: new Date(),
      updatedBy: oleh,
    };
    if (terapkan) await sheets.penandatangan.create(baris);
    console.log(
      `+ Penandatangan definitif ${baris.nama} (${baris.nip}) ${akan("ditambahkan", "akan ditambahkan")}, berlaku mulai 6 Januari 2025. Periksa tanggalnya di Pengaturan.`,
    );
  }

  // 3. Jenis hukdis
  const jenisAda = (await sheets.hukdisJenis.findMany()) as {
    id: string; kode: string; aktif: boolean | null; dasarHukum: string | null; urutan: number | null;
  }[];
  const byKode = new Map(jenisAda.map((j) => [j.kode, j] as const));
  let urutan = Math.max(0, ...jenisAda.map((j) => Number(j.urutan) || 0));

  for (const kode of KODE_HUKDIS_PP53_SAJA) {
    const j = byKode.get(kode);
    if (!j?.aktif) continue;
    if (terapkan) await sheets.hukdisJenis.update({ id: j.id }, { aktif: false, updatedAt: new Date(), updatedBy: oleh });
    console.log(`- Jenis hukdis ${kode} ${akan("dinonaktifkan", "akan dinonaktifkan")}`);
  }

  for (const seed of JENIS_HUKDIS_PP94) {
    const j = byKode.get(seed.kode);
    if (!j) {
      urutan += 1;
      if (terapkan) {
        await sheets.hukdisJenis.create({
          id: newId(), ...seed, urutan, regulasiId: null, berdampakKGB: false, durasiTunda: null,
          aktif: true, updatedAt: new Date(), updatedBy: oleh,
        });
      }
      console.log(`+ Jenis hukdis ${seed.kode} ${akan("ditambahkan", "akan ditambahkan")}`);
    } else if (j.dasarHukum !== seed.dasarHukum) {
      if (terapkan) {
        await sheets.hukdisJenis.update(
          { id: j.id },
          { dasarHukum: seed.dasarHukum, regulasiId: null, updatedAt: new Date(), updatedBy: oleh },
        );
      }
      console.log(`~ Dasar hukum ${seed.kode} ${akan("diganti", "akan diganti")} menjadi ${seed.dasarHukum}`);
    }
  }

  console.log(terapkan ? "\n✓ Migrasi Tahap 1 selesai." : "\n✓ Simulasi selesai.");
}

main().catch((e) => {
  console.error("✗ Gagal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
