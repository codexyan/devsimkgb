"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashUser } from "../RoleContext";
import { useDialogModal } from "../useDialogModal";
import {
  PERISTIWA_BUKA_PENGUMUMAN_UPT,
  bolehTampilPengumuman,
  gabungDilihat,
  kunciPengumumanUpt,
  pengumumanBelumDilihat,
  sedangMengetik,
  type IdPengumumanUpt,
} from "@/lib/pengumumanUpt";

/* Pop-up pengumuman perubahan untuk Admin UPT (ADR-073, ADR-074, ADR-075): nama menu baru dan pegawai baru yang kini tampil di
   tabel Pegawai Satker, lalu laporan SK kenaikan pangkat, PI, dan PMK di satu tempat (dulu tombol Lapor KP/PI/PMK, ADR-081)
   beserta peringatan dan kabar disetujuinya, lalu formulir usulan yang
   memisahkan SK KGB terakhir dari SK sesudahnya beserta pratinjau SK KGB (ADR-078). Adegan bergerak yang
   berganti sendiri, dapat dijeda, dilewati, atau dibuka lagi lewat tombol "Apa yang baru". Tiap adegan milik satu
   pengumuman; yang tampil otomatis hanya adegan dari pengumuman yang belum dilihat akun itu. Penanda "sudah dilihat"
   dicatat per akun di server (ADR-075), supaya pengumuman tampil di login pertama akun itu saja, di perangkat mana pun;
   penanda peramban tetap dipakai sebagai cadangan bila servernya belum siap.

   Pengumuman ini tidak boleh menjadi sebab data hilang, maka aturannya ketat (lib/pengumumanUpt.ts): hanya tampil di
   halaman tanpa isian, tidak di atas dialog lain, tidak selagi ada kolom yang sedang diketik, dan tidak menyimpan
   apa pun selain penanda "sudah dilihat" di peramban. Semua gerak ada di CSS (dasbor.css, awalan pmn-) dan tiap
   elemen bergerak menempati keadaan akhirnya bila animasi dimatikan, jadi pilihan "Kurangi animasi" tetap
   menampilkan isi yang utuh tanpa gerak. */

type Gambar = "menu" | "tabel" | "aman" | "lapor" | "kabar" | "skPisah" | "pratinjauSk";

const ADEGAN: readonly { pengumuman: IdPengumumanUpt; gambar: Gambar; judul: string; teks: string }[] = [
  {
    pengumuman: "nama-menu-2026-10",
    gambar: "menu",
    judul: "Nama menu kini sesuai fungsinya",
    teks: "Data Pegawai menjadi Pegawai Satker, dan Usulan kolektif menjadi Usul KGB Kolektif. Letak menu dan tautan lama tidak berubah.",
  },
  {
    pengumuman: "nama-menu-2026-10",
    gambar: "tabel",
    judul: "Pegawai baru hasil unggahan terlihat di tabel",
    teks: "Pegawai yang masih draf, dikembalikan, atau menunggu Kanwil tampil di Pegawai Satker sebagai baris bertanda, dengan saringan Belum tercatat. Barisnya berpindah sendiri setelah Kanwil menyetujui.",
  },
  {
    pengumuman: "nama-menu-2026-10",
    gambar: "aman",
    judul: "Data yang sudah Anda isi tetap aman",
    teks: "Perubahan ini hanya mengganti nama dan tampilan. Draf, usulan, dan berkas yang sudah Anda input tidak berubah dan tidak hilang.",
  },
  {
    pengumuman: "lapor-sk-2026-10",
    gambar: "lapor",
    judul: "SK kenaikan pangkat, PI, dan PMK dilaporkan di satu tempat",
    teks: "Laporkan SK yang terbit sesudah SK KGB terakhir di langkah SK sesudah SK KGB terakhir: lewat Perbarui data untuk satu pegawai, atau Usul KGB Kolektif untuk banyak pegawai. Bila isinya hanya laporan SK, kosongkan nomor surat saat mengajukan. SK kenaikan pangkat hanya diminta bila Anda melaporkannya.",
  },
  {
    pengumuman: "lapor-sk-2026-10",
    gambar: "kabar",
    judul: "Ada peringatan sebelum kirim, dan kabar saat disetujui",
    teks: "Bila KGB pegawai sedang diproses Kanwil, Anda diberi tahu dampaknya sebelum mengirim. Setelah Kanwil menyetujui laporan SK, kabarnya muncul di Notifikasi.",
  },
  {
    pengumuman: "sk-usulan-2026-10",
    gambar: "skPisah",
    judul: "SK KGB terakhir dan SK sesudahnya kini diisi terpisah",
    teks: "Di formulir usulan, bagian pangkat berisi golongan dan masa kerja pada SK KGB terakhir. Golongan baru dan masa kerja menurut SK kenaikan pangkat, PI, atau PMK diisi di bagian SK-nya. Sistem menghitung gaji pokok dan KGB berikutnya seperti persetujuan Kanwil, lalu mencocokkan masa kerjanya dengan SK. Isian SK tidak hilang bila jawaban Ada dan Tidak ada berganti.",
  },
  {
    pengumuman: "sk-usulan-2026-10",
    gambar: "pratinjauSk",
    judul: "Pratinjau SK KGB sebelum mengajukan",
    teks: "Tombol Pratinjau SK KGB di formulir usulan menyusun SK KGB berikutnya dari isian Anda saat itu juga, bertanda air pratinjau. Periksa pangkat, gaji pokok, masa kerja, dan TMT-nya sebelum mengajukan. SK yang kelak dibuat Kanwil tetap Anda periksa sebelum dicetak.",
  },
];

