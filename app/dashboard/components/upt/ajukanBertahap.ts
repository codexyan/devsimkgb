// Pengajuan draf ke Kanwil dari peramban, beberapa pegawai per permintaan (ADR-079).
//
// Satu permintaan untuk puluhan pegawai melampaui batas CPU Worker dan terputus di tengah: sebagian usulan sudah
// berstatus menunggu, sebagian masih draf, dan operator hanya melihat "gagal". Karena itu seluruh daftar diperiksa
// kelengkapannya lebih dulu tanpa menyimpan apa pun, lalu dikirim per UKURAN_KIRIMAN pegawai. Salinan surat diunggah
// sekali pada kiriman pertama; kiriman berikutnya memakai jalurnya. Kiriman yang gagal dicoba sekali lagi, dan aman
// diulang: rute menghitung usulan yang sudah menunggu dengan surat yang sama sebagai terkirim.

export const UKURAN_KIRIMAN = 5;

/** Kalimat tambahan untuk draf pegawai baru yang diajukan sebagai perbaikan data (ADR-091); kosong bila tidak ada. */
export function kabarJadiPerbaikan(nama: readonly string[]): string {
  if (nama.length === 0) return "";
  const siapa = nama.length === 1 ? nama[0] : `${nama.length} pegawai (${nama.join(", ")})`;
  return ` ${siapa} ternyata sudah tercatat di SIM-KGB, jadi usulannya diajukan sebagai perbaikan data, bukan pegawai baru.`;
}

export type HasilAjukan =
  /** `jadiPerbaikan`: nama pegawai baru yang NIP-nya sudah tercatat, diajukan sebagai perbaikan data (ADR-091). */
  | { ok: true; jumlah: number; jadiPerbaikan: string[] }
  /** `terkirim`: id yang sudah berangkat sebelum kiriman yang gagal; tidak lagi berupa draf. */
  | { ok: false; galat: string; terkirim: string[] };

type Jawaban = { error?: string; jumlah?: number; sudah?: number; pathBerkas?: string | null; jadiPerbaikan?: string[] };

async function kirim(form: FormData): Promise<{ ok: boolean; status: number; d: Jawaban }> {
  const res = await fetch("/api/upt/usulan/ajukan", { method: "POST", body: form });
  return { ok: res.ok, status: res.status, d: (await res.json().catch(() => ({}))) as Jawaban };
}

/** Coba sekali lagi bila sambungan putus atau server gagal (5xx); penolakan isian (4xx) tidak diulang. */
async function kirimDenganUlang(buat: () => FormData): Promise<{ ok: boolean; status: number; d: Jawaban }> {
  try {
    const h = await kirim(buat());
    if (h.ok || h.status < 500) return h;
  } catch {
    // Dicoba lagi di bawah.
  }
  await new Promise((r) => setTimeout(r, 1500));
  try {
    return await kirim(buat());
  } catch {
    return { ok: false, status: 0, d: { error: "Sambungan terputus." } };
  }
}

export async function ajukanBertahap(p: {
  ids: readonly string[];
  nomorSurat: string;
  tanggalSurat: string;
  berkas: File | null;
  /** Dipanggil sebelum tiap kiriman: jumlah yang sudah terkirim dan seluruhnya. */
  kemajuan?: (terkirim: number, total: number) => void;
}): Promise<HasilAjukan> {
  const ids = [...new Set(p.ids)];
  const dasar = () => {
    const form = new FormData();
    form.set("nomorSurat", p.nomorSurat);
    form.set("tanggalSurat", p.tanggalSurat);
    return form;
  };

  // Seluruh daftar diperiksa dulu, supaya satu draf yang kurang tidak membuat separuhnya terkirim. Tanpa nomor surat
  // pun diperiksa dulu: surat hanya boleh kosong bila seluruh isinya laporan SK (ADR-046), dan itu dinilai per kiriman.
  if (ids.length > UKURAN_KIRIMAN || !p.nomorSurat.trim()) {
    const periksa = await kirimDenganUlang(() => {
      const form = dasar();
      for (const id of ids) form.append("id", id);
      form.set("periksaSaja", "1");
      return form;
    });
    if (!periksa.ok) return { ok: false, galat: periksa.d.error ?? "Usulan gagal diperiksa", terkirim: [] };
  }

  let pathBerkas: string | null = null;
  let terkirim = 0;
  const jadiPerbaikan: string[] = [];
  for (let i = 0; i < ids.length; i += UKURAN_KIRIMAN) {
    p.kemajuan?.(terkirim, ids.length);
    const bagian = ids.slice(i, i + UKURAN_KIRIMAN);
    const h = await kirimDenganUlang(() => {
      const form = dasar();
      for (const id of bagian) form.append("id", id);
      if (pathBerkas) form.set("pathBerkas", pathBerkas);
      else if (p.berkas) form.set("berkas", p.berkas);
      return form;
    });
    if (!h.ok) {
      const pesan = h.d.error ?? "Usulan gagal dikirim";
      return {
        ok: false,
        galat: terkirim > 0 ? `${pesan} ${terkirim} dari ${ids.length} pegawai sudah terkirim; ajukan lagi sisanya.` : pesan,
        terkirim: ids.slice(0, i),
      };
    }
    pathBerkas = h.d.pathBerkas ?? pathBerkas;
    terkirim += (h.d.jumlah ?? 0) + (h.d.sudah ?? 0);
    jadiPerbaikan.push(...(h.d.jadiPerbaikan ?? []));
  }
  return { ok: true, jumlah: terkirim, jadiPerbaikan };
}
