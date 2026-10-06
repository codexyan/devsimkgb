"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashUser } from "../RoleContext";
import { useDialogModal } from "../useDialogModal";
import {
  PERISTIWA_BUKA_PENGUMUMAN_UPT,
  bolehTampilPengumuman,
  kunciPengumumanUpt,
  sedangMengetik,
} from "@/lib/pengumumanUpt";

/* Pop-up pengumuman perubahan untuk Admin UPT (ADR-073): nama menu baru dan pegawai baru yang kini tampil di tabel
   Pegawai Satker. Tiga adegan bergerak yang berganti sendiri, dapat dijeda, dilewati, atau dibuka lagi lewat tombol
   "Apa yang baru".

   Pengumuman ini tidak boleh menjadi sebab data hilang, maka aturannya ketat (lib/pengumumanUpt.ts): hanya tampil di
   halaman tanpa isian, tidak di atas dialog lain, tidak selagi ada kolom yang sedang diketik, dan tidak menyimpan
   apa pun selain penanda "sudah dilihat" di peramban. Semua gerak ada di CSS (dasbor.css, awalan pmn-) dan tiap
   elemen bergerak menempati keadaan akhirnya bila animasi dimatikan, jadi pilihan "Kurangi animasi" tetap
   menampilkan isi yang utuh tanpa gerak. */

const ADEGAN = [
  {
    judul: "Nama menu kini sesuai fungsinya",
    teks: "Data Pegawai menjadi Pegawai Satker, dan Usulan kolektif menjadi Usul KGB Kolektif. Letak menu dan tautan lama tidak berubah.",
  },
  {
    judul: "Pegawai baru hasil unggahan terlihat di tabel",
    teks: "Pegawai yang masih draf, dikembalikan, atau menunggu Kanwil tampil di Pegawai Satker sebagai baris bertanda, dengan saringan Belum tercatat. Barisnya berpindah sendiri setelah Kanwil menyetujui.",
  },
  {
    judul: "Data yang sudah Anda isi tetap aman",
    teks: "Perubahan ini hanya mengganti nama dan tampilan. Draf, usulan, dan berkas yang sudah Anda input tidak berubah dan tidak hilang.",
  },
] as const;

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

const gaya = (d: string): CSSProperties => ({ "--d": d }) as CSSProperties;

export default function PengumumanUpt() {
  const { nip, role } = useDashUser();
  const pathname = usePathname();
  const [buka, setBuka] = useState(false);
  const [adegan, setAdegan] = useState(0);
  const [jeda, setJeda] = useState(false);
  const kunci = kunciPengumumanUpt(nip);

  // Tampil sendiri satu kali, sesudah halaman sempat dimuat. Bila saat itu ada dialog atau kolom yang sedang diketik,
  // dicoba lagi beberapa kali lalu dilepas; penandanya belum dicatat, jadi muncul pada kunjungan berikutnya.
  useEffect(() => {
    const aman = (adaDialog: boolean, mengetik: boolean) =>
      bolehTampilPengumuman({ peran: role, jalur: pathname, adaDialog, sedangMengetik: mengetik, sudahDilihat: false });
    if (!aman(false, false)) return;
    let percobaan = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const coba = () => {
      if (sudahDilihat(kunci)) return;
      if (aman(document.querySelector('[role="dialog"]') !== null, sedangMengetik(document.activeElement))) {
        setAdegan(0);
        setJeda(false);
        setBuka(true);
        return;
      }
      percobaan += 1;
      if (percobaan < 4) timer = setTimeout(coba, 4000);
    };
    timer = setTimeout(coba, 1600);
    return () => clearTimeout(timer);
  }, [role, pathname, kunci]);

  // Dibuka lagi dari tombol "Apa yang baru"; permintaan pengguna sendiri, jadi tidak diperiksa seperti tampil otomatis.
  useEffect(() => {
    const bukaLagi = () => {
      setAdegan(0);
      setJeda(false);
      setBuka(true);
    };
    window.addEventListener(PERISTIWA_BUKA_PENGUMUMAN_UPT, bukaLagi);
    return () => window.removeEventListener(PERISTIWA_BUKA_PENGUMUMAN_UPT, bukaLagi);
  }, []);

  const tutup = useCallback(() => {
    catatDilihat(kunci);
    setBuka(false);
  }, [kunci]);
  const panelRef = useDialogModal(buka, tutup);

  if (role !== "admin_upt" || !buka) return null;

  const terakhir = adegan === ADEGAN.length - 1;
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
            {adegan === 0 && <AdeganMenu />}
            {adegan === 1 && <AdeganTabel />}
            {adegan === 2 && <AdeganAman />}
          </div>
        </div>

        <div className="pmn-seg-baris" role="group" aria-label="Langkah pengumuman">
          {ADEGAN.map((a, i) => (
            <button
              key={a.judul}
              type="button"
              className="pmn-seg"
              data-status={i < adegan ? "lalu" : i === adegan ? "aktif" : "nanti"}
              aria-label={`Langkah ${i + 1} dari ${ADEGAN.length}: ${a.judul}`}
              aria-current={i === adegan ? "step" : undefined}
              onClick={() => setAdegan(i)}
            >
              <span
                className="pmn-isi"
                onAnimationEnd={i === adegan ? () => setAdegan((x) => Math.min(x + 1, ADEGAN.length - 1)) : undefined}
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
              {ADEGAN[adegan].judul}
            </h2>
            <p id="pmn-teks" className="pmn-teks-isi" key={`t${adegan}`}>
              {ADEGAN[adegan].teks}
            </p>
          </div>
          <div className="pmn-kaki">
            <span className="pmn-hitung">
              {adegan + 1} / {ADEGAN.length}
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