/** Penanda "sudah dilihat" selama sesi, untuk peramban yang menolak localStorage; per kunci agar tidak lintas akun. */
const dilihatSesi = new Set<string>();

function sudahDilihat(kunci: string): boolean {
  if (dilihatSesi.has(kunci)) return true;
  try {
    return localStorage.getItem(kunci) === "1";
  } catch {
    return false;
  }
}

function catatDilihat(kunci: string) {
  dilihatSesi.add(kunci);
  try {
    localStorage.setItem(kunci, "1");
  } catch {
    // Penyimpanan ditolak: cukup selama sesi ini.
  }
}

/** Penanda per akun di server (ADR-075), diambil satu kali per akun selama halaman terbuka. Null: server belum siap. */
const penandaServer = new Map<string, Promise<Set<string> | null>>();

function ambilPenandaServer(nip: string): Promise<Set<string> | null> {
  let janji = penandaServer.get(nip);
  if (!janji) {
    janji = fetch("/api/upt/pengumuman")
      .then(async (r) => {
        if (!r.ok) return null;
        const d = (await r.json()) as { server?: boolean; dilihat?: string[] };
        return d.server ? new Set(d.dilihat ?? []) : null;
      })
      .catch(() => null);
    penandaServer.set(nip, janji);
    // Kegagalan tidak disimpan: percobaan berikutnya boleh bertanya lagi.
    void janji.then((h) => {
      if (h === null) penandaServer.delete(nip);
    });
  }
  return janji;
}

/** Catat ke server; gagal tidak mengganggu apa pun, sebab penanda peramban sudah dicatat lebih dulu. */
async function catatKeServer(nip: string, ids: readonly string[]) {
  if (ids.length === 0) return;
  try {
    const r = await fetch("/api/upt/pengumuman", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!r.ok) return;
    const d = (await r.json()) as { server?: boolean; dilihat?: string[] };
    if (d.server) penandaServer.set(nip, Promise.resolve(new Set(d.dilihat ?? [])));
  } catch {
    // Jaringan putus: penanda peramban cukup untuk kali ini.
  }
}

/** Tandai dilihat: peramban lebih dulu, lalu server bila server belum mengetahuinya. */
function tandaiDilihat(nip: string, ids: readonly IdPengumumanUpt[]) {
  for (const id of ids) catatDilihat(kunciPengumumanUpt(nip, id));
  void (async () => {
    const sudah = await (penandaServer.get(nip) ?? Promise.resolve(null));
    await catatKeServer(nip, sudah ? ids.filter((id) => !sudah.has(id)) : ids);
  })();
}

const gaya = (d: string): CSSProperties => ({ "--d": d }) as CSSProperties;

