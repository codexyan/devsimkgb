// Pemeriksaan sesi login terhadap data pengguna. Sesi JWT tidak tersimpan di server, jadi akun yang
// dihapus atau password-nya diatur ulang tetap memegang cookie yang sah sampai kedaluwarsa. Setiap
// kali sesi dibaca, id token dicari pada daftar pengguna dan sidik hash password-nya dibandingkan
// dengan sidik yang disimpan saat login. Seluruh daftar pengguna dimuat sekali lalu disimpan sebentar
// per isolate, sehingga tab User dibaca paling banyak sekali per masa simpan, bukan sekali per pengguna.
//
// Modul ini murni: pemuat data pengguna diberikan oleh pemanggil (auth.ts).

/** Sidik hash password: 16 karakter heksadesimal pertama SHA-256 dari hash bcrypt, bukan password-nya. */
export async function sidikSandi(hashSandi: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashSandi));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hash password per id pengguna, atau null bila pemuatan gagal atau melewati batas waktu. */
type DaftarPengguna = Map<string, string> | null;

interface OpsiPemeriksaSesi {
  /** Seluruh pengguna. Galat berarti pemuatan gagal (misalnya kuota Sheets). */
  muatSemuaPengguna: () => Promise<{ id: string; password: string }[]>;
  /** Lama daftar pengguna dipakai ulang. */
  masaSimpanMs?: number;
  /** Lama pemuatan yang gagal tidak diulang, agar kuota yang habis tidak makin terbebani. */
  masaSimpanGalatMs?: number;
  /**
   * Pemuatan yang lebih lama dari ini dianggap gagal. Klien Sheets mencoba ulang 429 dengan jeda
   * hingga sekitar 30 detik; tanpa batas ini setiap permintaan pengguna ikut menunggu.
   */
  batasWaktuMs?: number;
  /**
   * Token yang tidak cocok dengan daftar setua ini atau lebih memuat ulang daftar sekali sebelum
   * sesi diakhiri, agar pengguna yang baru dibuat atau baru mengganti password lalu masuk tidak
   * langsung dikeluarkan karena daftar lama.
   */
  jedaMuatUlangMs?: number;
  sekarang?: () => number;
}

export function buatPemeriksaSesi(opsi: OpsiPemeriksaSesi) {
  const masaSimpan = opsi.masaSimpanMs ?? 60_000;
  const masaSimpanGalat = opsi.masaSimpanGalatMs ?? 15_000;
  const batasWaktu = opsi.batasWaktuMs ?? 3_000;
  const jedaMuatUlang = opsi.jedaMuatUlangMs ?? 5_000;
  const sekarang = opsi.sekarang ?? Date.now;
  let simpanan: { dicari: number; daftar: Promise<DaftarPengguna> } | null = null;

  async function muat(): Promise<DaftarPengguna> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const habisWaktu = new Promise<"habis">((selesai) => {
      timer = setTimeout(() => selesai("habis"), batasWaktu);
    });
    try {
      const hasil = await Promise.race([opsi.muatSemuaPengguna(), habisWaktu]);
      if (hasil === "habis") {
        console.error(`[sesi] pemuatan daftar pengguna melewati ${batasWaktu} ms; sesi dianggap tetap berlaku`);
        return null;
      }
      return new Map(hasil.map((p) => [p.id, p.password]));
    } catch (err) {
      console.error("[sesi] pemuatan daftar pengguna gagal:", err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function ambil(): Promise<{ dicari: number; daftar: DaftarPengguna }> {
    const kini = sekarang();
    if (simpanan) {
      const entri = simpanan;
      const daftar = await entri.daftar;
      const batas = daftar ? masaSimpan : masaSimpanGalat;
      if (kini - entri.dicari < batas) return { dicari: entri.dicari, daftar };
      // Pemanggil lain mungkin sudah memuat ulang selama menunggu.
      if (simpanan !== entri) return ambil();
    }
    return muatBaru(kini);
  }

  async function muatBaru(kini: number): Promise<{ dicari: number; daftar: DaftarPengguna }> {
    const entri = { dicari: kini, daftar: muat() };
    simpanan = entri;
    return { dicari: kini, daftar: await entri.daftar };
  }

  async function cocok(daftar: Map<string, string>, id: string, sidikToken: unknown): Promise<boolean> {
    const hash = daftar.get(id);
    if (hash === undefined) return false;
    return typeof sidikToken !== "string" || sidikToken === (await sidikSandi(hash));
  }

  /**
   * false bila pengguna token tidak ada lagi atau password-nya sudah berubah sejak login. Token tanpa
   * sidik (dibuat sebelum pemeriksaan ini ada) hanya diperiksa keberadaan penggunanya. Bila pemuatan
   * gagal atau terlalu lama, sesi tetap dianggap berlaku agar gangguan Sheets tidak mengeluarkan atau
   * menahan semua pengguna.
   */
  async function sesiBerlaku(token: { id?: unknown; sidikSandi?: unknown }): Promise<boolean> {
    const id = typeof token.id === "string" ? token.id : "";
    if (!id) return false;

    const pertama = await ambil();
    if (!pertama.daftar) return true;
    if (await cocok(pertama.daftar, id, token.sidikSandi)) return true;
    if (sekarang() - pertama.dicari < jedaMuatUlang) return false;

    // Daftar mungkin sudah usang: muat ulang sekali, kecuali pemanggil lain baru saja melakukannya.
    const entri = simpanan;
    const kedua =
      entri && entri.dicari !== pertama.dicari
        ? { dicari: entri.dicari, daftar: await entri.daftar }
        : await muatBaru(sekarang());
    if (!kedua.daftar) return true;
    return cocok(kedua.daftar, id, token.sidikSandi);
  }

  /** Buang daftar tersimpan, misalnya setelah password diatur ulang, akun dihapus, atau login berhasil. */
  function lupakan(): void {
    simpanan = null;
  }

  return { sesiBerlaku, lupakan };
}
