// Samakan baris header tab Google Sheets dengan definisi kolom di tables.ts.
//
// Aman untuk data yang sudah ada: hanya membuat tab baru, mengisi header kosong,
// atau menambah kolom baru di ujung kanan. Urutan kolom lama tidak pernah diubah,
// karena penulisan baris bersifat posisional.

import { addSheetTab, getValues, listSheetTitles, updateValues } from "./client";
import type { TableDef } from "./table";

export type HasilSinkron =
  | { tab: string; aksi: "buat_tab" }
  | { tab: string; aksi: "isi_header" }
  | { tab: string; aksi: "cocok" }
  | { tab: string; aksi: "tambah_kolom"; kolom: string[] }
  | { tab: string; aksi: "tidak_cocok"; headerSheet: string[] };

/** `terapkan` false = hanya melaporkan apa yang akan dilakukan. */
export async function sinkronkanHeader(defs: TableDef[], terapkan: boolean): Promise<HasilSinkron[]> {
  const ada = new Set(await listSheetTitles());
  const hasil: HasilSinkron[] = [];

  for (const def of defs) {
    const header = def.columns.map((c) => c.name);

    if (!ada.has(def.tab)) {
      if (terapkan) {
        await addSheetTab(def.tab);
        await updateValues(`${def.tab}!A1`, [header]);
      }
      hasil.push({ tab: def.tab, aksi: "buat_tab" });
      continue;
    }

    const baris1 = (await getValues(`${def.tab}!1:1`))[0] ?? [];
    if (baris1.length === 0) {
      if (terapkan) await updateValues(`${def.tab}!A1`, [header]);
      hasil.push({ tab: def.tab, aksi: "isi_header" });
    } else if (baris1.length < header.length && baris1.every((nama, i) => nama === header[i])) {
      if (terapkan) await updateValues(`${def.tab}!A1`, [header]);
      hasil.push({ tab: def.tab, aksi: "tambah_kolom", kolom: header.slice(baris1.length) });
    } else if (header.every((nama, i) => baris1[i] === nama)) {
      hasil.push({ tab: def.tab, aksi: "cocok" });
    } else {
      hasil.push({ tab: def.tab, aksi: "tidak_cocok", headerSheet: baris1 });
    }
  }

  return hasil;
}