export default function PengumumanUpt() {
  const { nip, role } = useDashUser();
  const pathname = usePathname();
  const [buka, setBuka] = useState(false);
  const [adegan, setAdegan] = useState(0);
  const [jeda, setJeda] = useState(false);
  // Urutan adegan yang sedang diputar: yang belum dilihat saat tampil sendiri, seluruhnya saat dibuka dari tombol.
  const [daftar, setDaftar] = useState<number[]>(() => ADEGAN.map((_, i) => i));

  // Tampil sendiri satu kali per akun, sesudah halaman sempat dimuat. Bila saat itu ada dialog atau kolom yang sedang
  // diketik, dicoba lagi beberapa kali lalu dilepas; penandanya belum dicatat, jadi muncul pada kunjungan berikutnya.
  // Server hanya ditanya bila peramban ini belum pernah melihat semuanya, jadi halaman yang sudah biasa tidak membayar
  // satu permintaan pun.
  useEffect(() => {
    const aman = (adaDialog: boolean, mengetik: boolean) =>
      bolehTampilPengumuman({ peran: role, jalur: pathname, adaDialog, sedangMengetik: mengetik, sudahDilihat: false });
    if (!aman(false, false)) return;
    let batal = false;
    let percobaan = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const lokal = (id: IdPengumumanUpt) => sudahDilihat(kunciPengumumanUpt(nip, id));
    const coba = async () => {
      if (pengumumanBelumDilihat(lokal).length === 0) return;
      const server = await ambilPenandaServer(nip);
      if (batal) return;
      const { dilihat, perluDicatat } = gabungDilihat(server ? [...server] : null, lokal);
      // Yang sudah dilihat di server dicatat juga di peramban ini, dan yang sudah dilihat di peramban ini disusulkan
      // ke server (pengguna yang melihat pengumuman sebelum penanda server ada).
      for (const id of dilihat) catatDilihat(kunciPengumumanUpt(nip, id));
      if (perluDicatat.length > 0) void catatKeServer(nip, perluDicatat);
      const baru = pengumumanBelumDilihat((id) => dilihat.includes(id));
      if (baru.length === 0) return;
      if (aman(document.querySelector('[role="dialog"]') !== null, sedangMengetik(document.activeElement))) {
        setDaftar(ADEGAN.flatMap((a, i) => (baru.includes(a.pengumuman) ? [i] : [])));
        setAdegan(0);
        setJeda(false);
        setBuka(true);
        // Dicatat begitu tampil, bukan menunggu ditutup: pengumuman muncul di login pertama saja, dan tidak berulang
        // bila halaman dimuat ulang sebelum ditutup. Tombol "Apa yang baru?" selalu dapat membukanya lagi.
        tandaiDilihat(nip, baru);
        return;
      }
      percobaan += 1;
      if (percobaan < 4) timer = setTimeout(() => void coba(), 4000);
    };
    timer = setTimeout(() => void coba(), 1600);
    return () => {
      batal = true;
      clearTimeout(timer);
    };
  }, [role, pathname, nip]);

  // Dibuka lagi dari tombol "Apa yang baru"; permintaan pengguna sendiri, jadi tidak diperiksa seperti tampil otomatis.
  useEffect(() => {
    const bukaLagi = () => {
      setDaftar(ADEGAN.map((_, i) => i));
      setAdegan(0);
      setJeda(false);
      setBuka(true);
    };
    window.addEventListener(PERISTIWA_BUKA_PENGUMUMAN_UPT, bukaLagi);
    return () => window.removeEventListener(PERISTIWA_BUKA_PENGUMUMAN_UPT, bukaLagi);
  }, []);

  // Menutup mencatat pengumuman yang adegannya baru saja diputar (yang sudah tercatat tidak dikirim ulang ke server);
  // yang tidak ikut diputar tidak ditandai dilihat.
  const tutup = useCallback(() => {
    tandaiDilihat(nip, [...new Set(daftar.map((i) => ADEGAN[i].pengumuman))]);
    setBuka(false);
  }, [daftar, nip]);
  const panelRef = useDialogModal(buka, tutup);

  if (role !== "admin_upt" || !buka) return null;

  const putar = daftar.map((i) => ADEGAN[i]);
  const terakhir = adegan === putar.length - 1;
  const lanjut = () => (terakhir ? tutup() : setAdegan((a) => a + 1));

  return (
    <div
      className="pmn-latar"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) tutup();
      }}
    >
      <div
        ref={panelRef}
        className="pmn-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pmn-judul"
        aria-describedby="pmn-teks"
        tabIndex={-1}
        data-jeda={jeda ? "" : undefined}
      >
        <div className="pmn-panggung dsb-navy" aria-hidden="true">
          <span className="pmn-aurora pmn-aurora-a" />
          <span className="pmn-aurora pmn-aurora-b" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span key={i} className="pmn-bintang" style={{ "--i": i } as CSSProperties} />
          ))}
          <div className="pmn-adegan" key={adegan}>
            {putar[adegan].gambar === "menu" && <AdeganMenu />}
            {putar[adegan].gambar === "tabel" && <AdeganTabel />}
            {putar[adegan].gambar === "aman" && <AdeganAman />}
            {putar[adegan].gambar === "lapor" && <AdeganLapor />}
            {putar[adegan].gambar === "kabar" && <AdeganKabar />}
            {putar[adegan].gambar === "skPisah" && <AdeganSkPisah />}
            {putar[adegan].gambar === "pratinjauSk" && <AdeganPratinjauSk />}
          </div>
        </div>

        <div className="pmn-seg-baris" role="group" aria-label="Langkah pengumuman">
          {putar.map((a, i) => (
            <button
              key={a.judul}
              type="button"
              className="pmn-seg"
              data-status={i < adegan ? "lalu" : i === adegan ? "aktif" : "nanti"}
              aria-label={`Langkah ${i + 1} dari ${putar.length}: ${a.judul}`}
              aria-current={i === adegan ? "step" : undefined}
              onClick={() => setAdegan(i)}
            >
              <span
                className="pmn-isi"
                onAnimationEnd={i === adegan ? () => setAdegan((x) => Math.min(x + 1, putar.length - 1)) : undefined}
              />
            </button>
          ))}
        </div>

        <div className="pmn-pojok">
          <button
            type="button"
            className="pmn-ikon-tombol"
            aria-pressed={jeda}
            aria-label={jeda ? "Putar kembali animasi" : "Jeda animasi"}
            onClick={() => setJeda((j) => !j)}
          >
            {jeda ? "▶" : "❚❚"}
          </button>
          <button type="button" className="pmn-ikon-tombol" aria-label="Tutup pengumuman" onClick={tutup}>
            ✕
          </button>
        </div>

        <div className="pmn-isi-teks">
          <p className="pmn-label">Pembaruan untuk Admin UPT</p>
          <div aria-live="polite">
            <h2 id="pmn-judul" className="pmn-judul" key={adegan}>
              {putar[adegan].judul}
            </h2>
            <p id="pmn-teks" className="pmn-teks-isi" key={`t${adegan}`}>
              {putar[adegan].teks}
            </p>
          </div>
          <div className="pmn-kaki">
            <span className="pmn-hitung">
              {adegan + 1} / {putar.length}
            </span>
            <span className="pmn-tombol-deret">
              {adegan > 0 && (
                <button type="button" className="dsb-tombol" data-jenis="garis" onClick={() => setAdegan((a) => a - 1)}>
                  Kembali
                </button>
              )}
              {terakhir && pathname !== "/dashboard/upt/pegawai" && (
                <Link href="/dashboard/upt/pegawai" className="dsb-tombol" data-jenis="garis" onClick={tutup}>
                  Lihat Pegawai Satker
                </Link>
              )}
              <button type="button" className="dsb-tombol" onClick={lanjut} data-autofocus>
                {terakhir ? "Mengerti" : "Lanjut"}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Adegan 1: nama menu berganti ──────────────────────────────────────── */

