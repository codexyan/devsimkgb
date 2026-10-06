// Memuat linimasa SK penetap gaji pokok untuk modal Input KGB dan Buat SK (ADR-062). Datanya dari rute yang sudah
// dipakai modal itu (data pegawai, riwayat KGB, kenaikan pangkat, PMK); susunannya dari lib/linimasaDasarSk.ts, aturan
// yang sama dengan dasbor Admin UPT. Dokumen tiap SK dicocokkan dari daftar dokumen pegawai (ADR-066).

import {
  ambilDokumenPegawai,
  ambilPegawaiKgb,
  ambilRiwayatKgb,
  ambilRiwayatPangkat,
  ambilRiwayatPmk,
  type HasilAksi,
  type RiwayatKgbItem,
} from "@/lib/kgbAksi";
import { susunLinimasaDasar, type LinimasaDasarSk } from "@/lib/linimasaDasarSk";
import { dokumenLinimasa, type DokumenSk } from "@/lib/dokumenLinimasa";
import { pesanKgbBasi } from "@/lib/pemeriksaanUlangKgb";
import { tmtTerakhirSebelumInput } from "@/lib/prosesKgb";
import { tanggalKalender, type NilaiTanggal } from "@/lib/waktu";

export type KonteksLinimasa =
  /** Input KGB: KGB yang akan diinput, dengan TMT KGB terakhir pegawai sebagai batas bawah. */
  | { jenis: "input"; tmtKgbBaru: NilaiTanggal }
  /** Buat SK dan Perbaiki SK: KGB yang sedang diproses. */
  | { jenis: "buat-sk"; kgbId: string };

export interface DataLinimasa {
  linimasa: LinimasaDasarSk;
  /** TMT KGB yang dibuat (ISO): penanda "KGB ini" pada linimasa. */
  tmtKgbBaru: string | null;
  /** Buat SK: pesan bila golongan atau masa kerja pegawai berubah sesudah KGB ini diinput (ADR-062). */
  basi: string | null;
  /** Dokumen tiap SK menurut kuncinya; null bila daftar dokumen gagal dimuat (linimasanya tetap tampil). */
  dokumen: Record<string, DokumenSk | null> | null;
}

/** TMT KGB selesai yang terakhir sebelum KGB ini; cadangan bila tambahan masa kerjanya tidak diketahui. */
function selesaiSebelum(riwayat: readonly RiwayatKgbItem[], kgb: RiwayatKgbItem): Date | null {
  const batas = tanggalKalender(kgb.tmtKgbBaru);
  let hasil: Date | null = null;
  for (const k of riwayat) {
    if (k.status !== "selesai" || k.id === kgb.id) continue;
    const t = tanggalKalender(k.tmtKgbBaru);
    if (t && (!batas || t < batas) && (!hasil || t > hasil)) hasil = t;
  }
  return hasil;
}

export async function muatLinimasaDasar(pegawaiId: string, konteks: KonteksLinimasa): Promise<HasilAksi<DataLinimasa>> {
  const [hasilPegawai, hasilKgb, hasilKp, hasilPmk, hasilDokumen] = await Promise.all([
    ambilPegawaiKgb(pegawaiId),
    ambilRiwayatKgb(pegawaiId),
    ambilRiwayatPangkat(pegawaiId),
    ambilRiwayatPmk(pegawaiId),
    ambilDokumenPegawai(pegawaiId),
  ]);
  if (!hasilPegawai.ok) return hasilPegawai;
  if (!hasilKgb.ok) return hasilKgb;
  if (!hasilKp.ok) return hasilKp;
  if (!hasilPmk.ok) return hasilPmk;
  const pegawai = hasilPegawai.data;
  const riwayat = hasilKgb.data;

  let tmtKgbBaru: NilaiTanggal = null;
  let tmtKgbSebelumnya: NilaiTanggal = pegawai.tmtKgbTerakhir;
  let kgbId: string | null = null;
  let basi: string | null = null;
  if (konteks.jenis === "buat-sk") {
    const kgb = riwayat.find((k) => k.id === konteks.kgbId);
    if (kgb) {
      kgbId = kgb.id;
      tmtKgbBaru = kgb.tmtKgbBaru;
      // Input KGB sudah memajukan TMT KGB terakhir pegawai ke TMT KGB ini, jadi batas bawahnya TMT sebelum KGB ini:
      // diturunkan dari tambahan masa kerjanya, sama dengan pemulihan saat KGB dibatalkan.
      tmtKgbSebelumnya =
        tmtTerakhirSebelumInput({
          tmtKgbBaru: kgb.tmtKgbBaru,
          mkgTahunLama: kgb.mkgTahunLama ?? 0,
          mkgBulanLama: kgb.mkgBulanLama ?? 0,
          mkgTahunBaru: kgb.mkgTahunBaru ?? 0,
          mkgBulanBaru: kgb.mkgBulanBaru ?? 0,
        }) ?? selesaiSebelum(riwayat, kgb);
      basi = pesanKgbBasi(kgb, pegawai);
    }
  } else {
    tmtKgbBaru = konteks.tmtKgbBaru;
  }

  const linimasa = susunLinimasaDasar({
    kgb: riwayat,
    pangkat: hasilKp.data.map((r) => ({
      id: r.id,
      nomorSK: r.nomorSK,
      tanggalSK: r.tanggalSK,
      tmt: r.tmtPangkat,
      jenisKp: r.jenisKp,
      penetapSK: r.penetapSK,
      golonganLama: r.golonganLama,
      golonganBaru: r.golonganBaru,
      gajiPokokBaru: r.gajiPokokBaru,
    })),
    pmk: hasilPmk.data.map((r) => ({
      id: r.id,
      nomorSK: r.nomorSK,
      tanggalSK: r.tanggalSK,
      tmt: r.tmtPmk,
      penetapSK: r.penetapSK,
      tambahBulan: r.tambahBulan,
      gajiPokokBaru: r.gajiPokokBaru,
    })),
    // TMT KGB terakhir pada data pegawai juga TMT SK dasarnya; di Buat SK keduanya TMT sebelum KGB ini.
    pegawai: { ...pegawai, tmtKgbTerakhir: tmtKgbSebelumnya },
    tmtKgbSebelumnya,
    tmtKgbBaru,
    kgbId,
  });
  const dokumen = hasilDokumen.ok ? dokumenLinimasa(linimasa.sk, hasilDokumen.data, riwayat) : null;
  return { ok: true, data: { linimasa, tmtKgbBaru: tanggalKalender(tmtKgbBaru)?.toISOString() ?? null, basi, dokumen } };
}
