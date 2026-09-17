// Pembatas percobaan gagal per kunci (misalnya NIP dan alamat IP) dalam jendela waktu tetap. Hitungan
// hanya tersimpan di memori isolate, sehingga permintaan yang dilayani isolate lain tidak ikut
// terhitung. Perlindungan utama tetap aturan rate limiting Cloudflare; pembatas ini memperlambat
// percobaan beruntun yang mengenai isolate yang sama. Modul ini murni.

interface OpsiPembatas {
  /** Jumlah kegagalan dalam satu jendela sebelum kunci ditolak. */
  batas: number;
  jendelaMs: number;
  sekarang?: () => number;
  /** Jumlah kunci paling banyak yang disimpan; kunci yang jendelanya sudah lewat dibuang lebih dulu. */
  kapasitas?: number;
}

export function buatPembatasPercobaan(opsi: OpsiPembatas) {
  const sekarang = opsi.sekarang ?? Date.now;
  const kapasitas = opsi.kapasitas ?? 10_000;
  const catatan = new Map<string, { mulai: number; gagal: number }>();

  const masihBerlaku = (entri: { mulai: number }, kini: number) => kini - entri.mulai < opsi.jendelaMs;

  /** true bila kunci sudah mencapai batas kegagalan dalam jendela yang sedang berjalan. */
  function terkunci(kunci: string): boolean {
    const entri = catatan.get(kunci);
    return !!entri && masihBerlaku(entri, sekarang()) && entri.gagal >= opsi.batas;
  }

  function catatGagal(kunci: string): void {
    const kini = sekarang();
    const entri = catatan.get(kunci);
    if (entri && masihBerlaku(entri, kini)) {
      entri.gagal += 1;
      return;
    }
    if (catatan.size >= kapasitas) {
      for (const [k, e] of catatan) if (!masihBerlaku(e, kini)) catatan.delete(k);
      if (catatan.size >= kapasitas) catatan.clear();
    }
    catatan.set(kunci, { mulai: kini, gagal: 1 });
  }

  function hapus(kunci: string): void {
    catatan.delete(kunci);
  }

  return { terkunci, catatGagal, hapus };
}