function AdeganMenu() {
  const biasa = (nama: string) => (
    <div className="pmn-butir">
      <span className="pmn-ikon" />
      <span className="pmn-teks">
        <span>{nama}</span>
      </span>
    </div>
  );
  const ganti = (lama: string, baru: string, d: string) => (
    <div className="pmn-butir pmn-ganti" style={gaya(d)}>
      <span className="pmn-ikon" />
      <span className="pmn-teks">
        <span className="pmn-lama">{lama}</span>
        <span className="pmn-baru">{baru}</span>
      </span>
      <span className="pmn-chip">baru</span>
    </div>
  );
  return (
    <div className="pmn-menu">
      <p className="pmn-menu-judul">MENU</p>
      {biasa("Dashboard")}
      {ganti("Data Pegawai", "Pegawai Satker", "0.7s")}
      {ganti("Usulan kolektif", "Usul KGB Kolektif", "1.9s")}
      {biasa("Lapor Hukdis")}
    </div>
  );
}

/* ── Adegan 2: pegawai baru masuk ke tabel ─────────────────────────────── */

const BARIS_CONTOH: { nama: string; ket: string; nada: "biru" | "hijau" | "kuning" | "ungu"; baru: boolean; d?: string }[] = [
  { nama: "Andi Pratama", ket: "Draf pegawai baru", nada: "kuning", baru: true, d: "1.7s" },
  { nama: "Rina Lestari", ket: "Menunggu tinjauan Kanwil", nada: "biru", baru: true, d: "2.2s" },
  { nama: "Dewi Anggraini", ket: "Dikembalikan Kanwil", nada: "ungu", baru: true, d: "2.7s" },
  { nama: "Budi Kusuma", ket: "Diproses Kanwil", nada: "biru", baru: false },
  { nama: "Siti Nugroho", ket: "SK terbit", nada: "hijau", baru: false },
];

function AdeganTabel() {
  return (
    <div className="pmn-tabel">
      <div className="pmn-bar">
        <span className="pmn-berkas">
          <b>XLSX</b>
          <span>daftar-pegawai.xlsx</span>
        </span>
        <span className="pmn-tekan">Unggah daftar</span>
        <span className="pmn-saring">
          <span>Semua</span>
          <span className="pmn-saring-baru">Belum tercatat 3</span>
        </span>
      </div>
      <div className="pmn-kepala-tabel">
        <span>Pegawai</span>
        <span>Status di Kanwil</span>
      </div>
      {BARIS_CONTOH.map((b) => (
        <div key={b.nama} className="pmn-baris" data-baru={b.baru ? "" : undefined} style={b.d ? gaya(b.d) : undefined}>
          <span className="pmn-nama">
            {b.nama}
            {b.baru && <em className="pmn-tag">Pegawai baru</em>}
          </span>
          <span className="pmn-status">
            <i className="pmn-titik" data-nada={b.nada} />
            {b.ket}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Adegan 3: data tetap aman ─────────────────────────────────────────── */

function AdeganAman() {
  return (
    <div className="pmn-aman">
      <span className="pmn-cincin" />
      <span className="pmn-cincin pmn-cincin-b" />
      <div className="pmn-orbit">
        {[
          ["Draf", "0deg"],
          ["Usulan", "120deg"],
          ["Berkas", "240deg"],
        ].map(([nama, sudut], k) => (
          <span key={nama} className="pmn-sat" style={{ "--a": sudut, "--k": k } as CSSProperties}>
            <span className="pmn-sat-isi">
              <i aria-hidden="true">✓</i>
              {nama}
            </span>
          </span>
        ))}
      </div>
      <svg className="pmn-perisai" viewBox="0 0 120 140" role="presentation">
        <path className="pmn-perisai-badan" d="M60 8 L108 26 V68 C108 98 88 120 60 132 C32 120 12 98 12 68 V26 Z" />
        <path className="pmn-centang" d="M38 72 L54 88 L84 52" pathLength={1} />
      </svg>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="pmn-percik" style={{ "--a": `${i * 60}deg` } as CSSProperties} />
      ))}
    </div>
  );
}

/* ── Adegan 4: laporan SK lewat Usul KGB Kolektif (ADR-081; dulu Lapor KP/PI/PMK) ── */

const BARIS_LAPOR: { nama: string; jenis: string; hitung: string; d: string; e: string }[] = [
  { nama: "Rina Lestari", jenis: "Kenaikan pangkat", hitung: "II/b → III/a", d: "1.0s", e: "3.5s" },
  { nama: "Andi Pratama", jenis: "PMK", hitung: "6 thn → 9 thn", d: "1.4s", e: "3.7s" },
  { nama: "Dewi Anggraini", jenis: "Penyesuaian ijazah", hitung: "II/d → III/a", d: "1.8s", e: "3.9s" },
];

function AdeganLapor() {
  return (
    <div className="pmn-tabel pmn-lapor">
      <div className="pmn-bar">
        <span className="pmn-tombol-g">Unggah daftar</span>
        <span className="pmn-tombol-g">Tambah pegawai</span>
        <span className="pmn-tekan pmn-tekan-lapor">Usul KGB Kolektif</span>
      </div>
      <div className="pmn-kepala-lapor">
        <span>Pegawai</span>
        <span>SK sesudah SK KGB terakhir</span>
        <span>Status</span>
      </div>
      {BARIS_LAPOR.map((b) => (
        <div key={b.nama} className="pmn-baris pmn-baris-lapor" data-baru="" style={{ "--d": b.d, "--e": b.e } as CSSProperties}>
          <span className="pmn-nama">{b.nama}</span>
          <span className="pmn-hitungan">
            <small>{b.jenis}</small>
            {b.hitung}
          </span>
          <span className="pmn-teks pmn-st">
            <span className="pmn-st-lama">Siap kirim</span>
            <span className="pmn-st-baru">✓ Terkirim</span>
          </span>
        </div>
      ))}
      <div className="pmn-kaki-lapor">
        <span>3 pegawai · 3 siap dikirim</span>
        <span className="pmn-tekan pmn-tekan-kirim">Kirim 3 ke Kanwil</span>
      </div>
    </div>
  );
}

/* ── Adegan 5: peringatan dampak dan kabar disetujui ───────────────────── */

function AdeganKabar() {
  return (
    <div className="pmn-kabar">
      <div className="pmn-peringatan">
        <i aria-hidden="true">!</i>
        <span>
          <b>Perhatikan.</b> KGB TMT 1 Des 2026 sedang diproses Kanwil. Bila laporan disetujui, hitungannya diperbarui dan SK
          dibuat ulang oleh Tim SDM.
        </span>
      </div>
      <div className="pmn-notif-baris">
        <span className="pmn-lonceng">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <em className="pmn-lencana">1</em>
        </span>
        <span className="pmn-notif">
          <i aria-hidden="true">✓</i>
          <span>
            <b>Laporan SK Disetujui: Rina Lestari</b>
            <small>Kenaikan pangkat II/b → III/a sudah dicatat. Riwayat dan data pegawai diperbarui.</small>
          </span>
        </span>
      </div>
    </div>
  );
}

/* ── Adegan 6: SK KGB terakhir dan SK sesudahnya dipisah (ADR-078) ─────── */

function AdeganSkPisah() {
  return (
    <div className="pmn-tabel">
      <div className="pmn-kepala-tabel">
        <span>Bagian formulir</span>
        <span>Isian dan hitungan</span>
      </div>
      <div className="pmn-baris">
        <span className="pmn-nama">SK KGB terakhir</span>
        <span className="pmn-hitungan">
          <small>TMT 1 Des 2024</small>
          II/b · 7 thn 0 bln
        </span>
      </div>
      <div className="pmn-baris" data-baru="" style={gaya("1.0s")}>
        <span className="pmn-nama">SK PI TMT 1 Feb 2026</span>
        <span className="pmn-hitungan">
          <small>menurut SK</small>
          <span>
            III/a · 3 thn 2 bln <i className="pmn-tag">cocok</i>
          </span>
        </span>
      </div>
      <div className="pmn-baris" data-baru="" style={gaya("1.9s")}>
        <span className="pmn-nama">Dihitung sistem</span>
        <span className="pmn-hitungan">
          <small>masa kerja dipotong 5 tahun</small>
          KGB berikutnya 1 Des 2026
        </span>
      </div>
      <div className="pmn-kaki-lapor">
        <span>Isian SK tetap ada saat jawaban berganti</span>
        <span className="pmn-tekan pmn-tekan-kirim">Ada</span>
      </div>
    </div>
  );
}

/* ── Adegan 7: pratinjau SK KGB dari isian usulan (ADR-078) ─────────────── */

function AdeganPratinjauSk() {
  return (
    <div className="pmn-tabel pmn-sk">
      <div className="pmn-bar">
        <span className="pmn-tombol-g">Batal</span>
        <span className="pmn-tekan pmn-tekan-lapor">Pratinjau SK KGB</span>
        <span className="pmn-tombol-g">Simpan draf</span>
      </div>
      <div className="pmn-baris">
        <span className="pmn-nama">Pangkat/golongan</span>
        <span>Penata Muda (III/a)</span>
      </div>
      <div className="pmn-baris" data-baru="" style={gaya("1.1s")}>
        <span className="pmn-nama">Gaji pokok baru</span>
        <span>Rp2.964.000 · 4 thn 0 bln</span>
      </div>
      <div className="pmn-baris" data-baru="" style={gaya("1.7s")}>
        <span className="pmn-nama">TMT KGB</span>
        <span>1 Desember 2026</span>
      </div>
      <div className="pmn-kaki-lapor">
        <span>Atas dasar SK PI, belum diajukan</span>
        <span className="pmn-tag">Pratinjau</span>
      </div>
      <span className="pmn-sk-air" aria-hidden="true">PRATINJAU USULAN</span>
    </div>
  );
}
